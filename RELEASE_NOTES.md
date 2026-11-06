# WhatsNow 2.6.3 — background audio improvements

This update favors reliable background sound over aggressive memory reclamation.

## Improvements

- Identify owned Windows audio sessions as WhatsNow with the existing app icon
  and app-specific mixer grouping, while preserving user mute and volume.

- Keep Windows account and call webviews at normal memory priority when minimized
  or hidden to tray, including behind App Lock.
- Preserve manual pause, mute, volume, hang-up, and Quit behavior.
- Retain existing themes, native notifications, account isolation, and call-window repairs.

Background RAM may increase. App Lock hides content but does not silence ongoing
audio. OS mute, permissions, sleep, and WhatsApp's own media behavior still apply.

Native Windows audio/video lifecycle, audio-session identity, and call-window
tests passed. Extended WhatsApp playback, real two-party calls on this update,
and independent mute persistence alongside other WebView2 apps remain unverified.
This update does not replace WebView2 or install an audio driver.

## Installation and compatibility

Fully quit WhatsNow from the tray before upgrading. Verify your download against `checksums.sha256`.

Packages cover Windows x64, Linux x64, and macOS Apple Silicon/Intel. Windows
builds are unsigned; macOS builds are not Developer ID signed or notarized.
Calling depends on WhatsApp Web availability, account eligibility, permissions,
hardware, and the platform runtime. Linux/macOS calling and live media behavior
have not been validated. The recipient's phone controls its display crop.

Created and maintained by [@benedictusrey](https://github.com/benedictusrey).

[Implementation and acceptance checklist](docs/IMPLEMENTATION_v2.6.3.md)
