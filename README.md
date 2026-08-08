<p align="center">
  <img src="docs/assets/icon.png" alt="WhatsNow icon" width="168">
</p>

<h1 align="center">WhatsNow</h1>

<p align="center">
  <strong>A calm, lightweight desktop experience for WhatsApp Web</strong><br>
  Built with Tauri v2 + Rust + WebView2
</p>

<p align="center">
  <em>🎉 WhatsNow 2.0.0 is now available 🎉</em><br>
  <em>Toast clicks that land in the sender's chat, launch-at-startup by default, and a smoother, calmer experience.</em>
</p>

<p align="center">
  <a href="https://github.com/benedictusrey/WhatsNow-for-WhatsApp/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/benedictusrey/WhatsNow-for-WhatsApp?display_name=tag&sort=semver"></a>
  <img alt="Version 2.0.0" src="https://img.shields.io/badge/version-2.0.0-213547">
  <img alt="Platform Windows macOS Linux" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-168B72">
  <img alt="Built with Tauri v2" src="https://img.shields.io/badge/built%20with-Tauri%20v2-24A6D8">
  <img alt="Built with Rust" src="https://img.shields.io/badge/built%20with-Rust-B7410E">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-6B9E3A"></a>
  <a href="https://github.com/benedictusrey"><img alt="Author @benedictusrey" src="https://img.shields.io/badge/author-%40benedictusrey-111827"></a>
</p>

<hr>

WhatsNow is an independent desktop client that combines the official WhatsApp
Web service with focused desktop controls. Keep your familiar conversations,
then add the small details that make a desktop workflow feel like your own:
quiet notifications, isolated accounts, personal themes, App Lock, and focus
tools.

Think of it as WhatsApp Web with the browser removed — a calm, lightweight
shell that stays out of your way: one window per account, toasts you can
actually click, a badge you can actually read, and themes that make the chat
yours.

This repository distributes WhatsNow 2.0.0, installation helpers, user
documentation, artwork, and release checksums. The application source and
Settings UI implementation are not included.

> WhatsNow is an independent, unofficial project. It is not affiliated with,
> endorsed by, or maintained by WhatsApp LLC or Meta Platforms, Inc. WhatsApp
> is a trademark of its respective owner.

## What WhatsNow adds

Everything below is the *desktop* layer — WhatsApp's messaging stays exactly
as WhatsApp runs it.

<p align="center">
  <img src="docs/assets/whatsnow-features.png" alt="Concept artwork presenting WhatsNow accounts, Focus, App Lock, notifications, drag and drop, shortcuts, and themes" width="100%">
</p>

<p align="center"><em>Original concept artwork representing WhatsNow's desktop productivity features.</em></p>

| Area | WhatsNow 2.0.0 |
| --- | --- |
| Accounts | Separate desktop sessions, switching, renaming, removal, unread state, and per-account notification choices |
| Focus | Preset and custom focus sessions with tray controls |
| Notifications | Native operating-system alerts, foreground suppression, preview controls, and duplicate prevention |
| Appearance | Official-style Dark and Light modes plus Graphite, Midnight, Forest, Ocean, Blush, Lavender, Candy, and Aurora Pastel backgrounds |
| Productivity | Global shortcut, launch at startup, close to tray, start minimized, always on top, and direct browser links |
| Security | App Lock, supported platform biometrics, isolated account profiles, narrow page-to-app permissions, and content-free diagnostics |
| Desktop integration | Profile-based window titles, native tray behavior, taskbar unread state, downloads, and direct drag-and-drop attachments |
| Efficiency | Active WebView2 accounts stay responsive while minimized, tray-hidden, and secondary accounts request the supported low-memory target |

The account window title follows the logged-in WhatsApp profile name. A profile
named Ben appears as `WhatsNow — Ben`.

## What's new in 2.0.0

- **Toast clicks open the sender's chat.** A message notification now carries
  the sender's identity (name, chat id, message id), so clicking it jumps
  straight into that conversation — even when the app was fully closed and
  Windows had to relaunch it. No more landing on whatever chat was last open.
- **Launch at startup by default.** WhatsNow starts with Windows (hidden to
  the tray) out of the box, so messages keep arriving and one click on a
  toast brings you to the conversation. Turn it off any time in
  Settings > Preferences.
- **Toasts stay in the Windows notification center.** Message alerts are kept
  in the taskbar notification history after their banner fades, so a missed
  message can be reopened later. The banner time (short or extended) follows
  the Preview duration setting.
- **No more launch flash.** Windows open only after their first page paints,
  so startup feels calm instead of blinking white.
- **A clearer unread badge.** The taskbar count is bigger, high-contrast
  (black badge, white digits, white ring), drawn with a compact readable font
  that keeps the numbers clear of the badge ring, and re-applies itself
  whenever the window returns to the taskbar — while the tray icon stays
  clean.
- **Doodles belong to the official themes only.** The Light and Dark themes
  keep WhatsApp's native doodle wallpaper; System and every personality theme
  keep it suppressed, including on the reply/quote surface.
- **Personality themes stay in the chat.** Theme colors apply exclusively to
  the main conversation viewport (wallpaper, header, composer); the side
  navigation rail and the contact/message list column remain completely
  original.
- **Settings opens as a seamless pop-up.** No native titlebar — a custom
  "WhatsNow — Settings" title bar with a close/X button — no second taskbar
  button, no flash or glitch while it opens, and it closes itself after 30
  seconds of inactivity.
- **The WhatsNow icon appears on every notification.** Each toast banner and
  every notification-center entry carries the small WhatsNow logo next to
  the app name — the app identity registration is refreshed on every launch,
  so moved or renamed installs keep their icons.
- **Theme and doodle logic is fixed.** Light and Dark always keep WhatsApp's
  doodle wallpaper; System and the personality themes always stay clean —
  with instant, reload-free theme switches.
- **Cross-platform release pipeline.** Windows (installer, MSI, portable),
  Linux (AppImage, .deb), and macOS (DMG, archive) are built by GitHub
  Actions from the private source; the public repository distributes only
  the finished, checksummed assets.
- Message previews stay private: when previews are disabled, no message
  content ever enters the toast payload.

See the [complete feature guide](docs/FEATURES_AND_COMPARISON.md) for account,
notification, appearance, productivity, security, and platform behavior.

## WhatsNow vs WhatsApp Web — the short version

Same WhatsApp. Same account, same encryption, same conversations. The
difference is the *desktop* part — everything WhatsApp Web leaves to the
browser, WhatsNow actually does.

| Your day | WhatsNow 🟢 | WhatsApp Web in a browser tab |
| --- | --- | --- |
| Where it lives | Its own desktop window — no tab juggling | One tab among twenty others |
| Close the window | Hides to the tray; messages keep arriving | Closes the chat entirely |
| Startup | Launches with Windows and waits quietly in the tray | Open the browser, find the tab, log in again |
| Notifications | Native toasts with the WhatsNow icon — click one and you're in the sender's chat | Browser pop-ups; dismiss one and it's gone |
| Notification history | Alerts stay in the Windows notification center | Gone the moment they fade |
| Multiple accounts | Isolated sessions side by side, each with its own window | One account per browser profile |
| Unread count | A big, readable taskbar badge | A tiny favicon dot — if you remember to look |
| Themes | Official Dark/Light plus 8 personality palettes; doodles stay on the official themes only | Light, Dark, and whatever the browser's dark mode does |
| Focus mode | Sessions that quiet interruptions for 15 minutes to 24 hours | Closing the tab |
| App Lock | Optional password or biometric lock | Nothing at all |
| Attachments | Drag and drop straight into the chat | Click through the browser's file picker |
| Resource use | A focused Tauri + WebView2 shell | An entire browser hosting one tab |
| Updates | One-click installers for Windows, macOS, and Linux | Whatever the browser updates |

**The bottom line:** WhatsApp Web is the service. WhatsNow is the desktop.
Same chats, same encryption — with the desktop ergonomics that a browser tab
simply doesn't have.

WhatsNow does not replace WhatsApp's network, encryption, account system, or
terms. Changes to WhatsApp Web can affect the desktop experience.

## Observed Windows resource snapshot

<p align="center">
  <img src="docs/assets/whatsnow-resource-snapshot.png" alt="Observed Task Manager snapshot comparing web.whatsapp.com in Microsoft Edge with WhatsNow" width="100%">
</p>

In the supplied snapshot, Microsoft Edge displayed a `173.2 MB` WhatsApp Web
tab process before the account was linked, while Windows displayed the linked
WhatsNow app group at `6.8 MB`.

This is an illustrative observation, not a controlled benchmark. Edge and
WebView2 can group subprocesses differently, and total memory changes with
session state, extensions, cached data, active chats, media, calls, and runtime
versions. Readers should compare total process trees under the same workload
before drawing performance conclusions.

## Download

Grab the build for your platform — every package is checksum-verified and
attached to a published release.

Use the [latest GitHub Release](https://github.com/benedictusrey/WhatsNow-for-WhatsApp/releases/latest).

| Platform | Recommended asset |
| --- | --- |
| Windows 10/11 x64 | `WhatsNow_2.0.0_x64-setup.exe` |
| Managed Windows deployment | `WhatsNow_2.0.0_x64_en-US.msi` |
| Portable Windows 10/11 | `WhatsNow_2.0.0_portable.exe` |
| Linux x64 | `WhatsNow_2.0.0_amd64.AppImage` or `.deb` |
| Apple silicon Mac | `WhatsNow_2.0.0_aarch64.dmg` or `.app.tar.gz` |

Only install assets that are actually attached to a published release.
The release pipeline builds Windows, Linux, and macOS assets on their
respective native GitHub Actions runners from the private source repository;
the public repository stores only the finished binaries and checksums.
Windows packages are also staged in `release-assets/windows` for local
verification. Do not publish placeholder files.

Version 2.0.0 keeps the active account responsive while requesting WebView2's
supported low-memory target for minimized, tray-hidden, and secondary accounts.
This is best-effort process management, not a fixed-RAM guarantee: WebView2
still owns browser, renderer, GPU, and utility processes.

Read the complete [installation guide](docs/INSTALLATION.md) and
[platform notes](docs/PLATFORM_SUPPORT.md). Windows 10 users can also read the
[memory-conscious build notes](docs/WINDOWS_10.md).

## Security in brief

- Download only from the release page owned by `benedictusrey`.
- Compare the file's SHA-256 value with the published checksum.
- Check the operating-system signature when a signed build is available.
- WhatsNow does not proxy chats through a project-operated server.
- Account sessions remain in local operating-system webview profiles.
- App Lock limits casual access to the window; it does not encrypt those files.
- Native notifications can expose sender or message text on the lock screen.
  Disable previews if that is not appropriate for your environment.
- An unsigned new desktop build can trigger SmartScreen or antivirus
  reputation warnings. A warning is not proof of malware, but it should never
  be ignored without verifying the source and checksum.

See [Security and verification](docs/SECURITY_AND_VERIFICATION.md),
[privacy notes](PRIVACY.md), and the [security policy](SECURITY.md).

## Documentation

- [Install on Windows, macOS, or Linux](docs/INSTALLATION.md)
- [Features and app comparison](docs/FEATURES_AND_COMPARISON.md)
- [Platform support and limitations](docs/PLATFORM_SUPPORT.md)
- [Windows 10 memory-conscious build](docs/WINDOWS_10.md)
- [Security and download verification](docs/SECURITY_AND_VERIFICATION.md)
- [Privacy and local data](PRIVACY.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Publish with GitHub Desktop](docs/GITHUB_DESKTOP_PUBLISHING.md)
- [Release notes](RELEASE_NOTES.md)
- [Support](SUPPORT.md)

## Author and license

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

Copyright (c) 2026 [@benedictusrey](https://github.com/benedictusrey). Documentation and included helper scripts
are released under the [MIT License](LICENSE). See
[Third-party notices](THIRD_PARTY_NOTICES) for external components and
trademarks.
