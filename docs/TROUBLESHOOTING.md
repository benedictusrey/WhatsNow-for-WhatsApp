# Troubleshooting

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

## WhatsNow opens to a sign-in page

Link the account using WhatsApp's **Linked devices** flow. If an account was
removed or local profile data was deleted, it must be linked again.

## Windows opens a blank window

Install or repair Microsoft Edge WebView2, update Windows, exit WhatsNow from
the tray, and relaunch it.

## Windows Task Manager shows several WebView2 processes

This is expected. WebView2 separates browser, renderer, GPU, and utility work
into multiple processes. Version 2.5.0 requests its supported low-memory target
for minimized, tray-hidden, and secondary accounts while keeping the focused
account responsive. Compare total memory for the whole WhatsNow process tree,
not one `msedgewebview2.exe` entry or the process count alone.

## Typed emojis do not show in the typing area

WhatsApp Web draws typed emojis as inline background-image sprites. WhatsNow's
theme handling must never wipe them: the doodle kill-switch's broad bypass
excludes emoji-sprite elements (`:not([style*='/emoji/']):not([class*='emoji'])`),
and a scoped color-scheme keeps the composer in WhatsApp's own palette. This
behavior is LOCKED (AGENTS.md section 5 in the private source workspace). If
emojis ever vanish again, check that `bridge.js` keeps those exclusions on all
three kill-switch selectors and that the theme CSS was not rewritten.

## Personality themes still show doodles (e.g. while Replying)

WhatsApp 2.24xx+ paints its default doodle wallpaper as a CSS **mask**, not a
background-image: a full-bleed layer with testid
`conversation-background-default_chat_wallpaper` carries an inline
`mask-image: url(...voSdkk88H7C.svg)` pattern (doodle shapes) over a
translucent white tint, and the composer container is now `compose-box`.
An older doodle kill-switch could therefore leave the mask visible on dark
personality palettes — most noticeably as a "curtain" of doodles while the
Reply preview bar slides up.

Fixed in 2.5.0: the kill-switch (`whatsnow-no-wallpaper-doodles` in
`bridge.js`) now zeroes `mask-image` / `-webkit-mask-image` (and the tint
it shapes) on every wallpaper layer — `[data-testid*='conversation-background']`,
`chat-background`, `wallpaper`, `doodle`, plus legacy `data-asset-chat-background`
— with a belt-and-suspenders inline-mask rule that still spares emoji and
compose surfaces, and it covers both the legacy and current composer testids.
This mapping is LOCKED (AGENTS.md section 1 in the private source workspace):
never restore per-theme CSS or remove the mask rule. Light and Dark
intentionally keep WhatsApp's official doodles.

## The toast shows a big icon / banner on the left

WhatsNow requires the compact toast layout — a small WhatsNow icon next to the
"WhatsNow" name, no large banner on the left, on every toast. A per-toast
`appLogoOverride` image made Windows draw the large-icon layout; it is removed
from the toast XML and a test forbids its return. If a big banner ever comes
back, the toast XML must contain no `<image placement="appLogoOverride">`
element.

## Clicking a notification opens the wrong chat (or nothing)

WhatsApp Web ignores untrusted page-side clicks, so WhatsNow synthesizes a real
trusted click from the host and targets the smallest matching chat row (never
WhatsApp's giant list wrapper, whose off-screen center silently swallowed
clicks). The routing command is ACL-registered in both `build.rs` and the
remote capability. If clicking a toast or a notification-center entry ever
stops landing in the sender's chat, these three invariants are the first
things to check.

## Notifications do not appear

Check WhatsNow notification preferences and the operating system's notification,
Focus Assist, or Do Not Disturb settings. WhatsNow intentionally suppresses
message previews while the relevant chat window is actively in the foreground.

## A shortcut does not work

Another app may own it. Choose another shortcut in Settings and restart
WhatsNow if the desktop environment does not immediately release the old one.

## Linux calls are unavailable

Some WebKitGTK distributions do not include WebRTC. This is a runtime
limitation; text chat and attachments may still work normally.

## Antivirus reports an unfamiliar label

Do not create an antivirus exclusion. Verify the download source, checksum, and
signature using [Security and verification](SECURITY_AND_VERIFICATION.md), then
submit the exact file to the vendor for false-positive review.

For a reproducible application defect, follow [Support](../SUPPORT.md).
