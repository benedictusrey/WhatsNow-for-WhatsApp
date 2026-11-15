<p align="center">
  <img src="docs/assets/WhatsNow%20hero.png" alt="WhatsNow concept artwork: a dedicated WhatsApp Web workspace with accounts, Focus, themes, and App Lock" width="100%">
</p>

<h1 align="center">WhatsNow</h1>

<p align="center">
  <strong>Keep conversations close, without losing your focus.</strong><br>
  A dedicated desktop workspace for WhatsApp Web · Tauri v2 + Rust
</p>

<p align="center">
  <a href="https://github.com/benedictusrey/WhatsNow-for-WhatsApp/releases"><img alt="GitHub releases" src="https://img.shields.io/github/v/release/benedictusrey/WhatsNow-for-WhatsApp?display_name=tag"></a>
  <img alt="Version 2.7.0" src="https://img.shields.io/badge/version-2.7.0-087a60">
  <img alt="Windows macOS Linux targets" src="https://img.shields.io/badge/targets-Windows%20%7C%20macOS%20%7C%20Linux-213547">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-6B9E3A"></a>
  <a href="https://github.com/benedictusrey"><img alt="Author benedictusrey" src="https://img.shields.io/badge/author-%40benedictusrey-111827"></a>
</p>

<p align="center">
  <a href="https://github.com/benedictusrey/WhatsNow-for-WhatsApp/releases">Downloads</a> ·
  <a href="WhatsNow_latest.md">All features</a> ·
  <a href="docs/INSTALLATION.md">Installation</a> ·
  <a href="docs/IMPLEMENTATION_v2.7.0.md">v2.7.0 changes</a> ·
  <a href="SECURITY.md">Security</a>
</p>

WhatsNow adds desktop tools around the official WhatsApp Web service: named
account spaces, quiet Focus sessions, personal themes, a local app lock, and
native notifications. It is created and maintained by Benedictus Reynaldo
Hartanto ([@benedictusrey](https://github.com/benedictusrey)) and is not affiliated
with WhatsApp or Meta.

> **v2.7.0:** a UX and reliability update: windows open centered, Settings
> saves instantly, and notifications stay in sync with the Windows Action Center.
> Native tests passed; live checks on a signed-in account (calls, toasts after a
> phone read) are listed in the [implementation record](docs/IMPLEMENTATION_v2.7.0.md).
> Download only files actually attached to a published release.
> The artwork is illustrative, not a pixel-exact screenshot or a security certification.

## 📋 What's new

Every release's changes are listed on its
[GitHub release page](https://github.com/benedictusrey/WhatsNow-for-WhatsApp/releases),
next to the downloads. The latest is
[v2.7.0](https://github.com/benedictusrey/WhatsNow-for-WhatsApp/releases/tag/v2.7.0).
Live service behavior is still subject to WhatsApp Web changes.

## 💬 Your conversations, with room to focus

![Illustration of WhatsNow account spaces, Focus controls, themes, App Lock, file sharing, and desktop preferences](docs/assets/WhatsNow%20features.png)

*Feature overview artwork. The illustrations simplify the actual controls;
biometric availability and service features depend on the platform and account.*

| Tool | What it adds |
| --- | --- |
| Accounts | Separate named sessions with open, rename, mute, and remove controls |
| Focus | Presets plus custom quiet intervals from 1 minute to 24 hours |
| Native alerts | Message previews or private generic text; sender-chat activation |
| Attachments | Drag-and-drop into the active chat, validated batches, confirmation before sending |
| App Lock | Locally hashed password, launch/hide/idle locking, optional supported OS authentication |
| Desktop preferences | Close to tray, startup launch, start minimized, always-on-top, configurable shortcut |

WhatsApp Web supplies the underlying chats, groups, communities, replies,
reactions, and other service features. WhatsNow does not independently implement
the WhatsApp protocol. Calling, media quality, and account features depend on
WhatsApp, its rollout, and the system webview.

## 🎨 A workspace that feels like yours

![WhatsNow theme and tray concept artwork showing official Dark and Light alongside eight personality themes](docs/assets/WhatsNow%20themes-tray.png)

*Appearance and tray illustration. Official Dark/Light retain WhatsApp doodles;
personality themes suppress them. Actual tray menus can vary by platform.*

Choose **Dark, Light, Graphite, Midnight, Forest, Ocean, Blush, Lavender,
Candy, or Aurora**. Theme changes are applied without visibly navigating through
your profile. Existing composer and emoji protections remain intact.

Use the tray for quick access and **Quit** when you want to stop background
accounts. Default show/hide shortcuts are Windows `Alt+W`, macOS `Option+W`,
and Linux `Ctrl+Alt+W`; all can be changed in Settings.

## ⚡ A small host—not a fixed RAM promise

![Historical process-view illustration comparing an Edge tab at 173.2 MB with a WhatsNow host group at 6.8 MB](docs/assets/WhatsNow%20performance.png)

**Read this comparison carefully:** the graphic reuses historical process
snapshots with different login states and process groupings. The **6.8 MB**
figure does **not** establish WhatsNow's total memory use; WebView2 browser,
renderer, GPU, and utility processes may appear elsewhere. This is not a
controlled benchmark or proof of a universal advantage over Edge or the official app.

The 2.7.0 Windows build keeps WebView2 at normal memory priority even when
hidden/minimized, favoring background media over RAM reclamation. Background
connections are not deliberately suspended. Measure
the complete process tree under a comparable workload. See [Windows notes](docs/WINDOWS.md).

## 📦 Choose your package

| Platform | v2.7.0 installer (one per OS) | Requirement |
| --- | --- | --- |
| Windows x64 | `WhatsNow_2.7.0_windows_x64-setup.exe` | Updated Microsoft Edge WebView2 |
| macOS (Apple Silicon and Intel) | `WhatsNow_2.7.0_macos_universal.dmg` | macOS 12.1+ |
| Linux x64 | `WhatsNow_2.7.0_linux_x86_64.AppImage` (`chmod +x` after download) | Compatible WebKitGTK distribution |

Multiple isolated macOS accounts require macOS 14+. Native builds and
installation checks must complete before a target is described as an available
download. All final packages must come from the same committed revision.

1. Open [Releases](https://github.com/benedictusrey/WhatsNow-for-WhatsApp/releases)
   and choose a package actually attached to the release.
2. Verify its SHA-256 checksum and inspect the disclosed signature status.
3. Install/run it, then link your phone using WhatsApp's **Linked devices**.
4. For upgrades, fully quit the tray app first; replacing a binary normally
   preserves per-user sessions and preferences.

See [Installation](docs/INSTALLATION.md) and [Platform support](docs/PLATFORM_SUPPORT.md).
Portable Windows mode deliberately skips protocol/installer-style identity
registration; prefer setup/MSI for desktop link and notification integration.

## 🔐 Privacy, trust, and practical limits

- The reviewed source adds no project-operated chat relay, analytics SDK, or
  advertising SDK. WhatsApp Web still communicates with WhatsApp, and local
  webview profiles retain session data.
- App Lock protects window access; it does not encrypt profiles on disk.
  Use OS full-disk encryption when needed.
- Native notifications may expose previews on a lock screen or retain them in
  OS history. Disable previews on shared devices.
- The preview preference defaults to 2 seconds, but **Windows controls actual
  banner timing**. Exact-second dismissal is not guaranteed.
- Windows release packages are **unsigned**. Checksums establish byte
  integrity, not publisher identity, malware clearance, or independent security review.
- Keep antivirus and OS protections enabled; do not add broad exclusions.

Read [Privacy](PRIVACY.md), [Security](SECURITY.md), and
[Support](SUPPORT.md). Do not post messages, phone numbers, cookies, session
profiles, or private screenshots in public issues.

## 🔧 Development and release records

The repository now contains the application source, Settings UI, scripts, and
CI workflows. The Desktop `WhatsNow` folder is the canonical checkout.
Build caches, recovered Git metadata, historical snapshots, and credentials
remain local-only. See [workspace layout](docs/WORKSPACE_LAYOUT.md).

Start with [Contributing](CONTRIBUTING.md) and the platform prerequisites in
[Installation](docs/INSTALLATION.md). Native packaging uses
`cargo tauri build`; Windows installer/portable packaging is also available
through `scripts/build-windows.ps1`.

For release work, follow [the acceptance checklist](docs/IMPLEMENTATION_v2.7.0.md).
The workflow builds all platform packages from one revision and creates a
**draft**, not an automatically published release. Preserve the pending live
checks until they are actually confirmed.

## 🔗 Project and license

Created and maintained by **Benedictus Reynaldo Hartanto**
([@benedictusrey](https://github.com/benedictusrey)).
Settings uses the concise name **Benedictus RH**.

[MIT License](LICENSE) · [Third-party and retained notices](THIRD_PARTY_NOTICES) ·
[Releases](https://github.com/benedictusrey/WhatsNow-for-WhatsApp/releases) · [Artwork notes](docs/assets/README.md)
