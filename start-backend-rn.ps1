# 启动后端和React Native开发环境 (不包含Web前端)
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "启动后端和React Native开发环境" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查和启动MySQL服务
Write-Host "1. 检查MySQL服务状态..." -ForegroundColor Yellow
$mysql = Get-Service -Name "MySQL80" -ErrorAction SilentlyContinue
if ($mysql) {
    if ($mysql.Status -eq 'Running') {
        Write-Host "   ✓ MySQL80服务已在运行" -ForegroundColor Green
    } else {
        Write-Host "   MySQL80服务未运行，正在启动..." -ForegroundColor Yellow
        try {
            Start-Service MySQL80
            Start-Sleep -Seconds 3
            Write-Host "   ✓ MySQL80服务启动成功" -ForegroundColor Green
        } catch {
            Write-Host "   ✗ MySQL80服务启动失败: $_" -ForegroundColor Red
            Write-Host "   请手动启动MySQL服务后重试" -ForegroundColor Yellow
            pause
            exit 1
        }
    }
} else {
    Write-Host "   ✗ 未找到MySQL80服务" -ForegroundColor Red
    Write-Host "   请确保MySQL已正确安装" -ForegroundColor Yellow
}

Write-Host ""

# 2. 启动后端服务
Write-Host "2. 启动后端服务 (端口 3001)..." -ForegroundColor Yellow
$backendPath = Join-Path $PSScriptRoot "backend"
if (Test-Path $backendPath) {
    Start-Process cmd -ArgumentList "/k", "cd /d `"$backendPath`" && npm run dev" -WorkingDirectory $backendPath
    Write-Host "   ✓ 后端服务启动命令已执行" -ForegroundColor Green
} else {
    Write-Host "   ✗ 后端目录不存在: $backendPath" -ForegroundColor Red
    pause
    exit 1
}

# 3. 等待后端启动
Write-Host ""
Write-Host "3. 等待后端服务启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
Write-Host "   ✓ 后端服务应该已经启动" -ForegroundColor Green

Write-Host ""

# 4. 启动React Native
Write-Host "4. 启动React Native (Expo) 服务..." -ForegroundColor Yellow
$rnPath = Join-Path $PSScriptRoot "frontend\HainiuFoodTrace"
if (Test-Path $rnPath) {
    Start-Process cmd -ArgumentList "/k", "cd /d `"$rnPath`" && npx expo start" -WorkingDirectory $rnPath
    Write-Host "   ✓ React Native启动命令已执行" -ForegroundColor Green
} else {
    Write-Host "   ✗ React Native目录不存在: $rnPath" -ForegroundColor Red
    Write-Host "   如果还未创建React Native项目，请先初始化" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "开发环境启动完成！" -ForegroundColor Green
Write-Host "" 
Write-Host "已启动的服务:" -ForegroundColor Yellow
Write-Host "  ✓ MySQL80: 数据库服务" -ForegroundColor Green
Write-Host "  ✓ 后端API: http://localhost:3001" -ForegroundColor Green
Write-Host "  ✓ React Native: http://localhost:8081" -ForegroundColor Green
Write-Host ""
Write-Host "未启动的服务:" -ForegroundColor Yellow
Write-Host "  ✗ Web前端: http://localhost:3000 (按需求不启动)" -ForegroundColor Gray
Write-Host ""
Write-Host "测试账号: admin / Admin@123456" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
pause