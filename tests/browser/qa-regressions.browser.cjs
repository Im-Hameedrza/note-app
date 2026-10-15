const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const { chromium } = require(process.env.THEME_PLAYWRIGHT_PATH || "playwright");

// These tests use fresh databases and never mutate the real application data.
const port = Number(process.env.QA_TEST_PORT || 3077);
const origin = "http://localhost:" + port;
const cases = [], servers = [], runtimeErrors = [];
let directory, database, browser, context, page;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const account = { username: "qa_fixed", email: "fixed@example.test", password: "Fixed regression password 123!", confirmPassword: "Fixed regression password 123!" };
const fixture = { title: "Complete lifecycle", content: "Mercury 123 <script>window.qaInjected=true</script>\n\u0645\u0631\u062d\u0628\u0627 \u4e16\u754c \ud83d\ude00", tags: ["QAFlow", "Work"] };
const button = name => page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
async function api(route, method = "GET", data, client = context, extraHeaders = {}, base = origin) {
  const response = await client.request.fetch(base + route, { method, headers: { Origin: base, ...extraHeaders }, ...(data === undefined ? {} : { data }) });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status(), body };
}
async function list() { const result = await api("/api/notes"); assert.equal(result.status, 200); return result.body; }
async function record(id) { return (await list()).find(note => note.id === id); }
async function create(fields = {}) {
  const result = await api("/api/notes", "POST", { ...fixture, ...fields });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body;
}
async function go(route) { assert.equal((await page.goto(origin + route)).status(), 200, route); }
async function fill(fields = fixture) {
  await page.getByRole("textbox", { name: "Note title", exact: true }).fill(fields.title);
  await page.getByRole("textbox", { name: "Note content", exact: true }).fill(fields.content);
  for (const tag of fields.tags) {
    await page.getByRole("combobox", { name: "Note tags" }).fill(tag);
    await page.getByRole("combobox", { name: "Note tags" }).press("Enter");
  }
}
async function poll(check) {
  for (let attempt = 0; attempt < 100; attempt++) { if (await check()) return; await delay(50); }
  assert.fail("Expected condition did not become true.");
}
async function confirm(name) {
  await button(name).click();
  await page.getByRole("dialog", { name, exact: true }).getByRole("button", { name, exact: true }).click();
}
async function test(id, name, run) {
  try { await run(); cases.push({ id, name, result: "PASS" }); console.log("PASS " + id + " " + name); }
  catch (error) {
    cases.push({ id, name, result: "FAIL", error: error.stack });
    console.error("FAIL " + id + " " + name + ": " + error.message);
    await page?.screenshot({ path: path.join(directory, id + ".png"), fullPage: true }).catch(() => {});
    process.exitCode = 1;
  }
  await fs.writeFile(path.join(directory, "results.json"), JSON.stringify({ cases, runtimeErrors }, null, 2));
}
async function start(databaseFile, serverPort, env = {}) {
  const base = "http://localhost:" + serverPort;
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(serverPort)], {
    env: { ...process.env, DATABASE_FILE: databaseFile, APP_URL: base, AUTH_TRUSTED_PROXY_SECRET: "", SMTP_HOST: "", SMTP_FROM: "", ...env },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  servers.push(server);
  let log = "";
  server.stdout.on("data", data => { log = (log + data).slice(-12000); });
  server.stderr.on("data", data => { log = (log + data).slice(-12000); });
  for (let n = 0; n < 120; n++) {
    if (server.exitCode !== null) throw new Error("QA server exited: " + log);
    try { if ((await fetch(base + "/auth/signin")).ok) return; } catch {}
    await delay(100);
  }
  throw new Error("QA server did not start: " + log);
}
(async () => {
  const originalDatabase = await fs.readFile("db.json");
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "note-fixed-qa-"));
  database = path.join(directory, "db.json");
  await fs.writeFile(database, JSON.stringify({ notes: [] }));
  await start(database, port);
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => runtimeErrors.push(error.message));
  assert.equal((await api("/api/auth/signup", "POST", account)).status, 201);
  assert.equal((await api("/api/auth/signin", "POST", account)).status, 200);

  for (const width of [320, 375, 768, 1024, 1440]) {
    await test("BUG-002-" + width, "Visible creation entry and saving at " + width + "px", async () => {
      await page.setViewportSize({ width, height: 900 }); await go("/allnotes");
      const link = page.getByRole("link", { name: "Create New Note", exact: true }).filter({ visible: true });
      const bounds = await link.boundingBox(); assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width);
      if (width < 1024) assert(bounds.y + bounds.height < 780, "Create action overlaps bottom navigation");
      await link.click(); await page.waitForURL("**/add");
      await fill({ ...fixture, title: "Created at " + width });
      await button("Save Note").click(); await page.waitForURL("**/allnotes");
      assert.equal((await list()).filter(note => note.title === "Created at " + width).length, 1);
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  let lifecycle = await create();
  await test("BUG-001-edit", "Populated editor saves title, content and tags with a newer timestamp", async () => {
    const stored = JSON.parse(await fs.readFile(database, "utf8"));
    stored.notes.find(note => note.id === lifecycle.id).customMetadata = { sentinel: "preserve me" };
    await fs.writeFile(database, JSON.stringify(stored));
    await go("/note/" + lifecycle.id); await button("Edit Note").click();
    assert.equal(await page.getByRole("textbox", { name: "Note title" }).inputValue(), fixture.title);
    assert.equal(await page.getByRole("textbox", { name: "Note content" }).inputValue(), fixture.content);
    assert(await page.getByRole("button", { name: "Remove Work", exact: true }).isVisible());
    await page.getByRole("textbox", { name: "Note title" }).fill("Edited lifecycle");
    await page.getByRole("textbox", { name: "Note content" }).fill("Updated searchable Venus content\n\u4e16\u754c");
    await page.getByRole("button", { name: "Remove Work", exact: true }).click();
    await page.getByRole("combobox", { name: "Note tags" }).fill("EditedTag");
    await page.getByRole("combobox", { name: "Note tags" }).press("Enter");
    await button("Save Note").click();
    await poll(async () => (await record(lifecycle.id)).title === "Edited lifecycle");
    const updated = await record(lifecycle.id);
    assert(updated.lastEdited > lifecycle.lastEdited);
    assert.equal(updated.userId, lifecycle.userId); assert.equal(updated.isArchived, false);
    assert.deepEqual(updated.customMetadata, { sentinel: "preserve me" });
    assert.deepEqual(updated.tags, ["QAFlow", "EditedTag"]);
    lifecycle = updated;
    await page.reload(); assert.equal(await page.locator("article h1").innerText(), updated.title);
    await go("/search?q=Venus"); await page.getByRole("heading", { name: updated.title, exact: true }).waitFor();
    await go("/search?q=Mercury"); assert.equal(await page.getByRole("heading", { name: updated.title, exact: true }).count(), 0);
  });
  await test("BUG-001-owner", "Only the owner can edit; partial updates preserve unrelated fields", async () => {
    const other = await browser.newContext();
    const second = { ...account, username: "qa_other", email: "other@example.test" };
    try {
      assert.equal((await api("/api/auth/signup", "POST", second, other)).status, 201);
      assert.equal((await api("/api/auth/signin", "POST", second, other)).status, 200);
      assert.equal((await api("/api/notes/" + lifecycle.id, "PATCH", { title: "stolen" }, other)).status, 404);
      const guest = await browser.newContext();
      try { assert.equal((await api("/api/notes/" + lifecycle.id, "PATCH", { title: "stolen" }, guest)).status, 401); }
      finally { await guest.close(); }
      const updated = await api("/api/notes/" + lifecycle.id, "PATCH", { title: lifecycle.title, id: "replacement", userId: "replacement" });
      assert.equal(updated.status, 200); assert.equal(updated.body.id, lifecycle.id); assert.equal(updated.body.userId, lifecycle.userId);
      assert.equal(updated.body.content, lifecycle.content); assert.deepEqual(updated.body.customMetadata, lifecycle.customMetadata);
      assert.equal(updated.body.lastEdited, lifecycle.lastEdited, "A no-op update should not change lastEdited");
    } finally { await other.close(); }
  });

  await test("BUG-001-legacy", "Legacy numeric ID zero edits and archives without creating a replacement note", async () => {
    const legacy = await create({ title: "Legacy numeric ID" });
    const stored = JSON.parse(await fs.readFile(database, "utf8"));
    stored.notes.find(note => note.id === legacy.id).id = 0;
    await fs.writeFile(database, JSON.stringify(stored));
    const before = (await list()).length;
    await go("/note/0"); await button("Edit Note").click();
    await page.getByRole("textbox", { name: "Note title", exact: true }).fill("Legacy edited");
    await button("Save Note").click(); await poll(async () => (await record(0)).title === "Legacy edited");
    assert.equal((await list()).length, before); assert.equal(new URL(page.url()).pathname, "/note/0");
    await page.reload(); await confirm("Archive Note"); await poll(async () => (await record(0)).isArchived);
    assert.equal((await record(0)).id, 0);
  });
  await test("BUG-004-cancel", "Cancel discards a draft and restores an existing note without saving", async () => {
    const before = await list(); await go("/add"); await fill({ ...fixture, title: "Discard draft" });
    await button("Cancel").click(); await page.waitForURL("**/allnotes"); assert.deepEqual(await list(), before);
    await go("/note/" + lifecycle.id); await button("Edit Note").click();
    await page.getByRole("textbox", { name: "Note title" }).fill("Discard edit");
    await button("Cancel").click(); assert.equal(await page.locator("article h1").innerText(), lifecycle.title);
    assert.deepEqual(await record(lifecycle.id), lifecycle);
  });
  await test("BUG-001-errors", "Edit validation and server failures keep the original record and draft", async () => {
    await go("/note/" + lifecycle.id); await button("Edit Note").click();
    await page.getByRole("textbox", { name: "Note title" }).fill(""); assert(await button("Save Note").isDisabled());
    await page.getByRole("textbox", { name: "Note title" }).fill("Retry edit");
    await page.route("**/api/notes/" + lifecycle.id, route => route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"Edit temporarily unavailable"}' }));
    try {
      await button("Save Note").click(); await page.getByText("Edit temporarily unavailable", { exact: true }).waitFor();
      assert(await button("Save Note").isEnabled()); assert.equal(await page.getByRole("textbox", { name: "Note title" }).inputValue(), "Retry edit");
      assert.deepEqual(await record(lifecycle.id), lifecycle);
    } finally { await page.unroute("**/api/notes/" + lifecycle.id); }
    await button("Cancel").click();
    const invalid = await api("/api/notes/" + lifecycle.id, "PATCH", { content: " " });
    assert.equal(invalid.status, 400); assert(invalid.body.errors.content);
  });
  await test("BUG-001-archived", "Archived notes can be edited while preserving archive state", async () => {
    assert.equal((await api("/api/notes/" + lifecycle.id, "PATCH", { isArchived: true })).status, 200);
    await go("/note/" + lifecycle.id); await button("Edit Note").click();
    await page.getByRole("textbox", { name: "Note content" }).fill("Archived edited content"); await button("Save Note").click();
    await poll(async () => (await record(lifecycle.id)).content === "Archived edited content");
    lifecycle = await record(lifecycle.id); assert.equal(lifecycle.isArchived, true); assert.deepEqual(lifecycle.customMetadata, { sentinel: "preserve me" });
  });

  await test("BUG-001-pending", "Repeated edit saves submit one update and preserve the same note ID", async () => {
    await go("/note/" + lifecycle.id); await button("Edit Note").click();
    await page.getByRole("textbox", { name: "Note content", exact: true }).fill("Repeated edit saved once");
    let release, count = 0; const gate = new Promise(resolve => { release = resolve; });
    await page.route("**/api/notes/" + lifecycle.id, async route => { count++; await gate; await route.continue(); });
    try {
      await button("Save Note").dblclick(); assert(await button("Saving...").isDisabled()); release();
      await poll(async () => (await record(lifecycle.id)).content === "Repeated edit saved once");
      assert.equal(count, 1); lifecycle = await record(lifecycle.id); assert.equal(lifecycle.isArchived, true);
      assert.equal((await list()).filter(note => note.id === lifecycle.id).length, 1);
    } finally { release(); await page.unroute("**/api/notes/" + lifecycle.id); }
  });
  await test("BUG-006-state", "Archive/Restore follow stored state on direct and stale-source URLs", async () => {
    await go("/note/" + lifecycle.id); await button("Restore Note").waitFor(); await confirm("Restore Note");
    await poll(async () => !(await record(lifecycle.id)).isArchived); await button("Archive Note").waitFor();
    await go("/note/" + lifecycle.id + "?from=archived"); await button("Archive Note").waitFor();
    lifecycle = await record(lifecycle.id);
  });
  for (const action of ["archive", "restore", "delete"]) {
    await test("BUG-007-" + action, "Failed " + action + " remains visible and preserves the note", async () => {
      await api("/api/notes/" + lifecycle.id, "PATCH", { isArchived: action === "restore" });
      await go("/note/" + lifecycle.id); const before = await record(lifecycle.id);
      await page.route("**/api/notes/" + lifecycle.id, route => route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"QA action unavailable. Please try again."}' }));
      try {
        await confirm(action === "archive" ? "Archive Note" : action === "restore" ? "Restore Note" : "Delete Note");
        const modal = page.getByRole("dialog"); await modal.getByRole("alert").waitFor();
        assert.match(await modal.innerText(), /QA action unavailable/); assert.deepEqual(await record(lifecycle.id), before);
        await modal.getByRole("button", { name: "Cancel", exact: true }).click();
      } finally { await page.unroute("**/api/notes/" + lifecycle.id); }
    });
  }
  await test("BUG-007-pending", "Slow archive prevents repeated requests and shows a pending state", async () => {
    await api("/api/notes/" + lifecycle.id, "PATCH", { isArchived: false }); await go("/note/" + lifecycle.id);
    let release, count = 0; const gate = new Promise(resolve => { release = resolve; });
    await page.route("**/api/notes/" + lifecycle.id, async route => { count++; await gate; await route.continue(); });
    try {
      await confirm("Archive Note"); const modal = page.getByRole("dialog");
      assert(await modal.getByRole("button", { name: "Please wait...", exact: true }).isDisabled());
      assert(await modal.getByRole("button", { name: "Cancel", exact: true }).isDisabled());
      assert(await button("Delete Note").isDisabled()); assert.equal(count, 1);
      release(); await poll(async () => (await record(lifecycle.id)).isArchived); await poll(async () => await modal.count() === 0);
    } finally { release(); await page.unroute("**/api/notes/" + lifecycle.id); }
  });
  await test("BUG-011-keyboard", "Dialog traps Tab/Shift+Tab; Escape cancels and restores focus", async () => {
    await go("/note/" + lifecycle.id); const opener = button("Delete Note"); await opener.click();
    const modal = page.getByRole("dialog");
    for (let i = 0; i < 8; i++) { await page.keyboard.press(i % 3 === 0 ? "Shift+Tab" : "Tab"); assert(await modal.evaluate(element => element.contains(document.activeElement))); }
    await page.keyboard.press("Escape"); assert.equal(await modal.count(), 0); assert(await opener.evaluate(element => element === document.activeElement));
    assert(await record(lifecycle.id));
  });
  for (const [field, value] of [["title", "t".repeat(201)], ["content", "c".repeat(100001)], ["content", "\u4e16".repeat(60000)]]) {
    await test("BUG-008-" + field + "-" + value.length, "Invalid " + field + " identifies the limit and disables Save", async () => {
      await go("/add"); await fill({ ...fixture, [field]: value }); assert(await button("Save Note").isDisabled());
      assert.match(await page.locator("body").innerText(), /characters|KiB/);
      const result = await api("/api/notes", "POST", { ...fixture, [field]: value }); assert([400, 413].includes(result.status));
    });
  }
  await test("BUG-008-tag", "Long tag input has visible actionable feedback", async () => {
    await go("/add"); await page.getByRole("combobox", { name: "Note tags" }).fill("t".repeat(51)); await page.getByRole("combobox", { name: "Note tags" }).press("Enter");
    await page.getByRole("alert").filter({ hasText: "50 characters" }).waitFor(); assert(await button("Save Note").isDisabled());
  });
  await test("BUG-013-tags", "Duplicate normalized tags do not consume slots; UI/API allow 30", async () => {
    await go("/add"); const combo = page.getByRole("combobox", { name: "Note tags" });
    for (const value of [" Same ", "Same", "Different"]) { await combo.fill(value); await combo.press("Enter"); }
    assert.equal(await page.getByRole("button", { name: "Remove Same", exact: true }).count(), 1);
    assert.equal(await page.getByRole("button", { name: "Remove Different", exact: true }).count(), 1);
    for (let i = 2; i < 30; i++) { await combo.fill("Tag" + i); await combo.press("Enter"); }
    await combo.fill("ThirtyOne"); await combo.press("Enter"); await page.getByRole("alert").filter({ hasText: "30 tags" }).waitFor();
    const many = await create({ title: "Thirty tags", tags: Array.from({ length: 30 }, (_, i) => "Tag" + i) }); assert.equal(many.tags.length, 30);
    assert.equal((await api("/api/notes", "POST", { ...fixture, tags: Array.from({ length: 31 }, (_, i) => "Tag" + i) })).status, 400);
  });
  for (const tag of ["Project Alpha", "\u4e16\u754c", "C#", "a/b", "setting", "allnotes", "100% ? & +"]) {
    await test("BUG-005-" + crypto.createHash("sha256").update(tag).digest("hex").slice(0, 6), "Exact filter for tag " + tag, async () => {
      const note = await create({ title: "Tagged " + tag, tags: [tag] }); await go("/tags");
      await page.getByRole("link", { name: tag, exact: true }).filter({ visible: true }).last().click();
      await page.waitForURL(url => url.pathname === "/tag" && url.searchParams.get("name") === tag);
      await page.getByRole("heading", { name: note.title, exact: true }).waitFor(); assert.deepEqual(await page.locator("h3").allTextContents(), [note.title]);
      await page.reload(); await page.getByRole("heading", { name: note.title, exact: true }).click();
      await page.waitForURL(url => url.pathname === "/note/" + note.id && url.searchParams.get("tag") === tag);
      assert.equal((await page.locator("article h1").innerText()), note.title);
    });
  }
  await test("BUG-009-retry", "A lost successful create response can be retried without duplicate notes", async () => {
    await go("/add"); await fill({ ...fixture, title: "Lost response retry" });
    const keys = [];
    await page.route("**/api/notes", async route => { keys.push(route.request().headers()["idempotency-key"]); await route.fetch(); await route.abort("connectionfailed"); }, { times: 1 });
    await button("Save Note").click(); await poll(async () => await button("Save Note").isEnabled());
    assert.equal((await list()).filter(note => note.title === "Lost response retry").length, 1);
    await page.route("**/api/notes", async route => { keys.push(route.request().headers()["idempotency-key"]); await route.continue(); }, { times: 1 });
    await button("Save Note").click(); await page.waitForURL("**/allnotes");
    assert.equal((await list()).filter(note => note.title === "Lost response retry").length, 1); assert.equal(keys[0], keys[1]);
  });

  await test("ERROR-response", "Malformed JSON and invalid successful response schemas keep the draft for retry", async () => {
    for (const response of ["not json", "{}"] ) {
      await go("/add"); await fill({ ...fixture, title: "Invalid response draft" });
      const before = (await list()).length;
      await page.route("**/api/notes", route => route.fulfill({ status: 200, contentType: "application/json", body: response }));
      try {
        await button("Save Note").click(); await page.getByText(/The server returned an invalid/).waitFor();
        assert(await button("Save Note").isEnabled()); assert.equal(new URL(page.url()).pathname, "/add");
        assert.equal(await page.getByRole("textbox", { name: "Note title", exact: true }).inputValue(), "Invalid response draft");
        assert.equal((await list()).length, before);
      } finally { await page.unroute("**/api/notes"); }
    }
  });
  await test("BUG-009-concurrent", "Identical retry keys are atomic and cannot change payload or resurrect deletion", async () => {
    const key = crypto.randomUUID(), headers = { "Idempotency-Key": key };
    const results = await Promise.all(Array.from({ length: 8 }, () => api("/api/notes", "POST", { ...fixture, title: "Concurrent retry" }, context, headers)));
    assert(results.every(result => result.status === 201)); assert.equal(new Set(results.map(result => result.body.id)).size, 1);
    assert.equal((await api("/api/notes", "POST", { ...fixture, title: "Different payload" }, context, headers)).status, 409);
    await api("/api/notes/" + results[0].body.id, "DELETE");
    assert.equal((await api("/api/notes", "POST", { ...fixture, title: "Concurrent retry" }, context, headers)).status, 409);
  });
  await test("BUG-010-navigation", "Late save completion respects newer Settings navigation", async () => {
    await go("/add"); await fill({ ...fixture, title: "Navigate during save" });
    let release, committed; const gate = new Promise(resolve => { release = resolve; }); const done = new Promise(resolve => { committed = resolve; });
    await page.route("**/api/notes", async route => { const response = await route.fetch(); committed(); await gate; await route.fulfill({ response }); });
    try {
      await button("Save Note").click(); await done;
      await page.locator("header").getByRole("link", { name: "Settings", exact: true }).click(); await page.waitForURL("**/setting/theme");
      release(); await delay(500); assert.equal(new URL(page.url()).pathname, "/setting/theme");
    } finally { release(); await page.unroute("**/api/notes"); }
  });
  await test("SAVE-pending", "Slow repeated create clicks remain a single save", async () => {
    await go("/add"); await fill({ ...fixture, title: "Repeated save" });
    let release, count = 0; const gate = new Promise(resolve => { release = resolve; });
    await page.route("**/api/notes", async route => { count++; await gate; await route.continue(); });
    try { await button("Save Note").dblclick(); assert(await button("Saving...").isDisabled()); release(); await page.waitForURL("**/allnotes"); assert.equal(count, 1); }
    finally { release(); await page.unroute("**/api/notes"); }
  });
  await test("BUG-003-isolation", "Reset abuse cannot block sign-in/signup, and spoofed headers do not bypass its limit", async () => {
    const attacker = await browser.newContext();
    try {
      const statuses = [];
      for (let i = 0; i < 120; i++) statuses.push((await api("/api/auth/verify-reset", "POST", { token: "invalid", username: "spoof" + i }, attacker, { "X-Forwarded-For": "192.0.2." + i, "X-Real-IP": "198.51.100." + i, "x-auth-client-ip": "203.0.113." + i, "x-auth-proxy-secret": "forged" })).status);
      assert(statuses.slice(0, 30).every(status => status === 401)); assert(statuses.slice(30).every(status => status === 429));
      assert.equal((await api("/api/auth/signin", "POST", account)).status, 200);
      const fresh = { ...account, username: "available_after_abuse", email: "available@example.test" };
      assert.equal((await api("/api/auth/signup", "POST", fresh, attacker)).status, 201);
      assert.equal((await api("/api/auth/signin", "POST", fresh, attacker)).status, 200);
    } finally { await attacker.close(); }
  });
  await test("BUG-003-bruteforce", "Account throttling survives new cookies and forged client addresses", async () => {
    for (let i = 0; i < 16; i++) {
      const fresh = await browser.newContext();
      try {
        const result = await api("/api/auth/signin", "POST", { username: "protected_account", password: "Wrong test password 123!" }, fresh, { "X-Forwarded-For": "192.0.2." + i });
        assert.equal(result.status, i < 15 ? 401 : 429);
      } finally { await fresh.close(); }
    }
    assert.equal((await api("/api/auth/signin", "POST", account)).status, 200);
  });
  await test("BUG-003-proxy", "Proxy mode authenticates a single IP header and rejects spoofing/malformed addresses", async () => {
    const proxyDatabase = path.join(directory, "proxy-db.json"), secret = crypto.randomBytes(32).toString("hex"), proxyOrigin = "http://localhost:" + (port + 1);
    await fs.writeFile(proxyDatabase, JSON.stringify({ notes: [] })); await start(proxyDatabase, port + 1, { AUTH_TRUSTED_PROXY_SECRET: secret });
    const client = await browser.newContext();
    const send = (action, data, headers = {}) => api("/api/auth/" + action, "POST", data, client, headers, proxyOrigin);
    try {
      assert.equal((await send("signup", account, { "x-auth-client-ip": "192.0.2.1" })).status, 403);
      assert.equal((await send("signup", account, { "x-auth-proxy-secret": secret, "x-auth-client-ip": "192.0.2.1, 192.0.2.2" })).status, 403);
      assert.equal((await send("signup", account, { "x-auth-proxy-secret": secret, "x-auth-client-ip": "fe80::1%eth0" })).status, 403);
      const headers = { "x-auth-proxy-secret": secret, "x-auth-client-ip": "2001:db8:0:0:0:0:0:1" };
      assert.equal((await send("signup", account, headers)).status, 201);
      for (let i = 0; i < 30; i++) assert.equal((await send("verify-reset", { token: "invalid" }, headers)).status, 401);
      assert.equal((await send("verify-reset", { token: "invalid" }, { ...headers, "x-auth-client-ip": "2001:db8::1", "X-Forwarded-For": "192.0.2.50" })).status, 429);
      assert.equal((await send("signin", account, headers)).status, 200);
      assert.equal((await send("signup", { ...account, username: "proxy_new", email: "proxynew@example.test" }, { ...headers, "x-auth-client-ip": "192.0.2.5" })).status, 201);
    } finally { await client.close(); }
  });
  await test("BUG-012-abandoned", "Old ownerless and confirmed-dead-owner locks recover automatically", async () => {
    const lock = database + ".lock";
    await fs.writeFile(lock, ""); await fs.utimes(lock, new Date(0), new Date(0));
    try { await create({ title: "Recovered legacy lock" }); } finally { await fs.unlink(lock).catch(() => {}); }
    const child = spawn(process.execPath, ["-e", "process.exit(0)"], { windowsHide: true, stdio: "ignore" });
    await new Promise(resolve => child.once("exit", resolve));
    await fs.writeFile(lock, JSON.stringify({ pid: child.pid, host: os.hostname(), token: crypto.randomUUID() }));
    try { await create({ title: "Recovered dead owner" }); } finally { await fs.unlink(lock).catch(() => {}); }
  });
  await test("BUG-012-live", "An old live-owner lock is preserved, times out safely, then writes recover", async () => {
    const lock = database + ".lock";
    for (const owner of [JSON.stringify({ pid: process.pid, host: os.hostname(), token: crypto.randomUUID() }), "{ corrupted owner metadata"]) {
      await fs.writeFile(lock, owner); await fs.utimes(lock, new Date(0), new Date(0));
      try { assert.equal((await api("/api/notes", "POST", { ...fixture, title: "Unverified lock must stay" })).status, 503); assert.equal(await fs.readFile(lock, "utf8"), owner); }
      finally { await fs.unlink(lock).catch(() => {}); }
    }
    await create({ title: "Writes recover after live lock releases" });
  });

  await test("BUG-012-multiprocess", "Two app processes safely reclaim one dead lock and retain every write", async () => {
    await start(database, port + 2);
    const child = spawn(process.execPath, ["-e", "process.exit(0)"], { windowsHide: true, stdio: "ignore" });
    await new Promise(resolve => child.once("exit", resolve));
    await fs.writeFile(database + ".lock", JSON.stringify({ pid: child.pid, host: os.hostname(), token: crypto.randomUUID() }));
    const results = await Promise.all(Array.from({ length: 20 }, (_, index) => api("/api/notes", "POST", { ...fixture, title: "Shared recovery " + index }, context, {}, index % 2 ? "http://localhost:" + (port + 2) : origin)));
    assert(results.every(result => result.status === 201), JSON.stringify(results.map(result => result.status)));
    assert.equal((await list()).filter(note => note.title.startsWith("Shared recovery ")).length, 20);
    assert.equal(new Set(results.map(result => result.body.id)).size, 20);
  });
  await test("DB-concurrent", "Ten distinct concurrent creates do not lose records", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, (_, index) => create({ title: "Parallel distinct " + index })));
    assert.equal(new Set(results.map(note => note.id)).size, 10); assert.equal((await list()).filter(note => note.title.startsWith("Parallel distinct ")).length, 10);
  });
  await test("BUG-014-navigation", "Parent navigation follows active and archived note state", async () => {
    await api("/api/notes/" + lifecycle.id, "PATCH", { isArchived: false }); await go("/note/" + lifecycle.id + "?from=archived");
    assert.equal(await page.getByRole("link", { name: "All Notes", exact: true }).first().getAttribute("aria-current"), "page");
    await api("/api/notes/" + lifecycle.id, "PATCH", { isArchived: true }); await go("/note/" + lifecycle.id);
    assert.equal(await page.getByRole("link", { name: "Archived Notes", exact: true }).first().getAttribute("aria-current"), "page");
  });
  await test("BUG-015-heading", "Archive heading describes the actual page", async () => { await go("/archived"); assert.equal(await page.locator("header h2").innerText(), "Archived Notes"); });
  await test("LIFECYCLE-delete", "Restored lifecycle note deletes by its ID and stays deleted after refresh", async () => {
    await api("/api/notes/" + lifecycle.id, "PATCH", { isArchived: false }); await go("/note/" + lifecycle.id); const before = await list();
    await confirm("Delete Note"); await page.waitForURL("**/allnotes"); await page.reload(); const after = await list();
    assert.equal(after.length, before.length - 1); assert.equal(await record(lifecycle.id), undefined);
    assert.deepEqual(after.map(note => note.id).sort(), before.filter(note => note.id !== lifecycle.id).map(note => note.id).sort());
  });
  const long = await create({ title: "Long".repeat(50), content: "WithoutSpaces".repeat(300), tags: ["LongTag".repeat(7)] });
  for (const theme of ["light", "dark"]) for (const width of [320, 375, 768, 1024, 1440]) {
    await test("LAYOUT-" + theme + "-" + width, "Responsive routes and editor without overflow", async () => {
      await page.setViewportSize({ width, height: 900 }); await go("/setting/theme");
      await page.locator("label").filter({ has: page.locator('input[name="theme"][value="' + theme + '"]') }).click();
      for (const route of ["/allnotes", "/archived", "/tags", "/tag?name=Project%20Alpha", "/search?q=Long", "/add", "/note/" + long.id, "/setting/theme", "/setting/font", "/setting/password"]) {
        await go(route); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route + " overflow at " + width);
      }
      await go("/note/" + long.id); await button("Edit Note").click(); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await button("Cancel").click();
      await button("Delete Note").click(); const bounds = await page.getByRole("dialog").boundingBox(); assert(bounds.x >= 0 && bounds.x + bounds.width <= width);
      await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
      if ([320, 768, 1440].includes(width)) await page.screenshot({ path: path.join(directory, theme + "-" + width + ".png"), fullPage: true });
    });
  }
  await test("FINAL-integrity", "Real database unchanged, no runtime exceptions, isolated data only", async () => {
    assert.deepEqual(await fs.readFile("db.json"), originalDatabase); assert.deepEqual(runtimeErrors, []);
    assert(!(await fs.readFile(database, "utf8")).includes(account.password));
  });
  console.log("QA RESULTS " + JSON.stringify({ total: cases.length, passed: cases.filter(test => test.result === "PASS").length, failed: cases.filter(test => test.result === "FAIL").length, evidence: directory }));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  for (const server of servers) {
    if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    else server.kill("SIGTERM");
  }
  if (directory) for (const filename of ["db.json", "proxy-db.json", "db.json.lock", "proxy-db.json.lock"]) await fs.unlink(path.join(directory, filename)).catch(() => {});
});
