# Publish WhatsNow 2.5.0 — the complete GitHub Desktop guide

This is the definitive, step-by-step guide for publishing WhatsNow to
`https://github.com/benedictusrey/WhatsNow-for-WhatsApp` using **GitHub
Desktop**. Every name — repositories, branches, tags, assets, secrets,
variables, and commit messages — is spelled out exactly. Follow it top to
bottom.

## 0. Complete naming reference

| Thing | Exact name / value |
| --- | --- |
| Public repository (installation-only) | `benedictusrey/WhatsNow-for-WhatsApp` |
| Public local folder | `%USERPROFILE%\Desktop\WhatsNow` |
| Public default branch | `main` |
| Public remote URL | `https://github.com/benedictusrey/WhatsNow-for-WhatsApp.git` |
| Private source repository | `benedictusrey/i-w` |
| Private local folder | `%USERPROFILE%\Desktop\WhatsNow - Improved` |
| Release tag (private + public) | `v2.5.0` |
| App version | `2.5.0` |
| Actions secret | `SOURCE_REPO_TOKEN` |
| Repository variables | `WHATSNOW_SOURCE_REPOSITORY` = `benedictusrey/i-w` · `WHATSNOW_SOURCE_REF` = `v2.5.0` · `WHATSNOW_SOURCE_PATH` = `.` · `WHATSNOW_APP_VERSION` = `2.5.0` |
| Windows assets | `WhatsNow_2.5.0_windows_x64-setup.exe` · `WhatsNow_2.5.0_windows_x64_en-US.msi` · `WhatsNow_2.5.0_windows_x64-portable.exe` |
| Linux assets | `WhatsNow_2.5.0_amd64.AppImage` · `WhatsNow_2.5.0_amd64.deb` |
| macOS assets | `WhatsNow_2.5.0_aarch64.dmg` · `WhatsNow_2.5.0_aarch64.app.tar.gz` · `WhatsNow_2.5.0_x86_64.dmg` · `WhatsNow_2.5.0_x86_64.app.tar.gz` |
| Checksum manifests | `checksums-windows.sha256` (Windows) · `checksums-linux.sha256` · `checksums-macos.sha256` · `checksums.sha256` (combined release) |
| Windows Cargo feature | `windows-memory` (universal — never `windows10`) |
| Commit 1 (private) | `Prepare WhatsNow 2.5.0 release` |
| Commit 2 (public) | `Publish WhatsNow 2.5.0 installation distribution` |

## 1. How the two repositories work

- **Private `benedictusrey/i-w`** holds the full application source: `src-tauri`,
  `settings-ui`, `scripts`, `docs`, `AGENTS.md`, `backup`, `versions`. It must
  stay **Private** — the Settings UI and native WhatsApp-integration code
  never go public.
- **Public `benedictusrey/WhatsNow-for-WhatsApp`** is installation-only:
  README, docs, install scripts, artwork, and release-assets checksums. No
  source, no Settings UI.
- The public repository's `.github/workflows/release.yml` checks out the
  **private** source *inside the GitHub Actions runner only*, builds Windows,
  Linux, and macOS packages on their native runners, verifies them, and
  creates a **draft** GitHub Release. It refuses to run if the source
  repository is not private.

## 2. One-time setup (first publish only)

1. **Confirm the private repo exists and is private** — open
   `https://github.com/benedictusrey/i-w`; the Settings page must show
   **Private**. If it does not exist: GitHub Desktop→ **File > Add local repository…** → select `%USERPROFILE%\Desktop\WhatsNow - Improved` →
   **Add repository** → **Publish repository** → name `i-w` → check
   **Keep this code private** → **Publish repository**.
2. **Create the read-only token** — open
   `https://github.com/settings/personal-access-tokens/new`:
   - Token name: `whatsnow-source-read`
   - Expiration: 90 days
   - Repository access: **Only select repositories** → `i-w`
   - Repository permissions → **Contents: Read-only**
   - Generate, then copy the token (shown only once).
3. **Add the secret to the public repo** — open
   `https://github.com/benedictusrey/WhatsNow-for-WhatsApp/settings/secrets/actions`
   → **New repository secret**:
   - Name: `SOURCE_REPO_TOKEN`
   - Value: the token from step 2.
4. **Add the variables** — open
   `https://github.com/benedictusrey/WhatsNow-for-WhatsApp/settings/variables/actions`
   → **New repository variable** ×4:
   - `WHATSNOW_SOURCE_REPOSITORY` = `benedictusrey/i-w`
   - `WHATSNOW_SOURCE_REF` = `v2.5.0`
   - `WHATSNOW_SOURCE_PATH` = `.`
   - `WHATSNOW_APP_VERSION` = `2.5.0`
5. **(Recommended) Windows signing** — add secrets `WINDOWS_CERTIFICATE`
   (base64 PFX), `WINDOWS_CERTIFICATE_PASSWORD`, `WINDOWS_TIMESTAMP_URL` so
   the workflow signs the Windows packages. Never commit the certificate.

## 3. Step 1 — Private source: verify, check, commit

1. Open GitHub Desktop and select the **`i-w`** repository (top-left dropdown).
2. Verify the version is uniform: `VERSION`, `src-tauri/Cargo.toml`, and
   `src-tauri/tauri.conf.json` all read `2.5.0`.
3. Run the checks (all must pass):

   ```bash
   node scripts/check-docs.mjs
   node settings-ui/settingsAcl.test.mjs
   node settings-ui/theme.test.mjs
   node settings-ui/comboToAccelerator.test.mjs
   node src-tauri/resources/bridge.test.mjs
   node src-tauri/resources/chat-theme.test.mjs
   node src-tauri/resources/toast-route.test.mjs
   cd src-tauri
   cargo test --lib
   ```

4. Review the **Changes** panel. Confirm no `dist\`, `.workspace\`, backup
   secrets, or credentials are staged (they are gitignored).
5. Commit with the **exact** summary and description:

   - Summary: `Prepare WhatsNow 2.5.0 release`
   - Description:

   ```text
   Prepare the private source for the v2.5.0 release.

   - Universal `windows` asset naming (windows-memory feature, windows_x64
     assets, checksums-windows.sha256, build-windows.ps1, docs/WINDOWS.md).
   - MSI bundle added to the local Windows build (nsis,msi bundles).
   - Locked pillars intact: themes/doodles (Reply-bar mask fix), typing-area
     emoji, compact toasts, click-to-chat routing, runtime About version.
   - Publish workflow docs (docs/PUBLISHING.md, docs/RELEASING.md).
   ```

6. Click **Commit to main**, then **Push origin**. GitHub Desktop shows
   "Pushed to github.com/benedictusrey/i-w".

## 4. Step 2 — Tag the private source

1. In GitHub Desktop (`i-w`), open the **History** tab.
2. Right-click the commit you just pushed → **Create Tag…**.
3. Tag name: `v2.5.0` → **Create Tag**.
4. Click **Push origin** in the toolbar and confirm you want to push the new
   tag as well.
5. Verify at `https://github.com/benedictusrey/i-w/tags` that `v2.5.0` points
   at the correct commit.

## 5. Step 3 — Public repo: review and commit

1. Open GitHub Desktop and select the **`WhatsNow-for-WhatsApp`** repository.
2. Review the **Changes** panel — only documentation, scripts, artwork,
   checksums, and the workflow. No `.rs`, no `Cargo.toml`, no `settings-ui`.
3. Commit with the **exact** summary and description:

   - Summary: `Publish WhatsNow 2.5.0 installation distribution`
   - Description:

   ```text
   Refresh the public installation-only distribution for WhatsNow 2.5.0.

   - Update README (X-Now-style presentation; icon top, hero/features/resource
     images in the body), release notes, changelog, installation, security,
     privacy, and platform docs.
   - Standardize Windows assets to the universal `windows` naming
     (WhatsNow_2.5.0_windows_x64-*; checksums-windows.sha256).
   - Stage Windows 2.5.0 installers (NSIS, MSI, portable) and checksums.
   - Document the four locked pillars and the two-repo publish workflow.
   - Keep the private Settings UI and application source out of the public
     repository.
   ```

4. Click **Commit to main**, then **Push origin**.

## 6. Step 4 — Run the cross-platform release workflow

1. Open `https://github.com/benedictusrey/WhatsNow-for-WhatsApp/actions`.
2. Left sidebar → **Build WhatsNow cross-platform release** → **Run workflow**.
3. **Use workflow from**: `Branch: main`.
4. Inputs (pre-filled from the variables — confirm each):
   - `source_repository` = `benedictusrey/i-w`
   - `source_ref` = `v2.5.0`
   - `source_path` = `.`
   - `app_version` = `2.5.0`
   - `release_tag` = `v2.5.0`
   - `publish_release` = tick it when you want the draft release created
     (leave unticked for a test run).
5. Click **Run workflow**.

The run shows four jobs: `build-linux` (AppImage + .deb), `build-macos`
(Apple Silicon + Intel DMG/archive), `build-windows` (NSIS + MSI + portable),
then `publish`. First runs take roughly 10–20 minutes per platform (Rust +
Tauri compile). Pushing a `v2.5.0` tag to the public repo triggers the
workflow automatically instead of the manual button.

## 7. Step 5 — Review and publish the draft release

1. Open `https://github.com/benedictusrey/WhatsNow-for-WhatsApp/releases`.
2. Click **Draft** next to `v2.5.0`.
3. Confirm all nine assets are attached: the 3 Windows files, 2 Linux files,
   4 macOS files, plus `checksums.sha256`. The description is filled from
   `RELEASE_NOTES.md`.
4. Verify one or two downloads locally:

   ```powershell
   Get-FileHash .\WhatsNow_2.5.0_windows_x64-setup.exe -Algorithm SHA256
   ```

   and compare with `checksums-windows.sha256` / `checksums.sha256`.
5. When satisfied, click **Publish release**.

## 8. Step 6 — Mirror the public snapshot into the private workspace

1. Open a terminal in `%USERPROFILE%\Desktop\WhatsNow - Improved` and run:

```bash
robocopy "%USERPROFILE%\Desktop\WhatsNow" ^
  "%USERPROFILE%\Desktop\WhatsNow - Improved\versions\WhatsNow-public-repository" ^
  /MIR /XD .git
```

2. In GitHub Desktop (`i-w`), commit the refreshed snapshot
   (`Sync public repository snapshot`), and push.

## 9. Post-release verification

- The release page lists `WhatsNow 2.5.0` with all nine packages and
  `checksums.sha256`.
- Windows hashes match `checksums-windows.sha256`.
- The installed app's **Settings > About** reads `WhatsNow 2.5.0`.
- The four locked pillars hold on the installed build (no doodles on
  personality themes incl. Reply, emojis render everywhere, compact toasts,
  toast click opens the sender's chat).
- The public repo contains no `src-tauri/`, `settings-ui/`, or `dist/` —
  run `git ls-files | grep -E 'src-tauri|settings-ui|dist'` and confirm
  nothing prints.

## 10. GitHub Desktop quick reference

| Action | Where in GitHub Desktop |
| --- | --- |
| Add a local folder as a repository | **File > Add local repository…** |
| Publish a new private repository | **Publish repository** → check *Keep this code private* |
| Switch repositories | **Current repository** dropdown (top-left) |
| Review changes | **Changes** panel |
| Commit | Summary + description → **Commit to main** |
| Push | **Push origin** button |
| Create a tag | **History** tab → right-click commit → **Create Tag…** |
| Open the repo on GitHub | **Repository > View on GitHub** (`Ctrl+Shift+G`) |
| Actions / Releases / Settings pages | Use *View on GitHub* — these live on github.com |

## 11. Bumping to a future version

Replace every `2.5.0` / `v2.5.0` above with the new version, update the four
repository variables (`WHATSNOW_SOURCE_REF`, `WHATSNOW_APP_VERSION`, and the
workflow input defaults), and repeat steps 1–6. The tag trigger (`v*`) and the
workflow logic require no changes.

## Troubleshooting

- **Workflow fails at "Validate private source configuration"** — the
  `SOURCE_REPO_TOKEN` secret is missing or expired; regenerate the token and
  update the secret.
- **Checkout of `i-w` returns 404** — the token lacks Contents read access,
  or `WHATSNOW_SOURCE_REPOSITORY` is misspelled.
- **A platform job produces no package** — Tauri naming or a feature flag
  changed; compare the build log with the normalize-step expectations.
- **The draft release is missing `checksums.sha256`** — the publish job
  failed self-verification; do not publish from such a run.
- **The release contains an old version** — `source_ref` /
  `WHATSNOW_SOURCE_REF` points at an old tag; point it at `v2.5.0` and rerun.
