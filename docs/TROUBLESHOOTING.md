# Troubleshoot WhatsNow

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

Copyright (c) 2026 @benedictusrey. Released under the
[MIT License](../LICENSE).

## Settings do not load or save

Install the newest WhatsNow release. Version 1.0.0 includes explicit local
permissions for Appearance, Notifications, Preferences, Focus, Security, and
Accounts.

Close every WhatsNow process before updating. Open Settings again and look at
the status message beside **Save Changes**. It reports persistence, shortcut,
autostart, window, and live theme errors.

## Emojis don't show in the composer (typing area)

WhatsApp draws typed emoji as inline background-image sprites; the doodle
kill-switch's blanket wallpaper bypass must never wipe them. This was fixed
in 2.0.1 and is LOCKED (AGENTS.md section 5, docs/EMOJI_FIX.md). If emojis
ever disappear again on System / personality themes, check the
`:not([style*='/emoji/'])` exclusions in the kill-switch stylesheet
(bridge.js) — do not touch theme palettes.

## A theme changes Settings but not chats

Press **Save Changes** after selecting a theme. WhatsNow applies the saved
palette to each open account window. Reload an account window if WhatsApp Web
replaced its page during the change.

Dark and Light preserve WhatsApp's official chat UI and native doodle wallpaper.
Midnight, Forest, Graphite, Ocean, Blush, Lavender, Candy, and Aurora change
only the conversation wallpaper and suppress doodles. Aurora uses a soft
pastel gradient.

## Personality themes still show doodles (e.g. while Replying)

WhatsApp 2.24xx+ paints the default doodle wallpaper as a CSS **mask**, not a
background-image: a full-bleed layer with testid
`conversation-background-default_chat_wallpaper` carries an inline
`mask-image: url(...voSdkk88H7C.svg)` pattern (doodle shapes) over a
translucent white tint. The older `data-asset-chat-background` attribute and
the `conversation-compose-box-container` testid no longer exist in that DOM,
so an old kill-switch could leave the mask visible on dark palettes and while
the Reply preview bar slides up ("curtain" effect).

Fixed in 2.5.0: the kill-switch (bridge.js `whatsnow-no-wallpaper-doodles`)
now zeroes `mask-image` / `-webkit-mask-image` (and the tint it shapes) on
`[data-testid*='conversation-background']`, `[data-testid*='chat-background']`,
`[data-testid*='wallpaper']`, `[data-testid*='doodle']`, plus a belt-and-
suspenders inline-mask rule that excludes emoji/compose surfaces, and it
covers both the legacy `conversation-compose-box-container` and the current
`compose-box` composer testids. This is LOCKED (AGENTS.md section 1) — never
restore per-theme CSS or remove the mask rule. Light and Dark intentionally
keep WhatsApp's doodles.

## Notifications make sound without a popup

1. Turn on **Native notifications** in WhatsNow Settings.
2. Check the account's mute state under **Accounts**.
3. End Focus mode.
4. Confirm Windows or macOS allows WhatsNow notifications.
5. Press **Send test notification**.

Disable preview privacy only if you want sender and message text in operating
system banners. App lock suppresses message notifications until you unlock
WhatsNow.

WhatsNow does not create a separate notification window. If the test fails,
check Windows **System > Notifications**, Focus Assist/Do Not Disturb, and the
WhatsNow notification permission.

## The toast shows a big icon / banner on the left

Windows draws any toast whose XML carries an `appLogoOverride` image with
the LARGE app icon on the left; without it, the toast uses the compact layout
(small identity icon next to the app name). Fixed in 2.0.1 by removing the
per-toast `appLogoOverride` from the toast XML — every toast is now compact.
If a big banner ever returns, check that `notify.rs`'s toast XML contains no
`<image placement="appLogoOverride">` element, and that the AUMID IconUri
still points at `%LOCALAPPDATA%\WhatsNow\icons\whatsnow-toast.png`
(all-backslash path). The small icon in the compact layout comes from that
identity file.

## Clicking a notification opens the wrong chat (or nothing)

WhatsApp Web ignores untrusted page-side clicks on its chat list, so routing
must synthesize a trusted click from the host. Fixed in 2.0.1 via the
`notification_click` command (CDP `Input.dispatchMouseEvent` at the chat
row's coordinates). Two further bugs were found in live testing and fixed:

1. **ACL registration.** `notification_click` was missing from BOTH
   `src-tauri/build.rs` (the `AppManifest` command list) and
   `src-tauri/capabilities/main-remote.json`. Tauri therefore rejected the
   bridge's request ("Command notification_click not allowed by ACL") and
   routing silently fell back to the ignored page-side `.click()`. If it
   regresses, confirm the command is in both files and that
   `settings-ui/settingsAcl.test.mjs` passes.
2. **Giant-wrapper row match.** WhatsApp's chat list puts a huge wrapper
   container (the whole list body, tens of thousands of px tall) into the
   row selector set; its descendants carry the sender's title, so a
   first-match finder clicked the wrapper's center — far off-screen
   (verified live: trusted clicks at y=19519 for a row visible at y=238).
   The finders now pick the SMALLEST matching element by bounding area, and
   `requestTrustedClick` refuses coordinates outside the viewport.

If clicking a toast ever stops navigating again, check that `bridge.js`'s
`clickNotificationChatRow` requests a trusted click instead of calling
`.click()`, that the finder still prefers the smallest matching row, and
that `toast-route.test.mjs` still asserts the `notification_click`
invocation and the giant-wrapper case. Notification-center entries use the
same code path.

## Unread badges do not update

Keep WhatsNow running in the tray. WhatsNow reads both WhatsApp's window-title
count and accessible unread labels. A WhatsApp Web markup change can delay one
path while the other continues.

Open the affected account, wait for WhatsApp Web to finish loading, then receive
or mark one message read. Include the content-free diagnostic log in a bug
report if the badge remains stale.

## A new account opens blank

Wait for the first WhatsApp Web page load. WhatsNow keeps a new account window
hidden until the page finishes and then shows the login screen.

Windows needs Microsoft Edge WebView2. Linux needs WebKitGTK 2.46.1 or newer.
Multiple isolated accounts require macOS 14.

## The global shortcut does not work

Another application may own the same key combination. Restore the platform
preset in Preferences:

- Windows: `Alt+W`
- macOS: `Option+W`
- Linux: `Ctrl+Alt+W`

Wayland compositors can block application-level global shortcuts. Bind
`whatsnow --toggle` in the desktop environment's keyboard settings.

## Links do not open

Set a default browser in the operating system. WhatsNow sends external HTTP and
HTTPS links to that browser flow and blocks `file://` navigation from WhatsApp
Web.

## File drag-and-drop opens a native picker

Update WhatsNow and drop files onto the chat area. WhatsNow streams bounded
files into WhatsApp's attachment confirmation composer. It does not need the
native Open dialog.

## The Dark theme shows no doodles

The Settings "Dark" option is stored as the `system` value. Up to 2.5.0 the
doodle mapping only enabled WhatsApp's native doodle wallpaper for `light`
and `dark`, so "Dark" silently ran the doodle kill-switch. Fixed in 2.6.0:
every official theme (Dark/System, Light) shows doodles; every personality
theme (midnight through aurora) hides them. Verify in the diagnostic log:
the line `appearance: theme=System doodles=true` (or `Dark doodles=true`)
must appear after saving. If doodles are missing on Dark but the log says
`doodles=true`, reload the account window (WhatsApp may have replaced its
page head after the theme was applied).

## Video calls open tiny or cannot maximize

WhatsApp Web Calling opens its call stage through a browser popup; denying
popups wedges the call into the small in-page surface. Since 2.6.0 WhatsNow
creates a real, resizable, maximizable, always-on-top window for
`web.whatsapp.com` popups and attaches the microphone/camera auto-allow
handler to it. If a call ever opens tiny again, check the diagnostic log
for `call window: created for web.whatsapp.com popup` (the popup path ran)
versus nothing (WhatsApp served the in-page stage — expected for some
call types; the in-page stage's own expand control then applies).

## A WhatsApp link opened in my browser instead of WhatsNow

Links on the WhatsApp family — `web.whatsapp.com`, `wa.me`,
`chat.whatsapp.com`, `call.whatsapp.com`, `www.whatsapp.com`,
`whatsapp.com`, `api.whatsapp.com`, `event.whatsapp.com`,
`v.whatsapp.com` — opened inside WhatsNow stay in WhatsNow: `wa.me/<phone>`
jumps straight to the composer, invite links navigate the chat window, and
other family pages open in a popup window that shares your account session.
Every such move is SEAMLESS: the contact opens as an in-app SPA route — the
app does not reload, blank out, or rebuild the chat list; if you ever see a
full reload after clicking a WhatsApp link, note the link and attach it per
[SUPPORT.md](../SUPPORT.md) (a hard navigation is a regression). Two
boundaries are by design: look-alike hosts (e.g.
`web.whatsapp.com.evil.com`) and subdomains not on the list (e.g.
`faq.whatsapp.com`) still open your browser, and links clicked in OTHER apps
follow that app's rules (see the next section).

## A wa.me or whatsapp:// link from another app doesn't open WhatsNow

WhatsNow registers the `whatsapp://` scheme per-user at every launch, so
`whatsapp://send?phone=…` links from other apps open the WhatsNow composer —
again without reloading the app (the route is applied inside the loaded
window; the diagnostic log shows
`navigation: deep link applied to account window (in-page route)`).
Windows does not let a non-browser app claim per-host `https://` routing,
so an `https://wa.me/…` link clicked in another app or browser opens that
browser and its landing page launches the app — copy the number and paste
it into WhatsNow's composer, or use a `whatsapp://send?phone=…` link. If
`whatsapp://` links stopped opening the
app entirely (Windows shows an error or nothing happens), check the
diagnostic log for the `protocol: whatsapp:// registered` line at launch;
its absence means registration failed — reinstalling the app re-writes it.
Uninstalling WhatsNow leaves that one registry key
(`HKCU\Software\Classes\whatsapp`) behind; delete it to stop Windows from
offering WhatsNow for `whatsapp://` links.

## The window went black after opening a wa.me link (or an image preview is blank)

Both were fixed during the 2.6.0 link-routing work. A black window meant the
in-page move crashed WhatsApp's router and the app shell unmounted; the move
now uses WhatsApp's own anchor-click mechanism and a watchdog recovers with
a reload on the same route if the shell ever dies (you may see one normal
reload instead of a black screen — the contact still opens). A blank image
preview meant the doodle-disabled wallpaper blanket painted over WhatsApp's
own `blob:`/`data:` media previews; those are excluded now. If either
symptom reappears after a WhatsApp Web update, capture the diagnostic log
and reopen the link — the log line `navigation: deep link handed to account
window (open by phone)` must appear within a second; its absence with the
app raised means the delivery was dropped and should be reported.

## The whole app freezes ("Not Responding") when a link opens the content popup

Fixed in 2.6.0 (2026-09-17). The content popup was built synchronously
inside WebView2's new-window callback, which can deadlock the process; the
popup is now pre-created hidden at boot and the callback only navigates +
shows it. If a freeze ever reappears, note the log lines just before it —
`content popup: reused for a WhatsApp-family popup request` means the
navigate+show path ran (safe); a missing `content popup:` line right after
a `single-instance: whatsapp:// deep link` means the request went down the
fallback builder and should be investigated. Never reintroduce a
`WebviewWindowBuilder::build()` call inside `on_new_window` (see AGENTS.md
freeze rule) — the call-stage builder is the one deliberate exception.

## A shared video plays but has no sound (Windows)

Older `windows-memory` builds asked WebView2 to reclaim renderer memory
whenever the window lost FOCUS. Clicking play inside a video does not
re-raise the window-focus event, so a visible window could stay at the LOW
memory target — a best-effort reclaim that can swap browser-process memory
to disk (ICoreWebView2_19). The video kept painting while the swapped-out
audio graph played silence.

Fixed in the current build: LOW now applies only to windows you cannot watch
(minimized, or hidden to tray). Every visible window runs media at the
NORMAL target, focus or not, and returning a window from the tray re-applies
NORMAL before the first video plays. To confirm on an installed copy, check
the diagnostic log: focusing a restored window must log
`webview: Windows 10 memory target NORMAL`. If silence ever returns, record
whether the log said LOW while the window was clearly visible and attach it
per [SUPPORT.md](../SUPPORT.md).

## Voice messages or calls fail

Grant microphone permission to WhatsNow. WhatsApp Web and the system webview
control call support. Linux WebKitGTK packages often omit WebRTC, so voice and
video calls may remain unavailable even when text chat works.

## Windows antivirus warning

Use a signed GitHub release and verify its SHA-256 digest. New unsigned local
builds have no publisher reputation and can trigger heuristic detections.

Do not disable antivirus protection or add a broad folder exclusion. Record the
file hash, detection name, WhatsNow version, and package source. Submit a
reproducible false positive through the antivirus vendor's official review
process.

Read [SECURITY.md](../SECURITY.md) for the release-verification commands.

## Diagnostic log

WhatsNow writes:

- Windows: `%LOCALAPPDATA%\WhatsNow\logs\whatsnow.log`
- Linux: `$XDG_DATA_HOME/WhatsNow/logs/whatsnow.log`

Attach the log and the information requested in [SUPPORT.md](../SUPPORT.md).
Do not upload webview profile directories, cookies, session tokens, or private
chat screenshots.
