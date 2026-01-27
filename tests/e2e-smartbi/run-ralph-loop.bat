@echo off
REM SmartBI Ralph Loop 启动脚本 (Windows)

echo ========================================
echo  SmartBI Ralph Loop E2E 测试
echo ========================================
echo.

REM 检查是否安装依赖
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    npx playwright install chromium
)

REM 设置环境变量
set HEADED=true
set SLOW_MO=100

echo Starting Ralph Loop with browser visible...
echo Press Ctrl+C to stop
echo.

npx ts-node ralph-loop.ts

pause
