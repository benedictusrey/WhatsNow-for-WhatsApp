# Changelog

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

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
