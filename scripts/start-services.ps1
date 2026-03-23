# SmartBI E2E Test - Service Startup Script
# Starts PostgreSQL, Python, Java, and Vite in dependency order with health checks

param(
    [switch]$SkipPg,
    [switch]$SkipJava,
    [switch]$SkipPython,
    [switch]$SkipVite
)

$ErrorActionPreference = "Continue"
$ProjectRoot = $PSScriptRoot

function Write-Status($msg, $color = "Cyan") {
    Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] $msg" -ForegroundColor $color
}

function Test-Port($port) {
    $result = netstat -ano 2>$null | Select-String ":$port\s"
    return $null -ne $result
}

function Wait-ForHealth($url, $timeoutSec, $label) {
    Write-Status "Waiting for $label at $url ..."
    $elapsed = 0
    while ($elapsed -lt $timeoutSec) {
        try {
            $response = Invoke-WebRequest -Uri $url -TimeoutSec 3 -UseBasicParsing -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Status "$label is ready!" "Green"
                return $true
            }
        } catch {}
        Start-Sleep -Seconds 2
        $elapsed += 2
        Write-Host "." -NoNewline
    }
    Write-Host ""
    Write-Status "$label failed to start within ${timeoutSec}s" "Red"
    return $false
}

# ============================================================
# Step 0: Check PostgreSQL (5432)
# ============================================================
Write-Status "=== Step 0: Checking PostgreSQL ===" "Yellow"

if (-not $SkipPg) {
    if (Test-Port 5432) {
        Write-Status "PostgreSQL port 5432 is active" "Green"
        try {
            $pgResult = & psql -U smartbi_user -d smartbi_db -c "SELECT 1" 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Status "PostgreSQL connection OK" "Green"
            } else {
                Write-Status "PostgreSQL port open but connection failed. Check credentials." "Yellow"
            }
        } catch {
            Write-Status "psql not found, but port 5432 is active - assuming PG is running" "Yellow"
        }
    } else {
        Write-Status "PostgreSQL is NOT running on port 5432!" "Red"
        Write-Status "Please start PostgreSQL manually and re-run this script" "Red"
        exit 1
    }
} else {
    Write-Status "Skipping PostgreSQL check" "Yellow"
}

# ============================================================
# Step 1: Start Python Service (8083)
# ============================================================
Write-Status "=== Step 1: Starting Python Service (8083) ===" "Yellow"

if (-not $SkipPython) {
    if (Test-Port 8083) {
        Write-Status "Port 8083 already in use - Python service may be running" "Yellow"
    } else {
        $pythonDir = Join-Path $ProjectRoot "backend\python"
        Write-Status "Starting uvicorn from $pythonDir ..."

        $pythonProcess = Start-Process -FilePath "python" `
            -ArgumentList "-m", "uvicorn", "main:app", "--port", "8083", "--reload" `
            -WorkingDirectory $pythonDir `
            -PassThru -WindowStyle Minimized

        Write-Status "Python PID: $($pythonProcess.Id)"
    }

    if (-not (Wait-ForHealth "http://localhost:8083/health" 30 "Python service")) {
        # Try /docs as fallback health check
        if (-not (Wait-ForHealth "http://localhost:8083/docs" 10 "Python service (docs)")) {
            Write-Status "Python service failed to start" "Red"
            exit 1
        }
    }
} else {
    Write-Status "Skipping Python service" "Yellow"
}

# ============================================================
# Step 2: Start Java Backend (10010)
# ============================================================
Write-Status "=== Step 2: Starting Java Backend (10010) ===" "Yellow"

if (-not $SkipJava) {
    if (Test-Port 10010) {
        Write-Status "Port 10010 already in use - Java backend may be running" "Yellow"
    } else {
        $jarPath = Join-Path $ProjectRoot "backend\java\cretas-api\target\cretas-backend-system-1.0.0.jar"

        if (-not (Test-Path $jarPath)) {
            Write-Status "JAR not found at $jarPath" "Red"
            exit 1
        }

        Write-Status "Starting Java backend from $jarPath ..."

        $env:DB_PASSWORD = "cretas_pass"
        $env:POSTGRES_SMARTBI_PASSWORD = "smartbi_pass"

        $javaProcess = Start-Process -FilePath "java" `
            -ArgumentList "-jar", $jarPath, `
                "--spring.profiles.active=pg", `
                "--spring.jpa.database-platform=org.hibernate.dialect.PostgreSQL10Dialect", `
                "--spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQL10Dialect" `
            -PassThru -WindowStyle Minimized

        Write-Status "Java PID: $($javaProcess.Id)"
    }

    if (-not (Wait-ForHealth "http://localhost:10010/api/mobile/health" 90 "Java backend")) {
        Write-Status "Java backend failed to start" "Red"
        exit 1
    }
} else {
    Write-Status "Skipping Java backend" "Yellow"
}

# ============================================================
# Step 3: Start Vite Dev Server (5173)
# ============================================================
Write-Status "=== Step 3: Starting Vite Dev Server (5173) ===" "Yellow"

if (-not $SkipVite) {
    if (Test-Port 5173) {
        Write-Status "Port 5173 already in use - Vite may be running" "Yellow"
    } else {
        $webAdminDir = Join-Path $ProjectRoot "web-admin"
        Write-Status "Starting Vite from $webAdminDir ..."

        $viteProcess = Start-Process -FilePath "npm" `
            -ArgumentList "run", "dev" `
            -WorkingDirectory $webAdminDir `
            -PassThru -WindowStyle Minimized

        Write-Status "Vite PID: $($viteProcess.Id)"
    }

    if (-not (Wait-ForHealth "http://localhost:5173" 30 "Vite dev server")) {
        Write-Status "Vite dev server failed to start" "Red"
        exit 1
    }
} else {
    Write-Status "Skipping Vite dev server" "Yellow"
}

# ============================================================
# Step 4: Health Check Summary
# ============================================================
Write-Status "=== Step 4: Health Check Summary ===" "Yellow"

$services = @(
    @{ Name = "PostgreSQL";  Port = 5432;  Skip = $SkipPg },
    @{ Name = "Python";      Port = 8083;  Skip = $SkipPython },
    @{ Name = "Java Backend"; Port = 10010; Skip = $SkipJava },
    @{ Name = "Vite Dev";    Port = 5173;  Skip = $SkipVite }
)

$allOk = $true
foreach ($svc in $services) {
    if ($svc.Skip) {
        Write-Host "  SKIP  $($svc.Name) (:$($svc.Port))" -ForegroundColor DarkGray
    } elseif (Test-Port $svc.Port) {
        Write-Host "  OK    $($svc.Name) (:$($svc.Port))" -ForegroundColor Green
    } else {
        Write-Host "  FAIL  $($svc.Name) (:$($svc.Port))" -ForegroundColor Red
        $allOk = $false
    }
}

if ($allOk) {
    Write-Host ""
    Write-Status "4 services ready - you can now run E2E tests" "Green"
    Write-Host ""
    Write-Host "  npx playwright test --project=chromium" -ForegroundColor White
    Write-Host ""
} else {
    Write-Status "Some services failed to start. Check logs above." "Red"
    exit 1
}
