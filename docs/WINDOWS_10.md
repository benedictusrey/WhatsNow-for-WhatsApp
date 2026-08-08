# WhatsNow WebView2 efficiency on Windows 10

WhatsNow 2.0.0 uses one memory-conscious Windows implementation for Windows 10
and Windows 11. Use the same release packages on both systems:

- `WhatsNow_2.0.0_x64-setup.exe` — installer
- `WhatsNow_2.0.0_x64_en-US.msi` — MSI deployment package
- `WhatsNow_2.0.0_portable.exe` — portable application

## What v2.0.0 changes

The focused, visible account uses WebView2's normal memory target so active chat
remains responsive. Unfocused, minimized, tray-hidden, and secondary accounts
request WebView2's supported low-memory target. Background scripts, account
sessions, and native notifications remain active.

This is best-effort optimization. WebView2 still uses separate browser,
renderer, GPU, and utility processes by design, so Task Manager can continue to
show several `msedgewebview2.exe` entries. Compare the total process tree after
the same workload and idle period rather than comparing process count alone.

The build does not use Chromium single-process flags, renderer-process limits,
forced process termination, or WebView suspension. Those workarounds can weaken
process isolation, interrupt background notifications, or cause instability.

## Installation

Installer:

1. Download `WhatsNow_2.0.0_x64-setup.exe`.
2. Verify its SHA-256 value against the release checksum.
3. Run the installer and launch WhatsNow normally.

Portable:

1. Download `WhatsNow_2.0.0_portable.exe`.
2. Keep it in a writable folder, such as `Documents\WhatsNow Portable`.
3. Run it directly. Do not place the portable copy in `Program Files`.

Keep Microsoft Edge WebView2 Runtime updated through Windows Update or Microsoft
Edge Update. WhatsNow uses the installed Evergreen runtime and falls back to
standard behavior if an outdated runtime does not expose the supported memory
target API.

If memory remains high, close unused secondary accounts, update WebView2, and
attach only the content-free diagnostic log to a [support report](../SUPPORT.md).

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).
