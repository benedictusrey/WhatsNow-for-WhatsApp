# WhatsNow builds for Windows

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

WhatsNow 2.7.0 ships one Windows installer on GitHub:

- `WhatsNow_2.7.0_windows_x64-setup.exe` — installer

The naming is universal (`windows`, not `windows10`) — the build is intended for
any 64-bit Windows 10 or Windows 11 system. An MSI and a portable executable can
still be built locally (see Building); they are not attached to releases.

## Background media policy

WebView2 keeps NORMAL memory priority while visible, unfocused, minimized,
tray-hidden, or hidden behind App Lock. Secondary accounts use the same policy.
This removes the older LOW-memory hint; it does not force autoplay or unmute.
Manual pause, mute, volume, hang-up, Quit, and OS restrictions remain in force.
App Lock conceals content but intentionally leaves ongoing media audible.
Background RAM may increase. Extended live WhatsApp media/call checks remain unverified;
see [implementation and acceptance](IMPLEMENTATION_v2.6.3.md) and the
[2.7.0 record](IMPLEMENTATION_v2.7.0.md).

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

1. Download `WhatsNow_2.7.0_windows_x64-setup.exe` from the official release.
2. Verify its SHA-256 value against the release's `checksums.sha256`.
3. Run the installer and launch WhatsNow normally.

Portable (locally built only):

1. Build it with `scripts/build-windows.ps1` (see Building).
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
`WhatsNow_2.7.0_windows_x64-*` names (setup, MSI, portable) and
`checksums-windows.sha256`.
