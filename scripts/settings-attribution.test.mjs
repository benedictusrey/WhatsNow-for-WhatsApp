// WhatsNow Settings attribution regression — maintained by @benedictusrey.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const root = new URL("../", import.meta.url);
const version = (await readFile(new URL("VERSION", root), "utf8")).trim();
const html = await readFile(new URL("settings-ui/index.html", root), "utf8");
const host = await readFile(new URL("src-tauri/src/window.rs", root), "utf8");
const main = await readFile(new URL("settings-ui/main.js", root), "utf8");
const bootstrap = host.slice(host.indexOf("fn settings_version_bootstrap("))
  .match(/r#"([\s\S]*?)"#/)[1]
  .replace(/\{\{/g, "{").replace(/\}\}/g, "}")
  .replace("{version}", JSON.stringify(version));
const links = main.slice(main.indexOf("function wireExternalLinks()"), main.indexOf("async function load()"));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<link\b[^>]*>/gi, ""));
  await page.evaluate(() => {
    window.openedLinks = [];
    window.invoke = async (command, args) => window.openedLinks.push({ command, ...args });
    document.querySelector('[data-panel="about"]').hidden = false;
  });
  await page.evaluate(bootstrap);
  await page.evaluate(bootstrap); // Repeated version application must preserve anchors.
  assert.equal((await page.locator(".workspace-footer [data-version-ref]").innerText()).replace(/\s+/g, " "),
    `WhatsNow ${version} · Benedictus RH (@benedictusrey)`);
  assert.equal(await page.locator(".workspace-footer a").count(), 1,
    "version insertion must not erase the footer hyperlink");
  assert.equal(await page.locator(".about-copy").innerText().then(text => text.includes("Benedictus Reynaldo Hartanto")), false);
  await page.evaluate("(() => {\n" + links + "\nwireExternalLinks();\n})();");
  for (const selector of [".about-copy a", ".workspace-footer a"]) {
    assert.equal(await page.locator(selector).innerText(), "@benedictusrey");
    await page.locator(selector).click();
  }
  assert.deepEqual(await page.evaluate(() => window.openedLinks), [
    { command: "open_external_url", url: "https://github.com/benedictusrey" },
    { command: "open_external_url", url: "https://github.com/benedictusrey" },
  ]);
  console.log("Settings attribution: shortened names, live version, and both GitHub link commands PASS");
} finally {
  await browser.close();
}
