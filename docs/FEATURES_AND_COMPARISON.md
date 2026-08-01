# Features and comparison

WhatsNow 1.1.0 is a productivity-oriented desktop host for the official
WhatsApp Web service. It does not implement a separate messaging protocol or
operate a chat relay.

## Accounts

- Add, rename, switch, and remove WhatsNow account windows.
- Keep non-default accounts in isolated webview profiles.
- Preserve the default account's normal profile store across upgrades.
- Use the logged-in WhatsApp profile name in the window title.
- Configure notification behavior per account.
- Track unread state across account windows.

## Notifications

- Deliver message alerts through native operating-system notifications.
- Suppress previews while the relevant account window is actively in the
  foreground.
- Keep Settings separate from foreground-chat detection.
- Open the originating account and conversation from supported notification
  activations.
- Recognize direct, group, and community chat notifications.
- Avoid replaying already-observed messages during startup restoration.
- Allow generic notifications when message previews are disabled.
- Apply the configured preview duration as closely as the native platform
  permits.

Operating systems ultimately control notification presentation, history, and
lock-screen visibility.

## Focus and productivity

- Start Focus sessions from 15 minutes through 4 hours.
- Enter a custom Focus duration up to 24 hours.
- Suppress message interruptions while Focus is active.
- Launch at startup, optionally start minimized, and close to the tray.
- Keep an account window always on top when needed.
- Use `Alt+W` on Windows, `Option+W` on macOS, or `Ctrl+Alt+W` on Linux by
  default.
- Open external links through the operating system's default browser.

## Appearance

- Use official-style Dark and Light modes.
- Choose Graphite, Midnight, Forest, Ocean, Blush, Lavender, Candy, or Aurora
  Pastel chat backgrounds.
- Keep WhatsApp's native composer surfaces readable in both light and dark
  families.
- Disable WhatsApp doodles automatically for personality themes while retaining
  the normal doodled wallpaper for Dark and Light.
- Apply appearance preferences across account windows and Settings.

Themes change presentation only. They do not modify message content or
WhatsApp's transport.

## Attachments and desktop integration

- Drop files directly into the active chat and review WhatsApp's confirmation
  composer before sending.
- Keep the active conversation unchanged if attachment preparation is cancelled.
- Avoid displaying an additional native Open dialog during a valid drop.
- Route ordinary downloads to the user's Downloads directory.
- Maintain a clean tray icon and taskbar/window identity.

## WebView2 efficiency

- Keep the focused account on WebView2's normal memory target for responsive
  chat interaction.
- Request WebView2's supported low-memory target for minimized, tray-hidden,
  and secondary accounts.
- Keep background message observers and native notifications active.

The policy is best-effort. WebView2 still manages browser, renderer, GPU, and
utility subprocesses, so total memory varies with accounts, chats, media,
extensions, runtime versions, and call activity.

## App Lock and local security

- Lock account and Settings windows behind an application password.
- Store an Argon2id password hash rather than the plain password.
- Use Windows Hello, Touch ID, or supported Linux biometric services where the
  platform integration is available.
- Lock on launch, hide, or idle according to the chosen preferences.
- Keep remote WhatsApp pages limited to the small set of desktop actions they
  require.

App Lock is a window access control, not encryption for local webview profiles.
Use BitLocker, FileVault, or LUKS for encryption at rest.

## Comparison with official options

| Capability | WhatsNow | Official WhatsApp desktop app | WhatsApp Web in a browser |
| --- | --- | --- | --- |
| Publisher | Independent, by [@benedictusrey](https://github.com/benedictusrey) | WhatsApp / Meta | WhatsApp / Meta service inside the chosen browser |
| Service and account | Official WhatsApp Web | Official WhatsApp service | Official WhatsApp Web |
| First-party support | No | Yes | Service support from WhatsApp; browser support from its vendor |
| Multiple isolated desktop sessions | Included | Depends on official release capabilities | Possible with separate browser profiles |
| WhatsNow themes and Focus controls | Included | No | No |
| App Lock controls | Included | Use official and operating-system options | Use browser and operating-system options |
| Native notification routing | Included, subject to platform limits | First-party implementation | Browser implementation |
| Updates | GitHub Releases | Official stores and WhatsApp channels | Browser and web-service updates |
| Source in this repository | Distribution documents and installer helpers only | Proprietary | Browser-dependent |

Choose the official desktop application when first-party support, store
signing, or official calling behavior is the priority. Choose WhatsNow when its
local productivity controls and isolated desktop sessions better fit the
workflow.

## Resource snapshot interpretation

The README comparison image preserves two Windows Task Manager observations
provided by the author:

- Edge displayed a `173.2 MB` WhatsApp Web tab process before login.
- Windows displayed a `6.8 MB` WhatsNow app group with an account linked.

These values are not equivalent to executable file size and should not be
treated as a universal memory guarantee. Browser extensions, process grouping,
WebView2 subprocesses, login state, active media, calls, caching, and runtime
versions can materially change the result. A controlled comparison should use
the same computer, account state, idle period, workload, and measurement method,
then total every related process.

WhatsNow is independent and unofficial. It is not affiliated with, endorsed by,
or maintained by WhatsApp or Meta.
