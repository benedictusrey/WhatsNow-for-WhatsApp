# Publish WhatsNow 2.6.1

WhatsNow is authored and maintained by
[@benedictusrey](https://github.com/benedictusrey).
Official repository: [WhatsNow-for-WhatsApp](https://github.com/benedictusrey/WhatsNow-for-WhatsApp).

## Current repository layout

The public repository currently includes application source (`src-tauri/`,
`settings-ui/`), workflows, documentation, and release staging. This was
verified against GitHub on 2026-10-17. The older installation-only description
does not describe the current v2.6.0 repository.

The Desktop `WhatsNow` folder is now the single development and public-repository
checkout. The former `WhatsNow - Improved` tree has been consolidated into it.
See [workspace layout](WORKSPACE_LAYOUT.md) for preserved history and local caches.
Keep backups, session data, private tool directories, credentials, and compiler
caches out of commits. Inspect the changed-file list before publishing.
Ignoring a path does not remove it from existing Git history.

## Verify the candidate

The presentation refresh uses the four supplied images documented in
[artwork notes](assets/README.md). Their illustrative UI and historical process
figures are not additional runtime/performance validation. The current release
instruction is to keep v2.6.1 as a draft until live checks are confirmed.

Use [the release preparation checklist](RELEASE_PREPARATION_2.6.1.md) as the
current acceptance gate. The complete feature catalogue and implementation
record are [WhatsNow_latest.md](../WhatsNow_latest.md) and
[CHANGELOGS_v2.6.1.md](../CHANGELOGS_v2.6.1.md).

Read [the v2.6.1 audit](AUDIT_2.6.1.md). Automated tests do not replace a
logged-in browser handoff or a real two-party call. Complete those checks
before making a public release claim.

Local Windows files are under the development workspace's
`dist/v2.6.1-attribution/windows/`. The public checkout uses `release-assets/v2.6.1/`
as its local upload staging area. Binary files are ignored by Git; attach
them to the Release instead of committing them.

```powershell
.\scripts\verify-windows-release.ps1 -Path .\release-assets\v2.6.1
```

Portable mode does not register `whatsapp://`. Use the installed build for
browser-to-app handoff tests. Neither build sends a prefilled draft itself.

## Commit through GitHub Desktop

1. Open the public `WhatsNow` repository in GitHub Desktop, fetch origin, and
   create a review branch such as `release/v2.6.1-preparation` from `main`.
2. Review **Changes**. Exclude backups, tool metadata, sessions, and caches.
3. Enter this summary:

   ```text
   Prepare WhatsNow 2.6.1 release candidate
   ```

4. Enter this description:

   ```text
   Open unlisted phone targets through native New chat search without reloads.
   Preserve drafts and cancel superseded or escaped link requests.
   Fit call windows to the opener monitor with native resize/maximize controls.
   Preserve theme and notification behavior; add regression and release gates.
   ```

5. Commit to the review branch, publish it, and open a draft PR into `main`.
   Check CI and complete live acceptance before approving/merging the candidate.
6. After approval, in **History**, right-click the verified release commit, choose **Create Tag**,
   and enter `v2.6.1`. Push the tag. Investigate an existing tag rather than
   moving it over a published release.

## Build all platforms

The source `.github/workflows/release.yml` builds Windows x64, Linux x64,
macOS Apple Silicon, and macOS Intel from the tagged commit. Its shared
verification gate checks version/tag agreement and runs JavaScript tests.

A tag push triggers the workflow. Alternatively use **Actions > Build WhatsNow
cross-platform release > Run workflow**, select the verified tagged revision,
and enter `app_version = 2.6.1`, `release_tag = v2.6.1`.

After all jobs pass, the draft release contains:

- `WhatsNow_2.6.1_windows_x64-setup.exe`
- `WhatsNow_2.6.1_windows_x64_en-US.msi`
- `WhatsNow_2.6.1_windows_x64-portable.exe`
- `WhatsNow_2.6.1_amd64.AppImage`
- `WhatsNow_2.6.1_amd64.deb`
- `WhatsNow_2.6.1_aarch64.dmg`
- `WhatsNow_2.6.1_aarch64.app.tar.gz`
- `WhatsNow_2.6.1_x86_64.dmg`
- `WhatsNow_2.6.1_x86_64.app.tar.gz`
- `checksums.sha256`

Use workflow-produced files together for a cross-platform release: they come
from one tagged revision. Local checksums can differ from CI binaries because
toolchains and build environments differ.

## Publish the draft

Open **Releases > Drafts**, edit v2.6.1, and verify its tag, nine packages,
checksum manifest, and [release notes](../RELEASE_NOTES.md). Run installation
checks on supported systems and state signing/notarization status accurately.
Publish after the required checks pass; pending Linux/macOS builds should not
be described as available downloads.

When uploading local Windows files manually, include their matching Windows
checksum file. A CI all-platform checksum file is valid for local artifacts
only when their uploaded bytes match that manifest exactly.
