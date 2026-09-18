# WhatsNow release tool — authored and maintained solely by @benedictusrey.
# https://github.com/benedictusrey
[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^[A-Fa-f0-9\s]+$')]
    [string]$CertificateThumbprint,

    [ValidatePattern('^https?://')]
    [string]$TimestampUrl = 'http://timestamp.digicert.com',

    [string]$OutputPath = (
        Join-Path $PSScriptRoot '..\src-tauri\tauri.windows.conf.json'
    )
)

$ErrorActionPreference = 'Stop'
$normalizedThumbprint = ($CertificateThumbprint -replace '\s', '').ToUpperInvariant()
$certificatePath = "Cert:\CurrentUser\My\$normalizedThumbprint"

if (-not (Test-Path -LiteralPath $certificatePath)) {
    throw "No certificate with thumbprint $normalizedThumbprint exists in Cert:\CurrentUser\My."
}

$certificate = Get-Item -LiteralPath $certificatePath
if (-not $certificate.HasPrivateKey) {
    throw 'The selected certificate has no private key and cannot sign WhatsNow.'
}
if ($certificate.NotAfter -le (Get-Date)) {
    throw "The selected certificate expired on $($certificate.NotAfter.ToString('u'))."
}

$configuration = [ordered]@{
    bundle = [ordered]@{
        windows = [ordered]@{
            certificateThumbprint = $normalizedThumbprint
            digestAlgorithm = 'sha256'
            timestampUrl = $TimestampUrl
            tsp = $true
        }
    }
}

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
if ($PSCmdlet.ShouldProcess($resolvedOutput, 'Create Tauri Windows signing configuration')) {
    $parent = Split-Path -Parent $resolvedOutput
    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $configuration |
        ConvertTo-Json -Depth 4 |
        Set-Content -LiteralPath $resolvedOutput -Encoding utf8
}

Write-Host "Windows signing is configured for $($certificate.Subject)."
Write-Host 'Run cargo tauri build; Tauri will sign the app executable and Windows bundles.'
