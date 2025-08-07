@echo off
echo ========================================
echo 启动后端和React Native开发环境
echo ========================================
echo.

echo 1. 检查MySQL服务状态...
sc query MySQL80 | find "RUNNING" >nul
if %errorlevel% neq 0 (
    echo MySQL80服务未运行，正在启动...
    net start MySQL80
    timeout /t 3 /nobreak > nul
) else (
    echo MySQL80服务已在运行
)

echo.
echo 2. 启动后端服务 (端口 3001)...
cd backend
start cmd /k "npm run dev"

echo.
echo 3. 等待后端启动...
timeout /t 5 /nobreak > nul

echo.
echo 4. 启动React Native (Expo) 服务...
cd ../frontend/HainiuFoodTrace
start cmd /k "npx expo start"

echo.
echo ========================================
echo 开发环境已启动！
echo.
echo MySQL: 运行中
echo 后端API: http://localhost:3001
echo React Native: http://localhost:8081
echo.
echo 注意: Web前端未启动 (按需求)
echo.
echo 测试账号: admin / Admin@123456
echo ========================================
echo.
pause