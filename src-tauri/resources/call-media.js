// WhatsNow call capture preference, maintained by @benedictusrey.
// Applies only inside a dedicated HTTPS WhatsApp call stage, never the chat,
// photo/video attachment tools, or getDisplayMedia (screen sharing).
(function () {
  "use strict";
  if (location.protocol !== "https:" || !(
    location.hostname === "call.whatsapp.com" ||
    (location.hostname === "web.whatsapp.com" && /^\/call(?:\/|$)/.test(location.pathname))
  )) return;
  var devices = navigator.mediaDevices;
  if (!devices || typeof devices.getUserMedia !== "function" ||
      typeof devices.getSupportedConstraints !== "function" ||
      !devices.getSupportedConstraints().resizeMode) return;
  var original = devices.getUserMedia;
  devices.getUserMedia = function (constraints) {
    if (!constraints || !constraints.video ||
        (constraints.video !== true && typeof constraints.video !== "object")) {
      return original.call(devices, constraints);
    }
    // Prefer the camera's native full frame instead of browser crop-and-scale.
    // An IDEAL constraint permits hardware fallback, never demands unsupported
    // resolution, and does not change WhatsApp's device, audio, or FPS choices.
    // The receiver still controls its own video layout; no CSS here can force
    // a remote phone to letterbox rather than crop the incoming stream.
    var video = constraints.video === true ? {} : constraints.video;
    return original.call(devices, Object.assign({}, constraints, {
      video: Object.assign({}, video, { resizeMode: { ideal: "none" } }),
    }));
  };
})();
