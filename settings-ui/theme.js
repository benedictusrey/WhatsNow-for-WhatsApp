// WhatsNow — authored and maintained solely by @benedictusrey.
(function initWhatsNowTheme(root) {
  "use strict";

  const THEMES = Object.freeze([
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
  ]);
  const THEME_COLORS = Object.freeze({
    light: "#f2f7f5",
    dark: "#0d1512",
    midnight: "#08121f",
    forest: "#071a13",
    graphite: "#101317",
    ocean: "#071a21",
    blush: "#fff2f4",
    lavender: "#f5f1fc",
    candy: "#fff3f9",
    aurora: "#f7f3fb",
  });

  function normalize(theme) {
    return THEMES.includes(theme) ? theme : "system";
  }

  function effective(theme, prefersDark) {
    const normalized = normalize(theme);
    return normalized === "system" ? "dark" : normalized;
  }

  function apply(documentObject, theme, prefersDark) {
    const choice = normalize(theme);
    const resolved = effective(choice, prefersDark);
    documentObject.documentElement.dataset.theme = resolved;
    documentObject.documentElement.dataset.themeChoice = choice;
    documentObject.getElementById("theme_color")?.setAttribute(
      "content",
      THEME_COLORS[resolved],
    );
    return choice;
  }

  root.WhatsNowTheme = Object.freeze({
    THEMES,
    THEME_COLORS,
    normalize,
    effective,
    apply,
  });
})(globalThis);
