@echo off
echo 在WSL中运行项目...
echo.

:: 启动后端
echo 启动后端服务...
start "Backend in WSL" wsl -d Ubuntu-22.04 -e bash -c "cd /mnt/c/Users/Steve/heiniu/backend && npm run dev"

:: 等待后端启动
timeout /t 3 /nobreak > nul

:: 启动前端
echo 启动前端服务...
start "Frontend in WSL" wsl -d Ubuntu-22.04 -e bash -c "cd /mnt/c/Users/Steve/heiniu/frontend/web-app-next && npm run dev"

echo.
echo 服务已在WSL中启动！
echo 前端: http://localhost:3000
echo 后端: http://localhost:3001
pause