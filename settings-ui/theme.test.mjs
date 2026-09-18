// WhatsNow is authored and maintained solely by @benedictusrey.
import assert from "node:assert/strict";
import "./theme.js";

const theme = globalThis.WhatsNowTheme;

assert.deepEqual(
  theme.THEMES,
  [
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
  ],
  "public theme names stay stable",
);
assert.equal(theme.normalize("unknown"), "system");
assert.equal(theme.effective("system", false), "dark");
assert.equal(theme.effective("system", true), "dark");
assert.equal(theme.effective("midnight", false), "midnight");
assert.equal(theme.effective("blush", true), "blush");
assert.equal(theme.effective("aurora", false), "aurora");

const meta = {
  value: "",
  setAttribute(name, value) {
    assert.equal(name, "content");
    this.value = value;
  },
};
const fakeDocument = {
  documentElement: { dataset: {} },
  getElementById(id) {
    return id === "theme_color" ? meta : null;
  },
};

assert.equal(theme.apply(fakeDocument, "forest", false), "forest");
assert.deepEqual(fakeDocument.documentElement.dataset, {
  theme: "forest",
  themeChoice: "forest",
});
assert.equal(meta.value, "#071a13");

console.log("all theme tests passed");
