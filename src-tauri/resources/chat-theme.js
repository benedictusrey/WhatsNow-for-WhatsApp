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

  // ---- colour helpers (the palettes are hex; WhatsApp also wants "r, g, b") ----
  function hexToRgb(hex) {
    var value = String(hex).replace("#", "");
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
    ];
  }

  function rgbList(hex) {
    return hexToRgb(hex).join(", ");
  }

  function luminance(hex) {
    var channels = hexToRgb(hex).map(function (channel) {
      var value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }

  function contrast(first, second) {
    var a = luminance(first);
    var b = luminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  // Text that stays readable on the accent colour (badges, buttons).
  function readableOn(background) {
    return contrast(background, "#ffffff") >= contrast(background, "#0b141a")
      ? "#ffffff"
      : "#0b141a";
  }

  // WhatsApp paints almost every surface from a small set of design-system
  // tokens (--WDS-*) that it defines on <html>. Re-pointing those tokens at the
  // palette themes the whole window — left rail, chat list, search, selection,
  // bubbles, menus, dialogs, popovers — without chasing per-element selectors
  // that WhatsApp renames. The declarations are !important so they beat both
  // WhatsApp's atomic-class definitions and its per-chat colour themes.
  function tokenDeclarations(palette) {
    var accentText = readableOn(palette.accent);
    var declarations = {
      "--WDS-surface-default": palette.panel,
      "--WDS-surface-emphasized": palette.header,
      "--WDS-surface-highlight": palette.hover,
      "--WDS-surface-elevated-default": palette.panelSoft,
      "--WDS-background-wash-plain": palette.panel,
      "--WDS-content-default": palette.primary,
      "--WDS-content-deemphasized": palette.secondary,
      "--WDS-content-action-default": palette.icon,
      "--WDS-accent": palette.accent,
      "--WDS-accent-RGB": rgbList(palette.accent),
      "--WDS-content-action-emphasized": palette.accent,
      "--WDS-content-external-link": palette.accent,
      "--WDS-accent-deemphasized": palette.active,
      "--WDS-accent-emphasized": palette.primary,
      "--WDS-content-on-accent": accentText,
      "--WDS-lines-outline-deemphasized":
        "color-mix(in srgb, " + palette.secondary + " 30%, transparent)",
      "--WDS-systems-chat-surface-composer": palette.panel,
      "--WDS-systems-bubble-surface-incoming": palette.incoming,
      "--WDS-systems-bubble-surface-incoming-RGB": rgbList(palette.incoming),
      "--WDS-systems-bubble-surface-outgoing": palette.outgoing,
      "--WDS-systems-bubble-surface-outgoing-RGB": rgbList(palette.outgoing),
      "--WDS-systems-bubble-surface-system":
        "color-mix(in srgb, " + palette.panel + " 90%, transparent)",
      "--WDS-systems-bubble-content-deemphasized": palette.secondary,
      "--WDS-systems-bubble-surface-overlay":
        "color-mix(in srgb, " + palette.primary + " 8%, transparent)",
      "--WDS-systems-bubble-surface-overlay-RGB": rgbList(palette.primary),
    };
    return Object.keys(declarations).map(function (name) {
      return "  " + name + ": " + declarations[name] + " !important;";
    });
  }

  // Inside a message WhatsApp re-declares its text/accent tokens for the
  // bubble's own background (white on its green/maroon outgoing bubble). The
  // palette picks the bubble colours, so the text colours must follow too.
  function bubbleTokenDeclarations(palette) {
    return [
      "  --WDS-content-default: " + palette.primary + " !important;",
      "  --WDS-content-deemphasized: " + palette.secondary + " !important;",
      "  --WDS-systems-bubble-content-deemphasized: " + palette.secondary + " !important;",
      "  --WDS-systems-bubble-surface-overlay: color-mix(in srgb, " + palette.primary + " 8%, transparent) !important;",
      "  --WDS-systems-bubble-surface-overlay-RGB: " + rgbList(palette.primary) + " !important;",
      "  --WDS-systems-bubble-content-business: " + palette.secondary + " !important;",
      "  --WDS-systems-bubble-content-e2e: " + palette.secondary + " !important;",
      "  --WDS-accent: " + palette.accent + " !important;",
      "  --WDS-accent-deemphasized: " + palette.hover + " !important;",
    ];
  }

  function buildCss(theme) {
    var normalized = normalize(theme);
    var palette = PALETTES[normalized];
    // LOCKED BEHAVIOR (user-specified, do not change — see AGENTS.md):
    // Dark and Light deliberately leave WhatsApp's complete UI untouched,
    // including its official wallpaper doodles, composer, Reply card, bubbles,
    // contact list, and controls. Personality themes (2.7.1) restyle the whole
    // window from their palette: rail, chat list, header, bubbles, composer
    // pill, menus and dialogs. The composer STRIP stays transparent over the
    // wallpaper exactly like Dark and Light; only the pill itself is tinted.
    if (
      !palette ||
      normalized === "light" ||
      normalized === "dark"
    ) {
      return "";
    }
    var wallpaperImage = palette.wallpaper || "none";
    var colorScheme = LIGHT_PALETTES.indexOf(normalized) !== -1 ? "light" : "dark";
    return [
      "html[data-whatsnow-theme] {",
      "  --whatsnow-page: " + palette.page + ";",
      "  --whatsnow-panel: " + palette.panel + ";",
      "  --whatsnow-panel-soft: " + palette.panelSoft + ";",
      "  --whatsnow-header: " + palette.header + ";",
      "  --whatsnow-hover: " + palette.hover + ";",
      "  --whatsnow-active: " + palette.active + ";",
      "  --whatsnow-incoming: " + palette.incoming + ";",
      "  --whatsnow-outgoing: " + palette.outgoing + ";",
      "  --whatsnow-primary: " + palette.primary + ";",
      "  --whatsnow-secondary: " + palette.secondary + ";",
      "  --whatsnow-icon: " + palette.icon + ";",
      "  --whatsnow-accent: " + palette.accent + ";",
      "  --whatsnow-chat-wallpaper: " + wallpaperImage + ";",
    ]
      .concat(tokenDeclarations(palette))
      .concat([
        "}",
        // WhatsApp's per-chat colour theme re-declares these on #main itself,
        // so the palette must be restated at that level too.
        "html[data-whatsnow-theme] #main {",
        "  --WDS-accent: " + palette.accent + " !important;",
        "  --WDS-accent-RGB: " + rgbList(palette.accent) + " !important;",
        "  --WDS-content-action-emphasized: " + palette.accent + " !important;",
        "  --WDS-content-external-link: " + palette.accent + " !important;",
        "  --WDS-systems-chat-background-wallpaper-RGB: " + rgbList(palette.page) + " !important;",
        "  --WDS-systems-chat-foreground-wallpaper: transparent !important;",
        "  --WDS-accent-deemphasized: " + palette.active + " !important;",
        "  --WDS-accent-emphasized: " + palette.primary + " !important;",
        "  --WDS-systems-bubble-surface-outgoing: " + palette.outgoing + " !important;",
        "  --WDS-systems-bubble-surface-outgoing-RGB: " + rgbList(palette.outgoing) + " !important;",
        "}",
        // The emoji/GIF/sticker panel opens its own copy of the chat colour theme.
        "html[data-whatsnow-theme] [data-testid='expressions-panel'],",
        "html[data-whatsnow-theme] [data-testid='expressions-panel'] * {",
        "  --WDS-accent: " + palette.accent + " !important;",
        "  --WDS-accent-RGB: " + rgbList(palette.accent) + " !important;",
        "  --WDS-accent-emphasized: " + palette.primary + " !important;",
        "  --WDS-content-action-emphasized: " + palette.accent + " !important;",
        "  --WDS-systems-bubble-surface-outgoing: " + palette.outgoing + " !important;",
        "}",
        "html[data-whatsnow-theme] #main [data-testid^='conv-msg-'],",
        "html[data-whatsnow-theme] #main [data-testid^='conv-msg-'] * {",
      ])
      .concat(bubbleTokenDeclarations(palette))
      .concat([
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
        // The WhatsApp wordmark switches to "always white" in WhatsApp's dark
        // scheme; on a light palette that would vanish, so it follows the accent.
        "html[data-whatsnow-theme] [data-testid='wa-wordmark'] {",
        "  color: var(--whatsnow-accent) !important;",
        "}",
        // Conversation header: the palette header colour and title.
        "html[data-whatsnow-theme] #main > header {",
        "  background-color: var(--whatsnow-header) !important;",
        "}",
        "html[data-whatsnow-theme] #main > header [title] {",
        "  color: var(--whatsnow-primary) !important;",
        "}",
        // The composer STRIP (footer / compose-box / its container) paints
        // nothing, exactly like Dark and Light: the wallpaper shows around the
        // pill. The pill itself is tinted through --WDS-systems-chat-surface-
        // composer above; the Reply preview bar keeps its own opaque surface.
        "html[data-whatsnow-theme] #main footer,",
        "html[data-whatsnow-theme] [data-testid='conversation-compose-box-container'],",
        "html[data-whatsnow-theme] [data-testid='compose-box'] {",
        "  background-color: transparent !important;",
        "  background-image: none !important;",
        "}",
        // WhatsApp owns the color scheme of every surface it renders (emoji
        // picker, popovers, native controls). The theme only restates a
        // color-scheme for the surfaces it restyles, so their native bits
        // (scrollbars, form controls) match the palette without ever
        // distorting the typing-area emoji surfaces.
        "html[data-whatsnow-theme] #pane-side,",
        "html[data-whatsnow-theme] [data-testid='drawer-left'],",
        "html[data-whatsnow-theme] [data-testid='conversation-panel-wrapper'],",
        "html[data-whatsnow-theme] [data-testid='conversation-panel-body'],",
        "html[data-whatsnow-theme] [data-testid='conversation-panel-messages'],",
        "html[data-whatsnow-theme] [data-testid='conversation-compose-box-container'],",
        "html[data-whatsnow-theme] [data-testid='compose-box'] {",
        "  color-scheme: " + colorScheme + ";",
        "}",
      ])
      .join("\n");
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
        // Only write when it differs: setAttribute with the same value still
        // queues a mutation record, which a repair observer would answer by
        // writing again, forever.
        if (!target.getAttribute || target.getAttribute("data-whatsnow-theme") !== normalized) {
          target.setAttribute("data-whatsnow-theme", normalized);
        }
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
      // WhatsApp only ever replaces the <head>/<html> children; watching the
      // whole subtree ran this callback on every chat-list or message mutation
      // for no benefit. Direct children of <html> and <head> are enough.
      repairObserver = new root.MutationObserver(ensureThemeAttached);
      repairObserver.observe(root.document.documentElement, { childList: true });
      if (root.document.head) {
        repairObserver.observe(root.document.head, { childList: true });
      }
    }
    return normalized;
  }

  root.WhatsNowChatTheme = Object.freeze({
    THEMES: Object.freeze(THEMES.slice()),
    PALETTES: PALETTES,
    normalize: normalize,
    buildCss: buildCss,
    apply: apply,
  });
  root.__whatsnowApplyTheme = apply;
})(typeof window === "undefined" ? globalThis : window);
