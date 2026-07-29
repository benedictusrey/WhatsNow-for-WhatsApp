# Troubleshooting

## WhatsNow opens to a sign-in page

Link the account using WhatsApp's **Linked devices** flow. If an account was
removed or local profile data was deleted, it must be linked again.

## Windows opens a blank window

Install or repair Microsoft Edge WebView2, update Windows, exit WhatsNow from
the tray, and relaunch it.

## Notifications do not appear

Check WhatsNow notification preferences and the operating system's notification,
Focus Assist, or Do Not Disturb settings. WhatsNow intentionally suppresses
message previews while the relevant chat window is actively in the foreground.

## A shortcut does not work

Another app may own it. Choose another shortcut in Settings and restart
WhatsNow if the desktop environment does not immediately release the old one.

## Linux calls are unavailable

Some WebKitGTK distributions do not include WebRTC. This is a runtime
limitation; text chat and attachments may still work normally.

## Antivirus reports an unfamiliar label

Do not create an antivirus exclusion. Verify the download source, checksum, and
signature using [Security and verification](SECURITY_AND_VERIFICATION.md), then
submit the exact file to the vendor for false-positive review.

For a reproducible application defect, follow [Support](../SUPPORT.md).

