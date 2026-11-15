# WhatsNow 2.7.0 — account names, tidier calls, instant Settings, synced notifications

A UX and reliability update. Created and maintained by
[@benedictusrey](https://github.com/benedictusrey).

## What's new

### Added
- A WhatsNow button in the chat-list header, next to WhatsApp's ⋮ menu, that opens
  WhatsNow Settings.
- A notification health card in Settings that shows when Windows is blocking
  WhatsNow alerts and opens Windows notification settings.
- A per-account unread badge on each account's taskbar button.
- A "Connecting" frame in the call window while the call loads.

### Changed
- **Account names.** The tray menu, Settings and toasts show the name you typed in
  Rename; if none is set, your WhatsApp profile name. "WhatsApp" is no longer
  stored as the default name, and Rename can clear a typed name.
- **Windows.** Settings opens centered on the monitor under your cursor every time;
  the main window centers once at launch and then stays where you move it. Windows
  saved on a removed monitor can no longer come back off-screen. Settings opens
  only after its data has loaded, in your saved theme.
- **Settings.** Every control saves instantly (no Save button) with a Saved or Retry
  indicator, real dialogs for rename, remove and password changes, a tidier layout
  that no longer crops on the Focus tab, and a 30-second idle close that pauses
  while you are using it.
- **Themes.** Graphite through Aurora now color the whole window, and the area
  around the message box stays transparent like Dark and Light. The title bar is
  tinted to the theme on Windows 11, and the lock screen gains the missing Aurora
  palette.
- **Notifications.** Toasts are grouped per chat and cleared from the Action Center
  once the chat is read in WhatsNow or on your phone. A slow start no longer raises
  toasts for chats you had already read, muted chats stay quiet, and a repeated
  message a minute later notifies again.

### Fixed
- **A call ending left an empty window behind.** The call window now closes with
  the call.
- A call window is no longer dropped behind the chat by a Settings change, and no
  longer suppresses toasts while it is focused.
- Settings, accounts and the app-lock file are written atomically, an unknown theme
  value no longer resets your settings, a mistyped shortcut is rejected without
  losing the working one, and wrong unlock passwords back off.
- A freeze that could occur when switching to a personality theme.

### Security
- The WhatsApp page no longer holds the raw notification grant; it can only notify
  through WhatsNow's guarded command.

## Installation and compatibility

One installer per operating system: `WhatsNow_2.7.0_windows_x64-setup.exe`
(Windows), `WhatsNow_2.7.0_macos_universal.dmg` (macOS, Apple Silicon and Intel in
one), and `WhatsNow_2.7.0_linux_x86_64.AppImage` (Linux; run `chmod +x` once).

Fully quit WhatsNow from the tray before upgrading. Verify your download against
`checksums.sha256`. Windows builds are unsigned; macOS builds are not Developer ID
signed or notarized. Live checks on a signed-in account are listed in the
[implementation record](docs/IMPLEMENTATION_v2.7.0.md).
