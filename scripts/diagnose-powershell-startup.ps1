# PowerShell Startup Performance Diagnostics
# =========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " PowerShell Startup Diagnostics" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check profile file size and syntax
Write-Host "[1/8] Checking profile file..." -ForegroundColor Yellow
$profilePath = $PROFILE
if (Test-Path $profilePath) {
    $profileSize = (Get-Item $profilePath).Length
    Write-Host "  Profile exists: $profilePath" -ForegroundColor Green
    Write-Host "  Profile size: $([math]::Round($profileSize/1KB, 2)) KB" -ForegroundColor Gray
    
    # Test profile syntax
    try {
        $profileContent = Get-Content $profilePath -Raw -ErrorAction Stop
        $null = [System.Management.Automation.PSParser]::Tokenize($profileContent, [ref]$null)
        Write-Host "  Syntax check: PASSED" -ForegroundColor Green
    } catch {
        Write-Host "  Syntax check: FAILED - $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  No profile found" -ForegroundColor Gray
}
Write-Host ""

# 2. Check loaded modules
Write-Host "[2/8] Checking loaded modules..." -ForegroundColor Yellow
$modules = Get-Module
Write-Host "  Loaded modules: $($modules.Count)" -ForegroundColor Gray
$largeModules = $modules | Where-Object { $_.ExportedCommands.Count -gt 100 }
if ($largeModules) {
    Write-Host "  Large modules (>100 commands):" -ForegroundColor Yellow
    foreach ($module in $largeModules) {
        Write-Host "    $($module.Name) - $($module.ExportedCommands.Count) commands" -ForegroundColor Gray
    }
} else {
    Write-Host "  No unusually large modules found" -ForegroundColor Green
}
Write-Host ""

# 3. Check PSReadLine configuration
Write-Host "[3/8] Checking PSReadLine..." -ForegroundColor Yellow
try {
    $psReadLine = Get-Module PSReadLine
    if ($psReadLine) {
        Write-Host "  PSReadLine version: $($psReadLine.Version)" -ForegroundColor Gray
        
        # Check history file
        $historyPath = (Get-PSReadLineOption).HistorySavePath
        if (Test-Path $historyPath) {
            $historySize = (Get-Item $historyPath).Length
            Write-Host "  History file size: $([math]::Round($historySize/1KB, 2)) KB" -ForegroundColor Gray
            if ($historySize -gt 1MB) {
                Write-Host "  WARNING: Large history file may slow startup" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "  PSReadLine not loaded" -ForegroundColor Gray
    }
} catch {
    Write-Host "  PSReadLine check failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 4. Check execution policy
Write-Host "[4/8] Checking execution policy..." -ForegroundColor Yellow
$executionPolicy = Get-ExecutionPolicy
Write-Host "  Current policy: $executionPolicy" -ForegroundColor Gray
if ($executionPolicy -eq "Restricted") {
    Write-Host "  WARNING: Restricted policy may cause delays" -ForegroundColor Yellow
}
Write-Host ""

# 5. Check Windows Defender exclusions
Write-Host "[5/8] Checking Windows Defender..." -ForegroundColor Yellow
try {
    $defenderPrefs = Get-MpPreference -ErrorAction SilentlyContinue
    if ($defenderPrefs) {
        $excludedPaths = $defenderPrefs.ExclusionPath
        $powershellPath = (Get-Command powershell).Source
        $powershellDir = Split-Path $powershellPath -Parent
        
        $isExcluded = $excludedPaths | Where-Object { $powershellDir.StartsWith($_, "CurrentCultureIgnoreCase") }
        if ($isExcluded) {
            Write-Host "  PowerShell directory is excluded from scanning" -ForegroundColor Green
        } else {
            Write-Host "  PowerShell not excluded - may cause startup delays" -ForegroundColor Yellow
            Write-Host "  Suggestion: Add PowerShell directory to exclusions" -ForegroundColor Gray
        }
    } else {
        Write-Host "  Could not check Defender settings" -ForegroundColor Gray
    }
} catch {
    Write-Host "  Defender check failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 6. Check startup programs and services
Write-Host "[6/8] Checking startup impact..." -ForegroundColor Yellow
try {
    # Check CPU usage
    $cpu = Get-WmiObject -Class Win32_Processor | Measure-Object -Property LoadPercentage -Average
    Write-Host "  Current CPU usage: $([math]::Round($cpu.Average, 1))%" -ForegroundColor Gray
    
    # Check memory usage
    $memory = Get-WmiObject -Class Win32_OperatingSystem
    $memoryUsage = [math]::Round(($memory.TotalVisibleMemorySize - $memory.FreePhysicalMemory) / $memory.TotalVisibleMemorySize * 100, 1)
    Write-Host "  Memory usage: $memoryUsage%" -ForegroundColor Gray
    
    if ($cpu.Average -gt 80) {
        Write-Host "  WARNING: High CPU usage may affect startup" -ForegroundColor Yellow
    }
    if ($memoryUsage -gt 85) {
        Write-Host "  WARNING: High memory usage may affect startup" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  System resource check failed" -ForegroundColor Red
}
Write-Host ""

# 7. Check PowerShell version and host
Write-Host "[7/8] Checking PowerShell environment..." -ForegroundColor Yellow
Write-Host "  PowerShell version: $($PSVersionTable.PSVersion)" -ForegroundColor Gray
Write-Host "  Host: $($Host.Name)" -ForegroundColor Gray
Write-Host "  .NET version: $($PSVersionTable.CLRVersion)" -ForegroundColor Gray
if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Host "  WARNING: Old PowerShell version may be slower" -ForegroundColor Yellow
}
Write-Host ""

# 8. Performance test - measure profile loading time
Write-Host "[8/8] Performance test..." -ForegroundColor Yellow
if (Test-Path $profilePath) {
    Write-Host "  Testing profile load time..." -ForegroundColor Gray
    
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        # Simulate loading the profile
        . $profilePath
        $stopwatch.Stop()
        $loadTime = $stopwatch.ElapsedMilliseconds
        Write-Host "  Profile load time: ${loadTime}ms" -ForegroundColor $(if ($loadTime -gt 2000) { "Red" } elseif ($loadTime -gt 1000) { "Yellow" } else { "Green" })
        
        if ($loadTime -gt 2000) {
            Write-Host "  SLOW: Profile takes too long to load" -ForegroundColor Red
        } elseif ($loadTime -gt 1000) {
            Write-Host "  MODERATE: Profile load time could be improved" -ForegroundColor Yellow
        } else {
            Write-Host "  GOOD: Profile loads quickly" -ForegroundColor Green
        }
    } catch {
        $stopwatch.Stop()
        Write-Host "  Profile load failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  No profile to test" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Diagnostic Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Recommendations
Write-Host "Recommendations:" -ForegroundColor Yellow
Write-Host ""

# Profile-related recommendations
if (Test-Path $profilePath) {
    $profileSize = (Get-Item $profilePath).Length
    if ($profileSize -gt 50KB) {
        Write-Host "• Consider optimizing your profile file (currently $([math]::Round($profileSize/1KB, 2)) KB)" -ForegroundColor White
    }
}

# PSReadLine recommendations
try {
    $historyPath = (Get-PSReadLineOption).HistorySavePath
    if (Test-Path $historyPath) {
        $historySize = (Get-Item $historyPath).Length
        if ($historySize -gt 1MB) {
            Write-Host "• Clear PowerShell history: Remove-Item '$historyPath'" -ForegroundColor White
        }
    }
} catch { }

# Defender recommendations
Write-Host "• Add PowerShell to Windows Defender exclusions:" -ForegroundColor White
Write-Host "  - Open Windows Security > Virus & threat protection > Exclusions" -ForegroundColor Gray
Write-Host "  - Add folder: C:\Windows\System32\WindowsPowerShell" -ForegroundColor Gray

# Module recommendations
$modules = Get-Module
if ($modules.Count -gt 10) {
    Write-Host "• Consider using Import-Module only when needed in your profile" -ForegroundColor White
}

Write-Host "• Use 'powershell -NoProfile' to test startup without profile" -ForegroundColor White
Write-Host "• Use 'Measure-Command { powershell -Command \"exit\" }' to test startup time" -ForegroundColor White

Write-Host ""
Write-Host "Run this diagnostic again after making changes to measure improvement." -ForegroundColor Green
Write-Host ""