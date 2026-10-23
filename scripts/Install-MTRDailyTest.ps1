# scripts/Install-MTRDailyTest.ps1
# Run ON the MTR as Admin (e.g. over AnyDesk) from a folder holding Diag9.ps1.
# Sets up the daily test call: copies Diag9.ps1 to C:\MTR, writes the endpoint
# config, and registers a daily task that runs Diag9 in the Skype session.
# ASCII only (PS 5.1).
#
# Example:
#   .\Install-MTRDailyTest.ps1 -Url https://mtr-results.adrian-ddf.workers.dev `
#       -ReportToken <token> -Room "Boardroom Test Account" -At 07:00
#
# Diag9 options (meeting ID, passcode, join mode) can be passed via -Diag9Args.

param(
    [Parameter(Mandatory)] [string]$Url,
    [Parameter(Mandatory)] [string]$ReportToken,
    [Parameter(Mandatory)] [string]$Room,          # must match the room's Teams display name
    [string]$At         = "07:00",
    [string]$Diag9Args  = "",
    [string]$SourceDir  = $PSScriptRoot,
    [string]$TaskName   = "MTRDailyTest",
    [string]$InstallDir = "C:\MTR"
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Copy-Item (Join-Path $SourceDir "Diag9.ps1") (Join-Path $InstallDir "Diag9.ps1") -Force
Write-Host "Copied Diag9.ps1 to $InstallDir"

# Endpoint config: readable by the Skype user (the task runs as Skype), writable by admins only
$cfgPath = Join-Path $InstallDir "mtr-config.json"
@{ url = $Url.TrimEnd('/'); reportToken = $ReportToken; room = $Room } | ConvertTo-Json | Set-Content $cfgPath -Encoding ASCII
$acl = New-Object Security.AccessControl.FileSecurity
$acl.SetAccessRuleProtection($true, $false)
foreach ($rule in @(
    @("BUILTIN\Administrators", "FullControl"),
    @("NT AUTHORITY\SYSTEM",    "FullControl"),
    @("Skype",                  "Read"))) {
    $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($rule[0], $rule[1], "Allow")))
}
Set-Acl $cfgPath $acl
Write-Host "Wrote $cfgPath (room '$Room')"

# Daily task in the Skype interactive session (LogonType Interactive = session 1)
$script = Join-Path $InstallDir "Diag9.ps1"
$log    = Join-Path $InstallDir "Diag9-log.txt"
$action    = New-ScheduledTaskAction -Execute "powershell.exe" `
                 -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"& '$script' $Diag9Args *> '$log'`""
$trigger   = New-ScheduledTaskTrigger -Daily -At $At
$principal = New-ScheduledTaskPrincipal -UserId "Skype" -LogonType Interactive -RunLevel Limited
$settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew -StartWhenAvailable
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Host "Registered task '$TaskName' daily at $At (user Skype, interactive)"

# Quick outbound check so a blocked network shows up at install time
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $h = Invoke-RestMethod "$($Url.TrimEnd('/'))/health" -TimeoutSec 15
    Write-Host "Endpoint reachable: $($h.ok)"
} catch {
    Write-Warning "Endpoint NOT reachable from this MTR: $_"
}
