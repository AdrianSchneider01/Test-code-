# scripts/Invoke-MTRTest.ps1
# Deploy a script as the MTR launch hook, restart the MTR, wait, pull logs back.
# Claude Code runs this to test changes without human involvement.
#
# Usage:
#   .\scripts\Invoke-MTRTest.ps1 -ScriptPath .\MyScript.ps1
#   .\scripts\Invoke-MTRTest.ps1 -ScriptPath .\MTR-UIDiscovery.ps1 `
#       -DoneFile C:\Users\Skype\UIElements.txt `
#       -FetchFiles C:\Users\Skype\UIElements.txt, C:\Users\Skype\Discovery-Log.txt, C:\Users\Skype\Discovery-Error.txt `
#       -Cleanup
#
# -DoneFile    remote file whose appearance means the hook finished (default: OutputFile)
# -FetchFiles  extra remote files to copy into results\ (deleted on the MTR before the run)
# -Cleanup     remove the hook after fetching so the next boot runs the stock Launch.ps1

param(
    [Parameter(Mandatory)]
    [string]$ScriptPath,

    [string]  $MTR          = '192.168.1.209',
    [string]  $OutputFile   = 'C:\Rigel\AdminHookScripts\output.txt',
    [string]  $DoneFile     = '',
    [string[]]$FetchFiles   = @(),
    [int]     $WaitSeconds  = 600,
    [int]     $PollSeconds  = 15,
    [switch]  $Cleanup
)

$HookPath = 'C:\Rigel\AdminHookScripts\Launch.ps1'
if (-not $DoneFile) { $DoneFile = $OutputFile }

$cred = Import-Clixml "$env:USERPROFILE\mtr-cred.xml"
$opt  = @{ ComputerName = $MTR; Credential = $cred; Authentication = 'Basic' }

function Write-Step($msg) { Write-Host "[$(Get-Date -f 'HH:mm:ss')] $msg" }

Write-Step "Connecting to MTR ($MTR)..."
$s = New-PSSession @opt -ErrorAction Stop

# Deploy script as the launch hook, clear stale results
Write-Step "Deploying $ScriptPath -> $HookPath"
Copy-Item $ScriptPath -Destination $HookPath -ToSession $s -Force
Invoke-Command -Session $s {
    foreach ($f in @($using:OutputFile) + $using:FetchFiles) { Remove-Item $f -ErrorAction SilentlyContinue }
}
$bootBefore = Invoke-Command -Session $s { (Get-CimInstance Win32_OperatingSystem).LastBootUpTime }
Remove-PSSession $s

# Restart so the hook runs in the Skype session
Write-Step "Restarting MTR..."
Invoke-Command @opt { Restart-Computer -Force }

# Poll until the MTR is back up and DoneFile exists, or time out
Write-Step "Waiting up to ${WaitSeconds}s for reboot and $DoneFile..."
$deadline = (Get-Date).AddSeconds($WaitSeconds)
$s = $null
$done = $false
Start-Sleep 30
while ((Get-Date) -lt $deadline) {
    try {
        if (-not $s -or $s.State -ne 'Opened') { $s = New-PSSession @opt -ErrorAction Stop }
        $state = Invoke-Command -Session $s -ErrorAction Stop {
            [pscustomobject]@{ Boot = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime; Done = (Test-Path $using:DoneFile) }
        }
        if ($state.Boot -gt $bootBefore -and $state.Done) { $done = $true; break }
    } catch {
        if ($s) { Remove-PSSession $s -ErrorAction SilentlyContinue; $s = $null }
    }
    Start-Sleep $PollSeconds
}
if ($done) { Write-Step "Hook finished." } else { Write-Step "TIMEOUT: $DoneFile not found; fetching whatever exists." }

# Pull results back on a fresh session (one opened mid-boot can fail copies silently)
if ($s) { Remove-PSSession $s -ErrorAction SilentlyContinue }
Start-Sleep 5
$s = New-PSSession @opt -ErrorAction Stop

$Results = Join-Path (Split-Path $PSScriptRoot -Parent) 'results'
Write-Step "Fetching results to $Results..."
New-Item -ItemType Directory -Force $Results | Out-Null

$ls = 'C:\Users\Skype\AppData\Local\Packages\Microsoft.SkypeRoomSystem_8wekyb3d8bbwe\LocalState'
foreach ($f in @($OutputFile, "$ls\HealthState.xml") + $FetchFiles) {
    try {
        Copy-Item $f -Destination $Results -FromSession $s -ErrorAction Stop
        Write-Step "  fetched $f"
    } catch {
        Write-Step "  not fetched $f ($($_.Exception.Message))"
    }
}
# Logs.txt is absent on newer Teams Rooms builds; only tail it if present
Invoke-Command -Session $s { if (Test-Path "$using:ls\Logs.txt") { Get-Content "$using:ls\Logs.txt" -Tail 200 } } |
    Set-Content (Join-Path $Results 'Logs-tail.txt')

if ($Cleanup) {
    Write-Step "Removing hook $HookPath"
    Invoke-Command -Session $s { Remove-Item $using:HookPath -Force -ErrorAction SilentlyContinue }
}

Remove-PSSession $s

Write-Step "Done. Results in $Results"
Get-ChildItem $Results | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize | Out-String | Write-Host
Get-Content (Join-Path $Results 'output.txt') -ErrorAction SilentlyContinue
if (-not $done) { exit 1 }
