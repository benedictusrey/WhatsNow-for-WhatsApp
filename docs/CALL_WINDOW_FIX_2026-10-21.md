# WhatsNow call-window repair

2026-10-21. Maintained by [@benedictusrey](https://github.com/benedictusrey).

## Report and scope

The supplied screenshot shows an empty call window above WhatsApp's
"Allow pop-ups" prompt. The user also requested full camera framing for a
recipient on a phone and chose to preserve the full view rather than crop it.

This repair covers call popup handoff, native window sizing, and a camera
capture preference. It does not change theme palettes, doodle rules, toast
delivery, account storage, or phone-link routing. It does not replace the
published v2.6.1 release or modify the currently installed application.

## Findings

1. `bridge.js` opened WhatsApp-family URLs through the captured native
   `window.open`, then returned `null`. For calls, that tells WhatsApp that
   the browser blocked the popup and discards the handle it needs for
   child-window communication. A behavioral regression failed nine assertions
   before the repair and passes after it.
2. The native call builder navigated to the destination before returning it
   through `NewWindowResponse::Create`. Tauri's documented popup example starts
   at `about:blank`; WebView2 must attach the new child to the pending opener
   request before navigating it. The replacement follows that pattern and
   retains the existing opener environment/configuration on each platform.
3. The native maximize/resize flags already existed. Those flags alone did
   not test whether the calling page loaded or connected to its opener.

Reference: the installed Tauri 2.11.2 `WebviewWindowBuilder::on_new_window`
example and Wry 0.55.1 WebView2 new-window handler. Wry obtains a deferral and
dispatches the app callback before assigning `SetNewWindow`. This repair
retains that engine-managed lifecycle; it does not recreate a call by
navigating a disconnected content window or fabricate a success handle.

## Implementation

- Calls to HTTPS `call.whatsapp.com` and `web.whatsapp.com/call[/...]` return
  the native WindowProxy and preserve the caller's target and feature string.
  Other family links and external-browser behavior retain their existing paths.
- `src-tauri/src/call_window.rs` supplies a shared blank child builder with
  native decorations, resize/maximize/minimize controls, and no maximum-size
  constraint. Production code retains monitor/DPI fitting and session sharing.
- A call-stage initialization script requests `resizeMode: { ideal: "none" }`
  when the camera API supports it. It retains device, resolution, frame-rate,
  and audio choices and does not mutate the original constraints object.
  It does not acquire media during initialization, retry failed acquisitions,
  touch chat attachments, or wrap `getDisplayMedia`.
- The native fixture uses its own temporary WebView2 profile and a loopback
  HTML fixture. It does not load WhatsApp, access an account, acquire media,
  register protocols, or send a call. Cargo example link flags enable Windows
  Common Controls v6 without changing the main release application's manifest.

## Camera framing limits

The ideal `none` preference asks the browser to preserve a native camera
frame rather than crop-and-scale it. A camera can use its supported fallback.
WhatsApp can apply later track constraints and the recipient's phone controls
its own fit/fill presentation. This preference cannot guarantee an uncropped
remote display. No CSS change to the desktop preview can force a phone layout.
We have not verified the result during a real two-party call.

## Verification

- 111 Windows Rust library tests pass with `windows-memory`.
- Strict Clippy passes with `--all-targets -- -D warnings`.
- Bridge regressions pass, including the new real-return-value cases.
- `scripts/call-popup.test.mjs` passes in Chromium: real popup reference,
  named target, opener message handshake, and closed-state lifecycle. A
  synthetic camera track reports `resizeMode: none`; no physical camera or
  microphone was activated.
- `cargo run --locked --example call-window-smoke` passes on this Windows
  machine: child navigation, opener handshake, native maximize, restore, and
  client-area resize. The fixture uses the production call builder.
- Camera preference, theme, toast-route, hotkey, Settings ACL, phone routing,
  Settings contrast, and attribution tests pass.

The first native fixture launch failed before startup with
`STATUS_ENTRYPOINT_NOT_FOUND`. The example lacked Common Controls v6 manifest
activation for `TaskDialogIndirect`. Example-only linker flags resolved that
test-harness defect; it was not evidence of a WhatsApp call failure.
The passing fixture emitted a Chromium class-unregistration warning at process
shutdown after its checks completed. A real-call runtime test remains separate.

Commands, from the repository root:

```powershell
node src-tauri/resources/bridge.test.mjs
node src-tauri/resources/call-media.test.mjs
node scripts/call-popup.test.mjs
cargo test --locked --manifest-path src-tauri/Cargo.toml --features windows-memory --lib
cargo clippy --locked --manifest-path src-tauri/Cargo.toml --features windows-memory --all-targets -- -D warnings
cargo run --locked --manifest-path src-tauri/Cargo.toml --example call-window-smoke
```

## Candidate and live acceptance

Windows candidate output: `dist/call-fix-20261021/` (local-only, unsigned).
Setup, MSI, and portable builds completed. All three checksum entries match
their packages; executable FileVersion and MSI ProductVersion are `2.6.1`.

```text
87c85de0744ee14e50337e330458dc1cc8cdb4dd54803a9fd9383e69ae6c72d5  WhatsNow_2.6.1_windows_x64-setup.exe
f7b510efbd65fc82841f6a4648120d4764ef9da7b1d7de3fed0b39f413619d52  WhatsNow_2.6.1_windows_x64_en-US.msi
cb8bcaaf2726479f0cc6f4320203777999f7671f10e5f498c0d031bca1b028a2  WhatsNow_2.6.1_windows_x64-portable.exe
```

Use its installer or MSI after quitting WhatsNow from the tray. Do not run
an installer while a call or unsent work is active. A running old process does
not adopt the new code. The candidate retains 2.6.1 metadata; it is not a
replacement for the public release assets or a new published version.

Before a follow-up public release, complete a real two-party call on the
candidate: confirm no blocked-popup prompt, visible call controls, maximize,
restore, resizing during video/audio, camera switching, screen sharing, and
the full-frame result on the receiving phone. Native fixture and browser
tests do not establish service-level calling reliability. Linux/macOS native
runtime validation also remains outstanding.

## Follow-up: 2.6.2 test rebuild

The user requested a versioned candidate before the real-call test. The source
version is now 2.6.2 in VERSION, Cargo, the lockfile, and Tauri configuration.
Settings cache tags and version-display tests follow that version. The Windows
packaging script derives filenames from the configured version.

The new local package set is under `dist/v2.6.2-candidate/`; the earlier
`dist/call-fix-20261021/` files and hashes above remain historical evidence.
The published 2.6.1 release and installed app have not been replaced. Live
two-party call acceptance was pending at that build checkpoint.

## Maintainer confirmation

After the 2.6.2 handoff, the maintainer reported: "It's working very well now!"
The installed executable reports 2.6.2. This is maintainer-reported Windows
calling success, not independent observation of every call/media option.
See [the 2.6.2 implementation record](IMPLEMENTATION_v2.6.2.md) for current
validation scope and release preparation; the earlier pending statements above
describe the investigation's historical checkpoints.
