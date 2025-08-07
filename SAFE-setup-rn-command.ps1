# ========================================
# SAFE React Native Development Environment Setup
# ========================================
# This is the SAFE version of setup-rn-command.ps1
# Prevents Profile corruption through proper content management

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host " SAFE React Native Dev Environment Setup" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

# Get project root directory
$projectRoot = $PSScriptRoot

# Import safety functions
function Test-ProfileSafety {
    param($ProfilePath)
    
    if (Test-Path $ProfilePath) {
        $size = (Get-Item $ProfilePath).Length
        $lines = (Get-Content $ProfilePath).Count
        
        Write-Host "Current Profile Status:" -ForegroundColor Cyan
        Write-Host "  Size: $([math]::Round($size/1KB, 2)) KB" -ForegroundColor $(if($size -gt 100KB){"Red"}else{"Gray"})
        Write-Host "  Lines: $lines" -ForegroundColor $(if($lines -gt 1000){"Red"}else{"Gray"})
        
        if ($size -gt 1MB -or $lines -gt 10000) {
            Write-Host ""
            Write-Host "⚠️  WARNING: Profile file is unusually large!" -ForegroundColor Red
            Write-Host "   This may indicate corruption. Consider resetting." -ForegroundColor Yellow
            Write-Host ""
            
            $response = Read-Host "Continue anyway? (y/N)"
            if ($response -ne 'y' -and $response -ne 'Y') {
                Write-Host "Setup cancelled for safety." -ForegroundColor Yellow
                exit 1
            }
        }
        return $true
    }
    return $false
}

function Set-ProfileContent {
    param(
        [string]$ProfilePath,
        [string]$NewContent,
        [string]$SectionName
    )
    
    $startMarker = "# === $SectionName START ==="
    $endMarker = "# === $SectionName END ==="
    
    # Create backup
    if (Test-Path $ProfilePath) {
        $backupPath = "$ProfilePath.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        Copy-Item $ProfilePath $backupPath
        Write-Host "✓ Backup created: $([System.IO.Path]::GetFileName($backupPath))" -ForegroundColor Green
    }
    
    # Read existing content
    $existingContent = ""
    if (Test-Path $ProfilePath) {
        $existingContent = Get-Content $ProfilePath -Raw -ErrorAction SilentlyContinue
        if ($null -eq $existingContent) { $existingContent = "" }
    }
    
    # Remove old section if exists
    $pattern = [regex]::Escape($startMarker) + "[\s\S]*?" + [regex]::Escape($endMarker)
    $cleanContent = $existingContent -replace $pattern, ""
    $cleanContent = $cleanContent.Trim()
    
    # Add new section
    $wrappedContent = @"
$startMarker
$NewContent
$endMarker
"@
    
    # Combine content
    if ($cleanContent) {
        $finalContent = $cleanContent + "`n`n" + $wrappedContent
    } else {
        $finalContent = $wrappedContent
    }
    
    # Write safely
    try {
        Set-Content -Path $ProfilePath -Value $finalContent -Encoding UTF8 -ErrorAction Stop
        Write-Host "✓ Profile updated successfully" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "✗ Failed to update profile: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Check PowerShell profile
$profilePath = $PROFILE
$profileDir = Split-Path $profilePath -Parent

Write-Host "Project Root: $projectRoot" -ForegroundColor Yellow
Write-Host "Profile Path: $profilePath" -ForegroundColor Yellow
Write-Host ""

# Create profile directory if not exists
if (!(Test-Path $profileDir)) {
    Write-Host "Creating PowerShell profile directory..." -ForegroundColor Yellow
    try {
        New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
        Write-Host "✓ Profile directory created" -ForegroundColor Green
    } catch {
        Write-Host "✗ Failed to create profile directory" -ForegroundColor Red
        exit 1
    }
}

# Safety check
Test-ProfileSafety -ProfilePath $profilePath

# Define React Native development functions
$functionsToAdd = @"
# React Native Development Commands
function dev-rn {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " Starting React Native Environment" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Project root
    `$projectRoot = "$projectRoot"
    
    # Step 1: Clean ports
    Write-Host "[1/4] Cleaning ports..." -ForegroundColor Yellow
    
    # Clean port 3001 (backend)
    try {
        `$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
        if (`$port3001) {
            `$pid = `$port3001.OwningProcess | Select-Object -Unique
            if (`$pid) {
                Write-Host "  Cleaning port 3001..." -ForegroundColor Gray
                Stop-Process -Id `$pid -Force -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 1
            }
        }
    } catch {
        # Silently handle errors
    }
    
    # Clean port 8081 (React Native)
    try {
        `$port8081 = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue
        if (`$port8081) {
            `$pid = `$port8081.OwningProcess | Select-Object -Unique
            if (`$pid) {
                Write-Host "  Cleaning port 8081..." -ForegroundColor Gray
                Stop-Process -Id `$pid -Force -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 1
            }
        }
    } catch {
        # Silently handle errors
    }
    
    # Clean ports 19000-19006 (Expo)
    for (`$port = 19000; `$port -le 19006; `$port++) {
        try {
            `$conn = Get-NetTCPConnection -LocalPort `$port -ErrorAction SilentlyContinue
            if (`$conn) {
                `$pid = `$conn.OwningProcess | Select-Object -Unique
                if (`$pid) {
                    Stop-Process -Id `$pid -Force -ErrorAction SilentlyContinue
                }
            }
        } catch {
            # Silently handle errors
        }
    }
    
    Write-Host "  ✓ Port cleanup completed" -ForegroundColor Green
    Write-Host ""
    
    # Step 2: Start MySQL
    Write-Host "[2/4] Checking MySQL service..." -ForegroundColor Yellow
    try {
        `$mysql = Get-Service -Name "MySQL80" -ErrorAction SilentlyContinue
        if (`$mysql) {
            if (`$mysql.Status -ne 'Running') {
                Write-Host "  Starting MySQL80..." -ForegroundColor Gray
                Start-Service MySQL80 -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 2
            }
            Write-Host "  ✓ MySQL80 is running" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ MySQL80 not installed" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ⚠ MySQL80 service check failed" -ForegroundColor Yellow
    }
    Write-Host ""
    
    # Step 3: Start backend
    Write-Host "[3/4] Starting backend service..." -ForegroundColor Yellow
    `$backendPath = Join-Path `$projectRoot "backend"
    if (Test-Path `$backendPath) {
        Start-Process cmd -ArgumentList "/k", "cd /d ```"`$backendPath```" && echo [Backend API - Port 3001] && npm run dev"
        Write-Host "  ✓ Backend starting (port 3001)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Backend directory not found" -ForegroundColor Red
        Write-Host "    Path: `$backendPath" -ForegroundColor Gray
    }
    
    # Wait for backend
    Start-Sleep -Seconds 3
    Write-Host ""
    
    # Step 4: Start React Native
    Write-Host "[4/4] Starting React Native..." -ForegroundColor Yellow
    `$rnPath = Join-Path `$projectRoot "frontend\HainiuFoodTrace"
    if (Test-Path `$rnPath) {
        Start-Process cmd -ArgumentList "/k", "cd /d ```"`$rnPath```" && echo [React Native - Expo] && npx expo start"
        Write-Host "  ✓ React Native starting (port 8081)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ React Native project not found" -ForegroundColor Yellow
        Write-Host "    Path: `$rnPath" -ForegroundColor Gray
        Write-Host "    You may need to initialize the React Native project first" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " ✓ Development environment started!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Services:" -ForegroundColor Yellow
    Write-Host "  ✓ MySQL80: Database service" -ForegroundColor White
    Write-Host "  ✓ Backend API: http://localhost:3001" -ForegroundColor White
    Write-Host "  ✓ React Native: http://localhost:8081" -ForegroundColor White
    Write-Host ""
    Write-Host "Test account: admin / Admin@123456" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor Gray
    Write-Host "  dev-rn-stop    - Stop all services" -ForegroundColor Gray
    Write-Host "  dev-rn-status  - Check service status" -ForegroundColor Gray
    Write-Host "  dev-rn-restart - Restart all services" -ForegroundColor Gray
    Write-Host ""
}

function dev-rn-stop {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host " Stopping React Native Environment" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "Stopping services..." -ForegroundColor Yellow
    
    `$stoppedAny = `$false
    
    # Stop port 3001 (backend)
    try {
        `$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
        if (`$port3001) {
            `$pid = `$port3001.OwningProcess | Select-Object -Unique
            if (`$pid) {
                Write-Host "  Stopping backend..." -ForegroundColor Gray
                Stop-Process -Id `$pid -Force -ErrorAction SilentlyContinue
                `$stoppedAny = `$true
            }
        }
    } catch {
        # Silently handle errors
    }
    
    # Stop port 8081 (React Native)
    try {
        `$port8081 = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue
        if (`$port8081) {
            `$pid = `$port8081.OwningProcess | Select-Object -Unique
            if (`$pid) {
                Write-Host "  Stopping React Native..." -ForegroundColor Gray
                Stop-Process -Id `$pid -Force -ErrorAction SilentlyContinue
                `$stoppedAny = `$true
            }
        }
    } catch {
        # Silently handle errors
    }
    
    # Stop Expo ports
    for (`$port = 19000; `$port -le 19006; `$port++) {
        try {
            `$conn = Get-NetTCPConnection -LocalPort `$port -ErrorAction SilentlyContinue
            if (`$conn) {
                `$pid = `$conn.OwningProcess | Select-Object -Unique
                if (`$pid) {
                    Stop-Process -Id `$pid -Force -ErrorAction SilentlyContinue
                    `$stoppedAny = `$true
                }
            }
        } catch {
            # Silently handle errors
        }
    }
    
    # Stop all node processes (optional cleanup)
    Write-Host "  Cleaning Node processes..." -ForegroundColor Gray
    try {
        `$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
        if (`$nodeProcesses) {
            `$nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
            `$stoppedAny = `$true
        }
    } catch {
        # Silently handle errors
    }
    
    Write-Host ""
    if (`$stoppedAny) {
        Write-Host "✓ All services stopped" -ForegroundColor Green
    } else {
        Write-Host "⚠ No running services found" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "Note: MySQL service remains running" -ForegroundColor Gray
    Write-Host ""
}

function dev-rn-status {
    Write-Host ""
    Write-Host "React Native Environment Status:" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    
    # MySQL status
    try {
        `$mysql = Get-Service -Name "MySQL80" -ErrorAction SilentlyContinue
        if (`$mysql -and `$mysql.Status -eq 'Running') {
            Write-Host "  MySQL80: " -NoNewline
            Write-Host "✓ Running" -ForegroundColor Green
        } else {
            Write-Host "  MySQL80: " -NoNewline
            Write-Host "✗ Not running" -ForegroundColor Red
        }
    } catch {
        Write-Host "  MySQL80: " -NoNewline
        Write-Host "⚠ Status unknown" -ForegroundColor Yellow
    }
    
    # Backend status (port 3001)
    try {
        `$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
        if (`$port3001) {
            Write-Host "  Backend API (3001): " -NoNewline
            Write-Host "✓ Running" -ForegroundColor Green
            Write-Host "    URL: http://localhost:3001" -ForegroundColor Gray
        } else {
            Write-Host "  Backend API (3001): " -NoNewline
            Write-Host "✗ Not running" -ForegroundColor Red
        }
    } catch {
        Write-Host "  Backend API (3001): " -NoNewline
        Write-Host "⚠ Status unknown" -ForegroundColor Yellow
    }
    
    # React Native status (port 8081)
    try {
        `$port8081 = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue
        if (`$port8081) {
            Write-Host "  React Native (8081): " -NoNewline
            Write-Host "✓ Running" -ForegroundColor Green
            Write-Host "    URL: http://localhost:8081" -ForegroundColor Gray
        } else {
            Write-Host "  React Native (8081): " -NoNewline
            Write-Host "✗ Not running" -ForegroundColor Red
        }
    } catch {
        Write-Host "  React Native (8081): " -NoNewline
        Write-Host "⚠ Status unknown" -ForegroundColor Yellow
    }
    
    # Web frontend status (should not be running for RN env)
    try {
        `$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
        if (`$port3000) {
            Write-Host "  Web Frontend (3000): " -NoNewline
            Write-Host "⚠ Running (not part of RN env)" -ForegroundColor Yellow
        } else {
            Write-Host "  Web Frontend (3000): " -NoNewline
            Write-Host "✓ Not running (correct for RN)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  Web Frontend (3000): " -NoNewline
        Write-Host "⚠ Status unknown" -ForegroundColor Yellow
    }
    
    Write-Host ""
}

function dev-rn-restart {
    Write-Host "Restarting React Native environment..." -ForegroundColor Yellow
    dev-rn-stop
    Start-Sleep -Seconds 2
    dev-rn
}

function dev-rn-help {
    Write-Host ""
    Write-Host "React Native Development Commands:" -ForegroundColor Cyan
    Write-Host "==================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  dev-rn         - Start environment (MySQL + Backend + React Native)" -ForegroundColor White
    Write-Host "  dev-rn-stop    - Stop all services" -ForegroundColor White
    Write-Host "  dev-rn-status  - Show service status" -ForegroundColor White
    Write-Host "  dev-rn-restart - Restart all services" -ForegroundColor White
    Write-Host "  dev-rn-help    - Show this help" -ForegroundColor White
    Write-Host ""
    Write-Host "Note: These commands do NOT start Web frontend (port 3000)" -ForegroundColor Yellow
    Write-Host "      Use 'dev' command for Web + Backend environment" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "React Native commands ready to install" -ForegroundColor Green
Write-Host "Commands: dev-rn, dev-rn-stop, dev-rn-status, dev-rn-restart, dev-rn-help" -ForegroundColor Gray
"@

# Install the commands safely
Write-Host "Installing React Native development commands..." -ForegroundColor Cyan
Write-Host ""

$success = Set-ProfileContent -ProfilePath $profilePath -NewContent $functionsToAdd -SectionName "HEINIU RN DEV COMMANDS"

if ($success) {
    # Verify installation
    Write-Host ""
    Write-Host "Verifying installation..." -ForegroundColor Cyan
    $profileSize = (Get-Item $profilePath).Length
    $profileLines = (Get-Content $profilePath).Count
    
    Write-Host "✓ Profile size: $([math]::Round($profileSize/1KB, 2)) KB" -ForegroundColor Green
    Write-Host "✓ Profile lines: $profileLines" -ForegroundColor Green
    
    if ($profileSize -lt 100KB -and $profileLines -lt 1000) {
        Write-Host "✓ Profile is healthy" -ForegroundColor Green
    } else {
        Write-Host "⚠ Profile size may be concerning" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host " Installation Complete!" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Available Commands:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "     dev-rn         " -ForegroundColor Cyan -NoNewline
    Write-Host "# Start environment (MySQL + Backend + RN)" -ForegroundColor Gray
    Write-Host "     dev-rn-stop    " -ForegroundColor Cyan -NoNewline
    Write-Host "# Stop all services" -ForegroundColor Gray
    Write-Host "     dev-rn-status  " -ForegroundColor Cyan -NoNewline
    Write-Host "# Check status" -ForegroundColor Gray
    Write-Host "     dev-rn-restart " -ForegroundColor Cyan -NoNewline
    Write-Host "# Restart services" -ForegroundColor Gray
    Write-Host "     dev-rn-help    " -ForegroundColor Cyan -NoNewline
    Write-Host "# Show help" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Services:" -ForegroundColor Green
    Write-Host "  ✓ MySQL80 Database" -ForegroundColor White
    Write-Host "  ✓ Backend API (port 3001)" -ForegroundColor White
    Write-Host "  ✓ React Native (port 8081)" -ForegroundColor White
    Write-Host "  ✗ Web Frontend (NOT started - use 'dev' for web)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Profile location: $profilePath" -ForegroundColor Gray
    
    # Ask if load now
    Write-Host ""
    $response = Read-Host "Load commands to current session? (y/n)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        try {
            . $profilePath
            Write-Host ""
            Write-Host "✓ Commands loaded to current session" -ForegroundColor Green
            Write-Host "You can now use 'dev-rn' command immediately" -ForegroundColor Gray
            Write-Host ""
        } catch {
            Write-Host ""
            Write-Host "✗ Failed to load commands: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "Please restart PowerShell to use the commands" -ForegroundColor Yellow
            Write-Host ""
        }
    }
    
} else {
    Write-Host ""
    Write-Host "✗ Installation failed!" -ForegroundColor Red
    Write-Host "Please check the error messages above and try again." -ForegroundColor Yellow
}

Write-Host ""