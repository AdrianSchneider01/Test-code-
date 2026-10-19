Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Capture {
    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdcBlt, uint nFlags);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd, int nCmd);
    [DllImport("user32.dll")] public static extern IntPtr GetDC(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern int ReleaseDC(IntPtr hwnd, IntPtr hdc);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, EnumWindowsProc cb, IntPtr lp);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hwnd, System.Text.StringBuilder sb, int n);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr hwnd);
    // SendInput for mouse click
    [DllImport("user32.dll")] public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }
    public const uint PW_RENDERFULLCONTENT = 0x00000002;
    // INPUT structures for SendInput
    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT {
        public uint type;
        public MOUSEINPUT mi;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT {
        public int dx, dy;
        public uint mouseData, dwFlags, time;
        public IntPtr dwExtraInfo;
    }
    public delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lp);
}
"@

$outDir  = "C:\MTR"
$outFile = "$outDir\mtr_screen.png"

# Find the SkypeRoomSystem window handle
$skype   = Get-Process -Name "Microsoft.SkypeRoomSystem" -ErrorAction SilentlyContinue | Select-Object -First 1
$hwnd    = if ($skype) { [IntPtr]$skype.MainWindowHandle } else { [IntPtr]::Zero }

Write-Output "SkypeRoomSystem PID=$($skype.Id) HWND=$hwnd"

# Also enumerate ALL top-level windows for PID 6188 (main window may not be the XAML host)
Write-Output ""
Write-Output "=== All top-level windows for SkypeRoomSystem (PID $($skype.Id)) ==="
$allHwnds = [System.Collections.Generic.List[IntPtr]]::new()
$enumCb = [Win32Capture+EnumWindowsProc]{
    param([IntPtr]$hw, [IntPtr]$lp)
    [uint]$pid = 0
    [Win32Capture]::GetWindowThreadProcessId($hw, [ref]$pid) | Out-Null
    if ($pid -eq $skype.Id) {
        $sb = New-Object System.Text.StringBuilder 512
        [Win32Capture]::GetWindowText($hw, $sb, 512) | Out-Null
        $rect2 = New-Object Win32Capture+RECT
        [Win32Capture]::GetWindowRect($hw, [ref]$rect2) | Out-Null
        $vis = [Win32Capture]::IsWindowVisible($hw)
        $parent = [Win32Capture]::GetParent($hw)
        Write-Output "  HWND=$hw Visible=$vis Title='$($sb.ToString())' Rect=($($rect2.Left),$($rect2.Top),$($rect2.Right),$($rect2.Bottom)) Parent=$parent"
        $allHwnds.Add($hw)
    }
    return $true
}
[Win32Capture]::EnumWindows($enumCb, [IntPtr]::Zero) | Out-Null

# Try to capture each window via PrintWindow
foreach ($h in $allHwnds) {
    $rect = New-Object Win32Capture+RECT
    [Win32Capture]::GetWindowRect($h, [ref]$rect) | Out-Null
    $w = $rect.Right  - $rect.Left
    $h2= $rect.Bottom - $rect.Top
    if ($w -le 0 -or $h2 -le 0) { continue }

    Write-Output "Capturing HWND=$h size=${w}x${h2}..."
    try {
        $bmp = New-Object System.Drawing.Bitmap($w, $h2)
        $g   = [System.Drawing.Graphics]::FromImage($bmp)
        $hdc = $g.GetHdc()
        $ok  = [Win32Capture]::PrintWindow($h, $hdc, [Win32Capture]::PW_RENDERFULLCONTENT)
        $g.ReleaseHdc($hdc)
        $g.Dispose()
        $fname = "$outDir\mtr_hwnd_${h}.png"
        $bmp.Save($fname, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        Write-Output "  Saved: $fname (PrintWindow success=$ok)"
    } catch {
        Write-Output "  PrintWindow failed: $_"
    }
}

# Also try the main HWND directly
if ($hwnd -ne [IntPtr]::Zero) {
    $rect = New-Object Win32Capture+RECT
    [Win32Capture]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
    $w = $rect.Right  - $rect.Left
    $h2= $rect.Bottom - $rect.Top
    Write-Output ""
    Write-Output "Main HWND capture: $hwnd size=${w}x${h2}"
    try {
        $bmp = New-Object System.Drawing.Bitmap($w, $h2)
        $g   = [System.Drawing.Graphics]::FromImage($bmp)
        $hdc = $g.GetHdc()
        $ok  = [Win32Capture]::PrintWindow($hwnd, $hdc, [Win32Capture]::PW_RENDERFULLCONTENT)
        $g.ReleaseHdc($hdc)
        $g.Dispose()
        $bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        Write-Output "Saved: $outFile (PrintWindow success=$ok)"
    } catch {
        Write-Output "PrintWindow on main HWND failed: $_"
    }
}
Write-Output "Done."
