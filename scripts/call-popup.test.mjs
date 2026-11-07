// WhatsNow browser call-popup contract, maintained by @benedictusrey.
// Real Chromium + production bridge, with a local synthetic WhatsApp page.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const bridge = await readFile(new URL("../src-tauri/resources/bridge.js", import.meta.url), "utf8");
const camera = await readFile(new URL("../src-tauri/resources/call-media.js", import.meta.url), "utf8");
// A synthetic camera only: this test must not activate the user's hardware.
const browser = await chromium.launch({ args: [
  "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream",
] });
try {
  const page = await browser.newPage();
  await page.context().addInitScript(camera);
  await page.context().route("https://web.whatsapp.com/**", route => route.fulfill({
    contentType: "text/html",
    body: route.request().url().includes("/call")
      ? `<title>Call fixture</title><script>opener.postMessage('call-ready',location.origin)</script>`
      : `<title>Chat fixture</title><button id="call">Call</button><script>
        addEventListener('message', e => {if(e.origin===location.origin && e.source===window.child) window.callReady=e.data});
        document.querySelector('#call').onclick=()=>{window.child=open('https://web.whatsapp.com/call/fixture','whatsapp-call','popup,width=640,height=480');window.blocked=window.child===null};
        </script>`,
  }));
  await page.addInitScript(bridge);
  await page.goto("https://web.whatsapp.com/");
  const childPromise = page.waitForEvent("popup");
  await page.click("#call");
  const child = await childPromise;
  await child.waitForLoadState();
  await page.waitForFunction(() => window.callReady === "call-ready");
  assert.equal(await page.evaluate(() => window.blocked), false);
  assert.equal(await child.evaluate(() => window.name), "whatsapp-call");
  assert.equal(await child.evaluate(() => !!window.opener), true);
  assert.equal(await page.evaluate(() => window.child.closed), false);
  const mode = await child.evaluate(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    try { return stream.getVideoTracks()[0].getSettings().resizeMode; }
    finally { stream.getTracks().forEach(track => track.stop()); }
  });
  assert.equal(mode, "none", "Chromium honors the uncropped capture preference on its fake camera");
  await child.close();
  await page.waitForFunction(() => window.child.closed);
  assert.equal(await page.evaluate(() => window.child.closed), true);
  console.log("Call popup: WindowProxy, opener handshake, named target, uncropped fake-camera capture, and close lifecycle PASS");
} finally {
  await browser.close();
}
