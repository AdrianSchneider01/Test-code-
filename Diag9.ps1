# Diag9 (clean): MTR test call via companion app UIA
# Join: invoke 'Join' button (calendar meeting) in companion app
# Leave: invoke 'Leave' button (in-call control) in companion app
# Fallback leave: mouse click on hang-up button at known screen coordinates

param(
    [string]$JoinUrl    = "",       # passed by MTR-InjectUIAutomation.ps1, not used here
    [string]$ResultFile = "C:\MTR\TestCallResult.json",
    [int]$HangupX       = 975,      # hang-up button X at 1024x768
    [int]$HangupY       = 712       # hang-up button Y at 1024x768
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

function Check-InCallIssues {
    $issues = [System.Collections.Generic.List[hashtable]]::new()
    $allBtns = $AE::RootElement.FindAll($TF::Descendants, $allCond) | Where-Object {
        try { $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button } catch { $false }
    }
    foreach ($b in $allBtns) {
        try {
            $name    = $b.Current.Name
            $enabled = $b.Current.IsEnabled
            # Notification banners (dismissable "Close" buttons whose name contains the full banner text)
            if ($name -match "monitors?\s+(is|are)\s+disconnected") {
                $issues.Add(@{ Severity="WARN"; Component="Display";     Message="Monitor disconnected" }) }
            if ($name -match "^No Microphone") {
                $issues.Add(@{ Severity="FAIL"; Component="Microphone";  Message="No microphone detected" }) }
            if ($name -match "^No Camera|^Camera.*not found") {
                $issues.Add(@{ Severity="FAIL"; Component="Camera";      Message="No camera detected" }) }
            # Camera button state
            if ($name -eq "Turn camera on"  -and -not $enabled) {
                $issues.Add(@{ Severity="FAIL"; Component="Camera";      Message="Camera unavailable (button disabled)" }) }
            if ($name -eq "Turn camera on"  -and $enabled) {
                $issues.Add(@{ Severity="WARN"; Component="Camera";      Message="Camera is off during call" }) }
            # Mic button state
            if ($name -eq "Unmute mic"      -and -not $enabled -and -not ($issues | Where-Object { $_.Component -eq "Microphone" })) {
                $issues.Add(@{ Severity="FAIL"; Component="Microphone";  Message="Microphone unavailable (button disabled)" }) }
            # Speaker button state
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

# ==== MAIN ====
Write-Log "Diag9 started"

Dump-Buttons "initial"

if (-not (Has-Button "Join")) {
    Write-Log "No 'Join' button found - no scheduled meeting available" "WARN"
    Write-Log "Diag9 aborted."
    exit 1
}

# Step 1: join via companion app UIA
Write-Log "Invoking 'Join' button..."
$joined = Invoke-Button "Join"
if (-not $joined) {
    Write-Log "Failed to invoke 'Join'" "WARN"
    exit 1
}

$joinTime = Get-Date
Write-Log "Polling for lobby admit buttons for up to 90s while call settles..."

# Poll every 5s: admit any observer waiting in lobby, then wait for camera check
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

# Check hardware / notification issues while in-call
$issues = Check-InCallIssues
if ($issues.Count -gt 0) {
    Write-Log "=== In-call issues detected ==="
    foreach ($i in $issues) { Write-Log "  [$($i.Severity)] $($i.Component): $($i.Message)" }
} else {
    Write-Log "No in-call issues detected."
}

# Step 2: leave via UIA; Teams may call the button "Leave", "Leave call", or "Hang up"
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

# Step 3: result
$connectedSeconds = [int]((Get-Date) - $joinTime).TotalSeconds
$leaveGone        = -not (Has-Button "Leave")
$backToHome       = (Has-Button "Meet now") -or (Has-Button "Join with an ID")

Write-Log "LeaveGone=$leaveGone  BackToHome=$backToHome  ConnectedSec=$connectedSeconds"

$left = $leaveGone -or $backToHome
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

@{
    Status           = $status
    Message          = $message
    ConnectedSeconds = $connectedSeconds
    Timestamp        = (Get-Date -f "o")
    Issues           = @($issues | ForEach-Object { [PSCustomObject]$_ })
} | ConvertTo-Json -Depth 3 | Set-Content $ResultFile -Encoding UTF8
Write-Log "Written to $ResultFile"
Write-Log "Diag9 done."
