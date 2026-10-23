# scripts/Invoke-MTRTest.ps1
# Deploy a script as the MTR launch hook, restart the MTR, wait, pull logs back.
# Claude Code runs this to test changes without human involvement.
#
# Usage:
#   .\scripts\Invoke-MTRTest.ps1 -ScriptPath .\MyScript.ps1

param(
    [Parameter(Mandatory)]
    [string]$ScriptPath,

    [string]$MTR          = '192.168.1.209',
    [string]$OutputFile   = 'C:\Rigel\AdminHookScripts\output.txt',
    [int]   $WaitSeconds  = 240
)

$cred = Import-Clixml "$env:USERPROFILE\mtr-cred.xml"
$opt  = @{ ComputerName = $MTR; Credential = $cred; Authentication = 'Basic' }

Write-Host "[$(Get-Date -f 'HH:mm:ss')] Connecting to MTR ($MTR)..."
$s = New-PSSession @opt

# Deploy script as the launch hook
Write-Host "[$(Get-Date -f 'HH:mm:ss')] Deploying $ScriptPath -> C:\Rigel\AdminHookScripts\Launch.ps1"
Copy-Item $ScriptPath -Destination 'C:\Rigel\AdminHookScripts\Launch.ps1' -ToSession $s -Force
Invoke-Command -Session $s { Remove-Item $using:OutputFile -ErrorAction SilentlyContinue }
Remove-PSSession $s

# Restart so the hook runs in the Skype session
Write-Host "[$(Get-Date -f 'HH:mm:ss')] Restarting MTR..."
Invoke-Command @opt { Restart-Computer -Force }

Write-Host "[$(Get-Date -f 'HH:mm:ss')] Waiting ${WaitSeconds}s for reboot and hook execution..."
Start-Sleep $WaitSeconds

# Pull results back
Write-Host "[$(Get-Date -f 'HH:mm:ss')] Reconnecting to fetch results..."
$s = New-PSSession @opt
New-Item -ItemType Directory -Force results | Out-Null

Copy-Item $OutputFile -Destination results\ -FromSession $s -ErrorAction SilentlyContinue

$ls = 'C:\Users\Skype\AppData\Local\Packages\Microsoft.SkypeRoomSystem_8wekyb3d8bbwe\LocalState'
Copy-Item "$ls\HealthState.xml" -Destination results\ -FromSession $s -ErrorAction SilentlyContinue
Invoke-Command -Session $s { Get-Content "$using:ls\Logs.txt" -Tail 200 } | Set-Content results\Logs-tail.txt

Remove-PSSession $s

Write-Host "[$(Get-Date -f 'HH:mm:ss')] Done. Output:"
Get-Content results\output.txt -ErrorAction SilentlyContinue
