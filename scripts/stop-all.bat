@echo off
chcp 65001 >nul
echo ====================================
echo 🛑 黑牛系统一键停止脚本
echo ====================================
echo.

:: 设置颜色
color 0C

:: 停止前端服务
echo [1/3] 🎨 停止前端服务...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    if not "%%a"=="0" (
        echo 正在停止进程 PID: %%a
        taskkill /F /PID %%a >nul 2>&1
        echo ✅ 前端服务已停止
    )
)

:: 停止后端服务  
echo.
echo [2/3] 🔧 停止后端服务...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    if not "%%a"=="0" (
        echo 正在停止进程 PID: %%a
        taskkill /F /PID %%a >nul 2>&1
        echo ✅ 后端服务已停止
    )
)

:: 停止MySQL服务（可选）
echo.
echo [3/3] 🗄️  检查MySQL服务...
choice /C YN /N /T 5 /D N /M "是否停止MySQL服务？(Y/N，5秒后默认选N): "
if %errorlevel% equ 1 (
    echo 正在停止MySQL服务...
    net stop MySQL >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ MySQL服务已停止
    ) else (
        echo ⚠️  MySQL服务停止失败或未运行
    )
) else (
    echo ℹ️  跳过停止MySQL服务
)

:: 完成提示
echo.
echo ====================================
echo ✨ 所有服务已停止！
echo ====================================
echo.
echo 按任意键关闭此窗口...
pause >nul