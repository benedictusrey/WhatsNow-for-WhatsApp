# Privacy

WhatsNow loads the official WhatsApp Web service in the operating system's
webview. The page communicates with WhatsApp under WhatsApp's terms and privacy
policy. WhatsNow does not proxy chats through a server operated by this project
and version 1.0.0 contains no project analytics or advertising SDK.

## Data kept locally

WhatsNow stores account sessions in local webview profiles. It also keeps
account labels and preferences for themes, notifications, shortcuts, focus
sessions, windows, and App Lock. Separate WhatsNow accounts use separate local
profiles where the platform supports them.

If App Lock uses a password, WhatsNow stores a password hash rather than the
plain password. App Lock protects access to the application window; it is not
disk encryption. Use BitLocker, FileVault, or LUKS when local files require
encryption at rest.

## Notifications

Native notifications can contain a sender and message preview. Operating-system
settings determine whether that content appears on a lock screen or remains in
notification history. Disable WhatsNow previews or use generic notifications
on shared devices.

## Diagnostics

WhatsNow's bounded diagnostic log records application control flow and error
categories. It is designed not to record message bodies, chat titles, contact
names, or phone numbers. Review any diagnostic file before sharing it publicly.

## Removing data

Uninstalling may retain per-user application data so an upgrade can preserve
sessions. To remove it completely, first exit WhatsNow, then remove only the
WhatsNow/app.whatsnow.desktop application-data directory for your user. Deleting
that data logs accounts out and cannot be undone.

Never post session files, authentication tokens, private screenshots, or
unredacted diagnostics in a public issue.

