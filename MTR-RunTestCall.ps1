# MTR-RunTestCall.ps1
# Run from your laptop. Connects to the MTR via PS remoting, deploys the
# latest scripts, triggers the test call, then runs the camera check locally.

param(
    [string]$MtrHost      = "C4-54B20393935E",
    [string]$MtrUser      = "C4-54B20393935E\Admin",
    [string]$MtrScriptDir = "C:\MTR",
    [string]$TaskName     = "MTRTestCallTemp",
    [string]$LocalPython  = "C:\Users\adria\AppData\Local\Python\pythoncore-3.14-64\python.exe",
    [string]$LocalScript  = "C:\MTR\Check-CameraFeed.py",
    [int]   $JoinWaitSec  = 15    # seconds to wait for MTR to join before browser check
)

$ScriptDir = $PSScriptRoot

function Write-Log { param([string]$m) Write-Host "[$(Get-Date -f 'HH:mm:ss')] $m" }

# ── 1. Connect ────────────────────────────────────────────────────────────────
Write-Log "Connecting to $MtrHost..."
$cred = Get-Credential $MtrUser
try {
    $s = New-PSSession -ComputerName $MtrHost -Credential $cred -ErrorAction Stop
    Write-Log "Connected."
} catch {
    Write-Log "ERROR: could not connect to $MtrHost - $_"
    exit 1
}

# ── 2. Deploy latest scripts to MTR ──────────────────────────────────────────
Write-Log "Deploying scripts to $MtrHost:$MtrScriptDir..."
Invoke-Command -Session $s -ScriptBlock { param($d) New-Item -ItemType Directory -Path $d -Force | Out-Null } -ArgumentList $MtrScriptDir

foreach ($file in @("Diag9.ps1", "MTR-InjectUIAutomation.ps1", "MTR-TestCallHelper.ps1")) {
    $src = Join-Path $ScriptDir $file
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination "$MtrScriptDir\$file" -ToSession $s -Force
        Write-Log "  Copied $file"
    }
}

# ── 3. Trigger scheduled task on MTR ─────────────────────────────────────────
Write-Log "Starting task '$TaskName' on $MtrHost..."
Invoke-Command -Session $s -ScriptBlock {
    param($task)
    Start-ScheduledTask -TaskName $task
} -ArgumentList $TaskName
Write-Log "Task triggered."

# ── 4. Wait for MTR to join, then run camera check locally ───────────────────
Write-Log "Waiting ${JoinWaitSec}s for MTR to join meeting..."
Start-Sleep -Seconds $JoinWaitSec

Write-Log "Running camera check..."
$camProc = Start-Process -FilePath $LocalPython -ArgumentList $LocalScript -PassThru -Wait -NoNewWindow
$camLive = ($camProc.ExitCode -eq 0)
Write-Log "Camera check: $( if ($camLive) { 'LIVE ✓' } else { 'NO FEED ✗' } )"

# ── 5. Read MTR-side result ───────────────────────────────────────────────────
Write-Log "Reading MTR result..."
$mtrResult = Invoke-Command -Session $s -ScriptBlock {
    param($f)
    if (Test-Path $f) { Get-Content $f -Raw } else { $null }
} -ArgumentList "$MtrScriptDir\TestCallResult.json"

if ($mtrResult) {
    $r = $mtrResult | ConvertFrom-Json
    Write-Log "MTR result: $($r.Status) - $($r.Message)"
} else {
    Write-Log "No MTR result file found yet."
}

Remove-PSSession $s

# ── 6. Summary ────────────────────────────────────────────────────────────────
$overall = if ($camLive -and ($mtrResult -and ($mtrResult | ConvertFrom-Json).Status -ne "FAIL")) { "PASS" } else { "FAIL" }
Write-Log "=================================================="
Write-Log "OVERALL: $overall  |  Camera: $( if ($camLive) {'LIVE'} else {'NO FEED'} )  |  MTR: $($r.Status)"
Write-Log "=================================================="

exit $(if ($overall -eq "PASS") { 0 } else { 1 })
