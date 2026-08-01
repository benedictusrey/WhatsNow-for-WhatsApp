# Changelog

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

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
