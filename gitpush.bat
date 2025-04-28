@echo off
setlocal

REM 检查是否提供了提交信息
if "%~1"=="" (
    echo 错误：请提供提交信息！
    echo 使用方法: gitpush "你的提交信息"
    exit /b 1
)

REM 保存当前分支名称
for /f "tokens=* USEBACKQ" %%F in (`git rev-parse --abbrev-ref HEAD`) do set branch=%%F

REM 执行 git 操作
echo 正在添加更改的文件...
git add .

if %ERRORLEVEL% NEQ 0 (
    echo 错误：添加文件失败！
    exit /b 1
)

echo 正在提交更改...
git commit -m "%~1"

if %ERRORLEVEL% NEQ 0 (
    echo 错误：提交更改失败！
    exit /b 1
)

echo 正在推送到远程仓库 (当前分支: %branch%)...
git push

if %ERRORLEVEL% NEQ 0 (
    echo 错误：推送到远程仓库失败！
    exit /b 1
)

echo 已成功推送更改到远程仓库！ 