# Past builds and tests: inventory of deleted local files

_2026-11-15 · Created and maintained by Benedictus Reynaldo Hartanto ([@benedictusrey](https://github.com/benedictusrey))._

This file records what was in the local-only folders (all ignored by Git) before they were deleted on 2026-11-15 to free disk space (the drive was 96% full). Use it as the starting point for a future bug: it says what existed, what it proved, and how to recreate it. The record of the 2.7.0 work itself is in [WhatsNow_v2.7.0.md](../../WhatsNow_v2.7.0.md).

## What was deleted

| Path | What it was | Size | Recreate? |
| --- | --- | --- | --- |
| `src-tauri/target/debug` | Cargo debug build cache and test examples | 9.1 GB | Yes: `cargo build` / `cargo test` |
| `src-tauri/target/x86_64-apple-darwin` | Cross-target check output (no linker available) | 12.6 MB | Yes |
| `.workspace/target-windows` | Second cargo target directory (debug and release) | 18.4 GB | Yes |
| `dist/v2.6.1` | Local 2.6.1 package set | 12.4 MB | Published release v2.6.1 on GitHub |
| `dist/v2.6.1-attribution` | 2.6.1 candidate (attribution link fix) | 12.4 MB | Superseded by 2.6.1 |
| `dist/v2.6.1-no-reload` | 2.6.1 candidate (no reload) | 12.4 MB | Superseded by 2.6.1 |
| `dist/v2.6.1-panel-contrast` | 2.6.1 candidate (panel contrast) | 12.4 MB | Superseded by 2.6.1 |
| `dist/v2.6.1-ci-7320615` | CI package set for 2.6.1 (commit 7320615) | 102.4 MB | Published release assets |
| `dist/v2.6.2-candidate` | 2.6.2 local candidate | 12.4 MB | Superseded by 2.6.2 |
| `dist/v2.6.2-ci-c28b005` | CI package set for 2.6.2 (commit c28b005) | 102.4 MB | Published release assets |
| `dist/v2.6.3-candidate` | 2.6.3 local candidate | 12.5 MB | Superseded by 2.6.3 |
| `dist/v2.6.3` | CI package set for 2.6.3 | 102.5 MB | Published release v2.6.3 |
| `.workspace/consolidation-20261017` | Evidence and copies from the 2026-10-17 workspace consolidation | 8.2 GB | No (history only) |
| `.workspace/audio-audit` | Small Rust tool that listed Windows audio sessions, plus its build cache | 168.2 MB | Source kept in `docs/history/tools/audio-audit/` |
| `.workspace/release-v2.6.1` | Test logs, 2.6.1 | 7.5 KB | No (results in docs/history) |
| `.workspace/release-v2.6.2` | Test logs, 2.6.2 | 8.0 KB | No (results in docs/history) |
| `.workspace/release-v2.6.3` | Test logs and audio-identity evidence, 2.6.3 | 599.8 KB | No (results in docs/history) |
| `.workspace/build-2.7.0.log` | Windows installer build log, 2.7.0 | 2.0 KB | Yes: `scripts/build-windows.ps1` |
| `.workspace/build-2.7.0b.log` | Windows installer build log, 2.7.0 (second build) | 2.0 KB | Yes |
| `scripts/smoke-shots` | Screenshots written by `scripts/smoke-test.mjs` | 200.8 KB | Yes: `node scripts/smoke-test.mjs` |
| `%TEMP%/WhatsNow-*-smoke-*` (24 folders) | Temporary profiles of the native call and media smoke tests | 218.6 MB | Yes: `cargo run --example ...` |

Kept on purpose: `backup/` (locked references, see AGENTS.md), `versions/` (historical snapshots), `release-assets/` (checksum records), `node_modules/`, `src-tauri/target/release` (latest release build), `dist/windows` (2.7.0 installers).

## Package sets in `dist/` (installers, with SHA-256)

Only the executable packages are hashed. Everything else in a set is listed by name and size.

### `dist/v2.6.1`

| File | Size | Date | SHA-256 |
| --- | --- | --- | --- |
| `windows/WhatsNow_2.6.1_windows_x64-portable.exe` | 5.0 MB | 2026-10-17 | `c4dcee5b2b3817d68f016f272e997799557bfa424f7345b1cbe062aff7d46cef` |
| `windows/WhatsNow_2.6.1_windows_x64-setup.exe` | 3.2 MB | 2026-10-17 | `4f59a1ac86230f33bb26acea94c0519305701ad1d455ba2dcd51e4e8c8ba7a55` |
| `windows/WhatsNow_2.6.1_windows_x64_en-US.msi` | 4.3 MB | 2026-10-17 | `578478f8165790bd7e757ff10a6b2106ecdab49553155de7d028066e2d241932` |

Other files: `source-manifest.json` (20.4 KB), `windows/checksums-windows.sha256` (315 B)

### `dist/v2.6.1-attribution`

| File | Size | Date | SHA-256 |
| --- | --- | --- | --- |
| `windows/WhatsNow_2.6.1_windows_x64-portable.exe` | 5.0 MB | 2026-10-17 | `3be80cfffad897db50994fafb185eea19ad6b1beff23e2ad1e7acd5cbe66dca2` |
| `windows/WhatsNow_2.6.1_windows_x64-setup.exe` | 3.2 MB | 2026-10-17 | `419ece09b961ae15015ec0798c6f98b2493912eba505d77e3e3dbc2b61b58e6d` |
| `windows/WhatsNow_2.6.1_windows_x64_en-US.msi` | 4.3 MB | 2026-10-17 | `295ffa1aeca38e74477e624db74a79b6a5e85497317b63ef251b885b5ac6899d` |

Other files: `source-manifest.json` (21.2 KB), `windows/checksums-windows.sha256` (315 B)

### `dist/v2.6.1-ci-7320615`

| File | Size | Date | SHA-256 |
| --- | --- | --- | --- |
| `WhatsNow_2.6.1_aarch64.app.tar.gz` | 2.2 MB | 2026-10-17 | `3b8bb4fa034b62cb266c94452378b806dc542e76e7af7d2f2779554602402af5` |
| `WhatsNow_2.6.1_aarch64.dmg` | 2.4 MB | 2026-10-17 | `a70ca4ae39f9a435def3a13ad57001325313037d591606f0617415b0e733ba24` |
| `WhatsNow_2.6.1_amd64.AppImage` | 77.7 MB | 2026-10-17 | `c9603e1071a0e5fecc6c0ff3e580911d69ec3b2b0ed1c0dd41d6fb50fd5327c7` |
| `WhatsNow_2.6.1_amd64.deb` | 2.7 MB | 2026-10-17 | `37a7acf11308e405435dbf5013bd113a02d5732a31cee200b1fd8946ab3c8859` |
| `WhatsNow_2.6.1_windows_x64-portable.exe` | 4.9 MB | 2026-10-17 | `f532fcce5bfcb0fee124822e630efd8780f348d412c8da10f3bb965ea9522a59` |
| `WhatsNow_2.6.1_windows_x64-setup.exe` | 3.3 MB | 2026-10-17 | `c7d127a24abd4f648671febdc2b6a297897638207747771661991b38de7bdf9c` |
| `WhatsNow_2.6.1_windows_x64_en-US.msi` | 4.2 MB | 2026-10-17 | `43241393717b824dba03b472b25e1adc8e5c610fa4cfb7529e75da50acf3d987` |
| `WhatsNow_2.6.1_x86_64.app.tar.gz` | 2.4 MB | 2026-10-17 | `bd9a82f1425a1a0fb69ddc90119464498a7612d0fa69f2305cbaa255773b5df4` |
| `WhatsNow_2.6.1_x86_64.dmg` | 2.6 MB | 2026-10-17 | `ff5ea71d40e747400ec2a5298975ac87b63b1fe08ae56dbc529091c663bb3aca` |

Other files: `checksums.sha256` (883 B), `release-verification.json` (2.7 KB)

### `dist/v2.6.1-no-reload`

| File | Size | Date | SHA-256 |
| --- | --- | --- | --- |
| `windows/WhatsNow_2.6.1_windows_x64-portable.exe` | 5.0 MB | 2026-10-17 | `25cf5de03c26a47e960e7f29293f5ee8aedabc886f0622a5f13a10928f0ab9d6` |
| `windows/WhatsNow_2.6.1_windows_x64-setup.exe` | 3.2 MB | 2026-10-17 | `19f9c5e6fd5912f860479b938d1ff5180aebd0f50af7486b5c570ffb7788b882` |
| `windows/WhatsNow_2.6.1_windows_x64_en-US.msi` | 4.3 MB | 2026-10-17 | `b0403853d5923ab894a2bfdd84d6a86af91aed70bf69a5de459ed92e41876f9f` |

Other files: `source-manifest.json` (20.9 KB), `windows/checksums-windows.sha256` (315 B)

### `dist/v2.6.1-panel-contrast`

| File | Size | Date | SHA-256 |
| --- | --- | --- | --- |
| `windows/WhatsNow_2.6.1_windows_x64-portable.exe` | 5.0 MB | 2026-10-17 | `84d5174a36beafcca6bb52ceaa2dedb17e42d9c0ad8161fa57b0b744b430b75e` |
| `windows/WhatsNow_2.6.1_windows_x64-setup.exe` | 3.2 MB | 2026-10-17 | `d4e703070efb68b5ea7273f60bc8ee17423f349e2e985664f9f4570d3ec234d3` |
| `windows/WhatsNow_2.6.1_windows_x64_en-US.msi` | 4.3 MB | 2026-10-17 | `8bab9da89da3d4a3f8fa77074c6c8315b6e98b4c4822ba6b909c40f77c0a79e8` |

Other files: `source-manifest.json` (21.1 KB), `windows/checksums-windows.sha256` (315 B)

### `dist/v2.6.2-candidate`

| File | Size | Date | SHA-256 |
| --- | --- | --- | --- |
| `WhatsNow_2.6.2_windows_x64-portable.exe` | 5.0 MB | 2026-10-21 | `1de9fa8f1930a055037d17005343147a0ca4e007d0f0584b4ef6ca8ad3c4215d` |
| `WhatsNow_2.6.2_windows_x64-setup.exe` | 3.2 MB | 2026-10-21 | `07bb50e2863ec9f1db546bcdbc5a286315f631fa7cd2dfee6843d041564a5139` |
| `WhatsNow_2.6.2_windows_x64_en-US.msi` | 4.3 MB | 2026-10-21 | `74714b7a2eb0aed0c183b203c0df2d7548b8cf12917609867ec519ab98c6edf8` |

Other files: `TESTING.md` (1.8 KB), `checksums-windows.sha256` (315 B), `verification.json` (2.7 KB)

### `dist/v2.6.2-ci-c28b005`

| File | Size | Date | SHA-256 |
| --- | --- | --- | --- |
| `WhatsNow_2.6.2_aarch64.app.tar.gz` | 2.2 MB | 2026-10-22 | `f687cd01cfa1150369970ab8b99ebd3368fc0c51cc371a9686e49e5964f4d73a` |
| `WhatsNow_2.6.2_aarch64.dmg` | 2.4 MB | 2026-10-22 | `66a3f5b998afbc268fd705d0f6ccac8850ee6a4a3197ca5d7f1ab34d74cf011a` |
| `WhatsNow_2.6.2_amd64.AppImage` | 77.7 MB | 2026-10-22 | `fbef47bac8d4cae00615239777db3b3865d64af6493c4b5796f7eccc4208c77b` |
| `WhatsNow_2.6.2_amd64.deb` | 2.7 MB | 2026-10-22 | `92a85e04aad2473d690a22cb8a4af90d519c05d9106b89a90120c25d6aa60cee` |
| `WhatsNow_2.6.2_windows_x64-portable.exe` | 4.9 MB | 2026-10-22 | `adbe6f2c2bcc275fbec51ebc7b5df0ab1bff7f00d912874cbf6083c59d4be010` |
| `WhatsNow_2.6.2_windows_x64-setup.exe` | 3.3 MB | 2026-10-22 | `6afc7b5756821c70496e0aee1ef39084a8e176f847b33deadc7e1650067e457d` |
| `WhatsNow_2.6.2_windows_x64_en-US.msi` | 4.2 MB | 2026-10-22 | `54189b8cca66ef094e64a745d8cdfdcdd913bb52618a22f0d3222c1bee11e24f` |
| `WhatsNow_2.6.2_x86_64.app.tar.gz` | 2.4 MB | 2026-10-22 | `02c463df50981e1da7a07aa6d90532aeb4479556e459452ba1174785a69cbb59` |
| `WhatsNow_2.6.2_x86_64.dmg` | 2.6 MB | 2026-10-22 | `5f1dce98df7a1df90a02dbba68e9db5c6aecd0273ff9bdcbc5ff8810e2ec42b4` |

Other files: `checksums.sha256` (883 B), `release-verification.json` (3.7 KB)

### `dist/v2.6.3`

| File | Size | Date | SHA-256 |
| --- | --- | --- | --- |
| `WhatsNow_2.6.3_aarch64.app.tar.gz` | 2.2 MB | 2026-11-07 | `70a27095320bd4fcddfbf416319dc3a2b80dc76be28cf923d438393e27ab2897` |
| `WhatsNow_2.6.3_aarch64.dmg` | 2.4 MB | 2026-11-07 | `ddce053ce1bc77ba9913efb35531960e5c74c4a7370d6587e5933b4f556bbec9` |
| `WhatsNow_2.6.3_amd64.AppImage` | 77.7 MB | 2026-11-07 | `ac230a7571d686e679955cbb74d2a0f66067be6f4c77baea8685f34b7132fff1` |
| `WhatsNow_2.6.3_amd64.deb` | 2.7 MB | 2026-11-07 | `9da00b16252875bceb37a6a89ee79bdc6c2bd7c820fe2b95030790f77d100a5e` |
| `WhatsNow_2.6.3_windows_x64-portable.exe` | 5.0 MB | 2026-11-07 | `a9d0ad3cf2ad4947019448edd422133a8f6e5f91c0ccf0b92241c3c1774057ec` |
| `WhatsNow_2.6.3_windows_x64-setup.exe` | 3.4 MB | 2026-11-07 | `9cd7a621b34a87c26e90ae800f6158e54a281d5f3d79246391d858ded4f8c93a` |
| `WhatsNow_2.6.3_windows_x64_en-US.msi` | 4.2 MB | 2026-11-07 | `a424bfbc673f4a2f4431de41bf642271d62d6bf5bab327e7e8245ccc5cf30384` |
| `WhatsNow_2.6.3_x86_64.app.tar.gz` | 2.4 MB | 2026-11-07 | `963f393cf69e3b866efe97116f1fa8dabe834c6a8cd1aaecb50648166286f98d` |
| `WhatsNow_2.6.3_x86_64.dmg` | 2.6 MB | 2026-11-07 | `93d865d6d39cd3caaa2d3313cce474349180e8d9e0c05bf1ae2a49c4bb141d62` |

Other files: `checksums.sha256` (883 B), `release.json` (20.4 KB), `verified-packages.json` (1.7 KB), `verified-windows-metadata.json` (365 B)

### `dist/v2.6.3-candidate`

| File | Size | Date | SHA-256 |
| --- | --- | --- | --- |
| `WhatsNow_2.6.3_windows_x64-portable.exe` | 5.0 MB | 2026-11-07 | `e6128361406aa579d6345d8626b857476a92e912250b695f7a1b5fbc26759aa9` |
| `WhatsNow_2.6.3_windows_x64-setup.exe` | 3.2 MB | 2026-11-07 | `d0fbd31b8e683dae986754987859617cd67edeec1ef99c8cf863df2c9b7cdc45` |
| `WhatsNow_2.6.3_windows_x64_en-US.msi` | 4.3 MB | 2026-11-07 | `9c8d8179b6fc7b8ca98366a9390dded9479637f5c2de66fc7d66b99a95e29333` |

Other files: `checksums-windows.sha256` (315 B)


## Older installers in `dist/windows` (2.5.0 and 2.6.0)

Deleted; `dist/windows` keeps the 2.7.0 files and `checksums-windows.sha256`.

| File | Size | SHA-256 |
| --- | --- | --- |
| `WhatsNow_2.5.0_windows_x64-portable.exe` | 4.9 MB | `825b0c46e03eaea750c6c2ba8d6ae8253d5d99e4a86fe233212c12916af9f15f` |
| `WhatsNow_2.5.0_windows_x64-setup.exe` | 3.1 MB | `57e06cacbeb0ba6d5e2240bf3d520478e5158ff14d3a04ad3c5f00760e534e84` |
| `WhatsNow_2.5.0_windows_x64_en-US.msi` | 4.1 MB | `c6a0f47de4c81bafd12ff4409ea06fdabe813daee42f2a6d8934bcc750967cd3` |
| `WhatsNow_2.6.0_windows_x64-portable.exe` | 5.0 MB | `3db3a61ecb2a6d19c31e412a061a0445de0fa22cdd68e97820f7e5ea11f4e103` |
| `WhatsNow_2.6.0_windows_x64-setup.exe` | 3.2 MB | `1096fa2b274ecd82675d4df0736598ea01c6ce6d381deb2497be5c0394e1b84f` |
| `WhatsNow_2.6.0_windows_x64_en-US.msi` | 4.2 MB | `01c9ed09f10f41bd86362aa316870c51873f7898886c015382845af97847ab5f` |
| `checksums-v2.6.0.txt` | 0.0 MB | `e88dcfc48c8103541e999b18cf5e162fccd84dc89e676943b0f9f7395093f78a` |
| `checksums-windows-2.6.0.sha256` | 0.0 MB | `48349a1625bc67ae839825cdcd2a2b777f18568ed34cb87d1d21dd5b280472a2` |

## `dist/call-fix-20261021` (2.6.1 call-window fix candidate, 2026-10-21)

Deleted. Candidate installers for the call-window fix that shipped in 2.6.2; see [CALL_WINDOW_FIX_2026-10-21.md](CALL_WINDOW_FIX_2026-10-21.md).

| File | SHA-256 |
| --- | --- |
| `WhatsNow_2.6.1_windows_x64-portable.exe` | `cb8bcaaf2726479f0cc6f4320203777999f7671f10e5f498c0d031bca1b028a2` |
| `WhatsNow_2.6.1_windows_x64-setup.exe` | `87c85de0744ee14e50337e330458dc1cc8cdb4dd54803a9fd9383e69ae6c72d5` |
| `WhatsNow_2.6.1_windows_x64_en-US.msi` | `f7b510efbd65fc82841f6a4648120d4764ef9da7b1d7de3fed0b39f413619d52` |

Also held `checksums-windows.sha256` and `verification.json`.

## `.workspace/consolidation-20261017` (2026-10-17 workspace consolidation)

Plan summary: SourceFiles=23851, DestinationFiles=7108, SourceBytes=14907725231.0, DestinationBytes=3728760325.0, Policy=No deletion or overwrite; archive private Git and conflicting generated trees.

`moves.jsonl` held 30 recorded moves.

| Entry | Size |
| --- | --- |
| `consolidate.ps1` | 8.1 KB |
| `destination-before.csv` | 1.1 MB |
| `historical-documents` | 2.3 KB |
| `legacy-git` | 58.7 MB |
| `maintenance-before` | 9.2 MB |
| `moves.jsonl` | 6.2 KB |
| `plan.json` | 223 B |
| `preserved-source` | 4.9 MB |
| `previous-destination` | 3.4 GB |
| `public-gitignore.before` | 810 B |
| `relocated-target-windows-stale` | 4.7 GB |
| `source-before.csv` | 3.8 MB |
| `verification-result.json` | 94 B |
| `verified-file-map.before-maintenance.csv` | 8.1 MB |
| `verified-file-map.csv` | 8.4 MB |

Contents in short: `relocated-target-windows-stale` was an old cargo target directory, `previous-destination` was a copy of the folder before the move, `legacy-git` held the old repository metadata, `maintenance-before` and `historical-documents` held earlier Markdown and maintenance snapshots, `*.csv` were file maps used to verify the move. The consolidation itself is described in [WORKSPACE_LAYOUT.md](../WORKSPACE_LAYOUT.md). Nothing in this folder was a source of truth: the live repository and its Git history are.

## `.workspace/audio-audit` (Windows audio session lister)

A small Cargo project (`Cargo.toml`, `Cargo.lock`, `src/main.rs`, 3.2 KB of source) that listed Windows audio sessions with their mute flag, volume and icon path. The source was kept in `docs/history/tools/audio-audit/`; its `target/` build cache (168.2 MB) was deleted. The repository example `src-tauri/examples/audio-session-inspect.rs` does the same job and is the one to use.

## `.workspace/release-v2.6.x` and build logs

- `.workspace\release-v2.6.1`: 2 files (7.5 KB): `github-release.ps1`, `verify-assets.ps1`
- `.workspace\release-v2.6.2`: 3 files (8.0 KB): `github-release.ps1`, `publication-receipt.json`, `verify-assets.ps1`
- `.workspace\release-v2.6.3`: 60 files (599.8 KB): `application-source.sha256`, `audio-application-source.sha256`, `audio-audit-boundary.log`, `audio-audit.stderr.log`, `audio-build-windows.log`, `audio-call-window.log`, `audio-clippy.log`, `audio-default-rust.log`, `audio-final-clippy.log`, `audio-final-javascript.log`, `audio-final-rust.log`, `audio-full-rust.log`, `audio-identity-green.log`, `audio-identity-progress.md`, `audio-identity-red.log`, `audio-live.json`, `audio-live.stderr.log`, `audio-release-clippy.log`, `audio-session-snapshot.json`, `audio-verification.json`, `authority-green.log`, `authority-red.log`, `build-windows.log`, `clippy.log`, `cloud-linux-check.log` ...
- `.workspace\build-2.7.0.log` (2.0 KB)
- `.workspace\build-2.7.0b.log` (2.0 KB)

The results of the 2.6.x checks are summarized in [IMPLEMENTATION_v2.6.2.md](IMPLEMENTATION_v2.6.2.md), [IMPLEMENTATION_v2.6.3.md](IMPLEMENTATION_v2.6.3.md) and [AUDIT_2.6.1.md](AUDIT_2.6.1.md).

## `scripts/smoke-shots`

Screenshots from `scripts/smoke-test.mjs` (theme and doodle pixel checks): `chat-surface-dark-doodles-1366.png`, `chat-surface-dark-doodles-1920.png`, `chat-surface-midnight.png`, `settings-appearance-dark.png`, `settings-appearance-light.png`. Re-run the script to recreate them.

## How to recreate a deleted cache

- Rust build cache: `cd src-tauri && cargo build` (debug) or `cargo build --release --features windows-memory`. About 90 seconds for release on this machine, more for a clean debug build.
- Windows installers: `scripts/build-windows.ps1`, output in `dist/windows/`.
- Native audio and call fixtures: `cargo build --examples --features windows-memory`, then `scripts/audio-identity-smoke.ps1` or `cargo run --example call-window-smoke`.
- Browser suites: `npm install --no-save playwright@1.63.0` and `npx playwright install chromium`, then the `node ...test.mjs` files listed in `.github/workflows/release.yml`.