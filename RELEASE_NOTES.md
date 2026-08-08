# WhatsNow 2.0.0

WhatsNow is a calm, lightweight desktop client for WhatsApp Web — built for
focus, multi-account work, and a chat that feels like your own. It is an
independent project by [@benedictusrey](https://github.com/benedictusrey).

Same WhatsApp. Same account, same encryption, same conversations — with the
desktop ergonomics a browser tab simply doesn't have: click a toast and land
in the sender's chat, read your unread count at a glance, and pick a theme
that makes the chat yours.

## What's new in 2.0.0

- **Click a toast, land in the conversation.** Notifications carry the
  sender's identity, so clicking one jumps straight into that chat — even
  when the app was fully closed.
- **The WhatsNow icon on every notification.** Every toast banner and every
  notification-center entry shows the small WhatsNow logo.
- **A badge you can actually read.** A big, high-contrast taskbar count that
  re-applies itself whenever the window returns to the taskbar.
- **Doodles only on the official themes.** Light and Dark keep WhatsApp's
  native doodle wallpaper; System and every personality theme stay clean.
- **Themes that stay in the chat.** Personality palettes color the
  conversation viewport only — the sidebar and contact list stay original.
- **A seamless Settings pop-up.** Frameless, custom title bar, no taskbar
  button, no flash — and it closes itself after 30 seconds of inactivity.
- **Toast history that lasts.** Alerts stay in the Windows notification
  center after the banner fades, so a missed message can be reopened.
- **Calmer startup.** Windows appear only after their first paint, and
  WhatsNow can launch with Windows, waiting quietly in the tray.
- **Instant theme switches.** No reloads — with a fixed contract: official
  themes keep the doodle wallpaper, personality themes never show it.
- **Cross-platform.** Windows, Linux, and macOS builds — all checksummed.

## Download

| Platform | Asset |
| --- | --- |
| Windows 10/11 | `WhatsNow_2.0.0_x64-setup.exe` — installer · `WhatsNow_2.0.0_x64_en-US.msi` — managed deployment · `WhatsNow_2.0.0_portable.exe` — portable |
| Linux x64 | `WhatsNow_2.0.0_amd64.AppImage` or `WhatsNow_2.0.0_amd64.deb` |
| macOS (Apple silicon) | `WhatsNow_2.0.0_aarch64.dmg` or `WhatsNow_2.0.0_aarch64.app.tar.gz` |
| Every platform | `checksums.sha256` — verify your download against it |

## Get started

1. Download the asset for your platform from this release.
2. Verify its SHA-256 checksum — see the
   [verification guide](docs/SECURITY_AND_VERIFICATION.md).
3. Follow the [installation guide](docs/INSTALLATION.md).
4. Open WhatsNow and link your phone: WhatsApp → **Linked devices** → scan
   the QR code.

New or unsigned Windows builds may trigger reputation-based warnings; do not
bypass a warning unless the release source, checksum, and publisher are
verified.

WhatsNow is independent and unofficial — it is not affiliated with or
endorsed by WhatsApp LLC or Meta. This repository distributes documentation
and finished binaries only; the application source and Settings UI
implementation remain private. The release pipeline and publishing flow are
documented for maintainers in
[docs/GITHUB_DESKTOP_PUBLISHING.md](docs/GITHUB_DESKTOP_PUBLISHING.md).
