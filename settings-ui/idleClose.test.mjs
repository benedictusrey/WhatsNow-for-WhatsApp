// WhatsNow — authored and maintained solely by @benedictusrey.
// Settings idle auto-close: still 30 seconds, but paused while anything holds
// the window open. Run: node settings-ui/idleClose.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
(0, eval)(readFileSync(join(here, "idleClose.js"), "utf8"));
const { create } = globalThis.WhatsNowIdleClose;

function setup() {
  let now = 0;
  let next = 1;
  const jobs = new Map();
  let closed = 0;
  const idle = create({
    idleMs: 30000,
    onIdle: () => {
      closed += 1;
    },
    setTimeoutFn: (fn, ms) => {
      const id = next++;
      jobs.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeoutFn: (id) => jobs.delete(id),
  });
  const advance = (ms) => {
    const end = now + ms;
    for (;;) {
      const due = [...jobs.entries()].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      now = due[1].at;
      jobs.delete(due[0]);
      due[1].fn();
    }
    now = end;
  };
  return { idle, advance, closed: () => closed };
}

// Closes after 30 idle seconds, and any interaction restarts the period.
{
  const t = setup();
  t.idle.activity();
  t.advance(29999);
  assert.equal(t.closed(), 0);
  t.idle.activity();
  t.advance(29999);
  assert.equal(t.closed(), 0, "activity restarted the full 30 seconds");
  t.advance(1);
  assert.equal(t.closed(), 1);
  console.log("ok   closes after 30 idle seconds; activity resets the clock");
}

// Pointer over the window pauses it; leaving starts a FULL period again.
{
  const t = setup();
  t.idle.activity();
  t.idle.pause("pointer");
  t.advance(10 * 60 * 1000);
  assert.equal(t.closed(), 0, "never closes while the pointer is over the window");
  t.idle.activity();
  t.advance(60000);
  assert.equal(t.closed(), 0, "activity while paused does not re-arm the timer");
  t.idle.resume("pointer");
  t.advance(29999);
  assert.equal(t.closed(), 0);
  t.advance(1);
  assert.equal(t.closed(), 1);
  console.log("ok   pointer hover pauses; leaving restarts a full period");
}

// Dialog, recorder and busy commands each hold the window open on their own.
{
  const t = setup();
  t.idle.activity();
  for (const reason of ["dialog", "recorder", "busy"]) {
    t.idle.pause(reason);
  }
  t.advance(120000);
  assert.equal(t.closed(), 0);
  t.idle.resume("dialog");
  t.idle.resume("recorder");
  t.advance(120000);
  assert.equal(t.closed(), 0, "still held by the running command");
  assert.deepEqual(t.idle.reasons(), ["busy"]);
  t.idle.resume("busy");
  t.advance(30000);
  assert.equal(t.closed(), 1);
  console.log("ok   dialog, recorder and in-flight commands pause independently");
}

// Hidden by the app lock: paused, then a fresh full period once shown again.
{
  const t = setup();
  t.idle.activity();
  t.idle.pause("hidden");
  t.advance(5 * 60 * 1000);
  assert.equal(t.closed(), 0, "a window hidden by the lock is not closed");
  t.idle.resume("hidden");
  t.advance(29999);
  assert.equal(t.closed(), 0, "timer restarts when the window is shown again");
  t.advance(1);
  assert.equal(t.closed(), 1);
  console.log("ok   hidden-by-lock pauses and resumes with a full period");
}

// Resuming a reason that was never paused changes nothing.
{
  const t = setup();
  t.idle.resume("dialog");
  t.advance(120000);
  assert.equal(t.closed(), 0, "an unarmed timer stays unarmed");
  t.idle.activity();
  t.advance(30000);
  assert.equal(t.closed(), 1);
  console.log("ok   resuming an unknown reason is harmless");
}

console.log("all idle-close tests passed");
