// WhatsNow settings shortcut, maintained by @benedictusrey.
// Adds one small WhatsNow button to the chat-list header, left of WhatsApp's own
// menu button, that opens WhatsNow Settings. It inserts exactly one sibling and
// never edits WhatsApp's nodes. When the header is not found (WhatsApp changed
// its markup) it does nothing and leaves no trace.
(function () {
  "use strict";
  if (window.location.origin !== "https://web.whatsapp.com") return;
  if (window.__whatsnowSettingsShortcut) return;

  var MARK = "data-whatsnow-settings-shortcut";
  var LABEL = "WhatsNow settings";
  var SVG_NS = "http://www.w3.org/2000/svg";

  // The chat-list header's three-dot menu is the only header button that opens
  // a menu (aria-haspopup), which keeps the lookup independent of the UI
  // language. The navigation rail's own header has no such button.
  var MENU_SELECTOR = "[data-testid='chatlist-header'] button[aria-haspopup='menu']";

  function svg(name, attributes, children) {
    var element = document.createElementNS(SVG_NS, name);
    for (var key in attributes) element.setAttribute(key, attributes[key]);
    for (var i = 0; children && i < children.length; i++) element.appendChild(children[i]);
    return element;
  }

  function gradient(id, x1, y1, x2, y2, stops) {
    return svg(
      "linearGradient",
      { id: id, x1: x1, y1: y1, x2: x2, y2: y2, gradientUnits: "userSpaceOnUse" },
      stops.map(function (stop) {
        return svg("stop", { offset: stop[0], "stop-color": stop[1] });
      })
    );
  }

  // The WhatsNow mark (src-tauri/icons/app-icon.svg) as inline SVG, so it needs
  // no network request and no image permission from the page.
  function buildMark() {
    return svg("svg", { viewBox: "0 0 512 512", width: "24", height: "24", "aria-hidden": "true", focusable: "false" }, [
      svg("defs", {}, [
        gradient("wnsc-bg", 66, 34, 452, 478, [[0, "#48e28b"], [0.48, "#13b86b"], [1, "#087f57"]]),
        gradient("wnsc-mono", 170, 176, 330, 306, [[0, "#19b967"], [1, "#087d55"]]),
      ]),
      svg("rect", { width: "512", height: "512", rx: "116", fill: "url(#wnsc-bg)" }),
      svg("path", {
        d: "M94 225c0-84 70-152 158-152s158 68 158 152-70 152-158 152c-25 0-49-5-71-16l-88 29 28-82c-18-24-27-53-27-83Z",
        fill: "#fff",
      }),
      svg("path", {
        d: "M177 302V183l145 119V183",
        fill: "none",
        stroke: "url(#wnsc-mono)",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "stroke-width": "29",
      }),
      svg("circle", { cx: "371", cy: "369", r: "88", fill: "#092f27", stroke: "#fff", "stroke-width": "17" }),
      svg("circle", { cx: "371", cy: "369", r: "68", fill: "#0d4436" }),
      svg("path", {
        d: "M371 330v43l34 21",
        fill: "none",
        stroke: "#fff",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "stroke-width": "18",
      }),
      svg("circle", { cx: "371", cy: "369", r: "8", fill: "#fff" }),
    ]);
  }

  function installStyle() {
    if (document.getElementById("whatsnow-settings-shortcut-style")) return;
    var style = document.createElement("style");
    style.id = "whatsnow-settings-shortcut-style";
    // Same 40px round hit area as WhatsApp's header buttons. Hover and focus use
    // WhatsApp's own design tokens, so every WhatsNow theme and both of
    // WhatsApp's light/dark modes stay consistent.
    style.textContent =
      "[" + MARK + "]{display:flex;flex:none;margin:0 -8px 0 8px}" +
      "[" + MARK + "] button{display:flex;align-items:center;justify-content:center;" +
      "width:40px;height:40px;padding:0;border:0;border-radius:50%;background:transparent;" +
      "cursor:pointer;outline:none;transition:background-color .12s ease}" +
      "[" + MARK + "] button:hover{background-color:var(--WDS-surface-highlight,rgba(128,128,128,.2))}" +
      "[" + MARK + "] button:active{background-color:var(--WDS-surface-emphasized,rgba(128,128,128,.28))}" +
      "[" + MARK + "] button:focus-visible{box-shadow:0 0 0 2px var(--WDS-accent,#25d366)}" +
      "@media (prefers-reduced-motion:reduce){[" + MARK + "] button{transition:none}}";
    (document.head || document.documentElement).appendChild(style);
  }

  function openSettings() {
    var tauri = window.__TAURI__;
    if (tauri && tauri.core && typeof tauri.core.invoke === "function") {
      try {
        var pending = tauri.core.invoke("open_whatsnow_settings");
        if (pending && typeof pending.catch === "function") pending.catch(function () {});
      } catch (e) {}
    }
  }

  function buildButton() {
    var holder = document.createElement("div");
    holder.setAttribute(MARK, "");
    var button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", LABEL);
    button.title = LABEL;
    button.appendChild(buildMark());
    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      openSettings();
    });
    holder.appendChild(button);
    return holder;
  }

  // The flex row that holds the header action buttons, and the direct child of
  // that row which wraps the menu button.
  function findActionRow(menuButton) {
    var node = menuButton;
    while (node && node.parentElement) {
      var parent = node.parentElement;
      if (parent.tagName === "HEADER") return null;
      var style = window.getComputedStyle(parent);
      if (style.display === "flex" && style.flexDirection.indexOf("row") === 0 && parent.children.length >= 2) {
        return { row: parent, wrapper: node };
      }
      node = parent;
    }
    return null;
  }

  function removeOurs() {
    var existing = document.querySelectorAll("[" + MARK + "]");
    for (var i = 0; i < existing.length; i++) existing[i].remove();
  }

  function ensure() {
    var menuButton = document.querySelector(MENU_SELECTOR);
    var target = menuButton && findActionRow(menuButton);
    if (!target) {
      removeOurs();
      return false;
    }
    var existing = target.row.querySelector(":scope > [" + MARK + "]");
    if (existing && existing.nextElementSibling === target.wrapper) {
      // Already in place. A stray duplicate elsewhere is cleaned below.
      var all = document.querySelectorAll("[" + MARK + "]");
      for (var i = 0; i < all.length; i++) if (all[i] !== existing) all[i].remove();
      return true;
    }
    removeOurs();
    installStyle();
    target.row.insertBefore(buildButton(), target.wrapper);
    return true;
  }

  // WhatsApp re-renders its header often. Run at once, then coalesce mutation
  // bursts into one trailing check so the observer stays cheap.
  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    window.setTimeout(function () {
      pending = false;
      try { ensure(); } catch (e) {}
    }, 250);
  }

  window.__whatsnowSettingsShortcut = Object.freeze({
    ensure: ensure,
  });

  try { ensure(); } catch (e) {}
  if (typeof MutationObserver === "function") {
    // `document` exists at every script phase (the html element may not yet).
    new MutationObserver(schedule).observe(document, { childList: true, subtree: true });
  }
})();
