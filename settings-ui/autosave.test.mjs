// WhatsNow — authored and maintained solely by @benedictusrey.
// Instant-apply saving: queued ordering, debounce, and the load-error gate.
// Run: node settings-ui/autosave.test.mjs   (exit non-zero on failure)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
(0, eval)(readFileSync(join(here, "autosave.js"), "utf8"));
const { create } = globalThis.WhatsNowAutosave;

class FakeTimers {
  constructor() {
    this.now = 0;
    this.next = 1;
    this.jobs = new Map();
  }
  setTimeout = (fn, ms) => {
    const id = this.next++;
    this.jobs.set(id, { at: this.now + ms, fn });
    return id;
  };
  clearTimeout = (id) => {
    this.jobs.delete(id);
  };
  advance(ms) {
    const end = this.now + ms;
    for (;;) {
      const due = [...this.jobs.entries()]
        .filter(([, job]) => job.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      this.now = due[1].at;
      this.jobs.delete(due[0]);
      due[1].fn();
    }
    this.now = end;
  }
}

// An async IPC stand-in: every call takes a few microtask turns so interleaving
// between queued saves would be visible in the log.
function fakeIpc({ failSet = 0, failGet = false } = {}) {
  const log = [];
  let stored = { theme: "system", notifications: true, hotkey: "Alt+W", focus_until_epoch_secs: 99 };
  let setFailures = failSet;
  const tick = async () => {
    for (let i = 0; i < 4; i++) await Promise.resolve();
  };
  return {
    log,
    stored: () => stored,
    setGetFails(value) {
      failGet = value;
    },
    async invoke(command, args) {
      log.push(command === "set_settings" ? `set:${JSON.stringify(args.settings)}` : command);
      await tick();
      if (command === "get_settings") {
        if (failGet) throw new Error("settings file unreadable");
        return { ...stored };
      }
      if (command === "set_settings") {
        if (setFailures > 0) {
          setFailures -= 1;
          throw new Error("disk is full");
        }
        stored = { ...args.settings };
        return null;
      }
      throw new Error("unexpected " + command);
    },
  };
}

function harness(options = {}) {
  const timers = new FakeTimers();
  const ipc = fakeIpc(options);
  const statuses = [];
  const loadStates = [];
  const autosave = create({
    invoke: ipc.invoke,
    onStatus: (status) => statuses.push(status),
    onLoadState: (state) => loadStates.push(state),
    setTimeoutFn: timers.setTimeout,
    clearTimeoutFn: timers.clearTimeout,
  });
  return { autosave, ipc, timers, statuses, loadStates };
}

async function ready(h) {
  assert.equal(await h.autosave.load(() => {}), true);
  h.ipc.log.length = 0;
  h.statuses.length = 0;
}

// 1. A patch only changes the fields it names.
{
  const h = harness();
  await ready(h);
  await h.autosave.queue({ notifications: false });
  assert.deepEqual(h.ipc.log, [
    "get_settings",
    'set:{"theme":"system","notifications":false,"hotkey":"Alt+W","focus_until_epoch_secs":99}',
  ]);
  assert.deepEqual(
    h.statuses.map((s) => s.state),
    ["saving", "saved"],
  );
  console.log("ok   patch merges into the latest settings and reports Saving then Saved");
}

// 2. Queued saves run strictly one after another, in order.
{
  const h = harness();
  await ready(h);
  const a = h.autosave.queue({ theme: "light" });
  const b = h.autosave.queue({ notifications: false });
  await Promise.all([a, b]);
  assert.deepEqual(
    h.ipc.log.map((entry) => entry.split(":")[0]),
    ["get_settings", "set", "get_settings", "set"],
  );
  assert.equal(h.ipc.stored().theme, "light", "first patch survives the second save");
  assert.equal(h.ipc.stored().notifications, false);
  console.log("ok   queued saves never interleave and keep each other's fields");
}

// 3. Number/text inputs debounce 400 ms into ONE save with the merged patch.
{
  const h = harness();
  await ready(h);
  h.autosave.queue({ notification_preview_duration_secs: 3 }, { debounce: true });
  h.timers.advance(300);
  h.autosave.queue({ notification_preview_duration_secs: 5 }, { debounce: true });
  h.timers.advance(399);
  assert.equal(h.ipc.log.length, 0, "nothing is saved before the debounce elapses");
  assert.ok(h.autosave.hasPending());
  h.timers.advance(1);
  await h.autosave.flush();
  assert.equal(h.ipc.log.filter((entry) => entry.startsWith("set:")).length, 1);
  assert.equal(h.ipc.stored().notification_preview_duration_secs, 5);
  console.log("ok   typing is debounced by 400 ms into a single save");
}

// 4. A failed load keeps every control from writing defaults.
{
  const h = harness({ failGet: true });
  assert.equal(await h.autosave.load(() => assert.fail("must not apply defaults")), false);
  assert.equal(h.autosave.isDisabled(), true);
  assert.equal(h.loadStates.at(-1).ok, false);
  await h.autosave.queue({ notifications: false });
  h.autosave.queue({ hotkey: "Ctrl+Q" }, { debounce: true });
  h.timers.advance(1000);
  await h.autosave.flush();
  assert.equal(h.ipc.log.filter((entry) => entry.startsWith("set:")).length, 0);
  h.ipc.setGetFails(false);
  assert.equal(await h.autosave.load(() => {}), true);
  assert.equal(h.autosave.isDisabled(), false);
  assert.equal(h.loadStates.at(-1).ok, true);
  console.log("ok   controls stay disabled after a load error until a retry succeeds");
}

// 5. Errors surface, Retry re-sends, and a failed field never poisons later saves.
{
  const h = harness({ failSet: 1 });
  await ready(h);
  await h.autosave.queue({ hotkey: "Ctrl+Banana" });
  const error = h.statuses.find((s) => s.state === "error");
  assert.ok(error && /disk is full/.test(error.message));
  assert.deepEqual(error.patch, { hotkey: "Ctrl+Banana" });
  await h.autosave.queue({ notifications: false });
  assert.equal(h.ipc.stored().notifications, false);
  assert.equal(h.ipc.stored().hotkey, "Alt+W", "a failed hotkey is not re-sent by the next save");
  await h.autosave.retry();
  assert.equal(h.ipc.stored().hotkey, "Ctrl+Banana", "Retry sends the failed patch again");
  console.log("ok   failures report an error and Retry re-sends only the failed patch");
}

// 6. The Saved pill fades back to idle.
{
  const h = harness();
  await ready(h);
  await h.autosave.queue({ notifications: false });
  h.timers.advance(1600);
  assert.equal(h.statuses.at(-1).state, "idle");
  console.log("ok   Saved fades out after 1.6 seconds");
}

console.log("all autosave tests passed");
