# Platform support

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

| Platform | Release installer | Runtime | v2.7.0 validation scope |
| --- | --- | --- | --- |
| Windows 10/11 x64 | NSIS setup | Edge WebView2 | Windows 11 native fixtures and a real call passed; Windows 10 unverified; unsigned |
| Linux x64 | AppImage | WebKitGTK 2.46.1+ | Built and compile-tested in CI; installed-app media/calling unverified |
| macOS (Apple silicon and Intel) | Universal DMG | WKWebView | Built in CI as one universal binary; installed-app media/calling unverified; not notarized |

All packages must come from the same tagged source revision for a release.
Because native packaging and signing are platform-specific, a Windows computer
cannot meaningfully validate the final macOS Gatekeeper/notarization behavior or
Linux WebKitGTK integration.

Since 2.6.3, WhatsNow keeps Windows account/call webviews at normal memory priority even
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
