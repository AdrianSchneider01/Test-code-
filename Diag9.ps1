# Diag9: Join via UIA "Join" button (companion app) + leave via REST API or mouse click
# Screen resolution: 1024x768. Hang-up button approx (975, 712).

param(
    [string]$JoinUrl    = "",          # passed by MTR-InjectUIAutomation.ps1, not used (we join via UIA)
    [string]$ResultFile = "C:\MTR\TestCallResult.json",
    [int]$HangupX       = 975,
    [int]$HangupY       = 712
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Mouse {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd, int nCmd);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP   = 0x0004;

    public delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint lpdwProcessId);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);

    public static IntPtr GetFirstVisibleWindow(int pid) {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hwnd, lp) => {
            if (found != IntPtr.Zero) return false;
            uint wpid;
            GetWindowThreadProcessId(hwnd, out wpid);
            if ((int)wpid == pid && IsWindowVisible(hwnd)) { found = hwnd; return false; }
            return true;
        }, IntPtr.Zero);
        return found;
    }
}
"@

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Net.Http

$AE      = [System.Windows.Automation.AutomationElement]
$TF      = [System.Windows.Automation.TreeScope]
$PC      = [System.Windows.Automation.PropertyCondition]
$NAM     = $AE::NameProperty
$IPP     = [System.Windows.Automation.InvokePattern]::Pattern
$allCond = [System.Windows.Automation.Condition]::TrueCondition

function Write-Log { param([string]$m,[string]$l="INFO"); Write-Host "[$(Get-Date -f 'HH:mm:ss')][$l] $m" }

function Has-Button {
    param([string]$Name)
    $root     = $AE::RootElement
    $nameCond = New-Object $PC($NAM, $Name)
    return ($null -ne $root.FindFirst($TF::Descendants, $nameCond))
}

function Invoke-Button {
    param([string]$Name)
    $root     = $AE::RootElement
    $nameCond = New-Object $PC($NAM, $Name)
    $btn      = $root.FindFirst($TF::Descendants, $nameCond)
    if ($btn -and $btn.Current.IsEnabled) {
        try { $btn.GetCurrentPattern($IPP).Invoke(); Write-Log "Invoked '$Name'"; return $true }
        catch { Write-Log "InvokePattern failed for '$Name': $_" "WARN" }
    } else { Write-Log "Button '$Name' not found or disabled" "WARN" }
    return $false
}

function Dump-Buttons {
    param([string]$Label)
    $desktop  = $AE::RootElement
    $children = $desktop.FindAll($TF::Children, $allCond)
    Write-Log "=== Buttons [$Label] ==="
    foreach ($child in $children) {
        try {
            $cname = $child.Current.Name
            $btns  = $child.FindAll($TF::Descendants, $allCond) | Where-Object {
                try { $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button } catch { $false }
            }
            if ($btns.Count -gt 0) {
                Write-Log "  Window '$cname' ($($btns.Count) buttons):"
                foreach ($b in $btns) {
                    try { Write-Log "    [Button] '$($b.Current.Name)' Enabled=$($b.Current.IsEnabled)" } catch {}
                }
            }
        } catch {}
    }
}

function Try-RestLeave {
    $endpoints = @(
        "http://localhost:8558/api/1.0/session/leave",
        "http://localhost:8558/api/1.0/session/end",
        "http://localhost:8558/api/session/leave",
        "http://localhost:8558/api/session/end"
    )
    foreach ($ep in $endpoints) {
        try {
            $client = New-Object System.Net.Http.HttpClient
            $client.Timeout = [TimeSpan]::FromSeconds(5)
            $response = $client.PostAsync($ep, $null).Result
            Write-Log "REST leave $ep -> $([int]$response.StatusCode) $($response.ReasonPhrase)"
            $client.Dispose()
            if ([int]$response.StatusCode -lt 400) { return $true }
        } catch { Write-Log "REST $ep failed: $($_.Exception.Message)" "WARN" }
    }
    return $false
}

function Try-RestStatus {
    $endpoints = @(
        "http://localhost:8558/api/1.0/system/status",
        "http://localhost:8558/api/1.0/session/status",
        "http://localhost:8558/api/system/status"
    )
    foreach ($ep in $endpoints) {
        try {
            $resp = Invoke-RestMethod -Uri $ep -Method Get -TimeoutSec 5 -ErrorAction Stop
            Write-Log "REST status $ep -> $($resp | ConvertTo-Json -Depth 3 -Compress)"
            return $true
        } catch { Write-Log "REST status ${ep}: $($_.Exception.Message)" "WARN" }
    }
    return $false
}

function Click-HangupButton {
    param([int]$X, [int]$Y)
    # Focus SkypeRoomSystem window first
    $skype = Get-Process -Name "Microsoft.SkypeRoomSystem" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($skype) {
        $hwnd = [Win32Mouse]::GetFirstVisibleWindow($skype.Id)
        if ($hwnd -ne [IntPtr]::Zero) {
            [Win32Mouse]::ShowWindow($hwnd, 9)        | Out-Null
            [Win32Mouse]::SetForegroundWindow($hwnd)  | Out-Null
            Write-Log "Focused SkypeRoomSystem hwnd=$hwnd"
            Start-Sleep -Milliseconds 800
        } else { Write-Log "No visible SkypeRoomSystem window found" "WARN" }
    } else { Write-Log "SkypeRoomSystem process not found" "WARN" }

    Write-Log "Mouse click at ($X, $Y) - hang-up button"
    [Win32Mouse]::SetCursorPos($X, $Y) | Out-Null
    Start-Sleep -Milliseconds 200
    [Win32Mouse]::mouse_event([Win32Mouse]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 100
    [Win32Mouse]::mouse_event([Win32Mouse]::MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
    Write-Log "Click sent"
}

# ==== MAIN ====
Write-Log "Diag9 started (HangupButton=$HangupX,$HangupY)"
Write-Log "Checking Teams Rooms REST API availability..."
Try-RestStatus | Out-Null

Dump-Buttons "initial"

# Step 1: verify "Join" button is accessible via UIA
if (-not (Has-Button "Join")) {
    Write-Log "No 'Join' button found in UIA - no calendar meeting available" "WARN"
    Write-Log "Diag9 aborted - need a scheduled meeting to run this test."
    exit 1
}

Write-Log "Found 'Join' button in companion app UIA - invoking..."

# Step 2: invoke Join
$joined = Invoke-Button "Join"
if (-not $joined) {
    Write-Log "Failed to invoke Join button" "WARN"
    exit 1
}

$joinTime = Get-Date
Write-Log "Join invoked. Waiting 25s for call to connect..."
Start-Sleep -Seconds 25

Dump-Buttons "in-call"

# Step 3: leave - UIA Leave button first (companion app exposes it in-call),
#                 then mouse click fallback
Write-Log "=== Attempting to leave call ==="
$leftViaUIA = Invoke-Button "Leave"

if (-not $leftViaUIA) {
    Write-Log "UIA Leave not found. Trying mouse click on hang-up button..."
    Click-HangupButton $HangupX $HangupY
}

Write-Log "Waiting 10s for leave to take effect..."
Start-Sleep -Seconds 10

Dump-Buttons "after-leave"

# Step 4: determine result
# After leaving, companion app returns to home screen (shows "Meet now" / "Join with an ID").
# If "Leave" button is gone and home screen buttons are back = left successfully.
$leaveGone   = -not (Has-Button "Leave")
$backToHome  = (Has-Button "Meet now") -or (Has-Button "Join with an ID")
$connectedSeconds = [int]((Get-Date) - $joinTime).TotalSeconds

Write-Log "Post-leave: LeaveGone=$leaveGone  BackToHome=$backToHome  ConnectedSec=$connectedSeconds"

$status  = if ($joined -and ($leaveGone -or $backToHome)) { "PASS" } else { "FAIL" }
$message = if ($status -eq "PASS") { "Joined and left successfully." } else { "Join=$joined LeaveGone=$leaveGone BackToHome=$backToHome" }
Write-Log "Result: $status - $message"

$json = @{
    Status           = $status
    Message          = $message
    ConnectedSeconds = $connectedSeconds
    Timestamp        = (Get-Date -f "o")
} | ConvertTo-Json
$json | Set-Content $ResultFile -Encoding UTF8
Write-Log "Result written to $ResultFile"

Write-Log "Diag9 done."
