# Contributing to WhatsNow

Welcome! We are thrilled that you are interested in contributing to **WhatsNow**.

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey). Released under the
[MIT License](LICENSE).

WhatsNow was built with a clear purpose: to transform WhatsApp on the desktop
into a calm, distraction-free, ultra-lightweight, and beautifully integrated
operating system experience. We welcome developers, designers, technical
writers, and enthusiastic users from all backgrounds to help refine, enhance,
and grow this project.

Whether you're fixing a subtle UI glitch, optimizing memory consumption,
expanding Linux or macOS support, improving accessibility, or refining
documentation — every thoughtful contribution matters!

---

## Table of Contents

- [Code of Conduct & Community Values](#code-of-conduct--community-values)
- [How Can You Help?](#how-can-you-help)
- [The Four Locked Pillars (Please Read!)](#the-four-locked-pillars-please-read)
- [Local Development Setup](#local-development-setup)
- [Running Checks & Tests](#running-checks--tests)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Security & Privacy Standards](#security--privacy-standards)
- [Authorship & Attribution](#authorship--attribution)

---

## Code of Conduct & Community Values

We strive to maintain an open, friendly, and welcoming environment:

- **Be respectful and constructive:** Treat everyone with kindness. Diverse
  perspectives lead to better software.
- **Calm by design:** WhatsNow prioritizes focus and unobtrusiveness. We avoid
  noisy alerts, visual clutter, and unnecessary telemetry.
- **Privacy first:** WhatsNow never routes messages through intermediate
  servers, never gathers analytics, and never logs private message contents or
  tokens. All contributions must uphold this principle strictly.

---

## How Can You Help?

There are many ways to make an impact, regardless of your programming
experience:

1. **🐛 Bug Reports & Reproductions**
   - Found an issue? Open an issue on GitHub with your OS version, WhatsNow
     version, reproduction steps, and expected vs. actual behavior.
   - If WhatsApp Web updates its DOM and affects styling or routing, capturing
     the new DOM testids and behavior is immensely valuable.
2. **💡 Ideas & Feature Discussions**
   - Have a feature proposal? Start a GitHub Issue or Discussion first so we can
     align on design, user experience, and architectural feasibility before you
     invest time in code.
3. **🎨 Themes & UI Polishing**
   - Help expand or refine our personality color palettes, dark mode contrast,
     and custom CSS variables in `settings-ui/`.
   - Ensure high contrast and accessibility standards across diverse screen
     types and color vision profiles.
4. **🦀 Rust & Tauri Engineering**
   - Enhance native OS integrations (Windows notifications, macOS Dock and menu
     bar behaviors, Linux desktop environments and Wayland hotkeys).
   - Optimize memory governance, background throttling, and IPC throughput.
5. **🐧 Cross-Platform Packaging & Testing**
   - Test new builds across various Linux distributions (Ubuntu, Fedora, Arch,
     Debian), desktop environments (GNOME, KDE, XFCE), and macOS versions (Apple
     Silicon & Intel).
6. **📖 Documentation & Guides**
   - Clarify installation procedures, update troubleshooting steps, or add
     guides for specific desktop environments and window managers.

---

## The Four Locked Pillars (Please Read!)

WhatsNow has four foundational behaviors that have been meticulously refined and
battle-tested across numerous releases. These are **strictly protected** against
accidental regression:

1. **Themes & Doodle Wallpaper Separation:**
   - Official themes (`System`, `Dark`, `Light`) must **always** render
     WhatsApp's native doodle wallpaper.
   - The eight personality themes (`midnight`, `forest`, `graphite`, `ocean`,
     `blush`, `lavender`, `candy`, `aurora`) must **completely hide** doodles
     across all layers (including the Reply curtain, composer, and quote bars).
2. **Typing-Area Emoji Rendering:**
   - Emojis typed into the composer are rendered as inline background sprites by
     WhatsApp. The doodle kill-switch and styling rules must **never** wipe
     these sprites. Emojis must remain clearly visible in every theme.
3. **Compact Float Notifications:**
   - Windows notification banners and action center toasts must always use the
     clean, compact layout (small identity icon next to the app name). No large
     left-side square icons (`appLogoOverride` must never be added to the toast
     XML).
4. **Trusted Click-to-Chat Routing:**
   - Clicking a toast or notification-center entry must open the sender's chat
     using host-level trusted CDP clicks (`Input.dispatchMouseEvent`) targeting
     the smallest matching row element. Synthetic in-page `.click()` does not
     navigate WhatsApp's virtualized list and must not be used.

Before touching code related to themes, emojis, notifications, or deep links,
please review `AGENTS.md` and `docs/EMOJI_FIX.md` for architectural context.

---

## Local Development Setup

### 1. Prerequisites

- **Rust:** Version 1.82 or newer ([rustup.rs](https://rustup.rs/)).
- **Node.js:** Version 20 or newer ([nodejs.org](https://nodejs.org/)).
- **Tauri CLI:** Install the precompiled CLI globally:
  ```bash
  npm install -g @tauri-apps/cli@^2
  ```

### 2. Platform Dependencies (Linux)

Debian and Ubuntu systems require the following native development libraries:

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  libssl-dev \
  patchelf \
  xdg-utils \
  libfuse2 \
  libxdo-dev \
  libdbus-1-dev \
  build-essential \
  curl wget file
```

*(Fedora / Arch users: install equivalent packages for `webkit2gtk-4.1`,
`libayatana-appindicator3`, and `librsvg`.)*

### 3. Running the App in Development

Clone your fork and launch the development environment:

```bash
# Launch WhatsNow with hot-reloading for settings-ui and Rust auto-compilation
cargo tauri dev
```

---

## Running Checks & Tests

Before opening a Pull Request, please ensure all automated test suites and
linters pass cleanly. Continuous Integration enforces these checks:

```bash
# 1. Rust code formatting and unit tests
cd src-tauri
cargo fmt --all -- --check
cargo test --lib
cargo clippy --locked --all-targets -- -D warnings
cd ..

# 2. Node.js DOM bridge and Settings UI tests
node settings-ui/settingsAcl.test.mjs
node settings-ui/theme.test.mjs
node settings-ui/comboToAccelerator.test.mjs
node src-tauri/resources/bridge.test.mjs
node src-tauri/resources/chat-theme.test.mjs
node src-tauri/resources/toast-route.test.mjs

# 3. Documentation integrity check (authorship, links, path checks)
node scripts/check-docs.mjs
```

### Tip: Line Endings

The repository maintains standard Windows CRLF line endings for compatibility.
If your editor converts files to LF, run `unix2dos` or a normalization script
prior to committing.

---

## Submitting a Pull Request

Follow these steps to propose a change:

1. **Fork & Branch:** Create a dedicated branch in your fork with a clear name
   (e.g., `git checkout -b fix/linux-notification-tray` or
   `git checkout -b feat/nord-theme`).
2. **Keep Commits Focused:** Write clear, concise commit messages explaining
   *what* changed and *why*.
3. **Verify Locally:** Run the checks detailed above.
4. **Open the PR:** Use the provided Pull Request template.
   - Describe the problem solved and the user-visible result.
   - Specify which platforms were tested (Windows, macOS, Linux).
   - If UI changes were made, attach before/after screenshots (ensure **all
     private chats, contact names, and phone numbers are redacted or use mock
     data**).
5. **Review & Iterate:** We will review your PR, provide constructive feedback,
   and guide it toward merging!

---

## Security & Privacy Standards

WhatsNow handles communication software, which demands uncompromising security:

- **No Remote Credential Access:** The remote WhatsApp bridge (`bridge.js`)
  must never have access to local file paths, App Lock passwords, or arbitrary
  system commands. Tauri IPC commands must remain strictly scoped through
  capabilities (`capabilities/*.json`).
- **Zero Logging of Sensitive Data:** Never log message texts, attachment
  contents, chat identifiers, phone numbers, passwords, or cookies.
- **Vulnerability Reporting:** If you discover a security vulnerability, please
  **do not** open a public issue. Instead, report it privately through
  GitHub's Security Advisory tab or follow [SECURITY.md](SECURITY.md).

---

## Authorship & Attribution

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey). All contributions accepted
into the repository are preserved and permanently credited through Git commit
history, changelogs, and release acknowledgments.

Thank you for helping make WhatsNow even better for everyone! Happy coding! 🚀
