# WhatsNow security policy

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

Copyright (c) 2026 @benedictusrey. Released under the [MIT License](LICENSE).

## Supported versions

| Version | Security updates |
| --- | --- |
| Latest published release | Preferred baseline for reports |
| 2.6.1 candidate | Under validation; not a completed security audit |
| Older releases | Upgrade recommended; no separate maintenance promise |

Check the newest published release before reporting a problem that may already
have a fix. The current local v2.6.1 Windows candidates are unsigned; do not
assume a certificate or independent security certification exists.

## Report a vulnerability

Use
[GitHub private vulnerability reporting](https://github.com/benedictusrey/WhatsNow-for-WhatsApp/security/advisories/new)
for:

- remote-page access to account, Settings, Focus, or app-lock commands;
- session, credential, notification, or local-file exposure;
- app-lock bypass;
- unsafe external-link or file-drop handling;
- installer, update, signature, or release-integrity problems.

Include the affected version, platform, package type, reproduction steps,
impact, and any proposed mitigation. Remove private messages, phone numbers,
account names, cookies, and session tokens.

Do not open a public issue until the report has a fix or the maintainer agrees
that disclosure is safe.

## Security boundaries

WhatsNow loads the official `https://web.whatsapp.com` page in a system webview.
The remote page receives a narrow command allowlist for:

- count-only unread updates and notification requests;
- profile-based native window titles;
- validated HTTP and HTTPS links;
- bounded diagnostic messages.
- a scoped trusted-click request used to select notification/link targets.

Remote account windows cannot call account management, general Settings, Focus,
or app-lock commands. Local Settings and lock windows have separate Tauri
capabilities, and Rust checks their window origin again.

File drops enforce file-count, per-file, and total-size limits before WhatsNow
streams data into WhatsApp's attachment confirmation composer. External links
use the operating system's browser flow. WhatsNow blocks `file://` navigation
from the remote page.

## App-lock limits

WhatsNow hashes app-lock passwords with Argon2id and a random salt. It does not
store the plain-text password.

App lock controls access to WhatsNow windows and suppresses notification
previews while locked. It does not encrypt webview profiles or WhatsApp session
data on disk. Use BitLocker, FileVault, or LUKS for at-rest protection.

## Release trust

Treat a release as trusted after you verify:

1. the download came from
   `https://github.com/benedictusrey/WhatsNow-for-WhatsApp/releases`;
2. its SHA-256 digest matches the release asset's published checksum;
3. signing/notarization status matches the release disclosure; if signed,
   Windows Authenticode or macOS code signing names the expected publisher;
4. the package version and application identifier match WhatsNow.

Windows verification:

```powershell
Get-FileHash .\WhatsNow_2.6.1_windows_x64-setup.exe -Algorithm SHA256
Get-AuthenticodeSignature .\WhatsNow_2.6.1_windows_x64-setup.exe |
  Format-List Status,StatusMessage,SignerCertificate
```

Repository maintainers can verify a build directory with:

```powershell
.\scripts\verify-windows-release.ps1 `
  -Path .\src-tauri\target\release\bundle `
  -RequireTrustedSignature
```

Add `-DefenderScan` for a custom Microsoft Defender scan with remediation
disabled. The script reports a detection without deleting the release artifact.

## Windows signing

Identity-validated Authenticode signing is recommended for public Windows
releases. The current local packages report `NotSigned`. A matching checksum
detects byte changes; it does not identify a publisher or prove software safe.
If signing is configured, use one consistent publisher identity.

Import the PFX into the current user's certificate store, then generate the
ignored local Tauri signing configuration:

```powershell
.\scripts\configure-windows-signing.ps1 `
  -CertificateThumbprint 'YOUR_CERTIFICATE_THUMBPRINT' `
  -TimestampUrl 'YOUR_RFC3161_TIMESTAMP_URL'
cargo tauri build
```

Never commit the PFX, its password, or
`src-tauri/tauri.windows.conf.json`.

Do not assume the release workflow has signed anything merely because it
contains an optional signing step. Validate that path and verify the installed
application, setup, MSI, and portable signatures before claiming signed delivery.
Generate final checksums after signing; never edit signed executable bytes.

## Antivirus false positives

Unsigned local builds start without publisher reputation. Antivirus products
can also flag new hashes based on behavior such as webview startup, global
shortcuts, notifications, autostart, or shortcut registration.

Do not disable protection or instruct users to add broad exclusions. Reproduce
the alert with a clean source build, record the exact hash and detection name,
and submit the signed artifact through the vendor's official false-positive
process.

Avast Free does not provide a stable documented command-line interface for
release gating. Scan the signed package through Avast's application and use
Avast's official false-positive submission form for a reproducible incorrect
detection.

Portable mode avoids installer-style AUMID, Start menu, and protocol registration
at startup. Native toast reliability can therefore depend on existing OS
identity/registration. There is no separate floating notification window fallback.
Prefer NSIS/MSI installation for Windows desktop integration.

## Logs and sensitive data

WhatsNow's bounded diagnostic log records control flow and error categories.
It does not record message bodies, chat titles, contact names, or phone numbers.

Do not attach webview profiles, cookies, tokens, or private chat screenshots to
public issues. Read [Privacy](PRIVACY.md) for local-data details.
