@echo off
echo 正在以管理员权限设置MCP服务自动启动...

:: 以管理员权限运行
powershell -Command "Start-Process cmd -ArgumentList '/c cd /d %~dp0 && node setup-autostart.js && pause' -Verb RunAs"

echo 请在UAC提示框中选择"是"授予管理员权限。 