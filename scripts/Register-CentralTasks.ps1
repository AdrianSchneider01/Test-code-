# scripts/Register-CentralTasks.ps1
# Registers the central machine's daily task (run once, as the user who is
# logged on; the observer opens a visible browser, so it needs a desktop session):
#   MTR Observer  - joins the test meeting and checks the room's camera
# The daily report email is sent by the mtr-results Worker (07:15 Sydney), not
# by this machine, so it still arrives when this machine is off.
# (scripts\Send-MTRDailyReport.ps1 remains for previews and manual sends.)
# ASCII only (PS 5.1).

param(
    [string]$RepoDir      = (Split-Path $PSScriptRoot -Parent),
    [string]$Python       = "C:\Users\adria\AppData\Local\Python\pythoncore-3.14-64\python.exe",
    [string]$ObserverAt   = "07:00:30"    # 30 s after the room's 07:00 task, so the room is in the call
)

$ErrorActionPreference = "Stop"
$user      = "$env:USERDOMAIN\$env:USERNAME"
$settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -StartWhenAvailable -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive

$obs = New-ScheduledTaskAction -Execute $Python -Argument "`"$RepoDir\Check-CameraFeed.py`"" -WorkingDirectory $RepoDir
Register-ScheduledTask -TaskName "MTR Observer" -Action $obs -Trigger (New-ScheduledTaskTrigger -Daily -At $ObserverAt) `
    -Principal $principal -Settings $settings -Force | Out-Null
Write-Host "Registered 'MTR Observer' daily at $ObserverAt"

# Older setups also had a local report task; the Worker sends the report now
if (Get-ScheduledTask -TaskName "MTR Daily Report" -ErrorAction SilentlyContinue) {
    Disable-ScheduledTask -TaskName "MTR Daily Report" | Out-Null
    Write-Host "Disabled the old local 'MTR Daily Report' task (the Worker sends the report)"
}
