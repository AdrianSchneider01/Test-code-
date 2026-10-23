# NOTES

Dated log of what was tried on the MTR and the result. Newest first.

## 2026-10-23
- Connection check passed: `Invoke-Command` with Basic auth and `mtr-cred.xml` returned `C4-54B20393935E` (Windows 10 Enterprise).
- On the MTR: `C:\Rigel\AdminHookScripts` exists but is empty (no `Launch.ps1` hook deployed). `C:\Users\Skype\ScriptLaunchCache\Launch.ps1` exists.
- Copied `MTR-UIDiscovery.ps1` and `Run-MTRDiscoveryRemote.ps1` into the repo from `C:\MTR-Discovery`.
