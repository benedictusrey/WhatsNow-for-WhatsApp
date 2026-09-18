# WhatsNow — Windows release packaging script
# Authored and maintained solely by @benedictusrey <https://github.com/benedictusrey>

[CmdletBinding()]
param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\dist\windows")
)

$ErrorActionPreference = "Stop"
$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestPath = Join-Path $sourceRoot "src-tauri\Cargo.toml"
$targetDirectory = Join-Path $sourceRoot ".workspace\target-windows"
$installerSource = Join-Path $targetDirectory "release\bundle\nsis\WhatsNow_2.6.0_x64-setup.exe"
$msiSource = Join-Path $targetDirectory "release\bundle\msi\WhatsNow_2.6.0_x64_en-US.msi"
$portableSource = Join-Path $targetDirectory "release\whatsnow.exe"
$installerOutput = Join-Path $OutputDirectory "WhatsNow_2.6.0_windows_x64-setup.exe"
$msiOutput = Join-Path $OutputDirectory "WhatsNow_2.6.0_windows_x64_en-US.msi"
$portableOutput = Join-Path $OutputDirectory "WhatsNow_2.6.0_windows_x64-portable.exe"

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$previousTargetDirectory = $env:CARGO_TARGET_DIR
try {
    $env:CARGO_TARGET_DIR = $targetDirectory

    Push-Location $sourceRoot
    try {
        cargo tauri build --bundles nsis,msi --features windows-memory
        if ($LASTEXITCODE -ne 0) {
            throw "Windows installer build failed."
        }
        Copy-Item -LiteralPath $installerSource -Destination $installerOutput -Force
        Copy-Item -LiteralPath $msiSource -Destination $msiOutput -Force

        cargo build --release --manifest-path $manifestPath `
            --features "windows-memory,portable-mode"
        if ($LASTEXITCODE -ne 0) {
            throw "Windows portable build failed."
        }
        Copy-Item -LiteralPath $portableSource -Destination $portableOutput -Force
    }
    finally {
        Pop-Location
    }
}
finally {
    $env:CARGO_TARGET_DIR = $previousTargetDirectory
}

Get-FileHash -Algorithm SHA256 -LiteralPath $installerOutput, $msiOutput, $portableOutput |
    ForEach-Object { "$($_.Hash.ToLowerInvariant())  $([IO.Path]::GetFileName($_.Path))" } |
    Set-Content -LiteralPath (Join-Path $OutputDirectory "checksums-windows.sha256") `
        -Encoding utf8

Write-Host "Windows installer: $installerOutput"
Write-Host "Windows MSI:       $msiOutput"
Write-Host "Windows portable:  $portableOutput"
