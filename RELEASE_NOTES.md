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

## GitHub Actions cross-platform build

The public `.github/workflows/release.yml` workflow builds the Linux x64 and
Apple Silicon macOS assets on GitHub-hosted native runners, then creates a
combined SHA-256 manifest and uploads a draft release. It produces these exact
filenames:

- `WhatsNow_1.1.0_amd64.AppImage`
- `WhatsNow_1.1.0_amd64.deb`
- `WhatsNow_1.1.0_aarch64.dmg`
- `WhatsNow_1.1.0_aarch64.app.tar.gz`

This repository remains installation-only. Before running the workflow, store
a read-only personal access token with access to the private source repository
as the `SOURCE_REPO_TOKEN` Actions secret. Then either enter the private
repository, source ref, and source path in **Actions > Build WhatsNow 1.1.0
cross-platform release > Run workflow**, or configure the repository variables
`WHATSNOW_SOURCE_REPOSITORY`, `WHATSNOW_SOURCE_REF`, and
`WHATSNOW_SOURCE_PATH`. The current nested source layout uses
`versions/WhatsNow-1.1.0-webview2-efficient` as `source_path`; use `.` when
the private source repository places `src-tauri` at its root.

Manual runs upload workflow artifacts by default. Enable `publish_release`
only after both builds pass; the workflow then creates a draft `v1.1.0`
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
