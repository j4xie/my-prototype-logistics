@echo off
:: ===================================
:: 一键停止所有开发服务
:: ===================================

echo.
echo ====================================
echo  停止所有开发服务
echo ====================================
echo.

echo 正在停止服务...
echo.

:: 杀死占用特定端口的进程
echo [1] 停止后端服务 (端口 3001)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do (
    taskkill /F /PID %%a 2>nul
)

echo [2] 停止React Native (端口 8081)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8081') do (
    taskkill /F /PID %%a 2>nul
)

echo [3] 停止React Native (端口 19000-19006)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :19000') do (
    taskkill /F /PID %%a 2>nul
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :19001') do (
    taskkill /F /PID %%a 2>nul
)

echo [4] 停止Web前端 (端口 3000) 如果在运行...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    taskkill /F /PID %%a 2>nul
)

echo [5] 停止Node进程...
taskkill /F /IM node.exe 2>nul

echo.
echo ====================================
echo  ✓ 所有服务已停止
echo ====================================
echo.
echo 提示: MySQL服务保持运行（数据库服务）
echo.
pause