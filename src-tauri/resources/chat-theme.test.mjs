// WhatsNow is authored and maintained solely by @benedictusrey.
import assert from "node:assert/strict";

await import("./chat-theme.js");

const theme = globalThis.WhatsNowChatTheme;
assert.equal(theme.normalize("unknown"), "system");
assert.equal(theme.normalize("lavender"), "lavender");
assert.equal(theme.buildCss("system"), "");
assert.equal(theme.buildCss("light"), "");
assert.equal(theme.buildCss("dark"), "");

for (const name of theme.THEMES.filter(
  (item) => !["system", "light", "dark"].includes(item),
)) {
  const css = theme.buildCss(name);
  assert.match(css, /--wallpaper-background:/);
  assert.match(css, /--WDS-systems-chat-background-wallpaper:/);
  assert.match(css, /background-image: none !important/);
  assert.match(css, /#main/);
  // Scope (2.7.1): the WHOLE window. WhatsApp paints its rail, chat list,
  // search, selection, bubbles, menus, dialogs and composer pill from its
  // --WDS-* design tokens, so the palette is applied by re-pointing them.
  assert.match(css, /#main > header/);
  assert.match(css, /conversation-compose-box-container/);
  assert.match(css, /--whatsnow-page:/);
  assert.match(css, /--whatsnow-panel:/);
  assert.match(css, /--whatsnow-primary:/);
  assert.ok(!css.includes("undefined"), `${name} must define every chat color`);
  for (const token of [
    "--WDS-surface-default",
    "--WDS-surface-emphasized",
    "--WDS-surface-highlight",
    "--WDS-surface-elevated-default",
    "--WDS-content-default",
    "--WDS-content-deemphasized",
    "--WDS-content-action-default",
    "--WDS-accent",
    "--WDS-accent-deemphasized",
    "--WDS-content-on-accent",
    "--WDS-systems-chat-surface-composer",
    "--WDS-systems-bubble-surface-incoming",
    "--WDS-systems-bubble-surface-outgoing",
  ]) {
    assert.match(css, new RegExp(`${token}: [^;]+ !important;`), `${name} themes ${token}`);
  }
  // WhatsApp's per-chat colour theme re-declares accent/outgoing on #main, in
  // every message, and in the emoji panel; the palette must win there too.
  assert.match(css, /#main \{\n\s+--WDS-accent: /, `${name} restates the accent on #main`);
  assert.match(css, /conv-msg-/, `${name} themes the text inside bubbles`);
  assert.match(css, /expressions-panel/, `${name} themes the emoji panel`);
  // Every palette colour is consumed (nothing is defined and then ignored).
  const palette = theme.PALETTES[name];
  for (const key of ["page", "panel", "panelSoft", "header", "hover", "active", "incoming", "outgoing", "primary", "secondary", "icon", "accent"]) {
    assert.ok(
      css.toLowerCase().includes(palette[key].toLowerCase()),
      `${name} uses palette.${key} (${palette[key]})`,
    );
  }
  assert.match(css, /--WDS-content-on-accent: #(ffffff|0b141a) !important;/);
  // The composer STRIP paints nothing (like Dark and Light): only the pill is tinted.
  assert.match(
    css,
    /#main footer,[^{]*\[data-testid='compose-box'\] \{\n\s+background-color: transparent !important;/,
    `${name} leaves the composer strip transparent`,
  );
  assert.doesNotMatch(
    css,
    /compose-box'\] \{\n\s+background-color: var\(--whatsnow-panel\)/,
    `${name} must not fill the composer strip`,
  );
  // Scoped color-scheme: the theme restates light/dark ONLY on the surfaces
  // it restyles (conversation panel + composer), never on the document, so
  // WhatsApp's typing-area emoji surfaces keep their own scheme.
  const lightPalettes = ["blush", "lavender", "candy", "aurora"];
  assert.match(
    css,
    new RegExp(`color-scheme: ${lightPalettes.includes(name) ? "light" : "dark"};`),
    `${name} restates its scoped color-scheme`,
  );
  assert.match(
    css,
    /\[data-testid='compose-box'\] \{\n\s+color-scheme: /,
    `${name} scopes color-scheme to the composer, not the document`,
  );
}

assert.match(theme.buildCss("graphite"), /--whatsnow-page: #0d0f12/);
assert.match(theme.buildCss("lavender"), /--whatsnow-page: #f8f5ff/);
assert.match(
  theme.buildCss("aurora"),
  /linear-gradient\(135deg, #fff1f5 0%, #f7f1ff 34%, #eef8ff 67%, #effbf4 100%\)/,
);

// The engine must never force color-scheme onto the document/body/app
// elements — WhatsApp owns the color scheme of its own surfaces (emoji
// picker, composer input), and a document-wide force is what hid
// typing-area emoji. Personality themes restate a scoped color-scheme via
// buildCss only; Dark and Light add no stylesheet at all.
{
  const styleBox = { id: "", textContent: "" };
  const tracked = [];
  const makeElement = () => ({
    setAttribute(name, value) {
      tracked.push(["set", name, value]);
    },
    removeAttribute(name) {
      tracked.push(["remove", name]);
    },
    style: {
      setProperty(name, value, priority) {
        tracked.push(["setStyle", name, value, priority]);
      },
      removeProperty(name) {
        tracked.push(["removeStyle", name]);
      },
    },
  });
  const appElement = makeElement();
  const previousDocument = globalThis.document;
  globalThis.document = {
    documentElement: makeElement(),
    body: makeElement(),
    head: { appendChild() {} },
    getElementById(id) {
      return id === "app" ? appElement : null;
    },
    createElement() {
      return styleBox;
    },
  };
  try {
    theme.apply("dark");
    assert.equal(styleBox.textContent, "", "Dark adds no chat-theme stylesheet");
    assert.equal(
      tracked.filter(([op]) => op === "setStyle").length,
      0,
      "Dark does not force inline color-scheme on html/body/#app",
    );
    theme.apply("graphite");
    assert.match(
      styleBox.textContent,
      /color-scheme: dark;/,
      "graphite restates a scoped dark color-scheme",
    );
    assert.equal(
      tracked.filter(([op]) => op === "setStyle").length,
      0,
      "graphite does not force inline color-scheme on the document",
    );
    theme.apply("aurora");
    assert.match(
      styleBox.textContent,
      /color-scheme: light;/,
      "aurora restates a scoped light color-scheme",
    );
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
}

// The repair observer must never feed itself: re-applying the same theme writes
// nothing (a same-value setAttribute still queues a mutation record), and the
// observer watches only direct children, never attributes or the whole subtree.
{
  const attrs = new Map();
  let writes = 0;
  const observed = [];
  const makeElement = () => ({
    getAttribute: (name) => (attrs.has(name) ? attrs.get(name) : null),
    setAttribute(name, value) {
      writes += 1;
      attrs.set(name, value);
    },
    removeAttribute(name) {
      attrs.delete(name);
    },
    style: { removeProperty() {} },
  });
  const documentElement = makeElement();
  const previousDocument = globalThis.document;
  const previousObserver = globalThis.MutationObserver;
  globalThis.MutationObserver = class {
    observe(target, options) {
      observed.push(options);
    }
    disconnect() {}
  };
  globalThis.document = {
    documentElement,
    body: null,
    head: { appendChild() {} },
    getElementById: () => null,
    createElement: () => ({ id: "", textContent: "" }),
  };
  try {
    theme.apply("graphite");
    const afterFirst = writes;
    assert.ok(afterFirst > 0, "the first apply marks the document");
    theme.apply("graphite");
    assert.equal(writes, afterFirst, "re-applying the same theme writes nothing");
    assert.ok(observed.length > 0, "a repair observer is installed");
    for (const options of observed) {
      assert.ok(!options.attributes && !options.subtree, "observer ignores attributes and subtrees");
    }
  } finally {
    globalThis.MutationObserver = previousObserver;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
}

console.log("all chat theme tests passed");
