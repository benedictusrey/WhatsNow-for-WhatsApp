// WhatsNow — authored and maintained solely by @benedictusrey.
// Instant-apply saving for the Settings window. Every control calls `queue`;
// one promise chain performs get -> merge -> set so saves never interleave and a
// patch only ever overwrites the fields it names. No DOM access: the page wires
// `onStatus` / `onLoadState`, and tests drive it with a fake `invoke`.
(function initWhatsNowAutosave(root) {
  "use strict";

  function create(options) {
    const invoke = options.invoke;
    const onStatus = options.onStatus || function () {};
    const onLoadState = options.onLoadState || function () {};
    const debounceMs = options.debounceMs ?? 400;
    const savedFadeMs = options.savedFadeMs ?? 1600;
    const setTimer = options.setTimeoutFn || setTimeout;
    const clearTimer = options.clearTimeoutFn || clearTimeout;

    let pending = {};
    let timer = null;
    let chain = Promise.resolve();
    let disabled = true; // nothing is saved until settings have loaded once
    let failedPatch = null;
    let fadeTimer = null;
    let generation = 0;

    function hasKeys(object) {
      return Object.keys(object).length > 0;
    }

    function runSave(patch) {
      const mine = ++generation;
      if (fadeTimer !== null) {
        clearTimer(fadeTimer);
        fadeTimer = null;
      }
      onStatus({ state: "saving" });
      return (async () => {
        try {
          const current = await invoke("get_settings");
          const warning = await invoke("set_settings", {
            settings: { ...current, ...patch },
          });
          // Fields saved now supersede any earlier failure of the same field;
          // other failed fields stay available for Retry.
          if (failedPatch) {
            const remaining = { ...failedPatch };
            for (const key of Object.keys(patch)) delete remaining[key];
            failedPatch = hasKeys(remaining) ? remaining : null;
          }
          onStatus({ state: "saved", warning: warning || "", patch });
          fadeTimer = setTimer(() => {
            fadeTimer = null;
            if (generation === mine) onStatus({ state: "idle" });
          }, savedFadeMs);
        } catch (error) {
          failedPatch = { ...(failedPatch || {}), ...patch };
          onStatus({ state: "error", message: String(error), patch });
        }
      })();
    }

    function flush() {
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
      if (!hasKeys(pending)) return chain;
      const patch = pending;
      pending = {};
      chain = chain.then(() => runSave(patch));
      return chain;
    }

    // Checkboxes, radios and buttons save at once; number/text inputs pass
    // `debounce: true` so typing does not save on every keystroke.
    function queue(patch, queueOptions) {
      if (disabled) return chain;
      pending = { ...pending, ...patch };
      if (queueOptions && queueOptions.debounce) {
        if (timer !== null) clearTimer(timer);
        onStatus({ state: "pending" });
        timer = setTimer(flush, debounceMs);
        return chain;
      }
      return flush();
    }

    function retry() {
      if (!failedPatch || disabled) return chain;
      const patch = failedPatch;
      failedPatch = null;
      return queue(patch);
    }

    // Loads the settings once. A failure keeps saving disabled so default
    // control values can never be written over the real file.
    async function load(apply) {
      try {
        const settings = await invoke("get_settings");
        apply(settings);
        disabled = false;
        onLoadState({ ok: true });
        return true;
      } catch (error) {
        disabled = true;
        onLoadState({ ok: false, error: String(error) });
        return false;
      }
    }

    return {
      queue,
      flush,
      retry,
      load,
      isDisabled: () => disabled,
      hasPending: () => hasKeys(pending) || timer !== null,
    };
  }

  root.WhatsNowAutosave = Object.freeze({ create });
})(globalThis);
