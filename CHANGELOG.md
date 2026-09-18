# WhatsNow changelog

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

Copyright (c) 2026 @benedictusrey. Released under the [MIT License](LICENSE).

All notable project changes are recorded here. This project follows

## [2.6.0] - 2026-09-15

### Fixed

- **Process freeze on any content-popup request (2026-09-17 incident).**
  Opening a `whatsapp://` deep link (or any family link that lands in the
  content popup) could wedge the whole app: the webview was built
  synchronously inside WebView2's `NewWindowRequested` callback, re-entering
  the engine's message pump mid-request — the window half-painted and the
  process stopped responding ("Not Responding" forever). The content popup
  is now PRE-CREATED hidden at boot; the callback only ever navigates +
  shows it (instant, no construction), and a deferred fallback builder covers
  the rare case where the popup was closed. The call-stage window keeps its
  original synchronous build (unchanged 2.6.0 behavior).

- **Black window after a browser deep link, and blank image previews
  (2026-09-15 incident).** Two causes, both fixed. First, the seamless-move
  prototype pulsed a synthetic `popstate`, which crashed WhatsApp's real
  router on the `/send` route — React unmounted the whole app shell and the
  themed page background showed through as a black window. The routing now
  uses a synthetic same-origin anchor click (WhatsApp's own mechanism), and
  a shell-collapse watchdog hard-recovers on the same route if the SPA ever
  dies anyway. Second, the doodle-disabled wallpaper "blanket" replaced
  every inline `background-image` under the conversation area — including
  WhatsApp's inline `blob:`/`data:` previews — wiping image previews to
  blank; those media URLs are now excluded from the blanket. Family-content
  anchors (call/api pages) also no longer request popups with `noopener`,
  which this shell cannot host (the URL was silently dropped); the popup
  request now carries the real URL to the Rust host.
- **The official Dark theme lost its doodle wallpaper.** The Settings UI's
  "Dark" option is persisted as the `system` value, but the doodle mapping
  enabled WhatsApp's native doodles only for `light` and `dark` — so "Dark"
  silently ran the doodle kill-switch while "Light" showed doodles. The
  mapping now enables doodles for every OFFICIAL theme (`system`, `light`,
  `dark`) and keeps them disabled for every PERSONALITY theme
  (midnight, forest, graphite, ocean, blush, lavender, candy, aurora).
  Verified with a Playwright theme→doodle matrix: the wallpaper layer's CSS
  mask survives on System/Light/Dark and is zeroed on personality themes.
- **Video-call stage was a cramped, non-maximizable in-page surface.**
  WhatsApp Web Calling (2026) opens the call stage through `window.open` on
  web.whatsapp.com; WhatsNow denied EVERY popup, wedging the call into the
  tiny embedded stage with no maximize button. WhatsApp popup requests now
  create a REAL window: the caller's requested size clamped to the monitor  work area, resizable/maximizable/minimizable, always-on-top, with
  WhatsApp's own full call UI. Only `https://web.whatsapp.com` may spawn
  one (`whatsapp_popup_allowed`, unit-tested); every other host keeps the
  external-browser flow. The popup shares the opener's WebView2 environment
  (Windows) / WKWebViewConfiguration (macOS) / related view (Linux), which
  is what keeps WebRTC media AND the per-account session isolation intact.
- **Call popups could not use the microphone/camera without a re-prompt.**
  The Windows auto-allow permission handler was only attached to windows
  created at boot; popups created later got no handler. It now attaches to
  every call window, and the allowed set includes WINDOW_MANAGEMENT (the
  call stage's pop-out/PiP controls) alongside microphone and camera.
- **Windows smaller than the default window size opened oversized windows.**
  The fixed 1100x800 chat and 760x820 Settings defaults ignored the monitor
  work area, so 1366x768-class laptops (and 125%/150% DPI scaling) could
  get a window larger than the desktop. All three builders now clamp the
  default size to the work area (`clamped_logical_size`, math unit-tested).

### Changed

- **Version bump 2.5.0 → 2.6.0.** Build scripts and Settings cache-bust
  follow the new version. The verified 2.5.0 state remains available as the
  read-only reference copy `backup/v2.5.0-locked/`; the 2.6.0 state is
  snapshotted to `backup/v2.6.0-locked/` after verification.

## [Unreleased]

### Added

- **Verified WhatsApp links now open inside WhatsNow, not the browser.**
  The eight hosts the user listed — `api.whatsapp.com`, `www.whatsapp.com`,
  `event.whatsapp.com`, `call.whatsapp.com`, `wa.me`, `v.whatsapp.com`,
  `whatsapp.com`, `chat.whatsapp.com` — join `web.whatsapp.com` in an
  exact-match host family (look-alike hosts like
  `web.whatsapp.com.evil.com` still go to the browser). `wa.me/<phone>`
  opens the contact's chat in place through the account's own chat list
  (a number not in your chats just raises WhatsNow) and
  `chat.whatsapp.com/<invite>` navigates the chat window in
  place, matching WhatsApp's own desktop app; every other family link
  opens in a single reusable popup window that shares the account session
  (call links keep their dedicated always-on-top call window from 2.6.0).
  Ordinary web links keep the exact pre-existing external-browser flow.
- **The `whatsapp://` deep-link scheme is registered on Windows** (per-user
  HKCU, rewritten at every launch so the stored command always points at
  the current executable; skipped in portable builds). Clicking a
  `whatsapp://send?phone=…` link anywhere in Windows focuses WhatsNow and
  opens the composer; only the documented `send` host and
  phone/text/type/body parameters are accepted. (Windows gives non-browser
  apps no way to claim per-host `https://` routing, so `https://wa.me`
  links clicked in other apps keep using the default browser — the
  in-app coverage above applies to links inside WhatsNow.)
- **Seamless deep-link moves: no reload, no second window (final
  contract, 2026-09-17).** Opening a contact (a wa.me link click inside
  WhatsNow, `window.open`, or a browser-originated `whatsapp://` deep
  link) never hard-navigates the account webview and never spawns an
  interstitial popup — the app stays exactly where it is. The link's
  phone number is delivered to the bridge's `__whatsnowOpenChatByPhone`:
  a contact whose chat is in your list opens with a trusted chat-list
  row click verified against the conversation header — in place,
  instantly, with zero visible steps; a number that is NOT in your chats
  deliberately does nothing beyond raising WhatsNow (no search
  choreography, no popup). This is a deliberate revert: an anchor-click
  SPA route is impossible (WhatsApp Web keeps chats OUT of the URL —
  `/send?phone` always bounces home), a direct store-API open is
  impossible (no `window.Store` or module registry is reachable from the
  page), and the two workable-but-fussy substitutes tried on 2026-09-17
  (an api.whatsapp.com interstitial popup; a New-chat search auto-type
  flow) were rejected as "messy second window" quirks. Verified live on
  the rebuilt installers: deep link → single window, zero reloads, zero
  popups, process responsive throughout.

### Fixed

- **Shared videos sometimes played with no sound (Windows, `windows-memory`
  builds).** The memory policy flagged every UNFOCUSED window
  `COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW`, and clicking play inside a
  video does not re-raise the window-focus event — so a focused window
  watching a clip could stay at LOW, whose best-effort reclaim
  "could potentially cause memory for some WebView browser processes to be
  swapped out to disk" (ICoreWebView2_19). The video kept painting while the
  swapped-out audio graph played silence. The policy is now three-state:
  LOW only for windows the user cannot watch (minimized or hidden to tray);
  every VISIBLE window stays NORMAL, focused or not. The decision is the
  pure predicate `windows_memory_low` (unit-tested), re-applied on focus
  change, on minimize/restore (Resized with a minimized flip), and directly
  from `show_account` so a tray-restored window is back at NORMAL before the
  first video plays. Verified live: show → unminimize → focus deterministically
  flips the log `memory target LOW → NORMAL`.
- **The official-app promo sweep could go deaf for the page's whole life.**
  bridge.js installed its promo MutationObserver only when
  `document.documentElement` existed, but embedder initialization scripts run
  BEFORE `<html>` is parsed (verified in Chromium): the observer then never
  installed and no retry existed — newly shown promo cards lingered until
  reload. The observer is now rooted at `document` (exists at every script
  phase; with `subtree: true` it also survives WhatsApp replacing the page
  head).

### Changed

- **Chat-list fluency: the promo sweep is coalesced.** The observer used to
  run the full multi-scope querySelectorAll sweep synchronously for EVERY DOM
  mutation record — hundreds of times per second while scrolling or typing.
  It now still hides a fresh promo immediately on the FIRST mutation of each
  window (leading edge) and absorbs the rest of the storm into at most ONE
  trailing-edge sweep ~400 ms later. Full sweeps drop from per-mutation to at
  most two per busy window.

## [2.5.0] - 2026-08-11

### Fixed

- **Settings > About showed a stale version.** The About card and footer
  carried a hardcoded "WhatsNow 2.0.1" label that survived the 2.5.0 bump.
  The version is now injected at runtime from the compiled package version
  (`settings_version_bootstrap` in window.rs fills every
  `[data-version-ref]` element), and the Settings assets cache-bust on
  2.5.0. Verified live: About and footer both read "WhatsNow 2.5.0".
- **Doodles could still show on personality themes while Replying** (Graphite
  through Aurora). WhatsApp 2.24xx+ paints the default doodle wallpaper as a
  CSS **mask** (`[data-testid='conversation-background-*']` with an inline
  `mask-image` SVG pattern over a translucent tint), not as a
  `background-image`, and it renamed the composer container testid to
  `compose-box`. The kill-switch now zeroes `mask-image`/`-webkit-mask-image`
  (and the tint) on the wallpaper layers, adds a belt-and-suspenders
  inline-mask rule that still excludes emoji/compose surfaces, and covers
  both the legacy and current composer testids — verified live on graphite:
  the layer's mask goes `url(...svg)` → `none` and its tint goes transparent
  while typed emoji stay intact. LOCKED via AGENTS.md section 1 and
  bridge.test.mjs assertions.

### Changed

- **Windows asset naming is now universal.** The `windows10` tag is gone
  everywhere: assets are `WhatsNow_2.5.0_windows_x64-setup.exe` /
  `-portable.exe` (with `windows_x64_en-US.msi` on CI), the checksum
  manifest is `checksums-windows.sha256`, the build script is
  `scripts/build-windows.ps1`, and the Cargo feature is `windows-memory` —
  the build targets any 64-bit Windows 10 or Windows 11.
- **docs/PUBLISHING.md is the new complete two-repo publish workflow**
  (private `i-w` source + public `WhatsNow-for-WhatsApp` installation
  repository), with every GitHub Desktop step, secrets/variables setup,
  tagging, the cross-platform Actions run, and post-release verification.
- **Version bump 2.0.1 → 2.5.0** (user-requested). No functional changes
  beyond the 2.0.1 line; 2.5.0 re-packages the same verified state (themes +
  doodle mapping, typing-area emoji rendering in every theme, always-compact
  toast notifications, and toast/notification-center click routing to the
  sender's chat).
- **Guardrails hardened in AGENTS.md** — new section 0 "The four pillars"
  names the four locked behaviors (themes/doodles, emoji, float
  notifications, click-to-chat routing) as inviolable for human developers
  AND AI agents, with backups pinned to `backup/emoji-fix-v2.0.1/` and
  `backup/v2.5.0-locked/`.
- **New backup `backup/v2.5.0-locked/`** — byte-identical copy of every
  pillar's sources (bridge.js, chat-theme.js, notify.rs, window.rs,
  commands.rs, build.rs, capabilities/main-remote.json, all test suites,
  lock docs) plus the 2.5.0 installers and checksums, with restore
  instructions.
[Semantic Versioning](https://semver.org/).

## [2.0.1] - 2026-08-11

### Fixed

- The typing-area emoji issue is fixed: emojis now render in the composer input and emoji picker for
  the official Dark theme and every personality theme (midnight through
  aurora). Root cause: WhatsApp draws each typed emoji as an inline
  `background-image` sprite (`span.emoji` carrying a `url(.../emoji/...)`
  background with transparent fallback text), and the doodle kill-switch's
  wallpaper blanket bypass was wiping those sprite backgrounds under every
  doodle-disabled theme (System and all personality themes) — Light and Dark
  were unaffected because they keep WhatsApp's doodles enabled. The blanket
  bypass now exempts emoji-sprite elements (by style URL and class) alongside
  the emoji/compose surfaces it already spared. The theme also no longer
  forces a document-wide `color-scheme` onto the WhatsApp page; personality
  themes restate a scoped `color-scheme` only on the surfaces they restyle.
  Per-theme palettes are untouched (see AGENTS.md).
- **Windows toast notifications: always the compact toast, and clicking a
  notification opens the sender's chat.** Two fixes in the same release:
  - Every toast now uses the compact layout — a small WhatsNow icon next to
    the "WhatsNow" name, no large banner. Root cause (verified live with
    pixel + notification-database evidence): Windows renders any toast that
    carries an `appLogoOverride` image with the LARGE square app icon on
    the left, and a toast without it in the compact layout. The per-toast
    `appLogoOverride` element was therefore removed from the toast XML; the
    small icon now always comes from the identity (AUMID IconUri, a 48×48
    version of the same artwork — the old 512×512 source could also be drawn
    large by the platform's first-use fallback).
  - Clicking a toast (or a notification-center entry) now reliably opens the
    sender's chat. Root causes found by testing the LIVE routing path (not
    just the unit stubs): WhatsApp Web ignores untrusted page-side `.click()`
    on its chat list, so the bridge requests a trusted click via the
    `notification_click` command and Rust dispatches CDP
    `Input.dispatchMouseEvent` at the row's coordinates — but in 2.0.1 that
    command was missing from `build.rs` AND `main-remote.json`, so Tauri
    rejected it ("Command notification_click not allowed by ACL") and the
    bridge fell back to the ignored page-side click. Fix 1: registered the
    command in both files (with a settingsAcl test asserting it). Fix 2: the
    row finder matched the chat-list body's GIANT wrapper container (tens of
    thousands of px tall) before the real row, clicking its off-screen center
    (verified live: trusted clicks at y=19519 for a row visible at y=238);
    `findNotificationChatRow` and `drop.findChatRow` now pick the SMALLEST
    matching element by bounding area, and `requestTrustedClick` refuses
    off-viewport coordinates. Verified end-to-end live: routing resolves
    opened=true, the trusted click lands on the sender's row, and the
    conversation actually switches (Angelineku and Mama both tested).

## [1.5.0] - 2026-08-08

### Fixed

- Clicking a message toast now opens the sender's chat directly instead of
  showing whatever conversation was last on screen. Toasts carry a launch
  payload (sender, chat id, message id) that works both while the app is
  running and when Windows has to relaunch it from the tray/Start-menu
  shortcut; the bridge also resolves the sender's stable chat id from the chat
  list at notify time so activation never depends on a display-name match
  alone.
- Toast activation for a not-running app (cold launch from the notification)
  routes to the sender's chat on first start: the route waits for the account
  window's page to finish loading instead of racing the bridge, and the
  account window is brought forward (shown/restored) before the chat is
  clicked, so a tray-hidden window can no longer swallow the routing.
- Message content never reaches the toast launch payload when previews are
  disabled (privacy: the payload also appears on the process command line).
- Chat routing is more robust on a busy/hidden page: it verifies the clicked
  row actually opened, retries with a bounded budget, closes an open
  right-side drawer before clicking, and matches the chat id on the row's
  outer container as well as its inner cells.
- Doodles are now locked to the official Light and Dark themes only: System
  and every personality theme keep WhatsApp's doodle wallpaper suppressed,
  including on the reply/quote surface (the kill switch now covers the
  quoted/reply/composer containers and every inline wallpaper layer).
- Personality themes apply their palette EXCLUSIVELY to the main
  conversation/Chat UI viewport (wallpaper panel, conversation header,
  composer); the side navigation rail and the middle contact/list column
  stay completely original and unaffected.
- The taskbar unread badge is larger and readable: a compact 4x7 digit font
  on a 48 px canvas with generous margins so digits never touch the ring;
  still re-applied whenever the window returns to the taskbar.
- Windows toasts always carry the WhatsNow app icon artwork (the same PNG as
  the release repository's docs/assets/icon.png) plus the WhatsNow app name
  in the notification's attribution line, like a small title bar.

### Changed

- Launch at startup is now the default out-of-the-box behavior (tray-resident
  app). It can still be turned off in Settings > Preferences.
- Windows message toasts stay in the Windows notification center (taskbar
  notification history) after their on-screen banner fades, so a missed
  message can be reopened later instead of being dismissed automatically.
- Settings is now a seamless pop-up instead of a second native window: no
  titlebar (the page draws its own title bar with "WhatsNow — Settings" and
  a close/X button), no taskbar button, theme-matched background, reveal only
  after its first paint (no flash or glitch while opening), and it closes
  itself after 30 seconds without interaction. The frameless style is
  permanent: a stale saved window-state can no longer re-attach the native
  title bar, and `whatsnow --settings` (also forwarded to a running hidden
  instance) summons the pop-up from the tray, Start menu, or a shortcut.

## [1.0.0] - 2026-07-27

Initial WhatsNow release.

### Added

- Multi-account WhatsApp Web sessions with per-account notification controls.
- Redesigned Settings workspace with account, Focus, appearance, notification,
  preference, security, and About sections.
- Ten persistent themes covering neutral, masculine, gentle, and playful
  palettes across Settings, app lock, native chrome, and live chat surfaces.
- Native unread tracking from both WhatsApp title changes and accessible DOM
  badges, with a clean tray icon and numeric taskbar indicator.
- Native notification bridge with preview privacy, deduplication, Focus mode,
  direct/group/community preview extraction, a first-unread compatibility path,
  and a test-delivery diagnostic.
- App lock with Argon2id passwords and supported platform biometrics.
- Windows, macOS, and Linux installers plus a Windows portable distribution.
- Platform-aware global shortcut defaults, including `Alt+W` on Windows.
- Automatic native titles from the logged-in WhatsApp Profile name.
- Default-browser routing for web links.
- Direct file-drop confirmation without flashing the Attach menu or opening a
  native file picker.
- Versioned Windows icon registration to refresh taskbar and Start-menu caches.
- GitHub-ready installation, privacy, troubleshooting, support, security,
  publishing, and release documentation.
- Branded repository hero and feature artwork, issue forms, a pull-request
  template, and automated documentation integrity checks.
- Configurable 2–30 second message-preview duration.

### Fixed

- Restored the complete local Settings command permissions, so Appearance,
  Notifications, Preferences, Focus, and Security load, save, and apply alongside
  Accounts instead of failing silently.
- Save Changes now reports loading, persistence, shortcut, autostart, window, and
  live chat-theme application errors rather than leaving controls unchanged.
- Newly added account windows now initialize asynchronously instead of opening as
  an unresponsive white WebView on their first session.
- The Settings workspace is pre-themed and revealed only after its local page has
  loaded, eliminating the white startup flash.
- Portable Windows distributions preserve the exact `WhatsNow.exe` filename and
  are produced from an unmodified no-bundle executable.
- Portable and installed Windows builds register the per-user application
  identity required for native toast delivery.
- Message notifications are suppressed while any WhatsNow account window is
  visible, restored, and focused.
- Closing a lock-enabled window to the tray now defers the unlock prompt until
  WhatsNow is deliberately restored.
- The hidden system-tray icon remains unbadged; unread counts use the clearer
  taskbar overlay and accessible tray tooltip.
- Message previews use only the operating system's native notification service;
  no separate `WhatsNow notification` application window is created.
- Clicking a native Windows message toast restores the originating account,
  opens the matching direct, group, or community chat, and reveals the message
  when WhatsApp supplies a stable message identifier or preview text.
- Native Windows toast banners are explicitly hidden at the configured preview
  duration, so a three-second setting no longer remains visible for six seconds.
- Native toast expiry returns the apartment-bound toast to the application UI
  thread before hiding it, preventing Windows from silently falling back to its
  normal six-to-seven-second timeout.
- Drag-and-drop reserves the originating chat before file streaming begins.
  Cancelling a pending transfer keeps that chat selected and never targets
  WhatsApp's no-chat download screen.
- Dark and Light preserve WhatsApp's official interface and native doodle
  wallpaper. Personality themes change only the conversation background and
  suppress doodles without opening or navigating WhatsApp Settings.
- Added Aurora, a readable soft-pastel gradient theme. Personality themes now
  persist WhatsApp's doodle preference as disabled and suppress the wallpaper
  layer immediately while loading.
- Native toast activation now resolves the originating account and conversation
  before revealing WhatsNow, with a bounded chat-search fallback for virtualized
  or off-screen sender, group, and community rows.
- Toast message highlighting no longer calls page-level `scrollIntoView`, which
  could displace WhatsApp's header and composer until the window was reopened.
- Composer, Reply, quoted-message, bubble, and contact-list CSS is left entirely
  to WhatsApp so its native curvature, spacing, and light/dark colors remain intact.
- Historical unread state is treated as a startup baseline. Only newly received
  message fingerprints can produce a toast, and the same message is not shown again.
- The official-app download promotion is hidden without affecting attachment
  downloads.
- The About panel no longer displays the unrelated Save Changes action.
- The custom Focus duration control now matches the preset cards in weight,
  spacing, and readability.

### Security and release trust

- Restricted remote-page IPC and count-only unread reporting.
- Bounded, content-free diagnostic logging.
- Authenticode-ready Windows release workflow and signature verification tools.
- SHA-256 support in installation scripts.

### Authorship

WhatsNow 1.0.0 is authored solely by
[@benedictusrey](https://github.com/benedictusrey) and is released under the
[MIT License](LICENSE).
