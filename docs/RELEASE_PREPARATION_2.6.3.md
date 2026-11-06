# WhatsNow v2.6.3 release record

2026-11-07 · Maintained by [@benedictusrey](https://github.com/benedictusrey).

## Scope

Windows background media retains NORMAL memory priority. Scoped native session
metadata identifies owned WhatsNow audio without changing mute or volume.
Linux/macOS media behavior is unchanged. Existing themes, toasts, account
isolation, file drops, phone routing, and native call-popup behavior are retained.

The public source and current installation, security, feature, and publishing
guides are updated together. Historical implementation records remain intact.

## Verification before the release build

- 114 Windows/portable Rust tests pass; strict all-target Clippy and rustfmt pass.
- Eleven JavaScript/browser suites and documentation integrity checks pass.
- Native media, session identity, notification-only identity discovery, and call
  popup geometry fixtures passed during implementation. See the detailed
  [implementation record](IMPLEMENTATION_v2.6.3.md) for evidence and limits.
- Local Windows candidates have matching version metadata and verified SHA-256
  manifests. They are not the cloud-built release assets.
- Release review restricted the Windows audio-identity module to Windows and
  test builds, avoiding unused platform-only helpers in Linux/macOS builds.

## Publication gate

Build all packages from one frozen commit using the release workflow. Verify
the separate platform check workflow, the draft's tag/commit, all nine packages,
and downloaded hashes before publication. The final run and commit are visible
in GitHub Actions and the [v2.6.3 release](https://github.com/benedictusrey/WhatsNow-for-WhatsApp/releases/tag/v2.6.3).
Local build/download verification evidence stays in the ignored workspace.

## Disclosed limits

Extended real WhatsApp playback/calls on this revision, Windows 10, Linux/macOS
installed-app media behavior, and independent cross-app persisted mute remain
unverified. Native synthetic tests are not substitutes for these checks.
Background RAM may increase. OS/user mute, permissions, and sleep remain in force.
App Lock hides content but intentionally leaves ongoing sound audible.

Windows packages are unsigned. macOS packages are not Developer ID signed or
notarized. No antivirus certification, zero-regression guarantee, fixed RAM
usage, or unconditional calling/audio guarantee is claimed.
