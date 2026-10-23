# ============================================================
# Run-MTRDiscoveryRemote.ps1
# Run from LAPTOP-BH7KAQA3
# Deploys discovery script via AdminHookScripts mechanism
# then pulls results back after MTR restart
# ============================================================

$MTRComputer  = "192.168.1.209"
$LocalOutput  = "C:\MTR-Discovery"
$TaskName     = "MTR-UIDiscovery"

# Paths on the MTR
$AdminHookPath   = "C:\Rigel\AdminHookScripts\Launch.ps1"
$RealLaunchPath  = "C:\Users\Skype\ScriptLaunchCache\Launch.ps1"
$UIElementsPath  = "C:\Users\Skype\UIElements.txt"
$DiscoveryLog    = "C:\Users\Skype\Discovery-Log.txt"
$DiscoveryError  = "C:\Users\Skype\Discovery-Error.txt"
$DiscoveryScript = "C:\MTR-HealthCheck\MTR-UIDiscovery.ps1"

if (-not (Test-Path $LocalOutput)) {
    New-Item -ItemType Directory -Path $LocalOutput | Out-Null
}

Write-Host ""
Write-Host "MTR UI Discovery - AdminHookScripts Method" -ForegroundColor Cyan
Write-Host "Target MTR : $MTRComputer" -ForegroundColor White
Write-Host "Results to : $LocalOutput" -ForegroundColor White
Write-Host ""

# ============================================================
# STEP 1 - Credentials
# ============================================================
Write-Host "Step 1: Enter admin credentials for the MTR" -ForegroundColor Yellow
$cred = Get-Credential -Message "Enter credentials for $MTRComputer (.\Admin)"

# ============================================================
# STEP 2 - Test connectivity
# ============================================================
Write-Host ""
Write-Host "Step 2: Testing connection..." -ForegroundColor Yellow

if (-not (Test-Connection -ComputerName $MTRComputer -Count 2 -Quiet)) {
    Write-Host "ERROR: Cannot ping $MTRComputer" -ForegroundColor Red
    exit 1
}
Write-Host "Ping OK" -ForegroundColor Green

try {
    Test-WSMan -ComputerName $MTRComputer -ErrorAction Stop | Out-Null
    Write-Host "WinRM OK" -ForegroundColor Green
} catch {
    Write-Host "ERROR: WinRM not available" -ForegroundColor Red
    exit 1
}

# ============================================================
# STEP 3 - Choose action
# ============================================================
Write-Host ""
Write-Host "What would you like to do?" -ForegroundColor Yellow
Write-Host "  1. Deploy discovery script and restart MTR" -ForegroundColor White
Write-Host "  2. Pull results (after MTR has restarted)" -ForegroundColor White
Write-Host "  3. Remove discovery script and restore MTR" -ForegroundColor White
Write-Host ""
$choice = Read-Host "Enter choice (1/2/3)"

# ============================================================
# OPTION 1 - Deploy
# ============================================================
if ($choice -eq "1") {
    Write-Host ""
    Write-Host "Deploying discovery script to AdminHookScripts..." -ForegroundColor Yellow

    $deployed = Invoke-Command -ComputerName $MTRComputer -Credential $cred -Authentication Basic -ScriptBlock {
        param($src, $dst)

        # Backup real Launch.ps1 first if not already backed up
        $backup = "C:\MTR-HealthCheck\Launch.ps1.backup"
        if (-not (Test-Path $backup)) {
            if (Test-Path $dst) {
                Copy-Item $dst $backup -Force
                Write-Host "Backed up existing AdminHookScripts\Launch.ps1 to $backup"
            }
        }

        # Copy discovery script to AdminHookScripts
        Copy-Item $src $dst -Force
        Write-Host "Discovery script deployed to: $dst"
        return (Test-Path $dst)
    } -ArgumentList $DiscoveryScript, $AdminHookPath

    if ($deployed) {
        Write-Host "SUCCESS: Discovery script deployed" -ForegroundColor Green
        Write-Host ""
        Write-Host "Now restarting the MTR..." -ForegroundColor Yellow

        Invoke-Command -ComputerName $MTRComputer -Credential $cred -Authentication Basic -ScriptBlock {
            Restart-Computer -Force
        }

        Write-Host ""
        Write-Host "MTR is restarting." -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "1. Wait 2-3 minutes for the MTR to boot" -ForegroundColor White
        Write-Host "2. Check AnyDesk to confirm Teams Rooms home screen is visible" -ForegroundColor White
        Write-Host "3. Wait another 30 seconds for the discovery script to run" -ForegroundColor White
        Write-Host "4. Run this script again and choose option 2 to pull results" -ForegroundColor White
    } else {
        Write-Host "ERROR: Deployment failed" -ForegroundColor Red
    }
}

# ============================================================
# OPTION 2 - Pull results
# ============================================================
elseif ($choice -eq "2") {
    Write-Host ""
    Write-Host "Pulling results from MTR..." -ForegroundColor Yellow

    $timestamp = Get-Date -Format "yyyyMMdd-HHmm"

    try {
        $session = New-PSSession -ComputerName $MTRComputer -Credential $cred -Authentication Basic

        # Check if UIElements.txt exists
        $exists = Invoke-Command -Session $session -ScriptBlock {
            param($p) Test-Path $p
        } -ArgumentList $UIElementsPath

        if ($exists) {
            $dest = Join-Path $LocalOutput "UIElements-$timestamp.txt"
            Copy-Item -Path $UIElementsPath -Destination $dest -FromSession $session
            Write-Host "UIElements.txt saved to: $dest" -ForegroundColor Green

            $lines = (Get-Content $dest | Measure-Object -Line).Lines
            Write-Host "File contains $lines lines" -ForegroundColor Green

            $open = Read-Host "Open UIElements.txt now? (Y/N)"
            if ($open -eq "Y" -or $open -eq "y") {
                notepad.exe $dest
            }
        } else {
            Write-Host "UIElements.txt not found yet on MTR" -ForegroundColor Red
            Write-Host "The MTR may still be booting or the discovery is still running" -ForegroundColor Yellow
        }

        # Pull logs regardless
        foreach ($logPath in @($DiscoveryLog, $DiscoveryError)) {
            $logExists = Invoke-Command -Session $session -ScriptBlock {
                param($p) Test-Path $p
            } -ArgumentList $logPath

            if ($logExists) {
                $logName = Split-Path $logPath -Leaf
                $logDest = Join-Path $LocalOutput "$([System.IO.Path]::GetFileNameWithoutExtension($logName))-$timestamp.txt"
                Copy-Item -Path $logPath -Destination $logDest -FromSession $session
                Write-Host "$logName copied to: $logDest" -ForegroundColor Green
            }
        }

        Remove-PSSession $session

    } catch {
        Write-Host "ERROR: $_" -ForegroundColor Red
    }
}

# ============================================================
# OPTION 3 - Restore
# ============================================================
elseif ($choice -eq "3") {
    Write-Host ""
    Write-Host "Removing discovery script from AdminHookScripts..." -ForegroundColor Yellow

    Invoke-Command -ComputerName $MTRComputer -Credential $cred -Authentication Basic -ScriptBlock {
        param($hookPath)

        $backup = "C:\MTR-HealthCheck\Launch.ps1.backup"

        if (Test-Path $hookPath) {
            Remove-Item $hookPath -Force
            Write-Host "Removed: $hookPath"
        }

        if (Test-Path $backup) {
            Copy-Item $backup $hookPath -Force
            Write-Host "Restored backup to: $hookPath"
        }

        Write-Host "Restarting MTR..."
        Restart-Computer -Force
    } -ArgumentList $AdminHookPath

    Write-Host ""
    Write-Host "SUCCESS: Discovery script removed, MTR restarting" -ForegroundColor Green
    Write-Host "Verify Teams Rooms starts normally via AnyDesk" -ForegroundColor Yellow
}

else {
    Write-Host "Invalid choice" -ForegroundColor Red
}

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
