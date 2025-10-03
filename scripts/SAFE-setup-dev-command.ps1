# ========================================
# SAFE HeiNiu Development Commands Setup
# ========================================
# This is the SAFE version of setup-dev-command.ps1
# Prevents Profile corruption through proper content management

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " SAFE HeiNiu Dev Commands Setup" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Safety check - Profile file size
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

# Safe content management function
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

# Check profile path
$profilePath = $PROFILE
$profileDir = Split-Path $profilePath -Parent

Write-Host "Profile Path: $profilePath" -ForegroundColor Yellow
Write-Host ""

# Create profile directory if needed
if (!(Test-Path $profileDir)) {
    Write-Host "Creating profile directory..." -ForegroundColor Yellow
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

# Define the development commands
$devCommands = @'
# HeiNiu Development Commands - Web Environment
function dev {
    Write-Host "`nStarting HeiNiu development environment..." -ForegroundColor Cyan

    # Project paths
    $projectRoot = "C:\Users\Steve\heiniu"
    $backendPath = Join-Path $projectRoot "backend"
    $frontendPath = Join-Path $projectRoot "frontend\web-app-next"

    # 1. Clean ports
    Write-Host "Cleaning ports..." -ForegroundColor Yellow
    $ports = @(3000, 3001)
    foreach ($port in $ports) {
        $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        foreach ($conn in $connections) {
            if ($conn.OwningProcess -ne 0) {
                try {
                    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction Stop
                    Write-Host "   ✓ Released port $port" -ForegroundColor Green
                } catch {
                    Write-Host "   ✗ Cannot release port $port" -ForegroundColor Red
                }
            }
        }
    }

    Start-Sleep -Seconds 2

    # 2. Start MySQL service
    Write-Host "Starting MySQL service..." -ForegroundColor Yellow
    try {
        $mysql = Get-Service -Name "MySQL80" -ErrorAction SilentlyContinue
        if ($mysql) {
            if ($mysql.Status -ne 'Running') {
                Start-Service MySQL80 -ErrorAction Stop
                Write-Host "   ✓ MySQL service started" -ForegroundColor Green
            } else {
                Write-Host "   ✓ MySQL service already running" -ForegroundColor Green
            }
        } else {
            Write-Host "   ⚠ MySQL service not installed" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ✗ MySQL service failed to start: $_" -ForegroundColor Red
    }

    # 3. Start backend
    Write-Host "Starting backend service..." -ForegroundColor Yellow
    if (Test-Path $backendPath) {
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host 'HeiNiu Backend Service' -ForegroundColor Cyan; npm run dev"
        Write-Host "   ✓ Backend start command executed" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Backend path not found: $backendPath" -ForegroundColor Red
    }

    # Wait for backend to start
    Start-Sleep -Seconds 3

    # 4. Start frontend
    Write-Host "Starting frontend service..." -ForegroundColor Yellow
    if (Test-Path $frontendPath) {
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; Write-Host 'HeiNiu Frontend Service' -ForegroundColor Cyan; npm run dev"
        Write-Host "   ✓ Frontend start command executed" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Frontend path not found: $frontendPath" -ForegroundColor Red
    }

    # Show results
    Write-Host "`n✓ All services started!" -ForegroundColor Green
    Write-Host "Frontend URL: " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor Cyan
    Write-Host "Backend URL: " -NoNewline; Write-Host "http://localhost:3001" -ForegroundColor Cyan
    Write-Host "Database: " -NoNewline; Write-Host "localhost:3306" -ForegroundColor Cyan
    Write-Host "`nTip: Use 'dev-stop' to stop all services" -ForegroundColor Gray
}

function dev-stop {
    param(
        [switch]$All,
        [switch]$Force
    )

    Write-Host "`nStopping HeiNiu development environment..." -ForegroundColor Yellow

    $stopped = $false
    $stoppedProcesses = @()

    if ($All -or $Force) {
        Write-Host "Stopping ALL development processes..." -ForegroundColor Red
        
        # Kill all Node.js and related processes
        $processesToKill = @("node", "npm", "npx", "next-server", "webpack")
        
        foreach ($processName in $processesToKill) {
            $processes = Get-Process -Name $processName -ErrorAction SilentlyContinue
            foreach ($process in $processes) {
                try {
                    Stop-Process -Id $process.Id -Force -ErrorAction Stop
                    $stoppedProcesses += "$($process.ProcessName) (PID: $($process.Id))"
                    Write-Host "   ✓ Stopped $($process.ProcessName)" -ForegroundColor Green
                    $stopped = $true
                } catch {
                    Write-Host "   ✗ Cannot stop $($process.ProcessName)" -ForegroundColor Red
                }
            }
        }
    }

    # Stop processes on specific ports
    $ports = @(3000, 3001)
    foreach ($port in $ports) {
        $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        foreach ($conn in $connections) {
            if ($conn.OwningProcess -ne 0) {
                try {
                    $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
                    if ($process) {
                        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction Stop
                        $stoppedProcesses += "$($process.ProcessName) on port $port"
                        Write-Host "   ✓ Stopped process on port $port" -ForegroundColor Green
                        $stopped = $true
                    }
                } catch {
                    Write-Host "   ✗ Cannot stop process on port $port" -ForegroundColor Red
                }
            }
        }
    }

    if ($stopped) {
        Write-Host "`n✓ Services stopped successfully!" -ForegroundColor Green
        if ($stoppedProcesses.Count -gt 0) {
            Write-Host "Stopped processes:" -ForegroundColor Gray
            foreach ($proc in $stoppedProcesses) {
                Write-Host "   - $proc" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "`n⚠ No running services found" -ForegroundColor Yellow
    }

    Write-Host "`nTip: Use 'dev-stop -All' to stop all Node.js processes" -ForegroundColor Cyan
}

function dev-status {
    Write-Host "`nHeiNiu System Service Status" -ForegroundColor Cyan
    Write-Host "=============================" -ForegroundColor Cyan

    # Check frontend (port 3000)
    $frontend = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    if ($frontend) {
        Write-Host "Frontend Service (3000): " -NoNewline
        Write-Host "✓ Running" -ForegroundColor Green
        Write-Host "   URL: http://localhost:3000" -ForegroundColor Gray
    } else {
        Write-Host "Frontend Service (3000): " -NoNewline
        Write-Host "✗ Not Running" -ForegroundColor Red
    }

    # Check backend (port 3001)
    $backend = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
    if ($backend) {
        Write-Host "Backend Service (3001): " -NoNewline
        Write-Host "✓ Running" -ForegroundColor Green
        Write-Host "   URL: http://localhost:3001" -ForegroundColor Gray
    } else {
        Write-Host "Backend Service (3001): " -NoNewline
        Write-Host "✗ Not Running" -ForegroundColor Red
    }

    # Check MySQL
    try {
        $mysql = Get-Service -Name "MySQL80" -ErrorAction SilentlyContinue
        if ($mysql) {
            if ($mysql.Status -eq 'Running') {
                Write-Host "MySQL Service: " -NoNewline
                Write-Host "✓ Running" -ForegroundColor Green
            } else {
                Write-Host "MySQL Service: " -NoNewline
                Write-Host "✗ Stopped" -ForegroundColor Red
            }
        } else {
            Write-Host "MySQL Service: " -NoNewline
            Write-Host "⚠ Not Installed" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "MySQL Service: " -NoNewline
        Write-Host "⚠ Cannot Detect" -ForegroundColor Yellow
    }

    Write-Host ""
}

# Show available commands
Write-Host "HeiNiu Web development commands loaded:" -ForegroundColor Green
Write-Host "   dev            - Start all services (Backend + Frontend + MySQL)" -ForegroundColor White
Write-Host "   dev-stop       - Stop development services (ports 3000, 3001)" -ForegroundColor White  
Write-Host "   dev-stop -All  - Stop all Node.js related processes" -ForegroundColor White
Write-Host "   dev-stop -Force- Force stop all development processes" -ForegroundColor White
Write-Host "   dev-status     - Check service status" -ForegroundColor White
'@

# Install the commands safely
Write-Host "Installing HeiNiu development commands..." -ForegroundColor Cyan
Write-Host ""

$success = Set-ProfileContent -ProfilePath $profilePath -NewContent $devCommands -SectionName "HEINIU WEB DEV COMMANDS"

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
    Write-Host "========================================" -ForegroundColor Green
    Write-Host " Installation Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Close this PowerShell window" -ForegroundColor White
    Write-Host "2. Open a new PowerShell window" -ForegroundColor White
    Write-Host "3. Use the following commands:" -ForegroundColor White
    Write-Host ""
    Write-Host "   dev            " -ForegroundColor Cyan -NoNewline
    Write-Host "# Start all services" -ForegroundColor Gray
    Write-Host "   dev-stop       " -ForegroundColor Cyan -NoNewline
    Write-Host "# Stop services" -ForegroundColor Gray
    Write-Host "   dev-status     " -ForegroundColor Cyan -NoNewline
    Write-Host "# Check status" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Profile location: $profilePath" -ForegroundColor Gray
    
    # Offer to load immediately  
    Write-Host ""
    $response = Read-Host "Load commands to current session? (y/n)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        try {
            . $profilePath
            Write-Host "✓ Commands loaded to current session" -ForegroundColor Green
            Write-Host "You can now use 'dev' command immediately" -ForegroundColor Gray
        } catch {
            Write-Host "✗ Failed to load commands: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "Please restart PowerShell to use the commands" -ForegroundColor Yellow
        }
    }
    
} else {
    Write-Host ""
    Write-Host "✗ Installation failed!" -ForegroundColor Red
    Write-Host "Please check the error messages above and try again." -ForegroundColor Yellow
}

Write-Host ""