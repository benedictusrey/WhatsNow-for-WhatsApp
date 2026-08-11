# Local release assets

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

This folder is a local upload staging area. Executables and platform packages
are ignored by Git (`.gitignore`) and must be attached to GitHub Releases
instead of being committed to repository history.

The `windows` subfolder is the v2.5.0 Windows upload staging area. Linux and
macOS packages are produced by GitHub Actions (the release workflow) and are
attached to the release directly from the runner; add native builds here only
after local platform validation.

## Current Windows assets (v2.5.0)

- `WhatsNow_2.5.0_windows_x64-setup.exe` — NSIS installer
- `WhatsNow_2.5.0_windows_x64_en-US.msi` — MSI package (managed deployment)
- `WhatsNow_2.5.0_windows_x64-portable.exe` — portable application
- `checksums-windows.sha256` — SHA-256 manifest for the files above
- `checksums.sha256` — combined multi-platform manifest (updated by the
  GitHub Actions release workflow)

The `windows` naming is universal — the build targets any 64-bit Windows 10
or Windows 11 system. Do not reintroduce a `windows10` tag.

Upload these files to the `v2.5.0` GitHub Release and keep the matching
checksum manifest beside them. The binaries carry the four locked pillars:
themes/doodle mapping (including the Reply-bar mask fix), typing-area emoji
rendering in every theme, always-compact toasts, click-to-chat routing, and
the runtime-injected About version (see the workspace CHANGELOG).

## Historical staging files

Files carrying `1.0.0`/`2.0.0`/`2.0.1` names, `checksums-1.0.0.sha256`, and
the older `WhatsNow_*.dmg`/`.AppImage`/`.deb` staging copies are retained only
as historical material for the earlier releases. Do not attach them to the
`v2.5.0` release.
