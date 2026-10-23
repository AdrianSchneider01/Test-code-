# ============================================================
# MTR-UIDiscovery.ps1
# Deployed to C:\Rigel\AdminHookScripts\Launch.ps1
# Runs automatically in the Skype session via ScriptLaunch.ps1
# Dumps all UI Automation elements to a text file
# ============================================================

$OutputFile  = "C:\Users\Skype\UIElements.txt"
$LogFile     = "C:\Users\Skype\Discovery-Log.txt"
$ErrorFile   = "C:\Users\Skype\Discovery-Error.txt"

$ErrorActionPreference = "Continue"

function Write-Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts $msg" | Out-File $LogFile -Append -Encoding UTF8
}

function Write-Err($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts $msg" | Out-File $ErrorFile -Append -Encoding UTF8
}

try {
    Write-Log "=== MTR-UIDiscovery started ==="
    Write-Log "Running as : $env:USERNAME"
    Write-Log "Session ID : $([System.Diagnostics.Process]::GetCurrentProcess().SessionId)"
    Write-Log "PID        : $PID"
    Write-Log "Output     : $OutputFile"

    # Wait for Teams Rooms app to fully load before scanning UI
    Write-Log "Waiting 30 seconds for Teams Rooms app to fully load..."
    Start-Sleep -Seconds 30

    # Load UI Automation assemblies
    Write-Log "Loading UIAutomation assemblies..."
    try {
        Add-Type -AssemblyName UIAutomationClient -ErrorAction Stop
        Add-Type -AssemblyName UIAutomationTypes  -ErrorAction Stop
        Write-Log "Assemblies loaded OK"
    } catch {
        Write-Log "ERROR loading assemblies: $_"
        Write-Err "Assembly load failed: $_"

        # Also run the original Launch.ps1 from ScriptLaunchCache so MTR still works
        Write-Log "Falling through to original Launch.ps1"
        exit 0
    }

    $output = [System.Collections.Generic.List[string]]::new()
    $output.Add("=" * 80)
    $output.Add("MTR UI Element Discovery")
    $output.Add("Generated  : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
    $output.Add("Running as : $env:USERNAME")
    $output.Add("Session ID : $([System.Diagnostics.Process]::GetCurrentProcess().SessionId)")
    $output.Add("=" * 80)
    $output.Add("")

    # Get root element
    Write-Log "Getting root automation element..."
    $root = [System.Windows.Automation.AutomationElement]::RootElement
    if ($null -eq $root) {
        Write-Log "ERROR: Root element is null"
        Write-Err "Root element is null"
        exit 0
    }
    Write-Log "Root element OK"

    $condition = [System.Windows.Automation.Condition]::TrueCondition

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
# IMPORTANT: After discovery, run the real Launch.ps1 so the
# MTR continues to function normally
# ============================================================
Write-Log "Handing off to original ScriptLaunchCache Launch.ps1..."
$realLaunch = "C:\Users\Skype\ScriptLaunchCache\Launch.ps1"
if (Test-Path $realLaunch) {
    & PowerShell.exe -ExecutionPolicy Unrestricted $realLaunch
} else {
    Write-Log "WARNING: Real Launch.ps1 not found at $realLaunch"
    # Keep session alive so MTR doesn't restart
    while ($true) { Start-Sleep -Seconds 3600 }
}
