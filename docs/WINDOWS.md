# WhatsNow builds for Windows

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

WhatsNow 2.6.3 is a reliability-first update. Its Windows packages are:

- `WhatsNow_2.6.3_windows_x64-setup.exe` — installer
- `WhatsNow_2.6.3_windows_x64_en-US.msi` — MSI package (managed deployment)
- `WhatsNow_2.6.3_windows_x64-portable.exe` — portable application

All carry the same background-media policy; they differ only in how they
are installed. The naming is universal (`windows`, not `windows10`) — the
build is intended for any 64-bit Windows 10 or Windows 11 system.

## Background media policy

WebView2 keeps NORMAL memory priority while visible, unfocused, minimized,
tray-hidden, or hidden behind App Lock. Secondary accounts use the same policy.
This removes the older LOW-memory hint; it does not force autoplay or unmute.
Manual pause, mute, volume, hang-up, Quit, and OS restrictions remain in force.
App Lock conceals content but intentionally leaves ongoing media audible.
Background RAM may increase. Extended live WhatsApp media/call checks remain unverified;
see [implementation and acceptance](IMPLEMENTATION_v2.6.3.md).

WebView2 still uses separate browser,
renderer, GPU, and utility processes by design, and Task Manager can continue
to show several `msedgewebview2.exe` entries. Compare total memory after
leaving WhatsNow in the background for a few minutes rather than comparing
process count alone.

The build does not use Chromium single-process flags, renderer-process
limits, or WebView suspension. Those approaches can weaken process isolation,
cause instability, or pause the background scripts that WhatsNow needs.

## Installation

Installer:

1. Download `WhatsNow_2.6.3_windows_x64-setup.exe` from the official release.
2. Verify its SHA-256 value against the release's `checksums.sha256`.
3. Run the installer and launch WhatsNow normally.

Portable:

1. Download `WhatsNow_2.6.3_windows_x64-portable.exe` from the official release.
2. Keep it in a writable folder, such as `Documents\WhatsNow Portable`.
3. Run it directly. Do not place it in `Program Files`.

Keep Microsoft Edge WebView2 Runtime updated through Windows Update or
Microsoft Edge Update. WhatsNow uses the installed Evergreen runtime and
gracefully falls back to standard behavior if an outdated runtime does not
expose the supported memory-target API.

## Building

The source builds this variant with the `windows-memory` Cargo
feature (see `scripts/build-windows.ps1`). The portable variant additionally
uses `portable-mode`. The output lands in `dist/windows/` with the
`WhatsNow_2.6.3_windows_x64-*` names and `checksums-windows.sha256`.
