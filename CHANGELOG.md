# Changelog

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

## 2.5.0 — Four locked pillars: themes, emoji, compact toasts, click-to-chat routing

- **Themes + doodle mapping is a fixed contract.** Official `Dark` and
  `Light` keep WhatsApp's doodle wallpaper; System and every personality
  theme (midnight through aurora) stay clean on every surface — including
  the reply/quote cards and all wallpaper layers. Theme switches are
  instant and reload-free, and per-theme CSS is never rewritten.
- **Typing-area emojis render in every theme.** A verified regression had
  made typed emojis invisible on the official Dark theme and every
  personality theme (only Light showed them). Root cause: the doodle
  kill-switch's broad bypass wiped WhatsApp's inline emoji sprite
  backgrounds. The bypass now excludes emoji-sprite elements, so the same
  emojis render identically in all themes — with automated invariants
  guarding the fix.
- **Float (banner) notifications are always compact.** Every toast and
  every notification-center entry uses the small WhatsNow icon next to the
  "WhatsNow" name — never the large left-side banner. Root cause: a
  per-toast `appLogoOverride` image made Windows draw the large-icon
  layout; it was removed, and a test now forbids its return.
- **Clicking a notification opens the sender's chat.** Toast and
  notification-center clicks reliably land in the sender's conversation.
  Root causes fixed: WhatsApp ignores untrusted page clicks (routing now
  synthesizes a real trusted click through the host), the command was
  missing its ACL registration (now in `build.rs` + the remote
  capability), and row discovery could target WhatsApp's giant list
  wrapper instead of the real chat row (now smallest-match). All verified
  live end-to-end.
- **Reply/quote bars can no longer flash doodles on dark personality themes.**
  WhatsApp 2.24xx+ paints its default doodle wallpaper as a CSS *mask*
  (`[data-testid='conversation-background-*']` with an inline `mask-image`
  SVG pattern over a translucent tint), not as a `background-image`, and it
  renamed the composer container to `compose-box`. The doodle kill-switch now
  zeroes the mask (and the tint it shapes) on every wallpaper layer, adds an
  inline-mask belt-and-suspenders rule that still spares emoji/compose
  surfaces, and covers both the legacy and current composer testids — so the
  curtain effect while Replying is gone on Graphite through Aurora, while
  Light/Dark keep WhatsApp's official doodles.
- **Settings > About always shows the real version.** The About card and
  footer carried a hardcoded "WhatsNow 2.0.1" label that survived the bump.
  The version is now injected at runtime from the compiled package, so it can
  never drift from the binary again.
- **Windows assets use the universal `windows` naming.** The `windows10`
  tag is retired everywhere: `WhatsNow_2.5.0_windows_x64-setup.exe` /
  `-portable.exe`, `checksums-windows.sha256`. The build targets any 64-bit
  Windows 10 or Windows 11.
- **Complete publish workflow documented.** `docs/GITHUB_DESKTOP_PUBLISHING.md`
  now walks the full two-repo flow (private `i-w` source + this public
  installation-only repository) with GitHub Desktop steps, and the release
  workflow builds Windows (NSIS + MSI + portable), Linux (AppImage + .deb),
  and macOS (Apple Silicon + Intel DMG/archive) non-universal packages — and
  refuses to run if the private source repository is ever public.
- Version 2.5.0 replaces the 2.0.1 line with the same verified fixes in a
  fresh release; every pillar is backed up byte-identically in the private
  workspace (`backup/v2.5.0-locked/`).

## 2.0.0 — Notification icons everywhere, locked theme logic, cross-platform release

- The WhatsNow icon now appears on **every** toast banner and every
  notification-center entry. The app identity registration (`IconUri`) is
  rewritten at every launch to point at the real icon file with a fully
  backslash-normalized path, so moved or renamed installs self-heal and no
  notification is ever left icon-less.
- Theme and doodle behavior is now a fixed contract: the official Light and
  Dark themes keep WhatsApp's doodle wallpaper; System and every personality
  theme (midnight through aurora) stay clean on every surface — including
  the reply/quote cards. Theme switches are instant and reload-free.
- The release pipeline is now truly cross-platform: GitHub Actions builds
  Windows (installer, MSI, portable), Linux x64 (AppImage, .deb), and Apple
  Silicon macOS (DMG, archive) from the private source repository and
  publishes a single checksummed draft release. The public repository stays
  installation-only — no source or Settings UI is ever published.

## 1.5.0 — Toast routing, startup defaults, and a calmer feel

- Toast clicks now open the sender's chat directly — including cold starts
  when Windows relaunches the app from a notification. Toasts carry a launch
  payload (sender, chat id, message id); routing waits for the account
  window's page to load, brings the window forward first (a tray-hidden
  window can no longer swallow the clicks), and verifies the click against
  the conversation header with a bounded retry budget.
- Launch at startup is now the default out-of-the-box behavior (hidden to the
  tray); it can still be turned off in Settings > Preferences.
- Windows message toasts stay in the notification center after their banner
  fades, so missed messages can be reopened later; the banner time follows
  the Preview duration setting.
- Windows toasts always carry the WhatsNow app icon artwork and a
  privacy-safe launch payload (no message content when previews are disabled).
- Removed the white launch flash: account windows reveal only after their
  first page paints, with a bounded fallback timer.
- Redesigned the taskbar unread badge: bigger high-contrast black-and-white
  digits on a compact font, with margins that keep the numbers clear of the
  badge ring; re-applied whenever the window returns to the taskbar. The tray
  icon stays clean.
- Doodles are locked to the official Light and Dark themes only: personality
  themes (and System) keep WhatsApp's doodle wallpaper suppressed, including
  on the reply/quote surface and every inline wallpaper layer.
- Personality themes apply their palette EXCLUSIVELY to the main
  conversation/Chat UI viewport; the side navigation rail and the middle
  contact/list column stay completely original and unaffected.
- Settings is now a seamless pop-up: no native titlebar — a custom
  "WhatsNow — Settings" title bar with a close/X button — no taskbar button,
  theme-matched background, reveal only after its first paint, it closes
  itself after 30 seconds of inactivity, and the frameless style is
  permanent (a stale saved window-state can no longer re-attach the native
  title bar). `whatsnow --settings` summons it from anywhere, including a
  running hidden-to-tray instance.
- Message toasts show the WhatsNow app icon artwork with the WhatsNow name in
  the attribution line, like a small title bar.

## 1.1.0 — WebView2 efficiency and distribution update

- Added a supported WebView2 memory-target policy: the focused account remains
  responsive while minimized, tray-hidden, and secondary accounts request the
  low-memory target when available.
- Preserved background scripts, native notifications, multi-account isolation,
  and direct notification-to-chat routing while accounts are in the background.
- Refined the official Dark/Light composer behavior and kept personality themes
  immersive by disabling WhatsApp doodles without moving the page.
- Updated Windows, Linux, and macOS installation guidance, release verification,
  and public installation-only repository documentation.

## 1.0.0 — Initial release

- Added isolated multi-account sessions and profile-based window titles.
- Added focus sessions, configurable shortcuts, autostart, tray behavior, and
  window preferences.
- Added native notifications with foreground suppression, preview controls,
  recent-message deduplication, and notification click routing.
- Added App Lock with password hashing and supported platform biometrics.
- Added Dark, Light, Graphite, Midnight, Forest, Ocean, Blush, Lavender, Candy,
  and Aurora Pastel appearances.
- Added direct browser links, downloads, and drag-and-drop attachments.
- Added Windows installer, MSI, and portable release formats.
- Prepared macOS and Linux packaging and installation guidance.
