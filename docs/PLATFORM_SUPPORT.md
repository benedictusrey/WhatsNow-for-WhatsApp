# Platform support

| Platform | Package | Runtime | Status for initial repository |
| --- | --- | --- | --- |
| Windows 10/11 x64 | NSIS setup, MSI, portable EXE | Edge WebView2 | Built and staged |
| Linux x64 | AppImage, Debian package | WebKitGTK 2.46.1+ | Build target; publish after native validation |
| macOS Apple silicon | DMG, app archive | WKWebView | Build target; publish after native validation |

All packages must come from the same tagged source revision for a release.
Because native packaging and signing are platform-specific, a Windows computer
cannot meaningfully validate the final macOS Gatekeeper/notarization behavior or
Linux WebKitGTK integration.

WhatsNow relies on the official WhatsApp Web service. Availability of calls,
downloads, notifications, and page elements can differ with the operating
system webview and future WhatsApp Web changes.

## Shortcuts

- Windows: `Alt+W`
- macOS: `Option+W`
- Linux: `Ctrl+Alt+W`

The shortcut can be changed in WhatsNow Settings if it conflicts with another
application or desktop environment.

