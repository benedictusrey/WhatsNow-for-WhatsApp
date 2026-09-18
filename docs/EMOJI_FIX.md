# Emoji rendering in the typing area — root cause, fix, and LOCKED invariants

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).


WhatsNow version **2.0.1** (2026-08-11) shipped the fix described here; the
verified state (emoji + theme + notification + click-routing pillars) is
packaged as **2.5.0** (2026-08-11), backed up in `backup/v2.5.0-locked/`.
This document is the canonical reference for human maintainers AND AI
agents: the behavior below is user-specified and must not regress (see also
AGENTS.md, sections 0 and 5).

## The symptom

Typed emojis in the composer ("typing area") were invisible on the official
Dark theme and every personality theme (midnight through aurora). Only the
Light theme showed them. On the author's machine the affected set was
"System + every personality theme" — Light and official Dark were unaffected
because they keep WhatsApp's doodle wallpaper enabled.

## The root cause (verified live, not guessed)

WhatsApp Web does NOT render typed emoji in the composer as font glyphs. It
wraps each emoji in a span and paints it from a small sprite PNG:

```html
<span class="emoji x1rg5ohu ..." style="background-image: url('https://web.whatsapp.com/emoji/v1/16/0/2/single/a/40/01f600.png');">
  <span class="xy9tlov x1bhl96m">😀</span>
</span>
```

The inner text is drawn with `color: rgba(0,0,0,0)` — transparent. The
emoji you see IS the background image. Remove the background and the emoji
vanishes while the text still exists in the DOM.

WhatsNow's doodle kill-switch (for doodle-disabled themes) contains a
"broad bypass" that neutralizes inline wallpaper backgrounds on NEW WhatsApp
DOM layers:

```css
#main [style*='background-image']:not(...exclusions...) { background-image: none !important; }
```

That blanket rule matched the emoji spans too: they carry an inline
`background-image`, they have NO `data-testid`, and the original
exclusions only covered `[data-testid*='emoji']` / `[data-testid*='compose']`.
So every doodle-disabled theme (System + midnight..aurora) wiped the emoji
sprites → invisible emoji. Light/Dark keep doodles enabled → the bypass is
inactive → emojis rendered fine. Exactly the reported split.

Pixel evidence (CDP screenshot analysis of the composer input row,
saturated-color pixel count, on the author's machine):

| theme | before fix | after fix |
|---|---|---|
| system  | 0 px | 553 px |
| graphite | 0 px | 553 px |
| aurora   | 0 px | 553 px |
| light    | 1110 px | 553 px |
| dark     | 1110 px | 553 px |

## The fix (shared code only — no per-theme CSS touched)

`src-tauri/resources/bridge.js`, the doodle kill-switch broad bypass: all
three selectors now ALSO exclude emoji-sprite elements:

```css
#main [style*='background-image']:not([style*='/emoji/']):not([class*='emoji']):not([data-testid*='emoji']):not([data-testid*='compose'])
#main [style*='background:']:not([style*='/emoji/']):not([class*='emoji']):not([data-testid*='emoji']):not([data-testid*='compose'])
#main [style*='background ']:not([style*='/emoji/']):not([class*='emoji']):not([data-testid*='emoji']):not([data-testid*='compose'])
```

`:not([style*='/emoji/'])` matches the sprite URL; `:not([class*='emoji'])`
matches WhatsApp's `span.emoji` marker. Both must stay.

## LOCKED invariants (do not change)

1. **Never remove or narrow the emoji-sprite exclusions** in the kill-switch
   broad bypass (`bridge.js`): `:not([style*='/emoji/'])` and
   `:not([class*='emoji'])`, plus the existing
   `:not([data-testid*='emoji']):not([data-testid*='compose'])`.
2. **Never "fix" emoji by editing theme palettes or per-theme CSS.** The fix
   is shared code only; every theme palette stays exactly as authored.
3. **`chat-theme.js` must not force a document-wide `color-scheme`** onto
   the WhatsApp page. Personality themes restate a scoped `color-scheme`
   ONLY on the surfaces they restyle (conversation panel + composer).
4. **`bridge.test.mjs` keeps asserting** the bypass contains
   `:not([style*='/emoji/'])` and `:not([class*='emoji'])`
   ("wallpaper blanket bypass never wipes emoji/compose/emoji-sprite surfaces").
5. **Doodle mapping stays as-is** (AGENTS.md section 1): Light/Dark doodle-ON,
   System + personality themes doodle-OFF. The kill-switch stylesheet is the
   enforcement.

## How to verify

- Unit: `node --test src-tauri/resources/bridge.test.mjs src-tauri/resources/chat-theme.test.mjs`.
- Live (pixel proof): launch a build with
  `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222"`,
  open a chat, type `😀😡` into the composer, then via CDP
  (`http://127.0.0.1:9222`) capture the composer input row and count
  saturated pixels per theme. Every theme must show the same, non-zero count.
- Smoke: switch System, graphite, aurora, dark, light — typed emoji visible
  in all.

## History

- 2026-08-08 (1.5.0 era): first report — emojis unseen on Dark + personality
  themes; Light fine.
- 2026-08-11 (2.0.1 rc1): an attempted fix removed the document-wide
  `color-scheme` force and scoped it to themed surfaces — correct hygiene,
  but NOT the root cause; emojis stayed broken on doodle-disabled themes.
- 2026-08-11 (2.0.1 final): live CDP diagnosis found the sprite wipe; the
  broad bypass was fixed; pixel-verified in the rebuilt installers.
