# Local release assets

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

This folder is a local upload staging area. Executables and platform packages
are ignored by Git (`.gitignore`) and must be attached to GitHub Releases
instead of being committed to repository history. Only documentation and
checksum manifests are tracked.

## Layout — one folder per published version

Each `v*` folder mirrors the Windows assets published on the matching GitHub
Release (`https://github.com/benedictusrey/WhatsNow-for-WhatsApp/releases`).
Linux and macOS packages are produced by GitHub Actions on the release
workflow and attached to the release directly from the runner; add native
builds here only after local platform validation.

| Folder | Published release assets (Windows shown; full set on GitHub) | Staged locally |
| --- | --- | --- |
| `v1.0.0/` | `checksums-windows10.sha256`, `checksums.sha256`, `WhatsNow.exe`, `WhatsNow_1.0.0_windows10_x64-setup.exe`, `WhatsNow_1.0.0_windows10_x64-portable.exe`, `WhatsNow_1.0.0_x64-setup.exe`, `WhatsNow_1.0.0_x64_en-US.msi` | 4 Windows binaries |
| `v1.1.0/` | `checksums.sha256`, `WhatsNow.exe`, `WhatsNow_1.1.0_x64-setup.exe`, `WhatsNow_1.1.0_x64_en-US.msi` | 2 Windows binaries |
| `v2.0.0/` | `checksums.sha256`, `WhatsNow_2.0.0_x64-setup.exe`, `WhatsNow_2.0.0_x64_en-US.msi`, plus `_amd64.AppImage` / `_amd64.deb` (Linux) and `_aarch64.dmg` / `_aarch64.app.tar.gz` (macOS) | 2 Windows binaries |
| `v2.5.0/` | `checksums.sha256`, `WhatsNow_2.5.0_windows_x64-setup.exe`, `WhatsNow_2.5.0_windows_x64_en-US.msi`, `WhatsNow_2.5.0_windows_x64-portable.exe`, plus Linux and macOS packages | 3 Windows binaries + `checksums-windows.sha256` + `checksums.sha256` |

## Current release (v2.5.0)

- `WhatsNow_2.5.0_windows_x64-setup.exe` — NSIS installer
- `WhatsNow_2.5.0_windows_x64_en-US.msi` — MSI package (managed deployment)
- `WhatsNow_2.5.0_windows_x64-portable.exe` — portable application
- `checksums-windows.sha256` — SHA-256 manifest for the files above
- `checksums.sha256` — combined multi-platform manifest (updated by the
  GitHub Actions release workflow)

The `windows` naming is universal — the build targets any 64-bit Windows 10
or Windows 11 system. Do not reintroduce a `windows10` tag.

The binaries carry the four locked pillars: themes/doodle mapping (including
the Reply-bar mask fix), typing-area emoji rendering in every theme,
always-compact toasts, click-to-chat routing, and the runtime-injected About
version (see the workspace CHANGELOG).

## How to use

1. Upload the matching files to the GitHub Release for their version and keep
   the checksum manifest beside them.
2. Verify before publishing: `sha256sum -c v2.5.0/checksums-windows.sha256`
   (from this folder) or `.\scripts\verify-windows-release.ps1 -Path
   .\release-assets\v2.5.0`.
3. Never attach a file from one version folder to another version's release.

## Local-only leftovers

`_unpublished/` holds stray local files that were never published (older
portable/checksum variants, superseded manifests). It is fully ignored by
Git and exists only so nothing is silently destroyed — it is never uploaded.
