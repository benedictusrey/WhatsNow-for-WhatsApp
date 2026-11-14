// WhatsNow — authored and maintained solely by @benedictusrey.
// Idle auto-close for the Settings pop-up: it still closes after 30 seconds
// without interaction, but never while something is holding it open (pointer
// over the window, a dialog, the shortcut recorder, a running password or
// biometric command, or the window being hidden by the app lock). Every change
// saves instantly, so a close can never lose work. No DOM access; the page
// wires the events and tests drive it with fake timers.
(function initWhatsNowIdleClose(root) {
  "use strict";

  function create(options) {
    const idleMs = options.idleMs ?? 30000;
    const onIdle = options.onIdle;
    const setTimer = options.setTimeoutFn || setTimeout;
    const clearTimer = options.clearTimeoutFn || clearTimeout;
    const reasons = new Set();
    let timer = null;

    function clear() {
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
    }

    function arm() {
      clear();
      if (reasons.size > 0) return;
      timer = setTimer(() => {
        timer = null;
        if (reasons.size === 0) onIdle();
      }, idleMs);
    }

    return {
      // First arming at page start, and every user interaction.
      activity() {
        if (reasons.size === 0) arm();
      },
      pause(reason) {
        reasons.add(reason);
        clear();
      },
      // Resuming the last reason starts a FULL idle period again.
      resume(reason) {
        if (reasons.delete(reason) && reasons.size === 0) arm();
      },
      isPaused: () => reasons.size > 0,
      reasons: () => Array.from(reasons),
    };
  }

  root.WhatsNowIdleClose = Object.freeze({ create });
})(globalThis);
