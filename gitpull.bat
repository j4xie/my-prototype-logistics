@echo off
setlocal

REM 保存当前分支名称
for /f "tokens=* USEBACKQ" %%F in (`git rev-parse --abbrev-ref HEAD`) do set branch=%%F

REM 执行 git pull
echo 正在从远程仓库拉取更新 (当前分支: %branch%)...
git pull

if %ERRORLEVEL% NEQ 0 (
    echo 错误：拉取更新失败！
    exit /b 1
)

echo 已成功拉取最新更新！ 