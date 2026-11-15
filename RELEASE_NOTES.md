# WhatsNow 2.7.0 — account names, tidier calls, instant Settings, synced notifications

A UX and reliability update. Created and maintained by
[@benedictusrey](https://github.com/benedictusrey).

## Improvements

- Your account shows its own name instead of "WhatsApp" in the tray menu, Settings
  and toasts: the name you typed, otherwise your WhatsApp profile name.
- A new WhatsNow button in the chat-list header, next to WhatsApp's ⋮ menu, opens
  WhatsNow Settings.
- The call window closes completely when the call ends (it used to leave an empty
  window behind) and shows a "Connecting" frame while the call loads.
- Themes Graphite to Aurora color the whole window and leave the area around the
  message box transparent, like Dark and Light.

- Settings opens centered on the monitor under your cursor every time. The main
  window centers once at launch and keeps wherever you move it until the next restart.
  Windows saved on a removed or smaller monitor can no longer come back off-screen.
- Settings saves every change instantly (no Save button), shows Saved or a Retry
  prompt, and uses proper dialogs for renaming, removing, and password changes.
  A mistyped shortcut is rejected without losing the one that works.
- A notification health card shows when Windows is blocking WhatsNow alerts and
  opens Windows notification settings.
- Toasts are grouped per chat in the Action Center and cleared once the chat is
  read in WhatsNow or on your phone. A slow start no longer raises toasts for chats
  you had already read; muted chats stay quiet; a repeated "ok" a minute later
  notifies again.
- Settings, accounts, and the app-lock file are written atomically, an unknown
  theme value no longer resets your settings, and wrong unlock passwords back off.
- A call window is never dropped behind the chat by a Settings change, no longer
  suppresses toasts while focused, and carries the WhatsNow icon.
- The taskbar badge on each account window shows that account's own unread count,
  and the page-side bridge does less work while you chat or call.

## Installation and compatibility

Fully quit WhatsNow from the tray before upgrading. Verify your download against
`checksums.sha256`. Windows builds are unsigned; macOS builds are not Developer ID
signed or notarized. Live checks on a signed-in account are listed in the
[implementation record](docs/IMPLEMENTATION_v2.7.0.md).
