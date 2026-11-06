# Publish WhatsNow 2.6.3

Maintained by [@benedictusrey](https://github.com/benedictusrey).

Source, Settings UI, documentation, and workflows now live together in
[WhatsNow-for-WhatsApp](https://github.com/benedictusrey/WhatsNow-for-WhatsApp).
This is no longer a distribution-only repository. Backups, profiles, credentials,
compiler caches, and package binaries remain ignored.

## Release flow

1. Complete [the release checklist](RELEASING.md). Review the
   [v2.6.3 implementation and limits](IMPLEMENTATION_v2.6.3.md).
2. Commit the reviewed changes, push main, and record its full commit SHA.
3. In **Actions → Build WhatsNow cross-platform release → Run workflow**, select
   the reviewed branch and enter app_version=2.6.3, release_tag=v2.6.3, and
   publish_release=true. The workflow builds one frozen commit and creates a draft.
   Do not also push a tag to trigger a duplicate run. Never move published tags.
4. Wait for behavior gates and Windows, Linux, and macOS packaging. Inspect
   failures rather than uploading stale local candidates as replacements.
5. Verify the draft's source revision, notes, packages, and SHA-256 manifest.
   Check the separate platform compile/test workflow too.
6. Publish after review. Read back the public release, tag, files, hashes, and
   latest-release link. Keep disclosed testing limitations visible.

## Expected release assets

- WhatsNow_2.6.3_windows_x64-setup.exe
- WhatsNow_2.6.3_windows_x64_en-US.msi
- WhatsNow_2.6.3_windows_x64-portable.exe
- WhatsNow_2.6.3_amd64.AppImage
- WhatsNow_2.6.3_amd64.deb
- WhatsNow_2.6.3_aarch64.dmg
- WhatsNow_2.6.3_aarch64.app.tar.gz
- WhatsNow_2.6.3_x86_64.dmg
- WhatsNow_2.6.3_x86_64.app.tar.gz
- checksums.sha256

GitHub's automatic source archives are not installers. Windows packages are
unsigned; macOS packages are not Developer ID signed or notarized. Checksums
detect mismatches but are not independent proof of safety.

See [GitHub Desktop publishing](GITHUB_DESKTOP_PUBLISHING.md),
[installation](INSTALLATION.md), and [security verification](SECURITY_AND_VERIFICATION.md).
