# Install WhatsNow

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

Copyright (c) 2026 @benedictusrey. Released under the
[MIT License](../LICENSE).

## Choose a package

Download files from the
[latest WhatsNow release](https://github.com/benedictusrey/WhatsNow-for-WhatsApp/releases/latest).

| Platform | Package | Use it when |
| --- | --- | --- |
| Windows x64 | `WhatsNow_<version>_windows_x64-setup.exe` | You want Start menu integration, shortcuts, native notifications, and an uninstaller |
| Windows x64 | `WhatsNow_<version>_windows_x64_en-US.msi` | Your organization deploys MSI packages |
| Windows x64 | `WhatsNow_<version>_windows_x64-portable.exe` | You want one executable without an installer |
| macOS Apple silicon | AArch64 DMG | Your Mac uses an M-series processor |
| macOS Intel | x64 DMG | Your Mac uses an Intel processor |
| Linux x64 | AppImage | You want a user-level install across distributions |
| Debian or Ubuntu x64 | `.deb` | You want package-manager integration |

GitHub lists a SHA-256 digest beside each release asset. Compare that digest
before you run a downloaded package. Windows users should also verify the
Authenticode publisher.

## Windows

### NSIS setup

1. Download the x64 setup executable.
2. Open **Properties > Digital Signatures** and confirm the expected publisher.
3. Run the setup and start WhatsNow from the Start menu.

PowerShell can display the signature and hash:

```powershell
Get-AuthenticodeSignature .\WhatsNow_2.5.0_windows_x64-setup.exe |
  Format-List Status,StatusMessage,SignerCertificate
Get-FileHash .\WhatsNow_2.5.0_windows_x64-setup.exe -Algorithm SHA256
```

The repository installer accepts a local package:

```powershell
.\scripts\install-windows.ps1 `
  -Source .\WhatsNow_2.5.0_windows_x64-setup.exe `
  -ExpectedSha256 'RELEASE_SHA256'
```

It can also select the newest compatible GitHub release:

```powershell
.\scripts\install-windows.ps1 -Repository 'benedictusrey/WhatsNow-for-WhatsApp'
```

### MSI

Use the MSI for managed deployment:

```powershell
msiexec.exe /i .\WhatsNow_2.5.0_windows_x64_en-US.msi
```

Your deployment system can pass its normal `msiexec` user-interface and logging
options.

### Portable

The release asset may include the version in its filename. You can keep that
name or rename it to `WhatsNow.exe`.

Run it in place, or install it with shortcuts:

```powershell
.\scripts\install-windows.ps1 `
  -Source .\WhatsNow.exe `
  -Portable `
  -InstallDir "$env:LOCALAPPDATA\Programs\WhatsNow"
```

Portable mode stores account sessions and Settings in Windows per-user
application-data directories. Replacing the executable does not remove your
sessions.

Portable builds register the per-user Windows notification identity required
for native toast delivery. WhatsNow does not create a separate notification
window.

### Windows requirement

WhatsNow needs Microsoft Edge WebView2. Windows 11 includes it. The installer
warns when it cannot detect the Evergreen runtime.

## macOS

WhatsNow requires macOS 12.1 or newer. Multiple isolated accounts require
macOS 14.

Install a downloaded DMG:

```bash
sh ./scripts/install-macos.sh \
  --source ./WhatsNow_2.5.0_aarch64.dmg \
  --sha256 RELEASE_SHA256
```

Select the latest release:

```bash
sh ./scripts/install-macos.sh --repository benedictusrey/WhatsNow-for-WhatsApp
```

The script validates the `app.whatsnow.desktop` bundle identifier and installs
`WhatsNow.app` under `~/Applications` unless you pass `--install-dir`.

If macOS warns about an unsigned local development build, use a signed release.
Do not remove quarantine metadata from an unverified download.

## Linux

WhatsNow requires WebKitGTK 2.46.1 or newer.

Install an AppImage:

```bash
sh ./scripts/install-linux.sh \
  --source ./WhatsNow_2.5.0_amd64.AppImage \
  --sha256 RELEASE_SHA256
```

Select the latest release:

```bash
sh ./scripts/install-linux.sh --repository benedictusrey/WhatsNow-for-WhatsApp
```

The AppImage installer creates:

- `~/.local/opt/WhatsNow/WhatsNow.AppImage`
- `~/.local/bin/whatsnow`
- a desktop entry under `~/.local/share/applications`

Install a Debian package with:

```bash
sh ./scripts/install-linux.sh --source ./WhatsNow_2.5.0_amd64.deb
```

The script uses `apt-get` or `dpkg` and asks for `sudo` only for the Debian
package path.

## Update

Close WhatsNow before replacing a portable executable or app bundle. Run the
new installer over the existing version for NSIS, MSI, DMG, or Debian updates.
The installer keeps your per-user account data.

Back up your WhatsApp sessions through WhatsApp's supported account tools.
WhatsNow does not provide a portable export of browser cookies or authentication
tokens.

## Uninstall

### Windows installer

Open **Settings > Apps > Installed apps > WhatsNow > Uninstall**.

### Windows portable

Exit WhatsNow from the tray, then remove the portable executable and any
shortcuts you created.

### macOS

Quit WhatsNow and move `WhatsNow.app` from `~/Applications` to Trash.

### Linux AppImage

Remove the AppImage, launcher, and desktop entry created by the installer:

```bash
rm "$HOME/.local/opt/WhatsNow/WhatsNow.AppImage"
rm "$HOME/.local/bin/whatsnow"
rm "$HOME/.local/share/applications/app.whatsnow.desktop"
```

Use your package manager to remove a Debian installation.

Uninstalling the application can leave per-user sessions and Settings so an
update or reinstall can reuse them. Read [Privacy](../PRIVACY.md) before deleting
application data. Removing those directories logs accounts out and cannot be
undone.

## Need help?

Read [Troubleshooting](TROUBLESHOOTING.md) or open a report through
[Support](../SUPPORT.md). Send security problems through the private route in
[SECURITY.md](../SECURITY.md).
