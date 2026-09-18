# WhatsNow 2.6.0 release notes

WhatsNow is authored, created, and maintained solely by
**Benedictus Reynaldo Hartanto** ([@benedictusrey](https://github.com/benedictusrey)).

Official Repository: [`https://github.com/benedictusrey/WhatsNow-for-WhatsApp`](https://github.com/benedictusrey/WhatsNow-for-WhatsApp)  
Copyright (c) 2026 Benedictus Reynaldo Hartanto (@benedictusrey). Released under the [MIT License](LICENSE).

---

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

## Complete Historical Changelog

For the complete chronological version history from v1.0.0 through v2.6.0, please refer to [CHANGELOG.md](CHANGELOG.md).
