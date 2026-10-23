# MTR Automation Project

## Goal
Automate daily health checks and remote test calls on Microsoft Teams Rooms (Crestron CCS400), replacing manual AnyDesk checks.

## Environment
- Admin laptop: LAPTOP-BH7KAQA3
- Test MTR: C4-54B20393935E (192.168.1.209), Crestron CCS400
- Remote access: WinRM, Basic auth, local account .\Admin
- Credential: load with `Import-Clixml $env:USERPROFILE\mtr-cred.xml` (never hardcode passwords)
- MTR state/logs: `C:\Users\Skype\AppData\Local\Packages\Microsoft.SkypeRoomSystem_8wekyb3d8bbwe\LocalState\`
- Source of truth for config/state: SkypeSettings.xml and HealthState.xml

## Existing scripts
- `MTR-RunTestCall.ps1`: orchestrates a full test call from the laptop — connects to MTR via PS remoting, deploys scripts, triggers scheduled task, runs camera check, polls for result
- `Check-CameraFeed.py`: Playwright observer that joins the AV test meeting as a silent guest and confirms the MTR's camera feed is live via DOM video element detection
- `Diag9.ps1`: runs ON the MTR (via MTRTestCallTemp scheduled task); uses UI Automation to click Join, polls for and admits lobby participants, checks in-call hardware state, leaves the call, writes `C:\MTR\TestCallResult.json`
- `MTR-InjectUIAutomation.ps1`: SYSTEM-level helper that bridges Session 0 → Skype session; used for cross-session UIA injection (kept for reference — see known facts below)
- `MTR-TestCallHelper.ps1`: UIA join/leave helper spawned in the Skype session (kept for reference)
- `scripts/Invoke-MTRTest.ps1`: deploys a script as the launch hook, restarts the MTR, polls for `-DoneFile`, fetches `-FetchFiles` into `results\`, `-Cleanup` removes the hook
- `MTR-RunTestCall.ps1` also saves Diag9's output to `C:\MTR\Diag9-log.txt` on the MTR and prints it
- `scripts/Diagnose-MTRTask.ps1`: checks the MTRTestCallTemp task config and session context, then runs a UIA probe in that session
- `MTR-UIDiscovery.ps1`: launch-hook script that starts the real Launch.ps1, waits for the home screen, then dumps all UI Automation elements (plus Join button candidates) to `C:\Users\Skype\UIElements.txt`
- `Run-MTRDiscoveryRemote.ps1`: original menu-driven deploy/fetch/restore for UI discovery. Interactive (Get-Credential, Read-Host), so kept for reference only; use `scripts\Invoke-MTRTest.ps1` instead
- Not in this repo yet: `MTR-HealthCheck.ps1` (daily 7am health check email) and `Setup-MTRHealthCheckTask.ps1`

## Known facts (don't retry failed approaches)
- Code that needs the Teams UI runs in the Skype session (session 1), either via the MTRTestCallInteractive task (LogonType=Interactive, user Skype) or as `C:\Rigel\AdminHookScripts\Launch.ps1`.
- A hook `Launch.ps1` REPLACES the real `C:\Users\Skype\ScriptLaunchCache\Launch.ps1`. It must start the real one itself (background) and never exit, or Teams Rooms won't load. Remove the hook after testing (`Invoke-MTRTest.ps1 -Cleanup`).
- Teams Rooms UI is WebView2: buttons have NO AutomationId and generated class names. Match ControlType=Button + exact Name. Home tiles also have a Text element with the same Name.
- After Leave, a post-call feedback prompt (Had issues / Good / Dismiss) covers the home screen; invoke "Dismiss".
- The MTR must join by meeting ID (Diag9 `-JoinMode Id`, default), not the calendar tile, so it is in the same meeting as the observer. "Join with an ID" opens a provider picker first (click "teams"); type into the fields with SendKeys (ValuePattern.SetValue leaves "Join Teams meeting" disabled).
- Teams web lobby text is "Someone will let you in shortly/when the meeting starts"; `[data-tid='hangup-button']` no longer exists (use the "Leave" button role).
- Every .ps1 deployed to the MTR must be ASCII-only (no em-dashes, box-drawing chars, check marks). PS 5.1 reads BOM-less UTF-8 as ANSI and the script fails to parse.
- `LocalState\Logs.txt` does not exist on this Teams Rooms build.
- Cross-session injection via WTSQueryUserToken FAILS. Shell Launcher kills the process.
- WinRM only works with Basic auth plus `.\Admin`. NTLM failed.
- `[data-tid='toggle-video']` in Teams pre-join is an INPUT[role=switch]; checking `.checked` via JS is unreliable — check "Your camera is turned off" UI text or aria-label containing "not available" instead.
- Teams observer must join with `permissions=["microphone"]` only (no camera), otherwise local camera stream causes false-positive LIVE detection.
- The AV test meeting URL: `https://teams.microsoft.com/_#/meet/497737059187682?p=NnqALr74DBIi2oFvDT&anon=true`
- MTR scheduled task: MTRTestCallTemp, runs Diag9.ps1 in the Skype session via PS remoting trigger

## How to work
- Test changes yourself with `scripts\Invoke-MTRTest.ps1`. Don't ask Adrian to run them.
- After each test, read the returned logs and fix things before reporting back.
- Ask before rebooting the MTR outside the test script, or changing Shell Launcher.
- Keep a dated log of what was tried and the result in NOTES.md.
- Use Git: commit after every change that passes a test, with a clear message. If a change breaks something, roll back to the last working commit. Never commit `mtr-cred.xml` or the `results/` folder.
- PowerShell 5.1 compatible (MTR runs Windows IoT).
- NEVER use `Enter-PSSession` or any interactive/prompting command. It will hang. Use `Invoke-Command`, `New-PSSession` with `Copy-Item`, or `scripts\Invoke-MTRTest.ps1`. Every command must run and return.
- Connection check: `Invoke-Command -ComputerName 192.168.1.209 -Credential (Import-Clixml $env:USERPROFILE\mtr-cred.xml) -Authentication Basic { hostname }`

## Definition of done: test call
1. The script joins a scheduled test meeting without manual input.
2. The log confirms the join (UI state or Logs.txt entry).
3. The MTR-Observer is admitted from the lobby automatically (Diag9 polls for admit buttons).
4. The camera check reports CAMERA LIVE ✓.
5. It leaves the call after N seconds, and the room returns to the home screen.
6. It passes 3 runs in a row.
7. The result is added to the daily health check email.
