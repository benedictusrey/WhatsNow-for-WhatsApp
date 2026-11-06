# Independent WhatsNow and TubeNow Audio Implementation Plan

> **Execution update — 2026-11-07:** The maintainer approved the WhatsNow side only. Owned session naming/icon/grouping is implemented and locally tested; TubeNow tasks are excluded. Live two-app mute persistence, mixer visuals, real calls, platform coverage, and whole-app RAM savings remain acceptance gates. See [implementation and evidence](../../IMPLEMENTATION_v2.6.3.md). No installation or publication was performed.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not publish or replace installed apps without the maintainer's direction. The original two-app checklist below is historical scope, not authorization to edit TubeNow.

**Goal:** Give WhatsNow and TubeNow independently identifiable and independently controllable Windows audio, while reducing measured memory waste without interrupting WhatsNow media or calls.

**Architecture:** Retain WebView2 as the renderer, but manage app-owned audio-session identity through supported Windows Core Audio APIs. Use WebView2 controller-local mute for TubeNow's automatic background policy instead of changing persistent Windows session mute. Prove functional isolation, not just different mixer labels, before accepting the approach.

**Tech Stack:** Existing Rust, Tauri v2, WebView2 COM bindings, Windows Core Audio/WASAPI, and existing JavaScript/browser regression tooling. No kernel driver, virtual audio device, external audio server, or new shared framework.

**Spec:** The requirements and acceptance criteria below capture the maintainer's request to stop WhatsNow and TubeNow audio controls colliding. Created and maintained by [@benedictusrey](https://github.com/benedictusrey). WhatsNow project: [WhatsNow-for-WhatsApp](https://github.com/benedictusrey/WhatsNow-for-WhatsApp).

## Requirements and evidence

- Windows should identify WhatsNow and TubeNow separately, rather than present an ambiguous shared WebView2 control.
- Muting, hiding, minimizing, restoring, or exiting TubeNow must not mute, unmute, pause, or change WhatsNow's volume. The reverse must also hold.
- Respect manual mute/volume, including Windows mixer actions. Do not repeatedly force either app unmuted.
- WhatsNow media/calls continue while minimized, tray-hidden, or App Locked, subject to manual and OS controls.
- Preserve themes/doodles, notification delivery/click routing, account isolation, native call opener/geometry, camera framing, and attachment behavior.
- Current installed executables report WhatsNow 2.6.3 and TubeNow 1.1.2. Their observed WebView2 process trees are separate.
- TubeNow's source calls Core Audio `SetMute` on sessions selected by its own descendant PIDs when hidden. It also clears persisted mute during visible/startup transitions. That source is not indiscriminately matching every WebView2 process by filename.
- The screenshot shows a muted WebView2 mixer entry. It does not prove which process owns it, who muted it, or whether the stream is truly shared.
- An [upstream WebView2 report](https://github.com/MicrosoftEdge/WebView2Feedback/issues/5667) describes cross-app inherited mute. It supports a hypothesis, not proof of this machine's exact cause.
- Read-only Core Audio diagnostic attempts were blocked by COM activation/enumeration errors (`0x80040154`; the PowerShell prototype also reported `Not implemented`). No live session mute/group identity was established. Do not infer a broken Windows driver from a diagnostic-host failure.

## Global constraints

- Planning only until review. No Windows audio resets, registry policy deletion, unmute actions, process termination, installed-app replacement, commits, tags, or publication.
- Keep WhatsNow at 2.6.3 during this investigation; do not invent a new release version.
- Keep WhatsNow's existing `app.whatsnow.desktop` notification identity unchanged.
- Never select audio sessions by `msedgewebview2.exe` name alone. Reject unknown or cross-process ownership for writes.
- Use existing `windows` dependency features. Target-gate Windows code; Linux/macOS retain current behavior.
- Read each repository's complete `AGENTS.md` before implementing there. TubeNow changes need its own live reproduction and regression checks.
- No driver/runtime executable rename, duplicated fixed runtime, undocumented audio flags, capture/loopback rerouting, or page-wide autoplay/visibility spoof.
- Naming a session and assigning a mixer group do not prove persistent volume isolation. Cold-start and modern/classic mixer behavior are release gates.

## Review focus

1. A session appears late or the output device changes: identity must be applied to the new owned session without changing its mute/volume.
2. A process exits and its PID is reused: do not claim the replacement process or write to its audio session.
3. A session reports multi-process ownership (`AUDCLNT_S_NO_SINGLE_PROCESS`): do not assume one returned PID proves exclusive ownership.
4. A user mutes either app in Windows: preserve that choice through minimize, restore, device changes, and relaunch.
5. Windows applies persisted executable-level policy despite distinct labels/groups: fail isolation acceptance rather than ship a cosmetic fix.

## Task 1: Establish a read-only two-app baseline

**Files:** Extend the ignored `.workspace/audio-audit/` diagnostic first; retain evidence in `.workspace/release-v2.6.3/`. No product source changes.

**Interfaces:** Diagnostic output records timestamp, endpoint, session/instance identifiers, grouping GUID, reported owner PID, process ancestry/creation times, state, mute, and volume. It never calls a setter.

- [ ] Run the typed diagnostic in the interactive user's desktop/MTA context. Record the exact failing API if the current COM limitation persists; do not repair Windows to make the test pass.
- [ ] Start a user-selected voice note/video in WhatsNow and media in TubeNow. Read metadata only; do not record conversations or audio content.
- [ ] Capture idle, playing, TubeNow minimized/restored, WhatsNow minimized/restored, and both running. Any operation that changes playback/mute is a maintainer-coordinated test.
- [ ] Compare PIDs, session identities, and group GUIDs. Distinguish separate sessions with shared persisted policy from a genuinely shared session.
- [ ] Save an evidence summary. Gate: actual ownership/state can be read and a repeatable collision is observed, or implementation remains blocked with the exact limitation stated.

## Task 2: Remove TubeNow's automatic persistent-mute side effect

**Files:** TubeNow `src-tauri/src/audio.rs`, `src-tauri/src/lib.rs` (`pause_media_for_hidden`, `resume_media_for_visible`, `watch_main_window`), `src-tauri/src/tray.rs` (manual mute); existing TubeNow behavioral harness plus a new native two-webview mute test.

**Interfaces:** Replace the process-session mutator at these call sites with `set_owned_webviews_muted(app: &tauri::AppHandle, muted: bool) -> Result<(), String>`. Maintain TubeNow's existing manual-mute/background-play preferences; derive the effective mute from those preferences and actual visibility, never from another application's state.

- [ ] Add a failing test: two separate app processes play synthetic audio; toggling TubeNow background/manual mute affects only TubeNow's controller, not the other app's controller or Core Audio mute/volume.
- [ ] Capture current startup/minimize behavior before changing it, as TubeNow's guardrails require.
- [ ] Use `ICoreWebView2_8::SetIsMuted` via each owned window's `with_webview` callback. Never force an HTML media element to play or override its volume.
- [ ] Remove the corresponding automatic Core Audio `SetMute` calls and startup unmute retry loop. Preserve page-level pause/resume bookkeeping and the user's explicit background-play preference.
- [ ] Test late-created windows, hide/restore, explicit manual mute, background play on/off, and ten state cycles. The other process's mute/volume must remain unchanged.
- [ ] Run TubeNow's complete existing harness/static checks and the live reproduction before proposing a focused commit. Do not migrate unrelated audio/call/UI code.

## Task 3: Give each app an owned, named mixer group

**Files:** WhatsNow: create `src-tauri/src/audio_identity.rs`; integrate lifetime ownership in `src-tauri/src/lib.rs`; enable only needed Windows features in `src-tauri/Cargo.toml`. TubeNow: extend its existing `src-tauri/src/audio.rs` and startup/shutdown integration, not a new shared framework. Add native isolation tests under WhatsNow `src-tauri/examples/`.

**Interfaces:** Each app owns an `AudioSessionIdentityGuard` with `start(app: &tauri::AppHandle) -> Result<Self, String>` and deterministic shutdown. Its only allowed session writes are display name, icon, and grouping. No mute/volume writes. Use fixed app-specific GUID constants, distinct between apps, without changing notification AUMIDs.

- [ ] Add failing ownership tests for unrelated WebView2 PIDs, missing parent links, PID reuse, cycles, expired processes, and a cross-process session result. Ambiguous ownership must cause no write.
- [ ] Validate ancestry using process creation times and an owned browser/renderer tree, not a cached filename match. Close process snapshot handles and balance every successful COM initialization, including `S_FALSE`; never uninitialize a borrowed STA apartment.
- [ ] For verified owned sessions, set display name `WhatsNow` or `TubeNow`, the respective existing app icon, and that app's fixed grouping GUID using documented Core Audio APIs.
- [ ] Register session/device notifications before initial enumeration. Callbacks enqueue a bounded refresh on a dedicated COM worker; no COM work or sleeps on the UI thread, no permanent rapid scan loop.
- [ ] Handle late sessions, endpoint changes, service restarts, and shutdown. Release notification registrations, session references, and worker resources deterministically. An unavailable API logs failure without blocking playback/startup.
- [ ] Test modern Windows Settings and classic Sndvol. Independently mute/adjust both sliders, relaunch in both orders, and repeat with one app previously muted. Verify native mute/volume state, not labels alone.
- [ ] Gate: cross-app mute/volume isolation must hold, including cold starts. `SetGroupingParam` is documented to group slider controls; it is not a promise of independent persisted policy. See [Microsoft grouping documentation](https://learn.microsoft.com/en-us/windows/win32/api/audiopolicy/nf-audiopolicy-iaudiosessioncontrol-setgroupingparam).

If the gate fails, stop. Do not ship a rename as isolation or add competing unmute watchdogs. A truly host-owned WASAPI playback path requires a separate prototype/spec and explicit approval: capture/PCM bridging may add latency, duplicate sound, lose WebRTC routing, break echo cancellation or protected media, and consume more CPU/RAM. Do not silently apply it to production calls.

## Task 4: Measure memory and fix demonstrated waste separately

**Files:** Extend `.workspace/` measurements first. Only modify the specific owner of demonstrated waste; possible review points are WhatsNow `window.rs` popup/settings/attachment lifetimes, existing background-media policy, and bounded observer/cache lifetimes. Do not pre-authorize a broad refactor.

- [ ] Record five comparable runs per workload: one idle account, video playing, two-party call, minimized idle, and a secondary account. Compare medians and steady-state/peak values for the complete process tree.
- [ ] Record working set and private committed bytes separately. A summed working set can double-count shared pages; neither metric is a universal RAM benchmark. The observed active snapshots (~1538 MB summed working set for WhatsNow; ~1211 MB for TubeNow) used different workloads and are not comparative performance results.
- [ ] Check for stale transfer buffers, closed-window references, unbounded caches, leaked snapshots/COM registrations, and unnecessary duplicate observers. Fix a demonstrated issue only with a regression test and an identical before/after workload.
- [ ] Keep NORMAL for WhatsNow calls, active media, and uncertain state. Do not restore blanket LOW-on-minimize, suspend account webviews, terminate WebView2 subprocesses, purge sessions, or trim working sets merely to lower Task Manager numbers.
- [ ] Preserve the pre-created popup's freeze-prevention contract. Removing it to save RAM is not accepted without a separate safe popup-creation design and live regression proof.
- [ ] Gate: measured reduction without delayed incoming messages, broken calls/audio, repeated reloads, or higher steady-state CPU. If no safe measurable reduction is found, report that; do not manufacture a memory win.

## Task 5: Integration acceptance and packaging

**Files:** Update WhatsNow `docs/IMPLEMENTATION_v2.6.3.md`, `CHANGELOG.md`, `RELEASE_NOTES.md`, and relevant Windows support notes after actual validation. Keep the two apps' releases separate.

- [ ] Run all WhatsNow Rust/default/Windows-feature tests, strict Clippy, fmt, eleven existing JavaScript/browser suites, native popup/media tests, and documentation integrity checks. Run TubeNow's own full gates separately.
- [ ] On Windows 10 and 11, test simultaneous WhatsNow calls/voice notes/video and TubeNow media, with both launch orders, minimize/tray/App Lock cycles, manual mute, independent volumes, and speaker/headphone switches.
- [ ] Hold each relevant media state for at least two minutes. Use a real second device for call continuity and echo-cancellation checks; synthetic audio alone cannot establish this.
- [ ] Test explicit Quit, account isolation, notifications/toast navigation, attachments, phone links, and every locked theme/doodle behavior.
- [ ] Rebuild setup/MSI/portable candidates from frozen source; verify versions and SHA-256. Do not replace installed apps or publish until live acceptance is confirmed.

## Planning handoff

No application behavior, Windows volume/mute setting, audio driver, or installed binary was changed during this investigation. Only ignored diagnostic files and this plan were added. No new build was produced from the plan.

Implementation order: establish ownership evidence; fix TubeNow's automatic OS-mute boundary; prove per-app mixer grouping; then measure memory improvements. Review this plan before execution. The native approach is preferred; an independent review can follow implementation without introducing a permanent audio service or shared driver.
