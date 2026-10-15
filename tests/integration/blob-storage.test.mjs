import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, writeFile, unlink, rmdir, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { BlobPreconditionFailedError } from "@vercel/blob";
import { createBlobStorage } from "../../src/lib/server/blob-storage.mjs";
import { storageMode, validateDatabase } from "../../src/lib/server/storage-schema.mjs";
import { runBlobCommand } from "../../scripts/blob-database.mjs";

const seed = () => ({
  users: [{ id: "u", username: "Owner", usernameKey: "owner", email: "owner@example.test",
    passwordHash: "scrypt$131072$8$1$" + "a".repeat(32) + "$" + "b".repeat(128), createdAt: "2026-01-01T00:00:00.000Z" }],
  notes: [], sessions: [], passwordResets: [], rateLimits: [], noteRequests: [],
});

function fixture(initial = seed()) {
  let content = initial && JSON.stringify(initial), revision = 1;
  const calls = [];
  let fail = false, conflicts = false, commitThenFail = false;
  const sdk = {
    async get(key, options) {
      calls.push({ operation: "get", key, options });
      if (!content) return null;
      return { statusCode: 200, blob: { etag: String(revision) }, stream: new Response(content).body };
    },
    async put(key, body, options) {
      calls.push({ operation: "put", key, options });
      if (fail) throw new Error("simulated upload failure");
      if (conflicts || (options.ifMatch && options.ifMatch !== String(revision))) throw new BlobPreconditionFailedError();
      if (!options.allowOverwrite && content) throw new Error("exists");
      content = body; revision++;
      if (commitThenFail) throw new Error("response lost after commit");
      return { etag: String(revision) };
    },
  };
  const connect = () => createBlobStorage({ token: "test-only", sdk, wait: async () => {} });
  return { connect, calls, state: () => JSON.parse(content), fail: () => { fail = true; },
    conflict: () => { conflicts = true; }, ambiguous: () => { commitThenFail = true; } };
}

test("production never falls back to a local file, including Vercel preview", () => {
  assert.equal(storageMode({ NODE_ENV: "development" }), "local");
  assert.equal(storageMode({ NODE_ENV: "production", BLOB_READ_WRITE_TOKEN: "token" }), "blob");
  assert.throws(() => storageMode({ NODE_ENV: "production", DATABASE_FILE: "db.json" }), /Configure/);
  assert.throws(() => storageMode({ VERCEL: "1" }), /Configure/);
  assert.throws(() => createBlobStorage({ token: "" }), /Configure/);
});

test("private, uncached reads and ETag-guarded writes; restart persistence", async () => {
  const f = fixture();
  await f.connect().update(db => { db.notes.push({ id: "n", userId: "u", title: "Saved", content: "", tags: [], isArchived: false, lastEdited: "2026-01-01T00:00:00.000Z" }); });
  assert.equal((await f.connect().read()).notes[0].title, "Saved");
  for (const call of f.calls) {
    assert.equal(call.options.access, "private");
    assert.equal(call.options.token, "test-only");
    if (call.operation === "get") assert.equal(call.options.useCache, false);
    else { assert.equal(call.options.ifMatch, "1"); assert.equal(call.options.addRandomSuffix, false); }
  }
});

test("simultaneous independent updates survive bounded conflict retries", async () => {
  const f = fixture();
  await Promise.all(Array.from({ length: 4 }, (_, n) => f.connect().update(db => {
    db.rateLimits.push({ key: String(n).padStart(64, "0"), count: 1, expiresAt: 9999999999999 });
  })));
  assert.equal(f.state().rateLimits.length, 4);
  assert.ok(f.calls.filter(call => call.operation === "put").length > 4);
});

test("replayed callbacks can reject concurrent edits to the same record", async () => {
  const f = fixture();
  const mutate = value => {
    let original;
    return f.connect().update(db => {
      const version = JSON.stringify(db.users[0]);
      if (original !== undefined && original !== version) throw new Error("edit conflict");
      original = version;
      db.users[0].updatedAt = value;
    });
  };
  const results = await Promise.allSettled([mutate("2026-02-01T00:00:00.000Z"), mutate("2026-03-01T00:00:00.000Z")]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.match(results.find(result => result.status === "rejected").reason.message, /conflict/);
});

test("retry exhaustion returns 409 and preserves previous content", async () => {
  const f = fixture(), before = f.state();
  f.conflict();
  await assert.rejects(f.connect().update(db => { db.notes = []; }), error => error.status === 409);
  assert.equal(f.calls.filter(call => call.operation === "put").length, 5);
  assert.deepEqual(f.state(), before);
});

test("missing blob is not auto-seeded; failed upload preserves data", async () => {
  const missing = fixture(null);
  await assert.rejects(missing.connect().read(), /not initialized/);
  await assert.rejects(missing.connect().update(() => {}), /not initialized/);
  assert.equal(missing.calls.filter(call => call.operation === "put").length, 0);
  const f = fixture(), before = f.state();
  f.fail();
  await assert.rejects(f.connect().update(db => { db.notes = []; }), /write failed/);
  assert.deepEqual(f.state(), before);
  assert.equal(f.calls.filter(call => call.operation === "put").length, 1);
});

test("ambiguous committed upload is reported and never automatically replayed", async () => {
  const f = fixture();
  f.ambiguous();
  await assert.rejects(f.connect().update(db => { db.users[0].updatedAt = "2026-04-01T00:00:00.000Z"; }), /Refresh/);
  assert.equal(f.calls.filter(call => call.operation === "put").length, 1);
  assert.equal((await f.connect().read()).users[0].updatedAt, "2026-04-01T00:00:00.000Z");
});

test("seeding is atomic create-only and cannot overwrite existing content", async () => {
  const f = fixture(null);
  const results = await Promise.allSettled([f.connect().initialize(seed()), f.connect().initialize(seed())]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(f.calls.filter(call => call.operation === "put").every(call => call.options.allowOverwrite === false && !call.options.ifMatch), true);
  assert.deepEqual(f.state(), seed());
});

test("validation rejects plaintext credentials, orphan ownership and duplicate IDs", () => {
  const metadata = { ...seed(), customMetadata: ["preserved"] };
  assert.deepEqual(validateDatabase(structuredClone(metadata)), metadata);
  const plain = seed(); plain.users[0].password = "forbidden";
  assert.throws(() => validateDatabase(plain), /validation/);
  const invalidCollection = seed(); invalidCollection.notes = null;
  assert.throws(() => validateDatabase(invalidCollection), /collection/);
  const duplicate = seed(); duplicate.users.push({ ...duplicate.users[0] });
  assert.throws(() => validateDatabase(duplicate), /validation/);
  const orphan = seed(); orphan.sessions.push({ userId: "other", tokenHash: "a".repeat(64), expiresAt: 1 });
  assert.throws(() => validateDatabase(orphan), /validation/);
  const invalid = seed(); invalid.notes.push({ id: "n", userId: "other" });
  assert.throws(() => validateDatabase(invalid), /validation/);
});

test("migration dry-run, repeat protection, IDs/timestamps, source preservation and recovery backup", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "note-blob-test-"));
  const file = path.join(directory, "source.json"), backup = path.join(directory, "backup.json");
  const original = JSON.stringify(seed(), null, 2);
  await writeFile(file, original);
  const f = fixture(null);
  try {
    assert.match(await runBlobCommand(["validate", file]), /passed/);
    assert.match(await runBlobCommand(["import", file], f.connect()), /nothing uploaded/);
    assert.equal(f.calls.length, 0);
    await runBlobCommand(["import", file, "--apply"], f.connect());
    assert.deepEqual(f.state(), seed());
    await assert.rejects(runBlobCommand(["import", file, "--apply"], f.connect()), /exists/);
    assert.equal(await readFile(file, "utf8"), original);
    await runBlobCommand(["backup", backup], f.connect());
    assert.deepEqual(JSON.parse(await readFile(backup, "utf8")), seed());
    await assert.rejects(runBlobCommand(["backup", backup], f.connect()), error => error.code === "EEXIST");
    await assert.rejects(runBlobCommand(["restore", backup], f.connect()), /confirm-restore/);
    await assert.rejects(f.connect().replace(seed(), "stale"), BlobPreconditionFailedError);
    await f.connect().update(db => { db.users[0].updatedAt = "2026-06-01T00:00:00.000Z"; });
    await runBlobCommand(["restore", backup, "--confirm-restore"], f.connect(), { backupDirectory: directory });
    assert.deepEqual(f.state(), seed());
    const recoveryFile = (await readdir(directory)).find(name => name.startsWith("before-restore-"));
    assert.equal(JSON.parse(await readFile(path.join(directory, recoveryFile), "utf8")).users[0].updatedAt, "2026-06-01T00:00:00.000Z");
  } finally { for (const name of await readdir(directory)) await unlink(path.join(directory, name)); await rmdir(directory); }
});
test("stored data survives separate application processes (mock remote store)", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "note-blob-restart-"));
  const filename = path.join(directory, "remote.json");
  await writeFile(filename, JSON.stringify(seed()));
  const moduleUrl = new URL("../../src/lib/server/blob-storage.mjs", import.meta.url).href;
  const program = [
    'import { readFile, writeFile } from "node:fs/promises";',
    'import assert from "node:assert/strict";',
    'const { createBlobStorage } = await import(process.argv[1]);',
    'const filename = process.argv[2];',
    'const sdk = { get: async () => ({ statusCode: 200, blob: { etag: "revision" }, stream: new Response(await readFile(filename)).body }), put: async (key, body) => writeFile(filename, body) };',
    'const storage = createBlobStorage({ token: "synthetic", sdk });',
    'if (process.argv[3] === "write") await storage.update(db => { db.users[0].updatedAt = "2026-07-01T00:00:00.000Z"; });',
    'else assert.equal((await storage.read()).users[0].updatedAt, "2026-07-01T00:00:00.000Z");',
  ].join("\n");
  try {
    for (const mode of ["write", "read"]) {
      const result = spawnSync(process.execPath, ["--conditions=react-server", "--input-type=module", "-e", program, moduleUrl, filename, mode], { encoding: "utf8", windowsHide: true });
      assert.equal(result.status, 0, result.stderr);
    }
  } finally { await unlink(filename); await rmdir(directory); }
});
test("invalid content or missing ETag cannot be overwritten", async () => {
  for (const response of [
    { statusCode: 200, blob: { etag: "one" }, stream: new Response("invalid JSON").body },
    { statusCode: 200, blob: { etag: "" }, stream: new Response(JSON.stringify(seed())).body },
  ]) {
    let uploads = 0;
    const storage = createBlobStorage({ token: "synthetic", sdk: {
      get: async () => response, put: async () => { uploads++; },
    } });
    await assert.rejects(storage.update(() => {}));
    assert.equal(uploads, 0);
  }
});

test("a failed pre-restore backup prevents replacement", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "note-blob-recovery-"));
  const filename = path.join(directory, "source.json");
  await writeFile(filename, JSON.stringify(seed()));
  const f = fixture();
  try {
    await assert.rejects(runBlobCommand(["restore", filename, "--confirm-restore"], f.connect(), { backupDirectory: filename }));
    assert.equal(f.calls.some(call => call.operation === "put"), false);
  } finally { await unlink(filename); await rmdir(directory); }
});

test("real Blob SDK sends private origin reads and conditional writes, then re-reads after HTTP 412", async t => {
  const { MockAgent, setGlobalDispatcher, getGlobalDispatcher } = await import("undici");
  const previous = getGlobalDispatcher(), agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  t.after(async () => { setGlobalDispatcher(previous); await agent.close(); });
  const token = "vercel_blob_rw_wirestore_" + "x".repeat(32);
  const calls = [], waits = [];
  let database = seed(), revision = '"v1"', uploads = 0;
  function record(options) {
    const raw = options.headers || {};
    const entries = Array.isArray(raw) && typeof raw[0] === "string"
      ? Array.from({ length: raw.length / 2 }, (_, n) => [raw[n * 2], raw[n * 2 + 1]]) : raw;
    const call = { url: new URL(options.path, options.origin), headers: new Headers(entries), method: options.method };
    calls.push(call);
    return call;
  }
  agent.get("https://wirestore.private.blob.vercel-storage.com")
    .intercept({ path: "/notes/database.json?cache=0", method: "GET" })
    .reply(options => {
      record(options);
      return { statusCode: 200, data: JSON.stringify(database), responseOptions: { headers: { etag: revision, "content-type": "application/json" } } };
    }).persist();
  agent.get(/.*/).intercept({ path: /.*/, method: "PUT" }).reply(options => {
    record(options);
    uploads++;
    if (uploads === 1) {
      database.rateLimits.push({ key: "d".repeat(64), count: 1, expiresAt: 9999999999999 });
      revision = '"v2"';
      return { statusCode: 412, data: { error: { code: "precondition_failed", message: "Concurrent update" } } };
    }
    database = JSON.parse(String(options.body));
    revision = '"v3"';
    return { statusCode: 200, data: { url: "https://wirestore.private.blob.vercel-storage.com/notes/database.json",
      pathname: "notes/database.json", contentType: "application/json", etag: revision } };
  }).persist();
  const storage = createBlobStorage({ token, wait: async ms => { waits.push(ms); } });
  await storage.update(db => { db.users[0].updatedAt = "2026-08-01T00:00:00.000Z"; });
  assert.equal(database.rateLimits.length, 1, "Concurrent data must survive the retry");
  assert.equal(database.users[0].updatedAt, "2026-08-01T00:00:00.000Z");
  assert.equal(waits.length, 1);
  assert.ok(waits[0] >= 25 && waits[0] < 50);
  assert.deepEqual(calls.map(call => call.method), ["GET", "PUT", "GET", "PUT"]);
  for (const call of calls) {
    assert.equal(call.headers.get("authorization"), "Bearer " + token);
    assert.equal(call.url.protocol, "https:");
    if (call.method === "GET") {
      assert.equal(call.url.hostname, "wirestore.private.blob.vercel-storage.com");
      assert.equal(call.url.searchParams.get("cache"), "0");
    } else {
      assert.equal(call.headers.get("x-vercel-blob-access"), "private");
      assert.equal(call.headers.get("x-add-random-suffix"), "0");
      assert.equal(call.headers.get("x-allow-overwrite"), "1");
    }
  }
  assert.deepEqual(calls.filter(call => call.method === "PUT").map(call => call.headers.get("x-if-match")), ['"v1"', '"v2"']);
});
test("storage cannot be imported without the server-only runtime condition", () => {
  const url = new URL("../../src/lib/server/blob-storage.mjs", import.meta.url).href;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", "await import(process.argv[1])", url], { encoding: "utf8", windowsHide: true });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Client Component/);
});