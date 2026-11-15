# Release WhatsNow 2.7.0

Maintained by [@benedictusrey](https://github.com/benedictusrey).

Source and release workflows live in the public repository. No private-source
checkout or source-access token is required. See [Publishing](PUBLISHING.md)
and the [GitHub Desktop guide](GITHUB_DESKTOP_PUBLISHING.md).

GitHub Actions minutes are limited. Documentation, README, and changelog edits
never need a workflow run; do all verification locally first and push only when
the release is ready.

## Before freezing the source

1. Match VERSION, Cargo package/lock versions, Tauri configuration, Settings cache
   tokens, and workflow defaults to 2.7.0. Keep the existing application identity.
2. Review the complete diff, including new native files and diagnostics. Keep
   profiles, credentials, backups, build caches, and generated binaries out of Git.
3. Run locally: `cargo fmt --all -- --check`, `cargo test --lib`,
   `cargo clippy --all-targets -- -D warnings` (also with
   `--features windows-memory,portable-mode`), every JavaScript/browser regression
   suite listed in the `verify` job of `.github/workflows/release.yml`, the
   documentation check, and `actionlint` on the workflow files.
4. Preserve themes/doodles, composer/emoji behavior, compact native toasts,
   click-to-chat routing, no-refresh phone links, account isolation, the call
   window (opens, resizes, maximizes, closes with its call), and the account-name
   rule (typed name, else WhatsApp profile name).
5. On Windows, run the background-media and audio-identity fixtures and
   `cargo run --example call-window-smoke`.
6. Record testing limits and signing status. See [the implementation record](IMPLEMENTATION_v2.7.0.md).
   Native synthetic tests do not certify long real calls, Windows 10, or any
   macOS/Linux installed-app behavior.

## Build and publish

Push the reviewed source, then push the matching version tag once (`v2.7.0`).
Alternatively dispatch **Build WhatsNow cross-platform release** with
app_version=2.7.0, release_tag=v2.7.0, and publish_release=true. Do not use both.

The workflow runs behavior gates, builds the Linux AppImage, the universal macOS
DMG, and the Windows setup, and creates a **draft** only after all three
installers exist, the macOS binary is universal, and the combined
`checksums.sha256` verifies. The `check` workflow (four-platform compile, test,
and lint matrix) runs only when started by hand or on code pull requests; run it
before tagging when platform-specific code changed.

Windows artifacts are unsigned unless a trusted signing process is configured;
macOS packages are not Developer ID signed or notarized. Do not claim otherwise
or disable endpoint protection.

Before publishing, verify the tag resolves to the build commit, download the
installers, verify hashes, and put the changelog (see `RELEASE_NOTES.md`) in the
release description. The changelog lives on the GitHub release page, not in the
README. Never mix local candidates with CI packages from another revision or
overwrite a published version.

After publication, read back public status, tag/commit, the three installers plus
manifest, and links. Submit suspected antivirus false positives through the
vendor's official review process.
