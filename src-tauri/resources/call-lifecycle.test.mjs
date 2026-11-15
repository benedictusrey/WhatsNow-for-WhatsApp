// WhatsNow call window lifecycle regressions, maintained by @benedictusrey.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("./call-lifecycle.js", import.meta.url), "utf8");

// A tiny fake DOM and a manual clock: enough to drive
// the watcher without a browser.
function harness({ hostname = "call.whatsapp.com", pathname = "/ABC" } = {}) {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  const closes = [];
  const observers = [];
  const state = { content: false };

  const makeElement = () => ({
    style: { cssText: "" },
    children: [],
    attrs: {},
    removed: false,
    animated: false,
    setAttribute(name, value) { this.attrs[name] = value; },
    appendChild(child) { this.children.push(child); return child; },
    remove() { this.removed = true; },
    animate() { this.animated = true; },
  });
  const documentElement = makeElement();
  const document = {
    documentElement,
    body: { querySelector: () => (state.content ? {} : null) },
    createElement: makeElement,
  };

  const window = {
    setTimeout(fn, ms) { const id = nextId++; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    close() { closes.push(now); },
    document,
    MutationObserver: class { constructor(cb) { observers.push(cb); } observe() {} },
    matchMedia: () => ({ matches: false }),
  };
  vm.runInNewContext(source, {
    window,
    location: { protocol: "https:", hostname, pathname },
  });

  const advance = (ms) => {
    const end = now + ms;
    for (;;) {
      let next = null;
      for (const [id, timer] of timers) {
        if (timer.at <= end && (!next || timer.at < next.timer.at)) next = { id, timer };
      }
      if (!next) break;
      timers.delete(next.id);
      now = next.timer.at;
      next.timer.fn();
    }
    now = end;
  };
  const splash = () => documentElement.children.find((c) => c.id === "whatsnow-call-splash");
  return { window, document, state, closes, observers, advance, splash };
}

// Non-call pages are never touched.
for (const options of [
  { hostname: "web.whatsapp.com", pathname: "/" },
  { hostname: "web.whatsapp.com", pathname: "/callback" },
  { hostname: "web.whatsapp.com.evil.example", pathname: "/call" },
  { hostname: "faq.whatsapp.com", pathname: "/" },
]) {
  const h = harness(options);
  assert.equal(h.window.__whatsnowCallLifecycle, undefined, `${options.hostname}${options.pathname} ignored`);
  assert.equal(h.splash(), undefined);
}
for (const options of [
  { hostname: "call.whatsapp.com", pathname: "/ABC" },
  { hostname: "web.whatsapp.com", pathname: "/call" },
  { hostname: "web.whatsapp.com", pathname: "/call/ABC" },
]) {
  assert.ok(harness(options).window.__whatsnowCallLifecycle, `${options.hostname}${options.pathname} watched`);
}

// Splash: shown at document start, removed once the call UI paints.
{
  const h = harness();
  const splash = h.splash();
  assert.ok(splash, "a connecting frame is shown immediately");
  assert.equal(splash.attrs.role, "status");
  assert.match(splash.style.cssText, /pointer-events:none/, "the splash never blocks input");
  assert.ok(splash.children[0].animated, "the spinner animates");
  h.advance(1000);
  assert.ok(!splash.removed, "kept while the page is still empty");
  h.state.content = true;
  h.observers[0]();
  h.advance(300);
  h.advance(300);
  assert.ok(splash.removed, "removed after the call UI paints");
  assert.equal(h.closes.length, 0);
}
// Splash safety timeout when content detection never matches.
{
  const h = harness();
  h.advance(10_000 + 300);
  assert.ok(h.splash() === undefined || h.splash().removed, "splash is never left behind");
}

// Peer connections are never wrapped or touched.
{
  const h = harness();
  assert.equal(h.window.RTCPeerConnection, undefined);
  assert.equal(Object.keys(h.window).includes("RTCPeerConnection"), false);
}

// Blank guard: UI that appeared and then vanished closes the window.
{
  const h = harness();
  h.state.content = true;
  h.observers[0]();
  h.advance(300);
  assert.equal(h.window.__whatsnowCallLifecycle.state().populated, true);
  h.state.content = false;
  h.observers[0]();
  h.advance(300);
  h.advance(2300);
  assert.equal(h.closes.length, 0, "blank must persist before closing");
  h.advance(400);
  assert.equal(h.closes.length, 1, "blank call window closes");
}
// A page that was never populated is left alone (still loading).
{
  const h = harness();
  h.advance(60_000);
  assert.equal(h.closes.length, 0);
}
// UI that comes back inside the delay cancels the close.
{
  const h = harness();
  h.state.content = true;
  h.observers[0]();
  h.advance(300);
  h.state.content = false;
  h.observers[0]();
  h.advance(300);
  h.advance(1000);
  h.state.content = true;
  h.observers[0]();
  h.advance(300);
  h.advance(10_000);
  assert.equal(h.closes.length, 0);
}

console.log("Call window lifecycle regressions passed.");
