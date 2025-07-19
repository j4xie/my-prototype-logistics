@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

REM MySQL Windows 安装和配置脚本
title MySQL 安装向导

echo.
echo ================================================================
echo                   MySQL 安装向导
echo                海牛食品溯源系统
echo ================================================================
echo.

echo [INFO] 检查MySQL服务状态...

REM 检查MySQL是否已安装
sc query mysql >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] MySQL服务已安装
    
    REM 检查MySQL服务状态
    sc query mysql | findstr "STATE" | findstr "RUNNING" >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] MySQL服务正在运行
        goto :mysql_ready
    ) else (
        echo [WARN] MySQL服务已安装但未运行
        echo [INFO] 尝试启动MySQL服务...
        net start mysql
        if %errorlevel% equ 0 (
            echo [OK] MySQL服务启动成功
            goto :mysql_ready
        ) else (
            echo [ERROR] MySQL服务启动失败
            goto :manual_start
        )
    )
) else (
    echo [WARN] MySQL服务未安装
    goto :install_guide
)

:mysql_ready
echo.
echo [SUCCESS] MySQL服务已就绪！
echo [INFO] 可以继续运行系统启动脚本
echo.
goto :end

:manual_start
echo.
echo [INFO] 请手动启动MySQL服务:
echo   1. 按 Win+R，输入 services.msc 打开服务管理器
echo   2. 找到 MySQL 服务
echo   3. 右键点击选择"启动"
echo   4. 或者以管理员身份运行命令提示符，执行: net start mysql
echo.
goto :end

:install_guide
echo.
echo [INFO] MySQL安装指南:
echo.
echo 方法1: 使用MySQL官方安装程序
echo   1. 访问 https://dev.mysql.com/downloads/installer/
echo   2. 下载 MySQL Installer for Windows
echo   3. 运行安装程序，选择"Developer Default"
echo   4. 按照向导完成安装和配置
echo.
echo 方法2: 使用Chocolatey包管理器
echo   1. 以管理员身份运行PowerShell
echo   2. 安装Chocolatey: 
echo      Set-ExecutionPolicy Bypass -Scope Process -Force; 
echo      [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; 
echo      iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
echo   3. 安装MySQL: choco install mysql
echo.
echo 方法3: 使用XAMPP (适合开发环境)
echo   1. 访问 https://www.apachefriends.org/
echo   2. 下载XAMPP for Windows
echo   3. 安装并启动MySQL服务
echo.
echo [IMPORTANT] 安装完成后请记住以下信息:
echo   - MySQL端口: 3306 (默认)
echo   - 用户名: root
echo   - 密码: (安装时设置的密码)
echo.

:end
echo ================================================================
echo                        后续步骤
echo ================================================================
echo   1. 确保MySQL服务正在运行
echo   2. 运行系统启动脚本: run-system.bat
echo   3. 如遇问题，请检查日志文件
echo ================================================================
echo.

pause