# WhatsNow installer — authored and maintained solely by @benedictusrey.
# https://github.com/benedictusrey
[CmdletBinding()]
param(
  [string]$Source,
  [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'Programs\WhatsNow'),
  [string]$Repository = $(if ($env:WHATSNOW_GITHUB_REPOSITORY) {
    $env:WHATSNOW_GITHUB_REPOSITORY
  } else {
    'benedictusrey/WhatsNow-for-WhatsApp'
  }),
  [string]$ExpectedSha256,
  [switch]$Portable,
  [switch]$NoShortcut,
  [switch]$Launch
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Status {
  param([Parameter(Mandatory)][string]$Message)
  Write-Host $Message -ForegroundColor Green
}

function Test-WebView2Runtime {
  $clientId = '{F1E7E72F-6A1A-43A7-8517-4E8A4C2A9A65}'
  $paths = @(
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\$clientId",
    "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\$clientId",
    "HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\$clientId"
  )
  foreach ($path in $paths) {
    $registryItem = Get-ItemProperty -LiteralPath $path -ErrorAction SilentlyContinue
    $versionProperty = if ($null -ne $registryItem) {
      $registryItem.PSObject.Properties['pv']
    } else {
      $null
    }
    $version = if ($null -ne $versionProperty) {
      [string]$versionProperty.Value
    } else {
      $null
    }
    if ($version -and $version -ne '0.0.0.0') {
      return $true
    }
  }
  $runtimeRoots = @()
  foreach ($basePath in @(${env:ProgramFiles(x86)}, $env:ProgramFiles, $env:LOCALAPPDATA)) {
    if ($basePath) {
      $runtimeRoots += Join-Path $basePath 'Microsoft\EdgeWebView\Application'
    }
  }
  foreach ($root in $runtimeRoots) {
    if (-not (Test-Path -LiteralPath $root -PathType Container)) {
      continue
    }
    $runtime = Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue |
      Where-Object {
        $parsedVersion = [Version]::new()
        [Version]::TryParse($_.Name, [ref]$parsedVersion) -and
          (Test-Path -LiteralPath (Join-Path $_.FullName 'msedgewebview2.exe') -PathType Leaf)
      } | Select-Object -First 1
    if ($runtime) {
      return $true
    }
  }
  return $false
}

function Get-LocalSource {
  param(
    [Parameter(Mandatory)][string]$Folder,
    [Parameter(Mandatory)][bool]$PreferPortable
  )
  $patterns = if ($PreferPortable) {
    @('WhatsNow.exe', 'whatsnow.exe')
  } else {
    @('WhatsNow_*_x64-setup.exe', 'WhatsNow*.msi', 'WhatsNow.exe', 'whatsnow.exe')
  }
  foreach ($pattern in $patterns) {
    $candidate = Get-ChildItem -LiteralPath $Folder -File -Filter $pattern `
      -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
    if ($candidate) {
      return $candidate.FullName
    }
  }
  return $null
}

function Get-ReleaseSource {
  param(
    [Parameter(Mandatory)][string]$Repo,
    [Parameter(Mandatory)][bool]$PreferPortable,
    [Parameter(Mandatory)][string]$DestinationFolder
  )
  if ($Repo -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') {
    throw "Repository must use the owner/name format, not '$Repo'."
  }
  $headers = @{
    Accept = 'application/vnd.github+json'
    'User-Agent' = 'WhatsNow-Installer'
    'X-GitHub-Api-Version' = '2022-11-28'
  }
  $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" `
    -Headers $headers
  $pattern = if ($PreferPortable) {
    '(?i)(portable.*\.exe$|WhatsNow\.exe$)'
  } else {
    '(?i)(_x64-setup\.exe$|\.msi$)'
  }
  $asset = $release.assets | Where-Object { $_.name -match $pattern } |
    Select-Object -First 1
  if (-not $asset) {
    throw "Release '$($release.tag_name)' has no compatible Windows asset."
  }
  $destination = Join-Path $DestinationFolder $asset.name
  Write-Status "Downloading $($asset.name)..."
  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $destination `
    -Headers @{ 'User-Agent' = 'WhatsNow-Installer' } -UseBasicParsing
  if (-not $ExpectedSha256 -and $asset.PSObject.Properties.Name -contains 'digest') {
    if ($asset.digest -match '^sha256:(?<hash>[A-Fa-f0-9]{64})$') {
      $script:ExpectedSha256 = $Matches.hash
    }
  }
  return $destination
}

function Confirm-Checksum {
  param(
    [Parameter(Mandatory)][string]$Path,
    [string]$Expected
  )
  if (-not $Expected) {
    $manifest = Join-Path (Split-Path -Parent $Path) 'checksums.sha256'
    if (Test-Path -LiteralPath $manifest -PathType Leaf) {
      $escapedName = [Regex]::Escape((Split-Path -Leaf $Path))
      $line = Get-Content -LiteralPath $manifest |
        Where-Object { $_ -match "^(?<hash>[A-Fa-f0-9]{64})\s+\*?$escapedName$" } |
        Select-Object -First 1
      if ($line -and $line -match '^(?<hash>[A-Fa-f0-9]{64})') {
        $Expected = $Matches.hash
      }
    }
  }
  if (-not $Expected) {
    Write-Warning 'No SHA-256 checksum was supplied; authenticity could not be pinned.'
    return
  }
  if ($Expected -notmatch '^[A-Fa-f0-9]{64}$') {
    throw 'ExpectedSha256 must contain exactly 64 hexadecimal characters.'
  }
  $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
  if ($actual -ne $Expected) {
    throw "SHA-256 verification failed for $(Split-Path -Leaf $Path)."
  }
  Write-Status 'SHA-256 verification passed.'
}

function New-WhatsNowShortcuts {
  param(
    [Parameter(Mandatory)][string]$Executable,
    [Parameter(Mandatory)][string]$WorkingDirectory
  )
  $shell = New-Object -ComObject WScript.Shell
  $shortcutPaths = @(
    (Join-Path ([Environment]::GetFolderPath('Desktop')) 'WhatsNow.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Programs')) 'WhatsNow.lnk')
  )
  foreach ($shortcutPath in $shortcutPaths) {
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $Executable
    $shortcut.WorkingDirectory = $WorkingDirectory
    $shortcut.IconLocation = "$Executable,0"
    $shortcut.Description = 'WhatsNow — focused WhatsApp productivity desktop client'
    $shortcut.Save()
  }
}

function Set-ExactFileNameCase {
  param(
    [Parameter(Mandatory)][string]$Directory,
    [Parameter(Mandatory)][string]$ExpectedName
  )

  $candidate = Get-ChildItem -LiteralPath $Directory -File |
    Where-Object { $_.Name -ieq $ExpectedName } |
    Select-Object -First 1
  if (-not $candidate) {
    throw "Installed file was not created: $(Join-Path $Directory $ExpectedName)"
  }
  if ($candidate.Name -cne $ExpectedName) {
    $temporaryName = '.WhatsNow-case-{0}.tmp' -f [Guid]::NewGuid().ToString('N')
    Rename-Item -LiteralPath $candidate.FullName -NewName $temporaryName
    Rename-Item -LiteralPath (Join-Path $Directory $temporaryName) -NewName $ExpectedName
  }
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$temporaryRoot = $null
try {
  if (-not $Source) {
    $Source = Get-LocalSource -Folder $scriptRoot -PreferPortable $Portable.IsPresent
  }
  if (-not $Source) {
    $parentFolder = Split-Path -Parent $scriptRoot
    $Source = Get-LocalSource -Folder $parentFolder -PreferPortable $Portable.IsPresent
  }
  if (-not $Source) {
    if (-not $Repository) {
      throw 'No local package was found. Pass -Source or a GitHub owner/name repository.'
    }
    $temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) (
      'WhatsNow-install-{0}' -f [Guid]::NewGuid().ToString('N')
    )
    New-Item -ItemType Directory -Path $temporaryRoot | Out-Null
    $Source = Get-ReleaseSource -Repo $Repository -PreferPortable $Portable.IsPresent `
      -DestinationFolder $temporaryRoot
  } elseif ([Uri]::IsWellFormedUriString($Source, [UriKind]::Absolute)) {
    $uri = [Uri]$Source
    if ($uri.Scheme -notin @('https')) {
      throw 'Only HTTPS package URLs are accepted.'
    }
    $temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) (
      'WhatsNow-install-{0}' -f [Guid]::NewGuid().ToString('N')
    )
    New-Item -ItemType Directory -Path $temporaryRoot | Out-Null
    $downloadPath = Join-Path $temporaryRoot ([IO.Path]::GetFileName($uri.LocalPath))
    Invoke-WebRequest -Uri $uri.AbsoluteUri -OutFile $downloadPath -UseBasicParsing
    $Source = $downloadPath
  }

  $Source = (Resolve-Path -LiteralPath $Source).Path
  $InstallDir = [IO.Path]::GetFullPath($InstallDir)
  Confirm-Checksum -Path $Source -Expected $ExpectedSha256

  if (-not (Test-WebView2Runtime)) {
    Write-Warning (
      'Microsoft Edge WebView2 Runtime was not detected. Install the Evergreen ' +
      'runtime from https://developer.microsoft.com/microsoft-edge/webview2/ before launching.'
    )
  }

  $extension = [IO.Path]::GetExtension($Source).ToLowerInvariant()
  $isSetup = (Split-Path -Leaf $Source) -match '(?i)-setup\.exe$'
  if ($Portable -or ($extension -eq '.exe' -and -not $isSetup)) {
    $running = @(Get-Process -Name whatsnow -ErrorAction SilentlyContinue)
    if ($running.Count -gt 0) {
      throw 'WhatsNow is running. Close it before updating the portable installation.'
    }
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    $destination = Join-Path $InstallDir 'WhatsNow.exe'
    if ($Source -ne $destination) {
      $staged = "$destination.new"
      Copy-Item -LiteralPath $Source -Destination $staged -Force
      Move-Item -LiteralPath $staged -Destination $destination -Force
    }
    Set-ExactFileNameCase -Directory $InstallDir -ExpectedName 'WhatsNow.exe'
    if ((Get-Item -LiteralPath $destination).VersionInfo.ProductName -ne 'WhatsNow') {
      throw 'The portable executable does not identify itself as WhatsNow.'
    }
    foreach ($companion in @(
      'README.md',
      'AUTHORS.md',
      'CHANGELOG.md',
      'CONTRIBUTING.md',
      'RELEASE_NOTES.md',
      'RELEASING.md',
      'SECURITY.md',
      'LICENSE',
      'THIRD_PARTY_NOTICES'
    )) {
      $companionSource = Join-Path (Split-Path -Parent $Source) $companion
      if (Test-Path -LiteralPath $companionSource -PathType Leaf) {
        Copy-Item -LiteralPath $companionSource `
          -Destination (Join-Path $InstallDir $companion) -Force
      }
    }
    if (-not $NoShortcut) {
      New-WhatsNowShortcuts -Executable $destination -WorkingDirectory $InstallDir
    }
  } elseif ($isSetup) {
    $process = Start-Process -FilePath $Source -ArgumentList @('/S', "/D=$InstallDir") `
      -Wait -PassThru
    if ($process.ExitCode -ne 0) {
      throw "The NSIS installer failed with exit code $($process.ExitCode)."
    }
    $destination = Join-Path $InstallDir 'whatsnow.exe'
  } elseif ($extension -eq '.msi') {
    $arguments = @('/i', "`"$Source`"", '/qn', '/norestart', "INSTALLDIR=`"$InstallDir`"")
    $process = Start-Process -FilePath 'msiexec.exe' -ArgumentList $arguments -Wait -PassThru
    if ($process.ExitCode -notin @(0, 3010)) {
      throw "The MSI installer failed with exit code $($process.ExitCode)."
    }
    $destination = Join-Path $InstallDir 'whatsnow.exe'
  } else {
    throw "Unsupported Windows package: $(Split-Path -Leaf $Source)"
  }

  if (-not (Test-Path -LiteralPath $destination -PathType Leaf)) {
    throw "Installation finished without producing $destination"
  }
  $installedVersion = (Get-Item -LiteralPath $destination).VersionInfo.ProductVersion
  Write-Status "WhatsNow $installedVersion installed at $destination"
  if ($Launch) {
    Start-Process -FilePath $destination -WorkingDirectory $InstallDir
  }
} finally {
  if ($temporaryRoot -and (Test-Path -LiteralPath $temporaryRoot)) {
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
  }
}
