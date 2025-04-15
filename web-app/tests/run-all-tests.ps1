# 食品溯源系统 - 测试执行脚本 (PowerShell版)

# 解析命令行参数
param(
    [switch]$UnitOnly,
    [switch]$IntegrationOnly,
    [switch]$E2EOnly,
    [switch]$SecurityOnly,
    [switch]$NoUnit,
    [switch]$NoIntegration,
    [switch]$NoE2E,
    [switch]$NoSecurity,
    [switch]$Verbose
)

Write-Host "=======================================" -ForegroundColor Blue
Write-Host "    食品溯源系统 - 测试执行脚本" -ForegroundColor Blue
Write-Host "=======================================" -ForegroundColor Blue
Write-Host ""

# 设置路径
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = (Get-Item $scriptPath).Parent.FullName
Set-Location $rootDir

# 设置默认值
$runUnit = $true
$runIntegration = $true
$runE2E = $true
$runSecurity = $true

# 处理独占参数
if ($UnitOnly) {
    $runUnit = $true
    $runIntegration = $false
    $runE2E = $false
    $runSecurity = $false
}
elseif ($IntegrationOnly) {
    $runUnit = $false
    $runIntegration = $true
    $runE2E = $false
    $runSecurity = $false
}
elseif ($E2EOnly) {
    $runUnit = $false
    $runIntegration = $false
    $runE2E = $true
    $runSecurity = $false
}
elseif ($SecurityOnly) {
    $runUnit = $false
    $runIntegration = $false
    $runE2E = $false
    $runSecurity = $true
}

# 处理排除参数
if ($NoUnit) { $runUnit = $false }
if ($NoIntegration) { $runIntegration = $false }
if ($NoE2E) { $runE2E = $false }
if ($NoSecurity) { $runSecurity = $false }

# 显示运行哪些测试
Write-Host "将运行以下测试："
if ($runUnit) { Write-Host "- 单元测试" }
if ($runIntegration) { Write-Host "- 集成测试" }
if ($runE2E) { Write-Host "- 端到端测试" }
if ($runSecurity) { Write-Host "- 安全测试" }
Write-Host ""

# 准备命令参数
$verboseArg = ""
if ($Verbose) { $verboseArg = "--verbose" }

# 执行测试的函数
function Run-Test {
    param (
        [string]$TestType,
        [string]$ScriptPath,
        [string]$Description
    )
    
    Write-Host "正在运行${Description}..." -ForegroundColor Cyan
    Set-Location $rootDir
    
    try {
        node $ScriptPath $verboseArg
        if ($LASTEXITCODE -ne 0) {
            Write-Host "${Description}失败！" -ForegroundColor Red
            exit $LASTEXITCODE
        }
        Write-Host "${Description}完成。" -ForegroundColor Green
        Write-Host ""
    }
    catch {
        Write-Host "${Description}执行出错: $_" -ForegroundColor Red
        exit 1
    }
}

# 执行单元测试
if ($runUnit) {
    Run-Test -TestType "unit" -ScriptPath "tests/run-unit-tests.js" -Description "单元测试"
}

# 执行集成测试
if ($runIntegration) {
    Run-Test -TestType "integration" -ScriptPath "tests/run-integration-tests.js" -Description "集成测试"
}

# 执行端到端测试
if ($runE2E) {
    Run-Test -TestType "e2e" -ScriptPath "tests/e2e/run-e2e-tests.js" -Description "端到端测试"
}

# 执行安全测试
if ($runSecurity) {
    Run-Test -TestType "security" -ScriptPath "tests/run-security-tests.js" -Description "安全测试"
}

Write-Host "=======================================" -ForegroundColor Blue
Write-Host "          所有测试执行完成！" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Blue

exit 0 