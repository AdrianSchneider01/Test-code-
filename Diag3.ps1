Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$AE  = [System.Windows.Automation.AutomationElement]
$TF  = [System.Windows.Automation.TreeScope]
$PC  = [System.Windows.Automation.PropertyCondition]
$NAM = $AE::NameProperty
$allCond = [System.Windows.Automation.Condition]::TrueCondition
$desktop = $AE::RootElement

Write-Output "=== Desktop UIA children ==="
$children = $desktop.FindAll($TF::Children, $allCond)
foreach ($child in $children) {
    try { Write-Output "  [$($child.Current.ControlType.ProgrammaticName)] Name='$($child.Current.Name)'" } catch {}
}

# --- Enumerate ALL desktop children's descendants ---
foreach ($child in $children) {
    try {
        $name = $child.Current.Name
        $all  = $child.FindAll($TF::Descendants, $allCond)
        Write-Output ""
        Write-Output "=== '$name' descendants ($($all.Count) total) ==="
        foreach ($el in $all) {
            try {
                $n  = $el.Current.Name
                $id = $el.Current.AutomationId
                $ct = $el.Current.ControlType.ProgrammaticName
                $en = $el.Current.IsEnabled
                Write-Output "  [$ct] Name='$n' ID='$id' Enabled=$en"
            } catch {}
        }
    } catch { Write-Output "  Error on child '$($child.Current.Name)': $_" }
}

# --- Also try via process handles for known MTR processes ---
Write-Output ""
Write-Output "=== MTR-related processes ==="
$targets = @("ApplicationFrameHost","SkypeHost","Teams","Microsoft.SkypeRoomSystem","Microsoft.Teams")
foreach ($pname in $targets) {
    $procs = Get-Process -Name $pname -ErrorAction SilentlyContinue
    foreach ($proc in $procs) {
        Write-Output "  PROC: $($proc.ProcessName) PID=$($proc.Id) Handle=$($proc.MainWindowHandle) Title='$($proc.MainWindowTitle)'"
        if ($proc.MainWindowHandle -ne 0) {
            try {
                $elem = $AE::FromHandle([System.IntPtr]$proc.MainWindowHandle)
                $all  = $elem.FindAll($TF::Descendants, $allCond)
                Write-Output "    -> UIA descendants: $($all.Count)"
                foreach ($el in $all) {
                    try {
                        $n  = $el.Current.Name
                        $id = $el.Current.AutomationId
                        $ct = $el.Current.ControlType.ProgrammaticName
                        if ($n -or $id) { Write-Output "    [$ct] Name='$n' ID='$id'" }
                    } catch {}
                }
            } catch { Write-Output "    -> UIA error: $_" }
        }
    }
}

# --- Try getting the 'Microsoft Teams' Pane by exact name and walk it ---
Write-Output ""
Write-Output "=== TreeWalker on 'Microsoft Teams' pane ==="
$nameCond = New-Object $PC($NAM, "Microsoft Teams", [System.Windows.Automation.PropertyConditionFlags]::IgnoreCase)
$teamsPane = $desktop.FindFirst($TF::Children, $nameCond)
if ($teamsPane) {
    Write-Output "Found pane. Walking with RawViewWalker..."
    $walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
    function Walk-Tree($el, $depth) {
        if ($depth -gt 8) { return }
        try {
            $n  = $el.Current.Name
            $id = $el.Current.AutomationId
            $ct = $el.Current.ControlType.ProgrammaticName
            $pad = "  " * $depth
            Write-Output "${pad}[$ct] Name='$n' ID='$id'"
        } catch {}
        try {
            $c = $walker.GetFirstChild($el)
            while ($c) {
                Walk-Tree $c ($depth + 1)
                $c = $walker.GetNextSibling($c)
            }
        } catch {}
    }
    Walk-Tree $teamsPane 0
} else {
    Write-Output "'Microsoft Teams' pane not found on this run."
}
