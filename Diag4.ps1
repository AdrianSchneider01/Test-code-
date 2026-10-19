Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Screen {
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd, int nCmd);
    [DllImport("user32.dll")] public static extern IntPtr GetDesktopWindow();
    [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, EnumWindowsProc proc, IntPtr lp);
    public delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lp);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

$outFile = "C:\MTR\screenshot.png"

# Find SkypeRoomSystem process window
$skype = Get-Process -Name "Microsoft.SkypeRoomSystem" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $skype) {
    $skype = Get-Process -ErrorAction SilentlyContinue |
             Where-Object { $_.MainWindowTitle -like "*Teams Room*" -and $_.MainWindowHandle -ne 0 } |
             Select-Object -First 1
}

if ($skype) {
    Write-Output "Found: $($skype.ProcessName) PID=$($skype.Id) Handle=$($skype.MainWindowHandle)"
    $hwnd = [IntPtr]$skype.MainWindowHandle
    [Win32Screen]::ShowWindow($hwnd, 9) | Out-Null  # SW_RESTORE
    [Win32Screen]::SetForegroundWindow($hwnd) | Out-Null
    Start-Sleep -Milliseconds 500

    $rect = New-Object Win32Screen+RECT
    [Win32Screen]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
    $w = $rect.Right  - $rect.Left
    $h = $rect.Bottom - $rect.Top
    Write-Output "Window rect: L=$($rect.Left) T=$($rect.Top) W=$w H=$h"
} else {
    Write-Output "SkypeRoomSystem not found - using full primary screen"
    $rect = New-Object Win32Screen+RECT
    $rect.Left = 0; $rect.Top = 0
    $w = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width
    $h = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height
    Write-Output "Screen: ${w}x${h}"
}

# Enumerate child HWNDs of the process
Write-Output ""
Write-Output "=== Child window handles (SkypeRoomSystem) ==="
$childHandles = [System.Collections.Generic.List[IntPtr]]::new()
$cb = [Win32Screen+EnumWindowsProc]{
    param([IntPtr]$hw, [IntPtr]$lp)
    $childHandles.Add($hw)
    return $true
}
if ($skype) {
    [Win32Screen]::EnumChildWindows([IntPtr]$skype.MainWindowHandle, $cb, [IntPtr]::Zero) | Out-Null
    Write-Output "Child HWND count: $($childHandles.Count)"
    foreach ($ch in $childHandles) { Write-Output "  HWND=$ch" }
}

# Screenshot primary screen (or just the window area)
try {
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmp    = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
    $g      = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen(0, 0, 0, 0, $bmp.Size)
    $bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    Write-Output ""
    Write-Output "Screenshot saved: $outFile ($($screen.Width)x$($screen.Height))"
} catch {
    Write-Output "Screenshot failed: $_"
}
