@echo off
setlocal enabledelayedexpansion

REM Git工具脚本 - 简化Git操作的批处理版本

set "command=%~1"
set "args=%~2"

if "%command%"=="" goto :help

REM 根据命令参数执行相应操作
if "%command%"=="push" goto :push
if "%command%"=="s" goto :status
if "%command%"=="a" goto :add_all
if "%command%"=="c" goto :commit
if "%command%"=="p" goto :push_remote
if "%command%"=="b" goto :list_branches
if "%command%"=="co" goto :checkout
if "%command%"=="l" goto :log
if "%command%"=="help" goto :help

echo 未知命令: %command%
goto :help

:push
if "%args%"=="" (
    echo 错误: 提交信息不能为空
    exit /b 1
)
echo 添加所有更改...
git add .
echo 提交更改: %args%
git commit -m "%args%"
echo 推送到远程仓库...
git push
echo 操作完成!
goto :end

:status
echo 当前Git状态:
git status -s
goto :end

:add_all
echo 添加所有更改...
git add .
git status -s
goto :end

:commit
if "%args%"=="" (
    echo 错误: 提交信息不能为空
    exit /b 1
)
echo 提交更改: %args%
git commit -m "%args%"
goto :end

:push_remote
echo 推送到远程仓库...
git push
goto :end

:list_branches
echo 分支列表:
git branch -a
goto :end

:checkout
if "%args%"=="" (
    echo 错误: 分支名不能为空
    exit /b 1
)
echo 切换到分支: %args%
git checkout %args%
goto :end

:log
if "%args%"=="" (
    set "count=5"
) else (
    set "count=%args%"
)
echo 最近 !count! 条提交记录:
git log --oneline -n !count!
goto :end

:help
echo Git工具脚本 - 简化Git操作
echo 用法: git-tools ^<命令^> [参数]
echo.
echo 可用命令:
echo   push ^<message^>    - 添加所有更改、提交并推送
echo   s                 - 查看简洁状态
echo   a                 - 添加所有更改
echo   c ^<message^>       - 提交更改
echo   p                 - 推送到远程仓库
echo   b                 - 列出分支
echo   co ^<branch^>       - 切换分支
echo   l [count]         - 查看最近提交记录
echo   help              - 显示此帮助信息
goto :end

:end
endlocal 