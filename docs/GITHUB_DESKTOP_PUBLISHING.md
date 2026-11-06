# Publish WhatsNow 2.6.3 with GitHub Desktop

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

> Release WhatsNow 2.6.3 background audio improvements

Optional description:

> Keep Windows media webviews at normal memory priority in the background.
> Add scoped WhatsNow audio-session identity without changing mute or volume.
> Update cross-platform release documentation and preserve existing workspace behavior.

Click **Commit to main**, then **Push origin**. A commit records the revision;
pushing uploads it. Neither action alone publishes installers.

## 3. Build in GitHub Actions

Click **Repository → View on GitHub**, open **Actions**, select
**Build WhatsNow cross-platform release**, then **Run workflow**.
Choose main, enter app_version=2.6.3, release_tag=v2.6.3, and enable
publish_release. Run it once. Do not also create/push the tag manually.

The workflow freezes the selected commit, runs behavior gates, builds Windows,
Linux, and both macOS architectures, then creates a draft release. Follow the
job logs. A failed build is not a completed cross-platform release.

## 4. Review and publish the draft

Open **Releases**, edit the v2.6.3 draft, and confirm its tag/commit.
Use [RELEASE_NOTES.md](../RELEASE_NOTES.md) for its description. Verify all nine
packages and checksums.sha256 listed in [Publishing](PUBLISHING.md).
Download them and compare hashes. Check **Actions → check** for platform tests.

Keep unsigned/notarization disclosures and unverified live-test limits.
Click **Publish release** after review. Reopen the public release and check
files, links, and latest-release status. Future fixes need a new version;
do not replace published binaries silently.
