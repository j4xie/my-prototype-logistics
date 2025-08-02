# Setup development environment commands for HeiNiu system
# Run once to install dev and dev-stop commands in PowerShell

Write-Host "Installing HeiNiu development commands..." -ForegroundColor Cyan

# Ensure profile directory exists
$profileDir = Split-Path $PROFILE -Parent
if (!(Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

# Define commands to add
$devCommands = @'

# ========== HeiNiu Development Commands ==========
function dev {
    Write-Host "`nStarting HeiNiu development environment..." -ForegroundColor Cyan

    # Project paths
    $projectRoot = "C:\Users\Steve\heiniu"
    $backendPath = Join-Path $projectRoot "backend"
    $frontendPath = Join-Path $projectRoot "frontend\web-app-next"

    # 1. Kill processes using ports
    Write-Host "Cleaning ports..." -ForegroundColor Yellow
    $ports = @(3000, 3001)
    foreach ($port in $ports) {
        $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        foreach ($conn in $connections) {
            if ($conn.OwningProcess -ne 0) {
                try {
                    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction Stop
                    Write-Host "   [OK] Released port $port" -ForegroundColor Green
                } catch {
                    Write-Host "   [ERROR] Cannot release port $port" -ForegroundColor Red
                }
            }
        }
    }

    Start-Sleep -Seconds 2

    # 2. Start MySQL service
    Write-Host "Starting MySQL service..." -ForegroundColor Yellow
    try {
        $mysql = Get-Service -Name "MySQL" -ErrorAction SilentlyContinue
        if ($mysql) {
            if ($mysql.Status -ne 'Running') {
                Start-Service MySQL -ErrorAction Stop
                Write-Host "   [OK] MySQL service started" -ForegroundColor Green
            } else {
                Write-Host "   [OK] MySQL service already running" -ForegroundColor Green
            }
        } else {
            Write-Host "   [WARNING] MySQL service not installed" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   [ERROR] MySQL service failed to start: $_" -ForegroundColor Red
    }

    # 3. Start backend
    Write-Host "Starting backend service..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host 'HeiNiu Backend Service' -ForegroundColor Cyan; npm run dev"
    Write-Host "   [OK] Backend start command executed" -ForegroundColor Green

    # Wait for backend to start
    Start-Sleep -Seconds 3

    # 4. Start frontend
    Write-Host "Starting frontend service..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; Write-Host 'HeiNiu Frontend Service' -ForegroundColor Cyan; npm run dev"
    Write-Host "   [OK] Frontend start command executed" -ForegroundColor Green

    # Show results
    Write-Host "`nAll services started!" -ForegroundColor Green
    Write-Host "Frontend URL: " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor Cyan
    Write-Host "Backend URL: " -NoNewline; Write-Host "http://localhost:3001" -ForegroundColor Cyan
    Write-Host "Database: " -NoNewline; Write-Host "localhost:3306" -ForegroundColor Cyan
    Write-Host "`nTip: Use 'dev-stop' to stop all services" -ForegroundColor Gray
}

function dev-stop {
    Write-Host "`nStopping HeiNiu development environment..." -ForegroundColor Yellow

    # Stop processes using ports
    $ports = @(3000, 3001)
    $stopped = $false

    foreach ($port in $ports) {
        $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        foreach ($conn in $connections) {
            if ($conn.OwningProcess -ne 0) {
                try {
                    $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
                    if ($process) {
                        $processName = $process.ProcessName
                        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction Stop
                        Write-Host "   [OK] Stopped process on port $port ($processName)" -ForegroundColor Green
                        $stopped = $true
                    }
                } catch {
                    Write-Host "   [ERROR] Cannot stop process on port $port" -ForegroundColor Red
                }
            }
        }
    }

    if ($stopped) {
        Write-Host "`nAll services stopped!" -ForegroundColor Green
    } else {
        Write-Host "`nNo running services found" -ForegroundColor Yellow
    }
}

function dev-status {
    Write-Host "`nHeiNiu System Service Status" -ForegroundColor Cyan
    Write-Host "=============================" -ForegroundColor Cyan

    # Check frontend
    $frontend = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    if ($frontend) {
        Write-Host "Frontend Service: " -NoNewline
        Write-Host "Running" -ForegroundColor Green
        Write-Host "   URL: http://localhost:3000" -ForegroundColor Gray
    } else {
        Write-Host "Frontend Service: " -NoNewline
        Write-Host "Not Running" -ForegroundColor Red
    }

    # Check backend
    $backend = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
    if ($backend) {
        Write-Host "Backend Service: " -NoNewline
        Write-Host "Running" -ForegroundColor Green
        Write-Host "   URL: http://localhost:3001" -ForegroundColor Gray
    } else {
        Write-Host "Backend Service: " -NoNewline
        Write-Host "Not Running" -ForegroundColor Red
    }

    # Check MySQL
    try {
        $mysql = Get-Service -Name "MySQL" -ErrorAction SilentlyContinue
        if ($mysql) {
            if ($mysql.Status -eq 'Running') {
                Write-Host "MySQL Service: " -NoNewline
                Write-Host "Running" -ForegroundColor Green
            } else {
                Write-Host "MySQL Service: " -NoNewline
                Write-Host "Stopped" -ForegroundColor Red
            }
        } else {
            Write-Host "MySQL Service: " -NoNewline
            Write-Host "Not Installed" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "MySQL Service: " -NoNewline
        Write-Host "Cannot Detect" -ForegroundColor Yellow
    }
}

# Show available commands
Write-Host "`nHeiNiu development commands loaded:" -ForegroundColor Green
Write-Host "   dev        - Start all services" -ForegroundColor White
Write-Host "   dev-stop   - Stop all services" -ForegroundColor White
Write-Host "   dev-status - Check service status" -ForegroundColor White
# ========== HeiNiu Development Commands End ==========

'@

# Check if profile exists
if (!(Test-Path $PROFILE)) {
    # Create new profile
    New-Item -ItemType File -Path $PROFILE -Force | Out-Null
    Set-Content -Path $PROFILE -Value $devCommands -Encoding UTF8
    Write-Host "[OK] PowerShell profile created" -ForegroundColor Green
} else {
    # Check if already installed
    $content = Get-Content $PROFILE -Raw -ErrorAction SilentlyContinue
    if ($content -like "*function dev {*") {
        Write-Host "[WARNING] Development commands already exist, updating..." -ForegroundColor Yellow
        # Remove old version
        $content = $content -replace '# ========== HeiNiu Development Commands ==========[\s\S]*?# ========== HeiNiu Development Commands End ==========', ''
    }

    # Add new commands
    Add-Content -Path $PROFILE -Value "`n$devCommands" -Encoding UTF8
    Write-Host "[OK] Development commands updated in profile" -ForegroundColor Green
}

Write-Host "`nInstallation complete!" -ForegroundColor Green
Write-Host "Profile location: $PROFILE" -ForegroundColor Gray
Write-Host "`nPlease follow these steps:" -ForegroundColor Cyan
Write-Host "1. Close current PowerShell window" -ForegroundColor White
Write-Host "2. Reopen PowerShell" -ForegroundColor White
Write-Host "3. Use the following commands:" -ForegroundColor White
Write-Host "   dev        - Start all services" -ForegroundColor Yellow
Write-Host "   dev-stop   - Stop all services" -ForegroundColor Yellow
Write-Host "   dev-status - Check service status" -ForegroundColor Yellow

Write-Host "`nTip: To use immediately, run:" -ForegroundColor Gray
Write-Host '   . $PROFILE' -ForegroundColor Cyan