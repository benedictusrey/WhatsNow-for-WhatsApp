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
  <img alt="Version 2.6.0" src="https://img.shields.io/badge/version-2.6.0-213547">
  <img alt="Platform Windows macOS Linux" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-168B72">
  <img alt="Built with Tauri v2" src="https://img.shields.io/badge/built%20with-Tauri%20v2-24A6D8">
  <img alt="Built with Rust" src="https://img.shields.io/badge/built%20with-Rust-B7410E">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-6B9E3A"></a>
  <a href="https://github.com/benedictusrey"><img alt="Author @benedictusrey" src="https://img.shields.io/badge/author-%40benedictusrey-111827"></a>
</p>

**🎉 WHATSNOW RELEASE: v2.6.0 IS NOW LIVE! 🎉**

WhatsNow v2.6.0 represents a major evolutionary milestone. Building on the
rock-solid foundation of the four locked pillars in v2.5.0, v2.6.0 delivers
native desktop calling windows, seamless WhatsApp-family link routing,
work-area display clamping, restored official Dark doodles, process freeze
prevention, and video-audio playback protections across Windows, macOS, and
Linux.

---

## 🔍 What's Changed: Comparing v2.6.0 with v2.5.0

WhatsNow v2.5.0 locked the four critical behavioral pillars (themes + doodle
mapping, typing-area emoji rendering, compact notification toasts, and
trusted-click chat routing). Version 2.6.0 preserves every locked behavior while
eliminating long-standing webview constraints and integrating deep operating
system hooks.

### Detailed Comparison Matrix

| Area / Feature | WhatsNow v2.5.0 | WhatsNow v2.6.0 (Latest) |
| --- | --- | --- |
| **Official Dark Doodles** | Settings "Dark" theme saved as `system`, which inadvertently disabled doodle wallpapers. | **Restored:** Strict deny-list enables doodles across all official themes (`System`, `Dark`, `Light`) while keeping personality themes clean. |
| **WhatsApp Calling** | Popups denied; video and voice calls wedged inside cramped in-page web container. | **Real Call Windows:** Dedicated always-on-top, resizable, and maximizable window with session sharing (WebRTC intact). |
| **Call Media Permissions** | Permission auto-approval attached only to boot windows; popups required re-prompting. | **Automated:** Microphones, cameras, and Window Management (PiP/pop-out) auto-granted for all call windows. |
| **Window Geometry Clamping** | Fixed 1100×800 chat & 760×820 Settings defaults overflowed 1366×768 or 125%/150% DPI screens. | **Adaptive Clamping:** Window sizes automatically clamp to 96% of the primary display work area with safety floors. |
| **WhatsApp-Family Links** | External web links only; `wa.me` and other WhatsApp domains opened outside in default browser. | **In-App Family Routing:** 8 WhatsApp hosts stay inside WhatsNow (`wa.me`, `chat.whatsapp.com`, `call.whatsapp.com`, etc.). |
| **`wa.me` Chat Opening** | Handled in browser or caused disruptive reloads. | **In-Place CDP Routing:** Known contacts open instantly via trusted row click; unknown contacts raise the app cleanly. |
| **Content Popups** | Did not exist; auxiliary WhatsApp pages forced to external browser. | **Reusable `wa-content` Window:** Pre-created hidden at boot; fast in-place `location.replace` with zero message-pump deadlocks. |
| **Windows Deep Links** | No OS URI scheme registration; `whatsapp://` links from external apps ignored. | **`whatsapp://` Protocol Handler:** Registered in HKCU per-user at launch; opens composer directly (skipped in portable mode). |
| **Video Audio Playback** | Unfocused visible windows could enter WebView2 LOW memory target, cutting audio graph on videos. | **Audio Guard:** Visible windows stay at NORMAL memory target; LOW target restricted to minimized/tray-hidden states. |
| **DOM Fluency & Sweeps** | Promo removal sweeps ran unthrottled during initialization. | **Coalesced Sweeps:** `document`-rooted observer with timer coalescing eliminates mutation storms and UI stutter. |
| **Locked Pillars** | Fully locked and byte-verified. | **Maintained 100%:** Byte-verified and extended in `backup/v2.6.0-locked/`. |

---

### Highlights of v2.6.0

- 🎨 **Official Doodles Restored Everywhere** — Whether you choose Light, Dark,
  or System, WhatsApp's beloved doodle wallpaper renders accurately. The eight
  personality themes (`midnight`, `forest`, `graphite`, `ocean`, `blush`,
  `lavender`, `candy`, `aurora`) continue to strip doodles across every layer,
  including composer and reply surfaces.
- 📞 **True Native Video & Voice Calling** — WhatsApp Web Calling popups
  (`window.open`) now spawn a dedicated, resizable, always-on-top call window.
  It shares the opener's webview environment (WebView2 on Windows, WKWebView on
  macOS, WebKitGTK on Linux), guaranteeing WebRTC media continuity and full
  account isolation.
- 🎙️ **Frictionless Media Permissions** — Call windows automatically receive
  Microphone, Camera, and Window Management permissions without intrusive
  system permission dialogs interrupting active calls.
- 🖥️ **Small Screen & High-DPI Friendly** — No more windows spilling past your
  taskbar. All window defaults intelligently scale to the monitor's usable work
  area, ensuring full comfort on 1366×768 laptops and scaled displays.
- 🔗 **Intelligent WhatsApp Link Handling** — Links to `wa.me`, `chat.whatsapp.com`,
  `call.whatsapp.com`, `api.whatsapp.com`, and `whatsapp.com` stay inside
  WhatsNow. Known numbers open their chat row seamlessly; external web links
  continue opening in your favorite web browser.
- ⚡ **Zero-Freeze Content Architecture** — Pre-created hidden popup hosting
  prevents WebView2 synchronous construction deadlocks, keeping the app smooth
  and responsive at all times.
- 🚀 **Deep-Link URI Scheme (`whatsapp://`)** — Click WhatsApp links across your
  operating system, browser, or documents to instantly raise WhatsNow and start
  typing.
- 🔊 **Uninterrupted Media Audio** — Streamlined memory governance ensures videos
  and audio clips never go silent when clicking outside the window.

---

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
| Windows 10/11 x64 | `WhatsNow_2.6.0_windows_x64-setup.exe` · `-portable.exe` · `_x64_en-US.msi` | Requires Edge WebView2 Runtime |
| Linux x64 | `WhatsNow_2.6.0_amd64.AppImage` · `_amd64.deb` | Requires WebKitGTK 2.46.1+ |
| macOS Apple Silicon | `WhatsNow_2.6.0_aarch64.dmg` · `_aarch64.app.tar.gz` | Requires macOS 12.1+ |
| macOS Intel | `WhatsNow_2.6.0_x86_64.dmg` · `_x86_64.app.tar.gz` | Requires macOS 12.1+ |
| Every platform | `checksums.sha256` · `checksums-windows.sha256` | Verify your download against them |

**Windows** — Install the Microsoft Edge WebView2 Runtime if not already
present. Run `WhatsNow_2.6.0_windows_x64-setup.exe` (or the `.msi` variant for
managed deployment, or the portable EXE for a no-installer experience). Link
your phone: WhatsApp → **Linked devices** → scan the QR code.

**macOS** — Open the `.dmg` and drag WhatsNow to your Applications folder. If
the first launch shows a Gatekeeper prompt, right-click and choose **Open**
(unsigned builds). Link your phone and scan the QR code.

**Linux** — `chmod +x WhatsNow_2.6.0_amd64.AppImage` and run it, or install
the `.deb` with your package manager. Some distributions need
`sudo apt install libwebkit2gtk-4.1-dev`. Link your phone and scan the QR
code.

Only install assets that are actually attached to a published release. The
release pipeline builds Windows, Linux, and macOS assets on their respective
native GitHub Actions runners from the source repository; finished packages and
checksums are attached directly to each release. Read the complete
[installation guide](docs/INSTALLATION.md) and
[platform notes](docs/PLATFORM_SUPPORT.md). Windows users can also read the
[memory-conscious build notes](docs/WINDOWS.md).

**🔨 Build from Source**

Install Rust 1.82 or newer and the Tauri 2 CLI:

```bash
npm install -g @tauri-apps/cli@^2
cargo tauri dev
```

Ubuntu and Debian builders need the Tauri system libraries:

```bash
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libdbus-1-dev libssl-dev libayatana-appindicator3-dev \
  librsvg2-dev libhunspell-dev patchelf
```

Create native packages with `cargo tauri build` (Windows memory-conscious
build: `powershell -File scripts/build-windows.ps1`). Run the same checks
used by continuous integration:

```bash
node scripts/check-docs.mjs
node settings-ui/settingsAcl.test.mjs
node settings-ui/theme.test.mjs
node settings-ui/comboToAccelerator.test.mjs
node src-tauri/resources/bridge.test.mjs
node src-tauri/resources/chat-theme.test.mjs
cd src-tauri
cargo fmt --all -- --check
cargo test --lib
cargo clippy --locked --all-targets -- -D warnings
```

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
- Open **Settings > About** — it must read `WhatsNow 2.6.0`.
- Verify calling: initiate a call popup and confirm it appears in a resizable,
  always-on-top window.
- Verify link routing: clicking `wa.me` links opens known contacts in place
  without reload.
- Check the tray, taskbar badge, external-link routing, drag-and-drop, and
  App Lock on lock-on-hide.

**📚 Documentation**

| Document | What you'll find |
| --- | --- |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute, report issues, and propose enhancements |
| [TRADEMARK.md](TRADEMARK.md) | Brand and attribution guidelines |
| [RELEASE_NOTES.md](RELEASE_NOTES.md) | What's new in v2.6.0 and full version history |
| [CHANGELOG.md](CHANGELOG.md) | Detailed changelog, one entry per release |
| [INSTALLATION.md](docs/INSTALLATION.md) | Packages, scripts, updates, portable use, and uninstall |
| [FEATURES_AND_COMPARISON.md](docs/FEATURES_AND_COMPARISON.md) | Features and app comparison |
| [PLATFORM_SUPPORT.md](docs/PLATFORM_SUPPORT.md) | Platform support and limitations |
| [WINDOWS.md](docs/WINDOWS.md) | Windows memory-conscious build notes |
| [SECURITY_AND_VERIFICATION.md](docs/SECURITY_AND_VERIFICATION.md) | Download verification and release signing |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common platform and runtime problems |
| [GITHUB_DESKTOP_PUBLISHING.md](docs/GITHUB_DESKTOP_PUBLISHING.md) | Publish the release with GitHub Desktop |
| [PUBLISHING.md](docs/PUBLISHING.md) | Complete release publish workflow |
| [RELEASING.md](docs/RELEASING.md) | Release quality gate: checks, pillars, signing |
| [SECURITY.md](SECURITY.md) | Private vulnerability reports and security policy |
| [SUPPORT.md](SUPPORT.md) | Bug reports, feature requests, and diagnostics |

**Author**

WhatsNow is authored, created, and maintained solely by
**Benedictus Reynaldo Hartanto** ([@benedictusrey](https://github.com/benedictusrey)),
released under the [MIT License](LICENSE). Required retained-code and dependency
notices appear in [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES). See [TRADEMARK.md](TRADEMARK.md)
for brand and attribution guidelines. The project is intentionally independent from
WhatsApp LLC and Meta Platforms, Inc. Contributions and reproducible bug reports
are warmly welcomed!
