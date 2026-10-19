# Diag6 - deep-link / URI approach to trigger Teams join in Session 1
# Runs inside Session 1 (Skype) via MTR-InjectUIAutomation.ps1

param(
    [string]$JoinUrl    = "https://teams.microsoft.com/meet/497737059187682?p=NnqALr74DBIi2oFvDT",
    [string]$ResultFile = "C:\MTR\TestCallResult.json"
)

function Write-Log { param([string]$m,[string]$l="INFO"); Write-Host "[$(Get-Date -f 'HH:mm:ss')][$l] $m" }

Write-Log "Diag6 started - URI deep-link approach"
Write-Log "URL: $JoinUrl"

# --- Show registered protocol handlers ---
Write-Log "=== Protocol handlers ==="
foreach ($proto in @("msteams","ms-teams","https")) {
    try {
        $key  = "HKCU:\SOFTWARE\Microsoft\Windows\Shell\Associations\UrlAssociations\$proto\UserChoice"
        $prog = (Get-ItemProperty $key -ErrorAction SilentlyContinue).ProgId
        if ($prog) { Write-Log "  HKCU $proto -> $prog" }
    } catch {}
}
foreach ($proto in @("msteams","ms-teams","https")) {
    try {
        $cmd = (Get-ItemProperty "Registry::HKEY_CLASSES_ROOT\$proto\shell\open\command" -ErrorAction SilentlyContinue).'(default)'
        if ($cmd) { Write-Log "  HKCR $proto -> $cmd" }
    } catch {}
}

# --- Snapshot processes before ---
Write-Log "=== Processes with windows (before) ==="
Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | ForEach-Object {
    Write-Log "  PID=$($_.Id) $($_.ProcessName) '$($_.MainWindowTitle)'"
}

# --- Load UIA ---
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$AE      = [System.Windows.Automation.AutomationElement]
$TF      = [System.Windows.Automation.TreeScope]
$PC      = [System.Windows.Automation.PropertyCondition]
$NAM     = $AE::NameProperty
$allCond = [System.Windows.Automation.Condition]::TrueCondition

function Dump-UIA {
    param([string]$Label)
    $desktop  = $AE::RootElement
    $children = $desktop.FindAll($TF::Children, $allCond)
    Write-Log "=== UIA desktop children [$Label] ($($children.Count)) ==="
    foreach ($child in $children) {
        try {
            $n  = $child.Current.Name
            $ct = $child.Current.ControlType.ProgrammaticName
            $all = $child.FindAll($TF::Descendants, $allCond)
            Write-Log "  [$ct] Name='$n' descendants=$($all.Count)"
            # Dump named/IDed descendants
            foreach ($el in $all) {
                try {
                    $en  = $el.Current.Name
                    $eid = $el.Current.AutomationId
                    $ect = $el.Current.ControlType.ProgrammaticName
                    if ($en -or $eid) { Write-Log "    [$ect] Name='$en' ID='$eid'" }
                } catch {}
            }
        } catch {}
    }
}

Dump-UIA "before"

# --- Try msteams:// URI ---
$msteamsUrl = $JoinUrl -replace "^https://teams\.microsoft\.com", "msteams://"
Write-Log "Opening msteams:// URI..."
try {
    Start-Process $msteamsUrl -ErrorAction Stop
    Write-Log "  Launched OK"
} catch {
    Write-Log "  msteams:// failed: $_" "WARN"
    # Fallback: shell execute the https URL
    Write-Log "  Trying https URL via shell..."
    try { Start-Process $JoinUrl; Write-Log "  https URL launched" } catch { Write-Log "  https also failed: $_" "WARN" }
}

Write-Log "Waiting 20s for Teams to respond..."
Start-Sleep -Seconds 20

Dump-UIA "after 20s"

Write-Log "Waiting another 15s..."
Start-Sleep -Seconds 15

Dump-UIA "after 35s"

Write-Log "=== Processes with windows (after) ==="
Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | ForEach-Object {
    Write-Log "  PID=$($_.Id) $($_.ProcessName) '$($_.MainWindowTitle)'"
}

Write-Log "Diag6 done."
