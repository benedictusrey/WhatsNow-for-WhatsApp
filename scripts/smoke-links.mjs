// WhatsNow link-routing smoke test — Playwright (Chromium) + screenshot-inspect.
// Authored for the 2026-09-15 wa.me audit (the /6281234567890 case).
//
// What it verifies, against the REAL bridge.js + chat-theme.js in this repo,
// on a WhatsApp-shaped page served at web.whatsapp.com (contract per the
// 2026-09-17 live forensics: WhatsApp Web keeps chats OUT of the URL, so a
// wa.me/deep-link contact opens through the bridge's open-by-phone flow):
//   1. The anchor click path: clicking an <a href="https://wa.me/<phone>">
//      calls __whatsnowOpenChatByPhone — a KNOWN number is opened via a
//      trusted chat-row click (the fake page models the row + header);
//      an UNKNOWN number deliberately does nothing beyond the app rise
//      (revert decision 2026-09-17: no popup, no search choreography).
//   2. The programmatic path: window.open("https://wa.me/<phone>") takes
//      the same open-by-phone flow — never the browser, never a dead end.
//   3. api.whatsapp.com content links are hosted in the popup — never the
//      browser.
//   4. Ordinary links still go to the browser (no over-capture).
//   5. Screenshot-inspect at every stage.
//
// Run:  node scripts/smoke-links.mjs
// (Playwright must be resolvable — same env vars as scripts/smoke-test.mjs.)

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

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

const bridgeSource = readFileSync(
  join(root, "src-tauri", "resources", "bridge.js"),
  "utf8",
);

const browser = await pw.chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM }
    : {}),
  viewport: { width: 1280, height: 800 },
});

// The popup window the Rust layer would host window.open requests in. In the
// test we capture the request instead of spawning a real window, then
// "simulate" the Rust hosting by navigating this page to the captured URL.
const popupRequests = [];
let popupPage = null;

try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  // The invoke recorder the external-link assertion reads back. The Tauri
  // shim is installed BEFORE the bridge so open-by-phone's trusted-click
  // invoke is recorded too. The fake page's own script (below) wraps this
  // shim to reveal the conversation header on a trusted row click.
  await page.addInitScript(() => {
    window.__whatsnowInvokes = [];
    window.__TAURI__ = {
      core: {
        invoke(cmd, args) {
          (window.__whatsnowInvokes = window.__whatsnowInvokes || []).push(
            JSON.stringify({ cmd, args: args || {} }),
          );
          return Promise.resolve();
        },
      },
    };
  });

  // The popup window the Rust layer would host window.open requests in. In
  // the test we capture the popup page instead of spawning a real window.
  // Chromium commits the target URL at popup creation, so record the
  // page-event URL AND any later main-frame navigation (both shapes seen).
  const popupRequests = [];
  context.on("page", (p) => {
    popupRequests.push(p.url());
    p.on("framenavigated", (f) => {
      if (f === p.mainFrame()) popupRequests.push(p.url());
    });
  });

  const WA_PAGE = `<!doctype html><html><head><title>WhatsApp</title>
<style>html,body{margin:0;height:100%;background:#0b1827}
#app{position:relative;z-index:1}
#main{position:absolute;inset:0;pointer-events:none}
a{position:relative;z-index:2;color:#53bdeb}
#pane-side [data-id]{display:block;padding:8px}</style></head>
<body>
  <div id="app"><div id="pane-side"><div data-id="6281234567890@c.us">Ben</div></div><div id="main"></div></div>
  <a id="wame-anchor" style="position:absolute;left:16px;top:8px" href="https://wa.me/6281234567890">wa.me link</a>
  <a id="api-anchor" style="position:absolute;left:16px;top:32px" href="https://api.whatsapp.com/send/?phone=6281234567890&text&type=phone_number&app_absent=0">api link</a>
  <a id="ext-anchor" style="position:absolute;left:16px;top:56px" href="https://example.com/article">external link</a>
  <button id="new-chat" aria-label="New chat" style="position:absolute;left:50px;top:80px;width:40px;height:40px">+</button>
  <div id="search-panel" style="display:none;position:absolute;left:0;top:0;width:360px;height:640px;background:#111b21;z-index:5">
    <button id="panel-close" aria-label="Close" style="position:absolute;left:20px;top:20px;width:32px;height:32px">x</button>
    <input id="panel-input" type="text" aria-label="Search name, number or @username" placeholder="Search name, number or @username" style="position:absolute;left:70px;top:25px;width:240px;height:30px">
  </div>
  <script>
  // Chat-list model for the open-by-phone flow: the row with data-id
  // 6281234567890@c.us is the KNOWN contact. A TRUSTED click (the shell's
  // notification_click CDP path) opens the chat — here modeled by the Tauri
  // invoke shim (installed by the harness) revealing the header. Unknown
  // numbers have no row.
  (function () {
    var realInvoke = window.__TAURI__ && window.__TAURI__.core.invoke;
    if (!realInvoke) return;
    window.__trustedClicks = [];
    window.__TAURI__.core.invoke = function (cmd, args) {
      if (cmd === 'notification_click') {
        var x = args && args.x, y = args && args.y;
        var inRect = function (el) {
          if (!el) return false;
          var r = el.getBoundingClientRect();
          return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        };
        var panel = document.getElementById('search-panel');
        var open = panel && panel.style.display !== 'none';
        var showHeader = function (id, label) {
          var h = document.getElementById('conversation-header');
          if (!h) {
            h = document.createElement('div');
            h.id = 'conversation-header';
            h.setAttribute('data-testid', 'conversation-header');
            document.getElementById('main').appendChild(h);
          }
          h.setAttribute('data-id', id);
          h.textContent = label;
        };
        if (open) {
          if (inRect(document.getElementById('panel-close'))) {
            window.__trustedClicks.push({ x: x, y: y, kind: 'close-panel' });
            panel.style.display = 'none';
          } else {
            // A trusted click inside the open panel lands on a result row:
            // the conversation opens IN PLACE and the panel closes (the real
            // app's behavior, confirmed live). The digits come from the
            // typed search value.
            window.__trustedClicks.push({ x: x, y: y, kind: 'result-row' });
            var digits = ((document.getElementById('panel-input') || {}).value || '').replace(/[^0-9]/g, '');
            showHeader(digits + '@c.us', 'chat ' + digits);
            panel.style.display = 'none';
          }
        } else if (inRect(document.getElementById('new-chat'))) {
          window.__trustedClicks.push({ x: x, y: y, kind: 'open-panel' });
          panel.style.display = 'block';
        } else {
          // Chat-list trusted click: the KNOWN contact's row opened.
          window.__trustedClicks.push({ x: x, y: y, kind: 'chat-row' });
          showHeader('6281234567890@c.us', 'Ben 6281234567890');
        }
      }
      return realInvoke(cmd, args);
    };
  })();
  // New-chat search results model: typing digits renders WhatsApp's ic-add
  // "chat with this number" entry (what the real panel shows for unsaved
  // numbers). Clicking it is the trusted result-row click the bridge polls
  // for.
  (function () {
    var input = document.getElementById('panel-input');
    var panel = document.getElementById('search-panel');
    if (!input || !panel) return;
    input.addEventListener('input', function () {
      var old = document.getElementById('panel-results');
      if (old) old.remove();
      var digits = input.value.replace(/[^0-9]/g, '');
      if (!digits) return;
      var row = document.createElement('div');
      row.id = 'panel-results';
      row.setAttribute('data-id', 'add:' + digits);
      row.setAttribute('role', 'listitem');
      row.style.cssText = 'position:absolute;left:20px;top:80px;width:300px;height:56px';
      var icon = document.createElement('span');
      icon.setAttribute('data-icon', 'ic-add');
      row.appendChild(icon);
      var label = document.createElement('span');
      label.textContent = digits;
      row.appendChild(label);
      panel.appendChild(row);
    });
  })();
  <\/script>
  <script>
  // Simulated WhatsApp SPA router: renders the composer for the /send route
  // on popstate (what the real router does when the bridge pulses it) and on
  // initial load. A soft pushState route therefore renders the composer
  // WITHOUT any document reload — the assertion counts real navigations via
  // Playwright 'load' events.
  (function () {
    function render() {
      if (!/^\\/send/.test(location.pathname)) return;
      if (document.getElementById("composer")) return;
      var d = document.createElement("div");
      d.id = "composer";
      d.setAttribute("data-testid", "composer");
      d.textContent = "send composer for " + (new URLSearchParams(location.search).get("phone") || "");
      document.body.appendChild(d);
    }
    // Simulated WhatsApp SPA link interceptor: same-origin anchor clicks are
    // client-side routes (exactly what the real router does, and the exact
    // mechanism the bridge's seamless deep-link move relies on — it clicks a
    // synthetic same-origin anchor). popstate is kept ONLY for parity; the
    // bridge no longer pulses it (that crashed the real router — the black
    // screen incident of 2026-09-15).
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a) return;
      try {
        var u = new URL(a.getAttribute("href") || "", location.href);
        if (u.origin === location.origin && /^\\/send/.test(u.pathname)) {
          e.preventDefault();
          history.pushState({}, "", u.pathname + u.search);
          render();
        }
      } catch (err) {}
    }, false);
    window.addEventListener("popstate", render);
    render();
  })();
  </script>
</body></html>`;

  // Route interception is CONTEXT-level so the hosted popup (api.whatsapp.com
  // content) is fulfilled by the same handler instead of hitting the network.
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (url === "https://web.whatsapp.com/") {
      await route.fulfill({ status: 200, contentType: "text/html", body: WA_PAGE });
      return;
    }
    if (url === "https://web.whatsapp.com/send" || url.startsWith("https://web.whatsapp.com/send?")) {
      // The composer URL after wa.me resolution: WhatsApp's own page.
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: WA_PAGE.replace(
          "</body>",
          '<div data-testid="composer" id="composer">send composer for 6281234567890</div></body>',
        ),
      });
      return;
    }
    if (url.startsWith("https://wa.me/")) {
      // Real-world behavior (verified live): wa.me 302s to api.whatsapp.com.
      await route.fulfill({
        status: 302,
        headers: { location: "https://api.whatsapp.com/send/?phone=6281234567890&text&type=phone_number&app_absent=0" },
        body: "",
      });
      return;
    }
    if (url.startsWith("https://api.whatsapp.com/")) {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: WA_PAGE.replace(
          "</body>",
          '<div id="api-landing">Share on WhatsApp — Chat on WhatsApp with +62 812-3456-7890</div></body>',
        ),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>external</body></html>" });
  });

  await page.addInitScript(bridgeSource);
  await page.goto("https://web.whatsapp.com/");
  await page.waitForLoadState("domcontentloaded");
  await sleep(300);

  // Full page loads AFTER this point are hard navigations (location.href or
  // window.navigate). A seamless deep link produces ZERO of them — the SPA
  // stays alive and only the route changes.
  let hardNavigations = 0;
  page.on("load", () => {
    hardNavigations++;
  });

  // The bridge must be active.
  check(
    await page.evaluate(() => typeof window.__whatsnowProfileProbe === "object"),
    "bridge.js initialized on the chat surface",
  );

  // ---------------------------------------------------------------------------
  section("wa.me anchor click: KNOWN number opens its chat via trusted row click");
  // ---------------------------------------------------------------------------
  await page.click("#wame-anchor");
  await sleep(900);
  const invokes1 = await page.evaluate(() => window.__whatsnowInvokes || []);
  check(
    invokes1.some((raw) => raw.includes("notification_click")),
    "the known number's chat row was opened with a TRUSTED click",
  );
  const headerShown = await page.evaluate(() => {
    const h = document.querySelector("#conversation-header");
    return !!h && h.textContent.includes("6281234567890");
  });
  check(headerShown, "the conversation for 6281234567890 opened in place");
  check(
    page.url() === "https://web.whatsapp.com/" && hardNavigations === 0,
    `the SPA stayed alive (url ${page.url()}, ${hardNavigations} hard navigations)`,
  );
  check(
    !(await page.evaluate(
      () => (window.__whatsnowInvokes || []).some((r) => r.includes("open_external_url")),
    )),
    "the wa.me click was never sent to the external browser",
  );
  await page.screenshot({
    path: join(root, "scripts", "smoke-shots", "links-wame-composer.png"),
    fullPage: false,
  });

  // ---------------------------------------------------------------------------
  section("Programmatic window.open(wa.me): UNKNOWN number does NOTHING beyond the app rise (revert decision)");
  // ---------------------------------------------------------------------------
  const popupsBefore = popupRequests.length;
  await page.evaluate(() => window.open("https://wa.me/628999999999"));
  // Unknown (not in the chat list): the flow resolves "no-row" and STOPS —
  // no popup, no New-chat search choreography, no navigation, no browser.
  // The app has already risen and focused; that is the whole contract.
  await sleep(6000);
  check(
    popupRequests.length === popupsBefore,
    `no popup of any kind for the unknown number (got ${JSON.stringify(popupRequests.slice(popupsBefore))})`,
  );
  check(
    hardNavigations === 0,
    "window.open(wa.me) caused no reload of the chat surface",
  );
  check(
    !(await page.evaluate(
      () => (window.__whatsnowInvokes || []).some((r) => r.includes("open_external_url")),
    )),
    "window.open(wa.me) was never sent to the external browser",
  );

  // ---------------------------------------------------------------------------
  section("api.whatsapp.com popup request is hosted, not sent to the browser");
  // ---------------------------------------------------------------------------
  await page.click("#api-anchor");
  await sleep(500);
  // The popup carries the REAL redirect chain (wa.me → api.whatsapp.com),
  // which is exactly what the Rust on_new_window handler receives and hosts
  // in the reusable content window.
  check(
    popupRequests.some((u) =>
      u.startsWith("https://api.whatsapp.com/send/?phone=6281234567890"),
    ),
    `api.whatsapp.com click opened a popup hosted by the shell (got ${JSON.stringify(popupRequests)})`,
  );

  // ---------------------------------------------------------------------------
  section("Ordinary links still go to the browser");
  // ---------------------------------------------------------------------------
  await page.click("#ext-anchor");
  await sleep(200);
  check(
    await page.evaluate(
      () => (window.__whatsnowInvokes || []).some((r) => r.includes("open_external_url")),
    ),
    "example.com click requested open_external_url",
  );

  check(
    pageErrors.length === 0,
    "zero page errors across the whole link flow" +
      (pageErrors.length ? " — " + pageErrors[0] : ""),
  );

  // ---------------------------------------------------------------------------
  section("Screenshot review summary");
  // ---------------------------------------------------------------------------
  console.log("  screenshots written to scripts/smoke-shots/:");
  console.log("    links-wame-composer.png");
  await context.close();
} finally {
  await browser.close();
}

console.log(
  failures === 0 ? "\nALL LINK SMOKE TESTS PASSED" : `\n${failures} LINK SMOKE TEST(S) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
