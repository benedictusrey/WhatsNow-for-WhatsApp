<!-- Release body for the CURRENT WhatsNow release ONLY. This file is consumed
     verbatim as the GitHub Release body (release.yml: body_path). Never append
     historical version sections here -- keep history in CHANGELOG.md. -->

# WhatsNow 2.5.0

WhatsNow is a calm, lightweight desktop client for WhatsApp Web — built for
focus, multi-account work, and a chat that feels like your own. It is an
independent project by [@benedictusrey](https://github.com/benedictusrey).

Same WhatsApp. Same account, same encryption, same conversations — with the
desktop ergonomics a browser tab simply doesn't have: click a toast and land
in the sender's chat, read your unread count at a glance, and pick a theme
that makes the chat yours.

## What's in 2.5.0

- **Emojis you type are visible in every theme.** A verified regression had
  hidden typed emojis on the official Dark theme and every personality
  theme (only Light showed them). The doodle kill-switch was wiping
  WhatsApp's inline emoji sprites; it now spares them, and the same emojis
  render identically across all themes.
- **Every toast is compact.** Each banner and notification-center entry
  shows the small WhatsNow icon next to the "WhatsNow" name — the large
  left-side icon layout is gone for good, on the first toast of a session
  and every one after.
- **Click a notification, land in the sender's chat.** Toast and
  notification-center clicks reliably open the exact conversation — even on
  a cold start — verified live end-to-end.
- **The Reply curtain is gone.** WhatsApp now paints doodles as a CSS mask,
  so the reply/quote bar could still flash them on dark personality themes.
  The kill-switch neutralizes the mask layer and the newer composer surface —
  verified live on Graphite through Aurora, with typed emojis intact.
- **The About dialog always reports the truth.** The version shown in
  Settings > About is injected from the compiled binary at runtime, so it
  can't lag behind the release again.
- **Themes and doodles stay a fixed contract.** Official Dark/Light keep
  WhatsApp's doodle wallpaper; System and every personality theme stay
  clean, with instant reload-free switching.

These four behaviors are user-required and locked (see the private source
workspace's AGENTS.md): themes/doodle mapping, typing-area emoji, compact
float notifications, and click-to-chat routing.

## Download

| Platform | Asset |
| --- | --- |
| Windows 10/11 x64 | `WhatsNow_2.5.0_windows_x64-setup.exe` — installer · `WhatsNow_2.5.0_windows_x64-portable.exe` — portable · `WhatsNow_2.5.0_windows_x64_en-US.msi` — MSI |
| Linux x64 | `WhatsNow_2.5.0_amd64.AppImage` · `WhatsNow_2.5.0_amd64.deb` |
| macOS Apple Silicon | `WhatsNow_2.5.0_aarch64.dmg` · `WhatsNow_2.5.0_aarch64.app.tar.gz` |
| macOS Intel | `WhatsNow_2.5.0_x86_64.dmg` · `WhatsNow_2.5.0_x86_64.app.tar.gz` |
| Every platform | `checksums.sha256` (combined) and `checksums-windows.sha256` (Windows) — verify your download against them |

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
implementation remain private.
