# Publish WhatsNow 2.7.0 with GitHub Desktop

Maintained by [@benedictusrey](https://github.com/benedictusrey).

## 1. Select the existing repository

Open GitHub Desktop and choose **WhatsNow**. Use **Repository → Show in Explorer**
to confirm the active source checkout, not a historical copy. Confirm
**Repository → Repository settings → Remote** points to
https://github.com/benedictusrey/WhatsNow-for-WhatsApp.git.
Do not create another repository or a nested folder.

## 2. Review and commit

Use **Fetch origin**. Review remote changes before merging; never discard local
work to make publishing easier. Review **Changes**. Source, Settings UI, docs,
and workflows are public. Backups, session profiles, credentials, .workspace/,
dist/, target/, and node_modules/ must not appear in the commit.

Complete [the release checklist](RELEASING.md). Use this commit summary:

> Release WhatsNow 2.7.0

Optional description:

> Account names from the typed label or WhatsApp profile name, call window closes
> with its call, WhatsNow Settings button in the chat-list header, whole-window
> themes, instant-apply Settings, and one installer per operating system.

Click **Commit to main**, then **Push origin**. A commit records the revision;
pushing uploads it. Neither action alone publishes installers. Documentation-only
commits never need a workflow run, and GitHub Actions minutes are limited.

## 3. Build in GitHub Actions

Click **Repository → View on GitHub**, open **Actions**, select
**Build WhatsNow cross-platform release**, then **Run workflow**.
Choose main, enter app_version=2.7.0, release_tag=v2.7.0, and enable
publish_release. Run it once. Do not also create/push the tag manually.

The workflow freezes the selected commit, runs behavior gates, builds the Windows
setup, the Linux AppImage, and the universal macOS DMG, then creates a draft
release. Follow the job logs. A failed build is not a completed cross-platform
release.

## 4. Review and publish the draft

Open **Releases**, edit the v2.7.0 draft, and confirm its tag/commit.
Use [RELEASE_NOTES.md](../RELEASE_NOTES.md) for its description; the changelog
lives on the release page. Verify the three installers and checksums.sha256
listed in [Publishing](PUBLISHING.md). Download them and compare hashes. Run
**Actions → check** by hand only when platform-specific code changed.

Keep unsigned/notarization disclosures and unverified live-test limits.
Click **Publish release** after review. Reopen the public release and check
files, links, and latest-release status. Future fixes need a new version;
do not replace published binaries silently.
