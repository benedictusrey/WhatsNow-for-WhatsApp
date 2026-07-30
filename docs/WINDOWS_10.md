# WhatsNow for Windows 10

WhatsNow 1.0.0 includes a separate Windows 10 memory-conscious build:

- `WhatsNow_1.0.0_windows10_x64-setup.exe` — installer
- `WhatsNow_1.0.0_windows10_x64-portable.exe` — portable application

Use the standard `WhatsNow_1.0.0_x64-setup.exe` on Windows 11. That existing
installer is unchanged.

## What the Windows 10 build changes

When WhatsNow is active, WebView2 uses its normal memory target so the chat stays
responsive. When WhatsNow is unfocused, minimized, or in the system tray, it
requests WebView2's supported low-memory target. Scripts and network connections
continue running, so background messages and native notifications remain active.

The optimization is best-effort. WebView2 still uses separate browser, renderer,
GPU, and utility processes by design, and Task Manager can continue to show
several `msedgewebview2.exe` entries. Compare total memory after leaving WhatsNow
in the background for a few minutes rather than comparing process count alone.

The build does not use Chromium single-process flags, renderer-process limits,
or WebView suspension. Those approaches can weaken process isolation, cause
instability, or pause the background scripts that WhatsNow needs.

## Installation

Installer:

1. Download `WhatsNow_1.0.0_windows10_x64-setup.exe`.
2. Verify its SHA-256 value against `checksums-windows10.sha256`.
3. Run the installer and launch WhatsNow normally.

Portable:

1. Download `WhatsNow_1.0.0_windows10_x64-portable.exe`.
2. Keep it in a writable folder, such as `Documents\WhatsNow Portable`.
3. Run it directly. Do not place it in `Program Files`.

Keep Microsoft Edge WebView2 Runtime updated through Windows Update or Microsoft
Edge Update. WhatsNow uses the installed Evergreen runtime and gracefully falls
back to standard behavior if an outdated runtime does not expose the supported
memory-target API.

