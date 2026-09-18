# Publish WhatsNow 2.6.0 — The Complete GitHub Desktop Guide

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

This is the definitive, step-by-step guide for publishing the full, open-source
release of **WhatsNow v2.6.0** to
[`https://github.com/benedictusrey/WhatsNow-for-WhatsApp`](https://github.com/benedictusrey/WhatsNow-for-WhatsApp)
using **GitHub Desktop**.

---

## 0. Quick Metadata Reference

Use these exact strings when updating your GitHub repository settings:

| Field | Recommended Value |
| :--- | :--- |
| **Repository Name** | `WhatsNow-for-WhatsApp` |
| **Description** | `A calm, lightweight, multi-account desktop client for WhatsApp Web built with Tauri v2 and Rust. Native calling, app lock, quiet notifications, themes, and seamless link routing.` |
| **Website URL** | `https://github.com/benedictusrey/WhatsNow-for-WhatsApp` |
| **Topics / Tags** | `tauri`, `tauri-v2`, `rust`, `whatsapp`, `whatsapp-web`, `desktop-app`, `multi-account`, `privacy`, `productivity`, `cross-platform`, `windows`, `macos`, `linux` |
| **Release Tag** | `v2.6.0` |
| **Release Title** | `WhatsNow 2.6.0 — Full Desktop Experience` |
| **Local Folder** | `WhatsNow` (on your Desktop) |
| **Default Branch** | `main` |

---

## 1. Setting Up the Repository Details on GitHub

Before pushing your commit, configure the repository description and tags on
GitHub:

1. Open your browser and navigate to
   [https://github.com/benedictusrey/WhatsNow-for-WhatsApp](https://github.com/benedictusrey/WhatsNow-for-WhatsApp).
2. Look at the right sidebar under the **About** section and click the gear icon
   (⚙️) next to "About".
3. **Description:** Paste:
   ```text
   A calm, lightweight, multi-account desktop client for WhatsApp Web built with Tauri v2 and Rust. Native calling, app lock, quiet notifications, themes, and seamless link routing.
   ```
4. **Website:** Paste:
   ```text
   https://github.com/benedictusrey/WhatsNow-for-WhatsApp
   ```
5. **Topics:** Add the following tags for discovery:
   `tauri`, `tauri-v2`, `rust`, `whatsapp`, `whatsapp-web`, `desktop-app`,
   `multi-account`, `privacy`, `productivity`, `cross-platform`, `windows`,
   `macos`, `linux`.
6. Ensure **Releases**, **Packages**, and **Environments** checkboxes are checked
   as desired.
7. Click **Save changes**.

---

## 2. Publishing via GitHub Desktop (Step-by-Step)

### Step 1: Open the Repository in GitHub Desktop

1. Open **GitHub Desktop**.
2. Click the **Current Repository** dropdown at the top-left corner.
3. Select **WhatsNow-for-WhatsApp**.
   *(If not listed, click **File > Add local repository...**, browse to your
   `Desktop\WhatsNow` folder, and click **Add repository**.)*
4. Ensure the **Current Branch** shows `main`.

### Step 2: Review Staged Changes

1. In the left-hand **Changes** panel, you will see all new application source
   files:
   - `src-tauri/` (Rust core, Tauri v2 configurations, icons, and capabilities)
   - `settings-ui/` (Modern frameless settings interface)
   - `scripts/` (Automated build and test harnesses)
   - `docs/` (Platform guides and assets)
   - `.github/workflows/` (The new zero-error cross-platform `release.yml` and `check.yml`)
   - `README.md`, `RELEASE_NOTES.md`, `CONTRIBUTING.md`, etc.
2. Confirm that private archives (`backup/`, `.freebuff/`) are **not** present in
   the changes list (they are safely gitignored).

### Step 3: Commit the Full v2.6.0 Release

In the bottom-left commit box of GitHub Desktop, enter:

- **Summary (Title):**
  ```text
  Release WhatsNow 2.6.0: full open-source desktop client
  ```
- **Description (Body):**
  ```text
  Publish the full WhatsNow 2.6.0 release codebase:

  - Complete application source: Rust backend, Tauri v2 shell, and Settings UI.
  - Native always-on-top WhatsApp Calling windows with WebRTC session sharing.
  - Restored official Dark doodle wallpapers alongside the 8 personality themes.
  - Full WhatsApp-family link routing (wa.me, chat.*, call.*, api.*) with in-place chat opening.
  - Pre-created content popup architecture preventing WebView2 message-pump deadlocks.
  - Resolution clamping ensuring safe window geometry across small displays and high-DPI scaling.
  - Windows whatsapp:// deep-link scheme integration.
  - Video playback memory-target audio protection.
  - Optimized cross-platform GitHub Actions release workflow with native caching.
  - Comprehensive contributing guidelines and pull request template.
  ```

Click the blue **Commit to main** button.

### Step 4: Push to GitHub

1. Click the **Push origin** button in the top toolbar.
2. Wait for GitHub Desktop to complete uploading the files.
3. Once finished, the button will display "Fetch origin" with no local changes.

### Step 5: Tag the Release (`v2.6.0`) in GitHub Desktop

1. In GitHub Desktop, switch from the **Changes** tab to the **History** tab.
2. The top commit in the list will be your newly pushed commit:
   `Release WhatsNow 2.6.0: full open-source desktop client`.
3. Right-click this commit and select **Create Tag...**.
4. In the dialog box, type the tag name:
   ```text
   v2.6.0
   ```
5. Click **Create Tag**.
6. A notification banner will appear in GitHub Desktop indicating "Push 1 tag to
   origin". Click **Push origin** to push the tag to GitHub.

---

## 3. Automated Cross-Platform Release Pipeline

Once tag `v2.6.0` is pushed, GitHub Actions automatically starts the
cross-platform build workflow:

1. Open your repository on GitHub:
   [https://github.com/benedictusrey/WhatsNow-for-WhatsApp/actions](https://github.com/benedictusrey/WhatsNow-for-WhatsApp/actions).
2. You will see the **Build WhatsNow cross-platform release** workflow running
   under your `v2.6.0` tag.
3. The workflow builds all assets in parallel:
   - **Linux x64 (`ubuntu-22.04`):** Compiles AppImage and `.deb` packages.
   - **macOS (`macos-14`):** Compiles Apple Silicon (`aarch64`) and Intel (`x86_64`) DMGs and `.app.tar.gz` bundles.
   - **Windows x64 (`windows-latest`):** Compiles NSIS Setup `.exe`, `.msi` installer, and standalone `-portable.exe`.
   - **Publish:** Downloads all 9 platform packages, verifies `checksums.sha256`, and creates a Draft GitHub Release.

Thanks to `@tauri-apps/cli` pre-compiled binaries and `rust-cache`, the entire
build completes in ~5–7 minutes without burning excessive Action minutes!

---

## 4. Publishing the Draft Release on GitHub

1. Navigate to
   [https://github.com/benedictusrey/WhatsNow-for-WhatsApp/releases](https://github.com/benedictusrey/WhatsNow-for-WhatsApp/releases).
2. Click **Edit** next to the newly created `v2.6.0` Draft Release.
3. **Release title:** Ensure it reads:
   ```text
   WhatsNow 2.6.0 — Full Desktop Experience
   ```
4. **Description:** The body will be pre-populated from `RELEASE_NOTES.md`. You
   can review the feature highlights and changelog.
5. Confirm that all 10 assets are attached:
   - `WhatsNow_2.6.0_windows_x64-setup.exe`
   - `WhatsNow_2.6.0_windows_x64_en-US.msi`
   - `WhatsNow_2.6.0_windows_x64-portable.exe`
   - `WhatsNow_2.6.0_amd64.AppImage`
   - `WhatsNow_2.6.0_amd64.deb`
   - `WhatsNow_2.6.0_aarch64.dmg`
   - `WhatsNow_2.6.0_aarch64.app.tar.gz`
   - `WhatsNow_2.6.0_x86_64.dmg`
   - `WhatsNow_2.6.0_x86_64.app.tar.gz`
   - `checksums.sha256`
6. Click the green **Publish release** button! 🎉

---

## 5. Post-Release Verification

After publishing:
- Check that the badge on `README.md` shows the live `v2.6.0` release.
- Test downloading one of the installers to ensure SHA-256 matches the manifest.
- Welcome new contributors by pointing them to `CONTRIBUTING.md`!
