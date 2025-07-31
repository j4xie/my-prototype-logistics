@echo off
echo 启动开发环境...

:: 检查并清理端口
echo.
echo 检查端口占用情况...
node scripts/port-manager.js check 3000
node scripts/port-manager.js check 3001

:: 询问是否清理端口
set /p clean="是否清理占用的端口? (y/n): "
if /i "%clean%"=="y" (
    echo 清理端口...
    node scripts/port-manager.js kill 3000
    node scripts/port-manager.js kill 3001
    timeout /t 2 /nobreak > nul
)

:: 启动后端
echo.
echo 启动后端服务 (端口 3001)...
start "Backend" cmd /k "cd backend && npm run dev"

:: 等待后端启动
timeout /t 3 /nobreak > nul

:: 启动前端
echo.
echo 启动前端服务 (端口 3000)...
start "Frontend" cmd /k "cd frontend/web-app-next && npm run dev"

echo.
echo 所有服务已启动!
echo 前端: http://localhost:3000
echo 后端: http://localhost:3001
echo.
pause