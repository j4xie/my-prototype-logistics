@echo off
echo 配置Windows以连接WSL中的MySQL...
echo.

:: 设置端口转发
echo 设置端口转发 (Windows localhost:3306 -> WSL MySQL)...
netsh interface portproxy add v4tov4 listenport=3306 listenaddress=127.0.0.1 connectport=3306 connectaddress=172.20.244.113

:: 显示当前端口转发
echo.
echo 当前端口转发配置:
netsh interface portproxy show all

echo.
echo 配置完成！现在可以通过 localhost:3306 连接MySQL了。
echo.
echo 注意：如果WSL IP地址变化，需要重新运行此脚本。
pause