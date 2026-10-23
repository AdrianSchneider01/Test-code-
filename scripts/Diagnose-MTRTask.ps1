# scripts/Diagnose-MTRTask.ps1
# Checks the MTRTestCallTemp task configuration and session context,
# then attempts to run a UIA probe in the correct session.
# Run from the laptop: .\scripts\Diagnose-MTRTask.ps1

param(
    [string]$MTR      = '192.168.1.209',
    [string]$TaskName = 'MTRTestCallTemp'
)

$cred = Import-Clixml "$env:USERPROFILE\mtr-cred.xml"
$opt  = @{ ComputerName=$MTR; Credential=$cred; Authentication='Basic' }

Write-Host "`n=== Connecting to MTR ===" -ForegroundColor Cyan
$s = New-PSSession @opt -ErrorAction Stop
Write-Host "Connected."

Write-Host "`n=== Scheduled task: $TaskName ===" -ForegroundColor Cyan
Invoke-Command -Session $s {
    param($tn)
    $t = Get-ScheduledTask -TaskName $tn -ErrorAction SilentlyContinue
    if (-not $t) { "TASK NOT FOUND: $tn"; return }
    "State      : $($t.State)"
    "Principal  : UserId=$($t.Principal.UserId)  LogonType=$($t.Principal.LogonType)  RunLevel=$($t.Principal.RunLevel)"
    "Actions    :"
    foreach ($a in $t.Actions) { "  $($a.Execute) $($a.Arguments)" }
    $info = Get-ScheduledTaskInfo -TaskName $tn
    "LastRunTime: $($info.LastRunTime)"
    "LastResult : $($info.LastTaskResult)  (0=success, 1=app error, 0x41301=still running)"
} -ArgumentList $TaskName

Write-Host "`n=== Session list on MTR ===" -ForegroundColor Cyan
Invoke-Command -Session $s {
    query session 2>&1
}

Write-Host "`n=== Skype process / session ===" -ForegroundColor Cyan
Invoke-Command -Session $s {
    Get-Process -Name "Teams", "Skype", "MSTeams" -ErrorAction SilentlyContinue |
        Select-Object Name, Id, SessionId, MainWindowTitle
}

Write-Host "`n=== Result file ===" -ForegroundColor Cyan
Invoke-Command -Session $s {
    $f = "C:\MTR\TestCallResult.json"
    if (Test-Path $f) { Get-Content $f } else { "(not found)" }
}

Write-Host "`n=== UIA probe -- what root windows are visible in this PS session? ===" -ForegroundColor Cyan
Invoke-Command -Session $s {
    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes
    $AE   = [System.Windows.Automation.AutomationElement]
    $TF   = [System.Windows.Automation.TreeScope]
    $all  = [System.Windows.Automation.Condition]::TrueCondition
    $wins = $AE::RootElement.FindAll($TF::Children, $all)
    "Session 0 (PS remoting) sees $($wins.Count) top-level window(s):"
    foreach ($w in $wins) {
        try { "  '$($w.Current.Name)'  pid=$($w.Current.ProcessId)" } catch {}
    }
}

Write-Host "`n=== Diag9.ps1 on MTR (current content first 10 lines) ===" -ForegroundColor Cyan
Invoke-Command -Session $s {
    Get-Content "C:\MTR\Diag9.ps1" -TotalCount 10 -ErrorAction SilentlyContinue
}

Remove-PSSession $s
Write-Host "`n=== Done. Paste all output above back to Claude. ===" -ForegroundColor Green
