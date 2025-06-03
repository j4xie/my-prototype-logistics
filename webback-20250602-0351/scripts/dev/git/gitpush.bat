@echo off
setlocal enabledelayedexpansion

:: 检查是否提供了提交信息
if "%~1"=="" (
    echo 错误: 请提供提交信息
    echo 用法: gitpush "你的提交信息"
    exit /b 1
)

:: 获取提交信息（支持带空格的信息）
set "commit_message=%*"

:: 检查是否在Git仓库中
if not exist ".git" (
    echo 错误: 当前目录不是Git仓库
    exit /b 1
)

echo.
echo 🔄 开始Git推送流程...
echo 提交信息: %commit_message%
echo.

:: 1. 添加所有更改
echo 📁 添加所有更改 (git add .)...
git add .
if errorlevel 1 (
    echo ❌ git add 失败
    exit /b 1
)

:: 检查是否有更改需要提交
git status --porcelain > temp_status.txt
set /p status_check=<temp_status.txt
del temp_status.txt

if "%status_check%"=="" (
    echo ℹ️  没有更改需要提交
    exit /b 0
)

:: 2. 提交更改
echo 💾 提交更改 (git commit)...
git commit -m "%commit_message%"
if errorlevel 1 (
    echo ❌ git commit 失败
    exit /b 1
)

:: 3. 推送到远程仓库
echo 🚀 推送到远程仓库 (git push)...
git push
if errorlevel 1 (
    echo ❌ git push 失败
    exit /b 1
)

echo.
echo ✅ Git推送完成!
echo 提交信息: %commit_message%
echo. 