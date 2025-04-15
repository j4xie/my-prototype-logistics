@echo off
echo 食品溯源系统 - 端到端测试启动脚本
echo --------------------------------------

rem 获取当前目录
set SCRIPT_DIR=%~dp0

rem 运行测试脚本
node "%SCRIPT_DIR%run-e2e-tests.js" %*

rem 显示结束信息
echo --------------------------------------
echo 测试运行结束 