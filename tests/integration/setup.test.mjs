import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, copyFile, readFile, writeFile, unlink, rmdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setupProject } from "../../scripts/setup.mjs";

async function temporaryProject(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "note-setup-test-"));
  try {
    for (const file of ["db.example.json", ".env.example"]) await copyFile(new URL("../../" + file, import.meta.url), path.join(directory, file));
    await run(directory);
  } finally {
    // Remove only the four known files created in this fresh test directory.
    for (const file of ["db.example.json", ".env.example", "db.json", ".env.local"]) await unlink(path.join(directory, file)).catch(error => { if (error.code !== "ENOENT") throw error; });
    await rmdir(directory);
  }
}

test("fresh setup copies only public sample data and blank credential configuration", async () => {
  await temporaryProject(async directory => {
    const results = await setupProject(directory);
    assert(results.every(result => result.created));
    assert.deepEqual(await readFile(path.join(directory, "db.json")), await readFile(path.join(directory, "db.example.json")));
    const database = JSON.parse(await readFile(path.join(directory, "db.json"), "utf8"));
    for (const collection of ["users", "sessions", "passwordResets", "rateLimits", "noteRequests"]) assert.deepEqual(database[collection], []);
    assert(database.notes.length > 0 && database.notes.every(note => !note.userId));
    assert.match(await readFile(path.join(directory, ".env.local"), "utf8"), /^SMTP_PASSWORD=$/m);
  });
});

test("repeated setup never overwrites existing database or environment bytes", async () => {
  await temporaryProject(async directory => {
    const privateDatabase = Buffer.from('{"notes":[],"localOnly":"test sentinel"}\n');
    const privateEnvironment = Buffer.from("SMTP_PASSWORD=synthetic-test-sentinel\n");
    await writeFile(path.join(directory, "db.json"), privateDatabase);
    await writeFile(path.join(directory, ".env.local"), privateEnvironment);
    for (let attempt = 0; attempt < 2; attempt++) assert((await setupProject(directory)).every(result => !result.created));
    assert.deepEqual(await readFile(path.join(directory, "db.json")), privateDatabase);
    assert.deepEqual(await readFile(path.join(directory, ".env.local")), privateEnvironment);
  });
});

test("setup creates a missing environment without changing an existing database", async () => {
  await temporaryProject(async directory => {
    const existing = Buffer.from('{"notes":[],"marker":"preserve"}');
    await writeFile(path.join(directory, "db.json"), existing);
    assert.deepEqual(await setupProject(directory), [{ file: "db.json", created: false }, { file: ".env.local", created: true }]);
    assert.deepEqual(await readFile(path.join(directory, "db.json")), existing);
  });
});
