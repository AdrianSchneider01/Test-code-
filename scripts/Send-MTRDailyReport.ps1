# scripts/Send-MTRDailyReport.ps1
# Runs on the central machine after the daily tests. Reads today's results from
# the endpoint, pairs each room's MTR result with its observer (camera) result,
# and emails one HTML summary. ASCII only (PS 5.1).
#
# Default: Google Workspace SMTP relay (smtp-relay.gmail.com), which accepts mail
# from this machine's public IP without a password. One-time setup in Google Admin:
#   Apps > Google Workspace > Gmail > Routing > SMTP relay service: allowed senders
#   "Only addresses in my domains", "Only accept mail from the specified IP addresses"
#   (this machine's public IP), "Require TLS encryption".
# Alternative: smtp.gmail.com with an app password saved by scripts\New-GmailCredential.ps1:
#   -SmtpServer smtp.gmail.com -CredFile "$env:USERPROFILE\gmail-cred.xml"
#
# Usage:
#   .\scripts\Send-MTRDailyReport.ps1                         # send today's report
#   .\scripts\Send-MTRDailyReport.ps1 -PreviewPath report.html  # write HTML, don't send

param(
    [string[]]$To            = @("adrian@busyintegration.com.au"),
    [string]  $From          = "adrian@busyintegration.com.au",
    [datetime]$Since         = (Get-Date).Date,           # local midnight today
    [string[]]$ExpectedRooms = @(),                       # rooms that should have reported
    [string]  $EndpointFile  = "$env:USERPROFILE\mtr-endpoint.json",
    [string]  $SmtpServer    = "smtp-relay.gmail.com",
    [int]     $Port          = 587,
    [string]  $CredFile      = "",                        # only for smtp.gmail.com with an app password
    [string]  $PreviewPath   = ""
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Encode([string]$s) { [System.Net.WebUtility]::HtmlEncode($s) }

# -- Fetch -----------------------------------------------------------------------
$cfg  = Get-Content $EndpointFile -Raw | ConvertFrom-Json
$uri  = "$($cfg.url)/results?since=$([uri]::EscapeDataString($Since.ToUniversalTime().ToString('o')))"
$data = Invoke-RestMethod $uri -Headers @{ Authorization = "Bearer $($cfg.readToken)" } -TimeoutSec 30
$all  = @($data.results)

# -- Pair results per room (latest of each source) -------------------------------
$rooms = @($all | ForEach-Object { $_.room }) + $ExpectedRooms | Sort-Object -Unique
$rows = foreach ($room in $rooms) {
    $mtr = $all | Where-Object { $_.room -eq $room -and $_.source -eq "mtr" }      | Select-Object -Last 1
    $obs = $all | Where-Object { $_.room -eq $room -and $_.source -eq "observer" } | Select-Object -Last 1

    $overall =
        if (-not $mtr)                              { "MISSING" }
        elseif ($mtr.status -eq "FAIL")             { "FAIL" }
        elseif (-not $obs -or $obs.status -ne "LIVE") { "FAIL" }
        elseif ($mtr.status -eq "WARN")             { "WARN" }
        else                                        { "PASS" }

    $when = if ($mtr) { ([datetime]$mtr.received_at).ToLocalTime().ToString("HH:mm") } else { "" }
    [pscustomobject]@{
        Room     = $room
        Overall  = $overall
        Time     = $when
        Call     = if ($mtr) { "$($mtr.status): $($mtr.message)" } else { "No result from the room" }
        Camera   = if ($obs) { "$($obs.status): $($obs.message)" } else { "No result from the observer" }
    }
}

# -- Build HTML -----------------------------------------------------------------
$colour = @{ PASS = "#1a7f37"; WARN = "#9a6700"; FAIL = "#cf222e"; MISSING = "#cf222e" }
$counts = foreach ($s in "PASS", "WARN", "FAIL", "MISSING") { "$(@($rows | Where-Object Overall -eq $s).Count) $s" }
$subject = "MTR daily test $((Get-Date).ToString('yyyy-MM-dd')): $($counts -join ', ')"

$tr = foreach ($r in $rows) {
    "<tr><td style='padding:6px 10px;border-bottom:1px solid #ddd'><b>$(Encode $r.Room)</b></td>" +
    "<td style='padding:6px 10px;border-bottom:1px solid #ddd;color:$($colour[$r.Overall]);font-weight:bold'>$($r.Overall)</td>" +
    "<td style='padding:6px 10px;border-bottom:1px solid #ddd'>$(Encode $r.Time)</td>" +
    "<td style='padding:6px 10px;border-bottom:1px solid #ddd'>$(Encode $r.Call)</td>" +
    "<td style='padding:6px 10px;border-bottom:1px solid #ddd'>$(Encode $r.Camera)</td></tr>"
}
if (-not $rows) { $tr = "<tr><td colspan='5' style='padding:6px 10px'>No results received since $(Encode ($Since.ToString('yyyy-MM-dd HH:mm')))</td></tr>" }

$html = @"
<html><body style='font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#222'>
<h2 style='margin:0 0 4px'>MTR daily test call</h2>
<p style='margin:0 0 12px;color:#555'>$(Encode ($counts -join ', ')) &middot; results since $(Encode ($Since.ToString('yyyy-MM-dd HH:mm')))</p>
<table style='border-collapse:collapse'>
<tr style='background:#f3f3f3;text-align:left'><th style='padding:6px 10px'>Room</th><th style='padding:6px 10px'>Result</th><th style='padding:6px 10px'>Time</th><th style='padding:6px 10px'>Test call (room)</th><th style='padding:6px 10px'>Camera (observer)</th></tr>
$($tr -join "`n")
</table>
<p style='color:#777;font-size:12px'>PASS = joined, camera live on the room's tile, left and back on home. WARN = same, with hardware warnings (see the Teams Rooms Pro portal). FAIL = the call or camera check failed. MISSING = no result from the room.</p>
</body></html>
"@

if ($PreviewPath) {
    $html | Set-Content $PreviewPath -Encoding UTF8
    Write-Host "Preview written to $PreviewPath"
    Write-Host "Subject: $subject"
    return
}

# -- Send -----------------------------------------------------------------------
$mail = @{
    SmtpServer = $SmtpServer; Port = $Port; UseSsl = $true
    From = $From; To = $To; Subject = $subject; Body = $html; BodyAsHtml = $true; Encoding = [Text.Encoding]::UTF8
}
if ($CredFile) { $mail.Credential = Import-Clixml $CredFile }   # relay authenticates by IP instead
Send-MailMessage @mail
Write-Host "Sent '$subject' to $($To -join ', ') via $SmtpServer"
