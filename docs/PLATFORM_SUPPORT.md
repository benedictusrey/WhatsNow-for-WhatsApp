# Platform support

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

| Platform | Package | Runtime | v2.6.1 preparation |
| --- | --- | --- | --- |
| Windows 10/11 x64 | NSIS setup, MSI, portable EXE | Edge WebView2 | Built locally; unsigned |
| Linux x64 | AppImage, Debian package | WebKitGTK 2.46.1+ | Publish after native validation |
| macOS Apple silicon | DMG, app archive | WKWebView | Publish after native validation |
| macOS Intel | DMG, app archive | WKWebView | Publish after native validation |

All packages must come from the same tagged source revision for a release.
Because native packaging and signing are platform-specific, a Windows computer
cannot meaningfully validate the final macOS Gatekeeper/notarization behavior or
Linux WebKitGTK integration.

Version 2.6.1 uses WebView2's supported low-memory target for hidden/minimized
Windows accounts; visible windows stay normal even when unfocused. It does not promise a
fixed RAM value or suppress WebView2's normal subprocess model.

WhatsNow relies on the official WhatsApp Web service. Availability of calls,
downloads, notifications, and page elements can differ with the operating
system webview and future WhatsApp Web changes.

## Shortcuts

- Windows: `Alt+W`
- macOS: `Option+W`
- Linux: `Ctrl+Alt+W`

The shortcut can be changed in WhatsNow Settings if it conflicts with another
application or desktop environment.
