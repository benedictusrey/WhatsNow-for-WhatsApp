# WhatsNow v2.7.0 — record of revisions

_2026-11-15 · Created and maintained by Benedictus Reynaldo Hartanto ([@benedictusrey](https://github.com/benedictusrey))._

This file records every revision made between v2.6.3 and the released v2.7.0
(`2c9001c`, tag `v2.7.0`) and the documentation commits that followed. The user-facing
changelog is on the [GitHub release page](https://github.com/benedictusrey/WhatsNow-for-WhatsApp/releases/tag/v2.7.0)
and in [CHANGELOG.md](CHANGELOG.md); test boundaries are in
[docs/IMPLEMENTATION_v2.7.0.md](docs/IMPLEMENTATION_v2.7.0.md); locked behavior is in
[AGENTS.md](AGENTS.md).

## Released build

| Item | Value |
| --- | --- |
| Version | 2.7.0 |
| Tag / build commit | `v2.7.0` / `2c9001c` |
| Windows | `WhatsNow_2.7.0_windows_x64-setup.exe` |
| macOS | `WhatsNow_2.7.0_macos_universal.dmg` (Apple Silicon and Intel) |
| Linux | `WhatsNow_2.7.0_linux_x86_64.AppImage` |
| Checksums | `checksums.sha256` (all three) |
| Signing | Windows unsigned; macOS not notarized |

## Commits, in order

### Foundation (audit and UX overhaul)

| Commit | Change |
| --- | --- |
| `487bed6` | Phase 1, core correctness: atomic settings/accounts/app-lock writes, `is_account_label` helper, shortcut validation before replacing the working one, unlock back-off, poison-safe locks, bounded diagnostic log, no `notification:default` for the web page. |
| `1b62c0e` | Phase 2, centering: Settings centers on the cursor's monitor on every open, main window once at launch, saved window position no longer restored. |
| `0f32171` | Phase 3, notifications: Action Center groups and tags with clearing, per-chat unread tracking, throttled unread probe, per-account taskbar badges. |
| `aec0ce2` | Removed generated permission files for deleted commands. |
| `931338d` | Phase 4, Settings: instant-apply saving, native dialogs, notification health card, smarter 30-second idle close. |
| `c225e2a` | Phase 5, call window: WhatsNow icon and dark client background. |
| `f140a40` | Phase 6: version 2.7.0, documentation, AGENTS.md rules, local `backup/v2.7.0-locked` snapshot. |

### Polish after the first install

| Commit | Change |
| --- | --- |
| `18921d2` | Settings: panels no longer crop (container queries), Focus, Accounts and Appearance tidied, layout test added. |
| `b296c83` | Settings: reveal only after the first data renders; no theme flash and no dimmed first frame. |
| `44ad021` | Themes: whole-window palettes, transparent composer strip, native theming (start background, Windows 11 title bar), Aurora on the lock screen, and a fix for a chat-theme observer feedback loop. |

### Names, calls, and the Settings button

| Commit | Change |
| --- | --- |
| `3a963f6` | Account names: the typed label, else the WhatsApp profile name, everywhere (tray, Settings, toasts, window title); "WhatsApp" is no longer stored as a default; Rename can clear a label. |
| `f249018` | Call window: connecting frame, timing logs, and a first close-on-end attempt (its navigation backstop was later removed as unneeded). |
| `b058d77` | WhatsNow button in the chat-list header (`open_whatsnow_settings`); call window now closes completely with its page (proven by `examples/call-window-smoke.rs`). |
| `5f87a02` | Call lifecycle script reduced to the connecting frame and blank-page guard; it no longer touches peer connections. Docs and snapshot refreshed. |
| `0cec93e` | `v2.7.0`: changelog, release notes, and implementation record written. |

### Release packaging and documentation

| Commit | Change |
| --- | --- |
| `2c9001c` | Release: one installer per OS, release workflow verifies and retries the macOS DMG step, `check.yml` trigger fixed, rustfmt applied, installer scripts prefer the universal DMG and the AppImage. **The tagged build.** |
| `02a0df4` | Docs: changelog moved to the GitHub release page; README links to it. |
| `d37aed8` | CI: `check` runs only on demand or on code pull requests, to save Actions minutes. |
| `1ce2cf9` | Docs: release, install, platform, Windows, security, troubleshooting, and feature guides updated for v2.7.0. |
| `9d791d1` | Docs: `release-assets/README.md` points to v2.7.0. |
| `2a6f57c` | Repository organization: historical records moved to `docs/history/`, `CHANGELOGS_v2.6.1.md` removed (superseded by `CHANGELOG.md`), this record added. |

## Re-release with the mute fix (same version, v2.7.0)

| Commit | Change |
| --- | --- |
| `a483af1` | Audio: `identify` clears the mute flag of every WhatsNow-owned WebView2 audio session, the 3 s sweep re-checks it, and `attach` clears WebView2's `IsMuted`. Tag `v2.7.0` moved here and the release workflow re-run; the three installers on the release were replaced and the release notes updated. **The tagged build now.** |
| _this commit_ | Local cleanup of caches and old copies (about 33 GB), `docs/history/past_builds&tests.md` inventory, audit-tool source kept in `docs/history/tools/audio-audit/`, test record below. |

## Verification at release

- `cargo fmt --check`, `cargo test --lib` (125 tests), `cargo clippy --all-targets -- -D warnings`.
- All JavaScript and browser suites listed in the `verify` job of
  `.github/workflows/release.yml`; documentation check; `actionlint`.
- Native smoke test `cargo run --example call-window-smoke` (popup handoff, resize,
  maximize, and close with the page).
- Live checks on a signed-in Windows account over the debug port: header button,
  Settings names, theme matrix, and a real call that opens and closes its window.
- Release workflow and the four-platform `check` run succeeded on the tagged commit.

## Tests performed (starting point for a future bug)

### Automated, run locally
| Check | Result |
| --- | --- |
| `cargo fmt --all -- --check` | Clean (rustfmt had to be applied to 4 files before the first push) |
| `cargo test --lib` | 125 passed (accounts display name and migration, tray label, label validation, settings-shortcut permission, centering, caption colours, toast groups) |
| `cargo clippy --all-targets -- -D warnings` | Clean, also with `--features windows-memory`; macOS-target clippy could not run (no C linker here) |
| `node` suites: `bridge`, `chat-theme`, `toast-route`, `call-media`, `call-lifecycle`, `settings-ui/*` | All pass |
| Playwright: `settings-layout` (8 panels x 5 widths x 3 themes), `settings-contrast`, `settings-attribution`, `settings-shortcut`, `phone-routing`, `call-popup`, `smoke-links`, `smoke-test` | All pass |
| `scripts/check-docs.mjs` | 35 Markdown files pass |
| `cargo run --example call-window-smoke` | Passes with the close-with-page handler; **fails without it** (reproduces the leftover empty call window) |
| `scripts/audio-identity-smoke.ps1` | Fails with "Native media lifecycle assertions failed" **also on the unchanged code before the mute fix**, so it is not a regression. The identity step itself (name, group, icon) passes. Cause of the exit status unconfirmed |
| `actionlint` on both workflows, `bash -n` on every embedded step | Clean |
| Dry run of each release job's verify step against fake bundle folders | 11 cases pass (missing, empty, single-architecture and stray files fail as intended) |
| Installer asset selection against mocked release JSON (new and old names) | 8 cases pass |

### Live, on a signed-in Windows account (debug port, structure and metadata only)
- Chat-list header probed: the menu button is the only header button with `aria-haspopup="menu"`; the WhatsNow button was injected once, 40 px, and opened Settings.
- Theme matrix: composer strip transparent in all 8 personality themes; pill, rail and bubbles take the palette; typed emoji render; Settings opens with data and no dimmed controls or sideways scroll.
- Two real calls. Window created in about 75-78 ms, page loaded 298-339 ms later. Before the fix the call window stayed open and empty after hang-up (no page target left in the debugger list, only the native frame). After the fix the log showed "page closed, closing the window" and the window was gone.
- Audio mixer: the WhatsNow row had a saved mute; after the fix the session read unmuted and stayed unmuted across a 40 s watch. The other muted row ("Microsoft Edge WebView2") belongs to `X-Now.exe`, not WhatsNow. Windows stores per-app mute under `HKCU\Software\Microsoft\Internet Explorer\LowRegistry\Audio\PolicyConfig\PropertyStore`, keyed by device and program path.
- Mixer icon experiments (all showed the WebView2 swoosh except where noted): bare exe path; `.ico`; `.ico,0`; `exe,0`; `exe,-32512`; `.ico` in the shared Public user folder; a freshly restarted Settings app; a Windows DLL icon (`shell32.dll,-43`, shown once, then not); `--app-user-model-id` on the WebView2 browser arguments (no result reported). Conclusion: Windows takes the icon from the process that plays the sound (`msedgewebview2.exe`) and ignores session icon paths. Do not retry these forms; the only remaining option is a bundled, re-branded WebView2 runtime.

### CI on GitHub
- `check` matrix (Windows, Linux, macOS Apple Silicon, macOS Intel): success on `2c9001c`.
- Release workflow: success on `2c9001c` and again on `a483af1` (verify, three builds, publish). The macOS binary is checked to be universal.

### Not verified
- DMG and AppImage were built and compile-tested in CI but not opened on a Mac or Linux PC.
- Windows 10, long calls, toast clearing from a second device, and the mute fix with the final installer.
- Test D of the icon experiments (no result was reported).

### How to rerun
Commands and file locations are in [docs/history/past_builds&tests.md](docs/history/past_builds%26tests.md) (section "How to recreate a deleted cache") and in [docs/RELEASING.md](docs/RELEASING.md).

## Not verified

- The macOS DMG and Linux AppImage were built and compile-tested in CI but not
  opened on those systems.
- Windows 10, long calls, and toast clearing from a second device.

## Repository layout

| Path | Purpose |
| --- | --- |
| `src-tauri/` | Rust/Tauri app, bridge scripts, capabilities, icons |
| `settings-ui/` | Settings and lock screen interface |
| `scripts/` | Build, installer, verification, and test tools |
| `.github/workflows/` | `release.yml` (tag-triggered draft release), `check.yml` (on demand) |
| `docs/` | Current guides; `docs/history/` holds records of earlier versions |
| `release-assets/` | Checksum and manifest records only (binaries are ignored) |
| Root Markdown | README, CHANGELOG, RELEASE_NOTES, WhatsNow_latest, this record, policies |
