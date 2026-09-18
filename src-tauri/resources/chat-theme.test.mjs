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
  // Scope: EXCLUSIVELY the main conversation/Chat UI viewport — the side
  // navigation rail and the middle contact/list column stay original.
  assert.match(css, /#main > header/);
  assert.doesNotMatch(css, /#side/);
  assert.doesNotMatch(css, /Chats/);
  assert.doesNotMatch(css, /drawer/);
  assert.doesNotMatch(css, /profile-panel/);
  assert.match(css, /conversation-compose-box-container/);
  assert.match(css, /--whatsnow-page:/);
  assert.match(css, /--whatsnow-panel:/);
  assert.match(css, /--whatsnow-primary:/);
  assert.doesNotMatch(css, /--incoming-background|--outgoing-background/);
  assert.ok(!css.includes("undefined"), `${name} must define every chat color`);
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

console.log("all chat theme tests passed");
