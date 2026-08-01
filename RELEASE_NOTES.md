# WhatsNow 1.1.0

WhatsNow 1.1.0 is the WebView2 efficiency and cross-platform distribution
update by [@benedictusrey](https://github.com/benedictusrey).

It keeps the WhatsApp Web experience, multi-account sessions, native
notifications, themes, App Lock, drag-and-drop attachments, and productivity
controls while making background and secondary Windows accounts more
memory-conscious through WebView2's supported memory target.

## Windows assets

- `WhatsNow_1.1.0_x64-setup.exe` — standard per-user installer
- `WhatsNow_1.1.0_x64_en-US.msi` — MSI deployment package
- `WhatsNow.exe` — portable application
- `checksums.sha256` — SHA-256 integrity values

## Cross-platform assets

Publish these only after they have been built and tested on their matching
native runners:

- `WhatsNow_1.1.0_amd64.AppImage`
- `WhatsNow_1.1.0_amd64.deb`
- `WhatsNow_1.1.0_aarch64.dmg`
- `WhatsNow_1.1.0_aarch64.app.tar.gz`

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
