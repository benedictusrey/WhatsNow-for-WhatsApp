# WhatsNow installer — authored and maintained solely by @benedictusrey.
# https://github.com/benedictusrey
[CmdletBinding()]
param(
  [ValidateSet('Installer', 'Portable')]
  [string]$Mode = 'Installer',
  [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'Programs\WhatsNow'),
  [switch]$NoBuild,
  [switch]$Launch
)

# Build and install the current WhatsNow checkout on Windows.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$tauriConfig = Get-Content -LiteralPath (Join-Path $repoRoot 'src-tauri\tauri.conf.json') `
  -Raw | ConvertFrom-Json

if (-not $NoBuild) {
  if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw 'Rust/Cargo was not found. Install Rust 1.82+ from https://rustup.rs and retry.'
  }

  Push-Location $repoRoot
  try {
    if ($Mode -eq 'Installer') {
      cargo tauri build --bundles nsis,msi
    } else {
      cargo tauri build --no-bundle --features portable-mode
    }
    if ($LASTEXITCODE -ne 0) {
      throw "cargo tauri build failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

$releaseRoot = Join-Path $repoRoot 'src-tauri\target\release'
if ($Mode -eq 'Installer') {
  $source = Join-Path $releaseRoot (
    "bundle\nsis\WhatsNow_{0}_x64-setup.exe" -f $tauriConfig.version
  )
} else {
  $source = Join-Path $releaseRoot 'whatsnow.exe'
}

if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
  throw "Expected build artifact was not found: $source"
}

$installerScript = Join-Path $repoRoot 'scripts\install-windows.ps1'
$parameters = @{
  Source = $source
  InstallDir = $InstallDir
  Launch = $Launch
}
if ($Mode -eq 'Portable') {
  $parameters.Portable = $true
}

& $installerScript @parameters
