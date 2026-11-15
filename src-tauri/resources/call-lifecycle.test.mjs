// WhatsNow call window lifecycle regressions, maintained by @benedictusrey.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("./call-lifecycle.js", import.meta.url), "utf8");

// A tiny fake DOM, a manual clock and a fake RTCPeerConnection: enough to drive
// the watcher without a browser.
function harness({ hostname = "call.whatsapp.com", pathname = "/ABC", withRtc = true } = {}) {
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

  class FakePeerConnection {
    constructor() {
      this.connectionState = "new";
      this.listeners = {};
      FakePeerConnection.created.push(this);
    }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    emit(type) { for (const fn of this.listeners[type] || []) fn(); }
    setState(value) { this.connectionState = value; this.emit("connectionstatechange"); }
    close() { this.connectionState = "closed"; }
  }
  FakePeerConnection.created = [];

  const window = {
    setTimeout(fn, ms) { const id = nextId++; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    close() { closes.push(now); },
    document,
    MutationObserver: class { constructor(cb) { observers.push(cb); } observe() {} },
    matchMedia: () => ({ matches: false }),
    RTCPeerConnection: withRtc ? FakePeerConnection : undefined,
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
  return { window, document, state, closes, observers, advance, splash, FakePeerConnection };
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
  assert.equal(h.window.RTCPeerConnection, h.FakePeerConnection, "peer connections untouched");
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
  h.advance(15_000 + 300);
  assert.ok(h.splash() === undefined || h.splash().removed, "splash is never left behind");
}

// A finished call closes the window; hang-up by either side ends in a close.
{
  const h = harness();
  const [pc] = [new h.window.RTCPeerConnection()];
  assert.equal(h.window.RTCPeerConnection.prototype instanceof h.FakePeerConnection, true);
  assert.ok(pc instanceof h.FakePeerConnection, "instanceof checks keep working");
  h.advance(10_000);
  assert.equal(h.closes.length, 0, "no close before a call is established");
  pc.setState("connected");
  h.advance(60_000);
  assert.equal(h.closes.length, 0, "a live call is never closed");
  pc.setState("disconnected");
  h.advance(60_000);
  assert.equal(h.closes.length, 0, "a network blip does not end the call");
  pc.setState("closed");
  h.advance(1400);
  assert.equal(h.closes.length, 0, "short grace period first");
  h.advance(200);
  assert.equal(h.closes.length, 1, "closed after the last connection ends");
}
// close() fires no state event, so it is observed directly.
{
  const h = harness();
  const pc = new h.window.RTCPeerConnection();
  pc.setState("connected");
  pc.close();
  h.advance(1600);
  assert.equal(h.closes.length, 1);
}
// A replacement connection inside the grace period keeps the call open.
{
  const h = harness();
  const first = new h.window.RTCPeerConnection();
  first.setState("connected");
  first.setState("closed");
  h.advance(500);
  const second = new h.window.RTCPeerConnection();
  second.setState("connected");
  h.advance(10_000);
  assert.equal(h.closes.length, 0, "reconnects are not mistaken for the end");
  second.setState("closed");
  h.advance(1600);
  assert.equal(h.closes.length, 1);
}
// One of several connections closing never ends the call.
{
  const h = harness();
  const a = new h.window.RTCPeerConnection();
  const b = new h.window.RTCPeerConnection();
  a.setState("connected");
  b.setState("connected");
  a.setState("closed");
  h.advance(10_000);
  assert.equal(h.closes.length, 0);
  b.setState("failed");
  h.advance(5000);
  assert.equal(h.closes.length, 0, "failed gets a longer grace period for a retry");
  h.advance(1100);
  assert.equal(h.closes.length, 1);
}
// A connection that never connected (lobby/preview) does not close the window.
{
  const h = harness();
  const pc = new h.window.RTCPeerConnection();
  pc.close();
  h.advance(30_000);
  assert.equal(h.closes.length, 0);
}

// Blank guard: UI that appeared and then vanished closes the window.
{
  const h = harness({ withRtc: false });
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
  const h = harness({ withRtc: false });
  h.advance(60_000);
  assert.equal(h.closes.length, 0);
}
// UI that comes back inside the delay cancels the close.
{
  const h = harness({ withRtc: false });
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
