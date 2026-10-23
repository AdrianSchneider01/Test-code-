# Diag9: MTR test call via companion app UIA
# Join: calendar "Join" button first; falls back to "Join with an ID" if no meeting on screen.
# Leave: invoke Leave/Hang up; fallback mouse click.

param(
    [string]$ResultFile = "C:\MTR\TestCallResult.json",
    [string]$MeetingId  = "497737059187682",
    [string]$Passcode   = "NnqALr74DBIi2oFvDT",
    [int]$HangupX       = 975,
    [int]$HangupY       = 712
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Click {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
    public const uint LEFTDOWN = 0x0002;
    public const uint LEFTUP   = 0x0004;
}
"@

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$AE      = [System.Windows.Automation.AutomationElement]
$TF      = [System.Windows.Automation.TreeScope]
$PC      = [System.Windows.Automation.PropertyCondition]
$NAM     = $AE::NameProperty
$IPP     = [System.Windows.Automation.InvokePattern]::Pattern
$VP      = [System.Windows.Automation.ValuePattern]::Pattern
$allCond = [System.Windows.Automation.Condition]::TrueCondition

function Write-Log { param([string]$m, [string]$l="INFO"); Write-Host "[$(Get-Date -f 'HH:mm:ss')][$l] $m" }

function Has-Button {
    param([string]$Name)
    $null -ne $AE::RootElement.FindFirst($TF::Descendants, (New-Object $PC($NAM, $Name)))
}

function Invoke-Button {
    param([string]$Name)
    $btn = $AE::RootElement.FindFirst($TF::Descendants, (New-Object $PC($NAM, $Name)))
    if ($btn -and $btn.Current.IsEnabled) {
        try { $btn.GetCurrentPattern($IPP).Invoke(); Write-Log "Invoked '$Name'"; return $true }
        catch { Write-Log "InvokePattern failed for '$Name': $_" "WARN" }
    } else { Write-Log "Button '$Name' not found or disabled" "WARN" }
    return $false
}

function Dump-Buttons {
    param([string]$Label)
    Write-Log "=== Buttons [$Label] ==="
    foreach ($child in $AE::RootElement.FindAll($TF::Children, $allCond)) {
        try {
            $btns = $child.FindAll($TF::Descendants, $allCond) | Where-Object {
                try { $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button } catch { $false }
            }
            if ($btns.Count -gt 0) {
                Write-Log "  Window '$($child.Current.Name)' ($($btns.Count) buttons):"
                foreach ($b in $btns) {
                    try { Write-Log "    '$($b.Current.Name)' Enabled=$($b.Current.IsEnabled)" } catch {}
                }
            }
        } catch {}
    }
}

function Join-ByMeetingId {
    param([string]$MeetingId, [string]$Passcode)

    Write-Log "No calendar meeting — trying 'Join with an ID'..."
    if (-not (Invoke-Button "Join with an ID")) {
        Write-Log "Could not click 'Join with an ID'" "WARN"
        return $false
    }
    Start-Sleep -Seconds 2

    # Dump what appeared so we can see the field names
    Dump-Buttons "join-with-id-dialog"

    # Find all editable text fields
    $editCond = New-Object $PC(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Edit
    )
    $edits = @($AE::RootElement.FindAll($TF::Descendants, $editCond) | Where-Object {
        try { $null -ne $_.GetCurrentPattern($VP) } catch { $false }
    })
    Write-Log "Found $($edits.Count) edit field(s) in Join-with-ID dialog"

    if ($edits.Count -ge 1) {
        try {
            $edits[0].GetCurrentPattern($VP).SetValue($MeetingId)
            Write-Log "Set meeting ID: $MeetingId"
        } catch { Write-Log "Failed to set meeting ID: $_" "WARN" }
    }
    if ($edits.Count -ge 2 -and $Passcode) {
        try {
            $edits[1].GetCurrentPattern($VP).SetValue($Passcode)
            Write-Log "Set passcode"
        } catch { Write-Log "Failed to set passcode: $_" "WARN" }
    }

    Start-Sleep -Seconds 1

    foreach ($label in @("Join meeting", "Join", "Continue", "OK")) {
        if (Invoke-Button $label) { Write-Log "Clicked '$label'"; return $true }
    }
    Write-Log "Could not find a Join button after entering meeting ID" "WARN"
    return $false
}

function Check-InCallIssues {
    $issues = [System.Collections.Generic.List[hashtable]]::new()
    $allBtns = $AE::RootElement.FindAll($TF::Descendants, $allCond) | Where-Object {
        try { $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button } catch { $false }
    }
    foreach ($b in $allBtns) {
        try {
            $name    = $b.Current.Name
            $enabled = $b.Current.IsEnabled
            if ($name -match "monitors?\s+(is|are)\s+disconnected") {
                $issues.Add(@{ Severity="WARN"; Component="Display";     Message="Monitor disconnected" }) }
            if ($name -match "^No Microphone") {
                $issues.Add(@{ Severity="FAIL"; Component="Microphone";  Message="No microphone detected" }) }
            if ($name -match "^No Camera|^Camera.*not found") {
                $issues.Add(@{ Severity="FAIL"; Component="Camera";      Message="No camera detected" }) }
            if ($name -eq "Turn camera on"  -and -not $enabled) {
                $issues.Add(@{ Severity="FAIL"; Component="Camera";      Message="Camera unavailable (button disabled)" }) }
            if ($name -eq "Turn camera on"  -and $enabled) {
                $issues.Add(@{ Severity="WARN"; Component="Camera";      Message="Camera is off during call" }) }
            if ($name -eq "Unmute mic"      -and -not $enabled -and -not ($issues | Where-Object { $_.Component -eq "Microphone" })) {
                $issues.Add(@{ Severity="FAIL"; Component="Microphone";  Message="Microphone unavailable (button disabled)" }) }
            if ($name -eq "Speaker is off"  -and -not $enabled) {
                $issues.Add(@{ Severity="WARN"; Component="Speaker";     Message="Speaker unavailable (button disabled)" }) }
        } catch {}
    }
    return $issues
}

function Click-HangupButton {
    param([int]$X, [int]$Y)
    Write-Log "Mouse click at ($X, $Y) - hang-up fallback"
    [Win32Click]::SetCursorPos($X, $Y) | Out-Null
    Start-Sleep -Milliseconds 300
    [Win32Click]::mouse_event([Win32Click]::LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 100
    [Win32Click]::mouse_event([Win32Click]::LEFTUP,   0, 0, 0, [UIntPtr]::Zero)
    Write-Log "Click sent"
}

function Write-Result {
    param([string]$Status, [string]$Message, [int]$ConnectedSeconds=0, [array]$Issues=@())
    $issueList = $Issues | ForEach-Object { "$($_.Severity) $($_.Component): $($_.Message)" }
    @{
        Status           = $Status
        Message          = $Message
        ConnectedSeconds = $ConnectedSeconds
        Timestamp        = (Get-Date -f "o")
        Issues           = @($Issues | ForEach-Object { [PSCustomObject]$_ })
    } | ConvertTo-Json -Depth 3 | Set-Content $ResultFile -Encoding UTF8
    Write-Log "Written result '$Status' to $ResultFile"
}

# ==== MAIN ====
Write-Log "Diag9 started"
New-Item -ItemType Directory -Path (Split-Path $ResultFile) -Force | Out-Null

Dump-Buttons "initial"

# ── Join ──────────────────────────────────────────────────────────────────────
$joined = $false

if (Has-Button "Join") {
    Write-Log "Found calendar 'Join' button — invoking..."
    $joined = Invoke-Button "Join"
} else {
    $joined = Join-ByMeetingId -MeetingId $MeetingId -Passcode $Passcode
}

if (-not $joined) {
    Write-Log "Failed to join — aborting." "WARN"
    Write-Result -Status "FAIL" -Message "Could not find a Join button (no calendar meeting and Join-with-ID failed)"
    exit 1
}

$joinTime = Get-Date
Write-Log "Polling for lobby admit buttons for up to 90s while call settles..."

$pollDeadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $pollDeadline) {
    $allBtns = $AE::RootElement.FindAll($TF::Descendants, $allCond) | Where-Object {
        try { $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button } catch { $false }
    }
    foreach ($b in $allBtns) {
        try {
            $name = $b.Current.Name
            if ($name -match '(?i)\badmit\b') {
                Write-Log "Lobby: found admit button '$name' — clicking"
                try { $b.GetCurrentPattern($IPP).Invoke(); Write-Log "Admitted." }
                catch { Write-Log "Admit invoke failed: $_" "WARN" }
            }
        } catch {}
    }
    Start-Sleep -Seconds 5
}

Dump-Buttons "in-call"

# ── Check hardware issues ──────────────────────────────────────────────────────
$issues = Check-InCallIssues
if ($issues.Count -gt 0) {
    Write-Log "=== In-call issues ==="
    foreach ($i in $issues) { Write-Log "  [$($i.Severity)] $($i.Component): $($i.Message)" }
} else {
    Write-Log "No in-call issues detected."
}

# ── Leave ─────────────────────────────────────────────────────────────────────
Write-Log "=== Attempting to leave ==="
$leftViaUIA = $false
foreach ($leaveLabel in @("Leave", "Leave call", "Hang up", "End call")) {
    if (Invoke-Button $leaveLabel) { $leftViaUIA = $true; break }
}
if (-not $leftViaUIA) {
    Write-Log "UIA Leave not found - trying mouse click fallback..."
    Click-HangupButton $HangupX $HangupY
}

Write-Log "Waiting 10s for leave to take effect..."
Start-Sleep -Seconds 10

Dump-Buttons "after-leave"

# ── Result ────────────────────────────────────────────────────────────────────
$connectedSeconds = [int]((Get-Date) - $joinTime).TotalSeconds
$leaveGone        = -not (Has-Button "Leave")
$backToHome       = (Has-Button "Meet now") -or (Has-Button "Join with an ID")
$left             = $leaveGone -or $backToHome

Write-Log "LeaveGone=$leaveGone  BackToHome=$backToHome  ConnectedSec=$connectedSeconds"

if (-not $joined -or -not $left) {
    $status = "FAIL"
} elseif ($issues.Count -gt 0 -and ($issues | Where-Object { $_.Severity -eq "FAIL" })) {
    $status = "FAIL"
} elseif ($issues.Count -gt 0) {
    $status = "WARN"
} else {
    $status = "PASS"
}

$issueList = $issues | ForEach-Object { "$($_.Severity) $($_.Component): $($_.Message)" }
$message   = if ($status -eq "PASS") { "Joined and left successfully. No issues." } `
             elseif ($status -eq "WARN") { "Joined and left. Warnings: $($issueList -join '; ')" } `
             else { "Join=$joined Left=$left Issues: $($issueList -join '; ')" }

Write-Log "Result: $status - $message"
Write-Result -Status $status -Message $message -ConnectedSeconds $connectedSeconds -Issues $issues
Write-Log "Diag9 done."
