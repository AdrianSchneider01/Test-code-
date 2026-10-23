# scripts/New-GmailCredential.ps1
# One-time setup on the central machine: saves the Gmail app password used by
# Send-MTRDailyReport.ps1, encrypted for the current Windows user (DPAPI).
# Enter the 16-character Google APP PASSWORD, not the account password.

param([string]$User = "adrian@busyintegration.com.au")

$path = Join-Path $env:USERPROFILE "gmail-cred.xml"
$cred = Get-Credential -UserName $User -Message "Google app password for $User (16 characters)"
if (-not $cred) { Write-Warning "Cancelled - nothing saved."; return }
$cred | Export-Clixml $path
Write-Host "Saved $path"
