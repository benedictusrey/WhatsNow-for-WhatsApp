// WhatsNow call capture regressions, maintained by @benedictusrey.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("./call-media.js", import.meta.url), "utf8");
function harness(pathname = "/call", supported = true, hostname = "web.whatsapp.com", error) {
  const requests = [];
  const stream = {};
  const original = function (constraints) {
    assert.equal(this, devices);
    requests.push(constraints);
    if (error) return Promise.reject(error);
    return Promise.resolve(stream);
  };
  const display = () => {};
  const devices = {
    getSupportedConstraints: () => ({ resizeMode: supported }),
    getUserMedia: original,
    getDisplayMedia: display,
  };
  vm.runInNewContext(source, {
    location: { protocol: "https:", hostname, pathname },
    navigator: { mediaDevices: devices },
  });
  return { devices, requests, stream, original, display };
}
const h = harness();
assert.equal(h.requests.length, 0, "initialization never turns on the camera");
const audio = { echoCancellation: true };
const request = { audio, video: { deviceId: { exact: "selected-camera" }, frameRate: 24 } };
assert.equal(await h.devices.getUserMedia(request), h.stream);
assert.equal(h.requests[0].audio, audio);
assert.equal(h.requests[0].video.deviceId, request.video.deviceId);
assert.equal(h.requests[0].video.frameRate, 24);
assert.equal(h.requests[0].video.resizeMode.ideal, "none");
assert.equal(request.video.resizeMode, undefined, "caller constraints stay unchanged");
assert.equal(h.requests.length, 1, "one acquisition; no retry or duplicate camera access");
await h.devices.getUserMedia({ video: true });
assert.equal(h.requests[1].video.resizeMode.ideal, "none");
const voice = { audio: true, video: false };
await h.devices.getUserMedia(voice);
assert.equal(h.requests[2], voice);
assert.equal(h.devices.getDisplayMedia, h.display, "screen sharing stays untouched");
for (const item of [harness("/"), harness("/callback"), harness("/call", false),
  harness("/call", true, "web.whatsapp.com.evil.example")]) {
  assert.equal(item.devices.getUserMedia, item.original, "non-call/unsupported capture untouched");
}
const linked = harness("/ABC123", true, "call.whatsapp.com");
assert.notEqual(linked.devices.getUserMedia, linked.original);
const denied = new Error("Permission denied");
const failure = harness("/call", true, "web.whatsapp.com", denied);
await assert.rejects(failure.devices.getUserMedia({ video: true }), error => error === denied);
assert.equal(failure.requests.length, 1, "permission failures are not retried or hidden");
console.log("Call camera full-frame preference regressions passed.");
