# ============================================================
# MTR-UIDiscovery.ps1
# Deployed to C:\Rigel\AdminHookScripts\Launch.ps1
# Runs automatically in the Skype session via ScriptLaunch.ps1
# Dumps all UI Automation elements to a text file
#
# ScriptLaunch.ps1 runs this file INSTEAD of the real Launch.ps1,
# so the real one is started first in the background (it launches
# Teams Rooms and never exits), then the UI is scanned once loaded.
# ============================================================

$OutputFile  = "C:\Users\Skype\UIElements.txt"
$LogFile     = "C:\Users\Skype\Discovery-Log.txt"
$ErrorFile   = "C:\Users\Skype\Discovery-Error.txt"
$RealLaunch  = "C:\Users\Skype\ScriptLaunchCache\Launch.ps1"

# Scan attempts: wait for the home screen buttons before dumping
$ScanAttempts    = 10
$ScanIntervalSec = 30
$HomeMarkers     = @("Join", "Meet now", "Join with an ID")

$ErrorActionPreference = "Continue"

function Write-Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts $msg" | Out-File $LogFile -Append -Encoding UTF8
}

function Write-Err($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts $msg" | Out-File $ErrorFile -Append -Encoding UTF8
}

$launchProc = $null

try {
    Write-Log "=== MTR-UIDiscovery started ==="
    Write-Log "Running as : $env:USERNAME"
    Write-Log "Session ID : $([System.Diagnostics.Process]::GetCurrentProcess().SessionId)"
    Write-Log "PID        : $PID"
    Write-Log "Output     : $OutputFile"

    # Start the real Launch.ps1 so Teams Rooms comes up
    if (Test-Path $RealLaunch) {
        $launchProc = Start-Process PowerShell.exe -ArgumentList @("-ExecutionPolicy", "Unrestricted", "-File", $RealLaunch) -WindowStyle Hidden -PassThru
        Write-Log "Started real Launch.ps1 (PID $($launchProc.Id))"
    } else {
        Write-Log "WARNING: Real Launch.ps1 not found at $RealLaunch"
    }

    # Load UI Automation assemblies
    Write-Log "Loading UIAutomation assemblies..."
    try {
        Add-Type -AssemblyName UIAutomationClient -ErrorAction Stop
        Add-Type -AssemblyName UIAutomationTypes  -ErrorAction Stop
        Write-Log "Assemblies loaded OK"
    } catch {
        Write-Log "ERROR loading assemblies: $_"
        Write-Err "Assembly load failed: $_"
        throw
    }

    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $condition = [System.Windows.Automation.Condition]::TrueCondition

    # Wait for the Teams Rooms home screen before scanning
    $homeFound = $false
    for ($i = 1; $i -le $ScanAttempts -and -not $homeFound; $i++) {
        Write-Log "Waiting $ScanIntervalSec s for home screen (attempt $i of $ScanAttempts)..."
        Start-Sleep -Seconds $ScanIntervalSec
        try {
            $names = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition) | ForEach-Object { $_.Current.Name }
            $hit = $HomeMarkers | Where-Object { $names -contains $_ } | Select-Object -First 1
            if ($hit) { $homeFound = $true; Write-Log "Home screen detected ('$hit')" }
        } catch {
            Write-Log "Probe error: $_"
        }
    }
    if (-not $homeFound) { Write-Log "WARNING: home screen markers not found; scanning anyway" }

    $output = [System.Collections.Generic.List[string]]::new()
    $output.Add("=" * 80)
    $output.Add("MTR UI Element Discovery")
    $output.Add("Generated  : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
    $output.Add("Running as : $env:USERNAME")
    $output.Add("Session ID : $([System.Diagnostics.Process]::GetCurrentProcess().SessionId)")
    $output.Add("=" * 80)
    $output.Add("")

    # ---- TOP LEVEL WINDOWS ----
    $output.Add("--- TOP LEVEL WINDOWS ---")
    $output.Add("")

    try {
        $topLevel = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $condition)
        Write-Log "Found $($topLevel.Count) top-level windows"
        $output.Add("Total top-level windows: $($topLevel.Count)")
        $output.Add("")

        foreach ($win in $topLevel) {
            try {
                $name    = $win.Current.Name
                $class   = $win.Current.ClassName
                $procId  = $win.Current.ProcessId
                $visible = -not $win.Current.IsOffscreen
                $output.Add("WINDOW | Name='$name' | Class='$class' | PID=$procId | Visible=$visible")
            } catch {
                $output.Add("WINDOW | [error reading: $_]")
            }
        }
    } catch {
        Write-Log "ERROR enumerating windows: $_"
        $output.Add("ERROR: $_")
    }

    $output.Add("")
    $output.Add("--- ALL UI ELEMENTS ---")
    $output.Add("Format: [ControlType] Name='...' AutomationId='...' Class='...' Enabled=... Pos=(x,y)")
    $output.Add("")

    # ---- ALL DESCENDANTS ----
    try {
        Write-Log "Enumerating all UI elements..."
        $allElements = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
        Write-Log "Total elements: $($allElements.Count)"
        $output.Add("Total elements: $($allElements.Count)")
        $output.Add("")

        $written = 0
        foreach ($el in $allElements) {
            try {
                $name    = $el.Current.Name
                $autoId  = $el.Current.AutomationId
                $type    = $el.Current.ControlType.ProgrammaticName
                $class   = $el.Current.ClassName
                $enabled = $el.Current.IsEnabled
                $rect    = $el.Current.BoundingRectangle
                $x       = [math]::Round($rect.X)
                $y       = [math]::Round($rect.Y)

                if ([string]::IsNullOrWhiteSpace($name) -and [string]::IsNullOrWhiteSpace($autoId)) { continue }

                $output.Add("[$type] Name='$name' AutomationId='$autoId' Class='$class' Enabled=$enabled Pos=($x,$y)")
                $written++
            } catch { }
        }
        Write-Log "Wrote $written elements"

    } catch {
        Write-Log "ERROR enumerating descendants: $_"
        Write-Err "Descendant enum failed: $_"
        $output.Add("ERROR: $_")
    }

    # ---- JOIN BUTTON CANDIDATES ----
    $output.Add("")
    $output.Add("--- JOIN BUTTON CANDIDATES ---")
    $output.Add("(Elements matching: join, call, meeting, start, connect, resume, dial)")
    $output.Add("")

    $keywords = @("join","call","meeting","start","connect","resume","dial")

    try {
        foreach ($el in $allElements) {
            try {
                $name   = $el.Current.Name
                $autoId = $el.Current.AutomationId
                $type   = $el.Current.ControlType.ProgrammaticName

                $match = $false
                foreach ($kw in $keywords) {
                    if ($name   -match $kw) { $match = $true; break }
                    if ($autoId -match $kw) { $match = $true; break }
                }

                if ($match) {
                    $output.Add("*** CANDIDATE ***")
                    $output.Add("  ControlType  : $type")
                    $output.Add("  Name         : $name")
                    $output.Add("  AutomationId : $autoId")
                    $output.Add("  ClassName    : $($el.Current.ClassName)")
                    $output.Add("  IsEnabled    : $($el.Current.IsEnabled)")
                    $output.Add("  IsOffscreen  : $($el.Current.IsOffscreen)")
                    $output.Add("  BoundingRect : $($el.Current.BoundingRectangle)")

                    $patterns = @()
                    try { $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern) | Out-Null; $patterns += "InvokePattern" } catch {}
                    try { $el.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern) | Out-Null; $patterns += "TogglePattern" } catch {}
                    $output.Add("  Patterns     : $($patterns -join ', ')")
                    $output.Add("")
                }
            } catch { }
        }
    } catch {
        Write-Log "ERROR in candidate search: $_"
    }

    # ---- WRITE OUTPUT ----
    Write-Log "Writing output file ($($output.Count) lines)..."
    try {
        $output | Out-File $OutputFile -Encoding UTF8 -Force
        Write-Log "Output written: $OutputFile"
    } catch {
        Write-Log "ERROR writing output: $_"
        Write-Err "Write failed: $_"
    }

} catch {
    Write-Err "UNHANDLED ERROR: $_"
    Write-Err $_.ScriptStackTrace
}

Write-Log "=== MTR-UIDiscovery completed ==="

# ============================================================
# IMPORTANT: Never exit. The real Launch.ps1 keeps running in the
# background; exiting may make the shell try to relaunch us.
# ============================================================
if ($launchProc) {
    Write-Log "Waiting on real Launch.ps1 (PID $($launchProc.Id))..."
    $launchProc.WaitForExit()
    Write-Log "WARNING: real Launch.ps1 exited with code $($launchProc.ExitCode)"
}
while ($true) { Start-Sleep -Seconds 3600 }
