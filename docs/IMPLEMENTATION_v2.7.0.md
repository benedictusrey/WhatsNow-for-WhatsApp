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

## Verified live (follow-up pass, built exe over CDP)

With the user's app closed, the built exe was driven over a local debug port
(structure and computed colours only, no message text kept): in every personality
theme the composer footer/strip is transparent, the pill, left rail and outgoing
bubble take the palette, typed emoji render, the emoji panel and chat menu follow
the palette, Settings opens visible with data loaded, no gated controls and no
horizontal overflow. This also caught and fixed a feedback loop in the chat-theme
repair observer (now covered by `chat-theme.test.mjs`).

## Audio: never muted

`identify` clears the mute flag of every owned WebView2 audio session and the sweep runs
every 3 seconds; `attach` clears WebView2's `IsMuted`. Verified live: the WhatsNow session was
unmuted and stayed unmuted. Not achievable: the WhatsNow icon in the mixer. Windows shows the
icon of the process that plays audio (`msedgewebview2.exe`) and ignored session icon paths
in every form tried (bare exe, `.ico`, `.ico,0`, `exe,0`, `exe,-32512`, a shared folder, a
fresh Settings app). Fixing it would need a bundled, re-branded WebView2 runtime.

## Release packaging

The release has one installer per operating system: `WhatsNow_2.7.0_windows_x64-setup.exe`,
`WhatsNow_2.7.0_macos_universal.dmg` (Apple Silicon and Intel in one) and
`WhatsNow_2.7.0_linux_x86_64.AppImage`, plus `checksums.sha256`. The release
workflow checks each file exists and is non-empty, that the macOS binary contains
both architectures, and the exact file set and checksums; it retries the flaky
macOS DMG step. `check.yml` runs only on demand or on code pull requests, so
documentation and routine pushes spend no Actions minutes. The changelog lives on
the GitHub release page (`RELEASE_NOTES.md`), not in the README.

## Verified live (account names, call window, Settings button)

Driven over the debug port on the built exe with the real profile, structure only:

- The header button is injected once, sized 40 px like its neighbours, and clicking
  it opens Settings; Settings Overview and Accounts show "Ben" (the profile name)
  after the legacy "WhatsApp" label was migrated.
- A real call: the call window was created in about 75 ms and its page loaded about
  300-340 ms later. At hang-up the page closed itself and the whole window went
  with it (log line "page closed, closing the window"). Before the fix the same call
  left an empty window; `examples/call-window-smoke.rs` reproduces that and fails
  without the fix.

## Not verified live

These need a signed-in WhatsApp account or a second device and were not run:

- A message from a second device raising a compact toast; opening the chat or
  reading it on the phone removing its toasts from the Action Center.
- A slow reload raising no stale toast; a muted chat raising no fallback toast.
- A real two-party call: it stays on top after a Settings toggle, maximizes, and
  the "Connecting" frame disappears once the call picture appears.
- The tray menu text itself (unit-tested, not read from the native menu).
- Main-window centering on a second monitor and a window saved on a removed monitor.
- Renderer CPU while chatting or calling compared with 2.6.3 (the unread probe is
  throttled, but the saving was not measured).
- Windows notification health card after turning notifications off for WhatsNow.

## Known limitation

The content popup is shared by all accounts, so a `chat.whatsapp.com` invite
opened from a second account loads in the first account's session. Fixing it
needs one popup per account, which changes the single reusable popup rule and
needs an explicit decision.
