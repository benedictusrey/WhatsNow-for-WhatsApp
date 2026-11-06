# WhatsNow 2.6.3 — background media reliability

2026-11-06 · Created and maintained by [@benedictusrey](https://github.com/benedictusrey).
Official project: [WhatsNow](https://github.com/benedictusrey/WhatsNow-for-WhatsApp).

## Approved policy and scope

### WhatsNow-only audio identity update — 2026-11-07

The maintainer approved implementation for WhatsNow only. TubeNow, Windows
drivers, system-wide mixer policy, and installed binaries remain outside this change.

Windows sessions owned by WhatsNow receive the `WhatsNow` display name, existing
executable icon, and app-specific grouping GUID. The identity worker never calls
mute or volume setters and never overrides a user's manual sound controls.
This is native session identification/grouping, not a new audio driver or PCM
rerouting layer. WebView2 remains the media engine underneath.

Ownership comes from the process list of a trusted WhatsNow WebView2 environment.
Process birth times reject replacements during membership capture; a retained
query handle prevents PID recycling while metadata is written. Only active,
single-process sessions with matching current membership are eligible. Unknown,
unrelated, expired, or multi-process sessions are not renamed or regrouped.

The dedicated COM worker uses device/session notifications, a 32-item channel,
and a 64-session pending limit. Exact session notifications are marshalled through
the standard Windows Global Interface Table, rather than relying exclusively on
enumeration. Owned inactive notifications remain eligible for later playback;
unidentified notifications have a five-second discovery grace. Normal fallback
refresh is 30 seconds, with short retries only during initial discovery.
One unavailable endpoint or disconnected session does not block others.
Quit waits at most 100 ms for this worker; an outstanding native RPC can finish
cleanup on its detached thread without indefinitely blocking the UI.

References: [WebView2 process information](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-model),
[Windows mixer grouping](https://learn.microsoft.com/en-us/windows/win32/api/audiopolicy/nf-audiopolicy-iaudiosessioncontrol-setgroupingparam),
[standard thread-safe Global Interface Table](https://learn.microsoft.com/en-us/windows/win32/com/creating-the-global-interface-table).

The user-coordinated live snapshot identified the installed WhatsNow audio
process beneath its browser process. At that moment it was active, unmuted,
and at volume 1.0. Another output endpoint returned `0x80040154`; skipping that
endpoint allowed the real WhatsNow session to be read. This was not evidence
that all Core Audio access was blocked, or that the audio driver required repair.

The implementation does not yet establish independent cold-start mute policy
across WhatsNow and TubeNow. Different names/groups are not sufficient proof.
Windows may persist runtime-executable audio policy; that acceptance test still
requires both applications and manual mixer checks. No automatic unmute was added.

### Memory scope

No audio samples, video frames, or additional webviews are buffered by the identity
worker. Process discovery is limited to owned environment members, avoiding the
initial implementation's repeated all-process scans. Handles, COM registrations,
and queued marshaling cookies have explicit cleanup; queues are bounded.
Existing attachment chunks already release their references after File construction.
No comparable five-run live workload benchmark demonstrated a reduction in total
WhatsNow RAM, so no overall RAM-saving claim is made. NORMAL media priority remains.

The detailed plan and remaining acceptance checks are in
[the isolation plan](superpowers/plans/2026-11-06-independent-audio-and-memory.md).

### Audio identity validation — 2026-11-07

- Four authority/retention/shutdown policy tests pass; the full Windows/portable
  Rust suite has 114 passing tests. Default-feature tests, strict Clippy, fmt,
  eleven existing JavaScript/browser suites, and documentation checks pass.
- The native metadata contract failed before integration, then passed with
  the owned WebView2 session's name, icon, and group verified. Surviving unrelated
  session instances retained their original metadata, mute, and volume.
- A second debug-only test disables enumeration-based identification and still
  passes through actual COM-marshalled notifications. This proves the notification
  path, not just a timer rediscovering the same session.
- Native synthetic audio/video continued through six eight-second window states;
  manual page pause/mute remained effective. Native call-popup creation with the
  registrar attached preserved opener handoff, maximize, restore, and resize.
- Review-driven corrections replaced ancestry guesses with environment membership,
  rejected PID-lifetime races, retained notification-only sessions, isolated
  individual lookup failures, and bounded Quit's worker wait. The native inspector
  uses session instance IDs instead of PID/endpoint cross-products.
- The existing WebView2 cleanup warning 1412 is retained in local logs. It did not
  fail the media or popup assertions. Real two-party calls, Windows 10,
  speaker/headphone switching, both mixer UIs, and two-app cold-start mute policy
  remain unverified. No audio-content capture or hardware microphone/camera test
  was performed by these fixtures.
- Updated Windows setup, MSI, and portable packages built locally after review
  corrections. PE string versions and MSI ProductVersion are 2.6.3; all final
  SHA-256 manifest entries verified. They are unsigned test candidates, not
  installed or published artifacts.

Reproduce the native identity check after compiling the two debug examples:

```powershell
cargo build --locked --manifest-path src-tauri/Cargo.toml --example audio-session-inspect --example background-media-smoke --features windows-memory
./scripts/audio-identity-smoke.ps1 -TargetDirectory src-tauri/target
./scripts/audio-identity-smoke.ps1 -TargetDirectory src-tauri/target -NotificationsOnly
```

Use the configured Cargo target directory instead when `CARGO_TARGET_DIR` is set.
The diagnostic scans audio metadata only; the fixture emits a quiet synthetic tone.
`-NotificationsOnly` is a debug-fixture mode and is compiled out of release behavior.

Reliability takes priority over background RAM reduction. All Windows account,
call, and reusable content webviews retain NORMAL memory priority, including
secondary accounts, minimized windows, tray-hidden windows, and App Lock.
There is no new setting, visibility spoof, automatic playback, or forced unmute.
Manual pause/mute/volume, hang-up, Quit, OS mute/permissions, and sleep remain authoritative.
App Lock hides protected content and retains its IPC checks; it does not silence
media. Audio can therefore remain audible while the UI is locked.

## Change and rationale

The previous `windows-memory` implementation switched hidden/minimized webviews
to LOW. The shared registration helper now applies NORMAL without registering
focus/resize listeners. Account restore reasserts the same policy. Existing
account, call child, deferred popup, and pre-created popup call sites are retained.
The feature name remains for build compatibility; it no longer requests LOW.
No theme, doodle, notification, routing, camera constraint, or call-opener code changes.

WebView2 documents LOW as a memory-reclamation hint that may swap browser-process
memory to disk. It is not a documented command to pause media. Removing LOW is
the approved reliability mitigation, not proof that LOW caused every reported pause.
Reference: [Microsoft MemoryUsageTargetLevel documentation](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2.memoryusagetargetlevel).
Older runtimes that lack the interface are logged and retain their default behavior.
No suspension, single-process flags, sandbox relaxation, or autoplay bypass is
added to production. Linux/macOS media policy remains unchanged.

## Repeatable native diagnostic

`src-tauri/examples/background-media-smoke.rs` uses the production NORMAL helper
with a temporary isolated profile and a localhost synthetic audio/video page.
It requires no WhatsApp session, camera, microphone, protocol, or tray plugin.
Its autoplay switch applies only to this test process. It emits a quiet tone.

```powershell
cd src-tauri
cargo run --locked --example background-media-smoke --features windows-memory
```

The fixture compares media timestamps and native `IsDocumentPlayingAudio` across
visible, minimized, hidden, restored, hidden, and restored states. Each state
dwells for eight seconds. It then checks that pause/mute survive hide/restore.
`--baseline-low` models the former LOW target and must fail the NORMAL policy
assertion. That failure alone is not reproduction of the user's sound pause.
The fixture does not exercise the actual App Lock authentication flow, hardware
output capture, a remote call, multiple logged-in accounts, or long-duration playback.

## Release acceptance — pending live checks

Use the same installed candidate for all checks. For each audio source, listen
for at least two minutes per state; do not infer sound continuity from animation.

| Check | Required result |
| --- | --- |
| Voice note, received video, outgoing/incoming two-party call | Continuous intended sound while unfocused, minimized, tray-hidden, and App Locked |
| Ten minimize/tray/restore cycles | No pause, silence, call disconnect, or displaced UI |
| Secondary account and simultaneous call | Same policy; no account/session crossover |
| Manual pause, mute, volume, hang-up | Remain in force across transitions |
| Explicit Quit | All WhatsNow media stops; unrelated apps remain untouched |
| OS mute, denied permission, sleep | Respected; no automatic override |
| Theme/doodles, toasts/click routing, attachments, phone links | Existing behavior retained |
| Windows 10 and 11; Linux/macOS | Record each platform separately; no inferred validation |

These checks remain the full live acceptance target. On 2026-11-07, the maintainer
requested release with the unverified checks disclosed rather than claimed as passed.
If sound still pauses,
record the source, account, state, runtime version, and time of failure. Inspect
WhatsApp/media/OS behavior next rather than adding broad autoplay or visibility hacks.

## Evidence and packaging

Local build/test logs are retained under `.workspace/release-v2.6.3/` (ignored by Git).
Windows candidates belong in `dist/v2.6.3-candidate/`, separate from 2.6.2 assets.
Version declarations, Settings cache tokens, and release workflow defaults use 2.6.3.
The GitHub workflow remains draft-only. No install, commit, tag, push, or publication
is implied by a local build. Final validation results are recorded below.

### Validation status — 2026-11-06

- Rust tests: 110 passed with `windows-memory,portable-mode`; 110 passed with default features.
- Test host: Windows 11 Home build 26300, installed WebView2 runtime 156.0.4314.58.
- Strict Clippy (`--all-targets`, Windows/portable features) and rustfmt checks passed.
- Eleven JavaScript/browser suites passed: bridge, camera media, chat themes,
  toast routing, Settings themes/ACL/hotkeys, trusted phone routing, popup handoff,
  Settings contrast, and attribution. Documentation integrity checks passed.
- Native candidate: six eight-second lifecycle states passed. Native memory
  priority remained NORMAL and WebView2 reported playing audio throughout.
  Audio/video timestamps advanced; manual pause/mute remained in force after restore.
  The fixture first seeds LOW, proving the production helper actively restores
  NORMAL rather than relying on the runtime's default.
- Baseline-policy diagnostic: failed as expected at minimized LOW priority
  (exit 1). Its synthetic audio still played. This reproduces the policy mismatch,
  **not** the user's WhatsApp sound interruption; cause remains unconfirmed.
- Existing native call fixture passed WindowProxy/opener handoff, maximize,
  restore, and resize. Both native fixtures emitted WebView2 teardown warning
  `Chrome_WidgetWin_0`, error 1412; no playback or handoff assertion failed.
- Windows NSIS, MSI, and portable candidates built. PE versions and MSI
  `ProductVersion` are 2.6.3; all three SHA-256 manifest entries verified.
  Packages are unsigned. They were not installed over the user's current app.
- No public release, tag, push, or installation performed. Published 2.6.2 assets
  remain unchanged. Linux/macOS build jobs retain the draft-only release flow;
  those builds and live runtime checks were not run locally.

Initial validation caught a stale Settings cache token; it was synchronized
before the successful full Rust test runs. The native fixture also needed
explicit exit-status propagation; the final baseline returned 1 and candidate 0.
One repeat failed because the native window was not minimized when checked;
the unchanged fixture passed on rerun. That transition-test failure remains
recorded in `native-media-state-race.log` and its stderr log, not treated as
proof of an audio fault or silently discarded. Its intermittent cause is unconfirmed.

Live WhatsApp voice notes/videos, two-party calls, actual App Lock, long-duration
playback, Windows 10/11 coverage, and secondary-account media remain acceptance gates.
Native synthetic checks cannot certify all WhatsApp service behavior or
guarantee uninterrupted audio under every OS condition.
