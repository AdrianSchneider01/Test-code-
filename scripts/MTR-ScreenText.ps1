# scripts/MTR-ScreenText.ps1
# Runs ON the MTR in the Skype session (via a scheduled task): lists the text and
# button names on the Teams Rooms screen, e.g. to see what is on the room's
# calendar. Read-only. ASCII only (PS 5.1).

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$AE = [System.Windows.Automation.AutomationElement]
$TF = [System.Windows.Automation.TreeScope]
$PC = [System.Windows.Automation.PropertyCondition]

foreach ($type in @("Text", "Button")) {
    "=== $type"
    $ct = [System.Windows.Automation.ControlType]::$type
    foreach ($e in $AE::RootElement.FindAll($TF::Descendants, (New-Object $PC($AE::ControlTypeProperty, $ct)))) {
        try { if ($e.Current.Name.Trim()) { "  $($e.Current.Name)" } } catch {}
    }
}
