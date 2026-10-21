# WhatsNow 2.6.2 implementation and validation

2026-10-21 · Created and maintained by [@benedictusrey](https://github.com/benedictusrey).

## Outcome

The maintainer installed the Windows 2.6.2 candidate and reported that it is
"working very well now" after the requested call test. The installed executable
also reports version 2.6.2. This confirms the maintainer's successful Windows
experience; it is not an independent recording of the call or proof of calling
on every platform, device, account, or future WhatsApp Web revision.

## Call-window repair

- Preserve the native `window.open` return value for call stages. WhatsApp
  receives the real WindowProxy instead of a false blocked-popup result.
- Preserve the target name and requested window features for call communication.
- Start the native child at `about:blank` and let WebView2 attach its opener
  before loading the destination. Keep the same opener environment/session.
- Retain native resize, minimize, maximize, and restore controls, without
  imposing a maximum window size. Initial geometry still follows the opener's
  monitor, DPI, and available work area.
- Share the production call builder with the isolated native test fixture.
  Example-only Common Controls v6 manifest flags fix the fixture's startup;
  they do not replace the main application's manifest or security settings.

## Camera framing

Within supported HTTPS WhatsApp call stages, request
`resizeMode: { ideal: "none" }` where the camera API supports it. This prefers
a full camera frame instead of browser crop-and-scale. Keep WhatsApp's selected
device, resolution, frame-rate, and audio constraints. Do not acquire media at
initialization, retry permission failures, modify screen sharing, or affect
chat attachment tools.

This is a capture preference, not a remote-layout guarantee. Hardware may use
a supported fallback, WhatsApp may apply later constraints, and the recipient's
phone decides how to fit or crop incoming video. The maintainer's general success
report does not separately establish every camera-switch or screen-sharing case.

## Version and packaging

VERSION, Cargo.toml, Cargo.lock, and Tauri configuration agree on 2.6.2.
Settings cache tags and the About/footer regression follow the current version.
The Windows packaging script derives filenames from configuration and refuses
inconsistent VERSION/configuration declarations. Dependencies did not change;
the lockfile update changes the application package version only.

The tested local candidate is in `dist/v2.6.2-candidate/`. Its Windows files are
unsigned and its checksum/verification records remain local. The release workflow
rebuilds Windows, Linux, and macOS packages from one committed revision and creates
a draft with a combined checksum manifest. Those CI builds are distinct artifacts
and must be verified; they must not be described as byte-identical to the local test.

## Evidence

| Check | Evidence and scope |
| --- | --- |
| Windows Rust tests | 111 library tests passed with `windows-memory` |
| Static checks | Strict Clippy passed for all targets; Rust formatting passed |
| Native Windows fixture | Child navigation, opener handshake, maximize, restore, and client-area resize passed |
| Real Chromium fixture | WindowProxy, named target, opener messaging, close lifecycle, and synthetic-camera `resizeMode: none` passed |
| Camera guard tests | No eager acquisition, unchanged input constraints/audio/devices, untouched screen sharing, no hidden retries |
| Surrounding regressions | Bridge/drop, themes/doodles, toast routing, hotkeys, Settings ACL/contrast/attribution, and phone routing passed |
| Local packaging | Setup/portable FileVersion and MSI ProductVersion are 2.6.2; three SHA-256 entries verified |
| Live Windows calling | Maintainer reports success after installing the 2.6.2 candidate |
| Linux/macOS | Native CI builds and runtime acceptance tracked separately; Windows evidence does not validate calling there |

No theme palette, doodle mapping, notification delivery, account-storage, Focus,
or App Lock redesign is part of this update. Existing tests guard those contracts.
There is no claim of zero future regressions, antivirus clearance, or universal
calling availability. Keep platform runtimes and OS security protections updated.

Detailed investigation and earlier candidate hashes:
[call-window repair record](CALL_WINDOW_FIX_2026-10-21.md).

## Reproduce

```powershell
cargo test --locked --manifest-path src-tauri/Cargo.toml --features windows-memory --lib
cargo clippy --locked --manifest-path src-tauri/Cargo.toml --features windows-memory --all-targets -- -D warnings
cargo run --locked --manifest-path src-tauri/Cargo.toml --features windows-memory --example call-window-smoke
node src-tauri/resources/call-media.test.mjs
node scripts/call-popup.test.mjs
node src-tauri/resources/bridge.test.mjs
node src-tauri/resources/toast-route.test.mjs
node scripts/phone-routing.test.mjs
```
