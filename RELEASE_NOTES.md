# WhatsNow 2.6.2

Calling now works smoothly in the maintainer's Windows test. This update fixes the blank call window and false “Allow pop-ups” prompt.

## Improvements

- Open calls in a connected native window with resize, maximize, minimize, and restore controls.
- Prefer the full camera frame where supported, while preserving device selection, audio settings, and screen sharing.
- Keep existing themes, notifications, multi-account support, Focus, App Lock, and drag-and-drop behavior.
- Add native Windows and browser regression checks for popup handling and camera capture.

## Installation and compatibility

Fully quit WhatsNow from the tray before upgrading. Verify your download against `checksums.sha256`.

Windows builds are unsigned. Calling depends on WhatsApp Web availability, account eligibility, permissions, hardware, and the platform runtime. The recipient's phone controls its display crop. Successful Windows testing does not establish Linux/macOS calling support.

Created and maintained by [@benedictusrey](https://github.com/benedictusrey).

[Implementation and validation](https://github.com/benedictusrey/WhatsNow-for-WhatsApp/blob/v2.6.2/docs/IMPLEMENTATION_v2.6.2.md)
