# scripts/Register-CentralTasks.ps1
# Registers the central machine's daily tasks (run once, as the user who is
# logged on; the observer opens a visible browser, so it needs a desktop session):
#   MTR Observer      - joins the test meeting and checks the room's camera
#   MTR Daily Report  - emails the day's results
# ASCII only (PS 5.1).

param(
    [string]$RepoDir      = (Split-Path $PSScriptRoot -Parent),
    [string]$Python       = "C:\Users\adria\AppData\Local\Python\pythoncore-3.14-64\python.exe",
    [string]$ObserverAt   = "07:00:30",   # 30 s after the room's 07:00 task, so the room is in the call
    [string]$ReportAt     = "07:15",
    [string[]]$ExpectedRooms = @("Boardroom Test Account"),
    # Workspace SMTP relay "Require SMTP Authentication": app password saved by New-GmailCredential.ps1
    [string]$CredFile     = "$env:USERPROFILE\gmail-cred.xml"
)

$ErrorActionPreference = "Stop"
$user     = "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -StartWhenAvailable -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive

$obs = New-ScheduledTaskAction -Execute $Python -Argument "`"$RepoDir\Check-CameraFeed.py`"" -WorkingDirectory $RepoDir
Register-ScheduledTask -TaskName "MTR Observer" -Action $obs -Trigger (New-ScheduledTaskTrigger -Daily -At $ObserverAt) `
    -Principal $principal -Settings $settings -Force | Out-Null
Write-Host "Registered 'MTR Observer' daily at $ObserverAt"

$rooms  = ($ExpectedRooms | ForEach-Object { "'$_'" }) -join ","
$report = New-ScheduledTaskAction -Execute "powershell.exe" -WorkingDirectory $RepoDir `
    -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"& '$RepoDir\scripts\Send-MTRDailyReport.ps1' -ExpectedRooms $rooms -CredFile '$CredFile' *> '$RepoDir\results\daily-report-log.txt'`""
Register-ScheduledTask -TaskName "MTR Daily Report" -Action $report -Trigger (New-ScheduledTaskTrigger -Daily -At $ReportAt) `
    -Principal $principal -Settings $settings -Force | Out-Null
Write-Host "Registered 'MTR Daily Report' daily at $ReportAt"
