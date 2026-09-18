# Publish WhatsNow — complete two-repository workflow

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

Copyright (c) 2026 @benedictusrey. Released under the [MIT License](../LICENSE).

This is the master guide for publishing a WhatsNow release. It explains the
full flow — from the private source checkout to the public GitHub Release —
including exactly how to do each step in **GitHub Desktop**. Follow it top to
bottom for v2.5.0 and for every future version.

## 1. The two-repository architecture

WhatsNow is deliberately split across two GitHub repositories so the private
implementation (Settings UI, native bridge, WhatsApp-integration specifics)
is never published:

| | Private source repository | Public installation repository |
| --- | --- | --- |
| GitHub name | `benedictusrey/i-w` | `benedictusrey/WhatsNow-for-WhatsApp` |
| Local folder | the local source workspace (`WhatsNow - Improved`) | the local public folder (`WhatsNow`) |
| Visibility | **Private** (must stay private) | **Public** |
| Contents | `src-tauri/`, `settings-ui/`, `scripts/`, `docs/`, `AGENTS.md`, `backup/`, `versions/` — the full application source and locked pillars | Documentation, install scripts, artwork, `release-assets/` checksums — **installation-only, no source** |
| Purpose | Build the app, run checks, publish binaries to the release | Explain the app, host downloads, verify binaries |

Nothing from the private repository may ever be committed to the public one.
The public repository's `.gitignore` enforces this with `/src-tauri/`,
`/settings-ui/`, and `/dist/` guards, and the release workflow checks out the
private source **only inside the GitHub Actions runner** (never into the
public tree).

### Naming conventions (locked)

- Windows assets are named **`windows`**, never `windows10`:
  `WhatsNow_2.6.0_windows_x64-setup.exe`,
  `WhatsNow_2.6.0_windows_x64-portable.exe`,
  `WhatsNow_2.6.0_windows_x64_en-US.msi`.
- The Windows memory-conscious Cargo feature is `windows-memory` (it is
  universal across Windows 10 and 11; it is not a "Windows 10 only" build).
- Checksum manifests: `checksums-windows.sha256` (Windows build),
  `checksums-linux.sha256` / `checksums-macos.sha256` (per-platform CI),
  `checksums.sha256` (combined release manifest).
- Linux assets: `WhatsNow_2.6.0_amd64.AppImage` / `_amd64.deb`.
- macOS assets: `WhatsNow_2.6.0_aarch64.dmg` / `_aarch64.app.tar.gz`
  (Apple Silicon) and `WhatsNow_2.6.0_x86_64.dmg` / `_x86_64.app.tar.gz`
  (Intel). Packages are per-architecture — never a universal binary.

## 2. What the release workflow does

The repository ships `.github/workflows/release.yml`. It:

1. Checks out the repository and caches Rust dependencies using `rust-cache`.
2. Runs three independent platform jobs in parallel:
   - **Windows x64** (`windows-latest`): NSIS installer, MSI, and portable
     executable with the `windows-memory` and `portable-mode` features.
   - **Linux x64** (`ubuntu-22.04`): AppImage and `.deb` with WebKitGTK and FUSE.
   - **macOS** (`macos-14`): Apple Silicon DMG + `.app.tar.gz`, and Intel
     DMG + `.app.tar.gz`.
3. Verifies every produced package exists, then builds the combined
   `checksums.sha256`.
4. Creates a **draft** GitHub Release tagged `v2.6.0` with all packages and
   the checksum manifest, using `RELEASE_NOTES.md` as the description.

The draft release is created with `publish: false` semantics (draft: true),
so nothing goes public until you review and publish it manually.

## 3. One-time setup (do this once)

### 3.1 Confirm the private source repository exists and is private

1. Open `https://github.com/benedictusrey/i-w` in a browser. If you see a
   404, the repository does not exist yet — create it (section 3.2).
2. Confirm the **Settings > General** page shows the repository as
   **Private**. The whole point of the split is that `i-w` never becomes
   public. If it is public, change it to Private immediately.
3. In GitHub Desktop, confirm the local `WhatsNow - Improved` folder is
   already added: **File > Options > Accounts** shows you signed in as
   `benedictusrey`, and the repository list shows `i-w`.

### 3.2 Create the private repository (only if it does not exist)

1. Open GitHub Desktop.
2. **File > Add local repository…** and select the `WhatsNow - Improved`
   folder. Click **Add repository**.
3. Click **Publish repository** in the top toolbar.
4. In the dialog, name it `i-w`, keep **Keep this code private** checked
   (critical), leave "Initialize this repository with a README" unchecked
   (the workspace already has one), and click **Publish repository**.
5. Wait for "Publish complete". GitHub Desktop now pushes to
   `github.com/benedictusrey/i-w`.

### 3.3 Create a read-only token for the private source

The public repository's Actions need permission to *read* the private `i-w`
repository. Create a fine-grained personal access token:

1. Open `https://github.com/settings/personal-access-tokens/new`.
2. **Token name**: `whatsnow-source-read`.
3. **Expiration**: 90 days (renew when it lapses).
4. **Repository access**: *Only select repositories* → choose `i-w`.
5. **Permissions > Repository permissions**: set **Contents → Read-only**.
   No other permission is needed.
6. Click **Generate token**, copy it immediately (it is shown once).

### 3.4 Add the secret and variables to the public repository

1. Open `https://github.com/benedictusrey/WhatsNow-for-WhatsApp/settings/secrets/actions`.
2. **New repository secret**:
   - Name: `SOURCE_REPO_TOKEN`
   - Value: paste the token from section 3.3.
3. Open `https://github.com/benedictusrey/WhatsNow-for-WhatsApp/settings/variables/actions`.
4. **New repository variable** (each one):
   - `WHATSNOW_SOURCE_REPOSITORY` = `benedictusrey/i-w`
   - `WHATSNOW_SOURCE_REF` = `v2.5.0`
   - `WHATSNOW_SOURCE_PATH` = `.`
   - `WHATSNOW_APP_VERSION` = `2.5.0`

These variables are the defaults the workflow falls back to, so you can run
it with zero inputs. Change `WHATSNOW_SOURCE_REF`/`WHATSNOW_APP_VERSION`
together when bumping to a new version.

### 3.5 (Recommended) Windows code-signing secrets

An identity-validated Authenticode certificate keeps SmartScreen warnings
down. If you have the PFX, add these secrets to the public repository:

- `WINDOWS_CERTIFICATE` — base64-encoded PFX
- `WINDOWS_CERTIFICATE_PASSWORD` — the PFX password
- `WINDOWS_TIMESTAMP_URL` — an RFC 3161 timestamp service URL

When these exist, the workflow signs the Windows artifacts before upload.
Never commit the PFX, its password, or signing configuration.

## 4. Publish a release — step by step (GitHub Desktop)

These steps assume v2.5.0 is the release being published. For a future
version, replace every `2.5.0`/`v2.5.0` with the new version.

### Step 4.1 — Prepare the private source

1. In the `WhatsNow - Improved` workspace, confirm the version is uniform:
   `VERSION` says `2.5.0`, and `src-tauri/Cargo.toml` + `src-tauri/tauri.conf.json`
   both say `2.5.0`.
2. Run the automated checks (all must pass):

   ```bash
   cd src-tauri
   cargo test --lib
   cd ..
   node src-tauri/resources/bridge.test.mjs
   node src-tauri/resources/chat-theme.test.mjs
   node src-tauri/resources/toast-route.test.mjs
   node settings-ui/theme.test.mjs
   node settings-ui/comboToAccelerator.test.mjs
   node settings-ui/settingsAcl.test.mjs
   node scripts/check-docs.mjs
   ```

3. (Optional, Windows) Produce the local Windows packages:

   ```powershell
   .\scripts\build-windows.ps1
   ```

   Output lands in `dist\windows\` as `WhatsNow_2.5.0_windows_x64-setup.exe`
   and `WhatsNow_2.5.0_windows_x64-portable.exe` with
   `checksums-windows.sha256`. Local packages are for your own verification;
   GitHub Actions rebuilds them from the private source for the release.

### Step 4.2 — Commit and push the private source

1. Open GitHub Desktop with the `i-w` repository selected.
2. Review the **Changes** panel. Confirm only intended files are listed —
   no `dist\` binaries (gitignored), no `.workspace\` caches, no
   `backup\` secrets.
3. Write a commit summary, for example
   `Prepare WhatsNow 2.5.0 release` , and a short description listing what
   changed.
4. Click **Commit to main**.
5. Click **Push origin**. GitHub Desktop shows "Pushed to
   github.com/benedictusrey/i-w".

### Step 4.3 — Tag the private source

The workflow needs a stable ref to build. Use a tag:

1. In GitHub Desktop, open the **History** tab.
2. Right-click the commit you just pushed → **Create Tag…**.
3. Enter `v2.5.0` and click **Create Tag**.
4. Click **Push origin** in the toolbar and confirm you want to push the
   new tag as well.
5. Verify on `https://github.com/benedictusrey/i-w/tags` that `v2.5.0`
   exists and points at the correct commit.

If you prefer not to tag, you can pass any commit SHA as the
`source_ref` workflow input instead — a tag is simply the readable,
reproducible default.

### Step 4.4 — Run the release workflow

1. Open `https://github.com/benedictusrey/WhatsNow-for-WhatsApp/actions`.
2. In the left sidebar, click **Build WhatsNow 2.5.0 cross-platform release**.
3. Click **Run workflow** (top right).
4. Leave **Use workflow from**: `Branch: main`.
5. The input fields are pre-filled from the repository variables:
   - `source_repository` → `benedictusrey/i-w`
   - `source_ref` → `v2.5.0`
   - `source_path` → `.`
   - `app_version` → `2.5.0`
   - `release_tag` → `v2.5.0`
   - `publish_release` → check this only when you are ready for the draft
     release to be created (keep it unchecked for a test run).
6. Click **Run workflow**.

Alternatively, pushing a `v2.5.0` tag to the **public** repository triggers
the workflow automatically (`on.push.tags`). Use the manual button when you
want to run it without creating a public tag.

### Step 4.5 — Watch the three platform jobs

The run page shows three jobs running in parallel:

- `build-linux` (ubuntu-24.04) — AppImage + `.deb`
- `build-windows` (windows-latest) — NSIS + MSI + portable
- `build-macos` (macos-14) — Apple Silicon + Intel DMG/archive

Each job checks out the private source inside the runner, compiles with
Tauri, normalizes the artifacts, writes its platform checksum file, and
uploads workflow artifacts. Watch the logs for the four locked pillars'
markers (the `bridge.js` doodle kill-switch, `compose-box` handling,
`settings_version_bootstrap`, and the compact-toast XML) so you know the
binaries are the verified 2.5.0 build. A first run takes roughly 10–20
minutes per platform (Rust + Tauri compile).

### Step 4.6 — Review and publish the draft release

After all three jobs succeed, the `publish` job:

1. downloads every artifact into one `dist` folder;
2. verifies all six packages exist;
3. writes and self-verifies `checksums.sha256`;
4. creates the **draft** release `v2.5.0` on the public repository with the
   packages and `RELEASE_NOTES.md` as the body.

To finish:

1. Open `https://github.com/benedictusrey/WhatsNow-for-WhatsApp/releases`.
2. Click **Draft** next to `v2.5.0`.
3. Download one or two assets and confirm:
   - the SHA-256 digest matches `checksums.sha256` on the release;
   - the Windows installer shows the expected publisher signature;
   - the filename, version, and architecture are correct.
4. When satisfied, click **Publish release**.

### Step 4.7 — Update the public documentation

1. In the the local public folder (`WhatsNow`) folder, refresh the files that describe the
   release:
   - `RELEASE_NOTES.md` — what's new in this version (asset table updated);
   - `CHANGELOG.md` — the new version entry;
   - `README.md` — download table, version badges, feature copy;
   - `docs/INSTALLATION.md`, `docs/SECURITY_AND_VERIFICATION.md`,
     `docs/WINDOWS.md`, `docs/PLATFORM_SUPPORT.md` — filenames, checksum
     names, and platform rows;
   - `release-assets/v2.5.0/checksums-windows.sha256` (and the combined
     `checksums.sha256` from the workflow run).
2. Open GitHub Desktop with the `WhatsNow-for-WhatsApp` repository.
3. Review the **Changes** panel — documentation, scripts, artwork, and
   checksums only. No `.rs`, no `Cargo.toml`, no `settings-ui`.
4. Commit with the summary `Publish WhatsNow 2.5.0 installation distribution`
   and click **Push origin**.

### Step 4.8 — Mirror the public snapshot

After pushing, refresh the private workspace's snapshot so it always
matches the live public repository:

```bash
robocopy ""%USERPROFILE%\Desktop\WhatsNow" ^
  ""%USERPROFILE%\Desktop\WhatsNow - Improved\versions\WhatsNow-public-repository" ^
  /MIR /XD .git
```

Then verify byte-identity (the only difference must be the `.git` folder):

```bash
diff -rq ""%USERPROFILE%\Desktop\WhatsNow - Improved\versions\WhatsNow-public-repository" ^
  "%USERPROFILE%\Desktop\WhatsNow" | grep -v ".git"
```

Commit the refreshed snapshot in `i-w` with GitHub Desktop so the private
repo archives the exact public state of the release.

## 5. Post-release verification

From a clean browser session, confirm:

- the release page lists `WhatsNow 2.5.0` with all six packages and
  `checksums.sha256`;
- each Windows asset's hash matches `checksums-windows.sha256`;
- `Settings > About` in the installed app reads **WhatsNow 2.5.0**;
- the four locked pillars still hold on the installed build — personality
  themes show no doodles (including the Reply bar), typed emojis render in
  every theme, toasts are compact, and clicking a toast opens the sender's
  chat;
- the public repository contains no `src-tauri/`, `settings-ui/`, or
  `dist/` folders (run `git ls-files | grep -E 'src-tauri|settings-ui|dist'`
  from the local public folder (`WhatsNow`) — it must print nothing);
- README badges and the latest-release link resolve.

## 6. GitHub Desktop quick reference

| Action | Where in GitHub Desktop |
| --- | --- |
| Add a local folder as a repository | **File > Add local repository…** |
| Publish a new (private) repository | **Publish repository** button, check *Keep this code private* |
| Switch repositories | **Current repository** dropdown (top-left) |
| Review changes | **Changes** panel (left) |
| Commit | Summary + description, **Commit to main** |
| Push | **Push origin** button |
| Create a tag | **History** tab → right-click commit → **Create Tag…** |
| Pull latest | **Fetch origin** / **Pull origin** |
| Open the repo on GitHub | **Repository > View on GitHub** (or `Ctrl+Shift+G`) |
| Open Actions / Releases / Settings | Use the *View on GitHub* menu — these pages live on github.com |

GitHub Desktop does not manage Actions secrets or repository variables;
those are configured on the github.com pages listed in section 3.4.

## 7. Bumping to a future version (e.g. 2.6.0)

1. In the private workspace: update `VERSION`, `src-tauri/Cargo.toml`,
   `src-tauri/tauri.conf.json`, `CHANGELOG.md`, `RELEASE_NOTES.md`, and the
   Settings About cache-busters.
2. Follow steps 4.2–4.8, replacing the version everywhere.
3. On the public repo, update `WHATSNOW_SOURCE_REF` and
   `WHATSNOW_APP_VERSION` variables to the new version before running the
   workflow (or pass them as inputs).

## 8. Troubleshooting

- **Workflow fails at "Validate private source configuration"** — the
  `SOURCE_REPO_TOKEN` secret is missing or expired. Regenerate (section 3.3)
  and update the secret (section 3.4).
- **Checkout of `i-w` fails with 404** — the token lacks Contents read
  access, or the repo name in `WHATSNOW_SOURCE_REPOSITORY` is wrong.
- **A platform job produces no package** — Tauri naming or a feature flag
  changed. Compare the build log with the normalize step expectations
  (`*_amd64.AppImage`, `*_x64-setup.exe`, `*_aarch64.dmg`, …).
- **The draft release is missing `checksums.sha256`** — the publish job
  failed the combined-manifest verification; no package should be
  published from a run that cannot verify itself.
- **The release builds an old binary** — `SOURCE_REF` still points at an
  old tag. Point it at `v2.5.0` (or the new tag) and rerun.
- **`cargo check --features windows-memory` fails after the feature was
  renamed** — run `cargo clean -p tauri` once; cached tauri-build output
  from the old directory name can hold stale absolute paths.
