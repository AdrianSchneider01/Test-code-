# MTR-RunTestCall.ps1
# Run from your laptop. Connects to the MTR via PS remoting, deploys the
# latest scripts, triggers the test call, then runs the camera check locally.

param(
    [string]$MtrHost      = "192.168.1.209",
    [string]$MtrUser      = "Admin",
    [string]$MtrScriptDir = "C:\MTR",
    [string]$TaskName     = "MTRTestCallInteractive",
    [string]$LocalPython  = "C:\Users\adria\AppData\Local\Python\pythoncore-3.14-64\python.exe",
    [string]$LocalScript  = "$PSScriptRoot\Check-CameraFeed.py",
    [int]   $JoinWaitSec  = 25    # seconds to wait for MTR to join before browser check
)

$ScriptDir = $PSScriptRoot

function Write-Log { param([string]$m) Write-Host "[$(Get-Date -f 'HH:mm:ss')] $m" }

# -- 1. Connect ----------------------------------------------------------------
Write-Log "Connecting to $MtrHost..."
$credXml = "$env:USERPROFILE\mtr-cred.xml"
if (Test-Path $credXml) {
    $cred = Import-Clixml $credXml
} else {
    $pw   = ConvertTo-SecureString "sfb" -AsPlainText -Force
    $cred = New-Object PSCredential($MtrUser, $pw)
}
try {
    $s = New-PSSession -ComputerName $MtrHost -Credential $cred -ErrorAction Stop
    Write-Log "Connected."
} catch {
    Write-Log "ERROR: could not connect to $MtrHost - $_"
    exit 1
}

# -- 2. Deploy latest scripts to MTR ------------------------------------------
Write-Log "Deploying scripts to ${MtrHost}:${MtrScriptDir}..."
Invoke-Command -Session $s -ScriptBlock { param($d) New-Item -ItemType Directory -Path $d -Force | Out-Null } -ArgumentList $MtrScriptDir

foreach ($file in @("Diag9.ps1", "MTR-InjectUIAutomation.ps1", "MTR-TestCallHelper.ps1")) {
    $src = Join-Path $ScriptDir $file
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination "$MtrScriptDir\$file" -ToSession $s -Force
        Write-Log "  Copied $file"
    }
}

# -- 2b. Read upcoming meeting URL from MTR's LocalState XML files ----------------
Write-Log "Reading upcoming meeting URL from MTR..."
$mtrMeetingUrl = Invoke-Command -Session $s -ScriptBlock {
    $ls  = "C:\Users\Skype\AppData\Local\Packages\Microsoft.SkypeRoomSystem_8wekyb3d8bbwe\LocalState"
    $pat = 'https://teams\.microsoft\.com/[^\s"''<>&]+'
    $found = @()
    foreach ($f in (Get-ChildItem $ls -Filter "*.xml" -ErrorAction SilentlyContinue)) {
        try {
            $txt = [System.IO.File]::ReadAllText($f.FullName)
            foreach ($m in [regex]::Matches($txt, $pat)) {
                $url = $m.Value
                if ($url -match '/meet/') { $found += $url }
            }
        } catch {}
    }
    ($found | Select-Object -Unique | Select-Object -First 1)
}
$meetingId = $null; $meetingPasscode = $null
if ($mtrMeetingUrl) {
    Write-Log "Found meeting URL: $mtrMeetingUrl"
    if ($mtrMeetingUrl -match '/meet/(\d+)') { $meetingId = $Matches[1] }
    if ($mtrMeetingUrl -match '[?&]p=([^&"]+)')        { $meetingPasscode = $Matches[1] }
    if ($mtrMeetingUrl -match '[?&]passcode=([^&"]+)') { $meetingPasscode = $Matches[1] }
    Write-Log "Parsed -- MeetingId: $meetingId  Passcode: $(if($meetingPasscode){'(found)'}else{'(none)'})"
} else {
    Write-Log "No meeting URL found on MTR -- Diag9 will use its defaults"
}

# -- 2c. Register interactive task (LogonType=Interactive runs in Skype Session 1) --
Write-Log "Registering $TaskName as Skype interactive task..."
Invoke-Command -Session $s -ScriptBlock {
    param($tn, $script, $log, $mid, $mpas)
    # Build args; redirect all output streams to log so failures are visible
    $diagArgs = "-NoProfile -ExecutionPolicy Bypass -Command `"& '$script'"
    if ($mid)  { $diagArgs += " -MeetingId $mid" }
    if ($mpas) { $diagArgs += " -Passcode $mpas" }
    $diagArgs += " *> '$log'`""
    $action    = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $diagArgs
    $principal = New-ScheduledTaskPrincipal -UserId "Skype" -LogonType Interactive -RunLevel Limited
    $settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
                     -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName $tn -Action $action -Principal $principal `
        -Settings $settings -Force | Out-Null
    "Registered '$tn' (LogonType=Interactive, user=Skype)"
} -ArgumentList $TaskName, "$MtrScriptDir\Diag9.ps1", "$MtrScriptDir\Diag9-log.txt", $meetingId, $meetingPasscode

# -- 3. Clear old result file, then trigger task -------------------------------
Invoke-Command -Session $s -ScriptBlock {
    param($files) foreach ($f in $files) { Remove-Item $f -ErrorAction SilentlyContinue }
} -ArgumentList (,@("$MtrScriptDir\TestCallResult.json", "$MtrScriptDir\Diag9-log.txt"))

Write-Log "Starting task '$TaskName' on $MtrHost..."
Invoke-Command -Session $s -ScriptBlock {
    param($task)
    Start-ScheduledTask -TaskName $task
} -ArgumentList $TaskName
Write-Log "Task triggered."

# -- 4. Wait for MTR to join, then run camera check locally -------------------
Write-Log "Waiting ${JoinWaitSec}s for MTR to join meeting..."
Start-Sleep -Seconds $JoinWaitSec

Write-Log "Running camera check..."
$camArgs = if ($mtrMeetingUrl) { @($LocalScript, $mtrMeetingUrl) } else { @($LocalScript) }
$camProc = Start-Process -FilePath $LocalPython -ArgumentList $camArgs -PassThru -Wait -NoNewWindow
$camLive = ($camProc.ExitCode -eq 0)
Write-Log "Camera check: $( if ($camLive) { 'LIVE OK' } else { 'NO FEED X' } )"

# -- 5. Poll for MTR-side result (task may still be running) ------------------
Write-Log "Waiting for MTR result file (up to 120s)..."
$r = $null
$deadline = (Get-Date).AddSeconds(120)
while ((Get-Date) -lt $deadline -and -not $r) {
    $mtrRaw = Invoke-Command -Session $s -ScriptBlock {
        param($f) if (Test-Path $f) { Get-Content $f -Raw } else { $null }
    } -ArgumentList "$MtrScriptDir\TestCallResult.json"
    if ($mtrRaw) {
        try { $r = $mtrRaw | ConvertFrom-Json } catch {}
    }
    if (-not $r) { Start-Sleep 5 }
}

if ($r) {
    Write-Log "MTR result: $($r.Status) - $($r.Message)"
} else {
    Write-Log "MTR result: timed out waiting for result file"
}

Write-Log "--- Diag9 log (MTR) ---"
Invoke-Command -Session $s -ScriptBlock {
    param($f) if (Test-Path $f) { Get-Content $f } else { "(no log at $f)" }
} -ArgumentList "$MtrScriptDir\Diag9-log.txt" | ForEach-Object { Write-Host "  $_" }

Remove-PSSession $s

# -- 6. Summary ----------------------------------------------------------------
$mtrStatus  = if ($r) { $r.Status } else { "TIMEOUT" }
$overall    = if ($camLive -and $mtrStatus -eq "PASS") { "PASS" } `
              elseif ($camLive -and $mtrStatus -eq "WARN") { "WARN" } `
              else { "FAIL" }
Write-Log "=================================================="
Write-Log "OVERALL: $overall  |  Camera: $( if ($camLive) {'LIVE'} else {'NO FEED'} )  |  MTR: $mtrStatus"
Write-Log "=================================================="

exit $(if ($overall -eq "PASS") { 0 } else { 1 })
