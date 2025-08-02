@echo off
chcp 65001 >nul
echo ====================================
echo 🚀 黑牛系统一键重启脚本
echo ====================================
echo.

:: 设置颜色
color 0A

:: 步骤1：杀死占用端口的进程
echo [1/4] 🔍 正在检查并关闭占用的端口...
echo.

:: 查找并杀死占用3000端口的进程（前端）
echo 检查端口 3000 (前端)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    if not "%%a"=="0" (
        echo 发现进程 PID: %%a 占用端口 3000，正在关闭...
        taskkill /F /PID %%a >nul 2>&1
    )
)

:: 查找并杀死占用3001端口的进程（后端）
echo 检查端口 3001 (后端)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    if not "%%a"=="0" (
        echo 发现进程 PID: %%a 占用端口 3001，正在关闭...
        taskkill /F /PID %%a >nul 2>&1
    )
)

:: 等待端口释放
echo.
echo ⏳ 等待端口释放...
timeout /t 3 /nobreak >nul

:: 步骤2：检查MySQL服务状态
echo.
echo [2/4] 🗄️  检查MySQL服务状态...
sc query MySQL >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  MySQL服务未安装，跳过...
) else (
    echo 正在启动MySQL服务...
    net start MySQL >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ MySQL服务启动成功
    ) else (
        echo ℹ️  MySQL服务已经在运行
    )
)

:: 步骤3：启动后端服务
echo.
echo [3/4] 🔧 启动后端服务...
cd /d "%~dp0..\backend"
start "黑牛后端服务" cmd /k "npm run dev"
echo ✅ 后端服务启动命令已执行

:: 等待后端启动
echo.
echo ⏳ 等待后端服务启动...
timeout /t 5 /nobreak >nul

:: 步骤4：启动前端服务
echo.
echo [4/4] 🎨 启动前端服务...
cd /d "%~dp0..\frontend\web-app-next"
start "黑牛前端服务" cmd /k "npm run dev"
echo ✅ 前端服务启动命令已执行

:: 完成提示
echo.
echo ====================================
echo ✨ 所有服务启动完成！
echo ====================================
echo.
echo 📌 服务地址：
echo    前端：http://localhost:3000
echo    后端：http://localhost:3001
echo    数据库：localhost:3306
echo.
echo 💡 提示：
echo    - 新开的窗口会显示服务日志
echo    - 关闭窗口即可停止对应服务
echo    - 使用 stop-all.bat 可以停止所有服务
echo.
echo 按任意键关闭此窗口...
pause >nul