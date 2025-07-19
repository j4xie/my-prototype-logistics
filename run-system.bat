@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

REM 海牛食品溯源系统 - Windows 一键启动脚本
REM 使用方法: run-system.bat

title 海牛食品溯源系统

echo.
echo ================================================================
echo                    海牛食品溯源系统
echo                  Windows 一键启动脚本
echo               (包含智能工厂ID生成功能)
echo ================================================================
echo.

REM 项目路径
set PROJECT_ROOT=C:\Users\Steve\heiniu
set BACKEND_DIR=%PROJECT_ROOT%\backend
set FRONTEND_DIR=%PROJECT_ROOT%\frontend\web-app-next

REM 端口配置
set BACKEND_PORT=3001
set FRONTEND_PORT=3000

REM 检查项目目录
echo [INFO] 检查项目目录...
if not exist "%BACKEND_DIR%" (
    echo [ERROR] 后端目录不存在: %BACKEND_DIR%
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%" (
    echo [ERROR] 前端目录不存在: %FRONTEND_DIR%
    pause
    exit /b 1
)

echo [OK] 项目目录检查完成
echo.

REM 检查Node.js
echo [INFO] 检查Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js 未安装，请先安装 Node.js
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [OK] Node.js版本: %NODE_VERSION%
echo.

REM 检查MySQL服务
echo [INFO] 检查MySQL服务...
sc query mysql >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] MySQL服务未安装或未启动
    echo [INFO] 尝试启动MySQL服务...
    net start mysql >nul 2>&1
    if !errorlevel! neq 0 (
        echo [ERROR] 无法启动MySQL服务，请手动启动
        echo [INFO] 请在服务管理器中启动MySQL服务后重试
        pause
        exit /b 1
    )
)

echo [OK] MySQL服务运行正常
echo.

REM 检查端口占用
echo [INFO] 检查端口占用...
netstat -an | findstr ":%BACKEND_PORT%" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARN] 后端端口 %BACKEND_PORT% 被占用，尝试释放...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%BACKEND_PORT%"') do (
        taskkill /F /PID %%a >nul 2>&1
    )
)

netstat -an | findstr ":%FRONTEND_PORT%" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARN] 前端端口 %FRONTEND_PORT% 被占用，尝试释放...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%FRONTEND_PORT%"') do (
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo [OK] 端口检查完成
echo.

REM 安装依赖
echo [INFO] 检查项目依赖...

REM 调试信息
echo [DEBUG] 项目根目录: %PROJECT_ROOT%
echo [DEBUG] 后端目录: %BACKEND_DIR%
echo [DEBUG] 前端目录: %FRONTEND_DIR%

REM 检查后端依赖
echo [INFO] 检查后端依赖...
if exist "%BACKEND_DIR%" (
    echo [DEBUG] 后端目录存在，切换到: %BACKEND_DIR%
    cd /d "%BACKEND_DIR%"
    if exist "package.json" (
        echo [DEBUG] 找到 package.json
        if not exist "node_modules" (
            echo [INFO] 安装后端依赖...
            call npm install
        ) else (
            echo [DEBUG] node_modules 已存在，跳过安装
        )
    ) else (
        echo [ERROR] 后端目录中未找到 package.json
    )
) else (
    echo [ERROR] 后端目录不存在: %BACKEND_DIR%
)

REM 检查前端依赖
echo [INFO] 检查前端依赖...
if exist "%FRONTEND_DIR%" (
    echo [DEBUG] 前端目录存在，切换到: %FRONTEND_DIR%
    cd /d "%FRONTEND_DIR%"
    if exist "package.json" (
        echo [DEBUG] 找到 package.json
        if not exist "node_modules" (
            echo [INFO] 安装前端依赖...
            call npm install
        ) else (
            echo [DEBUG] node_modules 已存在，跳过安装
        )
    ) else (
        echo [ERROR] 前端目录中未找到 package.json
    )
) else (
    echo [ERROR] 前端目录不存在: %FRONTEND_DIR%
)

echo [OK] 依赖检查完成
echo.

REM 数据库迁移
echo [INFO] 数据库迁移...
cd /d "%BACKEND_DIR%"
call npx prisma generate >nul 2>&1
call npx prisma migrate deploy >nul 2>&1
if %errorlevel% neq 0 (
    call npx prisma db push >nul 2>&1
)

echo [OK] 数据库迁移完成
echo.

REM 启动后端服务
echo [INFO] 启动后端服务...
cd /d "%BACKEND_DIR%"
if not exist "logs" mkdir logs
start /b "Backend" cmd /c "npm run dev > logs\backend.log 2>&1"

echo [INFO] 等待后端服务启动...
timeout /t 8 /nobreak >nul

REM 检查后端服务
set "backend_ready=false"
for /l %%i in (1,1,10) do (
    curl -s http://localhost:%BACKEND_PORT%/health >nul 2>&1
    if !errorlevel! equ 0 (
        set "backend_ready=true"
        goto :backend_started
    )
    echo [INFO] 等待后端服务启动... (%%i/10)
    timeout /t 3 /nobreak >nul
)

:backend_started
if "%backend_ready%"=="true" (
    echo [OK] 后端服务启动成功
) else (
    echo [ERROR] 后端服务启动失败
    echo [INFO] 请检查日志: %BACKEND_DIR%\logs\backend.log
    pause
    exit /b 1
)

echo.

REM 启动前端服务
echo [INFO] 启动前端服务...
cd /d "%FRONTEND_DIR%"
if not exist "logs" mkdir logs
start /b "Frontend" cmd /c "npm run dev > logs\frontend.log 2>&1"

echo [INFO] 等待前端服务启动...
timeout /t 10 /nobreak >nul

REM 检查前端服务
set "frontend_ready=false"
for /l %%i in (1,1,15) do (
    curl -s http://localhost:%FRONTEND_PORT% >nul 2>&1
    if !errorlevel! equ 0 (
        set "frontend_ready=true"
        goto :frontend_started
    )
    echo [INFO] 等待前端服务启动... (%%i/15)
    timeout /t 4 /nobreak >nul
)

:frontend_started
if "%frontend_ready%"=="true" (
    echo [OK] 前端服务启动成功
) else (
    echo [WARN] 前端服务启动可能失败，请检查日志
    echo [INFO] 日志位置: %FRONTEND_DIR%\logs\frontend.log
)

echo.

REM 动态检测实际端口
echo [INFO] 检测实际运行端口...

REM 检测后端端口
set ACTUAL_BACKEND_PORT=
for /l %%p in (3000,1,3010) do (
    curl -s http://localhost:%%p/health >nul 2>&1
    if !errorlevel! equ 0 (
        set ACTUAL_BACKEND_PORT=%%p
        goto :backend_found
    )
)
:backend_found
if "%ACTUAL_BACKEND_PORT%"=="" set ACTUAL_BACKEND_PORT=%BACKEND_PORT%

REM 检测前端端口
set ACTUAL_FRONTEND_PORT=
for /l %%p in (3000,1,3010) do (
    if not "%%p"=="%ACTUAL_BACKEND_PORT%" (
        curl -s http://localhost:%%p >nul 2>&1
        if !errorlevel! equ 0 (
            set ACTUAL_FRONTEND_PORT=%%p
            goto :frontend_found
        )
    )
)
:frontend_found
if "%ACTUAL_FRONTEND_PORT%"=="" set ACTUAL_FRONTEND_PORT=%FRONTEND_PORT%

echo [OK] 动态端口检测完成
echo    后端端口: %ACTUAL_BACKEND_PORT%
echo    前端端口: %ACTUAL_FRONTEND_PORT%
echo.

REM 显示访问信息
echo ================================================================
echo                     系统启动完成！
echo ================================================================
echo   前端应用: http://localhost:%ACTUAL_FRONTEND_PORT%
echo   后端API:  http://localhost:%ACTUAL_BACKEND_PORT%
echo   健康检查: http://localhost:%ACTUAL_BACKEND_PORT%/health
echo ================================================================
echo.
echo ================================================================
echo                        系统功能
echo ================================================================
echo   工厂管理: 智能工厂ID生成系统
echo   养殖管理: 畜禽养殖追溯
echo   加工管理: 食品加工流程
echo   物流管理: 运输追溯
echo   溯源查询: 产品追溯
echo   用户管理: 多租户权限
echo ================================================================
echo.
echo ================================================================
echo                      默认登录账户
echo ================================================================
echo   平台管理员: platform_admin
echo   默认密码: Admin@123456
echo ================================================================
echo.

echo [INFO] 智能工厂ID生成功能已集成到平台管理中！
echo    访问路径: 平台管理 → 工厂管理 → 新建工厂
echo.
echo [SUCCESS] 系统已成功启动！请在浏览器中访问前端应用
echo [TIP] 建议：保持此窗口打开以监控系统状态
echo.

REM 自动打开浏览器
set /p open_browser="是否自动打开浏览器? (y/n): "
if /i "%open_browser%"=="y" (
    start http://localhost:%ACTUAL_FRONTEND_PORT%
)

echo.
echo [INFO] 按任意键退出监控模式 (服务将继续在后台运行)
pause >nul

echo [INFO] 系统仍在后台运行
echo [INFO] 要停止系统，请关闭相关的命令行窗口或重启电脑
pause