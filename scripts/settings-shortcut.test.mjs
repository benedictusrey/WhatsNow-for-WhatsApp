// WhatsNow settings shortcut regression (Playwright), maintained by @benedictusrey.
// A fixture that mirrors the structure of WhatsApp's chat-list header (verified
// live): header[data-testid=chatlist-header] > ... > a flex row holding the
// menu button (aria-haspopup=menu) and the new-chat button.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const script = await readFile(new URL("../src-tauri/resources/settings-shortcut.js", import.meta.url), "utf8");

const header = (label = "Menu") => `
  <header data-testid="chatlist-header" style="display:flex;width:575px;height:64px">
    <div style="display:flex;align-items:center;width:535px;height:40px;margin:12px 20px">
      <div style="flex:1">Title</div>
      <span><div><div style="display:flex;gap:8px;align-items:center">
        <div style="margin-left:8px"><span><button id="menu" aria-label="${label}" aria-haspopup="menu" style="width:40px;height:40px">m</button></span></div>
        <div><span><div><button id="newchat" aria-label="New chat" style="width:40px;height:40px">+</button></div></span></div>
      </div></div></span>
    </div>
  </header>`;
const page_html = (body) => `<!doctype html><html><body><div id="app">${body}</div></body></html>`;

const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route("https://web.whatsapp.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: page_html(header()) }));
  await page.addInitScript(() => {
    window.__invocations = [];
    window.__TAURI__ = { core: { invoke: (command, args) => {
      window.__invocations.push([command, args === undefined ? null : args]);
      return Promise.resolve();
    } } };
  });
  await page.goto("https://web.whatsapp.com/");
  await page.evaluate(script);
  const count = () => page.locator("[data-whatsnow-settings-shortcut]").count();

  // One button, directly before the menu's wrapper, same size, vertically centred.
  assert.equal(await count(), 1, "injects exactly one button");
  const geometry = await page.evaluate(() => {
    const r = (e) => e.getBoundingClientRect();
    const ours = r(document.querySelector("[data-whatsnow-settings-shortcut] button"));
    const menu = r(document.getElementById("menu"));
    const newChat = r(document.getElementById("newchat"));
    return { ours, menu, newChat };
  });
  assert.ok(geometry.ours.right <= geometry.menu.left, "the button sits left of the menu");
  assert.equal(geometry.ours.width, 40);
  assert.equal(geometry.ours.height, 40);
  assert.equal(Math.round(geometry.ours.top), Math.round(geometry.menu.top), "vertically aligned with the menu");
  assert.equal(
    Math.round(geometry.menu.left - geometry.ours.right),
    Math.round(geometry.newChat.left - geometry.menu.right),
    "same gap as between the neighbouring buttons",
  );
  assert.equal(await page.getByRole("button", { name: "WhatsNow settings" }).count(), 1, "accessible name");
  assert.equal(await page.locator("[data-whatsnow-settings-shortcut] svg").count(), 1, "carries the WhatsNow mark");

  // Opens Settings through the one argument-less command, by mouse and keyboard.
  await page.getByRole("button", { name: "WhatsNow settings" }).click();
  await page.getByRole("button", { name: "WhatsNow settings" }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  const calls = await page.evaluate(() => window.__invocations);
  assert.equal(calls.length, 3, "click, Enter and Space each activate it");
  for (const [command, args] of calls) {
    assert.equal(command, "open_whatsnow_settings");
    assert.equal(args, null, "no page-controlled arguments");
  }

  // Idempotent and resilient to WhatsApp re-rendering its header.
  await page.evaluate(() => window.__whatsnowSettingsShortcut.ensure());
  await page.evaluate(() => window.__whatsnowSettingsShortcut.ensure());
  assert.equal(await count(), 1, "ensure() never duplicates");
  await page.evaluate((html) => { document.getElementById("app").innerHTML = html; }, header());
  await page.waitForFunction(() => document.querySelectorAll("[data-whatsnow-settings-shortcut]").length === 1, null, { timeout: 3000 });
  assert.equal(await count(), 1, "re-added after a re-render, still one");

  // Works in another UI language: the menu is found by aria-haspopup, not its label.
  await page.evaluate((html) => { document.getElementById("app").innerHTML = html; }, header("Menü"));
  await page.waitForFunction(() => document.querySelectorAll("[data-whatsnow-settings-shortcut]").length === 1, null, { timeout: 3000 });

  // Header not found (WhatsApp changed its markup): nothing is added, nothing breaks.
  await page.evaluate(() => { document.getElementById("app").innerHTML = "<header data-testid='other'>x</header>"; });
  await page.waitForTimeout(500);
  assert.equal(await count(), 0, "no header, no button");

  // The rail's own header (no menu button) is never used.
  await page.evaluate(() => {
    document.getElementById("app").innerHTML =
      "<header data-testid='chatlist-header'><div style='display:flex'><button>a</button><button>b</button></div></header>";
  });
  await page.waitForTimeout(500);
  assert.equal(await count(), 0, "a header without a menu button is left alone");

  // Only the real WhatsApp origin: any other origin never gets the button.
  const other = await context.newPage();
  await other.route("https://example.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: page_html(header()) }));
  await other.goto("https://example.com/");
  await other.evaluate(script);
  assert.equal(await other.locator("[data-whatsnow-settings-shortcut]").count(), 0, "other origins are ignored");
} finally {
  await browser.close();
}
console.log("Settings shortcut regressions passed.");
