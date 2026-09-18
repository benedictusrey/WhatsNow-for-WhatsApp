# WhatsNow packaging tool — authored and maintained solely by @benedictusrey.
# https://github.com/benedictusrey
[CmdletBinding()]
param(
  [string]$OutputDir,
  [switch]$IncludeInstallers
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Set-ExactFileNameCase {
  param(
    [Parameter(Mandatory)][string]$Directory,
    [Parameter(Mandatory)][string]$ExpectedName
  )

  $candidate = Get-ChildItem -LiteralPath $Directory -File |
    Where-Object { $_.Name -ieq $ExpectedName } |
    Select-Object -First 1
  if (-not $candidate) {
    throw "Distribution file was not created: $(Join-Path $Directory $ExpectedName)"
  }
  if ($candidate.Name -cne $ExpectedName) {
    $temporaryName = '.WhatsNow-case-{0}.tmp' -f [Guid]::NewGuid().ToString('N')
    Rename-Item -LiteralPath $candidate.FullName -NewName $temporaryName
    Rename-Item -LiteralPath (Join-Path $Directory $temporaryName) -NewName $ExpectedName
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $OutputDir = Join-Path $repoRoot 'dist\WhatsNow-Portable'
}
$config = Get-Content -LiteralPath (Join-Path $repoRoot 'src-tauri\tauri.conf.json') `
  -Raw | ConvertFrom-Json
$displayVersion = (
  Get-Content -LiteralPath (Join-Path $repoRoot 'VERSION') -Raw
).Trim()
if ($displayVersion -notmatch '^\d+\.\d+\.\d+$') {
  throw "VERSION must contain a semantic major.minor.patch label, for example 1.0.0."
}
if ($displayVersion -ne [string]$config.version) {
  throw "VERSION ($displayVersion) must match tauri.conf.json ($($config.version))."
}
$releaseRoot = Join-Path $repoRoot 'src-tauri\target\release'
$portableSource = Join-Path $releaseRoot 'whatsnow.exe'

if (-not (Test-Path -LiteralPath $portableSource -PathType Leaf)) {
  throw "Release executable not found: $portableSource"
}

$portableBytes = [IO.File]::ReadAllBytes($portableSource)
$portableText = [Text.Encoding]::ASCII.GetString($portableBytes)
$neutralBundleMarker = '__TAURI_BUNDLE_TYPE_VAR_UNK'
$neutralBundleMarkerCount = [Regex]::Matches(
  $portableText,
  [Regex]::Escape($neutralBundleMarker)
).Count
if ($neutralBundleMarkerCount -ne 1) {
  throw (
    'Portable source does not contain the single neutral Tauri bundle marker. ' +
    'It may have been installer-stamped. Rebuild the executable ' +
    'with `cargo tauri build --no-bundle --ci --features portable-mode` before ' +
    'packaging. WhatsNow does not modify finished executable bytes because doing ' +
    'so invalidates code signatures.'
  )
}
if (-not $portableText.Contains('WHATSNOW_PORTABLE_MODE_V1')) {
  throw (
    'Release executable was not built with the portable-mode feature. Run ' +
    '`cargo tauri build --no-bundle --ci --features portable-mode` first.'
  )
}

$OutputDir = [IO.Path]::GetFullPath($OutputDir)
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$files = @{
  $portableSource = 'WhatsNow.exe'
  (Join-Path $repoRoot 'install.ps1') = 'install.ps1'
  (Join-Path $repoRoot 'install.sh') = 'install.sh'
  (Join-Path $PSScriptRoot 'install-windows.ps1') = 'install-windows.ps1'
  (Join-Path $PSScriptRoot 'install-macos.sh') = 'install-macos.sh'
  (Join-Path $PSScriptRoot 'install-linux.sh') = 'install-linux.sh'
  (Join-Path $PSScriptRoot 'configure-windows-signing.ps1') = 'configure-windows-signing.ps1'
  (Join-Path $PSScriptRoot 'verify-windows-release.ps1') = 'verify-windows-release.ps1'
  (Join-Path $repoRoot 'settings-ui\app-icon.svg') = 'app-icon.svg'
  (Join-Path $repoRoot 'PORTABLE-README.md') = 'README.md'
  (Join-Path $repoRoot 'AUTHORS.md') = 'AUTHORS.md'
  (Join-Path $repoRoot 'CHANGELOG.md') = 'CHANGELOG.md'
  (Join-Path $repoRoot 'CONTRIBUTING.md') = 'CONTRIBUTING.md'
  (Join-Path $repoRoot 'RELEASE_NOTES.md') = 'RELEASE_NOTES.md'
  (Join-Path $repoRoot 'docs\RELEASING.md') = 'RELEASING.md'
  (Join-Path $repoRoot 'SECURITY.md') = 'SECURITY.md'
  (Join-Path $repoRoot 'LICENSE') = 'LICENSE'
  (Join-Path $repoRoot 'THIRD_PARTY_NOTICES') = 'THIRD_PARTY_NOTICES'
}

if ($IncludeInstallers) {
  $nsis = Join-Path $releaseRoot (
    'bundle\nsis\WhatsNow_{0}_x64-setup.exe' -f $config.version
  )
  $msi = Get-ChildItem -LiteralPath (Join-Path $releaseRoot 'bundle\msi') `
    -Filter '*.msi' -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (Test-Path -LiteralPath $nsis -PathType Leaf) {
    $files[$nsis] = 'WhatsNow_{0}_x64-setup.exe' -f $displayVersion
  }
  if ($msi) {
    $files[$msi.FullName] = 'WhatsNow_{0}_x64_en-US.msi' -f $displayVersion
  }
}

foreach ($entry in $files.GetEnumerator()) {
  if (-not (Test-Path -LiteralPath $entry.Key -PathType Leaf)) {
    throw "Distribution input not found: $($entry.Key)"
  }
  Copy-Item -LiteralPath $entry.Key -Destination (Join-Path $OutputDir $entry.Value) -Force
}

# Windows preserves the old display casing when a differently-cased file is
# overwritten. Rename through a temporary name so Explorer always shows the
# portable executable as exactly `WhatsNow.exe`.
Set-ExactFileNameCase -Directory $OutputDir -ExpectedName 'WhatsNow.exe'

$checksumLines = foreach ($file in Get-ChildItem -LiteralPath $OutputDir -File |
  Where-Object { $_.Name -ne 'checksums.sha256' } | Sort-Object Name) {
  $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  "$hash  $($file.Name)"
}
$checksumLines | Set-Content -LiteralPath (Join-Path $OutputDir 'checksums.sha256') `
  -Encoding ascii

Write-Host "WhatsNow $displayVersion portable distribution: $OutputDir" `
  -ForegroundColor Green
