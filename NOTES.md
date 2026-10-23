# NOTES

Dated log of what was tried on the MTR and the result. Newest first.

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
