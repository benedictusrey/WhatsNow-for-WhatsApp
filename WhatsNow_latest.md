# WhatsNow — current feature guide

_v2.6.1 prepared source baseline · 2026-10-17 · Created and maintained by Benedictus Reynaldo Hartanto ([@benedictusrey](https://github.com/benedictusrey))._

---

WhatsNow brings the official WhatsApp Web experience into a dedicated desktop
workspace, with account management, Focus tools, local App Lock, native alerts,
and personalized appearance. It is an independent project, not an official
WhatsApp or Meta product.

**“Latest” here means the current documented candidate**, not a guarantee that
v2.6.1 is already published or fully platform-validated. Download only assets
actually attached to the [official releases](https://github.com/benedictusrey/WhatsNow-for-WhatsApp/releases).
See [v2.6.1 changes](CHANGELOGS_v2.6.1.md) and [release status](docs/RELEASE_PREPARATION_2.6.1.md).

## 💬 Messaging and media

![Illustrated overview of WhatsNow desktop tools](docs/assets/WhatsNow%20features.png)

*Concept artwork; controls and service availability depend on the actual build/platform.
See [artwork notes](docs/assets/README.md) for interpretation limits.*

- Use WhatsApp Web's linked-device login, chats, groups, communities, reactions,
  replies, search, and other features that the service exposes to your account
- Send files through the native attachment confirmation flow
- Drag files into the active chat without opening the Attach menu or file picker
- Process file batches with bounded file-count/size validation and chunked transfer
- Cancel an attachment transfer without intentionally navigating away from the chat
- Open ordinary HTTP/HTTPS links in the operating system's browser flow
- Keep supported WhatsApp-family content in the app's reusable content window
- Use a profile-based window title such as `WhatsNow — Ben`

WhatsApp controls service availability and media encoding. WhatsNow does not
guarantee that every high-resolution image will be offered or transmitted as HD;
use WhatsApp's own available quality/document options. Calls, channels, status,
and other service features can vary by account, rollout, webview, and platform.

## 👥 Accounts and desktop controls

Add, open, rename, mute/unmute, and remove named account spaces through
**Settings → Accounts**. Account labels are separate from the detected profile
name. Sessions use isolated webview profiles where supported; multiple isolated
accounts on macOS require macOS 14 or later.

Desktop preferences include close-to-tray, start minimized, launch at sign-in,
always-on-top chat windows, and a configurable global show/hide shortcut.
Fresh settings enable startup launch and close-to-tray; existing saved settings
remain authoritative. Startup integration depends on OS policy/permission.

| Platform | Default global shortcut |
| --- | --- |
| Windows | `Alt+W` |
| macOS | `Option+W` |
| Linux | `Ctrl+Alt+W` |

Settings offers shortcut recording and presets. A conflicting shortcut or desktop
environment may require choosing another combination. **Quit** from the tray to
stop background accounts; closing the window with close-to-tray enabled is not Quit.

## 🎯 Focus and notifications

Focus pauses native alerts without intentionally disconnecting chats. Choose
15, 30, or 45 minutes; 1, 2, or 4 hours; or a custom interval from 1 minute to
24 hours. Account-level mute and global notification preferences are separate.

Native alerts support message previews or generic private text, a test button,
and sender-chat activation. The bridge retains group/community routing metadata
and can highlight a matching message when its identifier and rendered history
are available. Startup history/replayed messages are filtered rather than treated
as new incoming messages. Active-chat foreground suppression, Focus, and App Lock
participate in notification policy.

On Windows, previews use compact native toast notifications, not a separate
floating window. The preferred preview duration defaults to **2 seconds**, with
a 2–30-second setting. **Exact visible duration is not guaranteed**: Windows
controls banner timing, accessibility behavior, and notification history. A missed
notification can remain in the notification center after its banner disappears.
Linux/macOS notification behavior depends on their native service.

The tray icon remains the WhatsNow icon without a numeric tray overlay. Unread
state is still used for account/desktop indicators where the platform supports it.
Portable Windows builds skip installer-style protocol and notification-identity
registration; prefer an installed build for the most reliable desktop integration.

## ⚙️ Appearance and Settings

| Theme family | Choices | Wallpaper behavior |
| --- | --- | --- |
| Official | Dark, Light | WhatsApp doodles retained |
| Dark personality | Graphite, Midnight, Forest, Ocean | Doodles suppressed |
| Light/pastel personality | Blush, Lavender, Candy, Aurora | Doodles suppressed |

Aurora provides the soft pastel-spectrum option. The legacy stored `system`
choice corresponds to the UI's official Dark option, not an additional
OS-following theme. There is no independent doodle switch: the selected theme
determines the behavior. Theme changes are applied without visible profile-menu
navigation or document refresh. Existing composer/emoji protections are retained.

Settings has Overview, Accounts, Focus, Appearance, Notifications, Preferences,
Security, and About sections. Overview provides account, Focus, and appearance
shortcuts. The frameless window reveals after initial paint and can close after
30 seconds of inactivity. Use Save changes for persisted preferences; About has
no unnecessary Save action.

v2.6.1 improves action-label contrast, selected icons, badges, keyboard focus,
and small text. About and the footer use the concise **Benedictus RH** identity,
with `@benedictusrey` linking to the author's GitHub profile.

## 🔗 Phone links and calling windows

Installed Windows builds register `whatsapp://send` handoff support. An external
HTTPS `wa.me` link first opens in a browser; choose **Open WhatsApp** there.
The current implementation selects a matching visible chat or uses native
New chat search without reloading. Prefilled text is draft-only; existing drafts
are protected. Escape cancels lookup and a newer link supersedes an older one.
An open user editing panel can deliberately block automatic lookup.

This routing relies on WhatsApp's changing UI, not a stable public navigation
API. Controlled regressions pass, but final installed live acceptance is still
pending. Portable mode does not register protocol associations, and this release
does not add macOS/Linux protocol registration.

Supported call-stage URLs open a separate native window with resize, minimize,
maximize, opener-session continuity, and monitor/DPI-aware initial geometry.
Calling itself remains dependent on WhatsApp Web, OS permissions, hardware, and
account eligibility. A real two-party call and media-continuity acceptance test
are still required before declaring v2.6.1 fully verified.

## 🔐 Privacy and local protection

WhatsNow does not add a project-operated chat relay, analytics SDK, or advertising
SDK in the reviewed source. **This does not mean no data is stored or transmitted**:
WhatsApp Web communicates with WhatsApp, and local webview profiles retain session
data. Account labels, settings, lock configuration, and bounded diagnostic logs
also live locally. Review files before sharing them.

App Lock offers a locally hashed password, lock on launch/hide, idle locking,
and optional OS-backed biometric verification where supported. Passwords use
Argon2id with a random salt. App Lock is a window-access barrier, **not disk
encryption**; use full-disk encryption for at-rest protection. Native notification
previews may be retained by the OS, including on the lock screen.

The remote WhatsApp page has restricted Tauri capabilities; Settings and lock
commands are separately scoped. External links are validated, remote `file://`
navigation is blocked, and attachment transfers have resource limits. These
are defensive boundaries, not a security certification or a malware-free guarantee.
Read [Privacy](PRIVACY.md) and [Security](SECURITY.md).

## 📦 Platforms and installation

| Platform | Package formats | Current v2.6.1 preparation |
| --- | --- | --- |
| Windows x64 | Setup EXE, MSI, portable EXE | Built locally; unsigned |
| Linux x64 | AppImage, DEB | Native build/validation pending |
| macOS Apple Silicon | AArch64 DMG, app archive | Native build/validation pending |
| macOS Intel | x86_64 DMG, app archive | Native build/validation pending |

Windows uses Microsoft Edge WebView2; Linux uses WebKitGTK; macOS uses WKWebView.
Keep the OS and web runtime updated. Tauri does not replace these rendering
engines. Current platform requirements and installation steps are in
[Platform support](docs/PLATFORM_SUPPORT.md) and [Installation](docs/INSTALLATION.md).

For updates, fully quit the tray app before installing/replacing the executable.
Replacing an executable normally preserves per-user sessions; it is not a clean
data reset. Verify the exact package checksum and inspect its signature status.
The currently prepared Windows files are unsigned; do not disable antivirus or
add broad exclusions to run a package you have not verified.

## ⚡ Performance expectations and support

Windows memory-conscious builds request WebView2's supported low-memory target
only for hidden/minimized windows. Visible windows stay normal even when
unfocused, protecting media playback. Background scripts and connections are
not deliberately suspended. Multiple engine processes are expected.

There is **no fixed RAM promise**, no single-process trick, and no verified
universal advantage over Microsoft's official client. Measure the complete
WhatsNow process tree, including WebView2, under comparable account/workload
conditions—not just the small Rust host executable. See [Windows notes](docs/WINDOWS.md).

Report reproducible problems through the repository, omitting phone numbers,
messages, session data, and private screenshots. Use the private reporting route
in [Security](SECURITY.md) for vulnerabilities. The app and accompanying code
are provided under [MIT](LICENSE), with [retained notices](THIRD_PARTY_NOTICES).
