# Fix PowerShell Profile - Clean and Rebuild
# =========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host " PowerShell Profile Fix Utility" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

# Get profile path
$profilePath = $PROFILE
$profileDir = Split-Path $profilePath -Parent

Write-Host "Profile path: $profilePath" -ForegroundColor Yellow

# Create backup if profile exists
if (Test-Path $profilePath) {
    $backupPath = "$profilePath.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Write-Host "Creating backup..." -ForegroundColor Yellow
    
    try {
        # Try to copy the file, but if it's corrupted, just rename it
        Move-Item $profilePath $backupPath -ErrorAction Stop
        Write-Host "  Backup created: $backupPath" -ForegroundColor Green
    } catch {
        Write-Host "  Warning: Could not create backup (file may be corrupted)" -ForegroundColor Yellow
        # Force remove the corrupted file
        Remove-Item $profilePath -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "No existing profile found" -ForegroundColor Gray
}

# Ensure profile directory exists
if (!(Test-Path $profileDir)) {
    Write-Host "Creating profile directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

# Create new clean profile with React Native commands
Write-Host "Creating new profile..." -ForegroundColor Yellow

$newProfileContent = @"
# ========================================
# React Native Development Commands
# ========================================

# Start React Native development environment
function dev-rn {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " Starting React Native Environment" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Project root
    `$projectRoot = "C:\Users\Steve\heiniu"
    
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
        # Silently handle any errors
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
        # Silently handle any errors
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
            # Silently handle any errors
        }
    }
    
    Write-Host "  Port cleanup completed" -ForegroundColor Green
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
            Write-Host "  MySQL80 is running" -ForegroundColor Green
        } else {
            Write-Host "  MySQL80 not installed" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  MySQL80 service check failed" -ForegroundColor Yellow
    }
    Write-Host ""
    
    # Step 3: Start backend
    Write-Host "[3/4] Starting backend service..." -ForegroundColor Yellow
    `$backendPath = Join-Path `$projectRoot "backend"
    if (Test-Path `$backendPath) {
        Start-Process cmd -ArgumentList "/k", "cd /d ```"`$backendPath```" && echo [Backend API - Port 3001] && npm run dev"
        Write-Host "  Backend starting (port 3001)" -ForegroundColor Green
    } else {
        Write-Host "  Backend directory not found" -ForegroundColor Red
    }
    
    # Wait for backend
    Start-Sleep -Seconds 3
    Write-Host ""
    
    # Step 4: Start React Native
    Write-Host "[4/4] Starting React Native..." -ForegroundColor Yellow
    `$rnPath = Join-Path `$projectRoot "frontend\HainiuFoodTrace"
    if (Test-Path `$rnPath) {
        Start-Process cmd -ArgumentList "/k", "cd /d ```"`$rnPath```" && echo [React Native - Expo] && npx expo start"
        Write-Host "  React Native starting (port 8081)" -ForegroundColor Green
    } else {
        Write-Host "  React Native project not found" -ForegroundColor Yellow
        Write-Host "  Path: `$rnPath" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " Development environment started!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Services:" -ForegroundColor Yellow
    Write-Host "  MySQL80: Database service" -ForegroundColor White
    Write-Host "  Backend API: http://localhost:3001" -ForegroundColor White
    Write-Host "  React Native: http://localhost:8081" -ForegroundColor White
    Write-Host ""
    Write-Host "Test account: admin / Admin@123456" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To stop: dev-rn-stop" -ForegroundColor Gray
    Write-Host ""
}

# Stop React Native development environment
function dev-rn-stop {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host " Stopping React Native Environment" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "Stopping services..." -ForegroundColor Yellow
    
    # Stop port 3001 (backend)
    try {
        `$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
        if (`$port3001) {
            `$pid = `$port3001.OwningProcess | Select-Object -Unique
            if (`$pid) {
                Write-Host "  Stopping backend..." -ForegroundColor Gray
                Stop-Process -Id `$pid -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {
        # Silently handle any errors
    }
    
    # Stop port 8081 (React Native)
    try {
        `$port8081 = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue
        if (`$port8081) {
            `$pid = `$port8081.OwningProcess | Select-Object -Unique
            if (`$pid) {
                Write-Host "  Stopping React Native..." -ForegroundColor Gray
                Stop-Process -Id `$pid -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {
        # Silently handle any errors
    }
    
    # Stop Expo ports
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
            # Silently handle any errors
        }
    }
    
    # Stop all node processes
    Write-Host "  Cleaning Node processes..." -ForegroundColor Gray
    try {
        Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    } catch {
        # Silently handle any errors
    }
    
    Write-Host ""
    Write-Host "All services stopped" -ForegroundColor Green
    Write-Host ""
    Write-Host "Note: MySQL service remains running" -ForegroundColor Gray
    Write-Host ""
}

# Show status
function dev-rn-status {
    Write-Host ""
    Write-Host "React Native Environment Status:" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    
    # MySQL status
    try {
        `$mysql = Get-Service -Name "MySQL80" -ErrorAction SilentlyContinue
        if (`$mysql -and `$mysql.Status -eq 'Running') {
            Write-Host "  MySQL80: Running" -ForegroundColor Green
        } else {
            Write-Host "  MySQL80: Not running" -ForegroundColor Red
        }
    } catch {
        Write-Host "  MySQL80: Status unknown" -ForegroundColor Yellow
    }
    
    # Backend status
    try {
        `$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
        if (`$port3001) {
            Write-Host "  Backend API (3001): Running" -ForegroundColor Green
        } else {
            Write-Host "  Backend API (3001): Not running" -ForegroundColor Red
        }
    } catch {
        Write-Host "  Backend API (3001): Status unknown" -ForegroundColor Yellow
    }
    
    # React Native status
    try {
        `$port8081 = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue
        if (`$port8081) {
            Write-Host "  React Native (8081): Running" -ForegroundColor Green
        } else {
            Write-Host "  React Native (8081): Not running" -ForegroundColor Red
        }
    } catch {
        Write-Host "  React Native (8081): Status unknown" -ForegroundColor Yellow
    }
    
    # Web frontend status
    try {
        `$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
        if (`$port3000) {
            Write-Host "  Web Frontend (3000): Running (not RN env)" -ForegroundColor Yellow
        } else {
            Write-Host "  Web Frontend (3000): Not running (normal)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  Web Frontend (3000): Status unknown" -ForegroundColor Gray
    }
    
    Write-Host ""
}

# Restart
function dev-rn-restart {
    Write-Host "Restarting React Native environment..." -ForegroundColor Yellow
    dev-rn-stop
    Start-Sleep -Seconds 2
    dev-rn
}

# Help
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
    Write-Host ""
}

# Load notification
Write-Host "React Native commands loaded" -ForegroundColor Green
Write-Host "Type dev-rn-help for available commands" -ForegroundColor Gray
"@

# Write the new profile
try {
    Set-Content -Path $profilePath -Value $newProfileContent -Encoding UTF8 -Force
    Write-Host "  New profile created successfully" -ForegroundColor Green
} catch {
    Write-Host "  Error creating profile: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Profile Fix Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Close all PowerShell windows" -ForegroundColor White
Write-Host "2. Open a new PowerShell window" -ForegroundColor White
Write-Host "3. PowerShell should start quickly now" -ForegroundColor White
Write-Host "4. Use dev-rn-help to see available commands" -ForegroundColor White
Write-Host ""
Write-Host "Profile location: $profilePath" -ForegroundColor Gray
Write-Host ""

# Test the new profile
Write-Host "Testing new profile syntax..." -ForegroundColor Yellow
try {
    $null = [System.Management.Automation.PSParser]::Tokenize((Get-Content $profilePath -Raw), [ref]$null)
    Write-Host "  Syntax check: PASSED" -ForegroundColor Green
} catch {
    Write-Host "  Syntax check: FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Fix complete! Please restart PowerShell." -ForegroundColor Green