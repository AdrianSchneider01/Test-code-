#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Runs as SYSTEM (Task Scheduler, Session 0) and spawns MTR-TestCallHelper.ps1
    inside the Skype user's interactive session (Session 1) using
    WTSQueryUserToken + CreateProcessAsUser.

.DESCRIPTION
    Microsoft Teams Rooms UI is only accessible from the Skype user's desktop
    session (Session 1). A SYSTEM process runs in Session 0 and cannot interact
    with Session 1 UI directly. This script bridges that gap by:

      1. Calling WTSQueryUserToken to obtain the Skype user's impersonation token
      2. Calling CreateProcessAsUser to spawn PowerShell in Session 1 with that token
      3. Waiting for the helper process to finish (timeout configurable)
      4. Reading the result JSON written by the helper
      5. Optionally emailing the result via SMTP

    Before running, create a Teams meeting manually in Outlook and copy the
    Join URL from the invite. Pass it as -JoinUrl.

.PARAMETER JoinUrl
    The Teams meeting Join URL copied from the Outlook invite.
    Example: https://teams.microsoft.com/l/meetup-join/...

.PARAMETER HelperScriptPath
    Full local path to MTR-TestCallHelper.ps1 on the MTR.
    Example: C:\MTR\MTR-TestCallHelper.ps1

.PARAMETER ResultFile
    Path where MTR-TestCallHelper.ps1 will write its result JSON.
    Must be writable by the Skype user account.
    Default: C:\MTR\TestCallResult.json

.PARAMETER HelperTimeoutSeconds
    Seconds to wait for the helper script before declaring a timeout. Default: 180.

.PARAMETER SmtpServer
    SMTP server for sending the email report. Leave empty to skip email.

.PARAMETER SmtpPort
    SMTP port. Default: 587.

.PARAMETER SmtpUser
    SMTP username (Gmail address).

.PARAMETER SmtpPassword
    SMTP password / App Password.

.PARAMETER MailFrom
    Sender address.

.PARAMETER MailTo
    Recipient address(es), comma-separated.

.PARAMETER RoomName
    Display name for the MTR in the report subject. Default: $env:COMPUTERNAME.

.EXAMPLE
    .\MTR-InjectUIAutomation.ps1 `
        -JoinUrl          "https://teams.microsoft.com/l/meetup-join/..." `
        -HelperScriptPath "C:\MTR\MTR-TestCallHelper.ps1" `
        -SmtpServer       "smtp.gmail.com" `
        -SmtpPort         587 `
        -SmtpUser         "alerts@example.com" `
        -SmtpPassword     "app-password-here" `
        -MailFrom         "alerts@example.com" `
        -MailTo           "itteam@example.com" `
        -RoomName         "Boardroom MTR"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$JoinUrl,

    [Parameter(Mandatory)]
    [string]$HelperScriptPath,

    [string]$ResultFile           = "C:\MTR\TestCallResult.json",
    [int]   $HelperTimeoutSeconds = 180,

    # SMTP / email (all optional — skip email if SmtpServer is empty)
    [string]$SmtpServer   = "",
    [int]   $SmtpPort     = 587,
    [string]$SmtpUser     = "",
    [string]$SmtpPassword = "",
    [string]$MailFrom     = "",
    [string]$MailTo       = "",
    [string]$RoomName     = $env:COMPUTERNAME
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Helper: timestamped log
# ---------------------------------------------------------------------------
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $ts   = Get-Date -f 'yyyy-MM-dd HH:mm:ss'
    $line = "[$ts] [$Level] $Message"
    switch ($Level) {
        "ERROR" { Write-Host $line -ForegroundColor Red    }
        "WARN"  { Write-Host $line -ForegroundColor Yellow }
        default { Write-Host $line -ForegroundColor Cyan   }
    }
}

# ---------------------------------------------------------------------------
# Inline C# for Win32 session-bridging APIs
# ---------------------------------------------------------------------------
$cSharpCode = @"
using System;
using System.Runtime.InteropServices;

namespace MTR
{
    public static class SessionBridge
    {
        // WTS
        [DllImport("Wtsapi32.dll", SetLastError = true)]
        public static extern bool WTSQueryUserToken(uint SessionId, out IntPtr phToken);

        // Advapi32
        [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        public static extern bool CreateProcessAsUser(
            IntPtr hToken,
            string lpApplicationName,
            string lpCommandLine,
            IntPtr lpProcessAttributes,
            IntPtr lpThreadAttributes,
            bool   bInheritHandles,
            uint   dwCreationFlags,
            IntPtr lpEnvironment,
            string lpCurrentDirectory,
            ref STARTUPINFO lpStartupInfo,
            out PROCESS_INFORMATION lpProcessInformation
        );

        [DllImport("userenv.dll", SetLastError = true)]
        public static extern bool CreateEnvironmentBlock(
            out IntPtr lpEnvironment,
            IntPtr hToken,
            bool   bInherit
        );

        [DllImport("userenv.dll", SetLastError = true)]
        public static extern bool DestroyEnvironmentBlock(IntPtr lpEnvironment);

        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern bool CloseHandle(IntPtr hObject);

        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern uint WaitForSingleObject(IntPtr hHandle, uint dwMilliseconds);

        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern bool GetExitCodeProcess(IntPtr hProcess, out uint lpExitCode);

        [DllImport("advapi32.dll", SetLastError = true)]
        public static extern bool DuplicateTokenEx(
            IntPtr hExistingToken,
            uint   dwDesiredAccess,
            IntPtr lpTokenAttributes,
            int    ImpersonationLevel,
            int    TokenType,
            out IntPtr phNewToken
        );

        public const uint MAXIMUM_ALLOWED           = 0x02000000;
        public const uint CREATE_UNICODE_ENVIRONMENT = 0x00000400;
        public const uint NORMAL_PRIORITY_CLASS      = 0x00000020;
        public const uint WAIT_TIMEOUT               = 0x00000102;
        public const uint STILL_ACTIVE               = 259;

        public const int SecurityImpersonation = 2;
        public const int TokenPrimary          = 1;

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct STARTUPINFO
        {
            public int    cb;
            public string lpReserved;
            public string lpDesktop;
            public string lpTitle;
            public uint   dwX, dwY, dwXSize, dwYSize;
            public uint   dwXCountChars, dwYCountChars;
            public uint   dwFillAttribute;
            public uint   dwFlags;
            public short  wShowWindow;
            public short  cbReserved2;
            public IntPtr lpReserved2;
            public IntPtr hStdInput, hStdOutput, hStdError;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct PROCESS_INFORMATION
        {
            public IntPtr hProcess;
            public IntPtr hThread;
            public uint   dwProcessId;
            public uint   dwThreadId;
        }

        /// <summary>
        /// Spawns commandLine in the user session identified by sessionId.
        /// Returns the Win32 exit code of the launched process, or throws on error.
        /// </summary>
        public static uint SpawnInUserSession(uint sessionId, string commandLine, uint timeoutMs)
        {
            IntPtr userToken    = IntPtr.Zero;
            IntPtr primaryToken = IntPtr.Zero;
            IntPtr envBlock     = IntPtr.Zero;

            try
            {
                if (!WTSQueryUserToken(sessionId, out userToken))
                    throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(),
                        "WTSQueryUserToken failed for session " + sessionId);

                if (!DuplicateTokenEx(userToken, MAXIMUM_ALLOWED, IntPtr.Zero,
                        SecurityImpersonation, TokenPrimary, out primaryToken))
                    throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(),
                        "DuplicateTokenEx failed");

                if (!CreateEnvironmentBlock(out envBlock, primaryToken, false))
                    envBlock = IntPtr.Zero;

                var si = new STARTUPINFO();
                si.cb        = Marshal.SizeOf(si);
                si.lpDesktop = @"winsta0\default";

                PROCESS_INFORMATION pi;
                uint flags = NORMAL_PRIORITY_CLASS;
                if (envBlock != IntPtr.Zero) flags |= CREATE_UNICODE_ENVIRONMENT;

                bool created = CreateProcessAsUser(
                    primaryToken,
                    null,
                    commandLine,
                    IntPtr.Zero,
                    IntPtr.Zero,
                    false,
                    flags,
                    envBlock,
                    null,
                    ref si,
                    out pi
                );

                if (!created)
                    throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(),
                        "CreateProcessAsUser failed");

                CloseHandle(pi.hThread);

                uint waitResult = WaitForSingleObject(pi.hProcess, timeoutMs);
                uint exitCode   = STILL_ACTIVE;
                GetExitCodeProcess(pi.hProcess, out exitCode);
                CloseHandle(pi.hProcess);

                if (waitResult == WAIT_TIMEOUT)
                    throw new TimeoutException(
                        string.Format("Helper process (PID {0}) did not finish within {1} ms",
                            pi.dwProcessId, timeoutMs));

                return exitCode;
            }
            finally
            {
                if (envBlock     != IntPtr.Zero) DestroyEnvironmentBlock(envBlock);
                if (primaryToken != IntPtr.Zero) CloseHandle(primaryToken);
                if (userToken    != IntPtr.Zero) CloseHandle(userToken);
            }
        }
    }
}
"@

# ---------------------------------------------------------------------------
# Load the C# type (idempotent across runs in the same PS session)
# ---------------------------------------------------------------------------
if (-not ([System.Management.Automation.PSTypeName]'MTR.SessionBridge').Type) {
    Write-Log "Compiling session-bridge C# code..."
    Add-Type -TypeDefinition $cSharpCode -Language CSharp
}

# ---------------------------------------------------------------------------
# 1. Validate inputs
# ---------------------------------------------------------------------------
Write-Log "Starting MTR-InjectUIAutomation on $RoomName"
Write-Log "Join URL: $JoinUrl"

if (-not (Test-Path $HelperScriptPath)) {
    Write-Log "Helper script not found: $HelperScriptPath" "ERROR"
    exit 1
}

# ---------------------------------------------------------------------------
# 2. Find the Skype user's active session ID
# ---------------------------------------------------------------------------
Write-Log "Enumerating active Windows sessions..."

$sessionId = $null

try {
    $qwinsta = & qwinsta 2>&1
    foreach ($line in $qwinsta) {
        if ($line -match '\bSkype\b' -and $line -match '\bActive\b') {
            foreach ($part in ($line.Trim() -split '\s+')) {
                if ($part -match '^\d+$') {
                    $sessionId = [uint32]$part
                    break
                }
            }
        }
    }
} catch {
    Write-Log "qwinsta failed: $_" "WARN"
}

# Final fallback: Session 1 is always the first interactive session on a single-user MTR
if ($null -eq $sessionId) {
    Write-Log "Could not auto-detect Skype session; defaulting to Session 1." "WARN"
    $sessionId = [uint32]1
}

Write-Log "Target session ID: $sessionId"

# ---------------------------------------------------------------------------
# 3. Build the command line for the helper script
# ---------------------------------------------------------------------------
# Escape the Join URL in case it contains special characters
$escapedUrl = $JoinUrl -replace '"', '\"'

$cmdLine = "powershell.exe -NonInteractive -ExecutionPolicy Bypass " +
           "-File `"$HelperScriptPath`" " +
           "-JoinUrl `"$escapedUrl`" " +
           "-ResultFile `"$ResultFile`""

Write-Log "Command: $cmdLine"

# ---------------------------------------------------------------------------
# 4. Remove stale result file
# ---------------------------------------------------------------------------
if (Test-Path $ResultFile) {
    Remove-Item $ResultFile -Force
    Write-Log "Removed stale result file."
}

# ---------------------------------------------------------------------------
# 5. Spawn the helper in Session 1
# ---------------------------------------------------------------------------
Write-Log "Spawning helper in session $sessionId..."

$timeoutMs = [uint32]($HelperTimeoutSeconds * 1000)

try {
    $exitCode = [MTR.SessionBridge]::SpawnInUserSession($sessionId, $cmdLine, $timeoutMs)
    Write-Log "Helper process exited with code: $exitCode"
} catch [TimeoutException] {
    Write-Log "Helper script timed out after $HelperTimeoutSeconds seconds." "ERROR"
    $exitCode = 999
} catch {
    Write-Log "Failed to spawn helper: $_" "ERROR"
    exit 1
}

# ---------------------------------------------------------------------------
# 6. Read result
# ---------------------------------------------------------------------------
$testResult = $null

if (Test-Path $ResultFile) {
    try {
        $testResult = Get-Content $ResultFile -Raw | ConvertFrom-Json
        Write-Log "Test result: $($testResult.Status) — $($testResult.Message)"
    } catch {
        Write-Log "Failed to parse result file: $_" "WARN"
    }
} else {
    Write-Log "Result file not found after helper exit — call may have failed silently." "WARN"
}

$callStatus   = if ($testResult) { $testResult.Status  } else { "UNKNOWN" }
$callMessage  = if ($testResult) { $testResult.Message } else { "No result file produced." }
$callDuration = if ($testResult -and $testResult.ConnectedSeconds) { "$($testResult.ConnectedSeconds)s" } else { "N/A" }

# ---------------------------------------------------------------------------
# 7. Send email report (if SMTP is configured)
# ---------------------------------------------------------------------------
if ($SmtpServer -and $SmtpUser -and $SmtpPassword -and $MailFrom -and $MailTo) {

    Write-Log "Sending email report..."

    $statusColour = switch ($callStatus) {
        "PASS"  { "#2ecc71" }
        "FAIL"  { "#e74c3c" }
        default { "#f39c12" }
    }

    $htmlBody = @"
<!DOCTYPE html><html><body style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#333">
<h2 style="color:#0078d4">MTR Test Call Report — $RoomName</h2>
<table style="border-collapse:collapse;width:600px">
  <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5;width:180px">Room</td>
      <td style="padding:6px 12px">$RoomName</td></tr>
  <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Date / Time</td>
      <td style="padding:6px 12px">$(Get-Date -f 'yyyy-MM-dd HH:mm:ss')</td></tr>
  <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Join URL</td>
      <td style="padding:6px 12px;word-break:break-all"><a href="$JoinUrl">$JoinUrl</a></td></tr>
  <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Call Status</td>
      <td style="padding:6px 12px"><span style="background:$statusColour;color:#fff;padding:2px 10px;border-radius:4px;font-weight:bold">$callStatus</span></td></tr>
  <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Connected Duration</td>
      <td style="padding:6px 12px">$callDuration</td></tr>
  <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Detail</td>
      <td style="padding:6px 12px">$callMessage</td></tr>
</table>
<p style="color:#888;font-size:12px;margin-top:20px">Generated by MTR-InjectUIAutomation.ps1 on $env:COMPUTERNAME</p>
</body></html>
"@

    $smtpCred             = New-Object System.Net.NetworkCredential($SmtpUser, $SmtpPassword)
    $smtp                 = New-Object System.Net.Mail.SmtpClient($SmtpServer, $SmtpPort)
    $smtp.EnableSsl       = $true
    $smtp.Credentials     = $smtpCred
    $smtp.DeliveryMethod  = [System.Net.Mail.SmtpDeliveryMethod]::Network

    $mail            = New-Object System.Net.Mail.MailMessage
    $mail.From       = $MailFrom
    $mail.Subject    = "MTR Test Call [$callStatus] — $RoomName — $(Get-Date -f 'yyyy-MM-dd')"
    $mail.Body       = $htmlBody
    $mail.IsBodyHtml = $true
    foreach ($addr in ($MailTo -split ',')) { $mail.To.Add($addr.Trim()) }

    try {
        $smtp.Send($mail)
        Write-Log "Email sent to $MailTo"
    } catch {
        Write-Log "Email send failed: $_" "WARN"
    } finally {
        $smtp.Dispose()
        $mail.Dispose()
    }

} else {
    Write-Log "SMTP not configured — skipping email."
}

# ---------------------------------------------------------------------------
# 8. Exit with appropriate code
# ---------------------------------------------------------------------------
Write-Log "Done. Final status: $callStatus"
exit $(if ($callStatus -eq "PASS") { 0 } else { 1 })
