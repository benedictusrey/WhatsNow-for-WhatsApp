// WhatsNow Settings layout regression — maintained by @benedictusrey.
// No panel may ever be cropped or scroll sideways: every visible control must sit
// inside the panel stage at every window width the Settings window can have
// (the minimum is 560px, the default 760px), in several themes.
import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const panels = ["overview", "accounts", "focus", "appearance", "notifications", "preferences", "security", "about"];
const widths = [560, 640, 762, 900, 1100];
const themes = ["dark", "graphite", "aurora"];

const browser = await chromium.launch();
const failures = [];
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 780 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const settings = {
        theme: "system", close_to_tray: true, start_minimized: false, autostart: true,
        notifications: true, notification_previews: true, notification_preview_duration_secs: 2,
        chat_doodles: false, always_on_top: false, hotkey_enabled: true, hotkey: "Alt+W",
        focus_until_epoch_secs: 0,
      };
      window.__TAURI__ = {
        core: {
          invoke: (cmd) => {
            switch (cmd) {
              case "get_settings": return Promise.resolve({ ...settings });
              case "list_accounts":
                return Promise.resolve([
                  { id: "default", name: "", display_name: "Ben", unread: 14, open: true, notifications_enabled: true },
                  { id: "acct-1", name: "A very long account name that keeps on going and going", display_name: "A very long account name that keeps on going and going", unread: 120, open: true, notifications_enabled: false },
                ]);
              case "get_productivity_status":
                return Promise.resolve({ focus_active: true, focus_until_epoch_secs: 1, focus_remaining_secs: 3600 });
              case "get_lock_status":
                return Promise.resolve({ enabled: true, biometric_available: true, biometric_enabled: false, biometric_label: "Windows Hello", lock_on_launch: false, lock_on_hide: false, idle_secs: 0 });
              case "get_notification_status": return Promise.resolve("disabled_by_user");
              default: return Promise.resolve(null);
            }
          },
        },
        window: { getCurrentWindow: () => ({ close: () => Promise.resolve() }) },
      };
    });
    await page.goto("file://" + join(root, "settings-ui", "index.html"));
    await page.waitForLoadState("networkidle");
    await page.addStyleTag({ content: "* { transition: none !important; animation: none !important; }" });
    await page.waitForTimeout(200);

    for (const theme of themes) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      for (const panel of panels) {
        await page.click(`[data-panel-target="${panel}"]`);
        const problems = await page.evaluate(() => {
          const stage = document.querySelector(".panel-stage");
          const bounds = stage.getBoundingClientRect();
          const out = [];
          if (stage.scrollWidth > stage.clientWidth + 1) {
            out.push(`stage scrolls sideways (${stage.scrollWidth} > ${stage.clientWidth})`);
          }
          const active = document.querySelector(".settings-panel:not([hidden])");
          for (const el of active.querySelectorAll("*")) {
            if (el.closest("[hidden]") || el.classList.contains("sr-only") || el.closest(".sr-only")) continue;
            const style = getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden") continue;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;
            if (style.position === "absolute" && el.tagName === "INPUT") continue; // visually hidden radios
            if (rect.right > bounds.right + 0.5 || rect.left < bounds.left - 0.5) {
              const name = el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`;
              out.push(`${name} spans ${Math.round(rect.left)}..${Math.round(rect.right)} outside ${Math.round(bounds.left)}..${Math.round(bounds.right)}`);
            }
          }
          for (const el of active.querySelectorAll("button, .preset-button strong, .acct-name")) {
            if (el.closest("[hidden]")) continue;
            if (el.classList.contains("acct-name")) continue; // ellipsis is intended for names
            if (el.scrollWidth > el.clientWidth + 1) {
              out.push(`${el.textContent.trim().slice(0, 24)} is clipped inside its own box`);
            }
          }
          return out;
        });
        for (const problem of problems.slice(0, 4)) {
          failures.push(`${width}px / ${theme} / ${panel}: ${problem}`);
        }
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}
assert.deepEqual(failures, [], "\n" + failures.join("\n"));
console.log(`Settings layout: ${panels.length} panels x ${widths.length} widths x ${themes.length} themes have no cropped or sideways-scrolling content PASS`);
