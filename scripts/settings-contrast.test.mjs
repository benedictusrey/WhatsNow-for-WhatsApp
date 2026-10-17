// WhatsNow Settings contrast regression — maintained by @benedictusrey.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const html = await readFile(new URL("../settings-ui/index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../settings-ui/style.css", import.meta.url), "utf8");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<link\b[^>]*>/gi, ""));
  await page.addStyleTag({ content: css });
  await page.addStyleTag({ content: "* { transition: none !important; animation: none !important; }" });
  const failures = [];
  for (const theme of ["light", "dark", "midnight", "forest", "graphite", "ocean", "blush", "lavender", "candy", "aurora"]) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    const pairs = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const resolve = token => {
        const probe = document.createElement("span");
        probe.style.color = root.getPropertyValue(token);
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      };
      const entries = [];
      for (const surface of ["--bg", "--surface", "--surface-soft", "--surface-raised"])
        for (const text of ["--text", "--muted", "--accent"])
          entries.push([`${text} on ${surface}`, resolve(text), resolve(surface)]);
      entries.push(["navigation", resolve("--rail-muted"), resolve("--rail")]);
      const save = getComputedStyle(document.querySelector("#save"));
      entries.push(["Save changes", save.color, save.backgroundColor]);
      const icon = getComputedStyle(document.querySelector(".nav-item.active .nav-icon"));
      entries.push(["active navigation icon", icon.color, icon.backgroundColor]);
      return entries;
    });
    await page.locator("#save").hover();
    const hover = await page.locator("#save").evaluate(el => {
      const style = getComputedStyle(el);
      return ["Save changes hover", style.color, style.backgroundColor];
    });
    pairs.push(hover);
    await page.mouse.move(0, 0);
    for (const [label, foreground, background] of pairs) {
      const luminance = color => {
        const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(c => {
          c /= 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const a = luminance(foreground), b = luminance(background);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const minimum = label === "active navigation icon" ? 3 : 4.5;
      if (ratio < minimum) failures.push(`${theme}: ${label} = ${ratio.toFixed(2)}:1`);
    }
  }
  assert.deepEqual(failures, [], failures.join("\n"));
  console.log("Settings contrast: all 10 resolved palettes PASS (normal text >=4.5:1)");
} finally {
  await browser.close();
}
