<p align="center">
  <img src="docs/assets/icon.png" alt="WhatsNow icon" width="128">
</p>

<h1 align="center">WhatsNow</h1>

<p align="center">
  <strong>A calm, lightweight desktop experience for WhatsApp Web</strong><br>
  Built with Tauri v2 + Rust · WebView2 · WebKitGTK
</p>

<p align="center">
  <a href="https://github.com/benedictusrey/WhatsNow-for-WhatsApp/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/benedictusrey/WhatsNow-for-WhatsApp?display_name=tag&sort=semver"></a>
  <img alt="Version 2.5.0" src="https://img.shields.io/badge/version-2.5.0-213547">
  <img alt="Platform Windows macOS Linux" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-168B72">
  <img alt="Built with Tauri v2" src="https://img.shields.io/badge/built%20with-Tauri%20v2-24A6D8">
  <img alt="Built with Rust" src="https://img.shields.io/badge/built%20with-Rust-B7410E">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-6B9E3A"></a>
  <a href="https://github.com/benedictusrey"><img alt="Author @benedictusrey" src="https://img.shields.io/badge/author-%40benedictusrey-111827"></a>
</p>

**🎉 WHATSNOW RELEASE: v2.5.0 IS NOW LIVE! 🎉**

After meticulous development, the latest official build of WhatsNow is ready
for deployment. This is the locked, verified state of the four user-required
pillars — themes, typing-area emoji, compact toasts, and click-to-chat
routing — packaged as a fresh release.

**What's new in v2.5.0**

- 😀 **Emojis you type are visible in every theme** — the doodle kill-switch
  no longer wipes WhatsApp's inline emoji sprites, so the same emojis render
  identically in Dark, Light, and every personality theme
- 🔔 **Every toast is compact** — the small WhatsNow icon next to the
  "WhatsNow" name, never the large left-side banner, on the first toast and
  every one after
- 🎯 **Click a notification, land in the sender's chat** — toast and
  notification-center clicks open the exact conversation, even on a cold
  start, via a real trusted click routed through the host
- 🎭 **The Reply curtain is gone** — WhatsApp's mask-painted doodles can no
  longer flash on dark personality themes while the Reply bar slides up
- 🏷️ **Settings > About always reports the truth** — the version is injected
  from the compiled binary at runtime, so it can never lag behind the release

**🚀 Welcome to the Future of WhatsApp on Desktop**

<p align="center">
  <img src="docs/assets/whatsnow-hero.png" alt="WhatsNow hero — a calm, multi-account desktop workspace for WhatsApp Web" width="100%">
</p>

<p align="center"><em>A calm, multi-account desktop workspace for WhatsApp Web.</em></p>

WhatsNow isn't just a wrapper — it's a meticulously engineered native desktop
client that supercharges your WhatsApp experience. Designed for calm,
productivity, and power users, WhatsNow seamlessly bridges the gap between
WhatsApp Web and your operating system: one window per account, toasts you can
actually click, a badge you can actually read, and themes that make the chat
yours.

> WhatsNow is not affiliated with, sponsored by, or maintained by WhatsApp LLC
> or Meta Platforms, Inc. Use WhatsApp according to its terms and the rights
> attached to your messages.

**✨ At a glance**

- 👥 **Multi-account sessions** — isolated sessions side by side, each with
  its own window, unread count, and per-account notification choices
- 🔕 **Quiet notifications** — background-only native alerts, private
  previews, burst deduplication, and a delivery test
- 🎨 **Personal themes** — official Dark/Light keep WhatsApp's doodle
  wallpaper; eight personality palettes stay clean on every surface
- 🔒 **App Lock** — optional Argon2id password or supported platform
  biometrics; close-to-lock hides the chat to the tray
- ⏱️ **Focus tools** — preset and custom sessions from 15 minutes to 24
  hours, with tray controls
- 🔗 **Links go where they belong** — one click on any outside link opens
  your default browser; WhatsApp's own links stay in-app
- 📥 **Drag-and-drop attachments** — drop files straight into the chat,
  no file-picker detour
- ⚡ **Feather-light** — a focused Tauri + WebView2 shell, not a whole
  browser; minimized and tray-hidden accounts request WebView2's supported
  low-memory target

<p align="center">
  <img src="docs/assets/whatsnow-features.png" alt="Concept artwork presenting WhatsNow accounts, Focus, App Lock, notifications, drag and drop, shortcuts, and themes" width="100%">
</p>

<p align="center"><em>The WhatsNow desktop at a glance — accounts, Focus, App Lock, notifications, drag and drop, shortcuts, and themes.</em></p>

**🌟 Why Choose WhatsNow?**

**1. Unrivaled Performance & Efficiency**

Say goodbye to the heavy memory usage of a full browser tab. Built entirely on
Rust and Tauri v2, WhatsNow is designed to be lightweight: the active account
stays fully responsive while minimized, tray-hidden, and secondary accounts
request WebView2's supported low-memory target — scripts and network
connections keep running, so background messages and native notifications
never pause. Your chat, delivered at native speed.

**2. Immersive & Distraction-Free Aesthetics**

WhatsNow strips away the browser clutter: a seamless frameless Settings
pop-up, profile-based window titles (`WhatsNow — Ben`), and ten themes that
style the chatting workspace while preserving WhatsApp's native composer and
message surfaces. Official Dark and Light keep WhatsApp's doodle wallpaper;
every personality theme stays clean on every surface — including the Reply
card.

**3. Deep Operating System Integration**

Why open a browser tab when you can command everything from your taskbar?
WhatsNow lives in your OS like a true native application: close it and it
keeps living in the tray, click a toast and you land in the sender's chat,
read your unread count from a high-contrast taskbar badge, and pin the window
above everything with always-on-top. Downloads, external links, and
drag-and-drop all behave like a first-class desktop citizen.

**⚔️ WhatsNow vs WhatsApp Web**

Same WhatsApp. Same account, same encryption, same conversations. The
difference is the *desktop* part — everything WhatsApp Web leaves to the
browser, WhatsNow actually does.

| Your day | WhatsNow 🟢 | WhatsApp Web in a browser tab |
| --- | --- | --- |
| Where it lives | Its own desktop window — no tab juggling | One tab among twenty others |
| Close the window | Hides to the tray; messages keep arriving | Closes the chat entirely |
| Startup | Launches with Windows and waits quietly in the tray | Open the browser, find the tab, log in again |
| Notifications | Native toasts with the WhatsNow icon — click one and you're in the sender's chat | Browser pop-ups; dismiss one and it's gone |
| Notification history | Alerts stay in the Windows notification center | Gone the moment they fade |
| Multiple accounts | Isolated sessions side by side, each with its own window | One account per browser profile |
| Unread count | A big, readable taskbar badge | A tiny favicon dot — if you remember to look |
| Themes | Official Dark/Light plus 8 personality palettes; doodles stay on the official themes only | Light, Dark, and whatever the browser's dark mode does |
| Focus mode | Sessions that quiet interruptions for 15 minutes to 24 hours | Closing the tab |
| App Lock | Optional password or biometric lock | Nothing at all |
| Attachments | Drag and drop straight into the chat | Click through the browser's file picker |
| Resource use | A focused Tauri + WebView2 shell | An entire browser hosting one tab |
| Updates | One-click installers for Windows, macOS, and Linux | Whatever the browser updates |

**The bottom line:** WhatsApp Web is the service. WhatsNow is the desktop.
Same chats, same encryption — with the desktop ergonomics that a browser tab
simply doesn't have.

**🖥️ Observed Windows resource snapshot**

<p align="center">
  <img src="docs/assets/whatsnow-resource-snapshot.png" alt="Observed Task Manager snapshot comparing web.whatsapp.com in Microsoft Edge with WhatsNow" width="100%">
</p>

Observed: a `173.2 MB` WhatsApp Web tab in Microsoft Edge versus a linked
WhatsNow app group at `6.8 MB`. Illustrative, not a benchmark — compare total
process trees under the same workload before drawing conclusions.

**🚀 Quick Start**

Use the **Release Builds** — we provide cross-platform builds for Windows,
macOS, and Linux. Head to the
[Releases page](https://github.com/benedictusrey/WhatsNow-for-WhatsApp/releases/latest)
to download the latest version for your system.

| Platform | Asset | Notes |
| --- | --- | --- |
| Windows 10/11 x64 | `WhatsNow_2.5.0_windows_x64-setup.exe` · `-portable.exe` · `_x64_en-US.msi` | Requires Edge WebView2 Runtime |
| Linux x64 | `WhatsNow_2.5.0_amd64.AppImage` · `_amd64.deb` | Requires WebKitGTK 2.46.1+ |
| macOS Apple Silicon | `WhatsNow_2.5.0_aarch64.dmg` · `_aarch64.app.tar.gz` | Requires macOS 12.1+ |
| macOS Intel | `WhatsNow_2.5.0_x86_64.dmg` · `_x86_64.app.tar.gz` | Requires macOS 12.1+ |
| Every platform | `checksums.sha256` · `checksums-windows.sha256` | Verify your download against them |

**Windows** — Install the Microsoft Edge WebView2 Runtime if not already
present. Run `WhatsNow_2.5.0_windows_x64-setup.exe` (or the `.msi` variant for
managed deployment, or the portable EXE for a no-installer experience). Link
your phone: WhatsApp → **Linked devices** → scan the QR code.

**macOS** — Open the `.dmg` and drag WhatsNow to your Applications folder. If
the first launch shows a Gatekeeper prompt, right-click and choose **Open**
(unsigned builds). Link your phone and scan the QR code.

**Linux** — `chmod +x WhatsNow_2.5.0_amd64.AppImage` and run it, or install
the `.deb` with your package manager. Some distributions need
`sudo apt install libwebkit2gtk-4.1-dev`. Link your phone and scan the QR
code.

Only install assets that are actually attached to a published release. The
release pipeline builds Windows, Linux, and macOS assets on their respective
native GitHub Actions runners from the private source repository; this public
repository stores only the finished binaries and checksums. Read the complete
[installation guide](docs/INSTALLATION.md) and
[platform notes](docs/PLATFORM_SUPPORT.md). Windows users can also read the
[memory-conscious build notes](docs/WINDOWS.md).

**🔒 The four locked pillars**

These four behaviors are user-required and verified against regressions:
themes/doodle mapping (official themes keep doodles, personality themes stay
clean everywhere), typing-area emoji rendering in every theme, always-compact
float notifications, and click-to-chat routing. See the
[release notes](RELEASE_NOTES.md) and [changelog](CHANGELOG.md).

**🛡️ Privacy & Security Notes**

- Download only from the release page owned by `benedictusrey`.
- Compare the file's SHA-256 value with the published checksum; check the
  operating-system signature when a signed build is available.
- WhatsNow does not proxy chats through a project-operated server and runs no
  analytics. The embedded WhatsApp Web page communicates with WhatsApp's
  service under WhatsApp's terms and privacy policy.
- Account sessions remain in local operating-system webview profiles. App
  Lock limits casual access to the window; it does not encrypt those files.
- Native notifications can expose sender or message text on the lock screen.
  Disable previews if that is not appropriate for your environment.
- An unsigned new desktop build can trigger SmartScreen or antivirus
  reputation warnings. A warning is not proof of malware, but it should never
  be ignored without verifying the source and checksum.

See [Security and verification](docs/SECURITY_AND_VERIFICATION.md),
[privacy notes](PRIVACY.md), and the [security policy](SECURITY.md).

**✅ Verification Checklist (Release Review)**

The repository checks validate documentation, JavaScript, Rust formatting,
tests, and package checksums. They do not replace a manual signed-in WebView
check because WhatsApp can update its DOM at any time. For a release review,
verify in this order:

- Open a chat and type an emoji on every theme — it must render (Dark, Light,
  and all personality themes).
- Hit **Reply** on a message under a dark personality theme — no doodle
  "curtain" may flash.
- Send a test notification (Settings → Notifications) — the toast must be the
  compact layout with the small icon.
- Click that toast — the sender's chat must open, even from the notification
  center.
- Open **Settings > About** — it must read `WhatsNow 2.5.0`.
- Check the tray, taskbar badge, external-link routing, drag-and-drop, and
  App Lock on lock-on-hide.

**📚 Documentation**

| Document | What you'll find |
| --- | --- |
| [RELEASE_NOTES.md](RELEASE_NOTES.md) | What's new in v2.5.0 — everything changed since v2.0.0 |
| [CHANGELOG.md](CHANGELOG.md) | Full version history, one entry per release |
| [INSTALLATION.md](docs/INSTALLATION.md) | Packages, scripts, updates, portable use, and uninstall |
| [FEATURES_AND_COMPARISON.md](docs/FEATURES_AND_COMPARISON.md) | Features and app comparison |
| [PLATFORM_SUPPORT.md](docs/PLATFORM_SUPPORT.md) | Platform support and limitations |
| [WINDOWS.md](docs/WINDOWS.md) | Windows memory-conscious build notes |
| [SECURITY_AND_VERIFICATION.md](docs/SECURITY_AND_VERIFICATION.md) | Download verification and release signing |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common platform and runtime problems |
| [GITHUB_DESKTOP_PUBLISHING.md](docs/GITHUB_DESKTOP_PUBLISHING.md) | Publish the release with GitHub Desktop |
| [SECURITY.md](SECURITY.md) | Private vulnerability reports and security policy |
| [SUPPORT.md](SUPPORT.md) | Bug reports, feature requests, and diagnostics |

**Author**

WhatsNow is crafted and maintained by
[@benedictusrey](https://github.com/benedictusrey), released under the
[MIT License](LICENSE). Required retained-code and dependency notices appear
in [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES). The project is intentionally
independent from WhatsApp LLC and Meta Platforms, Inc. Contributions and
reproducible bug reports are welcome — provided they do not include
credentials, private session data, or private chat content.
