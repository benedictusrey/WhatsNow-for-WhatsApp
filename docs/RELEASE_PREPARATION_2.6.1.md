# WhatsNow v2.6.1 release preparation

_Prepared on 2026-10-17 for WhatsNow, authored and maintained by [@benedictusrey](https://github.com/benedictusrey). Status: local candidate; publication gates remain open._

---

## 📋 Verified starting point

The user requested a release push with the four new presentation images and
explicitly chose **keep v2.6.1 as a draft until live checks are confirmed**.
GitHub connector calls remained unavailable, but the existing Git credential
manager authenticated the repository owner with push permission. Git/API
operations can therefore prepare the draft without weakening the live gates.
The README and related guides use the supplied artwork with measurement caveats.

Workspace consolidation on 2026-10-17 made the Desktop `WhatsNow` directory
the single canonical checkout. See [workspace layout](WORKSPACE_LAYOUT.md).
Recovery copies and build caches are local-only and must not enter the release commit.

- Target repository: `benedictusrey/WhatsNow-for-WhatsApp`
- Default branch: `main`
- Public `main` observed at `5c8dd158553c1a5ba6a4d8fbe1885d2d451df480`
- Newest published release observed: `v2.6.0`, with ten assets including checksums
- No public `v2.6.1` tag was returned by the public API
- At the original preparation checkpoint, local v2.6.1 changes had not been committed or pushed
- Existing tracked source includes `src-tauri/` and `settings-ui/`; this is not an installation-only repository

The selected GitHub connector returned `not available to the model` for repository
and release reads. GitHub CLI was not available. Public REST reads established
the state above, but cannot establish whether a private draft already exists.
No remote changes were made at that original checkpoint. The later release-push
request authorized Git/API operations using the existing credential manager,
with v2.6.1 explicitly kept as a draft. Check the repository's current Actions
and Releases pages for execution status rather than treating this checkpoint
as a live status feed.

## 📚 Release documents

| Document | Purpose |
| --- | --- |
| [Implementation record](../CHANGELOGS_v2.6.1.md) | All v2.6.1 changes, rejected paths, regression evidence, and limitations |
| [Current features](../WhatsNow_latest.md) | User-facing feature catalogue with platform and privacy boundaries |
| [Release notes](../RELEASE_NOTES.md) | Prepared GitHub release body |
| [Audit](AUDIT_2.6.1.md) | Detailed investigation and test evidence |
| [Installation](INSTALLATION.md) | Package selection, verification, and upgrade guidance |
| [Security](../SECURITY.md) | Trust, signing, privacy, and vulnerability-reporting boundaries |

The new records consolidate history; they do not replace or delete earlier
changelogs, locked backups, or older private candidate packages.

## ✅ Acceptance gates before publication

- [x] Final local setup, MSI, and portable packages built at 2.6.1
- [x] Local hashes reconciled with `checksums-windows.sha256`
- [x] Attribution regression preserves both GitHub links after version injection
- [x] Settings palette contrast regression passes
- [x] Final attribution source passed 110 Windows installer-mode Rust tests
- [x] Earlier routing/drop/theme/notification smoke results retained in the audit
- [ ] Install the final candidate after fully quitting the old tray process
- [ ] Verify known/unlisted/live `wa.me` handoffs, cold start, draft text, cancellation, and no refresh
- [ ] Complete a real two-party video call and resize/maximize/restore/media-continuity checks
- [ ] Check a real incoming native toast, activation target, and tray restore
- [ ] Review the source diff and ensure no credentials, profiles, local tools, or private media enter the commit
- [ ] Commit the approved release source and record its immutable SHA
- [ ] Rebuild all release packages from that same SHA on native runners
- [ ] Pass all CI checks, including the three Chromium regressions
- [ ] Complete Linux/macOS installation and runtime acceptance
- [ ] Inspect signing/notarization status and state it accurately in release text
- [ ] Verify all assets and the combined SHA-256 manifest before publishing

An automated test pass is not a substitute for live WhatsApp service behavior.
No assertion here certifies zero regressions or antivirus clearance.

## 📦 Final local Windows candidate

The prepared files live under `release-assets/v2.6.1/`. Current SHA-256 values:

```text
419ece09b961ae15015ec0798c6f98b2493912eba505d77e3e3dbc2b61b58e6d  WhatsNow_2.6.1_windows_x64-setup.exe
295ffa1aeca38e74477e624db74a79b6a5e85497317b63ef251b885b5ac6899d  WhatsNow_2.6.1_windows_x64_en-US.msi
3be80cfffad897db50994fafb185eea19ad6b1beff23e2ad1e7acd5cbe66dca2  WhatsNow_2.6.1_windows_x64-portable.exe
```

These are unsigned local candidates. Their source manifest records build inputs
and working-tree changes; it does not claim they were built from a clean Git
commit. Preserve this evidence. CI-built/signed replacements will have different
hashes, which must replace these candidate values in published asset manifests.

## 🔧 GitHub Desktop preparation

1. Select the local public WhatsNow checkout in GitHub Desktop. Confirm its
   repository URL is exactly the target above.
2. Fetch origin. If remote `main` moved from the observed SHA, reconcile changes
   without discarding the existing working tree or force-pushing.
3. Create a review branch such as `release/v2.6.1-preparation`, carrying the
   approved local changes. Inspect the complete diff, not just Markdown.
4. Include the version files, reviewed source changes, tests, workflows, and
   documentation required for this release. Exclude `.workspace/`, `dist/`,
   `node_modules/`, backups, session data, credentials, signing files, and local
   screenshots. Release binaries belong in release assets, not a source commit.
5. Suggested commit summary: `Prepare WhatsNow 2.6.1 release candidate`.
6. Suggested description: `Consolidate v2.6.1 implementation history and feature
   documentation; retain no-reload routing, call geometry, Settings contrast,
   and attribution regressions. Keep live and cross-platform acceptance gated.`
7. Publish that branch and open a draft PR into `main`; review CI and the release
   checklist before merging. If source privacy is still desired, stop here:
   ignoring files does not remove already tracked/public source or its history.

Do not silently commit unrelated changes. Do not publish a tag merely to test
the build: the workflow responds to `v*` tag pushes.

## ⚙️ Native builds and draft release

After the approved source is committed and available on GitHub, select
**Actions → Build WhatsNow cross-platform release → Run workflow** on that exact
branch/revision. Set `app_version=2.6.1`, `release_tag=v2.6.1`, and initially
`publish_release=false`. Review the run's recorded commit SHA and all artifacts.
Workflow artifacts have limited retention; download acceptance candidates promptly.

After acceptance, run from the same immutable source with draft creation enabled
or use the approved `v2.6.1` tag. The configured publish job creates a draft,
not a public release. Before enabling it, inspect existing tags/drafts to avoid
overwriting another candidate. Never move an existing published tag to new code.

The expected final package set is:

```text
WhatsNow_2.6.1_windows_x64-setup.exe
WhatsNow_2.6.1_windows_x64_en-US.msi
WhatsNow_2.6.1_windows_x64-portable.exe
WhatsNow_2.6.1_amd64.AppImage
WhatsNow_2.6.1_amd64.deb
WhatsNow_2.6.1_aarch64.dmg
WhatsNow_2.6.1_aarch64.app.tar.gz
WhatsNow_2.6.1_x86_64.dmg
WhatsNow_2.6.1_x86_64.app.tar.gz
checksums.sha256
```

The release workflow uses [RELEASE_NOTES.md](../RELEASE_NOTES.md) as its draft
body. Keep the validation-status section until the relevant checks are truly
completed. Verify all nine package hashes against `checksums.sha256`, confirm
the same source SHA for every job, disclose unsigned/unnotarized packages,
then deliberately publish the draft when ready.

## 🔄 Upgrade and rollback

Fully quit WhatsNow from the tray before a same-version reinstall or portable
replacement. A running process cannot adopt newly built code. Replacing binaries
normally retains local sessions and preferences; it is not a reset or backup.
Never delete per-user data as a routine upgrade step. For rollback, quit normally
and reinstall a previously verified package. Preserve local data separately;
backward compatibility of every future session/settings format is not guaranteed.
