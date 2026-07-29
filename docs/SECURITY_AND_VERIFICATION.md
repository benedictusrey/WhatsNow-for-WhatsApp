# Security and verification

## Understand the trust boundary

WhatsNow is a desktop host for the official WhatsApp Web service. WhatsApp
handles accounts, message transport, and its service-side security. WhatsNow
adds local desktop behavior and does not operate a message proxy.

Each account uses a local webview profile. Those profiles contain valuable
session material and should be protected like browser data. App Lock prevents
casual access to the visible app, but it does not encrypt profile files.

## Verify Windows downloads

From PowerShell:

```powershell
Get-FileHash .\WhatsNow_1.0.0_x64-setup.exe -Algorithm SHA256
Get-AuthenticodeSignature .\WhatsNow_1.0.0_x64-setup.exe |
  Format-List Status,StatusMessage,SignerCertificate
```

Compare the hash character-for-character with `checksums.sha256` on the same
GitHub Release. `Valid` signature status and the expected publisher are stronger
evidence when a signed release is available.

The bundled verification helper checks local Windows assets:

```powershell
.\scripts\verify-windows-release.ps1 `
  -Path .\release-assets\windows
```

## Verify macOS downloads

```bash
shasum -a 256 WhatsNow_1.0.0_aarch64.dmg
codesign --verify --deep --strict --verbose=2 /Applications/WhatsNow.app
spctl --assess --type execute --verbose=2 /Applications/WhatsNow.app
```

## Verify Linux downloads

```bash
sha256sum WhatsNow_1.0.0_amd64.AppImage
sha256sum WhatsNow_1.0.0_amd64.deb
```

## Antivirus and reputation warnings

New or unsigned desktop applications can be classified by reputation systems
before many users have downloaded them. Heuristic labels are not a security
certificate and are not automatically proof of malware.

Do not disable antivirus protection. Confirm the repository owner, HTTPS release
URL, checksum, and signature. If the file still receives a warning, submit that
exact artifact to the vendor's false-positive process with its SHA-256 value.
Replace a release asset only by publishing a new version and new checksum; never
silently swap a binary under an existing claim.

## Operational privacy

- Disable message previews on shared or presentation devices.
- Keep the operating system and webview runtime updated.
- Use full-disk encryption for local session protection.
- Remove unused accounts and revoke linked devices from WhatsApp when needed.
- Never upload local webview profiles or authentication files to an issue.
