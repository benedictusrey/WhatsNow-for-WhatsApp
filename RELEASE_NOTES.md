# WhatsNow 2.0.0

WhatsNow 2.0.0 is the newest release of the focused, multi-account WhatsApp
Web desktop workspace, authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

It keeps the WhatsApp Web experience, multi-account sessions, native
notifications, themes, App Lock, drag-and-drop attachments, and productivity
controls — and makes the small moments calmer: toast clicks land in the
sender's chat, startup shows no flash, and your unread count is easier to
read.

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

## Windows assets

- `WhatsNow_2.0.0_x64-setup.exe` — standard per-user installer
- `WhatsNow_2.0.0_x64_en-US.msi` — MSI deployment package
- `WhatsNow_2.0.0_portable.exe` — portable application
- `checksums.sha256` — SHA-256 integrity values

## Cross-platform assets

Publish these only after they have been built and tested on their matching
native runners:

- `WhatsNow_2.0.0_amd64.AppImage`
- `WhatsNow_2.0.0_amd64.deb`
- `WhatsNow_2.0.0_aarch64.dmg`
- `WhatsNow_2.0.0_aarch64.app.tar.gz`

## GitHub Actions cross-platform build

The public `.github/workflows/release.yml` workflow builds the Windows,
Linux x64, and Apple Silicon macOS assets on GitHub-hosted native runners,
then creates a combined SHA-256 manifest and uploads a draft release. It
produces these exact filenames:

- `WhatsNow_2.0.0_x64-setup.exe`
- `WhatsNow_2.0.0_x64_en-US.msi`
- `WhatsNow_2.0.0_amd64.AppImage`
- `WhatsNow_2.0.0_amd64.deb`
- `WhatsNow_2.0.0_aarch64.dmg`
- `WhatsNow_2.0.0_aarch64.app.tar.gz`

This repository remains installation-only. Before running the workflow, store
a read-only personal access token with access to the private source repository
as the `SOURCE_REPO_TOKEN` Actions secret. Then either enter the private
repository, source ref, and source path in **Actions > Build WhatsNow 2.0.0
cross-platform release > Run workflow**, or configure the repository variables
`WHATSNOW_SOURCE_REPOSITORY`, `WHATSNOW_SOURCE_REF`, and
`WHATSNOW_SOURCE_PATH`. The current nested source layout uses
`versions/WhatsNow-2.0.0-source` as `source_path`; use `.` when
the private source repository places `src-tauri` at its root.

Manual runs upload workflow artifacts by default. Enable `publish_release`
only after all three builds pass; the workflow then creates a draft `v2.0.0`
release for final filename, checksum, and platform review. No private source,
Settings UI, credentials, or account profiles are copied into this public
repository.

## Before installation

Read the [installation guide](docs/INSTALLATION.md). Verify every downloaded
file using [the published checksum](docs/SECURITY_AND_VERIFICATION.md). New or
unsigned Windows builds may trigger reputation-based warnings; do not bypass a
warning unless the release source, checksum, and publisher information are
verified.

The public repository intentionally contains documentation and distribution
helpers only. The application source and Settings UI implementation remain
private, while the release binaries retain the complete user-facing feature
set.

WhatsNow is independent and unofficial. It is not affiliated with or endorsed
by WhatsApp or Meta.
