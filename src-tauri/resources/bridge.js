(function () {
  "use strict";
  if (window.location.origin !== "https://web.whatsapp.com") return;

  function invoke(cmd, args) {
    var t = window.__TAURI__;
    if (t && t.core && typeof t.core.invoke === "function") {
      return t.core.invoke(cmd, args).catch(function () {});
    }
    return Promise.resolve();
  }

  function invokeChecked(cmd, args) {
    var t = window.__TAURI__;
    if (t && t.core && typeof t.core.invoke === "function") {
      return t.core.invoke(cmd, args);
    }
    return Promise.reject(new Error("WhatsNow IPC unavailable"));
  }

  // Hosts that always stay inside WhatsNow (single source of truth: the Rust
  // predicate `whatsapp_family_host` in window.rs — this list must match it
  // EXACTLY). EXACT host equality, never subdomain suffixes, so
  // web.whatsapp.com.evil.com and unlisted subdomains (faq.whatsapp.com)
  // keep the external-browser flow.
  var WHATSAPP_FAMILY_HOSTS = [
    "web.whatsapp.com",
    "wa.me",
    "chat.whatsapp.com",
    "call.whatsapp.com",
    "www.whatsapp.com",
    "whatsapp.com",
    "api.whatsapp.com",
    "event.whatsapp.com",
    "v.whatsapp.com",
  ];
  function isWhatsAppFamilyHost(hostname) {
    var host = String(hostname || "").toLowerCase();
    for (var i = 0; i < WHATSAPP_FAMILY_HOSTS.length; i++) {
      if (host === WHATSAPP_FAMILY_HOSTS[i]) return true;
    }
    return false;
  }

  // Open ordinary web links outside WhatsApp in the operating system's browser.
  // The Rust command validates http/https again and launches without a shell.
  // WhatsApp-family links return "" here: the click handler below navigates
  // them in-page (wa.me/chat.*) or lets the native window.open flow reach the
  // Rust window-creation path (call.*, content hosts) instead of forcing
  // them into the user's browser.
  function externalWebLink(value) {
    try {
      var url = new URL(String(value || ""), window.location.href);
      return /^(https?):$/.test(url.protocol) &&
        !isWhatsAppFamilyHost(url.hostname)
        ? url.href
        : "";
    } catch (e) {
      return "";
    }
  }

  // wa.me/1555... = the documented alias of
  // web.whatsapp.com/send?phone=... (WhatsApp's own URL shortener). Resolving
  // it locally skips the wa.me landing page entirely — the same thing the
  // wa.me server does with its redirect. Only the phone path segment is
  // accepted and re-encoded; other wa.me shapes fall through untouched.
  function waMeSendUrl(url) {
    if (url.hostname.toLowerCase() !== "wa.me") return null;
    var phone = String(url.pathname || "").replace(/^\/+/, "").replace(/\/+$/, "");
    if (!phone || !/^[A-Za-z0-9]{5,20}$/.test(phone)) return null;
    var query = String(url.search || "").replace(/^\?/, "");
    return (
      "https://web.whatsapp.com/send?phone=" +
      encodeURIComponent(phone) +
      (query ? "&" + query : "")
    );
  }

  // SEAMLESS deep linking: WhatsApp Web is a client-side-routed SPA —
  // web.whatsapp.com/send?phone=… is just another internal route. A hard
  // location.href assignment tears the whole app down (blank screen → boot
  // → composer, several seconds). The SEAMLESS move goes through the SAME
  // mechanism WhatsApp's own UI uses for in-chat link clicks: a synthetic
  // same-origin anchor click, which the SPA's link interceptor handles as a
  // pure client-side route — the app, chat list, and media cache stay alive.
  //
  // NOT a pushState+popstate pulse: pulsing popstate DIRECTLY crashes
  // WhatsApp's router on the /send route (verified live 2026-09-15 — React
  // unmounted the entire shell, leaving only the themed background: the
  // "black window" the user screenshotted). The click path is the one the
  // app itself exercises on every in-chat link, so it is the safe contract.
  //
  // Safety: the anchor is appended, clicked, and removed — never inserted
  // into the visible layout. If the URL did not change (router refused the
  // route, app mid-boot) the promise REJECTS and every caller falls back to
  // the hard navigation, so the link ALWAYS lands.
  // Route acceptance is judged STRUCTURALLY, not by string equality: the
  // SPA's router may normalize the accepted route (trailing slash, re-ordered
  // or extra query params). A strict href comparison would declare a
  // successful seamless move a failure and needlessly hard-reload — the
  // exact class of bug this design exists to prevent. Same origin + path
  // (trailing slash tolerated); /send routes additionally match on the
  // phone number, which is the identity of the destination.
  function sameWhatsAppRoute(targetUrl) {
    try {
      var target = new URL(String(targetUrl), window.location.href);
      var current = new URL(String(window.location.href));
      if (target.origin !== current.origin) return false;
      var targetPath = String(target.pathname).replace(/\/+$/, "");
      var currentPath = String(current.pathname).replace(/\/+$/, "");
      if (targetPath !== currentPath) return false;
      if (/^\/send\b/.test(targetPath)) {
        var wanted = target.searchParams.get("phone") || "";
        var got = current.searchParams.get("phone") || "";
        return wanted === got;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function softNavigate(targetUrl) {
    return new Promise(function (resolve, reject) {
      try {
        if (sameWhatsAppRoute(targetUrl)) {
          resolve("same");
          return;
        }
        var a = window.document.createElement("a");
        // setAttribute, not the href property: the attribute form cannot
        // throw on ANY DOM (read-only IDL shims in exotic shells would).
        a.setAttribute("href", targetUrl);
        a.style.display = "none";
        window.document.body.appendChild(a);
        a.click();
        // Cleanup is best-effort: a throw here (exotic shells) must never
        // fail the soft path — the route was already handed to the router.
        try {
          window.document.body.removeChild(a);
        } catch (eCleanup) {}
        // Give the SPA's link interceptor its tick. If the route was not
        // taken (URL unchanged after 700ms), the caller hard-navigates.
        window.setTimeout(function () {
          if (sameWhatsAppRoute(targetUrl)) {
            resolve("soft");
          } else {
            reject(new Error("soft navigation not taken"));
          }
        }, 700);
      } catch (e) {
        reject(e);
      }
    });
  }

  // Every in-page family navigation goes through this: try the seamless SPA
  // route first; on any soft-navigation failure fall back to the classic
  // hard navigation (full reload) so the link ALWAYS lands. The fallback is
  // itself guarded — a location assignment can throw in exotic states. The
  // shell-collapse watchdog runs on every soft attempt (see watchShell).
  function softNavigateOrHard(targetUrl) {
    watchShell(targetUrl);
    softNavigate(targetUrl).catch(function () {
      try {
        window.location.href = targetUrl;
      } catch (e) {}
    });
  }

  // SHELL COLLAPSE WATCHDOG: the seamless move must never leave a dead app
  // behind. If the SPA ever collapses (router crash, React unmount — the
  // live 2026-09-15 "black window" incident), the app root loses its
  // content while the URL stays right. Detect the empty shell within a few
  // seconds and recover with the classic hard navigation (full reload),
  // which rebuilds the app on the SAME route — the deep link still lands,
  // just the slow way. Heartbeat only while the deep-link move is in
  // flight and shortly after; zero steady-state cost.
  function watchShell(targetUrl) {
    var checks = 0;
    var timer = window.setInterval(function () {
      checks++;
      var root = window.document.getElementById("app") || window.document.getElementById("main") || window.document.body;
      var text = root ? String(root.textContent || "").trim() : "";
      var hasUI =
        !!window.document.querySelector(
          "#side, [data-testid='chat-list'], canvas, [data-testid='conversation-panel-wrapper']"
        );
      if (hasUI || text) {
        if (checks > 12) window.clearInterval(timer);
        return;
      }
      // Dead shell AND nothing rendered anywhere: force the recovery reload.
      window.clearInterval(timer);
      try {
        window.location.href = targetUrl;
      } catch (e) {}
    }, 400);
  }

  try {
    document.addEventListener(
      "click",
      function (event) {
        var target = event.target;
        var link = target && target.closest && target.closest("a[href]");
        var href = link && (link.href || link.getAttribute("href"));
        if (!href) return;
        var resolved;
        try {
          resolved = new URL(String(href), window.location.href);
        } catch (e) {
          return;
        }
        if (!/^(https?):$/.test(resolved.protocol)) return;
        var host = resolved.hostname.toLowerCase();
        // Current-origin anchors stay COMPLETELY untouched: WhatsApp's own
        // client-side router handles them (a location.href assignment here
        // would force a full SPA reload on ordinary in-app navigation).
        if (host === "web.whatsapp.com") return;
        if (isWhatsAppFamilyHost(host)) {
          // WhatsApp-family link: never the browser. chat.* (invites) and
          // wa.me are the documented navigation targets of the chat surface
          // itself — navigate the current window (WhatsApp's own desktop app
          // does the same for invite links). Content hosts keep their default
          // navigation, which reaches the Rust on_new_window handler and lands
          // in the reusable call/content window.
          event.preventDefault();
          event.stopPropagation();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          // wa.me carries a PHONE: open the contact through the same
          // open-by-phone flow as browser deep links (known contact →
          // row match → trusted click, chat opens in place; unknown →
          // deliberately nothing, the app just rose). Live forensics
          // (2026-09-17) proved /send?phone has NO in-app route — the URL
          // always bounces home — so in-place routing is dead on arrival.
          if (host === "wa.me" && waMeSendUrl(resolved)) {
            var digits = String(resolved.pathname || "")
              .replace(/^\/+/, "")
              .replace(/\/+$/, "");
            if (/^[A-Za-z0-9]{5,20}$/.test(digits)) {
              window.__whatsnowOpenChatByPhone(digits);
              return;
            }
          }
          // Every other family link (chat.*/call/api/…) goes through the
          // REAL window.open so the Rust popup path hosts it in the reusable
          // content window and the chat window never leaves the active chat.
          // NO "noopener" here — this shell's popup host never receives a
          // noopener popup's URL (proven live: about:blank, opener severed
          // — the original wa.me vanish). A plain "_blank" reaches Rust's
          // on_new_window.
          if (typeof nativeWindowOpen === "function") {
            nativeWindowOpen.call(
              window,
              (host === "wa.me" && waMeSendUrl(resolved)) || resolved.href,
              "_blank"
            );
          } else {
            softNavigateOrHard(
              (host === "wa.me" && waMeSendUrl(resolved)) || resolved.href
            );
          }
          return;
        }
        // Ordinary web link: the operating system's browser flow (the
        // pre-2.6.0 behavior, unchanged).
        var url = externalWebLink(href);
        if (!url) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        invoke("open_external_url", { url: url });
      },
      true
    );

    var nativeWindowOpen = window.open;
    if (typeof nativeWindowOpen === "function") {
      window.open = function (value, target, features) {
        var url = externalWebLink(value);
        if (url) {
          invoke("open_external_url", { url: url });
          return null;
        }
        // Family-host deep links from page code (WhatsApp calls
        // window.open("https://wa.me/<phone>") itself in several share
        // flows) previously fell through to the captured native
        // window.open — fine when Tauri routes the popup (the REAL handler
        // creates the content window). But features like "noopener" make
        // Chromium open an about:blank popup that never carries the URL
        // through the shell, silently dropping the link. Resolve the URL
        // ourselves and hand the shell a plain URL so the Rust popup path
        // always receives it.
        try {
          var family = new URL(String(value || ""), window.location.href);
          if (
            /^(https?):$/.test(family.protocol) &&
            isWhatsAppFamilyHost(family.hostname)
          ) {
            // wa.me carries a PHONE: open the contact through the same
            // open-by-phone flow as browser deep links (known contact →
            // row match → trusted click, chat opens in place; unknown →
            // deliberately nothing, the app just rose). Live forensics
            // (2026-09-17) proved /send?phone has NO in-app route — the
            // URL always bounces home — so soft-routing it is dead on
            // arrival.
            if (
              family.hostname.toLowerCase() === "wa.me" &&
              waMeSendUrl(family)
            ) {
              var phone = String(family.pathname || "")
                .replace(/^\/+/, "")
                .replace(/\/+$/, "");
              if (/^[A-Za-z0-9]{5,20}$/.test(phone)) {
                window.__whatsnowOpenChatByPhone(phone);
                return null;
              }
            }
            // Everything else in the family keeps the shell popup path.
            var direct = family.href;
            nativeWindowOpen.call(window, direct, "_blank");
            return null;
          }
        } catch (e) {}
        // WhatsApp-family targets (call stages, invite pages, wa.me) reach
        // the REAL window.open below: Rust's on_new_window decides (reuse the
        // call/content window) — never the user's browser.
        return nativeWindowOpen.call(window, value, target, features);
      };
    }
  } catch (e) {}

  // Hide WhatsApp Web's desktop-app download promotion. It is restricted to
  // short, explicit promotion cards inside the chat-list/navigation region so
  // ordinary file-download controls and conversation content are untouched.
  function isOfficialAppPromo(element) {
    if (!element) return false;
    var text = String(element.textContent || "").replace(/\s+/g, " ").trim();
    if (!text || text.length > 360) return false;
    var href = String(
      (element.getAttribute && element.getAttribute("href")) ||
        (element.querySelector &&
          element.querySelector("a[href]") &&
          element.querySelector("a[href]").getAttribute("href")) ||
        ""
    );
    return (
      /(?:download|get)\s+(?:the\s+)?whatsapp(?:\s+(?:app|for\s+(?:windows|mac)))?/i.test(text) ||
      /https?:\/\/(?:www\.)?whatsapp\.com\/download|apps\.microsoft\.com\/detail\/.*whatsapp/i.test(href)
    );
  }

  function hideOfficialAppPromos() {
    if (!document.querySelectorAll) return 0;
    var scopes = document.querySelectorAll(
      "#side, aside, [data-testid='chat-list'], [aria-label='Chat list'], [role='navigation']"
    );
    var hidden = 0;
    for (var scopeIndex = 0; scopeIndex < scopes.length; scopeIndex++) {
      var scope = scopes[scopeIndex];
      var candidates = scope.querySelectorAll("a[href], button, [role='button'], [data-testid]");
      for (var index = 0; index < candidates.length; index++) {
        var candidate = candidates[index];
        if (!isOfficialAppPromo(candidate)) continue;
        var card = candidate;
        for (var depth = 0; depth < 4; depth++) {
          var parent = card.parentElement;
          if (
            !parent ||
            parent === scope ||
            String(parent.textContent || "").replace(/\s+/g, " ").trim().length > 360
          ) {
            break;
          }
          card = parent;
        }
        if (!card.hasAttribute("data-whatsnow-hidden-promo")) {
          card.setAttribute("data-whatsnow-hidden-promo", "true");
          card.style.setProperty("display", "none", "important");
          card.setAttribute("aria-hidden", "true");
          hidden++;
        }
      }
    }
    return hidden;
  }

  // Coalesced sweep scheduling for the MutationObserver below: WhatsApp
  // mutates the chat list DOM hundreds of times per second while scrolling,
  // typing, or animating, and the old observer ran the full multi-scope
  // querySelectorAll sweep synchronously for EVERY mutation record — visible
  // main-thread cost on every chat. The sweep still runs immediately on boot
  // and on the FIRST mutation of each window (leading edge — the promo is
  // hidden synchronously just as before, and an environment that swallows
  // MutationObserver records still converges), while the remaining mutation
  // storm of that window is absorbed into at most ONE trailing-edge sweep
  // ~400 ms later. Net effect: full sweeps drop from per-mutation to at most
  // two per busy window. Falls back to the direct call when timers are
  // unavailable.
  var promoSweepPending = false;
  function schedulePromoSweep() {
    if (promoSweepPending) return;
    promoSweepPending = true;
    hideOfficialAppPromos();
    if (typeof setTimeout !== "function") {
      promoSweepPending = false;
      return;
    }
    setTimeout(function () {
      promoSweepPending = false;
      try {
        hideOfficialAppPromos();
      } catch (e) {}
    }, 400);
  }

  try {
    hideOfficialAppPromos();
    if (typeof MutationObserver === "function") {
      // Observe `document`, never `document.documentElement`: embedder
      // initialization scripts can run BEFORE the <html> element is parsed
      // (verified in Chromium — the old documentElement-guarded observer
      // silently never installed in that window and the sweep went deaf for
      // the page's whole life). `document` exists at every script phase and,
      // with subtree:true, also catches WhatsApp replacing the document head.
      new MutationObserver(schedulePromoSweep).observe(document, {
        childList: true,
        subtree: true,
      });
    }
  } catch (e) {}

  // Dark and Light retain WhatsApp's native doodle wallpaper. Personality
  // themes suppress only that wallpaper layer; the composer and Reply surface
  // remain untouched. The observer restores this narrow style if WhatsApp
  // replaces its page head during a live update.
  try {
    var doodleCss = [
      "html[data-whatsnow-doodles='disabled'] [data-testid='conversation-panel-wrapper'],",
      "html[data-whatsnow-doodles='disabled'] [data-testid='conversation-panel-body'],",
      "html[data-whatsnow-doodles='disabled'] [data-testid='conversation-panel-messages'],",
      "html[data-whatsnow-doodles='disabled'] [data-asset-chat-background],",
      "html[data-whatsnow-doodles='disabled'] [data-asset-chat-background-dark],",
      "html[data-whatsnow-doodles='disabled'] [data-asset-chat-background-light],",
      "html[data-whatsnow-doodles='disabled'] #main,",
      "html[data-whatsnow-doodles='disabled'] #main > div[style*='background'],",
      "html[data-whatsnow-doodles='disabled'] [data-testid='conversation-panel-wrapper'] > div[style*='background'],",
      "html[data-whatsnow-doodles='disabled'] [data-testid='conversation-panel-body'] > div[style*='background-image'],",
      // The Reply/quote surface reuses the chat wallpaper in some WhatsApp
      // versions; personality themes must keep it clean too.
      "html[data-whatsnow-doodles='disabled'] [data-testid*='quoted'],",
      "html[data-whatsnow-doodles='disabled'] [data-testid*='reply'],",
      "html[data-whatsnow-doodles='disabled'] [data-testid*='quote'],",
      "html[data-whatsnow-doodles='disabled'] [data-testid='conversation-compose-box-container'],",
      // WhatsApp renamed the composer container; keep the legacy testid for
      // older DOMs and cover the current one so the Reply preview bar (which
      // slides up like a curtain) can never flash the wallpaper behind it.
      "html[data-whatsnow-doodles='disabled'] [data-testid='compose-box'],",
      "html[data-whatsnow-doodles='disabled'] [data-testid='compose-box'] > div[style*='background'] {",
      "  background-image: var(--whatsnow-chat-wallpaper, none) !important;",
      "}",
      // WhatsApp 2.24xx+ paints the default doodle wallpaper as a CSS MASK:
      // a full-bleed layer ([data-testid='conversation-background-*']) with
      // an inline mask-image SVG pattern (doodle shapes) over a translucent
      // tint. The background-image rules above cannot see it — the pattern
      // lives in mask-image, so personality themes must drop the mask (and
      // the tint it shapes) entirely. Exclusions mirror the blanket rule:
      // the typing-area emoji surfaces are background-image sprites, never
      // masks, but they are guarded anyway so nothing can ever wipe them.
      "html[data-whatsnow-doodles='disabled'] #main [data-testid*='conversation-background'],",
      "html[data-whatsnow-doodles='disabled'] #main [data-testid*='chat-background'],",
      "html[data-whatsnow-doodles='disabled'] #main [data-testid*='wallpaper'],",
      "html[data-whatsnow-doodles='disabled'] #main [data-testid*='doodle'],",
      "html[data-whatsnow-doodles='disabled'] [data-asset-chat-background] {",
      "  mask-image: none !important;",
      "  -webkit-mask-image: none !important;",
      "  background-image: none !important;",
      "  background-color: transparent !important;",
      "}",
      // Belt-and-suspenders: any other inline mask under the conversation
      // (future WhatsApp layers) loses only its mask — never its background
      // color, so unrelated UI tints are untouched. Emoji/compose surfaces
      // are excluded exactly like the blanket background rule above.
      "html[data-whatsnow-doodles='disabled'] #main [style*='mask-image']:not([style*='/emoji/']):not([class*='emoji']):not([data-testid*='emoji']):not([data-testid*='compose']) {",
      "  mask-image: none !important;",
      "  -webkit-mask-image: none !important;",
      "}",
      // Broad bypass: any element under the conversation that carries an inline
      // wallpaper background (new WhatsApp DOM layers) is neutralized too.
      // The typing area is excluded: the dedicated composer/reply rules above
      // already handle its wallpaper, and the blanket must never wipe the
      // emoji surfaces — WhatsApp draws typed emoji as inline
      // background-image sprites (span.emoji with url(.../emoji/...)), so any
      // element whose style or class marks it as an emoji sprite is exempt.
      // Media surfaces are NEVER wallpaper: WhatsApp renders image/video
      // previews (chat thumbnails, quote-media, albums) as inline
      // background-image: url(blob:…) / url(data:…) divs under #main. The
      // blanket rule below used to replace those with the wallpaper — the
      // user-visible "image preview is blank" bug (2026-09-15). Elements
      // carrying blob:/data: media URLs keep their own image.
      "html[data-whatsnow-doodles='disabled'] #main [style*='background-image']:not([style*='/emoji/']):not([class*='emoji']):not([data-testid*='emoji']):not([data-testid*='compose']):not([style*='url(blob:']):not([style*='url(\"blob:']):not([style*='url(data:']):not([style*='url(\"data:']),",
      "html[data-whatsnow-doodles='disabled'] #main [style*='background:']:not([style*='/emoji/']):not([class*='emoji']):not([data-testid*='emoji']):not([data-testid*='compose']):not([style*='url(blob:']):not([style*='url(\"blob:']):not([style*='url(data:']):not([style*='url(\"data:']),",
      "html[data-whatsnow-doodles='disabled'] #main [style*='background ']:not([style*='/emoji/']):not([class*='emoji']):not([data-testid*='emoji']):not([data-testid*='compose']):not([style*='url(blob:']):not([style*='url(\"blob:']):not([style*='url(data:']):not([style*='url(\"data:']) {",
      "  background-image: var(--whatsnow-chat-wallpaper, none) !important;",
      "}",
      "html[data-whatsnow-doodles='disabled'] #main::before,",
      "html[data-whatsnow-doodles='disabled'] #main::after,",
      "html[data-whatsnow-doodles='disabled'] #main > div::before,",
      "html[data-whatsnow-doodles='disabled'] #main > div::after,",
      "html[data-whatsnow-doodles='disabled'] [data-testid='conversation-panel-wrapper']::before,",
      "html[data-whatsnow-doodles='disabled'] [data-testid='conversation-panel-body']::before,",
      "html[data-whatsnow-doodles='disabled'] [data-testid='conversation-panel-messages']::before,",
      "html[data-whatsnow-doodles='disabled'] [data-testid*='conversation-background']::before,",
      "html[data-whatsnow-doodles='disabled'] [data-asset-chat-background]::before {",
      "  background-image: none !important;",
      "  mask-image: none !important;",
      "  -webkit-mask-image: none !important;",
      "}",
    ].join("\n");
    var doodlesEnabled = false;
    var doodleObserver = null;
    // Typing-area emoji surfaces must keep WhatsApp's own color scheme in
    // every theme. Personality themes scope color-scheme to the panels and
    // composer they restyle; these surfaces explicitly opt back into
    // WhatsApp's natural light/dark resolution so the emoji button, picker
    // tiles, and composer input never render under a scheme that hides
    // their glyphs. Re-installed with the doodle style whenever WhatsApp
    // replaces the page head.
    var emojiCss = [
      "html[data-whatsnow-theme] [data-testid*='emoji'] {",
      "  color-scheme: light dark !important;",
      "}",
      "html[data-whatsnow-theme] [data-testid='conversation-compose-box-input'] {",
      "  color-scheme: light dark !important;",
      "}",
    ].join("\n");
    var installEmojiStyle = function () {
      if (!document || !document.documentElement) return;
      if (typeof document.getElementById !== "function") return;
      if (document.getElementById("whatsnow-emoji-scheme")) return;
      if (typeof document.createElement !== "function") return;
      var style = document.createElement("style");
      style.id = "whatsnow-emoji-scheme";
      style.textContent = emojiCss;
      (document.head || document.documentElement).appendChild(style);
    };
    var installDoodleStyle = function () {
      if (!document.documentElement) return;
      installEmojiStyle();
      if (document.getElementById("whatsnow-no-wallpaper-doodles")) return;
      var style = document.createElement("style");
      style.id = "whatsnow-no-wallpaper-doodles";
      style.textContent = doodleCss;
      (document.head || document.documentElement).appendChild(style);
    };
    // WhatsApp stores its default wallpaper preference in an obfuscated
    // localStorage key. Locate the value by its stable record id and update it
    // directly without opening You/Chats/Wallpaper. Dark and Light enable the
    // official doodles; personality themes persistently disable them.
    // Note: the wallpaper payload itself is WhatsApp-owned (its value format
    // changes between versions), so the reliable bypass for personality themes
    // is the data-whatsnow-doodles attribute + the kill-switch stylesheet
    // below — this preference write is best-effort only.
    var setStoredDoodlesEnabled = function (enabled) {
      void enabled; // the preference is kept doodle-on regardless of theme
      try {
        // NO-RELOAD rule (user-specified, see AGENTS.md): theme switches
        // NEVER reload the page, and a live page NEVER writes this record —
        // WhatsApp's storage listener re-writes it from its in-memory state
        // and clobbers the write (observed live). The visual enforcement is
        // the data-whatsnow-doodles attribute + the kill-switch stylesheet,
        // which apply instantly in both directions.
        // The ONLY write happens at boot (readyState "loading"): showDoodle
        // is forced true so WhatsApp ALWAYS renders its doodle wallpaper
        // (official Dark/Light show it; personality themes hide it via the
        // kill switch). This guarantees a later live switch into Dark/Light
        // shows the doodle instantly — the preference can never be left
        // false by an earlier personality session.
        if (document.readyState === "complete") {
          return true;
        }
        for (var index = 0; index < window.localStorage.length; index++) {
          var key = window.localStorage.key(index);
          var raw = key && window.localStorage.getItem(key);
          if (
            !raw ||
            raw.indexOf('"id":"defaultPreference"') === -1 ||
            raw.indexOf('"showDoodle"') === -1
          ) {
            continue;
          }
          var records = JSON.parse(raw);
          if (!Array.isArray(records)) continue;
          var changed = false;
          for (var recordIndex = 0; recordIndex < records.length; recordIndex++) {
            var record = records[recordIndex];
            if (!record || record.id !== "defaultPreference") continue;
            if (record.showDoodle !== true) {
              record.showDoodle = true;
              changed = true;
            }
            if (
              record.wallpaperValue &&
              record.wallpaperValue.isDoodleEnabled !== true
            ) {
              record.wallpaperValue.isDoodleEnabled = true;
              changed = true;
            }
          }
          if (changed) {
            // Boot-time write only: WhatsApp has not read the preference yet,
            // so no event dispatch is needed (and none is sent — dispatching
            // one made WhatsApp's listener clobber the value).
            window.localStorage.setItem(key, JSON.stringify(records));
          }
        }
        return true;
      } catch (error) {}
      return false;
    };
    var applyDoodlePreference = function () {
      if (!document.documentElement) return;
      document.documentElement.setAttribute(
        "data-whatsnow-doodles",
        doodlesEnabled ? "enabled" : "disabled"
      );
      installDoodleStyle();
      if (typeof MutationObserver === "function" && !doodleObserver) {
        doodleObserver = new MutationObserver(installDoodleStyle);
        doodleObserver.observe(document.documentElement, {
          childList: true,
          subtree: true,
        });
      }
    };
    window.__whatsnowSetDoodlesEnabled = function (enabled) {
      doodlesEnabled = enabled === true;
      setStoredDoodlesEnabled(doodlesEnabled);
      applyDoodlePreference();
    };
    window.__whatsnowDoodleSyncProbe = Object.freeze({
      setStored: setStoredDoodlesEnabled,
    });
    // Begin with the wallpaper layer suppressed so a saved personality theme
    // cannot flash WhatsApp's doodles while its settings are being loaded.
    applyDoodlePreference();
    if (!document.documentElement && document.addEventListener) {
      document.addEventListener(
        "DOMContentLoaded",
        function applyDoodlesAfterDocumentReady() {
          applyDoodlePreference();
        },
        { once: true }
      );
    }
  } catch (e) {}

  // Native OS toast with short-window de-duplication. WhatsApp can raise the same alert
  // more than once in a burst (a React re-render, or one message surfacing through two
  // notification code paths), and unlike a browser (which collapses repeats by tag) a
  // native toast stacks every call as a separate visible popup. Suppress an identical
  // title+body seen within DEDUP_MS; genuinely different messages are never affected.
  // Returns true if forwarded, false if suppressed as a duplicate.
  var DEDUP_MS = 3500;
  var MESSAGE_HISTORY_MS = 6 * 60 * 60 * 1000;
  // WhatsApp can replay its most recent browser notification while restoring a
  // session. Treat that initial hydration burst as history, not a new message.
  var NOTIFICATION_WARMUP_MS = 12000;
  var notificationsArmedAt = Date.now() + NOTIFICATION_WARMUP_MS;
  var recentNotif = Object.create(null);
  var notifiedMessages = Object.create(null);
  var lastRichNotificationAt = 0;
  function firstNotificationValue(source, names) {
    if (!source || typeof source !== "object") return "";
    for (var index = 0; index < names.length; index++) {
      var value = source[names[index]];
      if (typeof value === "string" || typeof value === "number") {
        value = String(value).trim();
        if (value) return value;
      }
    }
    return "";
  }
  function notificationDetails(title, options) {
    options = options || {};
    var data = options.data && typeof options.data === "object" ? options.data : {};
    var chatTitle =
      String(title || "").trim() ||
      firstNotificationValue(data, [
        "title", "chatTitle", "chatName", "groupName", "communityName", "senderName",
      ]) ||
      "WhatsApp";
    var body =
      String(options.body || "").trim() ||
      firstNotificationValue(data, [
        "body", "message", "messageText", "text", "preview", "content",
      ]);
    return {
      title: chatTitle,
      body: body,
      route: {
        chatTitle: firstNotificationValue(data, [
          "chatTitle", "chatName", "groupName", "communityName",
        ]) || chatTitle,
        chatId: firstNotificationValue(data, [
          "chatId", "chat_id", "jid", "remoteJid", "remote", "conversationId",
        ]),
        messageId: firstNotificationValue(data, [
          "messageId", "message_id", "msgId", "stanzaId", "id",
        ]),
        messageText: body,
      },
    };
  }
  function notificationFingerprint(details) {
    var route = details.route || {};
    if (route.messageId) return "id:" + route.messageId;
    return [
      "preview",
      route.chatId || route.chatTitle || details.title,
      details.body,
    ].join("\u001f");
  }
  function rememberNotification(details, now) {
    for (var key in notifiedMessages) {
      if (now - notifiedMessages[key] > MESSAGE_HISTORY_MS) {
        delete notifiedMessages[key];
      }
    }
    var fingerprint = notificationFingerprint(details);
    if (notifiedMessages[fingerprint]) return false;
    notifiedMessages[fingerprint] = now;
    return true;
  }
  function nativeNotify(title, options) {
    var details = notificationDetails(title, options);
    title = details.title;
    var body = details.body;
    var now = Date.now();
    // WhatsApp's Notification data rarely carries the chat jid. Resolve it from
    // the sender's row in the chat list so toast activation can match by the
    // stable id instead of a display name (the row is still in the DOM at
    // notify time; by click time it may have been scrolled/reordered away).
    if (!details.route.chatId) {
      try {
        var senderRow = findNotificationChatRow(details.route);
        var rowChatId = rowChatIdOf(senderRow);
        if (rowChatId) details.route.chatId = rowChatId;
      } catch (e) {}
    }
    if (now < notificationsArmedAt) {
      rememberNotification(details, now);
      return false;
    }
    for (var k in recentNotif) {
      if (now - recentNotif[k] > DEDUP_MS) delete recentNotif[k]; // prune stale keys
    }
    var key = title + " " + body;
    if (recentNotif[key] && now - recentNotif[key] <= DEDUP_MS) return false;
    if (!rememberNotification(details, now)) return false;
    recentNotif[key] = now;
    invoke("notify", { title: title, body: body, route: details.route });
    lastRichNotificationAt = now;
    return true;
  }
  window.__whatsnowNotificationProbe = Object.freeze({
    details: notificationDetails,
    fingerprint: notificationFingerprint,
    remember: rememberNotification,
    isArmed: function (now) {
      return now >= notificationsArmedAt;
    },
  });

  // Native Windows toast activation calls this bridge entry point after Rust
  // restores the correct account window. A newly received chat is normally at
  // the top of WhatsApp's chat list, so matching by stable chat id first and the
  // visible chat title second avoids opening the wrong sender.
  function normalizedRouteText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function routeValueMatches(element, chatId, chatTitle) {
    var normalizedId = normalizedRouteText(chatId).toLowerCase();
    if (normalizedId) {
      var attributes = ["data-id", "data-jid", "data-chat-id", "href"];
      // The chat id usually sits on the row's OUTER div, while row discovery
      // may land on an inner cell container — check the element's ancestors too.
      var walk = element;
      while (walk && walk.getAttribute) {
        for (var index = 0; index < attributes.length; index++) {
          var value = normalizedRouteText(walk.getAttribute(attributes[index])).toLowerCase();
          if (value && value.indexOf(normalizedId) !== -1) return true;
        }
        walk = walk.parentElement;
      }
      var identified = element.querySelectorAll("[data-id], [data-jid], [data-chat-id], a[href]");
      for (var childIndex = 0; childIndex < identified.length; childIndex++) {
        for (var attrIndex = 0; attrIndex < attributes.length; attrIndex++) {
          var childValue = normalizedRouteText(
            identified[childIndex].getAttribute(attributes[attrIndex])
          ).toLowerCase();
          if (childValue && childValue.indexOf(normalizedId) !== -1) return true;
        }
      }
    }

    var normalizedTitle = normalizedRouteText(chatTitle).toLowerCase();
    if (!normalizedTitle) return false;
    var labelled = element.querySelectorAll("[title], [aria-label], span, div");
    for (var labelIndex = 0; labelIndex < labelled.length; labelIndex++) {
      var label = normalizedRouteText(
        labelled[labelIndex].getAttribute("title") ||
        labelled[labelIndex].getAttribute("aria-label") ||
        labelled[labelIndex].textContent
      ).toLowerCase();
      if (label === normalizedTitle) return true;
    }
    return false;
  }

  function highlightNotificationMessage(route) {
    var messageId = normalizedRouteText(route.messageId).toLowerCase();
    var messageText = normalizedRouteText(route.messageText);
    var scope =
      document.querySelector("[data-testid='conversation-panel-messages']") ||
      document.querySelector("[data-testid='conversation-panel-body']") ||
      document.querySelector("main") ||
      document;
    var messages = scope.querySelectorAll(
      "[data-id], [data-message-id], [role='row'], div.message-in, div.message-out"
    );
    var target = null;
    for (var index = messages.length - 1; index >= 0; index--) {
      var element = messages[index];
      var elementId = normalizedRouteText(
        element.getAttribute("data-id") || element.getAttribute("data-message-id")
      ).toLowerCase();
      if (messageId && elementId && elementId.indexOf(messageId) !== -1) {
        target = element;
        break;
      }
      if (
        !target &&
        messageText &&
        normalizedRouteText(element.textContent).indexOf(messageText) !== -1
      ) {
        target = element;
      }
    }
    if (!target) return false;
    target.classList.add("whatsnow-toast-target");
    window.setTimeout(function () {
      target.classList.remove("whatsnow-toast-target");
    }, 2200);
    return true;
  }

  function currentConversationMatches(route) {
    var header =
      document.querySelector("[data-testid='conversation-header']") ||
      document.querySelector("[data-testid='conversation-info-header']") ||
      document.querySelector("header[data-tab]");
    return !!(
      header &&
      routeValueMatches(header, route.chatId, route.chatTitle)
    );
  }

  function notificationChatList() {
    return (
      document.querySelector("#pane-side") ||
      document.querySelector("[data-testid='chat-list']") ||
      document.querySelector("[aria-label='Chat list']") ||
      document.querySelector("#side")
    );
  }

  function notificationChatRows(list) {
    return list
      ? list.querySelectorAll(
          "[data-testid='cell-frame-container'], [role='row'], " +
            "[role='listitem'], [data-id], div[tabindex='-1']"
        )
      : [];
  }

  // Return the SMALLEST element that matches the route. WhatsApp's chat list
  // puts a giant wrapper container (the whole list body, tens of thousands of
  // px tall) into the row selector set; its descendant rows carry the sender's
  // title text, so the FIRST-match logic below used to click the wrapper's
  // center — far off-screen — and routing silently failed (verified live:
  // trusted clicks landed at y=19519 for a row visible at y=238). The real
  // row is always the smallest match, so pick it by bounding area.
  function findNotificationChatRow(route) {
    var rows = notificationChatRows(notificationChatList());
    var best = null;
    var bestArea = Infinity;
    for (var index = 0; index < rows.length; index++) {
      if (routeValueMatches(rows[index], route.chatId, route.chatTitle)) {
        var rect = null;
        try {
          rect = rows[index].getBoundingClientRect();
        } catch (e) {}
        var area =
          rect && rect.width > 0 && rect.height > 0
            ? rect.width * rect.height
            : Infinity;
        if (area < bestArea) {
          bestArea = area;
          best = rows[index];
        }
      }
    }
    return best;
  }

  // The stable chat id (WhatsApp jid) sits on the row's outer div; row discovery
  // may land on an inner cell container, so fall back to the closest ancestor
  // carrying one of the id attributes.
  function rowChatIdOf(row) {
    if (!row || !row.getAttribute) return "";
    var walk = row;
    while (walk && walk.getAttribute) {
      var own =
        walk.getAttribute("data-id") ||
        walk.getAttribute("data-chat-id") ||
        walk.getAttribute("data-jid") ||
        "";
      if (own) return own;
      walk = walk.parentElement;
    }
    return "";
  }

  // WhatsApp Web only navigates its chat list on TRUSTED input events;
  // page-side .click() is silently ignored (verified live: programmatic clicks
  // never switch the conversation, CDP Input.dispatchMouseEvent always does).
  // The bridge therefore asks Rust to synthesize a trusted click at the
  // element's viewport coordinates through the notification_click command.
  function tryFallbackClick(element) {
    try {
      if (element && typeof element.click === "function") {
        element.click();
        return true;
      }
    } catch (e) {}
    return false;
  }

  function requestTrustedClick(element, fallbackElement) {
    if (!element) return Promise.resolve(false);
    // Minimal scroll: only bring an off-screen row into view ("nearest"
    // never scrolls a row that is already visible), so the chat-list click
    // targeting can never displace the conversation header or composer.
    try {
      element.scrollIntoView({ block: "nearest", inline: "nearest" });
    } catch (e) {}
    var rect = null;
    try {
      rect = element.getBoundingClientRect();
    } catch (e) {}
    var x = rect ? Math.round(rect.left + rect.width / 2) : NaN;
    var y = rect ? Math.round(rect.top + rect.height / 2) : NaN;
    // Viewport guard: a click center outside the visible window cannot land on
    // a real row (WhatsApp's giant list wrappers have off-screen centers). The
    // row finder already prefers the smallest match, but never click blind.
    var inViewport =
      rect &&
      x >= 0 &&
      x <= (window.innerWidth || 0) &&
      y >= 0 &&
      y <= (window.innerHeight || 0);
    if (!rect || !inViewport || !isFinite(x) || !isFinite(y) || rect.width < 1 || rect.height < 1) {
      return Promise.resolve(
        fallbackElement ? tryFallbackClick(fallbackElement) : false
      );
    }
    return invokeChecked("notification_click", { x: x, y: y })
      .then(function () {
        return true;
      })
      .catch(function () {
        return fallbackElement ? tryFallbackClick(fallbackElement) : false;
      });
  }

  function clickNotificationChatRow(row) {
    if (!row) return Promise.resolve(false);
    var target =
      (row.closest &&
        row.closest(
          "[data-testid='cell-frame-container'], [role='row'], [role='listitem']"
        )) ||
      row;
    // Click the visible row surface (the cell frame / row), not an inner
    // hover-only button that may be hidden until the row is hovered — a
    // hidden element has a zero-size rect and cannot be clicked.
    return requestTrustedClick(target, target);
  }

  function notificationSearchInput() {
    return document.querySelector(
      "#side input[placeholder*='Search' i], " +
        "#side [contenteditable='true'][role='textbox'], " +
        "#side [data-testid*='search'] input, " +
        "#side [data-testid*='search'] [contenteditable='true']"
    );
  }

  function setNotificationSearchValue(input, value) {
    if (!input) return false;
    input.focus();
    if (typeof input.value === "string") {
      var valueSetter =
        window.HTMLInputElement &&
        Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        );
      if (valueSetter && valueSetter.set) {
        valueSetter.set.call(input, value);
      } else {
        input.value = value;
      }
    } else {
      input.textContent = value;
    }
    try {
      input.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: value ? "insertText" : "deleteContentBackward",
          data: value || null,
        })
      );
    } catch (error) {
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    return true;
  }

  function beginNotificationSearch(title) {
    return new Promise(function (resolve) {
      var input = notificationSearchInput();
      if (input) {
        resolve(setNotificationSearchValue(input, title));
        return;
      }
      var side = document.querySelector("#side");
      var icon =
        side &&
        side.querySelector(
          "button[aria-label*='Search' i], [role='button'][aria-label*='Search' i], " +
            "[data-testid*='search'], [data-icon='search']"
        );
      var button =
        icon &&
        ((icon.closest &&
          icon.closest("button, [role='button'], [tabindex='0']")) ||
          icon);
      if (!button) {
        resolve(false);
        return;
      }
      // Opening search is a click too: route it through the trusted-click
      // command, then let WhatsApp render the search box before typing.
      requestTrustedClick(button, button).then(function () {
        window.setTimeout(function () {
          resolve(setNotificationSearchValue(notificationSearchInput(), title));
        }, 250);
      });
    });
  }

  function clearNotificationSearch() {
    var input = notificationSearchInput();
    if (!input) return;
    setNotificationSearchValue(input, "");
    if (typeof input.blur === "function") input.blur();
  }

  // DEEP-LINK OPEN BY PHONE (whatsapp://send?phone=X / wa.me links). Live
  // forensics (2026-09-17, CDP against the real app) proved: WhatsApp Web
  // keeps chats OUT of the URL — /send?phone exists only as the api
  // interstitial hand-off, and even a trusted click on a real chat row never
  // changes location. So a deep link can only open a chat through the app's
  // own UI primitives:
  //   1. KNOWN contact: find the chat-list row carrying this number (jid or
  //      href) and trusted-click it (the battle-tested toast-routing path).
  //      The chat opens IN PLACE, instantly — no navigation, no reload.
  //   2. UNKNOWN number: deliberately NOTHING (revert decision 2026-09-17:
  //      the api.whatsapp.com interstitial popup and the New-chat search
  //      choreography were both rejected as "messy second window" quirks,
  //      and a direct store-API open is impossible on current WhatsApp Web —
  //      no window.Store, no module registry from the page). The deep link's
  //      contract for unknown numbers is: WhatsNow rises and focuses, full
  //      stop. The user can paste the number into WhatsApp's own search.
  // Resolves "row" | "no-row" | "failed" so Rust can log the branch.
  window.__whatsnowOpenChatByPhone = function (phone) {
    var digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return Promise.resolve("failed");
    return new Promise(function (resolve) {
      var attempts = 0;
      var finished = false;
      var done = function (result) {
        if (finished) return;
        finished = true;
        invoke("dlog", { msg: "deep link: open by phone " + result });
        resolve(result);
      };
      var tryRow = function () {
        if (finished) return;
        attempts++;
        var route = { chatId: digits, chatTitle: "" };
        var row = findNotificationChatRow(route);
        if (row) {
          clickNotificationChatRow(row).then(function (clicked) {
            if (finished) return;
            if (!clicked) {
              if (attempts < 6) {
                window.setTimeout(tryRow, 500);
              } else {
                done("failed");
              }
              return;
            }
            // Verify the conversation actually switched (header matches the
            // number); the row click is trusted but the router can still lag.
            var started = Date.now();
            (function pollHeader() {
              if (finished) return;
              if (currentConversationMatches(route)) {
                done("row");
                return;
              }
              if (Date.now() - started >= 2500) {
                if (attempts < 6) {
                  window.setTimeout(tryRow, 400);
                } else {
                  done("failed");
                }
                return;
              }
              window.setTimeout(pollHeader, 150);
            })();
          });
          return;
        }
        // The chat list hydrates lazily on a cold start; give it ~3s total
        // before concluding the number is unknown.
        if (attempts < 6) {
          window.setTimeout(tryRow, 500);
          return;
        }
        // Unknown (or list not hydrated): by design, nothing further.
        done("no-row");
      };
      tryRow();
    });
  };

  window.__whatsnowOpenNotificationTarget = function (route) {
    route = route || {};
    return new Promise(function (resolve) {
      var attempts = 0;
      var searching = false;
      var completed = false;
      var verifyClick = function (opened) {
        // WhatsApp may take a moment to render the clicked conversation. Wait
        // briefly for the header to match; if it never does, the click did not
        // land and the retry loop must continue.
        var started = Date.now();
        (function pollHeader() {
          if (completed) return;
          if (currentConversationMatches(route)) {
            finish(true, searching ? "chat search" : "chat list");
            return;
          }
          if (Date.now() - started >= 1500) {
            openChat();
            return;
          }
          window.setTimeout(pollHeader, 120);
        })();
      };
      var finish = function (opened, method) {
        if (completed) return;
        completed = true;
        if (searching) clearNotificationSearch();
        invoke("dlog", {
          msg:
            "toast-route: " +
            (opened ? "opened target via " + method : "target not found"),
        });
        if (opened) {
          var highlightAttempts = 0;
          var highlightTimer = window.setInterval(function () {
            highlightAttempts++;
            if (highlightNotificationMessage(route) || highlightAttempts >= 12) {
              window.clearInterval(highlightTimer);
            }
          }, 200);
        }
        resolve(opened);
      };
      var drawerHandled = false;
      // A right-side drawer (contact/chat info) can cover the chat list and
      // swallow every click the routing makes. Close it once, before clicking.
      var closeOpenDrawer = function () {
        if (drawerHandled || completed) return Promise.resolve();
        var drawer = document.querySelector("[data-testid='drawer-right']");
        if (!drawer) return Promise.resolve();
        drawerHandled = true;
        var close =
          drawer.querySelector(
            "[data-testid*='close'], [data-testid*='back'], " +
              "[aria-label*='Close' i], [aria-label*='Back' i]"
          ) || drawer.querySelector("button");
        if (!close) return Promise.resolve();
        return requestTrustedClick(close, close).then(function () {});
      };
      var scheduleRetry = function () {
        if (completed) return;
        var continueAfter = function () {
          if (completed) return;
          // Quick phase (page freshly loaded) then a short long tail (the chat
          // list may still be hydrating while the app sits hidden in the tray).
          // Bounded: the whole budget is ~5s, then we give up visibly.
          var budget = attempts < 14 ? 125 : 500;
          if (attempts < 22) {
            window.setTimeout(openChat, budget);
          } else {
            finish(false, "");
          }
        };
        if (!searching && attempts >= 2 && route.chatTitle) {
          searching = true;
          beginNotificationSearch(route.chatTitle).then(continueAfter);
          return;
        }
        continueAfter();
      };
      var openChat = function () {
        if (completed) return;
        attempts++;
        if (currentConversationMatches(route)) {
          finish(true, "current conversation");
          return;
        }
        closeOpenDrawer().then(function () {
          if (completed) return;
          var row = findNotificationChatRow(route);
          if (row) {
            clickNotificationChatRow(row).then(function (clicked) {
              if (completed) return;
              if (clicked) {
                verifyClick(true);
              } else {
                scheduleRetry();
              }
            });
            return;
          }
          scheduleRetry();
        });
      };
      if (!route.chatId && !route.chatTitle) {
        finish(false, "");
        return;
      }
      openChat();
    });
  };

  try {
    var toastTargetStyle = document.createElement("style");
    toastTargetStyle.id = "whatsnow-toast-target-style";
    toastTargetStyle.textContent =
      ".whatsnow-toast-target{outline:2px solid #21c063!important;" +
      "outline-offset:3px!important;border-radius:8px!important;" +
      "animation:whatsnow-toast-pulse .7s ease-in-out 2}" +
      "@keyframes whatsnow-toast-pulse{50%{filter:brightness(1.2)}}";
    (document.head || document.documentElement).appendChild(toastTargetStyle);
  } catch (e) {}

  // 0) Page-error tap -> diagnostic log. WhatsApp failures (e.g. a media worker
  //    dying) are invisible at the process level; forward the page's error
  //    surface to dlog so a hang can be diagnosed from the log alone. Capped and
  //    truncated; technical error text only.
  try {
    var errCount = 0;
    var elog = function (m) {
      if (errCount >= 40) return;
      errCount++;
      try { invoke("dlog", { msg: ("pageerr: " + m).slice(0, 300) }); } catch (e) {}
    };
    window.addEventListener("error", function (e) {
      if (e && e.message) elog("onerror: " + e.message + " @" + (e.filename || "") + ":" + (e.lineno || 0));
    }, true);
    window.addEventListener("unhandledrejection", function (e) {
      var r = e && e.reason;
      elog("unhandledrejection: " + ((r && (r.stack || r.message)) || r));
    });
    // NOTE: we deliberately do NOT hook console.error — WhatsApp routes routine,
    // message-adjacent logs through it, which would risk leaking chat content into
    // the diagnostic log (dlog's no-PII rule). window.onerror / unhandledrejection /
    // worker-onerror capture genuine faults without that exposure.
    // Unhandled errors inside dedicated workers (WhatsApp's wasm media pipeline
    // runs there) never reach window.onerror; wrap the constructor to listen.
    var NativeWorker = window.Worker;
    if (typeof NativeWorker === "function") {
      var WrappedWorker = function Worker(url, opts) {
        var w = opts !== undefined ? new NativeWorker(url, opts) : new NativeWorker(url);
        try {
          w.addEventListener("error", function (e) {
            elog("worker onerror: " + ((e && e.message) || "?") + " @" + ((e && e.filename) || "") + ":" + ((e && e.lineno) || 0));
          });
        } catch (e) {}
        return w;
      };
      WrappedWorker.prototype = NativeWorker.prototype;
      window.Worker = WrappedWorker;
    }
  } catch (e) {}

  // 1) Client Hints shim — navigator.userAgentData is undefined in WebKit
  //    (WebKitGTK on Linux, WKWebView on macOS), which WhatsApp's capability
  //    check can trip over. On Windows WebView2 is Chromium: userAgentData is
  //    real and this shim is skipped. The platform token is derived from the
  //    UA string Rust set (per-OS CHROME_UA), so hints and UA agree instead of
  //    hardcoding "Linux" everywhere.
  try {
    var uaPlatform = /Macintosh|Mac OS X/.test(navigator.userAgent || "")
      ? "macOS"
      : /Windows/.test(navigator.userAgent || "")
        ? "Windows"
        : "Linux";
    var uaPlatformVersion = uaPlatform === "macOS" ? "13.0.0" : uaPlatform === "Windows" ? "10.0.0" : "6.0.0";
    if (!navigator.userAgentData) {
      Object.defineProperty(navigator, "userAgentData", {
        configurable: true,
        value: {
          brands: [
            { brand: "Chromium", version: "143" },
            { brand: "Google Chrome", version: "143" },
            { brand: "Not_A Brand", version: "24" },
          ],
          mobile: false,
          platform: uaPlatform,
          // Real Chrome returns the requested hints (and these fields are what WhatsApp's
          // capability/calling check reads). The previous shim omitted bitness,
          // fullVersionList and wow64 and left platformVersion empty, which a strict check
          // can treat as "not Chrome". Return the full, internally-consistent set; returning
          // hints that weren't asked for is harmless.
          getHighEntropyValues: function () {
            return Promise.resolve({
              architecture: "x86",
              bitness: "64",
              brands: [
                { brand: "Chromium", version: "143" },
                { brand: "Google Chrome", version: "143" },
                { brand: "Not_A Brand", version: "24" },
              ],
              fullVersionList: [
                { brand: "Chromium", version: "143.0.0.0" },
                { brand: "Google Chrome", version: "143.0.0.0" },
                { brand: "Not_A Brand", version: "24.0.0.0" },
              ],
              mobile: false,
              model: "",
              platform: uaPlatform,
              platformVersion: uaPlatformVersion,
              uaFullVersion: "143.0.0.0",
              wow64: false,
            });
          },
        },
      });
    }
  } catch (e) {}

  // 1b) Chrome environment marker. WhatsApp Web's eligibility checks probe for
  //     `window.chrome` beyond the UA and userAgentData (both spoofed above). Add a
  //     minimal, idempotent stand-in matching what a real Chrome minimally exposes;
  //     never clobber a genuine `window.chrome` (WebView2 on Windows has a real one).
  //     NOTE: this makes the *presentation* consistent; it cannot conjure missing
  //     engine APIs. Linux distro WebKitGTK ships no WebRTC backend, so calling
  //     stays unsupported there regardless (verified: RTCPeerConnection undefined
  //     with enable-webrtc on, webkit2gtk 2.52.3).
  try {
    if (!window.chrome) {
      Object.defineProperty(window, "chrome", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: { app: { isInstalled: false }, runtime: {} },
      });
    }
  } catch (e) {}

  // 2) Notification override — forward to a native OS notification via Rust.
  try {
    function ShimNotification(title, options) {
      options = options || {};
      this.title = title;
      this.body = options.body || "";
      this.onclick = null;
      this.onclose = null;
      this.onerror = null;
      this.onshow = null;
      nativeNotify(title, options);
    }
    ShimNotification.prototype.close = function () {
      if (typeof this.onclose === "function") this.onclose();
    };
    ShimNotification.prototype.addEventListener = function () {};
    ShimNotification.prototype.removeEventListener = function () {};
    ShimNotification.permission = "granted";
    ShimNotification.requestPermission = function (cb) {
      if (typeof cb === "function") cb("granted");
      return Promise.resolve("granted");
    };
    window.Notification = ShimNotification;
  } catch (e) {}

  // 2b) Service-worker notification path. Modern WhatsApp Web also raises notifications
  //     via ServiceWorkerRegistration.showNotification (e.g. when the tab is backgrounded),
  //     which the window.Notification shim above does NOT intercept — so those toasts never
  //     reached the OS. Override the page-side prototype method to forward through the same
  //     native `notify` command, and report an empty list from getNotifications (we render a
  //     native toast, so there is no in-page Notification object to hand back). We can only
  //     reach the page's prototype here; notifications fired from inside the service worker's
  //     own context are out of scope for a page-injected script.
  try {
    var SWR = window.ServiceWorkerRegistration;
    if (SWR && SWR.prototype && typeof SWR.prototype.showNotification === "function") {
      SWR.prototype.showNotification = function (title, options) {
        options = options || {};
        // Route through nativeNotify so the service-worker path shares the same de-dup
        // window as window.Notification (an alert that fires on both paths shows once).
        nativeNotify(title, options);
        // Real API resolves Promise<undefined>; match it so callers awaiting it don't break.
        return Promise.resolve();
      };
      if (typeof SWR.prototype.getNotifications === "function") {
        SWR.prototype.getNotifications = function () {
          return Promise.resolve([]);
        };
      }
    }
  } catch (e) {}

  // 3) Unread count — use both the document title and WhatsApp's accessible
  //    unread badges. Recent WhatsApp builds do not consistently put the count
  //    in <title>, which left the native tray/taskbar badge at zero. Only an
  //    integer crosses the IPC boundary; no contact name or message text does.
  // Read only the logged-in user's Profile > Name, then let Rust persist it
  // per account and set `WhatsNow — <name>`. No phone number, contact list,
  // chat, or message content crosses IPC.
  var lastProfileName = "";
  var pendingProfileName = "";
  function normalizeProfileName(value) {
    var name = String(value || "").replace(/\s+/g, " ").trim();
    if (
      !name ||
      name.length > 60 ||
      /[\u0000-\u001f\u007f]/.test(name) ||
      /^(name|your name|profile|you|whatsapp)$/i.test(name)
    ) {
      return "";
    }
    return name;
  }

  window.__whatsnowPromoProbe = Object.freeze({
    matches: isOfficialAppPromo,
    hide: hideOfficialAppPromos,
  });

  function profileNameFromRecord(record) {
    if (!record || typeof record !== "object") return "";
    var keys = ["pushname", "pushName", "name", "shortName", "notifyName"];
    for (var index = 0; index < keys.length; index++) {
      var candidate = normalizeProfileName(record[keys[index]]);
      if (candidate) return candidate;
    }
    return "";
  }

  function reportProfileName(value) {
    var name = normalizeProfileName(value);
    if (
      !name ||
      name === lastProfileName ||
      name === pendingProfileName
    ) {
      return false;
    }
    pendingProfileName = name;
    invokeChecked("set_profile_name", { name: name })
      .then(function () {
        lastProfileName = name;
        invoke("dlog", { msg: "profile-title: self name applied" });
      })
      .catch(function () {
        invoke("dlog", { msg: "profile-title: native update rejected" });
      })
      .then(function () {
        pendingProfileName = "";
      });
    return true;
  }

  function selfIdsFromLocalStorage() {
    var ids = [];
    try {
      var keys = ["last-wid-md", "last-wid", "WALid"];
      for (var keyIndex = 0; keyIndex < keys.length; keyIndex++) {
        var raw = localStorage.getItem(keys[keyIndex]) || "";
        var matches =
          raw.match(/\d{5,}(?::\d+)?@(?:s\.whatsapp\.net|c\.us|lid)/gi) || [];
        for (var matchIndex = 0; matchIndex < matches.length; matchIndex++) {
          var id = matches[matchIndex]
            .replace(/:\d+(?=@)/, "")
            .replace(/@c\.us$/i, "@s.whatsapp.net");
          if (ids.indexOf(id) === -1) ids.push(id);
        }
      }
    } catch (e) {}
    return ids;
  }

  var profileStorageRunning = false;
  var profileStorageLastAttempt = 0;
  function resolveProfileNameFromStorage() {
    try {
      var now = Date.now();
      if (
        lastProfileName ||
        profileStorageRunning ||
        now - profileStorageLastAttempt < 4000
      ) {
        return;
      }
      profileStorageLastAttempt = now;
      if (
        !window.indexedDB ||
        typeof window.indexedDB.databases !== "function"
      ) {
        return;
      }
      var ids = selfIdsFromLocalStorage();
      if (!ids.length) {
        invoke("dlog", { msg: "profile-title: no self id in local storage" });
        return;
      }
      profileStorageRunning = true;
      window.indexedDB.databases().then(function (databases) {
        var exists = (databases || []).some(function (database) {
          return database && database.name === "model-storage";
        });
        if (!exists) {
          invoke("dlog", { msg: "profile-title: model-storage unavailable" });
          profileStorageRunning = false;
          return;
        }
        var request = window.indexedDB.open("model-storage");
        request.onsuccess = function () {
          var database = request.result;
          try {
            if (!database.objectStoreNames.contains("contact")) {
              database.close();
              profileStorageRunning = false;
              return;
            }
            var transaction = database.transaction(["contact"], "readonly");
            var store = transaction.objectStore("contact");
            var idIndex = 0;
            function readNext() {
              if (idIndex >= ids.length) {
                database.close();
                profileStorageRunning = false;
                return;
              }
              var contactRequest = store.get(ids[idIndex++]);
              contactRequest.onsuccess = function () {
                var name = profileNameFromRecord(contactRequest.result);
                if (name) {
                  reportProfileName(name);
                  database.close();
                  profileStorageRunning = false;
                } else {
                  readNext();
                }
              };
              contactRequest.onerror = readNext;
            }
            readNext();
          } catch (e) {
            database.close();
            profileStorageRunning = false;
          }
        };
        request.onerror = function () {
          profileStorageRunning = false;
        };
      }).catch(function () {
        profileStorageRunning = false;
      });
    } catch (e) {
      profileStorageRunning = false;
    }
  }

  function visibleProfileName() {
    if (!document.querySelectorAll) return "";
    var fields = document.querySelectorAll(
      'input, [contenteditable="true"][role="textbox"], [contenteditable="true"]'
    );
    for (var index = 0; index < fields.length; index++) {
      var field = fields[index];
      var descriptor = String(
        (field.getAttribute &&
          (field.getAttribute("aria-label") ||
            field.getAttribute("title") ||
            field.getAttribute("data-testid") ||
            field.getAttribute("name"))) ||
          ""
      );
      var nearby = field.parentElement && field.parentElement.textContent;
      if (
        !/(?:your|profile|push)?\s*name/i.test(descriptor) &&
        !/^\s*name\b/i.test(String(nearby || ""))
      ) {
        continue;
      }
      var value =
        typeof field.value === "string" ? field.value : field.textContent;
      var name = normalizeProfileName(value);
      if (name) return name;
    }

    // In view mode WhatsApp renders the value as text beside an exact "Name"
    // label instead of an editable field. Keep this lookup local to that row and
    // reject explanatory prose so a chat/contact name cannot be selected.
    var labels = document.querySelectorAll("label, span, div");
    for (var labelIndex = 0; labelIndex < labels.length; labelIndex++) {
      if (String(labels[labelIndex].textContent || "").trim() !== "Name") continue;
      var scope = labels[labelIndex].parentElement;
      for (var depth = 0; depth < 3 && scope; depth++, scope = scope.parentElement) {
        var candidates = scope.querySelectorAll(
          'input, [contenteditable="true"], [dir="auto"]'
        );
        for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
          var candidateElement = candidates[candidateIndex];
          if (candidateElement.contains && candidateElement.contains(labels[labelIndex])) {
            continue;
          }
          var candidateValue =
            typeof candidateElement.value === "string"
              ? candidateElement.value
              : candidateElement.textContent;
          var candidateName = normalizeProfileName(candidateValue);
          if (
            candidateName &&
            !/[.!?]\s/.test(candidateName) &&
            !/username|visible to|contacts|pin/i.test(candidateName)
          ) {
            return candidateName;
          }
        }
      }
    }
    return "";
  }

  var profileDiscoveryStarted = false;
  var profileDiscoveryAttempts = 0;
  function requestProfileDiscovery() {
    if (
      lastProfileName ||
      profileDiscoveryStarted ||
      profileDiscoveryAttempts >= 3 ||
      !document.querySelectorAll
    ) {
      return;
    }
    var controls = document.querySelectorAll(
      'button, [role="button"], [aria-label], [title]'
    );
    var you = null;
    for (var index = 0; index < controls.length; index++) {
      var label = String(
        (controls[index].getAttribute &&
          (controls[index].getAttribute("aria-label") ||
            controls[index].getAttribute("title"))) ||
          controls[index].textContent ||
          ""
      )
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (label === "you") {
        you = controls[index];
        break;
      }
    }
    if (!you) {
      return;
    }

    var alreadyVisible = visibleProfileName();
    if (alreadyVisible) {
      reportProfileName(alreadyVisible);
      return;
    }

    profileDiscoveryStarted = true;
    profileDiscoveryAttempts++;
    invoke("dlog", { msg: "profile-title: opening You panel read-only" });
    // Opening this local panel is read-only. Close it again after two bounded
    // reads so the user's previous chat remains the visible workspace.
    you.click();
    setTimeout(function () {
      var name = visibleProfileName();
      invoke("dlog", { msg: "profile-title: first panel read=" + Boolean(name) });
      reportProfileName(name);
    }, 500);
    setTimeout(function () {
      var name = visibleProfileName();
      invoke("dlog", { msg: "profile-title: second panel read=" + Boolean(name) });
      reportProfileName(name);
      if (you.isConnected !== false) you.click();
      if (!lastProfileName) {
        profileDiscoveryStarted = false;
      }
    }, 1100);
  }

  window.__whatsnowProfileProbe = Object.freeze({
    normalize: normalizeProfileName,
    fromRecord: profileNameFromRecord,
    selfIds: selfIdsFromLocalStorage,
    externalWebLink: externalWebLink,
    isWhatsAppFamilyHost: isWhatsAppFamilyHost,
    waMeSendUrl: waMeSendUrl,
  });

  function parseUnreadNumber(value) {
    var text = String(value || "");
    var match = text.match(/(?:^|\s)(\d{1,4})\+?\s+unread\b/i);
    if (/whatsapp/i.test(text)) match = text.match(/\(\s*(\d{1,4})\+?\s*\)/) || match;
    return match ? Math.min(9999, Number(match[1]) || 0) : 0;
  }

  function readBadgeNumber(element) {
    if (!element) return 0;
    var values = [
      element.getAttribute && element.getAttribute("aria-label"),
      element.getAttribute && element.getAttribute("title"),
      element.textContent,
    ];
    for (var index = 0; index < values.length; index++) {
      var count = parseUnreadNumber(values[index]);
      if (count > 0) return count;
      var numeric = String(values[index] || "").trim().match(/^(\d{1,4})\+?$/);
      if (numeric) return Math.min(9999, Number(numeric[1]) || 0);
    }
    return 0;
  }

  function collectUnreadCount() {
    if (!document.querySelectorAll) return 0;
    var selectors = [
      '[aria-label*="unread message" i]',
      '[data-testid="icon-unread-count"]',
      '[data-icon="unread-count"]',
      '[data-testid*="unread-count"]',
    ];
    var seen = [];
    var total = 0;
    for (var selectorIndex = 0; selectorIndex < selectors.length; selectorIndex++) {
      var nodes = document.querySelectorAll(selectors[selectorIndex]);
      for (var nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
        var node = nodes[nodeIndex];
        var owner =
          (node.closest &&
            node.closest('[aria-label*="unread message" i], [data-testid*="unread-count"]')) ||
          node.parentElement ||
          node;
        if (seen.indexOf(owner) !== -1) continue;
        var count = readBadgeNumber(owner) || readBadgeNumber(node);
        if (count === 0 && owner.parentElement) {
          count = readBadgeNumber(owner.parentElement);
        }
        if (count > 0) {
          seen.push(owner);
          total = Math.min(9999, total + count);
        }
      }
    }
    return total;
  }

  // Service workers can emit a notification from their own execution context,
  // beyond the page prototype overridden above. If an unread badge increases and
  // no rich notification reached us, derive the newest chat preview from the
  // accessible chat row. This covers direct, group, and community rows alike.
  function latestUnreadDetail() {
    if (!document.querySelectorAll) return null;
    var badges = document.querySelectorAll(
      '[aria-label*="unread message" i], [data-testid="icon-unread-count"], [data-icon="unread-count"], [data-testid*="unread-count"]'
    );
    for (var index = badges.length - 1; index >= 0; index--) {
      var badge = badges[index];
      var row =
        (badge.closest &&
          badge.closest('[data-testid="cell-frame-container"], [role="row"]')) ||
        badge.parentElement;
      if (!row) continue;
      var titleNode = row.querySelector && row.querySelector("[title]");
      var title = titleNode && String(titleNode.getAttribute("title") || "").trim();
      if (!title) continue;
      var pieces = row.querySelectorAll
        ? Array.from(row.querySelectorAll('[dir="auto"], span'))
            .map(function (node) {
              return String(node.textContent || "").replace(/\s+/g, " ").trim();
            })
            .filter(function (text) {
              return text && text !== title && !/^\d{1,2}:\d{2}$/.test(text) && !/^\d+\+?$/.test(text);
            })
        : [];
      var body = pieces.length ? pieces[pieces.length - 1] : "";
      var chatId =
        (row.getAttribute &&
          (row.getAttribute("data-id") || row.getAttribute("data-chat-id"))) ||
        "";
      var messageNode =
        row.querySelector &&
        row.querySelector("[data-message-id],[data-id*='true_'],[data-id*='false_']");
      var messageId =
        (messageNode &&
          (messageNode.getAttribute("data-message-id") ||
            messageNode.getAttribute("data-id"))) ||
        "";
      return {
        title: title,
        body: body,
        chatId: chatId,
        messageId: messageId,
      };
    }
    return null;
  }

  var lastUnread = -1;
  function report() {
    var titleCount = parseUnreadNumber(document.title);
    var badgeCount = collectUnreadCount();
    var count = Math.max(titleCount, badgeCount);
    if (count === lastUnread) return;
    var previousUnread = lastUnread;
    lastUnread = count;
    invoke("set_unread_count", { count: count });
    if (previousUnread < 0) {
      var initialDetail = latestUnreadDetail();
      if (initialDetail) {
        rememberNotification(
          notificationDetails(initialDetail.title, {
            body: initialDetail.body,
            data: {
              chatTitle: initialDetail.title,
              chatId: initialDetail.chatId,
              messageId: initialDetail.messageId,
            },
          }),
          Date.now()
        );
      }
      return;
    }
    if (count > previousUnread) {
      var observedAt = Date.now();
      setTimeout(function () {
        if (lastRichNotificationAt >= observedAt) return;
        var detail = latestUnreadDetail();
        if (!detail) return;
        nativeNotify(detail.title, {
          body: detail.body,
          data: {
            chatTitle: detail.title,
            chatId: detail.chatId,
            messageId: detail.messageId,
            messageText: detail.body,
          },
        });
      }, 650);
    }
  }

  // The authorship card is intentionally scoped to WhatsApp's You/account
  // surface: it is only inserted immediately after an actual Log out control.
  // It never appears on the ordinary chat surface.
  function installAuthorCredit() {
    if (
      !document.querySelectorAll ||
      !document.createElement ||
      document.getElementById("whatsnow-author-credit")
    ) {
      return;
    }
    var controls = document.querySelectorAll('button, [role="button"]');
    var logout = null;
    for (var index = 0; index < controls.length; index++) {
      var control = controls[index];
      var label = String(
        (control.getAttribute &&
          (control.getAttribute("aria-label") || control.getAttribute("title"))) ||
          control.textContent ||
          ""
      )
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (label === "log out" || label === "logout") {
        logout = control;
        break;
      }
    }
    if (!logout) {
      // WhatsApp's current You panel renders the visible "Log out" label
      // several levels inside a clickable role=button container whose own
      // aria-label describes its icon. Resolve from the exact visible label
      // back to that control without matching ordinary chat text.
      var labels = document.querySelectorAll("span, div");
      for (var labelIndex = 0; labelIndex < labels.length; labelIndex++) {
        var labelText = String(labels[labelIndex].textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        if (labelText !== "log out" && labelText !== "logout") continue;
        var clickable =
          labels[labelIndex].closest &&
          labels[labelIndex].closest('button, [role="button"]');
        if (clickable) {
          logout = clickable;
          break;
        }
      }
    }
    if (!logout || !logout.parentElement) return;

    var card = document.createElement("div");
    card.id = "whatsnow-author-credit";
    card.setAttribute("role", "note");
    card.setAttribute("aria-label", "WhatsNow author");
    card.innerHTML =
      '<span class="whatsnow-credit-thanks">Thank you for choosing WhatsNow.</span>' +
      '<span class="whatsnow-credit-author">Crafted with care by <a href="https://github.com/benedictusrey" target="_blank" rel="noreferrer">@benedictusrey</a> · sole author &amp; maintainer</span>';

    // WhatsApp nests the clickable logout control inside a horizontal row.
    // Insert after that row, not inside it, so the note occupies its own line.
    var row = logout.parentElement;
    var parent = row && row.parentElement;
    if (!row || !parent) return;
    parent.insertBefore(card, row.nextSibling);

    if (!document.getElementById("whatsnow-author-credit-style")) {
      var style = document.createElement("style");
      style.id = "whatsnow-author-credit-style";
      style.textContent =
        "#whatsnow-author-credit{" +
        "display:grid;grid-column:1/-1;align-self:stretch;flex:0 0 auto;" +
        "box-sizing:border-box;width:auto;gap:3px;margin:10px 12px 4px;padding:11px 13px;" +
        "border:1px solid color-mix(in srgb,var(--WDS-content-default,#54656f) 18%,transparent);" +
        "border-radius:12px;background:color-mix(in srgb,var(--WDS-background-wash-plain,#f0f2f5) 82%,transparent);" +
        "font:400 12px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif;" +
        "color:var(--WDS-content-secondary,#667781)}" +
        "#whatsnow-author-credit .whatsnow-credit-thanks{color:var(--WDS-content-default,#111b21);font-weight:600}" +
        "#whatsnow-author-credit .whatsnow-credit-author{font-size:11px}" +
        "#whatsnow-author-credit a{color:var(--WDS-content-link,#008069);font-weight:700;text-decoration:none}" +
        "#whatsnow-author-credit a:hover{text-decoration:underline}";
      (document.head || document.documentElement).appendChild(style);
    }
  }

  var probeTimer = 0;
  function scheduleProbe() {
    if (probeTimer) return;
    probeTimer = setTimeout(function () {
      probeTimer = 0;
      report();
      reportProfileName(visibleProfileName());
      resolveProfileNameFromStorage();
      requestProfileDiscovery();
      installAuthorCredit();
    }, 220);
  }

  function start() {
    try {
      var titleElement = document.querySelector("title");
      if (titleElement) {
        new MutationObserver(scheduleProbe).observe(titleElement, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      }
      if (document.body) {
        new MutationObserver(scheduleProbe).observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["aria-label", "data-testid", "data-icon"],
        });
      }
      setInterval(scheduleProbe, 2000); // fallback if WhatsApp replaces an observed root
      report();
      reportProfileName(visibleProfileName());
      resolveProfileNameFromStorage();
      setTimeout(requestProfileDiscovery, 1200);
      installAuthorCredit();
    } catch (e) {}
  }
  window.__whatsnowUnreadProbe = Object.freeze({
    parse: parseUnreadNumber,
    collect: collectUnreadCount,
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  // 4) Drag-and-drop file injection.
  //    The native webview never delivers an OS file drop into this page on any platform
  //    (Tauri's drop handler consumes it), so Rust captures the drop (window.rs
  //    `register_drop_handler`) and STREAMS the file bytes here through
  //    `__whatsnowDropFeed` as begin/chunk/end/commit messages keyed by a drop id.
  //    Chunked transport (vs the old single giant eval) keeps peak memory at one
  //    ~5.6 MB base64 chunk per step and stays far below WebView2's cross-process
  //    message ceiling; each chunk is standalone base64 (Rust emits multiple-of-3
  //    byte chunks) decoded to bytes on arrival.
  //
  //    WhatsApp Web keeps a sticker-creator <input type=file> (image-only accept) ALWAYS
  //    mounted, but mounts the real "Photos & videos" input (accept includes video) and
  //    the "Document" input (accept "*") only when the attach (+) menu is opened. Targeting
  //    a file input blindly therefore lands on the sticker input — which turns photos into
  //    stickers and rejects video/documents. So we ROUTE BY TYPE: open the attach menu to
  //    mount the right input, then set its .files and fire change (React's onChange fires
  //    for synthetic bubbling events; it doesn't check isTrusted, and input.files is
  //    settable in WebKit). Images + native videos -> media input; everything else (zip,
  //    pdf, docs, webm/mkv/avi) -> document input. We never use the sticker input.
  //
  //    A MIXED drop (media + documents) routes EVERYTHING through the Document input:
  //    one composer per drop, and the document input accepts every file — a photo sent
  //    as a file still arrives, whereas the old "media wins" policy silently discarded
  //    the documents. Drops are queued and injected ONE AT A TIME (a later drop waits
  //    for the earlier composer), so two quick drops can't overwrite each other's
  //    input.files. There is no content dedupe: distinct same-named files both attach;
  //    replays are impossible because every drop carries a unique Rust-side id.
  try {
    var drop = {};
    drop.log = function (m) {
      try { console.log("[WhatsNow drop] " + m); } catch (e) {}
      try { invoke("dlog", { msg: String(m).slice(0, 280) }); } catch (e) {}
    };
    drop.b64ToBytes = function (b64) {
      var bin = atob(b64),
        n = bin.length,
        u = new Uint8Array(n);
      for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
      return u;
    };
    drop.dataTransfer = function (files) {
      var dt = new DataTransfer();
      for (var i = 0; i < files.length; i++) dt.items.add(files[i]);
      return dt;
    };
    // Only these video types are accepted by WhatsApp's Photos & Videos input; other
    // video containers (webm/mkv/avi) are rejected there and must go as a document.
    drop.NATIVE_VIDEO = { "video/mp4": 1, "video/3gpp": 1, "video/quicktime": 1 };
    drop.isMedia = function (type) {
      return /^image\//.test(type || "") || drop.NATIVE_VIDEO[type] === 1;
    };
    drop.qs = function (sels) {
      for (var i = 0; i < sels.length; i++) {
        var e = document.querySelector(sels[i]);
        if (e) return e;
      }
      return null;
    };
    drop.conversationPanel = function () {
      return drop.qs([
        '[data-testid="conversation-panel-body"]',
        '[data-testid="conversation-panel-messages"]',
        '[data-testid="conversation-panel-wrapper"]',
      ]);
    };
    drop.currentChatTitle = function () {
      var header = drop.qs([
        '[data-testid="conversation-header"]',
        '[data-testid="conversation-info-header"]',
        'header[data-tab]',
      ]);
      if (!header) return "";
      var named = header.querySelector &&
        header.querySelector("[title], [aria-label], [data-testid='conversation-info-header-chat-title']");
      return normalizedRouteText(
        (named && (named.getAttribute("title") || named.getAttribute("aria-label"))) ||
        (named && named.textContent) ||
        header.textContent
      );
    };
    drop.findChatRow = function (title) {
      var list = drop.qs([
        "#pane-side",
        '[data-testid="chat-list"]',
        '[aria-label="Chat list"]',
      ]);
      if (!list || !list.querySelectorAll) return null;
      var selected = list.querySelector &&
        list.querySelector("[aria-selected='true'], [data-selected='true']");
      if (selected) {
        return selected.closest &&
          selected.closest("[data-testid='cell-frame-container'], [role='row'], [data-id]") ||
          selected;
      }
      if (!title) return null;
      var rows = list.querySelectorAll(
        "[data-testid='cell-frame-container'], [role='row'], [data-id]"
      );
      // Same smallest-match rule as findNotificationChatRow: the list body's
      // giant wrapper also matches by title text and its off-screen center
      // would make every click land nowhere.
      var best = null;
      var bestArea = Infinity;
      for (var index = 0; index < rows.length; index++) {
        if (!routeValueMatches(rows[index], "", title)) continue;
        var rect = null;
        try {
          rect = rows[index].getBoundingClientRect();
        } catch (e) {}
        var area =
          rect && rect.width > 0 && rect.height > 0
            ? rect.width * rect.height
            : Infinity;
        if (area < bestArea) {
          bestArea = area;
          best = rows[index];
        }
      }
      return best;
    };
    drop.captureChat = function () {
      var title = drop.currentChatTitle();
      return {
        title: title,
        row: drop.findChatRow(title),
        hadConversation: !!drop.conversationPanel(),
      };
    };
    drop.ensureChat = function (snapshot) {
      if (!snapshot || !snapshot.hadConversation) return Promise.resolve(false);
      var panel = drop.conversationPanel();
      var currentTitle = drop.currentChatTitle();
      if (
        panel &&
        (!snapshot.title || !currentTitle || currentTitle === snapshot.title)
      ) {
        return Promise.resolve(true);
      }
      var row = snapshot.row;
      if (!row || row.isConnected === false || typeof row.click !== "function") {
        row = drop.findChatRow(snapshot.title);
      }
      if (!row || typeof row.click !== "function") return Promise.resolve(false);
      row.click();
      return drop.poll(drop.conversationPanel, 1200).then(function (restored) {
        return !!restored;
      });
    };
    // The media input is the only file input whose accept lists a video type; the sticker
    // input is image-only, so it can never match this. isConnected guards against a
    // stale input left over from a torn-down composer.
    drop.findMediaInput = function () {
      var ins = document.querySelectorAll('input[type="file"]');
      for (var i = 0; i < ins.length; i++) {
        if (ins[i].isConnected !== false && /video/i.test(ins[i].accept || "")) return ins[i];
      }
      return null;
    };
    // The document input accepts everything (accept "*"/""/no image+video). The sticker
    // input (image-only) and media input (has video) are both excluded.
    drop.findDocInput = function () {
      var ins = document.querySelectorAll('input[type="file"]');
      for (var i = 0; i < ins.length; i++) {
        if (ins[i].isConnected === false) continue;
        var a = (ins[i].accept || "").trim();
        if (a === "" || a === "*" || a === "*/*") return ins[i];
        if (!/image/i.test(a) && !/video/i.test(a)) return ins[i];
      }
      return null;
    };
    drop.openMenu = function () {
      var b = drop.qs([
        '[data-icon="plus"]',
        '[data-icon="attach-menu-plus"]',
        '[data-icon="clip"]',
        '[data-testid="clip"]',
        'button[title="Attach"]',
        '[aria-label="Attach"]',
        '[title="Attach"]',
      ]);
      if (!b) return false;
      (b.closest('button,[role="button"],div[role="button"]') || b).click();
      return true;
    };
    drop.pickerSuppressedUntil = 0;
    drop.installPickerGuard = function () {
      if (drop.pickerGuardInstalled || !document.addEventListener) return;
      drop.pickerGuardInstalled = true;
      document.addEventListener(
        "click",
        function (event) {
          var target = event.target;
          if (
            Date.now() < drop.pickerSuppressedUntil &&
            target &&
            String(target.tagName || "").toLowerCase() === "input" &&
            String(target.type || "").toLowerCase() === "file"
          ) {
            event.preventDefault();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          }
        },
        true
      );
    };
    drop.withPickerSuppressed = function (action) {
      drop.installPickerGuard();
      drop.pickerSuppressedUntil = Date.now() + 1500;
      var prototype =
        window.HTMLInputElement && window.HTMLInputElement.prototype;
      var nativeClick = prototype && prototype.click;
      var nativeShowPicker = prototype && prototype.showPicker;
      var guardedClick = null;
      var guardedShowPicker = null;
      if (prototype && typeof nativeClick === "function") {
        guardedClick = function () {
          if (
            Date.now() < drop.pickerSuppressedUntil &&
            String(this.type || "").toLowerCase() === "file"
          ) {
            drop.log("native file picker suppressed during drop attachment");
            return;
          }
          return nativeClick.apply(this, arguments);
        };
        prototype.click = guardedClick;
      }
      if (prototype && typeof nativeShowPicker === "function") {
        guardedShowPicker = function () {
          if (
            Date.now() < drop.pickerSuppressedUntil &&
            String(this.type || "").toLowerCase() === "file"
          ) {
            drop.log("native showPicker suppressed during drop attachment");
            return;
          }
          return nativeShowPicker.apply(this, arguments);
        };
        prototype.showPicker = guardedShowPicker;
      }
      try {
        return action();
      } finally {
        setTimeout(function () {
          if (prototype && prototype.click === guardedClick) {
            prototype.click = nativeClick;
          }
          if (prototype && prototype.showPicker === guardedShowPicker) {
            prototype.showPicker = nativeShowPicker;
          }
        }, 1550);
      }
    };
    drop.clickMenuItem = function (kind) {
      var sels =
        kind === "media"
          ? ['[data-testid="attach-image"]', '[data-icon="media-multiple"]', '[aria-label*="Photos"]', '[aria-label*="hoto"]']
          : ['[data-testid="attach-document"]', '[data-icon="document"]', '[aria-label*="Document"]', '[aria-label*="ocument"]'];
      var e = drop.qs(sels);
      if (!e) return false;
      var control =
        e.closest('li,button,[role="button"],div[role="button"]') || e;
      drop.withPickerSuppressed(function () {
        control.click();
      });
      return true;
    };
    drop.poll = function (fn, ms) {
      return new Promise(function (resolve) {
        var t0 = Date.now();
        (function p() {
          var r = fn();
          if (r) return resolve(r);
          if (Date.now() - t0 >= ms) return resolve(null);
          setTimeout(p, 60);
        })();
      });
    };
    drop.inject = function (input, files) {
      var dt = drop.dataTransfer(files);
      try {
        input.files = dt.files; // settable in WebKit + Blink (WHATWG html#2861)
      } catch (e) {
        drop.log("input.files assign threw: " + e);
        return false;
      }
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    };
    // Primary path: recreate the file drop over the active conversation so
    // WhatsApp opens its confirmation composer without opening Attach first.
    drop.directDrop = function (files) {
      var target = drop.conversationPanel();
      if (!target || typeof target.dispatchEvent !== "function") return false;
      var dt = drop.dataTransfer(files);
      ["dragenter", "dragover", "drop"].forEach(function (type) {
        var event;
        try {
          event = new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
          });
        } catch (error) {
          event = new Event(type, { bubbles: true, cancelable: true });
          try {
            Object.defineProperty(event, "dataTransfer", { value: dt });
          } catch (ignored) {}
        }
        target.dispatchEvent(event);
      });
      return true;
    };
    // Compatibility-only input mounting is kept invisible so the Attach menu
    // cannot flash before the confirmation composer.
    drop.hideAttachUi = function () {
      if (!document.createElement || document.getElementById("whatsnow-drop-menu-guard")) {
        return function () {};
      }
      var style = document.createElement("style");
      style.id = "whatsnow-drop-menu-guard";
      style.textContent =
        '[role="menu"],[data-animate-dropdown],[data-testid^="attach-"]{opacity:0!important;visibility:hidden!important;transition:none!important;animation:none!important}';
      (document.head || document.documentElement).appendChild(style);
      return function () {
        try {
          document.dispatchEvent(new KeyboardEvent("keydown", {
            key: "Escape", code: "Escape", bubbles: true,
          }));
        } catch (error) {}
        setTimeout(function () {
          if (style.parentNode) style.parentNode.removeChild(style);
        }, 120);
      };
    };
    // Open the attach menu (which mounts the lazily-rendered inputs) and inject into the
    // one matching `kind`. If opening the menu alone doesn't mount it, click the matching
    // submenu item with a narrowly timed file-input guard. The guard suppresses the
    // Windows picker while allowing WhatsApp to mount its input; injecting the dropped
    // files then opens WhatsApp's normal confirmation composer.
    drop.mountAndInject = function (kind, files) {
      var find = kind === "media" ? drop.findMediaInput : drop.findDocInput;
      var existing = find();
      if (existing) {
        drop.log(kind + " input already present");
        return Promise.resolve(drop.inject(existing, files));
      }
      var restoreAttachUi = drop.hideAttachUi();
      drop.openMenu();
      return drop.poll(find, 1000).then(function (input) {
        if (input) {
          var injected = drop.inject(input, files);
          restoreAttachUi();
          return injected;
        }
        drop.clickMenuItem(kind);
        return drop.poll(find, 1000).then(function (input2) {
          if (input2) {
            var injected2 = drop.inject(input2, files);
            restoreAttachUi();
            return injected2;
          }
          restoreAttachUi();
          drop.log(kind + " input NOT found after opening attach menu");
          return false;
        });
      });
    };
    // WhatsApp opens a media/document preview composer once a file is attached; used both
    // as the success signal and to hold the NEXT queued drop until the current composer
    // is closed. Best-effort selectors across WA Web versions.
    drop.composerOpen = function () {
      return !!(
        document.querySelector('[data-testid="media-caption-input-container"]') ||
        document.querySelector('[data-testid="media-editor"]') ||
        document.querySelector('[data-animate-modal-body="true"]') ||
        document.querySelector('span[data-icon="send"]') ||
        document.querySelector('span[data-icon="media-cancel"]')
      );
    };
    drop.waitFor = function (pred, ms) {
      return new Promise(function (resolve) {
        var t0 = Date.now();
        (function poll() {
          if (pred()) return resolve(true);
          if (Date.now() - t0 >= ms) return resolve(false);
          setTimeout(poll, 80);
        })();
      });
    };

    // --- chunked receive state ---
    // pending[dropId] = { files: { idx: {name,type,size,parts:[Uint8Array],got} } }
    drop.pending = Object.create(null);
    drop.inFlight = Object.create(null);
    // Discard a stream that never commits (e.g. Rust died mid-drop) after 60s.
    drop.touch = function (st) {
      if (st.gc) clearTimeout(st.gc);
      st.gc = setTimeout(function () {
        delete drop.pending[st.id];
        drop.log("drop #" + st.id + " expired uncommitted");
      }, 60000);
    };
    drop.state = function (id) {
      var st = drop.pending[id];
      if (!st) {
        st = drop.pending[id] = {
          id: id,
          files: Object.create(null),
          chat: drop.captureChat(),
          cancelled: false,
          transferActive: true,
          reservedAt: Date.now(),
        };
      }
      drop.touch(st);
      return st;
    };
    if (document.addEventListener) {
      document.addEventListener(
        "keydown",
        function (event) {
          if (
            !event ||
            event.key !== "Escape" ||
            drop.composerOpen()
          ) {
            return;
          }
          var latest = null;
          [drop.pending, drop.inFlight].forEach(function (states) {
            for (var id in states) {
              var candidate = states[id];
              if (
                candidate.transferActive &&
                (!latest || candidate.reservedAt > latest.reservedAt)
              ) {
                latest = candidate;
              }
            }
          });
          if (!latest) return;
          latest.cancelled = true;
          event.preventDefault();
          event.stopPropagation();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          drop.ensureChat(latest.chat);
          drop.log("drop #" + latest.id + " cancelled before attachment");
        },
        true
      );
    }

    // Serialized injection queue: one drop's composer at a time.
    drop.queue = Promise.resolve();
    drop.runQueued = function (job) {
      drop.queue = drop.queue.then(job, job);
    };

    drop.injectBatch = function (files, state) {
      var media = files.filter(function (f) { return drop.isMedia(f.type); });
      var docs = files.filter(function (f) { return !drop.isMedia(f.type); });
      // One composer per drop. A mixed batch goes WHOLLY through the document
      // input (it accepts everything) so no file is ever silently discarded.
      var kind, batch;
      if (media.length && docs.length) {
        kind = "document";
        batch = files;
        drop.log("mixed drop: routing all " + files.length + " file(s) as documents");
      } else if (media.length) {
        kind = "media";
        batch = media;
      } else {
        kind = "document";
        batch = docs;
      }
      return drop.ensureChat(state.chat).then(function (chatReady) {
        if (!chatReady || state.cancelled) return false;
        drop.log("drop: sending " + batch.length + " file(s) directly to the conversation");
        var sentDirectly = drop.directDrop(batch);
        return drop.waitFor(drop.composerOpen, sentDirectly ? 700 : 0).then(function (openedDirectly) {
          if (openedDirectly) return true;
          if (state.cancelled) return false;
          drop.log("direct drop not accepted; using hidden compatibility input");
          return drop.mountAndInject(kind, batch);
        });
      }).then(function (ok) {
        drop.log(kind + " inject " + (ok ? "dispatched" : "FAILED"));
        if (state.cancelled) return drop.ensureChat(state.chat);
        return drop.waitFor(drop.composerOpen, 1800).then(function (open) {
          drop.log("composer " + (open ? "opened" : "NOT detected") + " (" + kind + ")");
          if (!open) return drop.ensureChat(state.chat);
          // Hold the queue until this composer closes (sent/cancelled), so the
          // next drop doesn't fight it for the attach flow. Bounded wait.
          return drop.waitFor(function () { return !drop.composerOpen(); }, 120000)
            .then(function () {
              return drop.ensureChat(state.chat);
            });
        });
      });
    };

    // Rust-side feed. Messages: {op:"begin",drop,file,name,type,size} ->
    // {op:"chunk",drop,file,b64}* -> {op:"end",drop,file} | {op:"abort",drop,file},
    // then one {op:"commit",drop,files}. Returns a string ack for commit (read by
    // eval_with_callback in Rust, proving the handler executed).
    window.__whatsnowDropFeed = function (msg) {
      try {
        if (!msg || typeof msg.drop !== "number") return "BADMSG";
        var st = drop.state(msg.drop);
        if (msg.op === "reserve") return "RESERVED";
        if (msg.op === "begin") {
          st.files[msg.file] = {
            name: String(msg.name || "file"),
            type: String(msg.type || "application/octet-stream"),
            size: msg.size >>> 0,
            parts: [],
            got: 0,
            done: false,
          };
          return "OK";
        }
        var f = st.files[msg.file];
        if (msg.op === "chunk") {
          if (!f || f.done) return "NOFILE";
          var bytes = drop.b64ToBytes(msg.b64 || "");
          f.parts.push(bytes);
          f.got += bytes.length;
          return "OK";
        }
        if (msg.op === "end") {
          if (f) f.done = true;
          return "OK";
        }
        if (msg.op === "abort") {
          delete st.files[msg.file];
          drop.log("drop #" + st.id + " file " + msg.file + " aborted by sender");
          return "OK";
        }
        if (msg.op === "commit") {
          if (st.gc) clearTimeout(st.gc);
          delete drop.pending[st.id];
          if (st.cancelled) {
            st.transferActive = false;
            drop.ensureChat(st.chat);
            return "CANCELLED";
          }
          var files = [];
          for (var k in st.files) {
            var e = st.files[k];
            if (!e.done || e.got !== e.size) {
              drop.log("drop #" + st.id + " file " + k + " incomplete (" + e.got + "/" + e.size + "), skipped");
              continue;
            }
            files.push(new File(e.parts, e.name, { type: e.type }));
            e.parts = null; // release chunk references once the File owns the data
          }
          if (files.length === 0) return "EMPTY";
          drop.inFlight[st.id] = st;
          drop.runQueued(function () {
            var finish = function () {
              st.transferActive = false;
              delete drop.inFlight[st.id];
            };
            return drop.injectBatch(files, st).then(finish, function (e) {
              drop.log("inject error: " + e);
              finish();
            });
          });
          return "QUEUED:" + files.length;
        }
        return "BADOP";
      } catch (e) {
        drop.log("feed error: " + e);
        return "ERR";
      }
    };
    drop.log("drop injector v3 (chunked, queued, no-loss routing) ready");
  } catch (e) {}
})();
