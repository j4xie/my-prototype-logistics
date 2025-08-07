@echo off
echo ========================================
echo 启动本地开发环境
echo ========================================
echo.

echo 1. 启动后端服务 (端口 3001)...
cd backend
start cmd /k "npm run dev"

echo.
echo 2. 等待后端启动...
timeout /t 5 /nobreak > nul

echo.
echo 3. 启动前端服务 (端口 3000)...
cd ../frontend/web-app-next
start cmd /k "npm run dev"

echo.
echo ========================================
echo 本地环境已启动！
echo.
echo 后端: http://localhost:3001
echo 前端: http://localhost:3000
echo.
echo 测试账号: admin / Admin@123456
echo ========================================
echo.
pause