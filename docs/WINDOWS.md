# WhatsNow memory-conscious builds for Windows

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

WhatsNow 2.5.0 ships a Windows build that requests WebView2's supported
low-memory target while the app is backgrounded:

- `WhatsNow_2.5.0_windows_x64-setup.exe` — installer
- `WhatsNow_2.5.0_windows_x64_en-US.msi` — MSI package (managed deployment)
- `WhatsNow_2.5.0_windows_x64-portable.exe` — portable application

Both carry the same memory-conscious behavior; they differ only in how they
are installed. The naming is universal (`windows`, not `windows10`) — the
build is intended for any 64-bit Windows 10 or Windows 11 system.

## What the memory-conscious build changes

When WhatsNow is active, WebView2 uses its normal memory target so the chat
stays responsive. When WhatsNow is unfocused, minimized, or in the system
tray, it requests WebView2's supported low-memory target. Scripts and network
connections continue running, so background messages and native notifications
remain active.

The optimization is best-effort. WebView2 still uses separate browser,
renderer, GPU, and utility processes by design, and Task Manager can continue
to show several `msedgewebview2.exe` entries. Compare total memory after
leaving WhatsNow in the background for a few minutes rather than comparing
process count alone.

The build does not use Chromium single-process flags, renderer-process
limits, or WebView suspension. Those approaches can weaken process isolation,
cause instability, or pause the background scripts that WhatsNow needs.

## Installation

Installer:

1. Download `WhatsNow_2.5.0_windows_x64-setup.exe`.
2. Verify its SHA-256 value against `checksums-windows.sha256`.
3. Run the installer and launch WhatsNow normally.

Portable:

1. Download `WhatsNow_2.5.0_windows_x64-portable.exe`.
2. Keep it in a writable folder, such as `Documents\WhatsNow Portable`.
3. Run it directly. Do not place it in `Program Files`.

Keep Microsoft Edge WebView2 Runtime updated through Windows Update or
Microsoft Edge Update. WhatsNow uses the installed Evergreen runtime and
gracefully falls back to standard behavior if an outdated runtime does not
expose the supported memory-target API.

## Building

The private source builds this variant with the `windows-memory` Cargo
feature (see `scripts/build-windows.ps1`). The portable variant additionally
uses `portable-mode`. The output lands in `dist/windows/` with the
`WhatsNow_2.5.0_windows_x64-*` names and `checksums-windows.sha256`.
