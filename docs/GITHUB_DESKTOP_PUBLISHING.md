# Publish WhatsNow with GitHub Desktop

This guide publishes the documentation repository without publishing the
application source or placing installer binaries in Git history.

## 1. Review the prepared folder

Open:

`C:\Users\Benedictus\Desktop\WhatsNow - Repository`

The folder should contain Markdown documents, images, installer helpers, and
`release-assets\windows`. The `.gitignore` intentionally hides `.exe` and `.msi`
files from commits. They remain available locally for upload to a GitHub
Release.

Before continuing, confirm there is no `src-tauri`, `settings-ui`, `.rs`,
`Cargo.toml`, application JavaScript, or private credential file.

## 2. Add the exact folder to GitHub Desktop

1. Open GitHub Desktop and sign in as `benedictusrey`.
2. Choose **File > Add local repository**.
3. Select the exact folder above.
4. If GitHub Desktop says it is not yet a Git repository, choose the offered
   **create a repository** action for that exact folder.
5. Do not create a second `WhatsNow` folder inside it.

This avoids the common mistake of publishing an empty nested repository.

## 3. Review the first commit

In **Changes**, verify the real documentation and images are listed. Installer
`.exe` and `.msi` files should not be listed because release assets do not belong
in normal Git history.

Confirm these three README images are present:

- `docs\assets\whatsnow-hero.png`
- `docs\assets\whatsnow-features.png`
- `docs\assets\whatsnow-resource-snapshot.png`

Use this summary:

`Prepare WhatsNow 1.0.0 distribution repository`

Click **Commit to main**.

## 4. Publish the repository

1. Click **Publish repository**.
2. Set the GitHub name to `WhatsNow`.
3. Set the owner to `benedictusrey`.
4. Add: `A productivity-focused desktop client for WhatsApp Web`.
5. Clear **Keep this code private** only when the documents are ready to be
   public.
6. Click **Publish repository**.

Open the repository on GitHub and verify that README images and links render.

## 5. Create release 1.0.0

GitHub Desktop publishes commits, but GitHub Releases and binary uploads are
completed in the browser:

1. On GitHub, open **Releases > Draft a new release**.
2. Create tag `v1.0.0` targeting `main`.
3. Use title `WhatsNow 1.0.0`.
4. Paste the contents of `RELEASE_NOTES.md`.
5. Drag these files from `release-assets\windows` into the release:
   - `WhatsNow.exe`
   - `WhatsNow_1.0.0_x64-setup.exe`
   - `WhatsNow_1.0.0_x64_en-US.msi`
   - `checksums.sha256`
6. Mark it as the latest release.
7. Publish only after the upload finishes and each filename is correct.

Do not attach placeholder Linux or macOS files. Add those packages to a later
draft only after native building, signing where applicable, and platform tests.

## 6. Final public check

Use a private/incognito browser window to confirm:

- the repository is owned by `benedictusrey`;
- the release tag and displayed app version are `1.0.0`;
- all Windows assets download;
- SHA-256 values match;
- no source or Settings UI implementation was committed;
- security reporting and installation links work.
