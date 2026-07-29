# WhatsNow release tool — authored and maintained solely by @benedictusrey.
# https://github.com/benedictusrey
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Path,

    [switch]$RequireTrustedSignature,

    [switch]$DefenderScan
)

$ErrorActionPreference = 'Stop'
$resolvedPath = (Resolve-Path -LiteralPath $Path).Path
$releaseFiles = if (Test-Path -LiteralPath $resolvedPath -PathType Leaf) {
    @(Get-Item -LiteralPath $resolvedPath)
} else {
    @(
        Get-ChildItem -LiteralPath $resolvedPath -File -Recurse |
            Where-Object { $_.Extension -in @('.exe', '.msi') }
    )
}

if ($releaseFiles.Count -eq 0) {
    throw "No .exe or .msi release artifacts were found under $resolvedPath."
}

$results = foreach ($file in $releaseFiles) {
    $signature = Get-AuthenticodeSignature -LiteralPath $file.FullName
    $version = if ($file.Extension -eq '.exe') {
        $file.VersionInfo.FileVersion
    } else {
        $null
    }
    [pscustomobject]@{
        File = $file.Name
        Version = $version
        Signature = [string]$signature.Status
        Publisher = if ($signature.SignerCertificate) {
            $signature.SignerCertificate.Subject
        } else {
            '(unsigned)'
        }
        SHA256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
    }
}

$results | Format-Table File, Version, Signature, Publisher -AutoSize
$results | ForEach-Object {
    Write-Host "$($_.SHA256)  $($_.File)"
}

$invalidSignatures = @($results | Where-Object Signature -ne 'Valid')
if ($RequireTrustedSignature -and $invalidSignatures.Count -gt 0) {
    $names = ($invalidSignatures.File -join ', ')
    throw "Trusted Authenticode verification failed for: $names"
}

if ($DefenderScan) {
    $platformRoot = Join-Path $env:ProgramData 'Microsoft\Windows Defender\Platform'
    $defender = Get-ChildItem -LiteralPath $platformRoot -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending |
        ForEach-Object { Join-Path $_.FullName 'MpCmdRun.exe' } |
        Where-Object { Test-Path -LiteralPath $_ } |
        Select-Object -First 1

    if (-not $defender) {
        $fallback = Join-Path $env:ProgramFiles 'Windows Defender\MpCmdRun.exe'
        if (Test-Path -LiteralPath $fallback) {
            $defender = $fallback
        }
    }
    if (-not $defender) {
        throw 'Microsoft Defender command-line scanner is not available on this device.'
    }

    foreach ($file in $releaseFiles) {
        Write-Host "Scanning $($file.Name) with remediation disabled..."
        & $defender -Scan -ScanType 3 -File $file.FullName -DisableRemediation
        if ($LASTEXITCODE -ne 0) {
            throw "Microsoft Defender returned exit code $LASTEXITCODE for $($file.Name)."
        }
    }
}
