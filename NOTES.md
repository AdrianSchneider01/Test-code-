# NOTES

Dated log of what was tried on the MTR and the result. Newest first.

## 2026-10-23 (14:00-14:30) - test call independent of the laptop + results endpoint
- Results endpoint deployed: Cloudflare Worker `mtr-results` at https://mtr-results.adrian-ddf.workers.dev with D1 database `mtr-results` (Busy Cloudflare account). POST /results needs the report token, GET /results the read token; tokens in `%USERPROFILE%\mtr-endpoint.json` (not in repo). Smoke test: 401 without token, 401 with the wrong token type, write + read OK.
  - Gotcha: piping a secret into `wrangler secret put` from PowerShell stored a trailing CR; the Worker now trims secrets.
  - Gotcha: Cloudflare returns 403 to Python's default `Python-urllib` user agent; the observer sends `User-Agent: mtr-observer/1.0`.
- Email: busyintegration.com.au DNS is at dnspackage.com and mail is Google Workspace, so Cloudflare email sending is out. Daily email = Gmail SMTP from the central machine (`scripts/Send-MTRDailyReport.ps1`), sender adrian@busyintegration.com.au with an app password in `%USERPROFILE%\gmail-cred.xml`.
- Diag9 now: hardware findings = WARN, never FAIL (Pro portal owns hardware); FAIL = join/leave/home failed. Posts its result to the endpoint when `C:\MTR\mtr-config.json` exists.
- `scripts/Install-MTRDailyTest.ps1` installed on the Boardroom MTR: task `MTRDailyTest` daily 07:00 as Skype (interactive), config readable by Skype + admins only, endpoint reachable from the MTR. The MTR's execution policy is Restricted: run the installer with `powershell -ExecutionPolicy Bypass -File`.
- Test 14:19 (task started on the MTR, observer run separately 25 s later, no MTR-RunTestCall): MTR joined by ID, admitted observer, left, dismissed feedback, home; reported WARN (display + mic). Observer LIVE on 'Boardroom Test Account'. Report preview: 1 WARN.
- Email: smtp.gmail.com and smtp-relay.gmail.com both dropped the connection with the normal account password; stepping through AUTH LOGIN showed `534 5.7.9 Application-specific password required` (2-Step Verification is on). IP allow-listing the relay was rejected: this laptop's public IP is a shared, changing Vodafone mobile address. Adrian created relay rule "MTR Test EMail" (only addresses in my domains, SMTP auth ON, TLS off - suggest ON) and an app password, saved with `scripts/New-GmailCredential.ps1` (spaces kept; accepted).
- First real email sent 14:4x via smtp-relay.gmail.com: "MTR daily test 2026-10-23: 0 PASS, 1 WARN, 0 FAIL, 0 MISSING".
- Laptop tasks registered: "MTR Observer" 07:00:30 and "MTR Daily Report" 07:15 (relay + `-CredFile`). First scheduled run 2026-10-24; needs the laptop on and logged in.

## 2026-10-23 (late afternoon) - room and observer in the same meeting
- Adrian set the lobby to "everyone can bypass" but could not see MTR-Observer in the lobby. Cause: they were in DIFFERENT meetings. The observer always joins meeting ID 497737059187682; Diag9 clicked the calendar tile's Join (an "AV Test" 12:00-7:00 pm entry, not that ID).
- Diag9 now has `-JoinMode Id|Calendar` (default Id): joins $MeetingId via "Join with an ID" so both sides are in the same meeting. Learned along the way:
  - "Join with an ID" first shows a provider picker (teams / zoom / googlemeet / Back); click "teams".
  - The form has 2 edit fields. ValuePattern.SetValue does not fire web input events, so "Join Teams meeting" stays disabled. Focus + SendKeys works.
  - Failed attempts press Back; Diag9 also presses Back at start if a previous run left a dialog open.
- Check-CameraFeed.py lobby fixes: Teams now says "Someone will let you in shortly" / "...when the meeting starts" (old selector only matched "soon"), and `[data-tid='hangup-button']` no longer exists, so admission was never detected. Now: Leave button visible or lobby text gone.
- Diag9 dumps on-screen texts when admitting and in-call. In-call screen shows "AV Test", organiser "Adrian Schneider I Busy Integration", "Meeting ID: 497737059187682", "1:50 pm - 8:50 pm".
- Test call 13:40: Join=True (by ID), observer admitted after 5 s, CAMERA LIVE 1280x720 showing tile "Boardroom Test Account" (People: 2), Left=True, BackToHome=True. Overall FAIL only because Teams on the room reports "No microphone was found" (+ WARN monitor disconnected).
- Caveat: at 13:31 the camera check said LIVE while the MTR had NOT joined (someone else's video). Camera check counts any live video; it should check the tile name is "Boardroom Test Account".

## 2026-10-23 (afternoon)
- `ScriptLaunch.ps1` runs `C:\Rigel\AdminHookScripts\Launch.ps1` INSTEAD of the real `ScriptLaunchCache\Launch.ps1` (which launches Teams Rooms and loops forever). Old `MTR-UIDiscovery.ps1` scanned before Teams launched. Fixed: start the real Launch.ps1 in the background first, scan once home buttons appear (took ~3 min after boot), never exit.
- UI discovery via `Invoke-MTRTest.ps1` worked (hook ran as Skype, session 1). Result: Teams Rooms is WebView2 (`TeamsWebView`); buttons have NO AutomationId and generated Fluent class names. Each home tile has a Button and a Text with the same Name. Diag9 now matches ControlType=Button + exact Name.
- `Invoke-MTRTest.ps1` fetch failed silently on the first run (copies swallowed by SilentlyContinue). Now uses a fresh session, absolute results path, per-file reporting. `LocalState\Logs.txt` does not exist on this build.
- Test call run 1: FAIL, MTR result timeout. Cause: `Diag9.ps1` contained em-dashes/box chars, saved UTF-8 without BOM; PS 5.1 on the MTR reads it as ANSI and it fails to parse (same error in `C:\MTR\RunLog.txt` at 12:28). Fixed by making Diag9 and MTR-RunTestCall ASCII-only. Task output now saved to `C:\MTR\Diag9-log.txt` and printed by MTR-RunTestCall.
- Test call run 2: MTR joined via calendar Join and left. Ended on post-call feedback prompt (Had issues / Good / Dismiss), so BackToHome=False. Added Dismiss step.
- Test call run 3: Join=True, Left=True, BackToHome=True, connected 108 s. Overall still FAIL:
  - Teams on the MTR reports "No microphone was found" (FAIL) and "One or both of the monitors is disconnected" (WARN). Hardware, not script.
  - Observer stuck in lobby ("Someone will let you in when the meeting starts"); no Admit button ever appears on the MTR, so camera check = NO FEED. Likely the room account cannot admit (not organizer/presenter) or the observer URL is a different meeting from the calendar item. Needs a meeting-options change.

## 2026-10-23
- Connection check passed: `Invoke-Command` with Basic auth and `mtr-cred.xml` returned `C4-54B20393935E` (Windows 10 Enterprise).
- On the MTR: `C:\Rigel\AdminHookScripts` exists but is empty (no `Launch.ps1` hook deployed). `C:\Users\Skype\ScriptLaunchCache\Launch.ps1` exists.
- Copied `MTR-UIDiscovery.ps1` and `Run-MTRDiscoveryRemote.ps1` into the repo from `C:\MTR-Discovery`.
