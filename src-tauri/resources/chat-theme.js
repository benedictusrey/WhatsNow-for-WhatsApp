// WhatsNow chat themes — authored and maintained solely by @benedictusrey.
(function initWhatsNowChatTheme(root) {
  "use strict";

  var THEMES = [
    "system",
    "light",
    "dark",
    "midnight",
    "forest",
    "graphite",
    "ocean",
    "blush",
    "lavender",
    "candy",
    "aurora",
  ];

  // Light-appearance palettes. buildCss restates a scoped color-scheme (only
  // on the surfaces each theme restyles) using this to pick light vs dark.
  var LIGHT_PALETTES = ["light", "blush", "lavender", "candy", "aurora"];

  var PALETTES = {
    light: {
      page: "#f4f8f6",
      panel: "#ffffff",
      panelSoft: "#f0f5f3",
      header: "#f7faf9",
      hover: "#e9f1ee",
      active: "#dceae5",
      incoming: "#ffffff",
      outgoing: "#d9fdd3",
      primary: "#111b21",
      secondary: "#54656f",
      icon: "#54656f",
      accent: "#008069",
    },
    dark: {
      page: "#0b141a",
      panel: "#111b21",
      panelSoft: "#182229",
      header: "#202c33",
      hover: "#202c33",
      active: "#2a3942",
      incoming: "#202c33",
      outgoing: "#005c4b",
      primary: "#e9edef",
      secondary: "#aebac1",
      icon: "#aebac1",
      accent: "#00a884",
    },
    midnight: {
      page: "#060d18",
      panel: "#0a1422",
      panelSoft: "#101d2d",
      header: "#101d2d",
      hover: "#16263a",
      active: "#203651",
      incoming: "#14243a",
      outgoing: "#0d4d5a",
      primary: "#edf6ff",
      secondary: "#a9bfd3",
      icon: "#b7cce0",
      accent: "#3dd6c6",
    },
    forest: {
      page: "#06130e",
      panel: "#0b1b14",
      panelSoft: "#10271d",
      header: "#10271d",
      hover: "#163326",
      active: "#1e4634",
      incoming: "#153326",
      outgoing: "#185b44",
      primary: "#eef8f2",
      secondary: "#aac8b7",
      icon: "#b6d4c3",
      accent: "#48d597",
    },
    graphite: {
      page: "#0d0f12",
      panel: "#15191e",
      panelSoft: "#1d232a",
      header: "#1d232a",
      hover: "#252d35",
      active: "#323d47",
      incoming: "#252c34",
      outgoing: "#354d48",
      primary: "#f1f4f6",
      secondary: "#b8c1c8",
      icon: "#c4ccd2",
      accent: "#62d2b3",
    },
    ocean: {
      page: "#06151b",
      panel: "#0a2029",
      panelSoft: "#0d2b37",
      header: "#0d2b37",
      hover: "#123844",
      active: "#194b58",
      incoming: "#123743",
      outgoing: "#0d5b68",
      primary: "#eefbff",
      secondary: "#a9ccd4",
      icon: "#b6d9e0",
      accent: "#4dd9e5",
    },
    blush: {
      page: "#fff5f6",
      panel: "#fffafb",
      panelSoft: "#fcecef",
      header: "#fcecef",
      hover: "#f9dfe5",
      active: "#f4ccd6",
      incoming: "#fffafb",
      outgoing: "#f5d7e0",
      primary: "#322126",
      secondary: "#725a62",
      icon: "#785b65",
      accent: "#b84669",
    },
    lavender: {
      page: "#f8f5ff",
      panel: "#fdfbff",
      panelSoft: "#eee8fa",
      header: "#eee8fa",
      hover: "#e6ddf5",
      active: "#d8cbed",
      incoming: "#fdfbff",
      outgoing: "#e4d9f4",
      primary: "#2c2438",
      secondary: "#695d78",
      icon: "#6d5d7e",
      accent: "#7651a8",
    },
    candy: {
      page: "#fff7fb",
      panel: "#fffdfd",
      panelSoft: "#f9eaf3",
      header: "#f9eaf3",
      hover: "#f5ddea",
      active: "#efcbdc",
      incoming: "#fffdfd",
      outgoing: "#d9eff0",
      primary: "#332530",
      secondary: "#705d69",
      icon: "#765d6c",
      accent: "#a8467a",
    },
    aurora: {
      page: "#f7f3fb",
      wallpaper:
        "linear-gradient(135deg, #fff1f5 0%, #f7f1ff 34%, #eef8ff 67%, #effbf4 100%)",
      panel: "#fffafd",
      panelSoft: "#f4eef9",
      header: "#f4eef9",
      hover: "#eee8f6",
      active: "#e3dcf0",
      incoming: "#fffdfd",
      outgoing: "#e1f3ee",
      primary: "#30293a",
      secondary: "#6e6478",
      icon: "#72677d",
      accent: "#7b67ad",
    },
  };

  function normalize(theme) {
    return THEMES.indexOf(theme) === -1 ? "system" : theme;
  }

  function buildCss(theme) {
    var normalized = normalize(theme);
    var palette = PALETTES[normalized];
    // LOCKED BEHAVIOR (user-specified, do not change — see AGENTS.md):
    // Dark and Light deliberately leave WhatsApp's complete UI untouched,
    // including its official wallpaper doodles, composer, Reply card, bubbles,
    // contact list, and controls. Personality themes apply their palette
    // EXCLUSIVELY to the main conversation/Chat UI viewport (wallpaper panel,
    // conversation header, composer); the side navigation rail and the middle
    // contact/message list column stay completely original and unaffected.
    if (
      !palette ||
      normalized === "light" ||
      normalized === "dark"
    ) {
      return "";
    }
    var wallpaperImage = palette.wallpaper || "none";
    return [
      "html[data-whatsnow-theme] {",
      "  --whatsnow-page: " + palette.page + ";",
      "  --whatsnow-panel: " + palette.panel + ";",
      "  --whatsnow-panel-soft: " + palette.panelSoft + ";",
      "  --whatsnow-header: " + palette.header + ";",
      "  --whatsnow-hover: " + palette.hover + ";",
      "  --whatsnow-active: " + palette.active + ";",
      "  --whatsnow-primary: " + palette.primary + ";",
      "  --whatsnow-secondary: " + palette.secondary + ";",
      "  --whatsnow-icon: " + palette.icon + ";",
      "  --whatsnow-accent: " + palette.accent + ";",
      "  --whatsnow-chat-wallpaper: " + wallpaperImage + ";",
      "}",
      "html[data-whatsnow-theme] #main,",
      "html[data-whatsnow-theme] [data-testid='conversation-panel-wrapper'],",
      "html[data-whatsnow-theme] [data-testid='conversation-panel-body'],",
      "html[data-whatsnow-theme] [data-testid='conversation-panel-messages'],",
      "html[data-whatsnow-theme] [data-asset-chat-background],",
      "html[data-whatsnow-theme] [data-asset-chat-background-dark],",
      "html[data-whatsnow-theme] [data-asset-chat-background-light] {",
      "  --conversation-panel-background: var(--whatsnow-page) !important;",
      "  --wallpaper-background: var(--whatsnow-page) !important;",
      "  --chat-background: var(--whatsnow-page) !important;",
      "  --WDS-systems-chat-background-wallpaper: var(--whatsnow-page) !important;",
      "  background-color: var(--whatsnow-page) !important;",
      "  background-image: var(--whatsnow-chat-wallpaper) !important;",
      "}",
      // Media previews are NEVER wallpaper: image/video thumbnails render
      // as inline background-image: url(blob:…/data:…) divs — keep them.
      "html[data-whatsnow-theme] #main > div[style*='background']:not([style*='url(blob:']):not([style*='url(\"blob:']):not([style*='url(data:']):not([style*='url(\"data:']),",
      "html[data-whatsnow-theme] [data-testid='conversation-panel-wrapper'] > div[style*='background']:not([style*='url(blob:']):not([style*='url(\"blob:']):not([style*='url(data:']):not([style*='url(\"data:']),",
      "html[data-whatsnow-theme] [data-testid='conversation-panel-body'] > div[style*='background']:not([style*='url(blob:']):not([style*='url(\"blob:']):not([style*='url(data:']):not([style*='url(\"data:']) {",
      "  background-image: var(--whatsnow-chat-wallpaper) !important;",
      "}",
      "html[data-whatsnow-theme] #main::before,",
      "html[data-whatsnow-theme] #main::after,",
      "html[data-whatsnow-theme] #main > div::before,",
      "html[data-whatsnow-theme] #main > div::after,",
      "html[data-whatsnow-theme] [data-testid='conversation-panel-wrapper']::before,",
      "html[data-whatsnow-theme] [data-testid='conversation-panel-wrapper']::after,",
      "html[data-whatsnow-theme] [data-testid='conversation-panel-body']::before,",
      "html[data-whatsnow-theme] [data-testid='conversation-panel-body']::after,",
      "html[data-whatsnow-theme] [data-testid='conversation-panel-messages']::before,",
      "html[data-whatsnow-theme] [data-testid='conversation-panel-messages']::after,",
      "html[data-whatsnow-theme] [data-asset-chat-background]::before,",
      "html[data-whatsnow-theme] [data-asset-chat-background]::after {",
      "  background-image: none !important;",
      "}",
      // ---- conversation/Chat UI viewport only: header + composer; the side
      // navigation rail and the middle contact/list column stay original ----
      "html[data-whatsnow-theme] #main > header {",
      "  background-color: var(--whatsnow-header) !important;",
      "}",
      "html[data-whatsnow-theme] #main > header [title] {",
      "  color: var(--whatsnow-primary) !important;",
      "}",
      "html[data-whatsnow-theme] [data-testid='conversation-compose-box-container'],",
      "html[data-whatsnow-theme] [data-testid='compose-box'] {",
      "  background-color: var(--whatsnow-panel) !important;",
      "}",
      // WhatsApp owns the color scheme of every surface it renders (emoji
      // picker, popovers, native controls). The theme only restates a
      // color-scheme for the surfaces it restyles, so their native bits
      // (scrollbars, form controls) match the palette without ever
      // distorting the typing-area emoji surfaces.
      "html[data-whatsnow-theme] [data-testid='conversation-panel-wrapper'],",
      "html[data-whatsnow-theme] [data-testid='conversation-panel-body'],",
      "html[data-whatsnow-theme] [data-testid='conversation-panel-messages'],",
      "html[data-whatsnow-theme] [data-testid='conversation-compose-box-container'],",
      "html[data-whatsnow-theme] [data-testid='compose-box'] {",
      "  color-scheme: " + (LIGHT_PALETTES.indexOf(normalized) !== -1 ? "light" : "dark") + ";",
      "}",
    ].join("\n");
  }

  var repairObserver = null;
  var activeTheme = "system";
  var readyListenerPending = false;

  function markTheme(normalized) {
    var document = root.document;
    if (!document) return;
    var targets = [
      document.documentElement,
      document.body,
      document.getElementById && document.getElementById("app"),
    ];
    for (var index = 0; index < targets.length; index++) {
      var target = targets[index];
      if (!target) continue;
      if (normalized === "system") {
        target.removeAttribute("data-whatsnow-theme");
        // A previously forced color-scheme must never linger on the document.
        if (target.style) target.style.removeProperty("color-scheme");
      } else {
        target.setAttribute("data-whatsnow-theme", normalized);
        // LOCKED BEHAVIOR (see AGENTS.md): the theme must NOT force its
        // color-scheme onto the whole document. WhatsApp owns the color
        // scheme of every surface it renders (emoji picker, composer input,
        // popovers, native controls); a document-wide force makes the
        // typing-area emoji surfaces render under a scheme WhatsApp did not
        // choose, which hides their glyphs. Personality themes restate a
        // scoped color-scheme — from buildCss — only on the surfaces they
        // restyle, and Light/Dark stay completely untouched.
      }
    }
  }

  function ensureThemeAttached() {
    if (!root.document || activeTheme === "system") return;
    var style = root.document.getElementById("whatsnow-chat-theme");
    if (!style) {
      style = root.document.createElement("style");
      style.id = "whatsnow-chat-theme";
      style.textContent = buildCss(activeTheme);
      (root.document.head || root.document.documentElement).appendChild(style);
    }
    markTheme(activeTheme);
  }

  function apply(theme) {
    var normalized = normalize(theme);
    activeTheme = normalized;
    if (!root.document) return normalized;
    if (!root.document.documentElement) {
      if (
        !readyListenerPending &&
        typeof root.document.addEventListener === "function"
      ) {
        readyListenerPending = true;
        root.document.addEventListener(
          "DOMContentLoaded",
          function applyPendingTheme() {
            readyListenerPending = false;
            apply(activeTheme);
          },
          { once: true },
        );
      }
      return normalized;
    }
    var style = root.document.getElementById("whatsnow-chat-theme");
    if (normalized === "system") {
      if (style) style.remove();
      markTheme(normalized);
      if (repairObserver) {
        repairObserver.disconnect();
        repairObserver = null;
      }
      return normalized;
    }
    if (!style) {
      style = root.document.createElement("style");
      style.id = "whatsnow-chat-theme";
      (root.document.head || root.document.documentElement).appendChild(style);
    }
    style.textContent = buildCss(normalized);
    markTheme(normalized);
    if (!repairObserver && typeof root.MutationObserver === "function") {
      repairObserver = new root.MutationObserver(ensureThemeAttached);
      repairObserver.observe(root.document.documentElement, {
        childList: true,
        subtree: true,
      });
    }
    return normalized;
  }

  root.WhatsNowChatTheme = Object.freeze({
    THEMES: Object.freeze(THEMES.slice()),
    normalize: normalize,
    buildCss: buildCss,
    apply: apply,
  });
  root.__whatsnowApplyTheme = apply;
})(typeof window === "undefined" ? globalThis : window);
