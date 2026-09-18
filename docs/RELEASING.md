# Release WhatsNow

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

Copyright (c) 2026 @benedictusrey. Released under the
[MIT License](../LICENSE).

This checklist covers a **v2.5.0** release. The end-to-end publish flow,
including every GitHub Desktop step, lives in
[Publishing](PUBLISHING.md). This page is the pre-tag quality gate.

## Confirm identity and version

- `VERSION`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` all
  contain `2.5.0`.
- The product name is `WhatsNow`.
- The application identifier is `app.whatsnow.desktop`.
- Windows metadata identifies `benedictusrey` as publisher.
- [AUTHORS.md](../AUTHORS.md), [CHANGELOG.md](../CHANGELOG.md), and
  [RELEASE_NOTES.md](../RELEASE_NOTES.md) match the tag.
- Repository URLs point at `benedictusrey/WhatsNow-for-WhatsApp` (public)
  and `benedictusrey/i-w` (private source).
- Windows assets use the universal naming — `windows`, never `windows10`:
  `WhatsNow_2.5.0_windows_x64-setup.exe`,
  `WhatsNow_2.5.0_windows_x64-portable.exe`,
  `WhatsNow_2.5.0_windows_x64_en-US.msi`.

## Run automated checks

```bash
node scripts/check-docs.mjs
node settings-ui/settingsAcl.test.mjs
node settings-ui/theme.test.mjs
node settings-ui/comboToAccelerator.test.mjs
node src-tauri/resources/bridge.test.mjs
node src-tauri/resources/chat-theme.test.mjs
node src-tauri/resources/toast-route.test.mjs

cd src-tauri
cargo fmt --all -- --check
cargo test --lib
cargo clippy --locked --all-targets -- -D warnings
```

Run the Windows feature checks on Windows:

```powershell
cargo check --features windows-memory
cargo test --features portable-mode
```

## Verify the four locked pillars

1. **Themes/doodles** — official Dark and Light keep WhatsApp's doodle
   wallpaper; every personality theme (midnight through aurora) stays clean
   on all surfaces, including the Reply/quote bar. The mask-layer kill-switch
   (`bridge.js` `whatsnow-no-wallpaper-doodles`) must zero
   `mask-image`/`-webkit-mask-image` on `[data-testid*='conversation-background']`
   and the tint it shapes, and cover both `compose-box` and the legacy
   composer testid.
2. **Typing-area emoji** — typed emojis render in every theme; the
   kill-switch bypass keeps its `:not([style*='/emoji/'])` /
   `:not([class*='emoji'])` exclusions.
3. **Compact float notifications** — every toast uses the small icon next to
   the "WhatsNow" name; the toast XML contains no
   `<image placement="appLogoOverride">`.
4. **Click-to-chat routing** — clicking a toast or a notification-center
   entry opens the sender's chat; the routing command is ACL-registered in
   `build.rs` and the remote capability.

Also confirm `Settings > About` renders **WhatsNow 2.5.0** (injected from
the compiled package version, not hardcoded).

## Platform checks

On Windows: every Settings panel saves, each personality theme restyles only
the conversation wallpaper, the notification test produces a native banner,
unread badges update the tray/taskbar, App Lock engages on lock-on-hide,
downloads stay available, external links open in the browser, and the file
drop reaches WhatsApp's confirmation composer.

On macOS 14+: multi-account isolation and installation of the DMG/archive.
On Linux: AppImage and `.deb` against WebKitGTK 2.46.1+.

## Sign Windows artifacts

Use the identity-validated Authenticode certificate from
[SECURITY.md](../SECURITY.md). Do not publish an unsigned tagged Windows
release.

```powershell
.\scripts\verify-windows-release.ps1 `
  -Path .\src-tauri\src-tauri\target\release\bundle `
  -RequireTrustedSignature
```

The release workflow signs the main executable, NSIS/MSI packages, and the
separate `portable-mode` executable, and the portable pipeline must copy the
signed no-bundle executable without editing its bytes.

## Build local Windows packages (optional but recommended)

```powershell
.\scripts\build-windows.ps1
```

Produces `dist\windows\WhatsNow_2.5.0_windows_x64-setup.exe` and
`WhatsNow_2.5.0_windows_x64-portable.exe` with
`dist\windows\checksums-windows.sha256`. These are for local verification;
GitHub Actions rebuilds everything from the private source.

## Tag

Create the `v2.5.0` tag on the private source repository (`i-w`) — see
[Publishing](PUBLISHING.md) step 4.3 for the GitHub Desktop way — then run
the release workflow in the public repository (`WhatsNow-for-WhatsApp`)
with `publish_release` enabled.

## Verify the GitHub release

Download each asset from GitHub, then:

- compare its SHA-256 digest with the release `checksums.sha256`;
- verify Windows and macOS signatures;
- confirm package names use the universal platform naming (`windows`,
  `linux`-implied, `macos`-implied) and the version is `2.5.0`;
- install, launch, save Settings, send a test notification, and uninstall on
  each platform;
- test the portable executable from a clean folder;
- check README badges and latest-release links.

Copy the matching text from [RELEASE_NOTES.md](../RELEASE_NOTES.md) into the
GitHub release description (the workflow does this automatically via
`body_path`, but re-check the published draft).

Submit a reproducible antivirus false positive through the vendor's official
review process. Do not weaken endpoint protection as a release workaround.
