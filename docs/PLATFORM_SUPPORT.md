# Platform support

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

| Platform | Package | Runtime | v2.6.3 validation scope |
| --- | --- | --- | --- |
| Windows 10/11 x64 | NSIS setup, MSI, portable EXE | Edge WebView2 | Windows 11 native fixtures passed; Windows 10 and extended live calls/media unverified; unsigned |
| Linux x64 | AppImage, Debian package | WebKitGTK 2.46.1+ | Native CI packaging required; installed-app media/calling unverified |
| macOS Apple silicon | DMG, app archive | WKWebView | Native CI packaging required; installed-app media/calling unverified; not notarized |
| macOS Intel | DMG, app archive | WKWebView | Cross-target build on macOS required; installed-app media/calling unverified; not notarized |

All packages must come from the same tagged source revision for a release.
Because native packaging and signing are platform-specific, a Windows computer
cannot meaningfully validate the final macOS Gatekeeper/notarization behavior or
Linux WebKitGTK integration.

Version 2.6.3 keeps Windows account/call webviews at normal memory priority even
when hidden/minimized, favoring media reliability over RAM reclamation. It does not promise a
fixed RAM value or suppress WebView2's normal subprocess model.

WhatsNow relies on the official WhatsApp Web service. Availability of calls,
downloads, notifications, and page elements can differ with the operating
system webview and future WhatsApp Web changes.

Calling success on the maintainer's previous Windows build does not establish
Linux/macOS calling support. WebRTC availability varies by WebKitGTK build,
and all platforms remain subject to WhatsApp account/service eligibility.

## Shortcuts

- Windows: `Alt+W`
- macOS: `Option+W`
- Linux: `Ctrl+Alt+W`

The shortcut can be changed in WhatsNow Settings if it conflicts with another
application or desktop environment.
