# Publish WhatsNow 2.0.0 with GitHub Desktop

This folder is the public installation-only repository. It contains user
documentation, installation helpers, artwork, and release staging metadata;
it intentionally does not contain the WhatsNow source or Settings UI
implementation.

## Repository metadata for discovery

Before committing, open the repository page on GitHub and edit the **About**
panel. Use these values:

**Description**

> A Rust + Tauri WhatsApp Web desktop client with multi-account sessions, quiet notifications, themes, App Lock, and focus tools.

**Website**

`https://github.com/benedictusrey/WhatsNow-for-WhatsApp/releases/latest`

**Topics** (use lowercase, hyphenated terms; choose up to 20)

`whatsapp`, `whatsapp-web`, `whatsapp-client`, `desktop-app`, `rust`, `tauri`, `productivity`, `focus-mode`, `multi-account`, `native-notifications`, `app-lock`, `themes`, `webview2`, `windows`, `windows-10`, `linux`, `macos`, `cross-platform`, `privacy`, `low-memory`

These topics improve search and filtering without implying that WhatsNow is an
official WhatsApp product. The `v2.0.0` release tag is separate: it identifies
a published version, while topics classify the repository.

For the README introduction, use the canonical `docs/assets/icon.png`. Keep
`docs/assets/whatsnow-hero-icon.png` for the larger workspace artwork.
If GitHub asks for a social-preview image, upload a compressed 1280×640 (or
640×320) PNG/JPG copy under 1 MB; keep the full-resolution artwork for the
README.

## 1. Review the prepared folder

Open:

`%USERPROFILE%\Desktop\WhatsNow`

Before committing, confirm that the folder contains no `src-tauri`,
`settings-ui`, `.rs`, `Cargo.toml`, application source JavaScript, account
profiles, signing certificates, or private credentials. The public
`.gitignore` also guards against accidentally copying those directories.

Installer binaries are ignored from normal Git history. They remain available
locally for upload to a GitHub Release.

## 2. Update the v2.0.0 distribution

Copy only the v2.0.0 Markdown, installation scripts, artwork, release notes,
and checksum manifests from the private build process. Do not copy the private
source checkout. Build Windows, Linux, and macOS packages from the same private
v2.0.0 source revision, then stage only the finished release assets.

Use `docs/assets/icon.png` for the README logo and retain the larger artwork
files for feature sections. Do not substitute another application icon.

## 3. Add the exact folder to GitHub Desktop

1. Open GitHub Desktop and sign in as `benedictusrey`.
2. Choose **File > Add local repository**.
3. Select this exact `WhatsNow` folder.
4. Do not select the parent `i-w` checkout or the private v2.0.0 source folder.
5. If the repository already has an origin, use **Push origin** after committing;
   do not create a nested repository.

The current remote is:

`https://github.com/benedictusrey/WhatsNow-for-WhatsApp.git`

## 4. Review and commit

In **Changes**, confirm that only public documentation, scripts, artwork, and
release metadata are listed. No Settings or native source files should appear.

Use this commit summary:

`Publish WhatsNow 2.0.0 installation distribution`

Use this optional commit description:

```text
Refresh the public installation-only distribution for WhatsNow 2.0.0.

- Update README, release notes, installation, security, privacy, and platform docs.
- Add WebView2 efficiency guidance and current repository metadata.
- Stage canonical WhatsNow artwork, Windows 2.0.0 installers, and checksums.
- Keep the private Settings UI and application source out of the public repository.
```

The summary is the short, searchable commit title. The description records
what changed and confirms that private implementation files were not published.

Select **Commit to main**, then **Push origin**.

## 5. Create the 2.0.0 release

GitHub Desktop publishes commits; GitHub Releases stores installers:

1. Open the repository on GitHub.
2. Choose **Releases > Draft a new release**.
3. Create or select tag `v2.0.0` targeting `main`.
4. Use title `WhatsNow 2.0.0`.
5. Paste the contents of `RELEASE_NOTES.md`.
6. Upload only packages that were actually built and tested.
7. Upload the matching SHA-256 checksum manifest.
8. Publish after every filename and checksum has been checked.

Do not attach placeholder Linux or macOS files. GitHub Actions builds all
non-Windows packages from the private source repository; the public
repository never contains the application source.

## 6. Build Windows, Linux, and macOS packages in GitHub Actions

The public repository includes `.github/workflows/release.yml`. It checks out
the private source only inside the runner, builds Windows x64 (NSIS + MSI),
Linux x64 (AppImage + .deb), and Apple Silicon macOS (DMG + archive)
packages, verifies their checksums, and uploads workflow artifacts.

Before running it:

1. Add a read-only personal access token for the private source repository as
   the `SOURCE_REPO_TOKEN` Actions secret.
2. Open **Actions > Build WhatsNow 2.0.0 cross-platform release > Run
   workflow**.
3. Enter the private source repository and its v2.0.0 ref. Use
   `versions/WhatsNow-2.0.0-source` for `source_path` when that
   nested layout is retained; use `.` when `src-tauri` is at the source root.
4. Review all three platform jobs. Enable `publish_release` only when you want
   the workflow to create a draft release containing the six verified packages
   and a combined `checksums.sha256`.

The workflow never copies the private source or Settings UI into this public
repository. See [RELEASE_NOTES.md](../RELEASE_NOTES.md) for the exact asset
names and required repository variables.

## 7. Final public check

Use a private browser window to confirm:

- the repository is owned by `benedictusrey`;
- the release tag and displayed app version are `2.0.0`;
- README images and links render;
- Windows assets download and match their checksums;
- no source or Settings UI implementation was committed;
- security reporting and installation links work.
