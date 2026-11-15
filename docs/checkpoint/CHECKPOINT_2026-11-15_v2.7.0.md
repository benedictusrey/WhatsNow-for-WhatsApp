# Checkpoint: WhatsNow v2.7.0 (2026-11-15)

Created and maintained by Benedictus Reynaldo Hartanto ([@benedictusrey](https://github.com/benedictusrey)).
Repository: <https://github.com/benedictusrey/WhatsNow-for-WhatsApp>.

Read this first when resuming work. It says what is true now, what was decided, what is open, and what to
avoid. The full record of the 2.7.0 work is [WhatsNow_v2.7.0.md](../../WhatsNow_v2.7.0.md); the inventory of
deleted local files is [past_builds&tests.md](../history/past_builds%26tests.md).

## 1. State at this checkpoint

| Item | Value |
| --- | --- |
| Version | 2.7.0 (`VERSION`, `tauri.conf.json`, `Cargo.toml`); bump only when the owner asks |
| Branch | `main` only; the feature branch was deleted. Local and GitHub `main` match (`1c20f4b` plus this checkpoint commit) |
| Tag | `v2.7.0` on `a483af1` (moved once, on purpose, to ship the mute fix) |
| Release | Public (not a draft), published 2026-11-15; three installers plus `checksums.sha256` |
| Rust tests | 125 passed (`cargo test --lib`); fmt and clippy clean |
| Docs | 36 Markdown files pass `scripts/check-docs.mjs` |
| Working tree | Clean after each commit; nothing uncommitted of value |

### Release assets (SHA-256)

| File | Size (bytes) | SHA-256 |
| --- | --- | --- |
| `WhatsNow_2.7.0_windows_x64-setup.exe` | 3,550,337 | `30ff565b7d34620f6802f10d662c1ea6833ff0d60cc0f181a3eae6b7dc3d38bd` |
| `WhatsNow_2.7.0_macos_universal.dmg` | 4,893,489 | `48e2c8c2a73d420a8cd5cb0a3c6183fee42b72eb5e310959b02c9fdd95720300` |
| `WhatsNow_2.7.0_linux_x86_64.AppImage` | 81,553,912 | `ad1151e8cbc6aaf0c8f1839716a7391b23ba2f7d8ca74526c1f762e46ad80503` |
| `checksums.sha256` | 307 | `98aaa7508a045733b3738400173d31743aff2540c5aeea3c755583c3bd692658` |

Earlier 2.7.0 installers (the first publish, before the mute fix) have different hashes and must not be
used. The installers in `dist/windows` are local builds from before the re-release and are not the release files.

## 2. What 2.7.0 contains

Foundation (audit and UX overhaul): atomic file writes, centered windows, Action Center grouping, instant-apply
Settings, notification health. Polish: Settings layout without cropping, Settings reveal after data, whole-window
themes with a transparent composer strip. Names and calls: the typed account name, else the WhatsApp profile name;
the call window closes with its call; a WhatsNow button in the chat-list header opens Settings. Packaging: one
installer per operating system. Audio: WhatsNow's own audio sessions are kept unmuted. Details and commits:
[WhatsNow_v2.7.0.md](../../WhatsNow_v2.7.0.md); locked behavior: [AGENTS.md](../../AGENTS.md).

## 3. Decisions made (do not reverse without being asked)

- **Never muted.** `identify` in `audio_identity_windows.rs` clears the mute flag on WhatsNow-owned WebView2
  sessions; a 3 s sweep re-checks. This reverses the 2.6.3 rule "does not change mute".
- **Mixer icon is accepted as the WebView2 icon.** Windows takes it from the process that plays the audio
  (`msedgewebview2.exe`) and ignored every session icon form tried. The only remaining route is a bundled,
  re-branded WebView2 runtime (about 150 MB, own security updates); the owner chose not to do it.
- **One installer per OS** in releases; MSI, portable, `.deb` and per-architecture macOS files are local builds only.
- **Changelog lives on the GitHub release page** (`RELEASE_NOTES.md` is its source), not in the README.
- **Re-release v2.7.0** (same version) was chosen over a new version number; assets were replaced, release kept public.
- **Account name rule:** typed label, else profile name, else "WhatsApp" until read; "WhatsApp" is never stored.

## 4. Working rules from the owner

- **GitHub Actions minutes are limited.** Docs, README and changelog changes never start a workflow. `check.yml`
  runs only by hand or on code pull requests; releases run only on a `v*` tag or a manual dispatch.
- Verify locally first (fmt, tests, clippy, `actionlint`, docs check). Ask before any push, tag or workflow run, and
  say what it costs (macOS minutes count 10 times).
- Never push, tag, publish or delete branches unless asked. Keep commit messages free of AI attribution.
- Commits use the GitHub private address (`...@users.noreply.github.com`); "Keep my email private" and "Block
  command line pushes that expose my email" are on. A repo-level `user.email` once overrode the global one, so
  check `git config --show-origin user.email` in each repository.
- Source files use CRLF (`unix2dos` after edits); shell scripts are LF (`.gitattributes`).
- `backup/` is a reference and is never edited; older snapshots stay byte-identical.

## 5. Open items

1. Open the macOS DMG on a Mac and run the Linux AppImage once; CI built and compile-tested them only.
2. Install the current Windows setup and confirm in the Volume mixer that WhatsNow stays unmuted after muting it.
3. The first 38 commits still show the owner's personal address in their metadata; fixing it needs a history rewrite
   and a moved tag (not done, only on request).
4. `scripts/audio-identity-smoke.ps1` fails with "Native media lifecycle assertions failed" on the code from before
   the mute fix too; the cause of the exit status is unconfirmed.
5. Windows 10, long calls, and toast clearing from a second device are unverified.
6. The GitHub token used by the `gh` tool is a classic personal access token in an environment variable; revoke
   or narrow it when work is finished.

## 6. How to resume

| Task | Command or place |
| --- | --- |
| Build and test | `cd src-tauri`, then `cargo fmt --all -- --check`, `cargo test --lib`, `cargo clippy --all-targets -- -D warnings` |
| Windows installers | `scripts/build-windows.ps1` (output `dist/windows`) |
| Browser suites | `npm install --no-save playwright@1.63.0`, `npx playwright install chromium`, then the `node ...test.mjs` files named in `.github/workflows/release.yml` |
| Native fixtures | `cargo build --examples --features windows-memory`; `cargo run --example call-window-smoke` |
| Inspect audio sessions | `cargo run --example audio-session-inspect` (prints mute, volume, icon per session) |
| Live check of the page | Start the exe with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`, attach with Playwright `connectOverCDP`; read structure only, never message text. Quit the normal WhatsNow first (single instance) |
| Lint workflows | `pip install actionlint-py`, then run `actionlint` on `.github/workflows/*.yml` |
| Read a release | `gh release view v2.7.0` or the public REST API; editing a release needs the `gh` login |

## 7. Pitfalls found while working

- A launch of any exe rewrites the Start-menu shortcut and the `whatsapp://` handler to that exe (`aumid::register`,
  `protocol::register`); after testing a dev build, start the installed app once to restore them.
- WebView2 popups close the inner container only on `window.close()`; the call window needs the extra
  `WindowCloseRequested` handler (`call_window::close_window_with_page`).
- Windows keeps per-app mute and volume keyed by the shared `msedgewebview2.exe` path, so other WebView2 apps share it.
- Tauri sync commands must not create windows on Windows; use `async` commands (see `open_whatsnow_settings`).
- `check-docs.mjs` rejects private absolute paths and mojibake in Markdown; use `%26` for `&` in link targets.
- In Git Bash, inline Python with backslashes gets mangled; write scripts to a file instead.
- A release workflow re-run with an existing tag replaces the assets; verify digests against `checksums.sha256` after.
- No Mac or Linux machine was available for tests; do not claim installed-app behavior there.

## 8. Local-only folders

Ignored by Git: `backup/`, `versions/`, `release-assets/*` binaries, `node_modules/`, `src-tauri/target/`, `dist/`,
`.workspace/` (emptied on 2026-11-15). About 33 GB of caches and old copies were deleted that day; the list is in
[past_builds&tests.md](../history/past_builds%26tests.md).
