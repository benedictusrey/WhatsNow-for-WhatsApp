// WhatsNow is authored and maintained solely by @benedictusrey.
// Zero-dependency behavioral tests for bridge.js's native-toast chat routing:
// chat-id enrichment at notify time (so the toast payload carries a stable jid)
// and __whatsnowOpenNotificationTarget (row discovery, click verification,
// search fallback, bounded retries). Run: node src-tauri/resources/toast-route.test.mjs
// Exits nonzero on failure. Same standalone pattern as bridge.test.mjs.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const bridgeSrc = readFileSync(join(here, "bridge.js"), "utf8");

let failures = 0;
function assert(cond, msg) {
  if (cond) {
    console.log("  ok  " + msg);
  } else {
    failures++;
    console.error("FAIL  " + msg);
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- minimal DOM stubs -------------------------------------------------------
// One pinned chat ("Mom") and one ordinary chat ("Alice") whose row carries the
// WhatsApp jid on its OUTER div while discovery lands on an inner container.
function makeRow(id, title, { pinned = false } = {}, rowIndex = 0) {
  const titleSpan = {
    tagName: "SPAN",
    getAttribute(name) {
      return name === "title" ? title : null;
    },
    textContent: title,
  };
  const cell = {
    tagName: "DIV",
    className: "cell-frame-container",
    getAttribute() {
      return null;
    },
    querySelectorAll() {
      return [titleSpan];
    },
    parentElement: null, // filled below
    closest() {
      return this.parentElement;
    },
    // The row finder compares bounding areas to prefer the smallest matching
    // element (the real row over a giant list wrapper); delegate to the row's
    // rect like the real DOM does.
    getBoundingClientRect() {
      return this.parentElement && this.parentElement.getBoundingClientRect
        ? this.parentElement.getBoundingClientRect()
        : { left: 100, top: 100, width: 500, height: 72 };
    },
    click() {
      this.parentElement.click();
    },
  };
  const row = {
    tagName: "DIV",
    getAttribute(name) {
      return name === "data-id" ? id : null;
    },
    querySelectorAll(sel) {
      return sel === "[data-testid='cell-frame-container'], [role='row'], [role='listitem'], [data-id], div[tabindex='-1']"
        ? [cell]
        : sel.includes("data-testid='cell-frame-container'")
          ? [cell]
          : [];
    },
    closest() {
      return this;
    },
    scrollIntoView() {},
    getBoundingClientRect() {
      // Stable per-row viewport rect; row 0 is "Mom" at top, row 1 "Alice"
      // below it. The bridge computes the center and requests a trusted click
      // there, which the fake invoke maps back to this row.
      return { left: 100, top: 100 + 80 * rowIndex, width: 500, height: 72 };
    },
    click() {
      state.headerTitle = title;
      state.clicked.push(title);
    },
    parentElement: { tagName: "UL" },
    pinned,
  };
  cell.parentElement = row;
  return row;
}

const state = {
  headerTitle: "",
  clicked: [],
};

function makeHarness() {
  const invokes = [];
  const rows = [
    makeRow("true_6280000000000@s.whatsapp.net", "Mom", { pinned: true }, 0),
    makeRow("true_6281234567890@s.whatsapp.net", "Alice", {}, 1),
  ];
  const timers = [];
  const fakeSetTimeout = (fn, ms) => {
    timers.push({ fn, ms });
    return timers.length;
  };
  const fakeClearTimeout = () => {};
  const fakeClearInterval = () => {};
  const fakeSetInterval = () => 0;
  // Date.now jumps forward on every call so the 12 s notification warmup gate
  // (armedAt = eval-time now + 12000) is already passed by the first
  // nativeNotify call, and the verifyClick timeout check never stalls on real
  // wall-clock time.
  let nowTick = 0;
  const fakeDate = class {
    static now() {
      nowTick += 100000;
      return 1_700_000_000_000 + nowTick;
    }
  };

  const header = {
    getAttribute() {
      return null;
    },
    querySelectorAll(sel) {
      if (!state.headerTitle) return [];
      if (sel === "[title], [aria-label], span, div") {
        return [{ getAttribute: (n) => (n === "title" ? state.headerTitle : null), textContent: state.headerTitle }];
      }
      return [];
    },
  };
  const list = {
    tagName: "DIV",
    id: "pane-side",
    querySelectorAll(sel) {
      if (sel.includes("cell-frame-container")) return rows.map((r) => r.querySelectorAll(sel)[0]);
      if (sel.includes("[role='row']")) return rows;
      return rows;
    },
  };
  const side = {
    tagName: "DIV",
    id: "side",
    querySelector(sel) {
      return sel.includes("placeholder") ? searchInput : null;
    },
  };
  const searchInput = {
    tagName: "INPUT",
    value: "",
    textContent: "",
    focus() {},
    blur() {},
    dispatchEvent() {},
  };
  const document = {
    title: "WhatsApp",
    readyState: "complete",
    documentElement: { tagName: "HTML" },
    head: { appendChild() {} },
    body: {},
    createElement() {
      return { id: "", textContent: "", appendChild() {}, setAttribute() {} };
    },
    getElementById() {
      return null;
    },
    addEventListener() {},
    querySelector(sel) {
      if (sel === "[data-testid='conversation-header']" || sel === "[data-testid='conversation-info-header']") {
        return state.headerTitle ? header : null;
      }
      if (sel === "#pane-side" || sel === "[data-testid='chat-list']") return list;
      if (sel === "#side") return side;
      if (sel.includes("Search")) return searchInput;
      if (sel === "main") return {};
      return null;
    },
    querySelectorAll(sel) {
      if (sel.includes("conversation-panel-messages") || sel.includes("conversation-panel-body")) return [{ querySelectorAll: () => [] }];
      return [];
    },
  };
  const window = {
    location: { origin: "https://web.whatsapp.com", href: "https://web.whatsapp.com/" },
    // Viewport used by the trusted-click guard: rows must lie inside it, so
    // off-screen wrappers can never be clicked.
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener() {},
    removeEventListener() {},
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
    setInterval: fakeSetInterval,
    clearInterval: fakeClearInterval,
    localStorage: {
      getItem() {
        return null;
      },
      key() {
        return null;
      },
      length: 0,
      setItem() {},
    },
    HTMLInputElement: class {},
    __TAURI__: {
      core: {
        invoke: (cmd, args) => {
          invokes.push({ cmd, args });
          // The real host dispatches a TRUSTED click (CDP Input.dispatchMouseEvent)
          // at the given viewport point; here the stub maps the point back to
          // the row whose center it is and simulates the click landing.
          if (cmd === "notification_click") {
            for (const r of rows) {
              const rect = r.getBoundingClientRect();
              const cx = Math.round(rect.left + rect.width / 2);
              const cy = Math.round(rect.top + rect.height / 2);
              if (cx === args.x && cy === args.y) {
                r.click();
                break;
              }
            }
          }
          return Promise.resolve();
        },
      },
    },
  };
  const sandboxGlobals = {
    window,
    document,
    navigator: {},
    console: { log() {}, error() {} },
    MutationObserver: class { observe() {} },
    Event: class { constructor(type, options = {}) { this.type = type; Object.assign(this, options); } },
    KeyboardEvent: class { constructor(type, options = {}) { this.type = type; Object.assign(this, options); } },
    InputEvent: class { constructor(type, options = {}) { this.type = type; Object.assign(this, options); } },
    DragEvent: class { constructor(type, options = {}) { this.type = type; Object.assign(this, options); } },
    File: class {},
    DataTransfer: class { constructor() { this.items = { add() {} }; } },
    Date: fakeDate,
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
    setInterval: fakeSetInterval,
    clearInterval: fakeClearInterval,
  };
  const params = Object.keys(sandboxGlobals);
  const fn = new Function(...params, `"use strict";\n${bridgeSrc}`);
  fn(...params.map((k) => sandboxGlobals[k]));
  return {
    window,
    state,
    invokes,
    rows,
    timers,
    // Run every pending timer in order (one pass; returns false when nothing ran).
    flush() {
      const pending = timers.splice(0);
      for (const t of pending) t.fn();
      return pending.length > 0;
    },
    // Date.now() in this harness advances ~100000ms per call, so a
    // wall-clock deadline is meaningless; run until the timer queue drains
    // (capped to stay bounded) and flush microtasks between batches so the
    // trusted-click promise chains and the async search fallback settle.
    async runTimers(ms) {
      let budget = Math.max(10, Math.floor(ms / 5));
      while (budget-- > 0 && timers.length) {
        const pending = timers.splice(0);
        for (const t of pending) t.fn();
        await sleep(0);
      }
      await sleep(0);
    },
    resetState() {
      state.headerTitle = "";
      state.clicked.length = 0;
    },
  };
}

// --- tests -------------------------------------------------------------------

async function testNotifyEnrichesChatIdFromSenderRow() {
  console.log("nativeNotify enriches route.chatId from the sender's chat row");
  const h = makeHarness();
  // WhatsApp-style notification data carries only the message id — no chat jid.
  new h.window.Notification("Alice", {
    body: "Hi there",
    data: { id: "3EB0ABC1D2E3F4" },
  });
  const notify = h.invokes.find((i) => i.cmd === "notify");
  assert(!!notify, "notify command reached Rust");
  assert(
    notify.args.route.chatId === "true_6281234567890@s.whatsapp.net",
    `route carries the sender's stable chat id (got ${notify.args.route.chatId})`
  );
  assert(notify.args.route.chatTitle === "Alice", "chat title preserved");
  assert(notify.args.route.messageText === "Hi there", "message text preserved");
  assert(notify.args.route.messageId === "3EB0ABC1D2E3F4", "message id preserved");
}

async function testNotifyKeepsExplicitChatId() {
  console.log("nativeNotify keeps an explicit chatId from notification data");
  const h = makeHarness();
  new h.window.Notification("Bob", {
    body: "yo",
    data: { chatId: "1203630@g.us" },
  });
  const notify = h.invokes.find((i) => i.cmd === "notify");
  assert(
    notify.args.route.chatId === "1203630@g.us",
    "explicit data chatId wins over row lookup"
  );
}

async function testRouteMatchesByChatIdOnOuterRowDiv() {
  console.log("__whatsnowOpenNotificationTarget opens a chat by stable id");
  const h = makeHarness();
  h.resetState();
  const opened = h.window.__whatsnowOpenNotificationTarget({
    chatTitle: "Alice",
    chatId: "true_6281234567890@s.whatsapp.net",
    messageText: "Hi",
  });
  await h.runTimers(3000);
  assert(await opened === true, "routing resolves opened=true");
  assert(
    h.state.clicked.includes("Alice"),
    "the sender's row was clicked (not the pinned chat)"
  );
  assert(h.state.headerTitle === "Alice", "conversation header matches the sender");
}

async function testRouteRequestsTrustedClickAtRowCenter() {
  console.log("routing requests a TRUSTED click via notification_click at the row's center");
  const h = makeHarness();
  h.resetState();
  const opened = h.window.__whatsnowOpenNotificationTarget({
    chatTitle: "Alice",
    chatId: "true_6281234567890@s.whatsapp.net",
    messageText: "Hi",
  });
  await h.runTimers(3000);
  assert(await opened === true, "routing resolves opened=true");
  const clicks = h.invokes.filter((i) => i.cmd === "notification_click");
  assert(clicks.length >= 1, "the bridge requested a trusted click (got " + clicks.length + ")");
  const rect = h.rows[1].getBoundingClientRect();
  assert(
    clicks[0].args.x === Math.round(rect.left + rect.width / 2) &&
      clicks[0].args.y === Math.round(rect.top + rect.height / 2),
    "click coordinates are the sender row's center (got " + JSON.stringify(clicks[0].args) + ")"
  );
  assert(
    !clicks.some((c) => c.args.x === undefined),
    "no coordinate-less click requests"
  );
}

async function testRouteMatchesByTitleOnly() {
  console.log("__whatsnowOpenNotificationTarget opens a chat by title alone");
  const h = makeHarness();
  h.resetState();
  const opened = h.window.__whatsnowOpenNotificationTarget({
    chatTitle: "Alice",
    messageText: "Hi",
  });
  await h.runTimers(3000);
  assert(await opened === true, "title-only routing resolves opened=true");
  assert(h.state.clicked.includes("Alice"), "the sender's row was clicked");
}

async function testCurrentConversationShortCircuits() {
  console.log("__whatsnowOpenNotificationTarget short-circuits on the open chat");
  const h = makeHarness();
  h.resetState();
  h.state.headerTitle = "Alice";
  const opened = h.window.__whatsnowOpenNotificationTarget({
    chatTitle: "Alice",
    chatId: "true_6281234567890@s.whatsapp.net",
  });
  await h.runTimers(500);
  assert(await opened === true, "resolves opened=true without clicking");
  assert(h.state.clicked.length === 0, "no row was clicked");
}

async function testUnknownChatGivesUp() {
  console.log("__whatsnowOpenNotificationTarget gives up for an unknown chat");
  const h = makeHarness();
  h.resetState();
  const opened = h.window.__whatsnowOpenNotificationTarget({
    chatTitle: "Nobody Here",
  });
  await h.runTimers(30000);
  assert(await opened === false, "unknown chat resolves opened=false");
}

async function testEmptyRouteFinishesImmediately() {
  console.log("__whatsnowOpenNotificationTarget finishes fast for an empty route");
  const h = makeHarness();
  h.resetState();
  const opened = h.window.__whatsnowOpenNotificationTarget({});
  await h.runTimers(1000);
  assert(await opened === false, "empty route resolves opened=false");
}

async function testClickThatDoesNotStickRetries() {
  console.log("a click that does not switch the conversation is retried");
  const h = makeHarness();
  h.resetState();
  // First click lands on the wrong chat (header becomes Mom); the verifier must
  // detect the mismatch and keep trying until the right row is clicked.
  const originalClick = h.rows[1].click;
  let clicks = 0;
  h.rows[1].click = function () {
    clicks++;
    if (clicks === 1) {
      h.state.headerTitle = "Mom"; // wrong conversation opened
      return;
    }
    originalClick.call(this);
  };
  const opened = h.window.__whatsnowOpenNotificationTarget({
    chatTitle: "Alice",
    chatId: "true_6281234567890@s.whatsapp.net",
  });
  await h.runTimers(15000);
  assert(await opened === true, "eventually resolves opened=true");
  assert(clicks >= 2, `retried the click (clicked ${clicks} times)`);
  assert(h.state.headerTitle === "Alice", "conversation header ends on the sender");
}

async function testGiantWrapperRowIsNotClicked() {
  console.log("a giant list wrapper containing the title is NOT the click target");
  const h = makeHarness();
  h.resetState();
  // WhatsApp puts a huge wrapper container (the whole list body) into the row
  // selector set; its descendants include the sender's title text. Before the
  // smallest-match fix the finder returned THIS wrapper and trusted-clicked its
  // center — thousands of pixels off-screen — so routing never opened the chat.
  const titleSpan = {
    tagName: "SPAN",
    getAttribute(name) {
      return name === "title" ? "Alice" : null;
    },
    textContent: "Alice",
  };
  const wrapper = {
    tagName: "DIV",
    getAttribute() {
      return null;
    },
    querySelectorAll(sel) {
      return sel.includes("[title], [aria-label], span, div") ? [titleSpan] : [this];
    },
    closest() {
      return this;
    },
    scrollIntoView() {},
    getBoundingClientRect() {
      // The whole list body: 500px wide, ~40,000px tall, starting at the top.
      return { left: 100, top: 0, width: 500, height: 40000 };
    },
    click() {
      h.state.clicked.push("WRAPPER");
    },
  };
  h.rows.unshift(wrapper);
  const opened = h.window.__whatsnowOpenNotificationTarget({
    chatTitle: "Alice",
    chatId: "true_6281234567890@s.whatsapp.net",
  });
  await h.runTimers(3000);
  assert(await opened === true, "routing resolves opened=true");
  assert(
    !h.state.clicked.includes("WRAPPER"),
    "the giant wrapper was never clicked"
  );
  assert(h.state.clicked.includes("Alice"), "the real sender row was clicked");
  const clicks = h.invokes.filter((i) => i.cmd === "notification_click");
  const aliceRect = h.rows[2].getBoundingClientRect();
  assert(
    clicks.length >= 1 &&
      clicks[0].args.y === Math.round(aliceRect.top + aliceRect.height / 2),
    "click target is the real row's center, not the wrapper's (got " +
      JSON.stringify(clicks[0] && clicks[0].args) +
      ")"
  );
}

async function testHighlightStyleInjected() {
  console.log("toast target highlight style is present on the page");
  const h = makeHarness();
  // The style element is appended via (document.head || documentElement).appendChild
  // with id whatsnow-toast-target-style; our stub createElement returns a plain
  // object so this only proves the injection path does not throw. The real
  // assertion is that __whatsnowOpenNotificationTarget itself ran cleanly.
  h.resetState();
  const opened = h.window.__whatsnowOpenNotificationTarget({
    chatTitle: "Alice",
    chatId: "true_6281234567890@s.whatsapp.net",
  });
  await h.runTimers(3000);
  assert(await opened === true, "routing still works with the style injected");
}

// --- runner ------------------------------------------------------------------

const tests = [
  testNotifyEnrichesChatIdFromSenderRow,
  testNotifyKeepsExplicitChatId,
  testRouteMatchesByChatIdOnOuterRowDiv,
  testRouteRequestsTrustedClickAtRowCenter,
  testRouteMatchesByTitleOnly,
  testCurrentConversationShortCircuits,
  testUnknownChatGivesUp,
  testEmptyRouteFinishesImmediately,
  testClickThatDoesNotStickRetries,
  testGiantWrapperRowIsNotClicked,
  testHighlightStyleInjected,
];

for (const test of tests) {
  await test();
}

if (failures > 0) {
  console.error(`${failures} toast-route test(s) FAILED`);
  process.exit(1);
}
console.log("all toast route tests passed");
