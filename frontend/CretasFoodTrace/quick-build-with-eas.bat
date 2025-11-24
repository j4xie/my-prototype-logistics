@echo off
chcp 65001 >nul
echo ========================================
echo   EAS Cloud Build - 无需本地 Java
echo   CretasFoodTrace 食品溯源系统
echo ========================================
echo.
echo 使用 Expo 云端构建服务，无需配置本地 Java 环境
echo.

:: 检查是否在正确的目录
if not exist "package.json" (
    echo [错误] 请在 frontend/CretasFoodTrace 目录下运行此脚本
    pause
    exit /b 1
)

echo ========================================
echo 步骤 1/4: 检查 EAS CLI
echo ========================================

:: 检查 EAS CLI
where eas >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [信息] 未找到 EAS CLI，正在安装...
    call npm install -g eas-cli
    if %ERRORLEVEL% NEQ 0 (
        echo [错误] EAS CLI 安装失败
        pause
        exit /b 1
    )
    echo [完成] EAS CLI 安装成功
) else (
    echo [完成] EAS CLI 已安装
    call eas --version
)

echo.
echo ========================================
echo 步骤 2/4: 登录 Expo 账户
echo ========================================
echo.
echo 如果您还没有 Expo 账户，请访问 https://expo.dev/ 注册
echo.

call eas whoami
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo 请登录您的 Expo 账户：
    call eas login
    if %ERRORLEVEL% NEQ 0 (
        echo [错误] 登录失败
        pause
        exit /b 1
    )
)

echo [完成] 已登录

echo.
echo ========================================
echo 步骤 3/4: 配置 EAS Build
echo ========================================

if not exist "eas.json" (
    echo [信息] 首次使用，正在配置...
    call eas build:configure
    if %ERRORLEVEL% NEQ 0 (
        echo [错误] 配置失败
        pause
        exit /b 1
    )
    echo [完成] 配置成功
) else (
    echo [完成] EAS 已配置
)

echo.
echo ========================================
echo 步骤 4/4: 开始云端构建
echo ========================================
echo.
echo 构建选项:
echo [1] Preview APK - 可直接安装的测试版本（推荐）
echo [2] Development APK - 开发调试版本
echo [3] Production AAB - 上架 Google Play 商店版本
echo.
set /p BUILD_PROFILE="请选择构建类型 (1-3): "

if "%BUILD_PROFILE%"=="1" (
    set PROFILE=preview
    echo.
    echo [信息] 构建 Preview APK...
) else if "%BUILD_PROFILE%"=="2" (
    set PROFILE=development
    echo.
    echo [信息] 构建 Development APK...
) else if "%BUILD_PROFILE%"=="3" (
    set PROFILE=production
    echo.
    echo [信息] 构建 Production AAB...
) else (
    echo [错误] 无效的选项
    pause
    exit /b 1
)

echo.
echo 正在提交构建任务到云端...
echo 这通常需要 5-15 分钟，请耐心等待
echo.

call eas build --platform android --profile %PROFILE%

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo 构建任务已提交成功！
    echo ========================================
    echo.
    echo 您可以：
    echo 1. 在命令行等待构建完成
    echo 2. 访问 https://expo.dev/accounts/[你的账户]/builds 查看进度
    echo 3. 构建完成后会收到下载链接
    echo.
    echo 提示：即使关闭此窗口，构建仍会继续在云端进行
    echo.
) else (
    echo.
    echo [错误] 构建任务提交失败
    echo 请检查网络连接和账户权限
    pause
    exit /b 1
)

pause


