Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$AE = [System.Windows.Automation.AutomationElement]
$TF = [System.Windows.Automation.TreeScope]
$PC = [System.Windows.Automation.PropertyCondition]
$NAM = $AE::NameProperty

# Step 1: list ALL desktop children (no filter)
$desktop = $AE::RootElement
$allCond = [System.Windows.Automation.Condition]::TrueCondition
$children = $desktop.FindAll($TF::Children, $allCond)
Write-Output "=== Desktop UIA children ($($children.Count)) ==="
foreach ($child in $children) {
    try {
        $n  = $child.Current.Name
        $id = $child.Current.AutomationId
        $ct = $child.Current.ControlType.ProgrammaticName
        Write-Output "  [$ct] Name='$n' ID='$id'"
    } catch { Write-Output "  <error reading child>" }
}

# Step 2: try to find MTR window and dump ALL descendants (no filter)
$nameCond = New-Object $PC($NAM, "Microsoft Teams Room", [System.Windows.Automation.PropertyConditionFlags]::IgnoreCase)
$mtr = $desktop.FindFirst($TF::Children, $nameCond)

if (-not $mtr) {
    # Try partial match via process list
    $procs = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }
    Write-Output ""
    Write-Output "=== Processes with windows ==="
    foreach ($p in $procs) { Write-Output "  PID=$($p.Id) Proc=$($p.ProcessName) Title='$($p.MainWindowTitle)'" }

    # Try ApplicationFrameHost
    $afh = Get-Process -Name ApplicationFrameHost -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($afh) {
        Write-Output ""
        Write-Output "=== ApplicationFrameHost UIA window (PID $($afh.Id)) ==="
        try {
            $handle = [System.IntPtr]$afh.MainWindowHandle
            $afhElem = $AE::FromHandle($handle)
            if ($afhElem) {
                $all = $afhElem.FindAll($TF::Descendants, $allCond)
                Write-Output "  Total descendants: $($all.Count)"
                foreach ($el in $all) {
                    try {
                        $n  = $el.Current.Name
                        $id = $el.Current.AutomationId
                        $ct = $el.Current.ControlType.ProgrammaticName
                        Write-Output "  [$ct] Name='$n' ID='$id'"
                    } catch {}
                }
            }
        } catch { Write-Output "  Error: $_" }
    }
    Write-Output "MTR window not found by name - see desktop children above"
    exit 0
}

Write-Output ""
Write-Output "=== MTR window found: '$($mtr.Current.Name)' ==="
Write-Output "  ControlType: $($mtr.Current.ControlType.ProgrammaticName)"
Write-Output "  AutomationId: $($mtr.Current.AutomationId)"
Write-Output "  IsEnabled: $($mtr.Current.IsEnabled)"
Write-Output "  IsOffscreen: $($mtr.Current.IsOffscreen)"

# Dump ALL descendants without any filter
$all = $mtr.FindAll($TF::Descendants, $allCond)
Write-Output ""
Write-Output "=== All descendants ($($all.Count) total) ==="
foreach ($el in $all) {
    try {
        $n  = $el.Current.Name
        $id = $el.Current.AutomationId
        $ct = $el.Current.ControlType.ProgrammaticName
        $en = $el.Current.IsEnabled
        $os = $el.Current.IsOffscreen
        Write-Output "  [$ct] Name='$n' ID='$id' Enabled=$en Offscreen=$os"
    } catch { Write-Output "  <error reading element>" }
}

# Also try UIA TreeWalker approach
Write-Output ""
Write-Output "=== TreeWalker first-level children ==="
$walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
try {
    $child1 = $walker.GetFirstChild($mtr)
    $i = 0
    while ($child1 -ne $null -and $i -lt 50) {
        try {
            $n  = $child1.Current.Name
            $ct = $child1.Current.ControlType.ProgrammaticName
            Write-Output "  [$ct] Name='$n'"
        } catch {}
        $child1 = $walker.GetNextSibling($child1)
        $i++
    }
    Write-Output "  ($i children via TreeWalker)"
} catch { Write-Output "  TreeWalker error: $_" }
