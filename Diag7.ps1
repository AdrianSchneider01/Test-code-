# Diag7: Check in-call UIA state and attempt leave via keyboard shortcut
# Run immediately after a call has joined

param(
    [string]$JoinUrl    = "https://teams.microsoft.com/meet/497737059187682?p=NnqALr74DBIi2oFvDT",
    [string]$ResultFile = "C:\MTR\TestCallResult.json"
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Input {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd, int nCmd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hwnd);
    // SendInput
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
    // Post message
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam);
    public const uint WM_KEYDOWN = 0x0100;
    public const uint WM_KEYUP   = 0x0101;
    public const uint WM_SYSKEYDOWN = 0x0104;
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

function Send-KeyCombo {
    param([IntPtr]$Hwnd, [string]$Label)
    # Bring window to foreground
    [Win32Input]::ShowWindow($Hwnd, 9) | Out-Null
    [Win32Input]::SetForegroundWindow($Hwnd) | Out-Null
    Start-Sleep -Milliseconds 500

    # Send Ctrl+Shift+H (Teams hang-up shortcut)
    $inputs = @(
        # Ctrl down
        (New-Object Win32Input+INPUT -Property @{ type=[Win32Input]::INPUT_KEYBOARD; u=(New-Object Win32Input+INPUTUNION) }),
        # Shift down
        (New-Object Win32Input+INPUT -Property @{ type=[Win32Input]::INPUT_KEYBOARD; u=(New-Object Win32Input+INPUTUNION) }),
        # H down
        (New-Object Win32Input+INPUT -Property @{ type=[Win32Input]::INPUT_KEYBOARD; u=(New-Object Win32Input+INPUTUNION) }),
        # H up
        (New-Object Win32Input+INPUT -Property @{ type=[Win32Input]::INPUT_KEYBOARD; u=(New-Object Win32Input+INPUTUNION) }),
        # Shift up
        (New-Object Win32Input+INPUT -Property @{ type=[Win32Input]::INPUT_KEYBOARD; u=(New-Object Win32Input+INPUTUNION) }),
        # Ctrl up
        (New-Object Win32Input+INPUT -Property @{ type=[Win32Input]::INPUT_KEYBOARD; u=(New-Object Win32Input+INPUTUNION) })
    )
    # VK codes: Ctrl=0x11, Shift=0x10, H=0x48
    $inputs[0].u.ki = New-Object Win32Input+KEYBDINPUT -Property @{ wVk=0x11; dwFlags=0 }
    $inputs[1].u.ki = New-Object Win32Input+KEYBDINPUT -Property @{ wVk=0x10; dwFlags=0 }
    $inputs[2].u.ki = New-Object Win32Input+KEYBDINPUT -Property @{ wVk=0x48; dwFlags=0 }
    $inputs[3].u.ki = New-Object Win32Input+KEYBDINPUT -Property @{ wVk=0x48; dwFlags=[Win32Input]::KEYEVENTF_KEYUP }
    $inputs[4].u.ki = New-Object Win32Input+KEYBDINPUT -Property @{ wVk=0x10; dwFlags=[Win32Input]::KEYEVENTF_KEYUP }
    $inputs[5].u.ki = New-Object Win32Input+KEYBDINPUT -Property @{ wVk=0x11; dwFlags=[Win32Input]::KEYEVENTF_KEYUP }

    $sent = [Win32Input]::SendInput(6, $inputs, [Runtime.InteropServices.Marshal]::SizeOf([type][Win32Input+INPUT]))
    Write-Log "SendInput Ctrl+Shift+H to $Label (sent=$sent)"

    # Also try SendKeys as fallback
    try {
        [System.Windows.Forms.SendKeys]::SendWait("^+H")
        Write-Log "SendKeys ^+H sent to $Label"
    } catch {}
}

# ==== MAIN ====

Write-Log "Diag7 started"

# Step 1: dump current state
Dump-Buttons "initial"

# Step 2: Join the meeting via URI
$msteamsUrl = $JoinUrl -replace "^https://teams\.microsoft\.com", "msteams://"
Write-Log "Opening: $msteamsUrl"
Start-Process $msteamsUrl
Write-Log "Waiting 15s for call to connect..."
Start-Sleep -Seconds 15

# Step 3: dump state during call
Dump-Buttons "in-call"

# Step 4: look for Leave/Hang-up button in UIA
Write-Log "=== Looking for Leave button ==="
$leaveNames = @("Leave","Hang up","End call","Hang Up","Leave meeting","Leave call")
$leftViaUIA = $false
foreach ($name in $leaveNames) {
    if (Try-InvokeButton $name) { $leftViaUIA = $true; break }
}

if (-not $leftViaUIA) {
    Write-Log "No Leave button found via UIA. Trying keyboard shortcut..."

    # Try Ctrl+Shift+H on ms-teams window
    $msTeams = Get-Process -Name "ms-teams" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($msTeams -and $msTeams.MainWindowHandle -ne 0) {
        Send-KeyCombo ([IntPtr]$msTeams.MainWindowHandle) "ms-teams"
    }

    Start-Sleep -Seconds 3

    # Try Ctrl+Shift+H on SkypeRoomSystem window
    $skype = Get-Process -Name "Microsoft.SkypeRoomSystem" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($skype -and $skype.MainWindowHandle -ne 0) {
        Send-KeyCombo ([IntPtr]$skype.MainWindowHandle) "SkypeRoomSystem"
    }
}

Start-Sleep -Seconds 5
Dump-Buttons "after-leave-attempt"

Write-Log "Diag7 done."
