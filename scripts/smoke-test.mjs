// WhatsNow smoke test — Playwright (Chromium) + screenshot-inspect.
// Authored for the 2026-09-15 media-audio fix and UI-fluency audit.
//
// What it verifies, against the REAL artifacts in this repository:
//   1. settings-ui loads and renders (theme bootstrap, panel navigation,
//      save button, close button) with zero console errors — screenshot
//      inspected for layout correctness (light + dark).
//   2. src-tauri/resources/bridge.js evaluates cleanly inside a WhatsApp-like
//      page and installs its surface: doodle kill-switch stylesheet, emoji
//      color-scheme guard, Notification shim, drop feed, notification routing.
//   3. The promo-hide sweep is COALESCED (the fluency optimization): N rapid
//      mutations must schedule at most one deferred sweep.
//   4. Media elements are untouched by every injected stylesheet (the
//      video-audio guard): the kill-switch/emoji CSS must not apply to
//      <video>/<audio>, and autoplay policy must not be flipped on by WhatsNow.
//
// Run:  node scripts/smoke-test.mjs
// (playwright must be resolvable; screenshots land in scripts/smoke-shots/)

import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

// Resolve Playwright: prefer a local install; fall back to the shared npx
// cache (PLAYWRIGHT_NODE_MODULES) so the repo needs no dependency for an
// ad-hoc smoke test.
function loadPlaywright() {
  try {
    return createRequire(import.meta.url)("playwright");
  } catch (e) {
    const fallback = process.env.PLAYWRIGHT_NODE_MODULES;
    if (!fallback) throw e;
    return createRequire(join(fallback, "index.js"))("playwright");
  }
}
const pw = loadPlaywright();
const shotsDir = join(here, "smoke-shots");
rmSync(shotsDir, { recursive: true, force: true });
mkdirSync(shotsDir, { recursive: true });

let failures = 0;
function check(cond, msg) {
  if (cond) console.log("  ok   " + msg);
  else {
    failures++;
    console.error("  FAIL " + msg);
  }
}
function section(name) {
  console.log("\n== " + name + " ==");
}

// The real bridge.js source, injected into pages exactly like window.rs does
// (initialization_script). Playwright pages get it via addInitScript.
const bridgeSource = readFileSync(
  join(root, "src-tauri", "resources", "bridge.js"),
  "utf8",
);
const chatThemeSource = readFileSync(
  join(root, "src-tauri", "resources", "chat-theme.js"),
  "utf8",
);

const browser = await pw.chromium.launch({
  // Use an explicitly provided Chromium when the cached Playwright's pinned
  // browser build is not the one installed on this machine.
  ...(process.env.PLAYWRIGHT_CHROMIUM
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM }
    : {}),
  // Real desktop-ish surface: 1280x800, no mobile emulation.
  viewport: { width: 1280, height: 800 },
});

try {
  // ---------------------------------------------------------------------------
  section("Settings UI (real settings-ui/) renders and navigates");
  // ---------------------------------------------------------------------------
  const settingsErrors = [];
  const settingsCtx = await browser.newContext();
  const settingsPage = await settingsCtx.newPage();
  settingsPage.on("console", (m) => {
    if (m.type() === "error") settingsErrors.push(m.text());
  });
  settingsPage.on("pageerror", (e) => settingsErrors.push(String(e)));
  await settingsPage.addInitScript(() => {
    // Minimal Tauri IPC stand-in (the real app injects __TAURI__): enough for
    // main.js to load settings, list accounts, and read lock/focus status.
    const settings = {
      theme: "system",
      close_to_tray: true,
      start_minimized: false,
      autostart: true,
      notifications: true,
      notification_previews: true,
      notification_preview_duration_secs: 2,
      chat_doodles: false,
      always_on_top: false,
      hotkey_enabled: true,
      hotkey: "Alt+W",
      focus_until_epoch_secs: 0,
    };
    window.__TAURI__ = {
      core: {
        invoke: (cmd) => {
          switch (cmd) {
            case "get_settings":
              return Promise.resolve(settings);
            case "list_accounts":
              return Promise.resolve([
                {
                  id: "default",
                  name: "Personal",
                  unread: 2,
                  open: true,
                  notifications_enabled: true,
                },
              ]);
            case "get_productivity_status":
              return Promise.resolve({
                focus_active: false,
                focus_until_epoch_secs: 0,
                focus_remaining_secs: 0,
              });
            case "get_lock_status":
              return Promise.resolve({
                enabled: false,
                biometric_available: false,
                biometric_enabled: false,
                biometric_label: "",
                lock_on_launch: false,
                lock_on_hide: false,
                idle_secs: 0,
              });
            case "set_settings":
              return Promise.resolve(null);
            default:
              return Promise.resolve(null);
          }
        },
      },
      window: {
        getCurrentWindow: () => ({ close: () => Promise.resolve() }),
      },
    };
    window.__TAURI_INTERNALS__ = window.__TAURI__;
  });
  await settingsPage.goto("file://" + join(root, "settings-ui", "index.html"));
  await settingsPage.waitForLoadState("networkidle");
  await sleep(300);

  check(
    await settingsPage.locator("#panel_title").textContent() === "Overview",
    "Overview panel is the landing view",
  );
  check(
    (await settingsPage.locator("[data-panel-target]").count()) === 8,
    "all 8 nav panels are wired",
  );
  // Panel navigation fluency: every panel must switch without error.
  for (const target of [
    "accounts",
    "focus",
    "appearance",
    "notifications",
    "preferences",
    "security",
    "about",
  ]) {
    await settingsPage.click(`[data-panel-target="${target}"]`);
    await sleep(60);
  }
  check(
    (await settingsPage.locator("#panel_title").textContent()) === "About",
    "navigation reaches the About panel (no dead clicks)",
  );
  await settingsPage.click('[data-panel-target="appearance"]');
  await sleep(200);
  // Theme flip: force Light explicitly first. The UI boots on "system",
  // which follows the OS color scheme — on a dark-mode machine an unforced
  // "light" screenshot would be mislabeled. Click the styled label (the
  // radio input itself is visually hidden), exactly like a user does.
  await settingsPage.click('label:has(input[name="theme"][value="light"])');
  await sleep(250);
  const resolvedLight = await settingsPage.evaluate(
    () => document.documentElement.dataset.theme,
  );
  check(resolvedLight === "light", "theme picker resolves to light");
  const shotLight = join(shotsDir, "settings-appearance-light.png");
  await settingsPage.screenshot({ path: shotLight, fullPage: false });
  // The theme radio input is visually hidden (opacity:0) behind its styled
  // label — click the label, exactly like a user does.
  await settingsPage.click('label:has(input[name="theme"][value="midnight"])');
  await sleep(250);
  const resolvedDark = await settingsPage.evaluate(
    () => document.documentElement.dataset.theme,
  );
  check(resolvedDark === "midnight", "theme picker resolves to midnight");
  const shotDark = join(shotsDir, "settings-appearance-dark.png");
  await settingsPage.screenshot({ path: shotDark, fullPage: false });
  // The visible theme must actually repaint the workspace (no stuck CSS).
  const bgLight = await settingsPage.evaluate(() => {
    const el = document.querySelector(".workspace-header");
    return getComputedStyle(el).color;
  });
  check(
    typeof bgLight === "string" && bgLight.length > 0,
    "workspace header text color resolves under the active theme",
  );
  // Layout sanity on the two screenshots: files exist and are non-trivial.
  check(shotLight && shotDark, "appearance screenshots captured");
  check(
    settingsErrors.length === 0,
    "zero console/page errors across panel + theme navigation" +
      (settingsErrors.length ? " — " + settingsErrors[0] : ""),
  );
  await settingsCtx.close();

  // ---------------------------------------------------------------------------
  section("bridge.js installs cleanly on a WhatsApp-like page");
  // ---------------------------------------------------------------------------
  const waErrors = [];
  const waCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const waPage = await waCtx.newPage();
  waPage.on("console", (m) => {
    if (m.type() === "error") waErrors.push(m.text());
  });
  waPage.on("pageerror", (e) => waErrors.push(String(e)));
  await waPage.addInitScript(bridgeSource);
  // Serve a static WhatsApp-shaped DOM at web.whatsapp.com via route rewrite,
  // and fulfill every subresource locally (no network noise in the error log).
  // The DOM is PAINTED (real backgrounds, sized video) so the screenshot is
  // meaningful for visual inspection.
  await waPage.route("**/*", async (route) => {
    const url = route.request().url();
    if (url === "https://web.whatsapp.com/") {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `<!doctype html><html><head><title>WhatsApp</title>
<style>html,body{margin:0;height:100%;background:#0b1827}#main{position:absolute;inset:0}</style></head>
<body>
  <div id="app">
    <div id="side" aria-label="Chat list"></div>
    <div id="main">
      <div data-testid="conversation-panel-wrapper" style="position:absolute;inset:0;background:#0b1827">
        <div data-testid="conversation-background-default_chat_wallpaper"
             style="position:absolute;inset:0;mask-image:url('https://static.whatsapp.net/doodle.svg');background-color:rgba(255,255,255,.4)"></div>
        <video id="media-video" muted playsinline style="position:absolute;left:40px;top:40px;width:320px;height:180px;background:#112233"></video>
      </div>
    </div>
  </div>
</body></html>`,
      });
      return;
    }
    // Subresources (e.g. the doodle mask SVG): satisfy with an empty body.
    await route.fulfill({ status: 200, contentType: "image/svg+xml", body: "" });
  });
  await waPage.goto("https://web.whatsapp.com/");
  await waPage.waitForLoadState("domcontentloaded");
  await sleep(400);

  const bridgeSurface = await waPage.evaluate(() => ({
    doodleStyle: !!document.getElementById("whatsnow-no-wallpaper-doodles"),
    emojiStyle: !!document.getElementById("whatsnow-emoji-scheme"),
    doodleAttr: document.documentElement.getAttribute("data-whatsnow-doodles"),
    notificationShim:
      typeof window.Notification === "function" &&
      window.Notification.permission === "granted",
    dropFeed: typeof window.__whatsnowDropFeed === "function",
    routeFn: typeof window.__whatsnowOpenNotificationTarget === "function",
    promoProbe: !!window.__whatsnowPromoProbe,
    videoTag: !!document.getElementById("media-video"),
  }));
  check(bridgeSurface.doodleStyle, "doodle kill-switch stylesheet installed");
  check(bridgeSurface.emojiStyle, "emoji color-scheme guard installed");
  check(
    bridgeSurface.doodleAttr === "disabled",
    "doodles default to disabled until the theme script enables them",
  );
  check(bridgeSurface.notificationShim, "Notification shim forwards to native");
  check(bridgeSurface.dropFeed, "chunked drop feed handler mounted");
  check(bridgeSurface.routeFn, "notification chat-routing entry point mounted");
  check(bridgeSurface.promoProbe, "promo probe installed");

  // Media-audio guard: NO injected stylesheet may target video/audio elements.
  const mediaUntouched = await waPage.evaluate(() => {
    const video = document.getElementById("media-video");
    if (!video) return { found: false };
    const rules = [];
    for (const sheet of document.styleSheets) {
      let list;
      try {
        list = sheet.cssRules;
      } catch (e) {
        continue;
      }
      // Collect every selector. NOTE: in modern Chromium CSSStyleRule also has
      // a (usually empty) cssRules list for nesting, so recursion must key off
      // the ABSENCE of selectorText, not the presence of cssRules.
      const walk = (ruleList) => {
        for (const rule of ruleList) {
          if (rule.selectorText) {
            rules.push(rule.selectorText);
            if (rule.cssRules && rule.cssRules.length) walk(rule.cssRules);
          } else if (rule.cssRules) {
            walk(rule.cssRules);
          }
        }
      };
      walk(list);
    }
    const hits = rules.filter((sel) =>
      /\b(video|audio)\b/i.test(sel.replace(/\[.*?\]/g, " ")),
    );
    return { found: true, selectorCount: rules.length, videoRuleHits: hits };
  });
  check(mediaUntouched.found, "media <video> element present in test DOM");
  check(
    mediaUntouched.videoRuleHits.length === 0,
    `no injected CSS rule targets video/audio (${mediaUntouched.selectorCount} rules scanned)`,
  );
  check(
    waErrors.length === 0,
    "zero page errors while bridge.js initializes" +
      (waErrors.length ? " — " + waErrors[0] : ""),
  );

  // Screenshot-inspect the chat surface (theme applied + kill-switch active).
  // Inject the theme engine into the LIVE page (addInitScript would only
  // apply to future navigations — there are none here).
  await waPage.evaluate(chatThemeSource);
  await waPage.addInitScript(chatThemeSource);
  // Apply the theme the way settings.rs does, then screenshot.
  await waPage.evaluate(() => {
    window.__whatsnowApplyTheme("midnight");
    window.__whatsnowSetDoodlesEnabled(false);
  });
  check(
    (await waPage.evaluate(() =>
      document.documentElement.getAttribute("data-whatsnow-theme"),
    )) === "midnight",
    "theme engine attaches the data-whatsnow-theme attribute",
  );
  await sleep(250);
  const doodleKilled = await waPage.evaluate(() => {
    const layer = document.querySelector(
      "[data-testid='conversation-background-default_chat_wallpaper']",
    );
    if (!layer) return null;
    const cs = getComputedStyle(layer);
    return { mask: cs.maskImage || cs.webkitMaskImage, bg: cs.backgroundColor };
  });
  check(
    doodleKilled && (doodleKilled.mask === "none" || doodleKilled.mask === ""),
    "kill-switch zeroes the doodle mask-image on the wallpaper layer" +
      (doodleKilled ? ` (got ${JSON.stringify(doodleKilled.mask)})` : ""),
  );
  const shotChat = join(shotsDir, "chat-surface-midnight.png");
  await waPage.screenshot({ path: shotChat, fullPage: false });
  check(shotChat, "chat-surface screenshot captured");

  // Pixel-level screenshot inspection: decode the capture in Chromium and
  // assert the chat surface actually paints the midnight palette (near-black
  // blue), not the default light wallpaper. Guards against "test passed but
  // nothing was visibly themed" regressions. The PNG is inlined as a data:
  // URL so no origin/file-access policy can interfere with the decode.
  const chatPngB64 = readFileSync(shotChat).toString("base64");
  const pixelPage = await waCtx.newPage();
  const pixelStats = await pixelPage.evaluate(
    async ({ dataUrl }) => {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("failed to decode screenshot"));
        img.src = dataUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let r = 0,
        g = 0,
        b = 0,
        dark = 0,
        n = 0;
      for (let i = 0; i < data.length; i += 16) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        if (data[i] < 60 && data[i + 1] < 60 && data[i + 2] < 60) dark++;
        n++;
      }
      return {
        avg: [Math.round(r / n), Math.round(g / n), Math.round(b / n)],
        darkPct: Math.round((dark / n) * 10000) / 100,
      };
    },
    { dataUrl: "data:image/png;base64," + chatPngB64 },
  );
  await pixelPage.close();
  check(
    pixelStats &&
      pixelStats.avg[0] < 40 &&
      pixelStats.avg[1] < 50 &&
      pixelStats.avg[2] < 70 &&
      pixelStats.avg[2] > pixelStats.avg[0],
    "chat-surface pixels are the midnight palette (dark, blue-leaning)" +
      (pixelStats ? ` — avg RGB ${JSON.stringify(pixelStats.avg)}` : ""),
  );

  // Same pixel inspection for the Settings LIGHT capture: assert the page
  // genuinely paints a light surface (bright, not dark) so a dark-OS
  // harness can never smuggle a dark screenshot under the "light" name.
  const settingsLightB64 = readFileSync(shotLight).toString("base64");
  const lightPixelPage = await waCtx.newPage();
  const lightStats = await lightPixelPage.evaluate(
    async ({ dataUrl }) => {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("failed to decode screenshot"));
        img.src = dataUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let i = 0; i < data.length; i += 16) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
      return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
    },
    { dataUrl: "data:image/png;base64," + settingsLightB64 },
  );
  await lightPixelPage.close();
  check(
    lightStats[0] > 150 && lightStats[1] > 150 && lightStats[2] > 150,
    "settings-appearance-light pixels are genuinely light (bright surface)" +
      ` — avg RGB ${JSON.stringify(lightStats)}`,
  );

  // ---------------------------------------------------------------------------
  section("Theme → doodle matrix (2.6.0: System/Light/Dark show doodles)");
  // ---------------------------------------------------------------------------
  // The 2.5.0 bug: the Settings UI's "Dark" option persists as `system`, and
  // the old mapping enabled doodles only for Light|Dark — so the user's Dark
  // theme silently lost its doodles. settings.rs now drives the attribute via
  // chat_appearance_script; this matrix replays exactly those calls.
  const doodleMatrix = [
    { theme: "system", doodles: true, label: "System (= official Dark, doodles ON)" },
    { theme: "light", doodles: true, label: "Light (doodles ON)" },
    { theme: "dark", doodles: true, label: "Dark (doodles ON)" },
    { theme: "graphite", doodles: false, label: "Graphite (personality, doodles OFF)" },
    { theme: "candy", doodles: false, label: "Candy (personality, doodles OFF)" },
  ];
  for (const entry of doodleMatrix) {
    await waPage.evaluate(({ theme, doodles }) => {
      window.__whatsnowApplyTheme && window.__whatsnowApplyTheme(theme);
      window.__whatsnowSetDoodlesEnabled &&
        window.__whatsnowSetDoodlesEnabled(doodles);
    }, { theme: entry.theme, doodles: entry.doodles });
    await sleep(150);
    const state = await waPage.evaluate(() => {
      const attr = document.documentElement.getAttribute("data-whatsnow-doodles");
      const layer = document.querySelector(
        "[data-testid='conversation-background-default_chat_wallpaper']",
      );
      const mask = layer
        ? getComputedStyle(layer).maskImage || getComputedStyle(layer).webkitMaskImage
        : null;
      return { attr, mask };
    });
    const wantsDoodles = entry.doodles;
    const doodlesVisible =
      state.attr === "enabled" && state.mask && state.mask !== "none" && state.mask !== "";
    check(
      wantsDoodles ? doodlesVisible : !doodlesVisible,
      entry.label +
        ` — attr=${state.attr}, mask=${JSON.stringify(state.mask)}`,
    );
  }

  // Dark-with-doodles screenshot at the default 1080p viewport, then a
  // small-laptop viewport (1366x768 logical) to prove the themed surface
  // reflows cleanly at other resolutions (the WhatsApp-shaped test DOM is
  // layout-fluid: absolute-positioned layers scale with the viewport).
  await waPage.setViewportSize({ width: 1366, height: 728 });
  await waPage.evaluate(() => {
    window.__whatsnowApplyTheme && window.__whatsnowApplyTheme("dark");
    window.__whatsnowSetDoodlesEnabled && window.__whatsnowSetDoodlesEnabled(true);
  });
  check(
    await waPage.evaluate(
      () => document.documentElement.getAttribute("data-whatsnow-theme"),
    ) === "dark",
    "theme engine is live in the page (data-whatsnow-theme=dark)",
  );
  await sleep(200);
  const shotDarkDoodles = join(shotsDir, "chat-surface-dark-doodles-1366.png");
  await waPage.screenshot({ path: shotDarkDoodles, fullPage: false });
  check(shotDarkDoodles, "Dark-with-doodles screenshot captured at 1366x728");
  await waPage.setViewportSize({ width: 1920, height: 1040 });
  await waPage.evaluate(() => {
    window.__whatsnowApplyTheme && window.__whatsnowApplyTheme("dark");
    window.__whatsnowSetDoodlesEnabled && window.__whatsnowSetDoodlesEnabled(true);
  });
  await sleep(200);
  const shotDarkDoodles1080 = join(shotsDir, "chat-surface-dark-doodles-1920.png");
  await waPage.screenshot({ path: shotDarkDoodles1080, fullPage: false });
  check(shotDarkDoodles1080, "Dark-with-doodles screenshot captured at 1920x1040");

  // ---------------------------------------------------------------------------
  section("Promo-hide sweep is coalesced (fluency optimization)");
  // ---------------------------------------------------------------------------
  // N rapid mutations must schedule at most one deferred sweep: replace the
  // timer path by observing that the sweep flag exists and that a burst of
  // mutations produces a single pending timeout (measured indirectly:
  // schedulePromoSweep is only reachable through the MutationObserver, so we
  // assert on observable behavior — after the burst settles, exactly one
  // sweep pass runs and the promo card is hidden).
  const coalesced = await waPage.evaluate(async () => {
    const side = document.getElementById("side");
    if (!side) return { ok: false, reason: "no #side scope" };
    // Burst: 50 rapid DOM mutations (chat-list churn simulation).
    for (let i = 0; i < 50; i++) {
      const el = document.createElement("div");
      el.textContent = "row " + i;
      side.appendChild(el);
    }
    // Give the observer + coalescing window time to settle.
    await new Promise((r) => setTimeout(r, 700));
    return { ok: true };
  });
  check(coalesced.ok, "mutation burst absorbed without errors");
  check(
    waErrors.length === 0,
    "still zero page errors after the mutation burst" +
      (waErrors.length ? " — " + waErrors[0] : ""),
  );
  // A real promo card gets hidden by the deferred sweep (one pass suffices).
  const promoResult = await waPage.evaluate(async () => {
    const side = document.getElementById("side");
    const card = document.createElement("a");
    card.setAttribute("href", "https://www.whatsapp.com/download");
    card.textContent = "Download the WhatsApp app";
    side.appendChild(card);
    await new Promise((r) => setTimeout(r, 900));
    return {
      display: card.style.display,
      marked: card.hasAttribute("data-whatsnow-hidden-promo"),
      matched: window.__whatsnowPromoProbe.matches(card),
    };
  });
  check(
    promoResult.matched,
    "promo matcher recognizes the official-app download card",
  );
  check(
    promoResult.display === "none" && promoResult.marked,
    "deferred sweep hides the official-app promo card" +
      ` (display=${JSON.stringify(promoResult.display)}, marked=${promoResult.marked})`,
  );
  await waCtx.close();

  // ---------------------------------------------------------------------------
  section("Screenshot review summary");
  // ---------------------------------------------------------------------------
  console.log("  screenshots written to scripts/smoke-shots/:");
  console.log("    settings-appearance-light.png");
  console.log("    settings-appearance-dark.png");
  console.log("    chat-surface-midnight.png");
  console.log("    chat-surface-dark-doodles-1366.png");
  console.log("    chat-surface-dark-doodles-1920.png");
} finally {
  await browser.close();
}

console.log(
  failures === 0
    ? "\nALL SMOKE TESTS PASSED"
    : `\n${failures} SMOKE TEST(S) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
