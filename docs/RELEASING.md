# Release WhatsNow 2.6.3

Maintained by [@benedictusrey](https://github.com/benedictusrey).

Source and release workflows live in the public repository. No private-source
checkout or source-access token is required. See [Publishing](PUBLISHING.md)
and the [GitHub Desktop guide](GITHUB_DESKTOP_PUBLISHING.md).

## Before freezing the source

1. Match VERSION, Cargo package/lock versions, Tauri configuration, Settings cache
   tokens, and workflow defaults to 2.6.3. Keep the existing application identity.
2. Review the complete diff, including new native files and diagnostics. Keep
   profiles, credentials, backups, build caches, and generated binaries out of Git.
3. Run Rust tests with default and Windows/portable features, strict Clippy,
   rustfmt, all JavaScript/browser regression suites, and documentation checks.
4. Preserve themes/doodles, composer/emoji behavior, compact native toasts,
   click-to-chat routing, no-refresh phone links, account isolation, and native
   call-popup opener/resize/maximize behavior.
5. On Windows, run background-media and audio-identity fixtures, including
   notification-only discovery. Preserve user mute/volume and unrelated sessions.
6. Record testing limits and signing status. See [the implementation record](IMPLEMENTATION_v2.6.3.md).
   Native synthetic tests do not certify long real calls, Windows 10, or
   independent persisted mute alongside another WebView2 application.

## Build and publish

Commit and push the reviewed source. Dispatch the release workflow at that commit
with app_version=2.6.3, release_tag=v2.6.3, and publish_release=true.
Alternatively push the matching version tag once. Do not launch both paths.

The workflow runs behavior gates, builds Linux x64 and Windows x64 packages,
builds Apple Silicon/Intel targets on macOS, and creates a **draft** only after
all nine packages exist and the combined checksums.sha256 verifies.

Inspect the separate check workflow too. Compile/unit-test success is not an
installed-app test on Linux/macOS. Windows artifacts are unsigned unless a
trusted signing process is configured; macOS packages are not Developer ID
signed or notarized. Do not claim otherwise or disable endpoint protection.

Before publishing, verify the tag resolves to the build commit, download all
packages, verify hashes, and review release notes. Never mix local candidates
with CI packages from another revision or overwrite a published version.

After publication, read back public status, tag/commit, nine packages plus
manifest, successful workflows, and links. Submit suspected antivirus false
positives through the vendor's official review process.
