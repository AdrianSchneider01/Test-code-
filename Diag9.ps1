# Diag9: MTR test call via companion app UIA
# Join: Calendar mode clicks the room's calendar tile "Join" and then checks the
#       meeting ID shown in the call; Id mode types the ID via "Join with an ID".
# Leave: invoke Leave/Hang up; fallback mouse click.
# Meeting details come from C:\MTR\mtr-config.json (joinMode, meetingId, passcode);
# parameters override them for manual runs.

param(
    [string]$ResultFile = "C:\MTR\TestCallResult.json",
    [string]$ConfigFile = "C:\MTR\mtr-config.json",
    [string]$MeetingId  = "",
    [string]$Passcode   = "",
    # Calendar: click the calendar tile's Join; $MeetingId is the EXPECTED meeting.
    # Id: join $MeetingId via "Join with an ID".
    [ValidateSet("", "Id", "Calendar")]
    [string]$JoinMode   = "",
    [int]$CalendarWaitSec = 180,
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

# Teams Rooms (WebView2) buttons have no AutomationId and generated class names,
# and each tile has a Text label with the same Name. Match ControlType=Button + exact Name.
function Get-ButtonCondition {
    param([string]$Name)
    New-Object System.Windows.Automation.AndCondition(
        (New-Object $PC($AE::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)),
        (New-Object $PC($NAM, $Name)))
}

function Has-Button {
    param([string]$Name)
    $null -ne $AE::RootElement.FindFirst($TF::Descendants, (Get-ButtonCondition $Name))
}

function Invoke-Button {
    param([string]$Name)
    $btn = $AE::RootElement.FindFirst($TF::Descendants, (Get-ButtonCondition $Name))
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

# Overlay panels (e.g. "Close meeting room info") hide all in-call buttons.
# Their close buttons START with "Close "; the hardware warning banners' close
# buttons END with "Close" and must stay (they are how issues are detected).
function Close-Overlays {
    $btns = $AE::RootElement.FindAll($TF::Descendants, $allCond) | Where-Object {
        try { $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and
              $_.Current.Name -like "Close *" } catch { $false }
    }
    foreach ($b in $btns) {
        try {
            $n = $b.Current.Name
            $b.GetCurrentPattern($IPP).Invoke()
            Write-Log "Closed overlay '$n'"
            Start-Sleep -Seconds 1
        } catch {}
    }
}

# The call screen shows "Meeting ID: 497 737 059 187 682"; returns the digits only
function Get-MeetingIdOnScreen {
    $textCond = New-Object $PC($AE::ControlTypeProperty, [System.Windows.Automation.ControlType]::Text)
    foreach ($t in $AE::RootElement.FindAll($TF::Descendants, $textCond)) {
        try {
            if ($t.Current.Name -match 'Meeting ID:\s*([\d ]+)') { return ($Matches[1] -replace '\D', '') }
        } catch {}
    }
    return ""
}

# Text elements show the meeting title, participant tiles and lobby names
function Dump-Texts {
    param([string]$Label)
    Write-Log "=== Texts [$Label] ==="
    $textCond = New-Object $PC($AE::ControlTypeProperty, [System.Windows.Automation.ControlType]::Text)
    foreach ($t in $AE::RootElement.FindAll($TF::Descendants, $textCond)) {
        try { if ($t.Current.Name.Trim()) { Write-Log "    '$($t.Current.Name)'" } } catch {}
    }
}

function Join-ByMeetingId {
    param([string]$MeetingId, [string]$Passcode)

    Write-Log "Joining meeting $MeetingId via 'Join with an ID'..."
    if (-not (Invoke-Button "Join with an ID")) {
        Write-Log "Could not click 'Join with an ID'" "WARN"
        return $false
    }
    Start-Sleep -Seconds 2

    # First screen is a platform picker (teams / zoom / googlemeet / Back)
    if (Has-Button "teams") {
        Invoke-Button "teams" | Out-Null
        Start-Sleep -Seconds 2
    }

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

    # ValuePattern.SetValue does not fire the web page's input events, so the
    # Join button stays disabled. Focus each field and type real keystrokes.
    # (SendKeys special chars + ^ % ~ ( ) { } [ ] would need escaping; ID and passcode are alphanumeric.)
    Add-Type -AssemblyName System.Windows.Forms
    $fields = @(@($MeetingId, "meeting ID"), @($Passcode, "passcode"))
    for ($i = 0; $i -lt [Math]::Min($edits.Count, 2); $i++) {
        $text = $fields[$i][0]; $what = $fields[$i][1]
        if (-not $text) { continue }
        try {
            $edits[$i].SetFocus()
            Start-Sleep -Milliseconds 300
            [System.Windows.Forms.SendKeys]::SendWait("^a")
            [System.Windows.Forms.SendKeys]::SendWait($text)
            Write-Log "Typed $what"
        } catch { Write-Log "Failed to type ${what}: $_" "WARN" }
    }

    # Wait for the join button to enable
    $deadline = (Get-Date).AddSeconds(5)
    while ((Get-Date) -lt $deadline) {
        $jb = $AE::RootElement.FindFirst($TF::Descendants, (Get-ButtonCondition "Join Teams meeting"))
        if ($jb -and $jb.Current.IsEnabled) { break }
        Start-Sleep -Milliseconds 500
    }

    # The calendar tile's "Join" may still be in the tree behind the dialog;
    # the dialog comes later in tree order, so take the LAST enabled match.
    foreach ($label in @("Join Teams meeting", "Join meeting", "Join", "Continue", "OK")) {
        $btn = @($AE::RootElement.FindAll($TF::Descendants, (Get-ButtonCondition $label)) |
                 Where-Object { $_.Current.IsEnabled }) | Select-Object -Last 1
        if ($btn) {
            try {
                $r = $btn.Current.BoundingRectangle
                $btn.GetCurrentPattern($IPP).Invoke()
                Write-Log "Clicked '$label' at ($([int]$r.X),$([int]$r.Y))"
                return $true
            } catch { Write-Log "InvokePattern failed for '$label': $_" "WARN" }
        }
    }
    Write-Log "Could not find a Join button after entering meeting ID" "WARN"
    # Back out of the dialog so the room is not left on it
    for ($i = 0; $i -lt 3 -and (Has-Button "Back"); $i++) { Invoke-Button "Back" | Out-Null; Start-Sleep -Seconds 1 }
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
    param([string]$Status, [string]$Message, [int]$ConnectedSeconds=0, [array]$Issues=@(), [hashtable]$Extra=@{})
    $result = @{
        Status           = $Status
        Message          = $Message
        ConnectedSeconds = $ConnectedSeconds
        Timestamp        = (Get-Date -f "o")
        JoinMode         = $JoinMode
        MeetingId        = $MeetingId
        Issues           = @($Issues | ForEach-Object { [PSCustomObject]$_ })
    }
    foreach ($k in $Extra.Keys) { $result[$k] = $Extra[$k] }
    $result | ConvertTo-Json -Depth 3 | Set-Content $ResultFile -Encoding UTF8
    Write-Log "Written result '$Status' to $ResultFile"
    Send-Result $result
}

# Report the result to the central endpoint (outbound HTTPS) when configured.
# C:\MTR\mtr-config.json: { "url": "...", "reportToken": "...", "room": "..." }
function Send-Result {
    param([hashtable]$Result)
    if (-not (Test-Path $ConfigFile)) { Write-Log "No $ConfigFile - not reporting to endpoint"; return }
    try {
        $cfg = Get-Content $ConfigFile -Raw | ConvertFrom-Json
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $body = @{ room = $cfg.room; source = "mtr"; status = $Result.Status; message = $Result.Message; details = $Result } |
                ConvertTo-Json -Depth 4
        $null = Invoke-RestMethod -Uri "$($cfg.url)/results" -Method Post -ContentType "application/json" `
                    -Headers @{ Authorization = "Bearer $($cfg.reportToken)" } -Body $body -TimeoutSec 30
        Write-Log "Reported '$($Result.Status)' to $($cfg.url) as room '$($cfg.room)'"
    } catch {
        Write-Log "Failed to report to endpoint: $_" "WARN"
    }
}

# ==== MAIN ====
Write-Log "Diag9 started"
New-Item -ItemType Directory -Path (Split-Path $ResultFile) -Force | Out-Null

# Meeting details from the room's config unless given as parameters
if (Test-Path $ConfigFile) {
    $roomCfg = Get-Content $ConfigFile -Raw | ConvertFrom-Json
    if (-not $JoinMode  -and $roomCfg.joinMode)  { $JoinMode  = $roomCfg.joinMode }
    if (-not $MeetingId -and $roomCfg.meetingId) { $MeetingId = $roomCfg.meetingId }
    if (-not $Passcode  -and $roomCfg.passcode)  { $Passcode  = $roomCfg.passcode }
}
if (-not $JoinMode) { $JoinMode = "Calendar" }
$MeetingId = $MeetingId -replace '\D', ''
Write-Log "JoinMode=$JoinMode ExpectedMeetingId=$MeetingId"
if ($JoinMode -eq "Id" -and -not $MeetingId) {
    Write-Result -Status "FAIL" -Message "JoinMode Id but no meetingId in $ConfigFile" -Extra @{ Joined = $false; Left = $false; BackToHome = $false }
    exit 1
}

Dump-Buttons "initial"

# -- Join ----------------------------------------------------------------------
$joined = $false

# Recover from a dialog left open by a previous run
for ($i = 0; $i -lt 3 -and -not (Has-Button "Join with an ID") -and (Has-Button "Back"); $i++) {
    Write-Log "Not on home screen - pressing Back"
    Invoke-Button "Back" | Out-Null
    Start-Sleep -Seconds 1
}
if ($JoinMode -eq "Calendar") {
    # The tile's Join appears shortly before the meeting starts; wait for it
    $deadline = (Get-Date).AddSeconds($CalendarWaitSec)
    while (-not (Has-Button "Join") -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 5 }
    if (Has-Button "Join") {
        Dump-Texts "calendar"
        Write-Log "Found calendar 'Join' button - invoking..."
        $joined = Invoke-Button "Join"
    } else {
        Write-Log "No calendar 'Join' button within $CalendarWaitSec s - is the test meeting on the room's calendar?" "WARN"
        $joined = $false
    }
} else {
    $joined = Join-ByMeetingId -MeetingId $MeetingId -Passcode $Passcode
}

if (-not $joined) {
    Write-Log "Failed to join - aborting." "WARN"
    $why = if ($JoinMode -eq "Calendar") { "no Join button on the room's calendar" } else { "Join with an ID failed" }
    Write-Result -Status "FAIL" -Message "Could not join ($why)" -Extra @{ Joined = $false; Left = $false; BackToHome = $false }
    exit 1
}

$joinTime = Get-Date
Write-Log "Polling for lobby admit buttons for up to 90s while call settles..."

$pollDeadline = (Get-Date).AddSeconds(90)
$actualMeetingId = ""
while ((Get-Date) -lt $pollDeadline) {
    if (-not $actualMeetingId) {
        $actualMeetingId = Get-MeetingIdOnScreen
        if ($actualMeetingId) { Write-Log "Meeting ID on screen: $actualMeetingId" }
    }
    $allBtns = $AE::RootElement.FindAll($TF::Descendants, $allCond) | Where-Object {
        try { $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button } catch { $false }
    }
    foreach ($b in $allBtns) {
        try {
            $name = $b.Current.Name
            if ($name -match '(?i)\badmit\b') {
                Dump-Texts "lobby-notification"
                Write-Log "Lobby: found admit button '$name' - clicking"
                try { $b.GetCurrentPattern($IPP).Invoke(); Write-Log "Admitted." }
                catch { Write-Log "Admit invoke failed: $_" "WARN" }
            }
        } catch {}
    }
    Start-Sleep -Seconds 5
}

Close-Overlays
Dump-Buttons "in-call"
Dump-Texts "in-call"

# -- Check hardware issues ------------------------------------------------------
# PowerShell unrolls the returned list (to an array, or $null when empty); rebuild it so .Add works
$issues = [System.Collections.Generic.List[hashtable]]::new()
foreach ($i in @(Check-InCallIssues)) { if ($i) { $issues.Add($i) } }
if ($issues.Count -gt 0) {
    Write-Log "=== In-call issues ==="
    foreach ($i in $issues) { Write-Log "  [$($i.Severity)] $($i.Component): $($i.Message)" }
} else {
    Write-Log "No in-call issues detected."
}

# -- Leave ---------------------------------------------------------------------
Write-Log "=== Attempting to leave ==="
$leftViaUIA = $false
for ($attempt = 1; $attempt -le 2 -and -not $leftViaUIA; $attempt++) {
    if ($attempt -eq 2) { Write-Log "Leave not found - closing overlays and retrying"; Close-Overlays }
    foreach ($leaveLabel in @("Leave", "Leave call", "Hang up", "End call")) {
        if (Has-Button $leaveLabel) { if (Invoke-Button $leaveLabel) { $leftViaUIA = $true; break } }
    }
}
if (-not $leftViaUIA) {
    Write-Log "UIA Leave not found - trying mouse click fallback..."
    Click-HangupButton $HangupX $HangupY
}

Write-Log "Waiting 10s for leave to take effect..."
Start-Sleep -Seconds 10

# Post-call feedback prompt ("Had issues" / "Good" / "Dismiss") blocks the home screen
if (Has-Button "Dismiss") {
    Write-Log "Post-call feedback prompt shown - dismissing"
    Invoke-Button "Dismiss" | Out-Null
    Start-Sleep -Seconds 5
}

Dump-Buttons "after-leave"

# -- Result --------------------------------------------------------------------
$connectedSeconds = [int]((Get-Date) - $joinTime).TotalSeconds
$leaveGone        = -not (Has-Button "Leave")
$backToHome       = (Has-Button "Meet now") -or (Has-Button "Join with an ID")
$left             = $leaveGone -or $backToHome

Write-Log "LeaveGone=$leaveGone  BackToHome=$backToHome  ConnectedSec=$connectedSeconds"

# FAIL = the test call itself failed (join / leave / home screen).
# Hardware findings only WARN: the Teams Rooms Pro portal owns hardware health.
# Did the room join the meeting the observer joins?
$wrongMeeting = $MeetingId -and $actualMeetingId -and ($actualMeetingId -ne $MeetingId)
if ($MeetingId -and -not $actualMeetingId) {
    $issues.Add(@{ Severity = "WARN"; Component = "Meeting"; Message = "Could not read the meeting ID on screen to confirm it is $MeetingId" })
}

if (-not $joined -or -not $left -or -not $backToHome) {
    $status = "FAIL"
} elseif ($wrongMeeting) {
    $status = "FAIL"
} elseif ($issues.Count -gt 0) {
    $status = "WARN"
} else {
    $status = "PASS"
}

$issueList = $issues | ForEach-Object { "$($_.Component): $($_.Message)" }
$message   = if ($status -eq "PASS") { "Joined, left and back on home screen. No issues." } `
             elseif ($status -eq "WARN") { "Joined, left and back on home screen. Hardware warnings: $($issueList -join '; ')" } `
             elseif ($wrongMeeting) { "Joined the wrong meeting: $actualMeetingId, expected $MeetingId (check the room's calendar)" } `
             else { "Join=$joined Left=$left BackToHome=$backToHome Issues: $($issueList -join '; ')" }

Write-Log "Result: $status - $message"
Write-Result -Status $status -Message $message -ConnectedSeconds $connectedSeconds -Issues $issues `
    -Extra @{ Joined = [bool]$joined; Left = [bool]$left; BackToHome = [bool]$backToHome; ActualMeetingId = $actualMeetingId }
Write-Log "Diag9 done."
