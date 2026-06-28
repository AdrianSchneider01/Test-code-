#Requires -Version 5.1
<#
.SYNOPSIS
    Creates a Teams online meeting for an MTR room account via Microsoft Graph API
    and saves the Join URL for use by MTR-InjectUIAutomation.ps1.

.DESCRIPTION
    Uses app-only auth (client credentials flow) against Microsoft Graph.
    Required Azure App Registration permissions (Application, not Delegated):
      - OnlineMeetings.ReadWrite.All
      - Calendars.ReadWrite  (optional, for calendar event creation)

    Run this script from any machine with internet access before the scheduled
    test call window on each MTR.

.PARAMETER TenantId
    Azure AD Tenant ID (GUID or domain).

.PARAMETER ClientId
    Azure App Registration Client ID.

.PARAMETER ClientSecret
    Azure App Registration Client Secret. Use a secure vault/parameter in production.

.PARAMETER RoomUpn
    UPN of the MTR room account (e.g. room@contoso.com).

.PARAMETER MeetingStartOffsetMinutes
    How many minutes from now the meeting should start. Default: 5.

.PARAMETER MeetingDurationMinutes
    Duration of the test meeting in minutes. Default: 10.

.PARAMETER OutputFile
    Path to write the Join URL to. Defaults to %TEMP%\MTR-TestMeeting.json.
    MTR-InjectUIAutomation.ps1 on the MTR should read from the same shared path
    (UNC, mapped drive, or copied locally before the test window).

.EXAMPLE
    .\MTR-CreateTestMeeting.ps1 `
        -TenantId "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" `
        -ClientId  "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy" `
        -ClientSecret "your-secret-here" `
        -RoomUpn "boardroom@contoso.com" `
        -OutputFile "C:\MTR\TestMeetingInfo.json"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$TenantId,

    [Parameter(Mandatory)]
    [string]$ClientId,

    [Parameter(Mandatory)]
    [string]$ClientSecret,

    [Parameter(Mandatory)]
    [string]$RoomUpn,

    [int]$MeetingStartOffsetMinutes = 5,
    [int]$MeetingDurationMinutes    = 10,

    [string]$OutputFile = (Join-Path $env:TEMP "MTR-TestMeeting.json")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# 1. Acquire access token (client credentials)
# ---------------------------------------------------------------------------
Write-Host "[$(Get-Date -f 'HH:mm:ss')] Acquiring Graph access token..." -ForegroundColor Cyan

$tokenUri  = "https://login.microsoftonline.com/$TenantId/oauth2/v2.0/token"
$tokenBody = @{
    client_id     = $ClientId
    client_secret = $ClientSecret
    scope         = "https://graph.microsoft.com/.default"
    grant_type    = "client_credentials"
}

try {
    $tokenResponse = Invoke-RestMethod -Method Post -Uri $tokenUri -Body $tokenBody -ContentType "application/x-www-form-urlencoded"
} catch {
    Write-Error "Token acquisition failed: $_"
    exit 1
}

$accessToken = $tokenResponse.access_token
$authHeader  = @{ Authorization = "Bearer $accessToken" }
Write-Host "[$(Get-Date -f 'HH:mm:ss')] Token acquired (expires in $($tokenResponse.expires_in)s)." -ForegroundColor Green

# ---------------------------------------------------------------------------
# 2. Resolve room account Object ID from UPN
# ---------------------------------------------------------------------------
Write-Host "[$(Get-Date -f 'HH:mm:ss')] Resolving room account: $RoomUpn" -ForegroundColor Cyan

try {
    $userUri      = "https://graph.microsoft.com/v1.0/users/$([uri]::EscapeDataString($RoomUpn))"
    $userResponse = Invoke-RestMethod -Method Get -Uri $userUri -Headers $authHeader
    $roomUserId   = $userResponse.id
    Write-Host "[$(Get-Date -f 'HH:mm:ss')] Room Object ID: $roomUserId" -ForegroundColor Green
} catch {
    Write-Error "Failed to resolve room account '$RoomUpn': $_"
    exit 1
}

# ---------------------------------------------------------------------------
# 3. Create the online meeting on behalf of the room account
# ---------------------------------------------------------------------------
Write-Host "[$(Get-Date -f 'HH:mm:ss')] Creating Teams online meeting..." -ForegroundColor Cyan

$startTime = (Get-Date).ToUniversalTime().AddMinutes($MeetingStartOffsetMinutes)
$endTime   = $startTime.AddMinutes($MeetingDurationMinutes)

# Graph requires ISO 8601 with trailing Z
$startIso = $startTime.ToString("yyyy-MM-ddTHH:mm:ssZ")
$endIso   = $endTime.ToString("yyyy-MM-ddTHH:mm:ssZ")

$meetingBody = @{
    subject         = "MTR Automated Test Call - $(Get-Date -f 'yyyy-MM-dd HH:mm')"
    startDateTime   = $startIso
    endDateTime     = $endIso
    # Allow anyone to join without lobby so the MTR joins immediately
    lobbyBypassSettings = @{
        scope                     = "everyone"
        isDialInBypassEnabled     = $true
    }
} | ConvertTo-Json -Depth 5

# Use /users/{userId}/onlineMeetings — requires OnlineMeetings.ReadWrite.All
$meetingUri = "https://graph.microsoft.com/v1.0/users/$roomUserId/onlineMeetings"

try {
    $meeting = Invoke-RestMethod -Method Post -Uri $meetingUri -Headers $authHeader `
        -ContentType "application/json" -Body $meetingBody
} catch {
    Write-Error "Failed to create online meeting: $_"
    exit 1
}

$joinUrl   = $meeting.joinWebUrl
$meetingId = $meeting.id

Write-Host "[$(Get-Date -f 'HH:mm:ss')] Meeting created." -ForegroundColor Green
Write-Host "  Subject  : $($meeting.subject)"
Write-Host "  Start    : $startIso"
Write-Host "  End      : $endIso"
Write-Host "  Join URL : $joinUrl"

# ---------------------------------------------------------------------------
# 4. Persist meeting info to output file
# ---------------------------------------------------------------------------
$outputData = [ordered]@{
    CreatedAt          = (Get-Date -f 'o')
    MeetingId          = $meetingId
    Subject            = $meeting.subject
    StartDateTime      = $startIso
    EndDateTime        = $endIso
    JoinUrl            = $joinUrl
    RoomUpn            = $RoomUpn
    RoomObjectId       = $roomUserId
}

$outputDir = Split-Path $OutputFile
if ($outputDir -and -not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$outputData | ConvertTo-Json -Depth 5 | Set-Content -Path $OutputFile -Encoding UTF8

Write-Host "[$(Get-Date -f 'HH:mm:ss')] Meeting info saved to: $OutputFile" -ForegroundColor Green
Write-Host ""
Write-Host "Next step: copy $OutputFile to the MTR and run MTR-InjectUIAutomation.ps1" -ForegroundColor Yellow
