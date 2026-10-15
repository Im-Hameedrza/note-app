const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { chromium } = require(process.env.THEME_PLAYWRIGHT_PATH || "playwright");

// Run after npm run build. Uses an isolated database; never touches real accounts.
(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "note-theme-test-"));
  const database = path.join(directory, "db.json");
  await fs.writeFile(database, JSON.stringify({ notes: [] }));
  const origin = "http://localhost:3068";
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3068"], {
    env: { ...process.env, DATABASE_FILE: database, APP_URL: origin, AUTH_TRUSTED_PROXY_SECRET: "" },
    stdio: "ignore", windowsHide: true,
  });
  let browser;
  try {
    for (let n = 0; n < 60; n++) {
      try { if ((await fetch(origin + "/auth/signin")).ok) break; } catch {}
      await new Promise(r => setTimeout(r, 500));
    }
    browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error" && !m.text().includes("status of 400") && !m.text().includes("status of 401")) errors.push(m.text()); });
    const account = { username: "theme_tester", email: "theme@example.test", password: "Theme testing password 123!", confirmPassword: "Theme testing password 123!" };
    const post = (route, data) => context.request.post(origin + route, { data, headers: { Origin: origin } });
    assert.equal((await post("/api/auth/signup", account)).status(), 201);
    assert.equal((await post("/api/auth/signin", account)).status(), 200);
    const note = { title: "Theme review note", content: "A note for checking readable text and wrapping.\n" + "LongContent".repeat(30), tags: ["Theme"], isArchived: false };
    const created = await post("/api/notes", note);
    assert.equal(created.status(), 201);
    const notes = await (await context.request.get(origin + "/api/notes")).json();
    const noteId = notes.find(n => n.title === note.title).id;
    const archived = await post("/api/notes", { ...note, title: "Archived theme note", isArchived: true });
    assert.equal(archived.status(), 201);
    const archivedId = (await archived.json()).id;
    assert.equal((await context.request.patch(origin + "/api/notes/" + archivedId, { data: { isArchived: true }, headers: { Origin: origin } })).status(), 200);

    async function go(route) {
      const response = await page.goto(origin + route);
      assert.equal(response.status(), 200, route);
      await page.locator("body").waitFor();
    }
    async function themeIs(theme) {
      await page.waitForFunction(t => document.documentElement.dataset.theme === t, theme);
      assert.equal(await page.locator("body").evaluate(el => getComputedStyle(el).backgroundColor), theme === "dark" ? "rgb(14, 18, 27)" : "rgb(255, 255, 255)");
    }
    async function noOverflow(route, width) {
      const size = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert(size.content <= size.viewport, route + " overflows at " + width + ": " + JSON.stringify(size));
    }
    await go("/setting");
    for (const theme of ["dark", "light", "dark"]) {
      await page.locator("label").filter({ has: page.getByRole("radio", { name: theme === "dark" ? /Dark/ : /Light/ }) }).click();
      await themeIs(theme);
      const cookie = (await context.cookies()).find(c => c.name === "note-app-theme");
      assert.equal(cookie.value, theme);
      assert(cookie.expires > Date.now()/1000 + 300*24*3600);
      await page.reload();
      await themeIs(theme);
      assert(await page.getByRole("radio", { name: theme === "dark" ? /Dark/ : /Light/ }).isChecked());
      // Raw HTML proves the saved theme is present before any JS or hydration.
      const html = await (await context.request.get(origin + "/setting")).text();
      assert(html.includes('data-theme="' + theme + '"'));
    }
    console.log("PASS Light/Dark switching, both refresh paths, cookie lifetime, server first-paint theme.");

    await page.getByRole("radio", { name: /Dark/ }).focus();
    await page.keyboard.press("ArrowLeft");
    await themeIs("light");
    const focusedCard = page.locator("label").filter({ has: page.getByRole("radio", { name: /Light/ }) }).locator(":scope > span");
    assert.equal(await focusedCard.evaluate(el => getComputedStyle(el).outlineStyle), "solid");
    await page.keyboard.press("ArrowRight");
    await themeIs("dark");
    console.log("PASS Keyboard theme selection and visible focus.");

    const widths = [320, 768, 1024, 1440];
    const routes = ["/setting", "/allnotes", "/archived", "/search?q=Theme", "/tags", "/Theme", "/add", "/note/" + noteId, "/auth/signin", "/auth/signup", "/auth/forgot-password", "/auth/reset-password"];
    for (const theme of ["light", "dark"]) {
      await go("/setting");
      await page.locator("label").filter({ has: page.getByRole("radio", { name: theme === "dark" ? /Dark/ : /Light/ }) }).click();
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        for (const route of routes) {
          await go(route);
          await themeIs(theme);
          await noOverflow(route, width);
          if ([320, 1440].includes(width) && ["/allnotes", "/add", "/note/" + noteId, "/auth/signin"].includes(route)) {
            await page.screenshot({ path: path.join(directory, theme + "-" + width + "-" + route.split("/")[1] + ".png"), fullPage: true });
          }
        }
        await go("/setting");
        await page.screenshot({ path: path.join(directory, theme + "-" + width + ".png"), fullPage: true });
      }
    }
    console.log("PASS Both themes across 12 routes at 320/768/1024/1440px without horizontal overflow.");

    await page.setViewportSize({ width: 320, height: 800 });
    await go("/add");
    assert(await page.getByRole("button", { name: "Save Note" }).first().isDisabled());
    await page.getByRole("textbox", { name: "Note title" }).fill("UI theme note");
    await page.getByRole("textbox", { name: "Note content" }).fill("Testing a themed editor and success notification.");
    await page.getByRole("combobox", { name: "Note tags" }).fill("Theme");
    await page.getByRole("combobox", { name: "Note tags" }).press("Enter");
    await page.getByRole("button", { name: "Save Note" }).first().click();
    await page.waitForURL("**/allnotes");
    await page.getByText("Note created successfully").waitFor();
    await noOverflow("/allnotes with success toast", 320);
    await go("/note/" + noteId);
    await page.getByRole("button", { name: "Delete Note", exact: true }).click();
    await page.getByRole("dialog", { name: "Delete Note" }).waitFor();
    await noOverflow("delete dialog", 320);
    await page.screenshot({ path: path.join(directory, "dark-dialog-mobile.png"), fullPage: true });
    await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(await page.getByRole("dialog").count(), 0);
    // Exercise the client mutation workflow through its real confirmation UI.
    await go("/note/" + noteId + "?from=allnotes");
    await page.getByRole("button", { name: "Archive Note", exact: true }).click();
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith("/api/notes/" + noteId) && response.request().method() === "PATCH" && response.status() === 200),
      page.getByRole("dialog", { name: "Archive Note" }).getByRole("button", { name: "Archive Note", exact: true }).click(),
    ]);
    assert.equal((await (await context.request.get(origin + "/api/notes")).json()).find(note => note.id === noteId).isArchived, true);

    await go("/note/" + noteId + "?from=archived");
    await page.getByRole("button", { name: "Restore Note", exact: true }).click();
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith("/api/notes/" + noteId) && response.request().method() === "PATCH" && response.status() === 200),
      page.getByRole("dialog", { name: "Restore Note" }).getByRole("button", { name: "Restore Note", exact: true }).click(),
    ]);
    assert.equal((await (await context.request.get(origin + "/api/notes")).json()).find(note => note.id === noteId).isArchived, false);

    await page.getByRole("button", { name: "Delete Note", exact: true }).click();
    await page.getByRole("dialog", { name: "Delete Note" }).getByRole("button", { name: "Delete Note", exact: true }).click();
    await page.waitForURL("**/allnotes");
    assert.equal((await (await context.request.get(origin + "/api/notes")).json()).some(note => note.id === noteId), false);
    console.log("PASS Archive, restore, and delete through confirmation dialogs persist and refresh correctly.");

    await go("/auth/signup");
    const submit = page.getByRole("button", { name: "Create Account", exact: true });
    await submit.hover();
    assert.equal(await submit.evaluate(el => getComputedStyle(el).backgroundColor), "rgb(37, 71, 208)");
    await submit.click();
    await page.locator('[aria-invalid="true"]').first().waitFor();
    await noOverflow("form errors", 320);
    console.log("PASS Tag input, disabled Save, note creation, success toast, modal, and form errors.");

    await go("/settings");
    await page.waitForURL("**/setting/theme");
    const savedState = await context.storageState();
    const reopened = await browser.newContext({ storageState: savedState, javaScriptEnabled: false });
    const reopenedPage = await reopened.newPage();
    await reopenedPage.goto(origin + "/setting");
    assert.equal(await reopenedPage.locator("html").getAttribute("data-theme"), "dark");
    assert.equal(await reopenedPage.locator("body").evaluate(el => getComputedStyle(el).backgroundColor), "rgb(14, 18, 27)");
    await reopened.close();
    assert.deepEqual(errors, [], "Browser errors / hydration warnings");
    console.log("PASS Legacy settings redirect, reopened preference with JS disabled, and clean browser console.");
    console.log("Screenshots: " + directory);
  } finally {
    await browser?.close();
    if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    else server.kill();
    await fs.unlink(database).catch(() => {});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

