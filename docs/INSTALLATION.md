# Install WhatsNow

Download WhatsNow only from the
[official Releases page](https://github.com/benedictusrey/WhatsNow/releases).
Compare the SHA-256 checksum before running an installer.

## Windows 10 or 11

WhatsNow requires the Microsoft Edge WebView2 runtime. Windows 11 normally
includes it.

### Standard setup

1. Download `WhatsNow_1.0.0_x64-setup.exe`.
2. Verify its hash and publisher information.
3. Run the installer.
4. Open WhatsNow from the Start menu and link WhatsApp using the displayed QR
   code.

### MSI deployment

```powershell
msiexec.exe /i .\WhatsNow_1.0.0_x64_en-US.msi
```

### Portable use

Download `WhatsNow.exe` and run it from a user-writable folder. Portable refers
to the executable format: WhatsNow still keeps account sessions and preferences
in the normal per-user application-data location.

The included helper can install either a local or release asset:

```powershell
.\scripts\install-windows.ps1 `
  -Source .\WhatsNow_1.0.0_x64-setup.exe `
  -ExpectedSha256 'EXPECTED_SHA256'
```

```powershell
.\scripts\install-windows.ps1 -Repository 'benedictusrey/WhatsNow'
```

Uninstall an installed copy through **Settings > Apps > Installed apps**. For a
portable copy, exit through the tray before deleting the executable.

## macOS

WhatsNow requires macOS 12.1 or newer. Multiple isolated accounts require
macOS 14.

For Apple silicon, download the AArch64 DMG. Drag `WhatsNow.app` into
Applications, then verify the app's signature before first launch. The helper
supports DMG and `.app.tar.gz` assets:

```bash
sh ./scripts/install-macos.sh \
  --source ./WhatsNow_1.0.0_aarch64.dmg \
  --sha256 EXPECTED_SHA256
```

Or select the latest compatible published asset:

```bash
sh ./scripts/install-macos.sh --repository benedictusrey/WhatsNow
```

Do not remove quarantine metadata from an unverified download merely to bypass
Gatekeeper. Use a signed/notarized release when one is available.

To uninstall, quit WhatsNow and move `WhatsNow.app` to Trash.

## Linux

WhatsNow requires WebKitGTK 2.46.1 or newer. AppImage is the broadly portable
x64 option; Debian and Ubuntu users can install the `.deb`.

```bash
sh ./scripts/install-linux.sh \
  --source ./WhatsNow_1.0.0_amd64.AppImage \
  --sha256 EXPECTED_SHA256
```

```bash
sh ./scripts/install-linux.sh \
  --source ./WhatsNow_1.0.0_amd64.deb \
  --sha256 EXPECTED_SHA256
```

Or select the latest compatible published asset:

```bash
sh ./scripts/install-linux.sh --repository benedictusrey/WhatsNow
```

Some Linux WebKitGTK builds omit WebRTC support. Text chat, downloads,
notifications, and attachments can work while voice or video calling remains
unavailable.

## Updating without losing sessions

Exit WhatsNow before replacing a portable executable or app bundle. Install a
newer package over the existing version. Per-user webview profiles normally
remain in place, but authentication is controlled by WhatsApp and may require
linking again.

## Removing local sessions

Uninstalling can intentionally leave per-user data for future upgrades. Read
[Privacy](../PRIVACY.md) before removing application data. Deleting it logs
accounts out and cannot be undone.

