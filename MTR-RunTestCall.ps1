# MTR-RunTestCall.ps1
# Orchestrates a full MTR test call:
#   1. Deploys Diag9.ps1 to the MTR PC via PS remoting
#   2. Runs Diag9.ps1 on the MTR (joins + checks hardware + leaves)
#   3. Runs Check-CameraFeed.py locally to verify live camera feed
#   4. Writes a combined JSON result

param(
    [string]$MtrHost       = "MTR-PC",          # MTR hostname or IP
    [string]$MtrUser       = "Administrator",   # local admin on MTR
    [string]$MtrScriptDir  = "C:\MTR",
    [string]$LocalPython   = "C:\Users\adria\AppData\Local\Python\pythoncore-3.14-64\python.exe",
    [string]$LocalScript   = "C:\MTR\Check-CameraFeed.py",
    [string]$ResultFile    = "C:\MTR\TestCallResult.json"
)

function Write-Log { param([string]$m) Write-Host "[$(Get-Date -f 'HH:mm:ss')] $m" }

# ── Credentials ──────────────────────────────────────────────────────────────
# Prompt once; for unattended use replace with:
#   $pw  = ConvertTo-SecureString "password" -AsPlainText -Force
#   $cred = New-Object PSCredential($MtrUser, $pw)
$cred = Get-Credential -UserName $MtrUser -Message "Enter credentials for $MtrHost"

# ── 1. Copy Diag9.ps1 to MTR ─────────────────────────────────────────────────
$localDiag  = Join-Path $PSScriptRoot "Diag9.ps1"
$remoteDiag = "$MtrScriptDir\Diag9.ps1"

Write-Log "Copying Diag9.ps1 to $MtrHost..."
try {
    $session = New-PSSession -ComputerName $MtrHost -Credential $cred -ErrorAction Stop
    Invoke-Command -Session $session -ScriptBlock { param($d) New-Item -ItemType Directory -Path $d -Force | Out-Null } -ArgumentList $MtrScriptDir
    Copy-Item -Path $localDiag -Destination $remoteDiag -ToSession $session -Force
    Write-Log "Copied."
} catch {
    Write-Log "ERROR connecting to $MtrHost`: $_"
    exit 1
}

# ── 2. Run Diag9.ps1 on MTR ──────────────────────────────────────────────────
Write-Log "Running Diag9.ps1 on $MtrHost..."
$diagResult = Invoke-Command -Session $session -ScriptBlock {
    param($script, $result)
    & powershell.exe -ExecutionPolicy Bypass -File $script -ResultFile $result
    if (Test-Path $result) { Get-Content $result -Raw } else { $null }
} -ArgumentList $remoteDiag, "$MtrScriptDir\DiagResult.json"

Write-Log "Diag9 output:"
Write-Log $diagResult

$diagObj = $null
try { $diagObj = $diagResult | ConvertFrom-Json } catch {}

if ($diagObj -and $diagObj.Status -eq "FAIL") {
    Write-Log "Diag9 reported FAIL — skipping camera check"
    $diagObj | ConvertTo-Json -Depth 3 | Set-Content $ResultFile -Encoding UTF8
    Remove-PSSession $session
    exit 1
}

# ── 3. Run camera check locally ───────────────────────────────────────────────
Write-Log "Waiting 5s before camera check..."
Start-Sleep -Seconds 5

Write-Log "Running Check-CameraFeed.py..."
$camProc = Start-Process -FilePath $LocalPython -ArgumentList $LocalScript `
           -PassThru -Wait -NoNewWindow
$camLive = ($camProc.ExitCode -eq 0)
Write-Log "Camera check exit code: $($camProc.ExitCode) → $( if ($camLive) { 'LIVE' } else { 'NO FEED' })"

# ── 4. Combined result ────────────────────────────────────────────────────────
$camStatus = if ($camLive) { "PASS" } else { "FAIL" }
$combined  = @{
    Timestamp    = (Get-Date -f "o")
    MtrHost      = $MtrHost
    DiagResult   = $diagObj
    CameraStatus = $camStatus
    OverallStatus = if ($diagObj.Status -eq "PASS" -and $camLive) { "PASS" } `
                    elseif ($diagObj.Status -eq "WARN" -or -not $camLive) { "WARN" } `
                    else { "FAIL" }
}
$combined | ConvertTo-Json -Depth 5 | Set-Content $ResultFile -Encoding UTF8
Write-Log "Result written to $ResultFile"
Write-Log "=== OVERALL: $($combined.OverallStatus) ==="

Remove-PSSession $session
exit $(if ($combined.OverallStatus -eq "PASS") { 0 } else { 1 })
