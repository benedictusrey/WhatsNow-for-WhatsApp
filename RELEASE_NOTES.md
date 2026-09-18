<!-- PRIVATE developer-facing cumulative release notes. The PUBLIC repo's
     RELEASE_NOTES.md is the GitHub release body and must contain ONLY the
     current version's section -- never copy this whole file over it.
     Keep public release history in the public CHANGELOG.md only. -->

# WhatsNow 2.6.0 release notes

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

Copyright (c) 2026 @benedictusrey. Released under the [MIT License](LICENSE).

## What's in 2.6.0

Version 2.6.0 builds upon the four locked pillars established in v2.5.0 and introduces full WhatsApp-family link routing, dedicated calling windows, resolution-safe geometry, freeze-safe popup architectures, and restored official dark doodles:

1. **Dark Doodles Restored Across Official Themes:**
   - In 2.5.0, the Settings "Dark" theme was persisted as `system`, which inadvertently triggered the doodle kill-switch.
   - `settings.rs` now enforces an explicit deny-list of the 8 personality themes (`midnight`, `forest`, `graphite`, `ocean`, `blush`, `lavender`, `candy`, `aurora`). All official themes (`System`, `Light`, `Dark`) reliably render WhatsApp's doodle wallpaper.
2. **Native WhatsApp Web Calling Windows:**
   - WhatsApp Web Calling (2026) `window.open` requests now spawn a real, independent, resizable, and maximizable window set to always-on-top.
   - The call window shares the opener's webview session (`with_environment` on Windows, `with_webview_configuration` on macOS, `with_related_view` on Linux), keeping WebRTC media streams and per-account isolation intact.
3. **Popup Media & Window Management Permissions:**
   - Microphones, cameras, and window management (PiP / pop-out controls) are automatically granted for call popups created after startup.
4. **Resolution-Safe Window Geometry Clamping:**
   - Default dimensions for Chat (1100×800) and Settings (760×820) are automatically clamped to 96% of the primary display's work area, preventing off-screen controls on compact laptops (1366×768) and high-DPI scaling configurations.
5. **Seamless WhatsApp-Family Link Routing:**
   - 8 verified WhatsApp hosts (`web.whatsapp.com`, `wa.me`, `chat.whatsapp.com`, `call.whatsapp.com`, `www.whatsapp.com`, `whatsapp.com`, `api.whatsapp.com`, `event.whatsapp.com`, `v.whatsapp.com`) remain inside WhatsNow.
   - `wa.me/<phone>` navigates directly to the contact in place via trusted CDP click; `chat.whatsapp.com` group invites navigate in place; other family URLs open in the reusable `wa-content` popup; call URLs open in dedicated call windows. Foreign domains and look-alike hosts route to the external default browser.
6. **Freeze-Proof Reusable Content Popup:**
   - The reusable content popup is pre-created hidden at startup. Popup requests execute an instant `location.replace` and show command, eliminating synchronous WebView2 construction deadlocks inside `NewWindowRequested`.
7. **Windows `whatsapp://` Protocol Handler:**
   - `protocol.rs` registers `HKCU\Software\Classes\whatsapp` at every launch (skipped in portable mode; safe no-op on macOS/Linux), allowing desktop-wide `whatsapp://send?phone=...` deep links to seamlessly raise WhatsNow and open chats.
8. **Video/Audio Memory Target Guard:**
   - WebView2's LOW memory target is strictly restricted to hidden or minimized states, preventing audio graph discard while watching videos in unfocused windows.
9. **UI Fluency & Promo Coalescing:**
   - Mutation observer rooted at `document` with coalesced sweep timers ensures zero UI stutter during rapid DOM changes.

---

# WhatsNow 2.5.0 release notes

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

Copyright (c) 2026 @benedictusrey. Released under the [MIT License](LICENSE).

## What's in 2.5.0

- Version 2.5.0 is the locked, verified state of the four user-required
  behaviors, packaged as a fresh release:
  1. **Themes + doodle mapping** — official `Dark`/`Light` show WhatsApp's
     doodle wallpaper; every personality theme hides it. Theme palettes and
     per-theme CSS are untouched.
  2. **Typing-area emoji** — emojis render in every theme (the doodle
     kill-switch's emoji exclusions are LOCKED).
  3. **Float notifications** — every toast uses the compact layout (small
     icon + "WhatsNow" name), never the large-left-icon banner.
  4. **Click-to-chat routing** — clicking a toast or a notification-center
     entry opens the sender's chat (trusted CDP click + smallest-match row
     discovery + ACL registration, all LOCKED).
- **Fixed in this release:** doodles could still flash on personality themes
  (Graphite through Aurora) while the Reply preview bar slid up. WhatsApp
  2.24xx+ paints the default doodle wallpaper as a CSS mask on
  `conversation-background-*` layers and renamed the composer testid to
  `compose-box`; the kill-switch now neutralizes the mask layer (with
  emoji/compose exclusions) and covers both composer testids. Verified live.
- **Fixed in this release:** Settings > About no longer shows a stale
  version. The About card and footer previously carried a hardcoded
  "WhatsNow 2.0.1" label; the version is now injected from the compiled
  package at runtime (fills every `[data-version-ref]` element), so it can
  never drift from the binary again. Verified live: "WhatsNow 2.5.0".
- Backups of all four pillars live in `backup/v2.5.0-locked/` (and the
  earlier `backup/emoji-fix-v2.0.1/`), with restore instructions in their
  READMEs. AGENTS.md section 0 "The four pillars" pins the guardrails.

---

# WhatsNow 2.0.1 release notes

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

Copyright (c) 2026 @benedictusrey. Released under the [MIT License](LICENSE).

## What's fixed in 2.0.1

- **Emojis render again in the typing area.** On the official Dark theme and
  every personality theme (midnight through aurora), typed emojis in the
  composer and the emoji picker are visible again. The root cause was not the
  theme palettes: WhatsApp draws each typed emoji as an inline
  `background-image` sprite (`span.emoji` with a `url(.../emoji/...)`
  background and transparent fallback text), and the doodle kill-switch's
  wallpaper blanket bypass was wiping those sprite backgrounds under every
  doodle-disabled theme (System and all personality themes). Light and Dark
  were unaffected because they keep WhatsApp's official doodles enabled. The
  blanket bypass now exempts emoji-sprite elements (by style URL and class)
  alongside the emoji/compose surfaces it already spared. WhatsNow also no
  longer forces a document-wide `color-scheme` onto the WhatsApp page —
  personality themes restate a scoped `color-scheme` only on the surfaces
  they restyle. No per-theme palette was changed.
- **Windows notifications are cleaner and clickable.** Every toast now uses
  the compact layout — a small WhatsNow icon beside the "WhatsNow" name, no
  large banner. The cause of the big-left-icon toasts was the per-toast
  `appLogoOverride` image: Windows draws any toast carrying one with the
  large app icon on the left, and a toast without it in the compact layout
  (verified live). The per-toast image was removed; the small icon always
  comes from the app identity (a 48×48 version of the same logo — the old
  512×512 source could also be drawn large). And clicking a toast — or a
  message in the Windows notification center — now reliably opens the
  sender's chat. WhatsApp Web ignores programmatic page clicks, so routing
  synthesizes a real trusted click through the host (WebView2 DevTools
  Protocol Input domain) at the chat row's coordinates — and two further
  bugs found in live testing were fixed: the `notification_click` command is
  now registered in both `build.rs` and `main-remote.json` (Tauri previously
  rejected it by ACL, silently falling back to the ignored page click), and
  the row finder now picks the SMALLEST matching chat row instead of
  WhatsApp's giant chat-list wrapper container, whose center sat thousands
  of pixels off-screen. Verified end-to-end: a toast click for a sender
  opens that sender's conversation (tested live with Angelineku and Mama).

---

# WhatsNow 1.5.0 release notes

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

Copyright (c) 2026 @benedictusrey. Released under the [MIT License](LICENSE).

WhatsNow 1.5.0 is the latest release of the focused, multi-account WhatsApp
Web desktop workspace with native productivity, privacy, notification,
app-lock, and personalization tools.

## What's new in 1.5.0

- **Toast clicks open the sender's chat.** A message notification now carries
  the sender's identity (name, chat id, message id), so clicking it jumps
  straight into that conversation — even when the app was fully closed and
  Windows has to relaunch it. No more landing on whatever chat was last open.
- **Launch at startup by default.** WhatsNow starts with Windows (hidden to
  the tray) out of the box, so messages keep arriving and one click on a
  toast brings you to the conversation. Turn it off any time in
  Settings > Preferences.
- Chat routing is verified and retried against the live page, and message
  previews stay private: when previews are disabled, no message content ever
  enters the toast payload.

## Since the baseline (1.0.0)

- Separate sessions for personal, work, and project accounts.
- A redesigned Settings workspace and quick Focus presets.
- Ten readable themes that style Settings and the live chat workspace.
- Background-only native notifications with privacy controls,
  direct/group/community preview extraction, and a delivery test.
- A clean hidden-tray icon, with unread counts kept on supported taskbars and
  in the tray tooltip.
- `Alt+W` as the default Windows show/hide shortcut, with adjacent alternatives
  for macOS and Linux.
- Optional app lock, autostart (now on by default), close-to-tray,
  always-on-top, file download, and bounded drag-and-drop support.
- Automatic `WhatsNow — Profile Name` native titles.
- External links routed to the operating system's browser selection.
- Refreshed Windows taskbar/Start-menu identity and direct drop confirmation
  without flashing the Attach menu or opening a second file-picker window.
- Flash-free, pre-themed Settings startup and an exact `WhatsNow.exe` portable
  filename.
- Native Windows toast delivery for installed and portable builds, without a
  separate WhatsNow notification window.
- Click-through native Windows toasts that restore the correct account and open
  the originating direct, group, or community chat, with exact configured
  on-screen duration.
- Cancellation-safe file drops that retain the originating active chat.
- Official Dark and Light modes with WhatsApp's native doodles.
- Doodle-free personality wallpapers that apply without navigating the WhatsApp
  settings page.
- An untouched WhatsApp composer and Reply card, preserving official curvature,
  spacing, controls, and light/dark colors.
- Notifications limited to newly received messages, without startup or repeated
  historical-unread alerts.
- Complete local permissions and verified Save Changes behavior across Appearance,
  Notifications, Preferences, Focus, and Security.
- Immersive personality wallpapers without changing message or composer surfaces.
- Lock-to-tray behavior that waits to request an unlock until WhatsNow is restored.
- A cleaner chat list without the official-app download promotion.
- GitHub-ready installation, privacy, security, troubleshooting, support, and
  contributor documentation with branded project artwork.

## Downloads

- Windows x64: NSIS setup, MSI, and portable executable.
- macOS: Apple silicon and Intel DMG/app archives.
- Linux x64: AppImage and Debian package.

Verify the SHA-256 digest shown with each release asset. Windows users should
also check the Authenticode signature before launch. See
[SECURITY.md](SECURITY.md).

## Compatibility

- Windows 10/11 with Microsoft Edge WebView2.
- macOS 12.1 or newer; macOS 14 or newer for multiple isolated accounts.
- Linux with WebKitGTK 2.46.1 or newer.

WhatsNow is authored solely by
[@benedictusrey](https://github.com/benedictusrey), released under the
[MIT License](LICENSE), and is not affiliated with WhatsApp LLC or Meta
Platforms, Inc.
