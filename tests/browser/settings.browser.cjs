const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn, spawnSync } = require("node:child_process");
const { chromium } = require(process.env.THEME_PLAYWRIGHT_PATH || "playwright");

// Isolated accounts and a local SMTP inbox: no real data or email is used.
(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "note-settings-test-"));
  const database = path.join(directory, "db.json");
  await fs.writeFile(database, JSON.stringify({ notes: [] }));
  const messages = [];
  const sockets = new Set();
  const smtp = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.write("220 localhost test mail server\r\n");
    let buffer = "", message = "", collecting = false;
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
            socket.write("250 Accepted\r\n");
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
  await new Promise(resolve => smtp.listen(0, "127.0.0.1", resolve));
  const port = Number(process.env.SETTINGS_TEST_PORT || 3069);
  const origin = "http://localhost:" + port;
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "-p", String(port)], {
    env: {
      ...process.env, DATABASE_FILE: database, APP_URL: origin,
      AUTH_TEST_BUILD: "1", NEXT_TELEMETRY_DISABLED: "1", AUTH_TRUSTED_PROXY_SECRET: "",
      SMTP_HOST: "127.0.0.1", SMTP_PORT: String(smtp.address().port),
      SMTP_FROM: "Note App <settings@example.test>", SMTP_USER: "", SMTP_PASSWORD: "",
    },
    stdio: "ignore", windowsHide: true,
  });
  let browser;
  try {
    let ready = false;
    for (let n = 0; n < 90; n++) {
      try { if ((await fetch(origin + "/auth/signin")).ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert(ready, "Test server started");
    browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    let expectedServiceError = false;
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() !== "error") return;
      if (expectedServiceError && message.text().includes("503") && message.location().url.includes("/api/auth/forgot-password")) return;
      errors.push(message.text());
    });
    const account = { username: "settings_tester", email: "settings@example.test", password: "Settings testing password 123!", confirmPassword: "Settings testing password 123!" };
    const post = (route, data) => context.request.post(origin + route, { data, headers: { Origin: origin } });
    // Use the real account forms so their shared client workflow is covered.
    await page.goto(origin + "/auth/signup");
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
    await page.getByText("Username is required.", { exact: true }).waitFor();
    await page.getByLabel("Username", { exact: true }).fill(account.username);
    await page.getByLabel("Email address", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByLabel("Confirm Password", { exact: true }).fill(account.confirmPassword);
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
    await page.waitForURL("**/auth/signin");
    await page.getByLabel("Username", { exact: true }).fill(account.username);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await page.waitForURL("**/allnotes");
    console.log("PASS Signup validation, account creation, and sign-in through the browser forms.");
    assert.equal((await post("/api/notes", { title: "Settings regression note", content: "Notes must return after leaving Settings.", tags: ["SettingsTest"] })).status(), 201);
    const menu = page.getByRole("navigation", { name: "Settings menu" });
    const content = page.getByRole("region", { name: "Settings content" });
    const routes = [
      ["/setting/theme", "Theme"],
      ["/setting/password", "Change Password"],
      ["/setting/font", "Font"],
    ];
    async function go(route) {
      assert.equal((await page.goto(origin + route)).status(), 200, route);
    }
    async function active(label) {
      // History updates the address before React commits the active-menu state.
      await menu.locator('a[aria-current="page"]').filter({ hasText: new RegExp("^" + label + "$") }).waitFor();
      assert.equal(await menu.locator('[aria-current="page"]').count(), 1);
      assert.equal(await menu.getByRole("link", { name: label, exact: true }).getAttribute("aria-current"), "page");
    }
    async function choose(group, value) {
      await page.locator("label").filter({ has: page.locator('input[name="' + group + '"][value="' + value + '"]') }).click();
      await page.waitForFunction(({ group, value }) => document.documentElement.dataset[group] === value, { group, value });
    }
    async function fits(route, width) {
      const dimensions = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert(dimensions.content <= dimensions.viewport, route + " overflows at " + width);
    }

    await go("/allnotes");
    await page.getByRole("heading", { name: "Settings regression note" }).waitFor();
    const notesBounds = await page.getByRole("link", { name: "Create New Note" }).locator("..").locator("..").boundingBox();
    await page.locator("header").getByRole("link", { name: "Settings", exact: true }).click();
    await page.waitForURL("**/setting/theme");
    await active("Theme");
    const settingsBounds = await menu.locator("..").boundingBox();
    assert.equal(Math.round(settingsBounds.x), Math.round(notesBounds.x));
    assert.equal(Math.round(settingsBounds.width), 250);
    assert.equal(await page.getByRole("link", { name: "Create New Note" }).count(), 0);
    assert.equal(await page.getByRole("heading", { name: "Settings regression note" }).count(), 0);
    const menuElement = await menu.elementHandle();
    await menu.getByRole("link", { name: "Change Password", exact: true }).click();
    await page.waitForURL("**/setting/password");
    await active("Change Password");
    await page.getByRole("heading", { name: "Change Password", exact: true }).waitFor();
    await menu.getByRole("link", { name: "Font", exact: true }).click();
    await page.waitForURL("**/setting/font");
    await active("Font");
    assert(await menuElement.evaluate(element => element.isConnected), "Shared settings menu remains mounted");
    await page.goBack();
    await active("Change Password");
    await page.goBack();
    await active("Theme");
    await page.goForward();
    await active("Change Password");
    await page.goForward();
    await active("Font");
    console.log("PASS Desktop column replacement, persistent sidebar, active routes, back/forward.");

    for (const font of ["geist", "geist-mono", "system"]) {
      await choose("font", font);
      await page.evaluate(() => document.fonts.ready);
      const family = await page.locator("body").evaluate(element => getComputedStyle(element).fontFamily);
      assert(font === "system" ? family.includes("Arial") : family.toLowerCase().includes("geist"));
      await page.reload();
      assert.equal(await page.locator("html").getAttribute("data-font"), font);
      assert(await page.locator('input[name="font"][value="' + font + '"]').isChecked());
      const cookie = (await context.cookies()).find(item => item.name === "note-app-font");
      assert.equal(cookie.value, font);
      assert(cookie.expires > Date.now() / 1000 + 300 * 24 * 3600);
      await page.getByRole("link", { name: "Back to notes" }).click();
      await page.waitForURL("**/allnotes");
      assert.equal(await page.locator("body").evaluate(element => getComputedStyle(element).fontFamily), family);
      await page.getByRole("heading", { name: "Settings regression note" }).waitFor();
      assert.equal(await menu.count(), 0);
      await go("/setting/font");
    }
    await page.locator('input[name="font"][value="system"]').focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.documentElement.dataset.font === "geist");
    const fontCard = page.locator("label").filter({ has: page.locator('input[value="geist"]') }).locator(":scope > span");
    assert.equal(await fontCard.evaluate(element => getComputedStyle(element).outlineStyle), "solid");
    console.log("PASS Every font applies globally, persists after refresh, restores notes, and works by keyboard.");

    for (const theme of ["dark", "light"]) {
      await go("/setting/theme");
      await choose("theme", theme);
      await page.reload();
      assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
      assert(await page.locator('input[name="theme"][value="' + theme + '"]').isChecked());
      const cookie = (await context.cookies()).find(item => item.name === "note-app-theme");
      assert.equal(cookie.value, theme);
      for (const width of [320, 375, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const [route, label] of routes) {
          await go(route);
          await active(label);
          await fits(route, width);
          const menuBounds = await menu.locator("..").boundingBox();
          const contentBounds = await content.boundingBox();
          if (width >= 1024) assert(contentBounds.x >= menuBounds.x + menuBounds.width);
          else assert(contentBounds.y >= menuBounds.y + menuBounds.height);
          const current = menu.getByRole("link", { name: label, exact: true });
          assert((await current.boundingBox()).height >= 44);
          assert.match(await current.getAttribute("class"), /bg-primary-light text-link/);
          assert.equal(await page.locator("html").getAttribute("data-font"), "geist");
          assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
          if ([375, 768, 1440].includes(width)) {
            await page.screenshot({ path: path.join(directory, theme + "-" + width + "-" + route.split("/").at(-1) + ".png"), fullPage: true });
          }
        }
      }
    }
    // The widest available font must also fit the narrowest supported screen.
    await page.setViewportSize({ width: 320, height: 800 });
    await choose("font", "geist-mono");
    for (const [route] of routes) { await go(route); await fits(route, 320); }
    await go("/allnotes");
    await fits("/allnotes", 320);
    console.log("PASS Direct settings URLs, Light/Dark active states, and mobile/tablet/desktop layouts without overflow.");

    await go("/settings");
    await page.waitForURL("**/setting/theme");
    await choose("theme", "dark");
    const savedState = await context.storageState();
    const reopened = await browser.newContext({ storageState: savedState, javaScriptEnabled: false });
    const staticPage = await reopened.newPage();
    await staticPage.goto(origin + "/setting/font");
    assert.equal(await staticPage.locator("html").getAttribute("data-theme"), "dark");
    assert.equal(await staticPage.locator("html").getAttribute("data-font"), "geist-mono");
    assert.match(await staticPage.locator("body").evaluate(element => getComputedStyle(element).fontFamily), /Geist.*Mono/i);
    await reopened.close();
    console.log("PASS Legacy URL redirect and both preferences rendered before JavaScript runs.");

    await page.setViewportSize({ width: 1440, height: 900 });
    await go("/setting/password");
    assert.equal(await page.getByLabel("Username", { exact: true }).inputValue(), account.username);
    assert(await page.getByLabel("Username", { exact: true }).evaluate(element => element.readOnly));
    assert.equal(await page.getByRole("navigation", { name: "Account navigation" }).count(), 0);

    expectedServiceError = true;
    await page.route("**/api/auth/forgot-password", route => route.fulfill({
      status: 503, contentType: "application/json",
      body: JSON.stringify({ message: "Password recovery is unavailable. Please contact the app owner." }),
    }));
    await page.getByRole("button", { name: "Send Reset Link", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Password recovery is unavailable" }).waitFor();
    assert(await page.getByRole("button", { name: "Send Reset Link", exact: true }).isEnabled());
    await page.unroute("**/api/auth/forgot-password");
    expectedServiceError = false;

    let releaseRequest;
    const gate = new Promise(resolve => { releaseRequest = resolve; });
    await page.route("**/api/auth/forgot-password", async route => { await gate; await route.continue(); });
    await page.getByRole("button", { name: "Send Reset Link", exact: true }).click();
    const loading = page.getByRole("button", { name: "Please wait...", exact: true });
    await loading.waitFor();
    assert(await loading.isDisabled());
    assert.equal(await page.locator("form").getAttribute("aria-busy"), "true");
    releaseRequest();
    await page.locator("form").getByRole("status").waitFor();
    assert.equal(messages.length, 1, "One reset email received in local inbox");
    await page.unroute("**/api/auth/forgot-password");
    assert(await page.getByRole("button", { name: "Send Reset Link", exact: true }).isEnabled());
    console.log("PASS Reused password form, account prefill, service errors, success, loading and disabled submission.");

    const token = messages[0].match(/#token=([a-f0-9]{64})/)?.[1];
    assert(token, "Reset link delivered");
    await go("/auth/reset-password#token=" + token);
    await page.getByLabel("New Password", { exact: true }).waitFor();
    assert(!page.url().includes("#"), "Reset token removed from address bar");
    const newPassword = "Changed settings password 456!";
    await page.getByLabel("New Password", { exact: true }).fill("short");
    await page.getByLabel("Confirm New Password", { exact: true }).fill("short");
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    await page.getByText("Use at least 12 characters.", { exact: true }).waitFor();
    await page.getByLabel("New Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    await page.getByText("Passwords must match.", { exact: true }).waitFor();
    await page.getByLabel("Confirm New Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    await page.waitForURL("**/auth/signin");
    assert.equal((await post("/api/auth/signin", account)).status(), 401);
    assert.equal((await post("/api/auth/signin", { ...account, password: newPassword })).status(), 200);
    await go("/allnotes");
    await page.getByRole("button", { name: "Log out", exact: true }).first().click();
    await page.waitForURL("**/auth/signin");
    assert.equal((await context.request.get(origin + "/api/notes")).status(), 401);
    await page.getByLabel("Username", { exact: true }).fill(account.username);
    await page.getByLabel("Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await page.waitForURL("**/allnotes");
    console.log("PASS Browser logout invalidates the session; the new password signs in through the form.");
    await go("/setting/password");
    await page.getByRole("heading", { name: "Change Password", exact: true }).waitFor();
    const anonymous = await browser.newContext();
    const guestPage = await anonymous.newPage();
    for (const [route] of routes) {
      await guestPage.goto(origin + route);
      await guestPage.waitForURL("**/auth/signin");
    }
    await anonymous.close();
    assert.deepEqual(errors, [], "No hydration, runtime, or unexpected console errors");
    console.log("PASS Actual email reset, password length/matching validation, new sign-in, protected settings and clean console.");
    console.log("Screenshots: " + directory);
  } finally {
    await browser?.close();
    if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    else server.kill();
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => smtp.close(resolve));
    await fs.unlink(database).catch(() => {});
    await fs.unlink(database + ".lock").catch(() => {});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
