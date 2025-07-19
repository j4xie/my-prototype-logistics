@echo off
echo 🔄 重启海牛食品溯源系统服务...
echo.

REM 停止现有的Node.js进程
echo 📛 停止现有服务...
taskkill /f /im node.exe 2>nul
taskkill /f /im nodemon.exe 2>nul
echo ✅ 服务已停止
echo.

REM 等待2秒
timeout /t 2 /nobreak >nul

echo 🚀 启动后端服务...
start "后端服务" cmd /k "cd /d %~dp0backend && npm run dev"

REM 等待5秒让后端启动
timeout /t 5 /nobreak >nul

echo 🌐 启动前端服务...
start "前端服务" cmd /k "cd /d %~dp0frontend\web-app-next && npm run dev"

echo.
echo ✅ 服务启动完成！
echo.
echo 📋 可用地址：
echo   - 前端: http://localhost:3000
echo   - 数据库管理: http://localhost:3000/db-admin
echo   - 后端API: http://localhost:3001
echo   - 健康检查: http://localhost:3001/health
echo.
echo 💡 提示：等待几秒钟让服务完全启动，然后访问上述地址
echo.
pause
