@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo ================================================================
echo                    MySQL 状态检查
echo ================================================================
echo.

echo [INFO] 检查 MySQL 服务状态...
echo.

REM 检查 MySQL 服务是否存在
echo [DEBUG] 检查 MySQL 服务是否已安装...
sc query mysql >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] MySQL 服务已安装
    
    REM 获取详细的服务状态
    echo [DEBUG] MySQL 服务详细状态:
    sc query mysql
    echo.
    
    REM 检查服务是否正在运行
    sc query mysql | findstr "STATE" | findstr "RUNNING" >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] MySQL 服务正在运行
    ) else (
        echo [WARN] MySQL 服务未运行
        echo [INFO] 尝试启动 MySQL 服务...
        net start mysql
        if %errorlevel% equ 0 (
            echo [OK] MySQL 服务启动成功
        ) else (
            echo [ERROR] MySQL 服务启动失败
        )
    )
) else (
    echo [ERROR] MySQL 服务未安装
    echo.
    echo [INFO] 可能的解决方案:
    echo 1. 安装 MySQL: https://dev.mysql.com/downloads/installer/
    echo 2. 使用 XAMPP: https://www.apachefriends.org/
    echo 3. 使用 Chocolatey: choco install mysql
)

echo.
echo [INFO] 检查 MySQL 替代服务名称...

REM 检查其他可能的 MySQL 服务名称
set services=mysql80 mysql81 mysql82 mysql57 mysql56 mysqld MariaDB
for %%s in (%services%) do (
    echo [DEBUG] 检查服务: %%s
    sc query %%s >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] 发现 MySQL 相关服务: %%s
        sc query %%s | findstr "STATE"
    )
)

echo.
echo [INFO] 检查 MySQL 端口...
netstat -an | findstr ":3306" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] 端口 3306 正在监听
    echo [DEBUG] 端口 3306 详细信息:
    netstat -an | findstr ":3306"
) else (
    echo [WARN] 端口 3306 未监听
)

echo.
echo [INFO] 检查 MySQL 命令行工具...
where mysql >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] MySQL 命令行工具可用
    mysql --version
) else (
    echo [WARN] MySQL 命令行工具不可用
)

echo.
echo ================================================================
echo                    建议操作
echo ================================================================
echo.

sc query mysql >nul 2>&1
if %errorlevel% neq 0 (
    echo [ACTION] 请先安装 MySQL:
    echo 1. 运行: setup-mysql-windows.bat
    echo 2. 或访问: https://dev.mysql.com/downloads/installer/
    echo 3. 下载并安装 MySQL Community Server
    echo.
) else (
    sc query mysql | findstr "STATE" | findstr "RUNNING" >nul 2>&1
    if %errorlevel% neq 0 (
        echo [ACTION] 请启动 MySQL 服务:
        echo 1. 运行: net start mysql
        echo 2. 或在服务管理器中启动 MySQL 服务
        echo.
    ) else (
        echo [SUCCESS] MySQL 服务运行正常，可以继续运行系统！
        echo.
    )
)

pause