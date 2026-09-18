# WhatsNow asset tool — authored and maintained solely by @benedictusrey.
# https://github.com/benedictusrey
# Regenerate all app and tray icons from app-icon.svg on Windows.
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$iconRoot = Join-Path $repoRoot 'src-tauri\icons'
$sourceSvg = Join-Path $iconRoot 'app-icon.svg'

Push-Location $repoRoot
try {
  cargo tauri icon $sourceSvg --output $iconRoot
  if ($LASTEXITCODE -ne 0) {
    throw "cargo tauri icon failed with exit code $LASTEXITCODE"
  }

  Copy-Item -Force -LiteralPath $sourceSvg `
    -Destination (Join-Path $repoRoot 'settings-ui\app-icon.svg')

  Copy-Item -Force -LiteralPath (Join-Path $iconRoot '128x128.png') `
    -Destination (Join-Path $iconRoot 'tray.png')

  Add-Type -AssemblyName System.Drawing
  $source = [System.Drawing.Bitmap]::FromFile((Join-Path $iconRoot '128x128.png'))
  $bitmap = New-Object System.Drawing.Bitmap($source)
  $source.Dispose()
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $brush = New-Object System.Drawing.SolidBrush(
    [System.Drawing.ColorTranslator]::FromHtml('#EA4335')
  )
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 5)
  try {
    $graphics.FillEllipse($brush, 83, 9, 36, 36)
    $graphics.DrawEllipse($pen, 83, 9, 36, 36)
    $bitmap.Save(
      (Join-Path $iconRoot 'tray-unread.png'),
      [System.Drawing.Imaging.ImageFormat]::Png
    )
  } finally {
    $pen.Dispose()
    $brush.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
  }
} finally {
  Pop-Location
}

Write-Host 'WhatsNow icons regenerated.' -ForegroundColor Green
