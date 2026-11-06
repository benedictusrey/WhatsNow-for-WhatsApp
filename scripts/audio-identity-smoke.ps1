# WhatsNow owned-session native check, maintained by @benedictusrey.
[CmdletBinding()]
param([Parameter(Mandatory)][string]$TargetDirectory, [switch]$NotificationsOnly)
$ErrorActionPreference = 'Stop'
$examples = Join-Path (Resolve-Path -LiteralPath $TargetDirectory).Path 'debug\examples'
$fixturePath = Join-Path $examples 'background-media-smoke.exe'
$inspectorPath = Join-Path $examples 'audio-session-inspect.exe'
$repository = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$evidence = Join-Path $repository '.workspace\release-v2.6.3'
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
function Read-Sessions {
    $raw = & $inspectorPath
    if ($LASTEXITCODE -ne 0) { throw 'Audio inspector failed' }
    $raw | ConvertFrom-Json
}
function Get-Descendants([uint32]$RootId) {
    $rows = Get-CimInstance Win32_Process
    $ids = [Collections.Generic.HashSet[uint32]]::new()
    [void]$ids.Add($RootId)
    do {
        $added = $false
        foreach ($row in $rows) {
            if ($ids.Contains($row.ParentProcessId) -and $ids.Add($row.ProcessId)) { $added = $true }
        }
    } while ($added)
    # Preserve the HashSet as an object rather than enumerating its members.
    ,$ids
}
$before = Read-Sessions
$before | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $evidence 'identity-before.json') -Encoding utf8
$previousMode = [Environment]::GetEnvironmentVariable('WHATSNOW_IDENTITY_TEST_NOTIFICATIONS_ONLY', 'Process')
try {
    if ($NotificationsOnly) { $env:WHATSNOW_IDENTITY_TEST_NOTIFICATIONS_ONLY = '1' }
    $fixture = Start-Process -FilePath $fixturePath -ArgumentList '--audio-identity' -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $evidence 'identity-media.log') `
        -RedirectStandardError (Join-Path $evidence 'identity-media.stderr.log')
} finally {
    [Environment]::SetEnvironmentVariable('WHATSNOW_IDENTITY_TEST_NOTIFICATIONS_ONLY', $previousMode, 'Process')
}
$deadline = [DateTime]::UtcNow.AddSeconds(35)
$verified = $false
do {
    Start-Sleep -Milliseconds 500
    $current = Read-Sessions
    $owners = Get-Descendants ([uint32]$fixture.Id)
    $owned = @($current.sessions | Where-Object { $owners.Contains([uint32]$_.pid) -and $_.ownership_status -eq 0 })
    if ($owned.Count -gt 0) {
        $verified = @($owned | Where-Object { $_.display_name -ne 'WhatsNow' -or $_.group -ne '17CD4924-C1F4-4DF7-9DE1-B1D95F293640' -or $_.icon -ne $fixturePath }).Count -eq 0
    }
} while (-not $verified -and [DateTime]::UtcNow -lt $deadline -and -not $fixture.HasExited)
$current | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $evidence 'identity-during.json') -Encoding utf8
if (-not $fixture.WaitForExit(70000)) {
    $fixture.Kill()
    throw 'Native fixture exceeded its exit deadline'
}
if (-not $verified) { throw 'Owned fixture session never acquired the correct name/group/icon' }
if ($fixture.ExitCode -ne 0) { throw 'Native media lifecycle assertions failed' }
$after = Read-Sessions
$after | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $evidence 'identity-after.json') -Encoding utf8
foreach ($session in $before.sessions | Where-Object { $_.pid -ne 0 }) {
    $same = @($after.sessions | Where-Object { $_.instance -eq $session.instance })
    foreach ($row in $same) {
        if ($row.group -ne $session.group -or $row.display_name -ne $session.display_name -or $row.icon -ne $session.icon -or $row.muted -ne $session.muted -or $row.volume -ne $session.volume) {
            throw "Unrelated session metadata or mute/volume changed: PID $($session.pid)"
        }
    }
}
Write-Output 'PASS: owned audio identity applied; synthetic playback and manual controls preserved; surviving unrelated sessions unchanged.'
