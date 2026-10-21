# WhatsNow 2.6.2 release preparation

2026-10-21 · Maintained by [@benedictusrey](https://github.com/benedictusrey).

## Release scope

Prepare a draft release for the call-window repair and full-frame camera
preference. Preserve the published 2.6.1 release and its assets. The maintainer
reports successful Windows calling on the local 2.6.2 candidate. Use
"calling works smoothly in the maintainer's Windows test" rather than an
unqualified guarantee across operating systems and accounts.

## Gates

- [x] Application version declarations agree on 2.6.2.
- [x] Maintainer reports the installed Windows candidate works well.
- [x] Local native/browser fixtures and surrounding regressions passed.
- [x] Local Windows candidate versions and checksums verified.
- [x] Implementation and live-test provenance recorded in [the implementation record](IMPLEMENTATION_v2.6.2.md).
- [ ] Review the complete source diff and exclude local profiles, caches, credentials, and binaries.
- [ ] Record and push an immutable source revision.
- [ ] Complete CI checks and native cross-platform builds at that revision.
- [ ] Verify nine packages and the combined SHA-256 manifest in the draft.
- [ ] Confirm final signing status and keep platform-validation limits visible.
- [ ] Publish only after the maintainer requests publication of the prepared draft.

The workflow creates a draft; it does not publish it. Source changes after
tagging need a new revision and rebuild, not silent movement of a release tag.
The local Windows test does not establish native Linux/macOS calling support.

## Expected assets

```text
WhatsNow_2.6.2_windows_x64-setup.exe
WhatsNow_2.6.2_windows_x64_en-US.msi
WhatsNow_2.6.2_windows_x64-portable.exe
WhatsNow_2.6.2_amd64.AppImage
WhatsNow_2.6.2_amd64.deb
WhatsNow_2.6.2_aarch64.dmg
WhatsNow_2.6.2_aarch64.app.tar.gz
WhatsNow_2.6.2_x86_64.dmg
WhatsNow_2.6.2_x86_64.app.tar.gz
checksums.sha256
```

CI packages are rebuilds of the approved source, not the exact locally tested
binary. Verify their versions and digests before publication. Windows candidates
are unsigned; checksums establish integrity, not publisher identity or malware
absence. Use the [installation guide](INSTALLATION.md) and [security guidance](../SECURITY.md).
