# WhatsNow 2.7.0 — audit and UX overhaul

Authored and maintained by [@benedictusrey](https://github.com/benedictusrey).
Repository: <https://github.com/benedictusrey/WhatsNow-for-WhatsApp>.

## What changed

See the [changelog](../CHANGELOG.md) entry for 2.7.0. The locked behaviors in
`AGENTS.md` (themes and doodles, emoji rendering, compact toasts, click-to-chat
routing, call-window construction, frameless Settings) are unchanged; the
2.7.0 section there records the new centering, instant-apply, idle-close,
Action Center, and account-label rules. A `backup/v2.7.0-locked/` snapshot holds
the touched locked-pillar files.

## Automated checks run for this release

- `cargo test --lib`, `cargo clippy --all-targets -- -D warnings`
- `bridge.test.mjs`, `chat-theme.test.mjs`, `toast-route.test.mjs`, `call-media.test.mjs`
- `settings-ui/*.test.mjs` (including `autosave` and `idleClose`),
  `scripts/settings-contrast.test.mjs`, `scripts/settings-attribution.test.mjs`
- `scripts/phone-routing.test.mjs`, `scripts/call-popup.test.mjs`,
  `scripts/smoke-test.mjs`, `scripts/smoke-links.mjs`, `scripts/check-docs.mjs`
- Native `call-window-smoke` example (opener handoff, maximize, restore, resize)

## Not verified live

These need a signed-in WhatsApp account or a second device and were not run:

- A message from a second device raising a compact toast; opening the chat or
  reading it on the phone removing its toasts from the Action Center.
- A slow reload raising no stale toast; a muted chat raising no fallback toast.
- A real two-party call: it stays on top after a Settings toggle, maximizes, has
  the icon, and the dark client background causes no visible regression.
- Main-window centering on a second monitor and a window saved on a removed monitor.
- Renderer CPU while chatting or calling compared with 2.6.3 (the unread probe is
  throttled, but the saving was not measured).
- Windows notification health card after turning notifications off for WhatsNow.

## Known limitation

The content popup is shared by all accounts, so a `chat.whatsapp.com` invite
opened from a second account loads in the first account's session. Fixing it
needs one popup per account, which changes the single reusable popup rule and
needs an explicit decision.
