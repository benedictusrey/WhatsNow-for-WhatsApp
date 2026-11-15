# Publish WhatsNow 2.7.0

Maintained by [@benedictusrey](https://github.com/benedictusrey).

Source, Settings UI, documentation, and workflows live together in
[WhatsNow-for-WhatsApp](https://github.com/benedictusrey/WhatsNow-for-WhatsApp).
This is no longer a distribution-only repository. Backups, profiles, credentials,
compiler caches, and package binaries remain ignored.

## Release flow

1. Complete [the release checklist](RELEASING.md) locally. Review the
   [v2.7.0 implementation and limits](IMPLEMENTATION_v2.7.0.md). Docs-only
   changes never need a workflow run.
2. Commit the reviewed changes, push main, and record its full commit SHA.
3. Push the version tag once (`v2.7.0`), or run **Actions → Build WhatsNow
   cross-platform release → Run workflow** with app_version=2.7.0,
   release_tag=v2.7.0, and publish_release=true. Never both. Never move
   published tags.
4. Wait for the behavior gates and the Windows, Linux, and macOS builds. Inspect
   failures rather than uploading stale local candidates as replacements.
5. Verify the draft's source revision, packages, and SHA-256 manifest, and paste
   the changelog from `RELEASE_NOTES.md` into the release description.
6. Publish after review. Read back the public release, tag, files, hashes, and
   latest-release link. Keep disclosed testing limitations visible.

## Expected release assets (one installer per operating system)

- WhatsNow_2.7.0_windows_x64-setup.exe
- WhatsNow_2.7.0_macos_universal.dmg (Apple Silicon and Intel in one)
- WhatsNow_2.7.0_linux_x86_64.AppImage
- checksums.sha256

The MSI, portable executable, Debian package, and per-architecture macOS files
are no longer release assets; build them locally with `scripts/build-windows.ps1`
or `cargo tauri build` when needed.

GitHub's automatic source archives are not installers. Windows packages are
unsigned; macOS packages are not Developer ID signed or notarized. Checksums
detect mismatches but are not independent proof of safety.

See [GitHub Desktop publishing](GITHUB_DESKTOP_PUBLISHING.md),
[installation](INSTALLATION.md), and [security verification](SECURITY_AND_VERIFICATION.md).
