# Diag8: Find ms-teams windows via EnumWindows, send Ctrl+Shift+H, check UIA state change
# Fixes Diag7 which used MainWindowHandle=0 for ms-teams (Chrome process)

param(
    [string]$JoinUrl    = "https://teams.microsoft.com/meet/497737059187682?p=NnqALr74DBIi2oFvDT",
    [string]$ResultFile = "C:\MTR\TestCallResult.json"
)

Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public class Win32Util {
    public delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);

    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hwnd);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hwnd, StringBuilder s, int max);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr hwnd, StringBuilder s, int max);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint lpdwProcessId);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd, int nCmd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", SetLastError=true)]
    public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT { public uint type; public INPUTUNION u; }
    [StructLayout(LayoutKind.Explicit)]
    public struct INPUTUNION {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT { public int dx,dy; public uint mouseData,dwFlags,time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)]
    public struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr dwExtraInfo; }
    public const uint INPUT_KEYBOARD = 1;
    public const uint KEYEVENTF_KEYUP = 0x0002;
    public const uint WM_KEYDOWN = 0x0100;
    public const uint WM_KEYUP   = 0x0101;

    public static List<IntPtr> GetProcessWindows(int pid) {
        var list = new List<IntPtr>();
        EnumWindows((hwnd, lp) => {
            uint wpid;
            GetWindowThreadProcessId(hwnd, out wpid);
            if ((int)wpid == pid) list.Add(hwnd);
            return true;
        }, IntPtr.Zero);
        return list;
    }

    public static string GetTitle(IntPtr hwnd) {
        int len = GetWindowTextLength(hwnd);
        if (len == 0) return "";
        var sb = new StringBuilder(len + 1);
        GetWindowText(hwnd, sb, sb.Capacity);
        return sb.ToString();
    }

    public static string GetClass(IntPtr hwnd) {
        var sb = new StringBuilder(256);
        GetClassName(hwnd, sb, sb.Capacity);
        return sb.ToString();
    }
}
"@

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$AE      = [System.Windows.Automation.AutomationElement]
$TF      = [System.Windows.Automation.TreeScope]
$PC      = [System.Windows.Automation.PropertyCondition]
$NAM     = $AE::NameProperty
$IPP     = [System.Windows.Automation.InvokePattern]::Pattern
$allCond = [System.Windows.Automation.Condition]::TrueCondition

function Write-Log { param([string]$m,[string]$l="INFO"); Write-Host "[$(Get-Date -f 'HH:mm:ss')][$l] $m" }

function Dump-Buttons {
    param([string]$Label)
    $desktop  = $AE::RootElement
    $children = $desktop.FindAll($TF::Children, $allCond)
    Write-Log "=== Buttons [$Label] ==="
    foreach ($child in $children) {
        try {
            $cname = $child.Current.Name
            $all   = $child.FindAll($TF::Descendants, $allCond)
            $btns  = $all | Where-Object {
                try { $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button } catch { $false }
            }
            if ($btns.Count -gt 0) {
                Write-Log "  Window '$cname' buttons ($($btns.Count)):"
                foreach ($b in $btns) {
                    try { Write-Log "    [Button] Name='$($b.Current.Name)' ID='$($b.Current.AutomationId)' Enabled=$($b.Current.IsEnabled)" } catch {}
                }
            }
        } catch {}
    }
}

function Try-InvokeButton {
    param([string]$ButtonName)
    $desktop  = $AE::RootElement
    $nameCond = New-Object $PC($NAM, $ButtonName)
    $btn      = $desktop.FindFirst($TF::Descendants, $nameCond)
    if ($btn -and $btn.Current.IsEnabled) {
        try {
            $pat = $btn.GetCurrentPattern($IPP)
            $pat.Invoke()
            Write-Log "Invoked button '$ButtonName'"
            return $true
        } catch { Write-Log "InvokePattern failed for '$ButtonName': $_" "WARN" }
    } else {
        Write-Log "Button '$ButtonName' not found or not enabled" "WARN"
    }
    return $false
}

function Has-Button {
    param([string]$ButtonName)
    $desktop  = $AE::RootElement
    $nameCond = New-Object $PC($NAM, $ButtonName)
    $btn      = $desktop.FindFirst($TF::Descendants, $nameCond)
    return ($null -ne $btn)
}

function Send-CtrlShiftH-To {
    param([IntPtr]$Hwnd, [string]$Label)
    Write-Log "Bringing to foreground: $Label (hwnd=$Hwnd)"
    [Win32Util]::ShowWindow($Hwnd, 9)   | Out-Null
    [Win32Util]::SetForegroundWindow($Hwnd) | Out-Null
    Start-Sleep -Milliseconds 600

    $fg = [Win32Util]::GetForegroundWindow()
    Write-Log "Foreground after set: $fg (target: $Hwnd)"

    $inputs = @(
        (New-Object Win32Util+INPUT -Property @{ type=[Win32Util]::INPUT_KEYBOARD; u=(New-Object Win32Util+INPUTUNION) }),
        (New-Object Win32Util+INPUT -Property @{ type=[Win32Util]::INPUT_KEYBOARD; u=(New-Object Win32Util+INPUTUNION) }),
        (New-Object Win32Util+INPUT -Property @{ type=[Win32Util]::INPUT_KEYBOARD; u=(New-Object Win32Util+INPUTUNION) }),
        (New-Object Win32Util+INPUT -Property @{ type=[Win32Util]::INPUT_KEYBOARD; u=(New-Object Win32Util+INPUTUNION) }),
        (New-Object Win32Util+INPUT -Property @{ type=[Win32Util]::INPUT_KEYBOARD; u=(New-Object Win32Util+INPUTUNION) }),
        (New-Object Win32Util+INPUT -Property @{ type=[Win32Util]::INPUT_KEYBOARD; u=(New-Object Win32Util+INPUTUNION) })
    )
    $inputs[0].u.ki = New-Object Win32Util+KEYBDINPUT -Property @{ wVk=0x11; dwFlags=0 }
    $inputs[1].u.ki = New-Object Win32Util+KEYBDINPUT -Property @{ wVk=0x10; dwFlags=0 }
    $inputs[2].u.ki = New-Object Win32Util+KEYBDINPUT -Property @{ wVk=0x48; dwFlags=0 }
    $inputs[3].u.ki = New-Object Win32Util+KEYBDINPUT -Property @{ wVk=0x48; dwFlags=[Win32Util]::KEYEVENTF_KEYUP }
    $inputs[4].u.ki = New-Object Win32Util+KEYBDINPUT -Property @{ wVk=0x10; dwFlags=[Win32Util]::KEYEVENTF_KEYUP }
    $inputs[5].u.ki = New-Object Win32Util+KEYBDINPUT -Property @{ wVk=0x11; dwFlags=[Win32Util]::KEYEVENTF_KEYUP }

    $sent = [Win32Util]::SendInput(6, $inputs, [Runtime.InteropServices.Marshal]::SizeOf([type][Win32Util+INPUT]))
    Write-Log "SendInput Ctrl+Shift+H to $Label (sent=$sent)"
}

function PostMsg-CtrlShiftH {
    param([IntPtr]$Hwnd, [string]$Label)
    # Ctrl=0x11, Shift=0x10, H=0x48  (lParam detail unimportant for most apps)
    [Win32Util]::PostMessage($Hwnd, [Win32Util]::WM_KEYDOWN, [IntPtr]0x11, [IntPtr]0) | Out-Null
    [Win32Util]::PostMessage($Hwnd, [Win32Util]::WM_KEYDOWN, [IntPtr]0x10, [IntPtr]0) | Out-Null
    [Win32Util]::PostMessage($Hwnd, [Win32Util]::WM_KEYDOWN, [IntPtr]0x48, [IntPtr]0) | Out-Null
    [Win32Util]::PostMessage($Hwnd, [Win32Util]::WM_KEYUP,   [IntPtr]0x48, [IntPtr]0) | Out-Null
    [Win32Util]::PostMessage($Hwnd, [Win32Util]::WM_KEYUP,   [IntPtr]0x10, [IntPtr]0) | Out-Null
    [Win32Util]::PostMessage($Hwnd, [Win32Util]::WM_KEYUP,   [IntPtr]0x11, [IntPtr]0) | Out-Null
    Write-Log "PostMessage Ctrl+Shift+H to $Label (hwnd=$Hwnd)"
}

function Enum-MsTeamsWindows {
    $procs = Get-Process -Name "ms-teams" -ErrorAction SilentlyContinue
    if (-not $procs) {
        Write-Log "ms-teams process not found" "WARN"
        return @()
    }
    $results = @()
    foreach ($p in $procs) {
        $hwnds = [Win32Util]::GetProcessWindows($p.Id)
        foreach ($h in $hwnds) {
            $title = [Win32Util]::GetTitle($h)
            $cls   = [Win32Util]::GetClass($h)
            $vis   = [Win32Util]::IsWindowVisible($h)
            Write-Log "  ms-teams PID=$($p.Id) hwnd=$h vis=$vis class='$cls' title='$title'"
            if ($vis) { $results += $h }
        }
    }
    return $results
}

# ==== MAIN ====

Write-Log "Diag8 started"

# Step 1: initial state
Dump-Buttons "initial"

# Step 2: join via URI
$msteamsUrl = $JoinUrl -replace "^https://teams\.microsoft\.com", "msteams://"
Write-Log "Opening: $msteamsUrl"
Start-Process $msteamsUrl
Write-Log "Waiting 20s for call to connect..."
Start-Sleep -Seconds 20

# Step 3: in-call state
Dump-Buttons "in-call"

# Step 4: try UIA Leave first (in case companion app exposes it)
Write-Log "=== Try Leave/Hang-up via UIA ==="
$leaveNames = @("Leave","Hang up","End call","Hang Up","Leave meeting","Leave call","Hang-up")
$leftViaUIA = $false
foreach ($name in $leaveNames) {
    if (Try-InvokeButton $name) { $leftViaUIA = $true; break }
}

if (-not $leftViaUIA) {
    Write-Log "No Leave button via UIA. Enumerating ms-teams windows..."

    $msTeamsHwnds = Enum-MsTeamsWindows

    if ($msTeamsHwnds.Count -gt 0) {
        # Try SendInput (requires foreground) on each visible ms-teams window
        foreach ($hwnd in $msTeamsHwnds) {
            $cls   = [Win32Util]::GetClass($hwnd)
            $title = [Win32Util]::GetTitle($hwnd)
            Write-Log "Trying SendInput to ms-teams hwnd=$hwnd title='$title' class='$cls'"
            Send-CtrlShiftH-To $hwnd "ms-teams[$title]"
            Start-Sleep -Seconds 2

            # Also try PostMessage as backup (doesn't need foreground)
            PostMsg-CtrlShiftH $hwnd "ms-teams[$title]-PostMsg"
            Start-Sleep -Seconds 1
        }
    } else {
        Write-Log "No visible ms-teams windows found" "WARN"
    }

    # Also try SkypeRoomSystem as before
    $skype = Get-Process -Name "Microsoft.SkypeRoomSystem" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($skype -and $skype.MainWindowHandle -ne 0) {
        Write-Log "Trying SendInput to SkypeRoomSystem hwnd=$($skype.MainWindowHandle)"
        Send-CtrlShiftH-To ([IntPtr]$skype.MainWindowHandle) "SkypeRoomSystem"
    }
}

Write-Log "Waiting 10s for leave to take effect..."
Start-Sleep -Seconds 10
Dump-Buttons "after-leave-attempt"

# Step 5: check if we're still in call (Meeting details button present = still in call)
$inCallAfter = Has-Button "Meeting details"
$canRejoin   = Has-Button "Join"
Write-Log "In-call after attempt: MeetingDetails=$inCallAfter  JoinVisible=$canRejoin"

if ($inCallAfter) {
    Write-Log "Still in call after leave attempt - keyboard shortcut did not work" "WARN"
} else {
    Write-Log "Call appears ended (no Meeting details button)"
}

Write-Log "Diag8 done."
