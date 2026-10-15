import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const before = await readFile("db.json");
const origin = "http://localhost:3089";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3089"], {
  env: { ...process.env, NODE_ENV: "production", BLOB_READ_WRITE_TOKEN: "", VERCEL: "", APP_URL: origin, AUTH_TEST_BUILD: "", AUTH_TRUSTED_PROXY_SECRET: "" },
  stdio: "ignore", windowsHide: true,
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error("Production test server exited.");
    try { if ((await fetch(origin + "/auth/signin")).ok) { ready = true; break; } } catch {}
    await delay(100);
  }
  assert.ok(ready);
  for (const [route, body] of [["/api/notes"], ["/api/auth/signup", { username: "production_test", email: "production@example.test", password: "Testing password 123!", confirmPassword: "Testing password 123!" }]]) {
    const response = await fetch(origin + route, {
      method: body ? "POST" : "GET",
      headers: { Origin: origin, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal(response.status, 503);
    const text = await response.text();
    assert.match(text, /Configure BLOB_READ_WRITE_TOKEN/);
    assert.ok(!text.includes("passwordHash") && !text.includes("db.json") && !text.includes("var/task"));
  }
  assert.deepEqual(await readFile("db.json"), before);
  console.log("PASS Production build rejects missing Blob token with 503 and never writes local db.json.");
} finally {
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  else { server.kill(); await new Promise(resolve => server.once("exit", resolve)); }
}
