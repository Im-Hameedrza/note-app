import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, unlink, rmdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

// Uses only the public sample as test data and a local SMTP inbox. No real email is sent.
const directory = await mkdtemp(path.join(os.tmpdir(), "note-app-auth-"));
const databaseFile = path.join(directory, "db.json");
const originalDatabase = await readFile("db.json", "utf8");
const seed = JSON.parse(await readFile("db.example.json", "utf8"));
delete seed.users;
delete seed.sessions;
delete seed.passwordResets;
delete seed.rateLimits;
seed.notes.forEach((note) => { delete note.userId; });
await writeFile(databaseFile, JSON.stringify(seed));
const messages = [];
const sockets = new Set();
const smtp = net.createServer((socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
  socket.write("220 localhost test mail server\r\n");
  let buffer = "";
  let collecting = false;
  let message = "";
  socket.on("data", (chunk) => {
    buffer += chunk.toString();
    while (buffer.includes("\r\n")) {
      const end = buffer.indexOf("\r\n");
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      if (collecting) {
        if (line === ".") {
          messages.push(message.replace(/=\r\n/g, "").replace(/=3D/g, "="));
          message = "";
          collecting = false;
          socket.write("250 Message accepted\r\n");
        } else message += line + "\r\n";
      } else if (line.startsWith("EHLO")) socket.write("250 localhost\r\n");
      else if (line.startsWith("DATA")) {
        collecting = true;
        socket.write("354 Send message\r\n");
      } else if (line.startsWith("QUIT")) socket.end("221 Bye\r\n");
      else socket.write("250 OK\r\n");
    }
  });
});
await new Promise((resolve) => smtp.listen(0, "127.0.0.1", resolve));
const port = Number(process.env.AUTH_TEST_PORT || 3057);
const origin = "http://localhost:" + port;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "-p", String(port)], {
  env: {
    ...process.env, BLOB_READ_WRITE_TOKEN: "", VERCEL: "",
    DATABASE_FILE: databaseFile, APP_URL: origin, AUTH_TRUSTED_PROXY_SECRET: "",
    SMTP_HOST: "127.0.0.1", SMTP_PORT: String(smtp.address().port),
    SMTP_FROM: "Note App <test@example.test>", SMTP_USER: "", SMTP_PASSWORD: "",
    NEXT_TELEMETRY_DISABLED: "1", AUTH_TEST_BUILD: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
let serverLog = "";
server.stdout.on("data", (data) => { serverLog = (serverLog + data.toString()).slice(-10000); });
server.stderr.on("data", (data) => { serverLog = (serverLog + data.toString()).slice(-10000); });

function client() {
  const jar = new Map();
  return {
    jar,
    async request(route, body, method = body === undefined ? "GET" : "POST", customOrigin = origin) {
      const response = await fetch(origin + route, {
        method, redirect: "manual",
        headers: {
          Origin: customOrigin,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          Cookie: [...jar].map(([key, value]) => key + "=" + value).join("; "),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      for (const cookie of response.headers.getSetCookie()) {
        const [pair] = cookie.split(";");
        const split = pair.indexOf("=");
        jar.set(pair.slice(0, split), pair.slice(split + 1));
      }
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      return { response, status: response.status, data };
    },
  };
}

function passed(message) { console.log("PASS " + message); }
const account = { username: "auth_tester", email: "auth@example.test", password: "Test password for auth 123!", confirmPassword: "Test password for auth 123!" };
const second = { username: "another_user", email: "other@example.test", password: "Another test password 123!", confirmPassword: "Another test password 123!" };
const newPassword = "Changed test password 456!";

try {
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server.exitCode !== null) throw new Error("Test server exited before it was ready.");
    try {
      const response = await fetch(origin + "/api/notes");
      if (response.status === 401) { ready = true; break; }
    } catch {}
    await delay(1000);
  }
  assert(ready, "Test server should become ready.");
  const anonymous = client();
  const alice = client();
  const bob = client();
  for (const route of ["/auth/signin", "/auth/signup", "/auth/forgot-password", "/auth/reset-password"]) {
    assert.equal((await anonymous.request(route)).status, 200, route);
  }
  for (const route of ["/allnotes", "/search?q=react", "/tags", "/add", "/note/1"]) {
    const result = await anonymous.request(route);
    assert([307, 308].includes(result.status) || String(result.data).includes("/auth/signin"), "Protected page redirects.");
    assert(!String(result.data).includes(seed.notes[0].content), "No protected note content.");
  }
  assert.equal((await anonymous.request("/api/notes")).status, 401);
  assert.equal((await anonymous.request("/api/notes", { title: "unauthorized" })).status, 401);
  assert.equal((await anonymous.request("/api/auth/signup", account, "POST", "https://attacker.example")).status, 403);
  passed("Auth pages render; app, notes API, and cross-origin mutations are protected.");

  assert.equal((await alice.request("/api/auth/signup", { ...account, confirmPassword: "wrong" })).status, 400);
  assert.equal((await alice.request("/api/auth/signup", { ...account, email: "invalid" })).status, 400);
  const created = await alice.request("/api/auth/signup", account);
  assert.equal(created.status, 201);
  assert(!JSON.stringify(created.data).includes("passwordHash"));
  assert.equal((await bob.request("/api/auth/signup", { ...account, username: "AUTH_TESTER", email: "different@example.test" })).status, 409);
  assert.equal((await bob.request("/api/auth/signup", { ...second, email: account.email })).status, 409);
  assert.equal((await bob.request("/api/auth/signup", second)).status, 201);
  const simultaneous = await Promise.all([
    client().request("/api/auth/signup", { ...second, username: "concurrent_user", email: "concurrent@example.test" }),
    client().request("/api/auth/signup", { ...second, username: "concurrent_user", email: "concurrent@example.test" }),
  ]);
  assert.deepEqual(simultaneous.map((result) => result.status).sort(), [201, 409]);
  assert.equal((await alice.request("/api/auth/signup", { ...account, password: "short", confirmPassword: "short" })).status, 400);
  passed("Signup validates fields and rejects duplicate usernames/emails, including concurrent requests.");

  const signedIn = await alice.request("/api/auth/signin", account);
  assert.equal(signedIn.status, 200);
  const setCookie = signedIn.response.headers.getSetCookie().find((cookie) => cookie.startsWith("note_session="));
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=lax/i);
  assert.match(setCookie, /Max-Age=604800/i);
  assert.equal((await anonymous.request("/api/auth/signin", { ...account, password: "wrong" })).status, 401);
  assert.equal((await anonymous.request("/api/auth/signin", { username: "unknown_user", password: account.password })).status, 401);
  assert.equal((await alice.request("/api/notes")).data.length, seed.notes.length);
  assert.equal((await bob.request("/api/auth/signin", second)).status, 200);
  assert.equal((await bob.request("/api/notes")).data.length, 0);
  passed("Correct credentials sign in; wrong credentials fail; original notes belong only to the first account.");

  const note = await alice.request("/api/notes", { title: "Auth flow note", content: "Searchable unique content", tags: ["AuthTest"] });
  assert.equal(note.status, 201);
  assert.equal((await bob.request("/api/notes/" + note.data.id, { isArchived: true }, "PATCH")).status, 404);
  assert.equal((await bob.request("/api/notes/" + note.data.id, undefined, "DELETE")).status, 404);
  assert.equal((await alice.request("/api/notes/" + note.data.id, { isArchived: true }, "PATCH")).data.isArchived, true);
  assert.equal((await alice.request("/api/notes/" + note.data.id, { isArchived: false }, "PATCH")).data.isArchived, false);
  const results = await alice.request("/search?q=AuthTest");
  assert.equal(results.status, 200);
  assert(String(results.data).includes("Auth flow note"));
  const selected = await alice.request("/note/" + note.data.id + "?from=allnotes&q=AuthTest");
  assert.equal(selected.status, 200);
  assert(String(selected.data).includes("Searchable unique content"));
  assert.equal((await alice.request("/api/notes/" + note.data.id, undefined, "DELETE")).status, 200);
  passed("Creating, searching, selecting, archiving, restoring, and deleting notes still work; ownership is enforced.");

  const unknown = await anonymous.request("/api/auth/forgot-password", { username: "unknown_user" });
  const recovery = await anonymous.request("/api/auth/forgot-password", { username: account.username });
  assert.equal(recovery.status, 200);
  assert.deepEqual(recovery.data, unknown.data);
  assert.equal(messages.length, 1);
  const token = messages[0].match(/#token=([a-f0-9]{64})/)?.[1];
  assert(token, "Local SMTP inbox should receive the recovery link.");
  assert(!JSON.stringify(recovery.data).includes(token));
  assert.equal((await anonymous.request("/api/auth/reset-password", { username: "stolen_account", password: newPassword, confirmPassword: newPassword })).status, 401);
  assert.equal((await anonymous.request("/api/auth/verify-reset", { token: "invalid" })).status, 401);
  const verified = await anonymous.request("/api/auth/verify-reset", { token });
  assert.equal(verified.status, 200);
  assert.equal(verified.data.username, account.username);
  const resetPage = await anonymous.request("/auth/reset-password");
  assert.equal(resetPage.status, 200);
  passed("Username recovery sends an email; unknown accounts get the same response; reset requires a valid link.");

  assert.equal((await anonymous.request("/api/auth/reset-password", { username: second.username, password: newPassword, confirmPassword: newPassword })).status, 409);
  assert.equal((await anonymous.request("/api/auth/reset-password", { username: "updated_tester", password: newPassword, confirmPassword: "wrong" })).status, 400);
  assert.equal((await anonymous.request("/api/auth/reset-password", { username: "updated_tester", password: newPassword, confirmPassword: newPassword })).status, 200);
  assert.equal((await alice.request("/api/notes")).status, 401);
  assert.equal((await anonymous.request("/api/auth/verify-reset", { token })).status, 401);
  assert.equal((await anonymous.request("/api/auth/signin", account)).status, 401);
  assert.equal((await anonymous.request("/api/auth/signin", { username: "updated_tester", password: account.password })).status, 401);
  assert.equal((await alice.request("/api/auth/signin", { username: "updated_tester", password: newPassword })).status, 200);
  assert.equal((await alice.request("/api/notes")).data.length, seed.notes.length);
  passed("Username/password changes persist; old credentials and sessions stop working; new credentials work; reset links cannot be reused.");

  const stored = JSON.parse(await readFile(databaseFile, "utf8"));
  assert(stored.users.every((user) => /^scrypt\$131072\$8\$1\$/.test(user.passwordHash)));
  assert(!JSON.stringify(stored).includes(account.password));
  assert(!JSON.stringify(stored).includes(newPassword));
  assert(!JSON.stringify(stored).includes(token));
  assert(!JSON.stringify(stored).includes(alice.jar.get("note_session")));
  passed("Passwords use salted scrypt hashes; session and reset secrets are also hashed in the database.");

  await anonymous.request("/api/auth/forgot-password", { username: "updated_tester" });
  const usernameToken = messages.at(-1).match(/#token=([a-f0-9]{64})/)[1];
  await anonymous.request("/api/auth/verify-reset", { token: usernameToken });
  assert.equal((await anonymous.request("/api/auth/reset-password", { username: "renamed_tester", password: "", confirmPassword: "" })).status, 200);
  assert.equal((await alice.request("/api/auth/signin", { username: "renamed_tester", password: newPassword })).status, 200);
  await anonymous.request("/api/auth/forgot-password", { username: "renamed_tester" });
  const passwordToken = messages.at(-1).match(/#token=([a-f0-9]{64})/)[1];
  await anonymous.request("/api/auth/verify-reset", { token: passwordToken });
  assert.equal((await anonymous.request("/api/auth/reset-password", { username: "renamed_tester", password: account.password, confirmPassword: account.password })).status, 200);
  assert.equal((await alice.request("/api/auth/signin", { username: "renamed_tester", password: account.password })).status, 200);
  const oldSession = alice.jar.get("note_session");
  assert.equal((await alice.request("/api/auth/logout", {})).status, 200);
  alice.jar.set("note_session", oldSession);
  assert.equal((await alice.request("/api/notes")).status, 401);
  passed("Username-only and password-only updates work; logout invalidates the server session.");

  // Modify only the isolated test database to exercise expiry without waiting 15 minutes.
  await anonymous.request("/api/auth/forgot-password", { username: "renamed_tester" });
  const expiredToken = messages.at(-1).match(/#token=([a-f0-9]{64})/)[1];
  const expiring = JSON.parse(await readFile(databaseFile, "utf8"));
  expiring.passwordResets.forEach((item) => { item.expiresAt = 0; });
  expiring.sessions.forEach((item) => { item.expiresAt = 0; });
  await writeFile(databaseFile, JSON.stringify(expiring));
  assert.equal((await anonymous.request("/api/auth/verify-reset", { token: expiredToken })).status, 401);
  assert.equal((await bob.request("/api/notes")).status, 401);
  for (let index = 0; index < 5; index++) {
    assert.equal((await anonymous.request("/api/auth/forgot-password", { username: "rate_test" })).status, 200);
  }
  assert.equal((await anonymous.request("/api/auth/forgot-password", { username: "rate_test" })).status, 429);
  passed("Expired sessions/links are rejected and recovery requests are rate limited.");
  assert.equal(await readFile("db.json", "utf8"), originalDatabase);
  passed("The original database is unchanged.");
  console.log("All authentication integration checks passed.");

  if (process.argv.includes("--preview") && process.stdin.isTTY) {
    console.log("Preview server is ready at " + origin + ". Press Enter to stop.");
    process.stdin.resume();
    await new Promise((resolve) => process.stdin.once("data", resolve));
    process.stdin.pause();
  }
} catch (error) {
  console.error(error.message);
  // Print only compiler diagnostics, never request bodies, passwords, tokens, or mail.
  const diagnostics = serverLog.split("\n").filter((line) =>
    /Module not found|Can't resolve|SyntaxError|Error:|Failed to compile/.test(line));
  if (diagnostics.length) console.error(diagnostics.join("\n"));
  process.exitCode = 1;
} finally {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  } else {
    server.kill("SIGTERM");
  }
  for (const socket of sockets) socket.destroy();
  await new Promise((resolve) => smtp.close(resolve));
  // These are individual files in the freshly created test directory, never the app database.
  await unlink(databaseFile).catch(() => {});
  await unlink(databaseFile + ".lock").catch(() => {});
  await rmdir(directory).catch(() => {});
}
