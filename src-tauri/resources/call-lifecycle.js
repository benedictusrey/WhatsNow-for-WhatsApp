// WhatsNow call window lifecycle, maintained by @benedictusrey.
// Runs only inside a dedicated HTTPS WhatsApp call stage (never the chat, never
// signalling, never media or peer connections). It does two small things for
// the separate call window:
//   1. shows a quiet "Connecting" frame until WhatsApp's call UI paints, so the
//      window is never an empty dark rectangle while the call bundle loads;
//   2. closes the window if the call UI vanishes and nothing replaces it.
// WhatsApp's own hang-up calls window.close(); the shell closes the whole native
// window for that (call_window::close_window_with_page).
(function () {
  "use strict";
  var root = typeof window !== "undefined" ? window : globalThis;
  var host = String(location.hostname || "").toLowerCase();
  if (location.protocol !== "https:" || !(
    host === "call.whatsapp.com" ||
    (host === "web.whatsapp.com" && /^\/call(?:\/|$)/.test(location.pathname))
  )) return;
  if (root.__whatsnowCallLifecycle) return;

  var BLANK_MS = 2500;          // call UI gone and nothing replaced it
  var SPLASH_MAX_MS = 10000;    // never keep the splash if detection misses
  var CHECK_DELAY_MS = 250;     // coalesce DOM mutation bursts
  // Anything that means WhatsApp's call UI has drawn something.
  var CONTENT = "video, audio, canvas, img, input, iframe, button, [role]";

  var setTimer = root.setTimeout.bind(root);
  var clearTimer = root.clearTimeout.bind(root);

  var closeTimer = null;
  var closeReason = "";
  var closeGuard = null;
  function cancelClose(reason) {
    if (closeTimer === null || (reason && reason !== closeReason)) return;
    clearTimer(closeTimer);
    closeTimer = null;
    closeReason = "";
    closeGuard = null;
  }
  function scheduleClose(reason, delay, guard) {
    if (closeTimer !== null) clearTimer(closeTimer);
    closeReason = reason;
    closeGuard = guard;
    closeTimer = setTimer(function () {
      var stillOver = closeGuard;
      closeTimer = null;
      closeReason = "";
      closeGuard = null;
      // Re-check at fire time: a new connection or fresh UI cancels the close.
      if (stillOver && stillOver()) {
        try { root.close(); } catch (e) {}
      }
    }, delay);
  }

  // --- Call UI: splash until it paints, close if it vanishes afterwards. ----
  var populated = false;
  var splash = null;
  var splashTimer = null;

  function hasContent() {
    try {
      return !!(root.document.body && root.document.body.querySelector(CONTENT));
    } catch (e) {
      return true; // when unsure, assume the call UI is there
    }
  }

  function showSplash() {
    var doc = root.document;
    if (!doc || !doc.documentElement || !doc.createElement) return;
    try {
      var layer = doc.createElement("div");
      layer.id = "whatsnow-call-splash";
      layer.setAttribute("role", "status");
      layer.setAttribute("aria-label", "Connecting call");
      layer.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;" +
        "align-items:center;justify-content:center;gap:16px;background:#0b1210;" +
        "color:#9fb3ad;font:500 14px/1.4 'Segoe UI',system-ui,sans-serif;" +
        "pointer-events:none;transition:opacity .18s ease";
      var ring = doc.createElement("div");
      ring.style.cssText =
        "width:34px;height:34px;border-radius:50%;border:3px solid rgba(159,179,173,.22);" +
        "border-top-color:#25d366";
      var label = doc.createElement("div");
      label.textContent = "Connecting…";
      layer.appendChild(ring);
      layer.appendChild(label);
      doc.documentElement.appendChild(layer);
      var reduced = false;
      try {
        reduced = !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
      } catch (e) {}
      if (!reduced && typeof ring.animate === "function") {
        ring.animate(
          [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
          { duration: 900, iterations: Infinity }
        );
      }
      splash = layer;
      splashTimer = setTimer(hideSplash, SPLASH_MAX_MS);
    } catch (e) {
      splash = null;
    }
  }

  function hideSplash() {
    if (splashTimer !== null) {
      clearTimer(splashTimer);
      splashTimer = null;
    }
    var layer = splash;
    if (!layer) return;
    splash = null;
    try {
      layer.style.opacity = "0";
      setTimer(function () {
        try { layer.remove(); } catch (e) {}
      }, 200);
    } catch (e) {}
  }

  function blankGone() { return populated && !hasContent(); }
  function checkContent() {
    if (hasContent()) {
      populated = true;
      hideSplash();
      cancelClose("blank");
    } else if (populated) {
      scheduleClose("blank", BLANK_MS, blankGone);
    }
  }

  var checkTimer = null;
  function scheduleCheck() {
    if (checkTimer !== null) return;
    checkTimer = setTimer(function () {
      checkTimer = null;
      checkContent();
    }, CHECK_DELAY_MS);
  }

  showSplash();
  if (typeof root.MutationObserver === "function" && root.document) {
    try {
      new root.MutationObserver(scheduleCheck).observe(root.document, {
        childList: true,
        subtree: true,
      });
    } catch (e) {}
  }
  scheduleCheck();

  root.__whatsnowCallLifecycle = Object.freeze({
    // Test hooks only: no behavior hangs off them.
    state: function () {
      return { populated: populated };
    },
  });
})();
