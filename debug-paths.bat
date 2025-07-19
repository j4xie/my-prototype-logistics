@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo ================================================================
echo                    路径诊断工具
echo ================================================================
echo.

REM 项目路径
set PROJECT_ROOT=C:\Users\Steve\heiniu
set BACKEND_DIR=%PROJECT_ROOT%\backend
set FRONTEND_DIR=%PROJECT_ROOT%\frontend\web-app-next

echo [INFO] 检查项目路径...
echo.

echo [DEBUG] 项目根目录: %PROJECT_ROOT%
if exist "%PROJECT_ROOT%" (
    echo [OK] 项目根目录存在
) else (
    echo [ERROR] 项目根目录不存在
)

echo.
echo [DEBUG] 后端目录: %BACKEND_DIR%
if exist "%BACKEND_DIR%" (
    echo [OK] 后端目录存在
    if exist "%BACKEND_DIR%\package.json" (
        echo [OK] 后端 package.json 存在
    ) else (
        echo [WARN] 后端 package.json 不存在
    )
    if exist "%BACKEND_DIR%\node_modules" (
        echo [OK] 后端 node_modules 存在
    ) else (
        echo [WARN] 后端 node_modules 不存在
    )
) else (
    echo [ERROR] 后端目录不存在
)

echo.
echo [DEBUG] 前端目录: %FRONTEND_DIR%
if exist "%FRONTEND_DIR%" (
    echo [OK] 前端目录存在
    if exist "%FRONTEND_DIR%\package.json" (
        echo [OK] 前端 package.json 存在
    ) else (
        echo [WARN] 前端 package.json 不存在
    )
    if exist "%FRONTEND_DIR%\node_modules" (
        echo [OK] 前端 node_modules 存在
    ) else (
        echo [WARN] 前端 node_modules 不存在
    )
) else (
    echo [ERROR] 前端目录不存在
)

echo.
echo [INFO] 检查当前工作目录...
echo [DEBUG] 当前目录: %CD%

echo.
echo [INFO] 检查替代前端路径...
set ALT_FRONTEND_DIR=%PROJECT_ROOT%\frontend
echo [DEBUG] 替代前端目录: %ALT_FRONTEND_DIR%
if exist "%ALT_FRONTEND_DIR%" (
    echo [OK] 替代前端目录存在
    if exist "%ALT_FRONTEND_DIR%\package.json" (
        echo [OK] 替代前端 package.json 存在
    ) else (
        echo [WARN] 替代前端 package.json 不存在
    )
) else (
    echo [ERROR] 替代前端目录不存在
)

echo.
echo [INFO] 列出目录内容...
if exist "%PROJECT_ROOT%" (
    echo [DEBUG] 项目根目录内容:
    dir /b "%PROJECT_ROOT%"
    echo.
)

if exist "%PROJECT_ROOT%\frontend" (
    echo [DEBUG] frontend 目录内容:
    dir /b "%PROJECT_ROOT%\frontend"
    echo.
)

echo ================================================================
echo                    诊断完成
echo ================================================================

pause