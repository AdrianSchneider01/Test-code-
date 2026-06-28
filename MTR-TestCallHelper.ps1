#Requires -Version 5.1
<#
.SYNOPSIS
    Runs INSIDE the Skype user's Windows session (Session 1).
    Uses UI Automation to join a Teams test meeting and then leave.

.DESCRIPTION
    This script is spawned by MTR-InjectUIAutomation.ps1 via CreateProcessAsUser.
    It must NOT be run directly as SYSTEM — the Teams Rooms UWP window is only
    visible to UI Automation from within the same interactive session.

    Flow:
      1. Parse the join URL for display (informational)
      2. Load UIAutomationClient / UIAutomationTypes assemblies
      3. Find the Teams Rooms main window
      4. Locate the "Join" button (by AutomationId or Name — configurable)
      5. Click Join and wait for the in-call state (up to $JoinTimeoutSeconds)
      6. Wait $CallDurationSeconds inside the call
      7. Click the Leave/Hang-up button
      8. Write a result JSON to $ResultFile

    IMPORTANT — AutomationId / Name values:
      The exact AutomationId and Name for the Join and Leave buttons MUST be
      confirmed by running Microsoft's Inspect.exe (part of Windows SDK) on a
      live MTR device. The defaults below are best-effort guesses based on
      known Teams Rooms UWP element names. Update $JoinButtonAutomationId,
      $JoinButtonName, $LeaveButtonAutomationId, and $LeaveButtonName after
      inspecting a real device.

.PARAMETER JoinUrl
    The Teams meeting join URL (passed from MTR-InjectUIAutomation.ps1).

.PARAMETER ResultFile
    Path where this script writes the JSON result.
    Must be writable by the Skype user.
    Default: C:\MTR\TestCallResult.json

.PARAMETER JoinButtonAutomationId
    AutomationId of the Join button in the Teams Rooms app.
    Confirm with Inspect.exe on a live device. Default: "JoinButton"

.PARAMETER JoinButtonName
    Name (accessible name) of the Join button. Used as fallback if AutomationId
    search fails. Default: "Join"

.PARAMETER LeaveButtonAutomationId
    AutomationId of the Leave/Hang-up button.
    Default: "HangupButton"

.PARAMETER LeaveButtonName
    Name of the Leave button. Fallback. Default: "Leave"

.PARAMETER JoinTimeoutSeconds
    Seconds to wait for the Join button to appear and for the call to connect.
    Default: 60

.PARAMETER CallDurationSeconds
    How long to stay in the call before hanging up. Default: 30

.PARAMETER TeamsWindowTitle
    Partial window title to locate the Teams Rooms app.
    Default: "Microsoft Teams Rooms"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$JoinUrl,

    [string]$ResultFile               = "C:\MTR\TestCallResult.json",

    # ----- UI element IDs — MUST be confirmed with Inspect.exe on a live MTR -----
    [string]$JoinButtonAutomationId   = "JoinButton",
    [string]$JoinButtonName           = "Join",
    [string]$LeaveButtonAutomationId  = "HangupButton",
    [string]$LeaveButtonName          = "Leave",
    # ---------------------------------------------------------------------------

    [int]$JoinTimeoutSeconds          = 60,
    [int]$CallDurationSeconds         = 30,
    [string]$TeamsWindowTitle         = "Microsoft Teams Rooms"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $ts = Get-Date -f 'HH:mm:ss'
    Write-Host "[$ts][$Level] $Message"
}

function Write-Result {
    param(
        [string]$Status,         # PASS | FAIL | ERROR
        [string]$Message,
        [int]   $ConnectedSeconds = 0
    )
    $result = [ordered]@{
        Timestamp        = Get-Date -f 'o'
        Status           = $Status
        Message          = $Message
        ConnectedSeconds = $ConnectedSeconds
        JoinUrl          = $JoinUrl
        ScriptHost       = $env:COMPUTERNAME
    }
    $outDir = Split-Path $ResultFile
    if ($outDir -and -not (Test-Path $outDir)) {
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null
    }
    $result | ConvertTo-Json -Depth 4 | Set-Content -Path $ResultFile -Encoding UTF8
    Write-Log "Result written: $Status — $Message"
}

# ---------------------------------------------------------------------------
# 1. Load UI Automation assemblies
# ---------------------------------------------------------------------------
Write-Log "Loading UI Automation assemblies..."

try {
    Add-Type -AssemblyName UIAutomationClient   -ErrorAction Stop
    Add-Type -AssemblyName UIAutomationTypes    -ErrorAction Stop
} catch {
    # Fallback: load by file path (present on all modern Windows)
    $uiaBase = "$env:SystemRoot\System32"
    [System.Reflection.Assembly]::LoadFrom("$uiaBase\UIAutomationClient.dll")  | Out-Null
    [System.Reflection.Assembly]::LoadFrom("$uiaBase\UIAutomationTypes.dll")   | Out-Null
}

# Shorthand namespace aliases
$AE  = [System.Windows.Automation.AutomationElement]
$TF  = [System.Windows.Automation.TreeScope]
$PC  = [System.Windows.Automation.PropertyCondition]
$ACC = [System.Windows.Automation.AutomationIdProperty]
$NAM = [System.Windows.Automation.NameProperty]
$IPP = [System.Windows.Automation.InvokePattern]::Pattern

# ---------------------------------------------------------------------------
# 2. Find the Teams Rooms application window
# ---------------------------------------------------------------------------
function Find-TeamsRoomsWindow {
    param([int]$TimeoutSeconds = 30)

    Write-Log "Searching for Teams Rooms window (title contains '$TeamsWindowTitle')..."
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        $procs = Get-Process -ErrorAction SilentlyContinue | Where-Object {
            $_.MainWindowTitle -like "*$TeamsWindowTitle*" -and $_.MainWindowHandle -ne 0
        }
        if ($procs) {
            $proc   = $procs[0]
            $handle = [System.IntPtr]$proc.MainWindowHandle
            try {
                $element = $AE::FromHandle($handle)
                if ($element) {
                    Write-Log "Found window: '$($proc.MainWindowTitle)' (PID $($proc.Id))"
                    return $element
                }
            } catch { }
        }

        # Also search the UIA desktop tree for UWP apps (which may have no classic HWND)
        try {
            $desktop = $AE::RootElement
            $nameCond = New-Object $PC($NAM, $TeamsWindowTitle,
                [System.Windows.Automation.PropertyConditionFlags]::IgnoreCase)
            $found = $desktop.FindFirst($TF::Children, $nameCond)
            if ($found) {
                Write-Log "Found window via UIA tree: '$TeamsWindowTitle'"
                return $found
            }
        } catch { }

        Start-Sleep -Milliseconds 2000
    }
    return $null
}

# ---------------------------------------------------------------------------
# 3. Find a button by AutomationId (primary) then Name (fallback)
# ---------------------------------------------------------------------------
function Find-Button {
    param(
        [System.Windows.Automation.AutomationElement]$Root,
        [string]$AutomationId,
        [string]$FallbackName,
        [int]$TimeoutSeconds = 30
    )

    Write-Log "Looking for button: AutomationId='$AutomationId' / Name='$FallbackName'..."
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        # Try AutomationId first
        if ($AutomationId) {
            try {
                $cond    = New-Object $PC($ACC, $AutomationId)
                $element = $Root.FindFirst($TF::Descendants, $cond)
                if ($element -and $element.Current.IsEnabled) {
                    Write-Log "Found by AutomationId: '$AutomationId'"
                    return $element
                }
            } catch { }
        }

        # Fallback: Name match
        if ($FallbackName) {
            try {
                $cond    = New-Object $PC($NAM, $FallbackName)
                $element = $Root.FindFirst($TF::Descendants, $cond)
                if ($element -and $element.Current.IsEnabled) {
                    Write-Log "Found by Name: '$FallbackName'"
                    return $element
                }
            } catch { }
        }

        Start-Sleep -Milliseconds 2000
    }
    return $null
}

# ---------------------------------------------------------------------------
# 4. Invoke (click) a UI Automation element
# ---------------------------------------------------------------------------
function Invoke-UIElement {
    param([System.Windows.Automation.AutomationElement]$Element, [string]$Label)

    try {
        $invokePattern = $Element.GetCurrentPattern($IPP)
        $invokePattern.Invoke()
        Write-Log "Invoked: $Label"
        return $true
    } catch {
        # Fallback: simulate a mouse click at element's bounding rect centre
        Write-Log "InvokePattern unavailable for '$Label', trying click simulation..." "WARN"
        try {
            Add-Type -AssemblyName System.Windows.Forms
            $rect    = $Element.Current.BoundingRectangle
            $centerX = [int]($rect.X + $rect.Width  / 2)
            $centerY = [int]($rect.Y + $rect.Height / 2)
            [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($centerX, $centerY)
            Start-Sleep -Milliseconds 200
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            Write-Log "Click simulation sent for '$Label'"
            return $true
        } catch {
            Write-Log "Click simulation also failed for '$Label': $_" "ERROR"
            return $false
        }
    }
}

# ---------------------------------------------------------------------------
# 5. Wait for Leave button to appear (confirms we are in the call)
# ---------------------------------------------------------------------------
function Wait-ForInCallState {
    param(
        [System.Windows.Automation.AutomationElement]$Root,
        [int]$TimeoutSeconds
    )
    Write-Log "Waiting for in-call state (Leave button to appear)..."
    $btn = Find-Button -Root $Root -AutomationId $LeaveButtonAutomationId `
                       -FallbackName $LeaveButtonName -TimeoutSeconds $TimeoutSeconds
    return $btn
}

# ===========================================================================
# MAIN
# ===========================================================================

Write-Log "MTR-TestCallHelper started"
Write-Log "Join URL: $JoinUrl"

$connectedSeconds = 0

try {
    # Step A: Find the Teams Rooms window
    $teamsWindow = Find-TeamsRoomsWindow -TimeoutSeconds $JoinTimeoutSeconds
    if (-not $teamsWindow) {
        Write-Result -Status "FAIL" -Message "Teams Rooms window not found within $JoinTimeoutSeconds seconds."
        exit 1
    }

    # Step B: Find the Join button
    # The MTR normally shows a scheduled meeting tile with a Join button.
    # If the meeting was created via Graph API it should appear as a tile.
    $joinBtn = Find-Button -Root $teamsWindow `
                           -AutomationId $JoinButtonAutomationId `
                           -FallbackName $JoinButtonName `
                           -TimeoutSeconds $JoinTimeoutSeconds

    if (-not $joinBtn) {
        Write-Result -Status "FAIL" `
            -Message "Join button not found (AutomationId='$JoinButtonAutomationId', Name='$JoinButtonName'). " +
                     "Confirm element IDs with Inspect.exe on a live device."
        exit 1
    }

    # Step C: Click Join
    $clicked = Invoke-UIElement -Element $joinBtn -Label "Join"
    if (-not $clicked) {
        Write-Result -Status "FAIL" -Message "Failed to invoke Join button."
        exit 1
    }

    Write-Log "Join clicked — waiting for call to connect..."
    Start-Sleep -Seconds 5  # brief pause for the app to transition screens

    # Step D: Confirm in-call by looking for Leave button
    $leaveBtn = Wait-ForInCallState -Root $teamsWindow -TimeoutSeconds $JoinTimeoutSeconds
    if (-not $leaveBtn) {
        Write-Result -Status "FAIL" `
            -Message "Leave button not found after clicking Join — call may not have connected. " +
                     "Check Inspect.exe for correct AutomationId/Name values."
        exit 1
    }

    Write-Log "In-call confirmed. Staying in call for $CallDurationSeconds seconds..."
    $callStart = Get-Date
    Start-Sleep -Seconds $CallDurationSeconds
    $connectedSeconds = [int]((Get-Date) - $callStart).TotalSeconds

    # Step E: Click Leave / Hang up
    # Re-acquire the leave button in case the element reference went stale
    $leaveBtn = Find-Button -Root $teamsWindow `
                             -AutomationId $LeaveButtonAutomationId `
                             -FallbackName $LeaveButtonName `
                             -TimeoutSeconds 15

    if ($leaveBtn) {
        Invoke-UIElement -Element $leaveBtn -Label "Leave/Hangup" | Out-Null
        Write-Log "Left the call."
    } else {
        Write-Log "Leave button not found after call duration — may have auto-ended." "WARN"
    }

    Write-Result -Status "PASS" `
                 -Message "Test call completed successfully." `
                 -ConnectedSeconds $connectedSeconds
    exit 0

} catch {
    $errMsg = $_.Exception.Message
    Write-Log "Unhandled exception: $errMsg" "ERROR"
    Write-Result -Status "ERROR" -Message $errMsg -ConnectedSeconds $connectedSeconds
    exit 1
}
