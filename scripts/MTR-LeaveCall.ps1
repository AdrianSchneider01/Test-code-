# scripts/MTR-LeaveCall.ps1
# Runs ON the MTR in the Skype session (via a scheduled task) to recover a room
# left in a call: closes overlay panels, invokes Leave, dismisses the feedback
# prompt, and reports whether the home screen is back. ASCII only (PS 5.1).

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$AE = [System.Windows.Automation.AutomationElement]
$TF = [System.Windows.Automation.TreeScope]
$PC = [System.Windows.Automation.PropertyCondition]

function Get-Button {
    param([string]$Name)
    $cond = New-Object System.Windows.Automation.AndCondition(
        (New-Object $PC($AE::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)),
        (New-Object $PC($AE::NameProperty, $Name)))
    $AE::RootElement.FindFirst($TF::Descendants, $cond)
}

function Invoke-IfPresent {
    param([string]$Name)
    $b = Get-Button $Name
    if ($b -and $b.Current.IsEnabled) {
        $b.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
        "Invoked '$Name'"
        return $true
    }
    return $false
}

Invoke-IfPresent "Close meeting room info" | Out-Null
Start-Sleep -Seconds 1
if (Invoke-IfPresent "Leave") { Start-Sleep -Seconds 10 } else { "No Leave button (not in a call?)" }
if (Invoke-IfPresent "Dismiss") { Start-Sleep -Seconds 3 }
"InCall=$($null -ne (Get-Button 'Leave'))  Home=$($null -ne (Get-Button 'Join with an ID'))"
