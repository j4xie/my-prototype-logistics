@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

REM 快速端口检查脚本 - Windows版本
title 端口检查工具

echo.
echo ================================================================
echo                   快速端口检查工具
echo                海牛食品溯源系统
echo ================================================================
echo.

echo [INFO] 检测当前系统端口状态...
echo.

REM 检测后端端口
set BACKEND_PORT=
for /l %%p in (3000,1,3010) do (
    curl -s http://localhost:%%p/health >nul 2>&1
    if !errorlevel! equ 0 (
        set BACKEND_PORT=%%p
        goto :backend_found
    )
)
:backend_found

REM 检测前端端口
set FRONTEND_PORT=
for /l %%p in (3000,1,3010) do (
    if not "%%p"=="%BACKEND_PORT%" (
        curl -s http://localhost:%%p >nul 2>&1
        if !errorlevel! equ 0 (
            set FRONTEND_PORT=%%p
            goto :frontend_found
        )
    )
)
:frontend_found

echo ================================================================
echo                    当前访问地址
echo ================================================================

if not "%FRONTEND_PORT%"=="" (
    echo   前端应用: http://localhost:%FRONTEND_PORT%
) else (
    echo   前端应用: 未检测到运行中的前端服务
)

if not "%BACKEND_PORT%"=="" (
    echo   后端API:  http://localhost:%BACKEND_PORT%
    echo   健康检查: http://localhost:%BACKEND_PORT%/health
) else (
    echo   后端API:  未检测到运行中的后端服务
)

echo ================================================================
echo.

echo [INFO] 服务状态详情:
echo.

if not "%BACKEND_PORT%"=="" (
    echo [OK] 后端服务: 正常运行 (端口 %BACKEND_PORT%)
) else (
    echo [WARN] 后端服务: 未运行或异常
)

if not "%FRONTEND_PORT%"=="" (
    echo [OK] 前端服务: 正常运行 (端口 %FRONTEND_PORT%)
) else (
    echo [WARN] 前端服务: 未运行或异常
)

echo.
echo [TIP] 提示: 如果地址发生变化，可以随时运行此脚本获取最新信息
echo.

echo ================================================================
echo                        管理命令
echo ================================================================
echo   启动系统: run-system.bat
echo   停止系统: 关闭相关命令行窗口
echo   查看日志: 查看 backend\logs\ 和 frontend\web-app-next\logs\
echo ================================================================
echo.

pause