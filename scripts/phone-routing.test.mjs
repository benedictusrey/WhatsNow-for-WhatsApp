// WhatsNow regression tests, authored and maintained by @benedictusrey.
// Real Chromium input + the production bridge; the WhatsApp UI is a fixture.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const bridge = await readFile(new URL("../src-tauri/resources/bridge.js", import.meta.url), "utf8");
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction("hostClick", async ({ x, y }) => {
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  });
  await page.addInitScript(() => {
    window.__TAURI__ = { core: { invoke: (command, args) =>
      command === "notification_click" ? window.hostClick(args) : Promise.resolve() } };
  });
  await page.addInitScript(bridge);
  const html = `<!doctype html><html><body>
    <aside id="side"><button aria-label="New chat" id="new">New chat</button>
      <div id="pane-side"><div role="row" data-id="15550001111@c.us" id="known">Known</div>
        <div role="row" data-id="15550002222-12345@g.us" id="decoy"><span title="Group">Group</span><span title="https://wa.me/15550002222">https://wa.me/15550002222</span></div>
      </div>
      <section data-testid="drawer-left" hidden id="drawer">
        <button aria-label="Back" id="back">Back</button>
        <input aria-label="Search name or number" placeholder="Search name or number" id="query">
        <div id="results"></div>
      </section>
    </aside>
    <div id="main"><header data-testid="conversation-header" data-id="15550000000@c.us">Previous</header>
      <footer><div contenteditable="true" role="textbox" data-testid="conversation-compose-box-input" id="draft"></div></footer>
    </div>
    <script>
      window.trusted = [];
      window.opens = [];
      window.badClicks = 0;
      window.draftInputEvents = [];
      document.querySelector('#draft').addEventListener('input', e => {
        window.draftInputEvents.push(e.isTrusted);
        window.draftModel = document.querySelector('#draft').innerText;
      });
      window.fixture = { missing: false, delay: 100, namedHeader: false };
      function openPhone(phone, event) {
        if (!event.isTrusted) throw Error('Untrusted input');
        window.trusted.push(event.isTrusted);
        window.opens.push(phone);
        const header = document.querySelector('#main header');
        header.setAttribute('data-id', window.fixture.resultLid ? 'opaque-contact@lid' : phone + '@c.us');
        header.innerHTML = window.fixture.namedHeader ? '<span title="Named contact">Named contact</span>' : phone;
        document.querySelector('#drawer').hidden = true;
        document.querySelector('#draft').textContent = '';
      }
      document.querySelector('#known').onclick = e => openPhone('15550001111', e);
      document.querySelector('#decoy').onclick = () => {
        window.badClicks++;
        document.querySelector('#main header').setAttribute('data-id', '15550002222-12345@g.us');
        document.querySelector('#main header').innerHTML = '<span title="Group">Group</span>';
      };
      document.querySelector('#new').onclick = e => {
        if (!e.isTrusted) throw Error('Untrusted New chat');
        document.querySelector('#drawer').hidden = false;
        document.querySelector('#query').focus();
      };
      document.querySelector('#back').onclick = () => { document.querySelector('#drawer').hidden = true; };
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') document.querySelector('#drawer').hidden = true;
      });
      document.querySelector('#query').oninput = e => {
        const phone = e.target.value.replace(/\\D/g, '');
        document.querySelector('#results').textContent = '';
        if (!phone || window.fixture.missing) return;
        setTimeout(() => {
          if (document.querySelector('#query').value.replace(/\\D/g, '') !== phone) return;
          const result = document.createElement('div');
          result.setAttribute('role', 'listitem');
          result.setAttribute('data-id', window.fixture.resultLid ? 'opaque-contact@lid' : phone + '@c.us');
          result.style.cssText = 'padding:20px;width:250px';
          result.innerHTML = window.fixture.resultLid ? '<span title="Named contact">Named contact</span><span>+' + phone + '</span>' : '<span title="+' + phone + '">+' + phone + '</span>';
          result.onclick = e => openPhone(phone, e);
          document.querySelector('#results').appendChild(result);
        }, window.fixture.delay);
      };
    </script>
    </body></html>`;
  await page.route("https://web.whatsapp.com/**", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("https://web.whatsapp.com/");
  let loads = 0;
  page.on("load", () => loads++);

  await page.evaluate(() => { document.querySelector('#drawer').hidden = false; document.querySelector('#query').value = 'user query'; });
  assert.equal(await page.evaluate(() => window.__whatsnowOpenChatByPhone("15550001111")), "busy");
  assert.equal(await page.locator("#query").inputValue(), "user query", "a user-owned drawer is not repurposed");
  assert.equal(await page.evaluate(() => window.opens.length), 0);
  await page.evaluate(() => { document.querySelector('#drawer').hidden = true; });

  // WhatsApp can retain a dialog-role application shell without a modal.
  // That shell must not make every external phone request report "busy".
  await page.evaluate(() => document.body.setAttribute('role', 'dialog'));

  await page.evaluate(() => {
    const modal = document.createElement('div');
    modal.id = 'actual-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.textContent = 'Unsaved edits';
    document.body.prepend(modal);
  });
  assert.equal(await page.evaluate(() => window.__whatsnowOpenChatByPhone("15550001111")), "busy",
    "a genuine active modal must not be interrupted");
  await page.locator('#actual-modal').evaluate(el => el.style.visibility = 'hidden');
  await page.locator('#drawer').evaluate(el => {
    el.hidden = false;
    el.style.cssText = 'position:fixed;left:-5000px;width:300px;height:300px';
  });

  assert.equal(await page.evaluate(() => window.__whatsnowOpenChatByPhone("15550001111")), "row");
  await page.locator('#drawer').evaluate(el => el.removeAttribute('style'));
  assert.equal(loads, 0, "visible contact must not reload");
  const unknown = await page.evaluate(() => window.__whatsnowOpenChatByPhone("15550002222"));
  await page.waitForTimeout(150);
  assert.equal(loads, 0, "unlisted phone must open without a document reload");
  assert.equal(unknown, "search");
  assert.equal(await page.locator("#main header").getAttribute("data-id"), "15550002222@c.us");
  assert.equal(await page.evaluate(() => window.badClicks), 0, "a group preview mentioning the phone is not a contact match");
  await page.locator("#drawer").evaluate(drawer => drawer.removeAttribute("data-testid"));

  const draft = "Draft only\nHello & welcome 👋";
  assert.equal(await page.evaluate(text => window.__whatsnowOpenChatByPhone("15550003333", text), draft), "search");
  assert.equal(await page.locator("#draft").innerText(), draft);
  assert.equal(await page.evaluate(() => window.draftModel), draft, "browser editing updates the editor's input state");
  assert.equal(await page.evaluate(() => window.draftInputEvents.length > 0 && window.draftInputEvents.every(Boolean)), true,
    "draft insertion uses trusted browser input events");
  assert.equal(loads, 0, "prefilled text must not reload");
  assert.equal(await page.evaluate(() => window.opens.length), 3, "only verified targets open");
  assert.equal(await page.evaluate(() => window.__whatsnowOpenChatByPhone("15550003333", "Replace draft")), "draft-conflict");
  assert.equal(await page.locator("#draft").innerText(), draft, "an existing draft is never overwritten");

  await page.evaluate(() => { window.fixture.missing = true; });
  const failed = await page.evaluate(() => window.__whatsnowOpenChatByPhone("15550004444"));
  assert.equal(failed, "not-found");
  assert.equal(loads, 0, "no-result must never fall back to a reload");
  assert.equal(await page.locator("#main header").getAttribute("data-id"), "15550003333@c.us", "failure keeps the previous conversation");
  assert.equal(await page.locator("#draft").innerText(), draft, "failure preserves the current draft");

  await page.evaluate(() => { window.fixture.missing = false; window.fixture.delay = 450; });
  const results = await page.evaluate(async () => {
    const first = window.__whatsnowOpenChatByPhone("15550005555");
    await new Promise(resolve => setTimeout(resolve, 150));
    const second = window.__whatsnowOpenChatByPhone("15550006666");
    return Promise.all([first, second]);
  });
  assert.deepEqual(results, ["superseded", "search"]);
  assert.equal(await page.locator("#main header").getAttribute("data-id"), "15550006666@c.us");
  assert.equal(loads, 0);
  await page.evaluate(() => { window.fixture.delay = 1000; window.pendingPhone = window.__whatsnowOpenChatByPhone("15550007777"); });
  await page.locator("#drawer").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => window.pendingPhone), "cancelled");
  assert.equal(await page.locator("#main header").getAttribute("data-id"), "15550006666@c.us", "Escape preserves the current chat");
  assert.equal(loads, 0, "Escape never reloads");
  await page.evaluate(() => { window.fixture.resultLid = true; window.fixture.namedHeader = true; window.fixture.delay = 100; });
  assert.equal(await page.evaluate(() => window.__whatsnowOpenChatByPhone("15550008888")), "search");
  assert.equal(await page.locator("#main header").innerText(), "Named contact", "native lookup supports opaque LID contacts with a phone-labeled result");
  assert.equal(loads, 0);
  assert.equal(await page.evaluate(() => window.__whatsnowOpenChatByPhone("bad15550001111")), "failed");
  assert.equal(await page.evaluate(() => window.trusted.every(Boolean)), true);
  console.log("phone routing: trusted input, zero reloads, draft text, safe no-result, supersession PASS");
} finally {
  await browser.close();
}
