// WhatsNow is authored and maintained solely by @benedictusrey.
// Zero-dependency behavioral tests for bridge.js's drag-drop injector
// (the chunked __whatsnowDropFeed protocol). Run: node src-tauri/resources/bridge.test.mjs
// Exits nonzero on failure. Same standalone pattern as settings-ui/comboToAccelerator.test.mjs.
//
// The harness stubs the minimal DOM surface bridge.js touches, evals the real
// script, then drives the feed exactly as window.rs does (begin/chunk/end/commit)
// and asserts which fake <input type=file> received which File objects.

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
const b64 = (s) => Buffer.from(s).toString("base64");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- minimal DOM stubs -------------------------------------------------------
class FakeFile {
  constructor(parts, name, opts) {
    this.name = name;
    this.type = (opts && opts.type) || "";
    let size = 0;
    for (const p of parts) size += p.length ?? 0;
    this.size = size;
    this.parts = parts;
  }
  bytes() {
    const out = Buffer.concat(this.parts.map((p) => Buffer.from(p)));
    return out;
  }
}
class FakeDataTransfer {
  constructor() {
    this._files = [];
    this.items = { add: (f) => this._files.push(f) };
  }
  get files() {
    return this._files.slice();
  }
}
class FakeInput {
  constructor(accept, onPicker) {
    this.accept = accept;
    this.type = "file";
    this.tagName = "INPUT";
    this.isConnected = true;
    this.files = [];
    this.batches = []; // one entry per change event: [FakeFile, ...]
    this.onPicker = onPicker;
  }
  click() {
    if (this.onPicker) this.onPicker();
  }
  showPicker() {
    if (this.onPicker) this.onPicker();
  }
  dispatchEvent(ev) {
    if (ev.type === "change") {
      this.batches.push(this.files.slice());
      if (this.onchange) this.onchange();
    }
    return true;
  }
}

function makeHarness({
  inputsInitiallyMounted = true,
  directDropSupported = true,
  storage = {},
  readyState = "complete",
  onNavigate,
  invokeLog,
  // Chat-list rows the open-by-phone / toast-routing flow can find. Each
  // entry maps to a fake row element carrying the given attributes.
  chatListRows = [],
} = {}) {
  let pickerAttempts = 0;
  let attachMenuClicks = 0;
  const onPicker = () => pickerAttempts++;
  const mediaInput = new FakeInput(
    "image/*,video/mp4,video/3gpp,video/quicktime",
    onPicker
  );
  const docInput = new FakeInput("*", onPicker);
  const logs = [];
  const listeners = Object.create(null);
  // Simulate WhatsApp's composer lifecycle: it opens right after an input change
  // and "the user sends" ~80ms later. This exercises injectBatch's real waits
  // (composer detected, then queue held until it closes) without long timeouts.
  const state = {
    composerUntil: 0,
    inputsMounted: inputsInitiallyMounted,
    menuOpen: false,
  };
  const onChange = () => {
    state.composerUntil = Date.now() + 80;
  };
  mediaInput.onchange = onChange;
  docInput.onchange = onChange;
  const conversationTarget = {
    dispatchEvent(event) {
      if (event.type !== "drop" || !directDropSupported) return true;
      const files = Array.from((event.dataTransfer && event.dataTransfer.files) || []);
      const media = files.filter(
        (file) =>
          /^image\//.test(file.type) ||
          ["video/mp4", "video/3gpp", "video/quicktime"].includes(file.type)
      );
      const input = media.length === files.length ? mediaInput : docInput;
      input.files = files;
      input.dispatchEvent({ type: "change" });
      return true;
    },
  };
  const styles = [];
  const windowOpenCalls = [];
  const document = {
    title: "WhatsApp",
    readyState,
    documentElement: {
      setAttribute() {},
      removeAttribute() {},
    },
    getElementById() {
      return null;
    },
    createElement(tag) {
      const el = { id: "", textContent: "" };
      if (tag === "style") styles.push(el);
      return el;
    },
    head: { appendChild() {} },
    // body carries app content (watchShell reads textContent to decide the
    // app is alive — a real WhatsApp body always has text) and supports the
    // anchor add/remove cycle the seamless deep-link move uses.
    body: {
      appendChild() {},
      removeChild() {},
      textContent: "WhatsApp",
    },
    addEventListener(type, listener) {
      (listeners[type] ||= []).push(listener);
    },
    querySelectorAll(sel) {
      return sel === 'input[type="file"]' && state.inputsMounted
        ? [mediaInput, docInput]
        : [];
    },
    querySelector(sel) {
      if (sel === "title") return null;
      if (sel === '[data-testid="conversation-panel-body"]') {
        return conversationTarget;
      }
      if (
        sel === '[data-icon="plus"]' ||
        sel === '[data-icon="attach-menu-plus"]'
      ) {
        return {
          closest() {
            return {
              click() {
                attachMenuClicks++;
                state.menuOpen = true;
              },
            };
          },
        };
      }
      if (
        state.menuOpen &&
        (sel === '[data-testid="attach-document"]' ||
          sel === '[data-icon="document"]')
      ) {
        return {
          closest() {
            return {
              click() {
                state.inputsMounted = true;
                docInput.click();
              },
            };
          },
        };
      }
      if (sel.includes("media-caption-input-container")) {
        return Date.now() < state.composerUntil ? {} : null;
      }
      // Chat-list surface for open-by-phone / toast routing: a #pane-side
      // carrying the configured rows.
      if (sel === "#pane-side" && chatListRows.length > 0) {
        return paneSide;
      }
      // Conversation header: once a row has been trusted-clicked, WhatsApp
      // shows the conversation whose identity matches the clicked row —
      // model it so the bridge's verification (header matches the phone)
      // sees the opened chat.
      if (
        chatListRows.length > 0 &&
        state.rowClicked &&
        (sel === "[data-testid='conversation-header']" ||
          sel === "[data-testid='conversation-info-header']" ||
          sel === "header[data-tab]")
      ) {
        const attrs = chatListRows[state.lastClickedRow ?? 0] ?? {};
        return {
          getAttribute(name) {
            return attrs[name] ?? null;
          },
          querySelectorAll() {
            return [];
          },
        };
      }
      return null;
    },
  };
  // Trusted-click bookkeeping: requestTrustedClick records the row it
  // clicked so the header model above can reveal the right conversation.
  let clickCount = 0;
  // Fake chat-list rows: each carries its attributes and a viewport-sized
  // rect so the trusted-click path (which guards on the bounding rect)
  // accepts them. The state flags mirror what the click did.
  const paneSide = {
    querySelectorAll(sel) {
      if (!/cell-frame-container|role='row'|listitem|data-id/.test(sel)) {
        return [];
      }
      return chatListRows.map((attrs, idx) => ({
        attributes: { ...attrs },
        getAttribute(name) {
          return attrs[name] ?? null;
        },
        closest() {
          return this;
        },
        getBoundingClientRect() {
          return { left: 20, top: 20, width: 300, height: 60 };
        },
        dispatchEvent() {
          return true;
        },
        // The trusted click marks the conversation as opened (the header
        // model reads state.rowClicked / state.lastClickedRow).
        click() {
          clickCount++;
          state.rowClicked = true;
          state.lastClickedRow = idx;
        },
      }));
    },
  };
  // Dynamic location/history for the seamless-navigation tests: the bridge's
  // softNavigate does history.pushState + popstate and verifies the URL kept
  // its value 500ms later; a fallback assigns location.href. historyCalls
  // and simulateRouterRevert let tests assert both sides.
  let currentHref = "https://web.whatsapp.com/";
  const historyCalls = [];
  const popstateEvents = [];
  const windowListeners = Object.create(null);
  // Simulated SPA link interceptor on/off (default: on — the real app takes
  // same-origin anchor clicks as client-side routes).
  let routerOn = true;
  const window = {
    location: {
      origin: "https://web.whatsapp.com",
      href: "https://web.whatsapp.com/",
    },
    // Viewport for trusted-click targeting (the bridge guards clicks to the
    // visible viewport; a real window always has a size).
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener(type, listener) {
      (windowListeners[type] = windowListeners[type] || []).push(listener);
    },
    dispatchEvent(event) {
      for (const listener of windowListeners[event.type] || []) listener(event);
      return true;
    },
    history: {
      pushState(state, title, url) {
        historyCalls.push({ state, title, url });
        currentHref = new URL(String(url), currentHref).href;
      },
    },
    PopStateEvent: class {
      constructor(type, options = {}) {
        this.type = type;
        Object.assign(this, options);
      }
    },
    // Real timers on window (softNavigate's revert check uses
    // window.setTimeout and watchShell uses window.setInterval — a real
    // browser has them; the harness must too).
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    // Real browsers expose document ON window (watchShell reads
    // window.document); the harness must mirror that.
    document: null, // assigned below, after `document` is fully built
    HTMLInputElement: FakeInput,
    // Recording stub: the bridge captures this at init as nativeWindowOpen;
    // link tests assert what reached the real window.open.
    open(value, target, features) {
      windowOpenCalls.push({ value, target, features });
      return null;
    },
    Event: class {
      constructor(type, options = {}) {
        this.type = type;
        Object.assign(this, options);
      }
    },
  };
  if (invokeLog) {
    // Stand-in Tauri IPC: records every command the bridge requests so tests
    // can assert exactly which native command a page action triggered.
    window.__TAURI__ = {
      core: {
        invoke(cmd, args) {
          invokeLog.push({ cmd, ...args });
          // A TRUSTED click (notification_click) opens the conversation the
          // clicked row pointed at — the header model below reveals it.
          if (cmd === "notification_click" && chatListRows.length > 0) {
            state.rowClicked = true;
            if (state.lastClickedRow == null) state.lastClickedRow = 0;
          }
          return Promise.resolve();
        },
      },
    };
  }
  // Minimal <a> support for the link-routing tests: href/target attributes
  // plus real event dispatch through the document-level click listeners the
  // bridge installs.
  const realCreateElement = document.createElement;
  document.createElement = function (tag) {
    const el = realCreateElement.call(this, tag);
    if (tag === "a") {
      el.attributes = Object.create(null);
      // Real HTMLElements carry a style object; the bridge's synthetic
      // anchor (seamless deep-link move) sets style.display before clicking.
      el.style = {};
      Object.defineProperty(el, "href", {
        get() {
          const raw = this.attributes.href || "";
          try {
            return new URL(raw, this.ownerLocation || window.location.href).href;
          } catch (e) {
            return raw;
          }
        },
      });
      el.getAttribute = function (name) {
        return this.attributes[name] ?? null;
      };
      el.setAttribute = function (name, value) {
        this.attributes[name] = value;
      };
      el.closest = function () {
        return this;
      };
      // Real HTMLElements have .click() — the bridge's seamless deep-link
      // move drives the SPA router through a synthetic anchor click.
      el.click = function () {
        el.dispatchEvent({ type: "click", bubbles: true, cancelable: true });
      };
      el.dispatchEvent = function (event) {
        // Normalized event: the bridge's click handler calls
        // preventDefault/stopPropagation — provide them.
        const normalized = {
          type: event.type,
          bubbles: event.bubbles,
          cancelable: event.cancelable,
          target: this,
          defaultPrevented: false,
          preventDefault() {
            this.defaultPrevented = true;
          },
          stopPropagation() {},
          stopImmediatePropagation() {},
        };
        for (const listener of listeners.click || []) listener(normalized);
        // Simulated WhatsApp SPA link interceptor (what the real app does
        // for same-origin anchor clicks — the mechanism the bridge's
        // seamless deep-link move relies on). Toggle with setRouter(false)
        // to simulate a router that refuses the route (fallback path).
        if (
          routerOn &&
          typeof el.href === "string" &&
          el.href.startsWith("https://web.whatsapp.com/")
        ) {
          currentHref = el.href;
        }
        return !normalized.defaultPrevented;
      };
    }
    return el;
  };
  // href is live everywhere: reads reflect pushState; a hard assignment
  // either records via onNavigate (when supplied) or just moves the URL.
  Object.defineProperty(window.location, "href", {
    get() {
      return currentHref;
    },
    set(value) {
      currentHref = String(value);
      if (onNavigate) onNavigate(currentHref);
    },
    configurable: true,
  });
  // Simulate WhatsApp's router REJECTING the soft route: it never takes
  // the click (URL unchanged), which is the bridge's signal to give up on
  // the seamless path and hard-navigate instead.
  const simulateRouterRevert = () => {
    routerOn = false;
  };
  // A real browser exposes document ON window (watchShell and the drop
  // pipeline read window.document); mirror that before evaluating the bridge.
  window.document = document;
  const sandboxGlobals = {
    window,
    document,
    navigator: {},
    console: { log: (m) => logs.push(String(m)), error() {} },
    File: FakeFile,
    DataTransfer: FakeDataTransfer,
    Event: class {
      constructor(type, options = {}) {
        this.type = type;
        Object.assign(this, options);
      }
    },
    DragEvent: class {
      constructor(type, options = {}) {
        this.type = type;
        Object.assign(this, options);
      }
    },
    MutationObserver: class {
      observe() {}
    },
    localStorage: {
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(storage, key)
          ? storage[key]
          : null;
      },
    },
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    setTimeout,
    clearTimeout,
    // watchShell tracks its heartbeat through window.setInterval; real
    // timers so the interval can actually be cleared.
    setInterval,
    clearInterval,
  };
  // Evaluate bridge.js with our stubs shadowing the real globals.
  const params = Object.keys(sandboxGlobals);
  const fn = new Function(...params, `"use strict";\n${bridgeSrc}`);
  fn(...params.map((k) => sandboxGlobals[k]));
  return {
    window,
    document,
    mediaInput,
    docInput,
    logs,
    styles,
    windowOpenCalls,
    historyCalls,
    popstateEvents: () => popstateEvents,
    windowListeners,
    simulateRouterRevert,
    setRouter(on) {
      routerOn = on;
    },
    pickerAttempts: () => pickerAttempts,
    attachMenuClicks: () => attachMenuClicks,
    pressEscape() {
      const event = {
        key: "Escape",
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        stopPropagation() {},
        stopImmediatePropagation() {},
      };
      for (const listener of listeners.keydown || []) listener(event);
      return event.defaultPrevented;
    },
  };
}

// Drive the feed the way window.rs stream_drop does.
function feedFile(w, dropId, idx, name, type, content, { chunks = 1 } = {}) {
  const buf = Buffer.from(content);
  w.__whatsnowDropFeed({ op: "begin", drop: dropId, file: idx, name, type, size: buf.length });
  const per = Math.max(1, Math.ceil(buf.length / chunks));
  for (let off = 0; off < buf.length || (buf.length === 0 && off === 0); off += per) {
    const slice = buf.subarray(off, Math.min(off + per, buf.length));
    w.__whatsnowDropFeed({ op: "chunk", drop: dropId, file: idx, b64: slice.toString("base64") });
    if (buf.length === 0) break;
  }
  w.__whatsnowDropFeed({ op: "end", drop: dropId, file: idx });
}

// --- tests -------------------------------------------------------------------
async function testMixedDropLosesNothing() {
  console.log("mixed drop routes everything as documents (no silent loss)");
  const { window: w, mediaInput, docInput } = makeHarness();
  feedFile(w, 1, 0, "photo.jpg", "image/jpeg", "jpegbytes");
  feedFile(w, 1, 1, "report.pdf", "application/pdf", "pdfbytes");
  const ack = w.__whatsnowDropFeed({ op: "commit", drop: 1, files: 2 });
  assert(ack === "QUEUED:2", `commit acks both files (got ${ack})`);
  await sleep(30);
  assert(mediaInput.batches.length === 0, "media input untouched for a mixed drop");
  assert(docInput.batches.length === 1, "document input received one batch");
  const names = (docInput.batches[0] || []).map((f) => f.name).sort();
  assert(
    JSON.stringify(names) === JSON.stringify(["photo.jpg", "report.pdf"]),
    `both files attached (got ${names})`
  );
}

async function testPureMediaGoesToMediaInput() {
  console.log("pure media drop routes to the Photos & Videos input");
  const { window: w, mediaInput, docInput, attachMenuClicks } = makeHarness();
  feedFile(w, 2, 0, "clip.mp4", "video/mp4", "mp4bytes");
  w.__whatsnowDropFeed({ op: "commit", drop: 2, files: 1 });
  await sleep(30);
  assert(mediaInput.batches.length === 1, "media input received the video");
  assert(docInput.batches.length === 0, "document input untouched");
  assert(attachMenuClicks() === 0, "Attach menu was never opened");
}

async function testDistinctSameNamedFilesBothAttach() {
  console.log("distinct files sharing a name + header prefix both attach");
  const { window: w, mediaInput } = makeHarness();
  const header = "A".repeat(64); // identical first 18+ bytes — old dedupe dropped one
  feedFile(w, 3, 0, "same.mp4", "video/mp4", header + "-first");
  feedFile(w, 3, 1, "same.mp4", "video/mp4", header + "-second");
  const ack = w.__whatsnowDropFeed({ op: "commit", drop: 3, files: 2 });
  assert(ack === "QUEUED:2", `both distinct files queued (got ${ack})`);
  await sleep(30);
  assert(
    mediaInput.batches.length === 1 && mediaInput.batches[0].length === 2,
    "one change event carrying both files"
  );
}

async function testChunkReassemblyByteExact() {
  console.log("multi-chunk payload reassembles byte-for-byte");
  const { window: w, mediaInput } = makeHarness();
  const content = Buffer.alloc(10_000);
  for (let i = 0; i < content.length; i++) content[i] = (i * 31 + 7) & 0xff;
  feedFile(w, 4, 0, "big.mp4", "video/mp4", content, { chunks: 7 });
  w.__whatsnowDropFeed({ op: "commit", drop: 4, files: 1 });
  await sleep(30);
  const file = mediaInput.batches[0] && mediaInput.batches[0][0];
  assert(!!file, "file arrived");
  assert(file && file.size === content.length, "size preserved across chunks");
  assert(file && file.bytes().equals(content), "bytes identical after reassembly");
}

async function testIncompleteFileSkippedAbortHonored() {
  console.log("incomplete/aborted streams never produce a corrupt File");
  const { window: w, mediaInput, docInput } = makeHarness();
  // File 0: declared 100 bytes but only 10 sent (Rust died mid-stream) — no end op.
  w.__whatsnowDropFeed({ op: "begin", drop: 5, file: 0, name: "trunc.mp4", type: "video/mp4", size: 100 });
  w.__whatsnowDropFeed({ op: "chunk", drop: 5, file: 0, b64: b64("tenbytes!!") });
  // File 1: explicitly aborted by the sender.
  feedFile(w, 5, 1, "aborted.pdf", "application/pdf", "partial");
  w.__whatsnowDropFeed({ op: "abort", drop: 5, file: 1 });
  // File 2: healthy.
  feedFile(w, 5, 2, "good.pdf", "application/pdf", "gooddata");
  const ack = w.__whatsnowDropFeed({ op: "commit", drop: 5, files: 3 });
  assert(ack === "QUEUED:1", `only the complete file is queued (got ${ack})`);
  await sleep(30);
  const all = [...mediaInput.batches.flat(), ...docInput.batches.flat()].map((f) => f.name);
  assert(JSON.stringify(all) === JSON.stringify(["good.pdf"]), `only good.pdf attached (got ${all})`);
}

async function testSequentialDropsBothSurvive() {
  console.log("two back-to-back drops are queued, not overwritten");
  const { window: w, mediaInput } = makeHarness();
  feedFile(w, 6, 0, "first.mp4", "video/mp4", "one");
  w.__whatsnowDropFeed({ op: "commit", drop: 6, files: 1 });
  feedFile(w, 7, 0, "second.mp4", "video/mp4", "two");
  w.__whatsnowDropFeed({ op: "commit", drop: 7, files: 1 });
  // First drop's composer stays "open" ~80ms; the queue must hold drop #7 until
  // it closes, then inject — so wait past both cycles.
  await sleep(400);
  const seen = mediaInput.batches.map((b) => b.map((f) => f.name).join(","));
  assert(
    JSON.stringify(seen) === JSON.stringify(["first.mp4", "second.mp4"]),
    `both drops injected in order (got ${JSON.stringify(seen)})`
  );
}

async function testCommitWithoutDataAcksEmpty() {
  console.log("commit with no completed files acks EMPTY (Rust can toast)");
  const { window: w } = makeHarness();
  const ack = w.__whatsnowDropFeed({ op: "commit", drop: 8, files: 0 });
  assert(ack === "EMPTY", `empty commit acks EMPTY (got ${ack})`);
}

async function testMalformedMessagesAreRejected() {
  console.log("malformed feed messages are rejected without throwing");
  const { window: w } = makeHarness();
  assert(w.__whatsnowDropFeed(null) === "BADMSG", "null message");
  assert(w.__whatsnowDropFeed({ op: "chunk" }) === "BADMSG", "missing drop id");
  assert(
    w.__whatsnowDropFeed({ op: "chunk", drop: 9, file: 0, b64: "AA==" }) === "NOFILE",
    "chunk before begin"
  );
  assert(w.__whatsnowDropFeed({ op: "wat", drop: 9 }) === "BADOP", "unknown op");
}

async function testEscapeCancelsPendingDropWithoutAttachment() {
  console.log("Escape cancels a reserved transfer before it can disturb the active chat");
  const { window: w, mediaInput, docInput, pressEscape } = makeHarness();
  assert(
    w.__whatsnowDropFeed({ op: "reserve", drop: 11 }) === "RESERVED",
    "active chat is reserved before streaming"
  );
  feedFile(w, 11, 0, "cancelled.pdf", "application/pdf", "bytes");
  assert(pressEscape(), "pending-drop Escape is consumed by WhatsNow");
  const ack = w.__whatsnowDropFeed({ op: "commit", drop: 11, files: 1 });
  assert(ack === "CANCELLED", `cancelled transfer is acknowledged (got ${ack})`);
  await sleep(30);
  assert(
    mediaInput.batches.length === 0 && docInput.batches.length === 0,
    "cancelled transfer never reaches an attachment input"
  );
}

async function testUnreadProbeSupportsCurrentTitleFormats() {
  console.log("unread probe supports title and accessibility-label formats");
  const { window: w } = makeHarness();
  const probe = w.__whatsnowUnreadProbe;
  assert(probe.parse("(3) WhatsApp") === 3, "leading title count");
  assert(probe.parse("WhatsApp (12+)") === 12, "trailing title count");
  assert(probe.parse("7 unread messages") === 7, "accessible unread label");
  assert(probe.parse("Project (7)") === 0, "unrelated parentheses ignored");
}

async function testGroupAndCommunityNotificationDetails() {
  console.log("group and community notifications retain chat routing details");
  const { window: w } = makeHarness();
  const group = w.__whatsnowNotificationProbe.details("", {
    data: {
      groupName: "Project Team",
      message: "Mira: The report is ready",
      remoteJid: "1203630@g.us",
      messageId: "ABC123",
    },
  });
  assert(group.title === "Project Team", "group name becomes the preview title");
  assert(group.body === "Mira: The report is ready", "group sender preview is retained");
  assert(group.route.chatId === "1203630@g.us", "group chat id is retained");
  assert(group.route.messageId === "ABC123", "group message id is retained");

  const community = w.__whatsnowNotificationProbe.details("", {
    data: {
      communityName: "Research Community",
      text: "Announcements: Meeting at 10",
      conversationId: "community-42",
    },
  });
  assert(
    community.route.chatTitle === "Research Community",
    "community name becomes the click target"
  );
  assert(community.route.chatId === "community-42", "community id is retained");
  assert(
    w.__whatsnowNotificationProbe.remember(group, 10_000),
    "new message fingerprint is accepted once"
  );
  assert(
    !w.__whatsnowNotificationProbe.remember(group, 11_000),
    "the same previously handled message is not shown again"
  );
  const nextGroupMessage = w.__whatsnowNotificationProbe.details("", {
    body: "Mira: A different update",
    data: {
      groupName: "Project Team",
      remoteJid: "1203630@g.us",
      messageId: "ABC124",
    },
  });
  assert(
    w.__whatsnowNotificationProbe.remember(nextGroupMessage, 12_000),
    "a genuinely new message remains eligible"
  );
}

async function testToastRoutingAvoidsPageShellScrolling() {
  console.log("toast routing searches virtualized chats without scrolling the page shell");
  assert(
    bridgeSrc.includes("beginNotificationSearch(route.chatTitle)"),
    "off-screen sender chats use WhatsApp's chat search"
  );
  assert(
    bridgeSrc.includes("[role='listitem']"),
    "current WhatsApp chat-list rows are included"
  );
  const highlightSection = bridgeSrc.slice(
    bridgeSrc.indexOf("function highlightNotificationMessage"),
    bridgeSrc.indexOf("function currentConversationMatches")
  );
  assert(
    !highlightSection.includes("scrollIntoView"),
    "message highlighting cannot displace the header or composer"
  );
  assert(
    bridgeSrc.includes('element.scrollIntoView({ block: "nearest", inline: "nearest" })'),
    "trusted-click targeting scrolls only an off-screen chat row into view"
  );
  assert(
    bridgeSrc.includes("return new Promise(function (resolve)"),
    "toast routing reports completion before the account window is revealed"
  );
}

async function testProfileAndExternalLinkProbes() {
  console.log("profile-title and external-link probes validate narrow data");
  const { window: w } = makeHarness({
    storage: {
      "last-wid-md": '"628111:4@c.us"',
      WALid: '"100027@lid"',
    },
  });
  const probe = w.__whatsnowProfileProbe;
  assert(probe.normalize("  Ben  ") === "Ben", "profile name is normalized");
  assert(probe.normalize("WhatsApp") === "", "generic product label is rejected");
  assert(
    probe.fromRecord({ pushname: "Ben", name: "Fallback" }) === "Ben",
    "pushname is preferred from the self contact"
  );
  assert(
    JSON.stringify(probe.selfIds()) ===
      JSON.stringify(["628111@s.whatsapp.net", "100027@lid"]),
    "current phone and LID self identifiers are discovered"
  );
  assert(
    probe.externalWebLink("https://example.com/article") ===
      "https://example.com/article",
    "external https link is accepted"
  );
  assert(
    probe.externalWebLink("https://web.whatsapp.com/send/") === "",
    "WhatsApp navigation stays in the webview"
  );
  assert(probe.externalWebLink("file:///private.txt") === "", "file URL is rejected");
  // 2.6.0 link-routing extension: the user's eight hosts stay inside
  // WhatsNow too — they must NOT be classified as external browser links.
  for (const host of [
    "api.whatsapp.com",
    "www.whatsapp.com",
    "event.whatsapp.com",
    "call.whatsapp.com",
    "wa.me",
    "v.whatsapp.com",
    "whatsapp.com",
    "chat.whatsapp.com",
  ]) {
    assert(
      probe.externalWebLink(`https://${host}/x`) === "",
      `${host} is NOT an external-browser link`
    );
  }
  // Look-alike hosts are NOT family: they keep the browser flow.
  assert(
    probe.externalWebLink("https://web.whatsapp.com.evil.example.com/x") !== "",
    "look-alike host goes to the browser"
  );
  assert(
    probe.externalWebLink("https://faq.whatsapp.com/x") !== "",
    "unlisted subdomain keeps the browser flow"
  );
}

async function testWhatsAppFamilyLinksNeverReachTheBrowser() {
  console.log("WhatsApp-family link clicks stay inside WhatsNow");
  const navigations = [];
  const openedCommands = [];
  const h = makeHarness({
    onNavigate(url) {
      navigations.push(url);
    },
    invokeLog: openedCommands,
  });
  const w = h.window;
  const doc = h.document;
  // A wa.me share link clicked inside the chat with the number NOT in the
  // chat list: by the revert decision (2026-09-17) NOTHING further opens —
  // no popup, no window.open, no /send URL (live forensics 2026-09-17:
  // /send?phone always bounces home — no in-app route exists), and NEVER a
  // hard navigation of the chat surface.
  const waMe = doc.createElement("a");
  waMe.setAttribute("href", "https://wa.me/15551234567?text=hi");
  doc.body.appendChild(waMe);
  waMe.dispatchEvent(new w.Event("click", { bubbles: true, cancelable: true }));
  await sleep(4200);
  const openValues0 = h.windowOpenCalls.map((entry) => String(entry.value));
  assert(
    openValues0.length === 0,
    `wa.me click for an unknown number opens nothing (got ${JSON.stringify(openValues0)})`
  );
  assert(
    !openValues0.some((u) => u.startsWith("https://web.whatsapp.com/send")),
    "no /send URL is opened (proven live: it always bounces home)"
  );
  assert(
    navigations.length === 0,
    `wa.me click must NOT hard-navigate the chat surface (got ${JSON.stringify(navigations)})`
  );
  // A KNOWN number (row in the chat list): opened via a TRUSTED click on
  // the row — the same battle-tested mechanism as toast routing.
  const hKnown = makeHarness({
    invokeLog: openedCommands,
    chatListRows: [{ "data-id": "15550001111@c.us" }],
  });
  const rKnown = await hKnown.window.__whatsnowOpenChatByPhone("15550001111");
  assert(
    rKnown === "row",
    `known number opens via its chat row (got ${rKnown})`
  );
  // A chat.whatsapp.com invite link: content popup through window.open —
  // never in-chat navigation, never the browser.
  const invite = doc.createElement("a");
  invite.setAttribute("href", "https://chat.whatsapp.com/InviteCode");
  doc.body.appendChild(invite);
  invite.dispatchEvent(new w.Event("click", { bubbles: true, cancelable: true }));
  const openValuesInvite = h.windowOpenCalls.map((entry) => String(entry.value));
  assert(
    openValuesInvite.includes("https://chat.whatsapp.com/InviteCode"),
    `chat.whatsapp.com invite opens through window.open (got ${JSON.stringify(openValuesInvite)})`
  );
  // The popup request must be a PLAIN _blank (no "noopener" — this shell's
  // popup host never receives a noopener popup's URL; proven live).
  assert(
    h.windowOpenCalls.every(
      (entry) => !String(entry.features || "").includes("noopener"),
    ),
    "family popups are never requested with noopener"
  );
  // A call link: must reach the REAL window.open (Rust hosts it in the
  // dedicated call window) — never in-chat navigation, never the browser.
  // Snapshot the navigation bookkeeping first: the count above includes the
  // invite's document navigation and the fallback-case hard nav — the call
  // click itself must add NOTHING to it.
  const navCountBeforeCall = navigations.length;
  const call = doc.createElement("a");
  call.setAttribute("href", "https://call.whatsapp.com/stage123");
  doc.body.appendChild(call);
  call.dispatchEvent(new w.Event("click", { bubbles: true, cancelable: true }));
  const openValues = h.windowOpenCalls.map((entry) => String(entry.value));
  assert(
    openValues.includes("https://call.whatsapp.com/stage123"),
    `call click opens through window.open (got ${JSON.stringify(openValues)})`
  );
  assert(
    navigations.length === navCountBeforeCall,
    `call click never navigates the chat window (before: ${navCountBeforeCall}, after: ${navigations.length})`
  );
  assert(
    !openedCommands.some((entry) => entry.cmd === "open_external_url"),
    "call click never reaches the external-browser command"
  );
}

async function testExternalLinksStillReachTheBrowserCommand() {
  console.log("ordinary web links still open the user's browser");
  const opened = [];
  const { window: w, document: doc } = makeHarness({
    invokeLog: opened,
  });
  const link = doc.createElement("a");
  link.setAttribute("href", "https://example.com/article");
  doc.body.appendChild(link);
  link.dispatchEvent(new w.Event("click", { bubbles: true, cancelable: true }));
  assert(
    opened.some((entry) => entry.cmd === "open_external_url"),
    "example.com click still requests open_external_url"
  );
}

async function testOpenByPhoneRoutesRowOrNothing() {
  console.log(
    "open-by-phone: known number trusted-clicks its chat row; unknown deliberately does nothing"
  );
  // Source contract first (the live-app delivery path):
  assert(
    bridgeSrc.includes("__whatsnowOpenChatByPhone"),
    "the bridge exposes the open-by-phone entry point"
  );
  assert(
    !bridgeSrc.includes("api.whatsapp.com/send/?phone="),
    "no interstitial popup request is ever built (revert decision 2026-09-17)"
  );
  assert(
    bridgeSrc.includes('done("no-row")'),
    "unknown numbers resolve no-row: the app rose, nothing further happens"
  );

  // KNOWN number: the harness chat list carries a row whose data-id embeds
  // the digits; openChatByPhone must trusted-click it (notification_click)
  // and resolve "row".
  const clickedCommands = [];
  const h1 = makeHarness({
    invokeLog: clickedCommands,
    chatListRows: [{ "data-id": "6281234567890@c.us" }],
  });
  const r1 = await h1.window.__whatsnowOpenChatByPhone("6281234567890");
  assert(r1 === "row", `known number opens via its chat row (got ${r1})`);
  assert(
    clickedCommands.some((c) => c.cmd === "notification_click"),
    "the row is opened with a TRUSTED click, not a synthetic one"
  );

  // UNKNOWN number: no matching row exists → resolve "no-row" and open
  // NOTHING — no popup, no window.open, no navigation (deliberate revert:
  // no second-window quirks; the app has already risen and focused).
  const h2 = makeHarness({ invokeLog: [] });
  const r2 = await h2.window.__whatsnowOpenChatByPhone("628999999999");
  assert(r2 === "no-row", `unknown number resolves no-row (got ${r2})`);
  assert(
    h2.windowOpenCalls.length === 0,
    `unknown number opens nothing (got ${JSON.stringify(
      h2.windowOpenCalls.map((e) => String(e.value))
    )})`
  );

  // Garbage input fails loudly but safely.
  const h3 = makeHarness({ invokeLog: [] });
  const r3 = await h3.window.__whatsnowOpenChatByPhone("");
  assert(r3 === "failed", "empty phone resolves failed without opening anything");
  assert(h3.windowOpenCalls.length === 0, "empty phone opens nothing");
}

async function testOfficialAppPromoProbeIsNarrow() {
  console.log("official-app promotion probe ignores ordinary downloads");
  const { window: w } = makeHarness();
  const promo = {
    textContent: "Download WhatsApp for Windows",
    getAttribute() {
      return "";
    },
    querySelector() {
      return null;
    },
  };
  const attachment = {
    textContent: "Download report.pdf",
    getAttribute() {
      return "https://web.whatsapp.com/download/report.pdf";
    },
    querySelector() {
      return null;
    },
  };
  assert(w.__whatsnowPromoProbe.matches(promo), "official-app prompt is recognized");
  assert(
    !w.__whatsnowPromoProbe.matches(attachment),
    "ordinary attachment download remains visible"
  );
}

async function testThemeEmojiSurfacesKeepWhatsAppScheme() {
  console.log("emoji surfaces keep WhatsApp's own color scheme in every theme");
  const { styles } = makeHarness();
  const emojiStyle = styles.find((s) => s.id === "whatsnow-emoji-scheme");
  assert(
    Boolean(emojiStyle),
    "emoji scheme protection stylesheet is installed at boot",
  );
  assert(
    emojiStyle.textContent.includes("[data-testid*='emoji']") &&
      emojiStyle.textContent.includes("color-scheme: light dark !important"),
    "emoji surfaces opt back into WhatsApp's natural color scheme",
  );
  assert(
    emojiStyle.textContent.includes(
      "[data-testid='conversation-compose-box-input']",
    ),
    "composer input is protected too",
  );
  const doodleStyle = styles.find(
    (s) => s.id === "whatsnow-no-wallpaper-doodles",
  );
  assert(
    Boolean(doodleStyle) &&
      doodleStyle.textContent.includes(":not([data-testid*='emoji'])") &&
      doodleStyle.textContent.includes(":not([data-testid*='compose'])") &&
      doodleStyle.textContent.includes(":not([style*='/emoji/'])") &&
      doodleStyle.textContent.includes(":not([class*='emoji'])"),
    "wallpaper blanket bypass never wipes emoji/compose/emoji-sprite surfaces",
  );
  // WhatsApp 2.24xx+ paints the default doodle wallpaper as a CSS mask on
  // [data-testid*='conversation-background'] (inline mask-image SVG pattern
  // over a translucent tint), not as a background-image. Personality themes
  // must drop that mask layer or the doodle pattern keeps showing through
  // (visible on dark palettes and while the Reply bar slides up).
  assert(
    Boolean(doodleStyle) &&
      doodleStyle.textContent.includes(
        "[data-testid*='conversation-background']",
      ) &&
      doodleStyle.textContent.includes("mask-image: none !important") &&
      doodleStyle.textContent.includes("-webkit-mask-image: none !important"),
    "doodle mask layer (conversation-background) is neutralized on personality themes",
  );
  assert(
    Boolean(doodleStyle) &&
      doodleStyle.textContent.includes(
        "#main [style*='mask-image']:not([style*='/emoji/']):not([class*='emoji'])",
      ),
    "future inline mask layers lose only their mask, never emoji/compose surfaces",
  );
  // WhatsApp renamed the composer container from conversation-compose-box-
  // container to compose-box; the kill switch must cover both so the Reply
  // preview bar (which slides up like a curtain) can never flash the
  // wallpaper behind it.
  assert(
    Boolean(doodleStyle) &&
      doodleStyle.textContent.includes(
        "[data-testid='conversation-compose-box-container']",
      ) &&
      doodleStyle.textContent.includes("[data-testid='compose-box']"),
    "composer kill-switch covers legacy and current compose-box testids",
  );
}

async function testDoodlePreferenceBootOnlyWrites() {
  console.log("doodle preference writes ONLY at boot for official themes; never reloads");
  const values = {
    preference: JSON.stringify([
      {
        id: "defaultPreference",
        showDoodle: false,
        wallpaperValue: { type: "default", isDoodleEnabled: false },
      },
    ]),
  };
  const makeStore = () => ({
    get length() {
      return Object.keys(values).length;
    },
    key(index) {
      return Object.keys(values)[index] ?? null;
    },
    getItem(key) {
      return values[key] ?? null;
    },
    setItem(key, value) {
      values[key] = value;
    },
  });
  // Boot (readyState "loading") + official theme: forces showDoodle:true so
  // WhatsApp renders its doodle wallpaper during its own startup.
  const boot = makeHarness({ readyState: "loading" });
  boot.window.localStorage = makeStore();
  assert(boot.window.__whatsnowDoodleSyncProbe.setStored(true), "boot record found");
  let updated = JSON.parse(values.preference)[0];
  assert(updated.showDoodle === true, "official theme forces showDoodle:true at boot");
  assert(
    updated.wallpaperValue.isDoodleEnabled === true,
    "official wallpaper state is restored at boot"
  );
  // Personality themes NEVER disable the preference — the CSS kill switch is
  // the enforcement; the record stays true (even a false record gets forced
  // true at boot) so a later live switch into Dark/Light shows doodles
  // instantly without any reload.
  assert(boot.window.__whatsnowDoodleSyncProbe.setStored(false), "disable path found");
  updated = JSON.parse(values.preference)[0];
  assert(updated.showDoodle === true, "the preference is never disabled (kill switch only)");
  // A live page (readyState "complete") NEVER writes either — theme switches
  // are instant attribute/CSS flips, no reload, no storage writes.
  const live = makeHarness();
  live.window.localStorage = makeStore();
  values.preference = JSON.stringify([
    {
      id: "defaultPreference",
      showDoodle: false,
      wallpaperValue: { type: "default", isDoodleEnabled: false },
    },
  ]);
  assert(live.window.__whatsnowDoodleSyncProbe.setStored(true), "live record found");
  updated = JSON.parse(values.preference)[0];
  assert(updated.showDoodle === false, "live pages never write the preference");
  // Hard guarantees: no reload calls, no StorageEvent dispatch anywhere.
  assert(
    !/location\.reload|prepare_theme_reload/.test(bridgeSrc),
    "theme switches never reload the page"
  );
  assert(
    !/StorageEvent/.test(bridgeSrc),
    "the preference write never constructs a StorageEvent"
  );
  assert(
    !/#main footer/.test(bridgeSrc),
    "doodle suppression never touches WhatsApp's composer"
  );
  assert(
    !/navigateToNativeDoodleControl|opened You|opened Wallpaper settings/.test(bridgeSrc),
    "doodle changes never navigate through WhatsApp settings"
  );
}

async function testNotificationWarmupSuppressesRestoredHistory() {
  console.log("notification warmup suppresses WhatsApp session-restoration history");
  const { window: w } = makeHarness();
  const probe = w.__whatsnowNotificationProbe;
  const now = Date.now();
  assert(!probe.isArmed(now), "startup notification replay is suppressed");
  assert(probe.isArmed(now + 13000), "new notifications are enabled after hydration");
}

async function testDropFallbackNeverOpensNativePicker() {
  console.log("lazy attachment input mounts without opening the native picker");
  const { window: w, docInput, pickerAttempts } = makeHarness({
    inputsInitiallyMounted: false,
    directDropSupported: false,
  });
  feedFile(w, 10, 0, "report.pdf", "application/pdf", "pdfbytes");
  w.__whatsnowDropFeed({ op: "commit", drop: 10, files: 1 });
  await sleep(2400);
  assert(pickerAttempts() === 0, "native file picker remained suppressed");
  assert(docInput.batches.length === 1, "WhatsApp confirmation composer received the file");
}

async function testPromoSweepIsCoalescedAndSurvivesEarlyInit() {
  console.log("promo sweep is coalesced and its observer survives early init");
  // The MutationObserver must watch `document`, never documentElement:
  // embedder initialization scripts can run BEFORE <html> is parsed, and an
  // observer rooted at the not-yet-existing documentElement silently never
  // receives records for the page's whole life (verified in Chromium via the
  // Playwright smoke test). `document` exists at every script phase.
  assert(
    /new MutationObserver\(schedulePromoSweep\)\.observe\(document\s*,/.test(bridgeSrc),
    "promo observer is rooted at `document` (phase-proof against early init)",
  );
  assert(
    !/MutationObserver\(schedulePromoSweep\)\.observe\(document\.documentElement/.test(bridgeSrc),
    "promo observer is never rooted at documentElement",
  );
  // The sweep must run on the FIRST mutation (leading edge) so a fresh promo
  // card is hidden synchronously even in environments that drop observer
  // records, and absorb the rest of a mutation storm behind one timer.
  assert(
    /var promoSweepPending = false;[\s\S]*?if \(promoSweepPending\) return;[\s\S]*?promoSweepPending = true;[\s\S]*?hideOfficialAppPromos\(\);/.test(
      bridgeSrc,
    ),
    "first mutation sweeps immediately; remaining storm is coalesced",
  );
  assert(
    /setTimeout\(function \(\) \{[\s\S]*?promoSweepPending = false;[\s\S]*?hideOfficialAppPromos\(\);[\s\S]*?\}, 400\);/.test(
      bridgeSrc,
    ),
    "one trailing-edge sweep settles the window (~400 ms)",
  );
}

const tests = [
  testMixedDropLosesNothing,
  testPureMediaGoesToMediaInput,
  testDistinctSameNamedFilesBothAttach,
  testChunkReassemblyByteExact,
  testIncompleteFileSkippedAbortHonored,
  testSequentialDropsBothSurvive,
  testCommitWithoutDataAcksEmpty,
  testEscapeCancelsPendingDropWithoutAttachment,
  testMalformedMessagesAreRejected,
  testUnreadProbeSupportsCurrentTitleFormats,
  testGroupAndCommunityNotificationDetails,
  testToastRoutingAvoidsPageShellScrolling,
  testProfileAndExternalLinkProbes,
  testWhatsAppFamilyLinksNeverReachTheBrowser,
  testExternalLinksStillReachTheBrowserCommand,
  testOfficialAppPromoProbeIsNarrow,
  testThemeEmojiSurfacesKeepWhatsAppScheme,
  testDoodlePreferenceBootOnlyWrites,
  testNotificationWarmupSuppressesRestoredHistory,
  testDropFallbackNeverOpensNativePicker,
  testPromoSweepIsCoalescedAndSurvivesEarlyInit,
  testOpenByPhoneRoutesRowOrNothing,
];

for (const t of tests) {
  await t();
}
if (failures > 0) {
  console.error(`\n${failures} assertion(s) FAILED`);
  process.exit(1);
}
console.log("\nall bridge drop tests passed");
process.exit(0);
