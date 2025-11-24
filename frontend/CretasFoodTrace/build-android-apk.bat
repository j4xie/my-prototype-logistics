@echo off
chcp 65001 >nul
echo ========================================
echo   Android APK 本地构建脚本
echo   CretasFoodTrace 食品溯源系统
echo ========================================
echo.

:: 检查是否在正确的目录
if not exist "package.json" (
    echo [错误] 请在 frontend/CretasFoodTrace 目录下运行此脚本
    pause
    exit /b 1
)

:: 显示构建选项
echo 请选择构建类型:
echo [1] Debug APK (开发调试版本)
echo [2] Release APK (发布版本)
echo.
set /p BUILD_TYPE="请输入选项 (1 或 2): "

if "%BUILD_TYPE%"=="1" (
    set VARIANT=Debug
    set BUILD_CMD=assembleDebug
) else if "%BUILD_TYPE%"=="2" (
    set VARIANT=Release
    set BUILD_CMD=assembleRelease
) else (
    echo [错误] 无效的选项
    pause
    exit /b 1
)

echo.
echo ========================================
echo 步骤 1/5: 检查环境
echo ========================================

:: 检查 Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)
echo [完成] Node.js 版本:
node --version

:: 检查 Java
where java >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未找到 Java，请先安装 JDK 17
    echo 下载地址: https://adoptium.net/
    pause
    exit /b 1
)
echo [完成] Java 版本:
java -version

:: 检查 ANDROID_HOME
if "%ANDROID_HOME%"=="" (
    echo [警告] 未设置 ANDROID_HOME 环境变量
    echo 尝试使用默认路径...
    set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
)
echo [信息] ANDROID_HOME: %ANDROID_HOME%

echo.
echo ========================================
echo 步骤 2/5: 清理旧构建
echo ========================================
if exist "android\app\build\outputs\apk" (
    echo 清理旧的 APK 文件...
    rmdir /s /q "android\app\build\outputs\apk"
)
echo [完成] 清理完成

echo.
echo ========================================
echo 步骤 3/5: 安装依赖
echo ========================================
echo 正在检查 node_modules...
if not exist "node_modules" (
    echo 首次构建，正在安装依赖（这可能需要几分钟）...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo [完成] 依赖已存在
)

echo.
echo ========================================
echo 步骤 4/5: 构建 %VARIANT% APK
echo ========================================
echo 开始构建... (这可能需要 3-10 分钟)
echo.

cd android

:: 使用 gradlew 构建
echo 执行命令: gradlew.bat %BUILD_CMD%
call gradlew.bat %BUILD_CMD%

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [错误] APK 构建失败
    cd ..
    pause
    exit /b 1
)

cd ..

echo.
echo ========================================
echo 步骤 5/5: 定位 APK 文件
echo ========================================

if "%BUILD_TYPE%"=="1" (
    set APK_PATH=android\app\build\outputs\apk\debug\app-debug.apk
    set APK_NAME=CretasFoodTrace-debug.apk
) else (
    set APK_PATH=android\app\build\outputs\apk\release\app-release.apk
    set APK_NAME=CretasFoodTrace-release.apk
)

if exist "%APK_PATH%" (
    echo [成功] APK 构建完成！
    echo.
    echo APK 文件位置:
    echo %CD%\%APK_PATH%
    echo.
    
    :: 复制到项目根目录方便查找
    copy "%APK_PATH%" "%APK_NAME%" >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo 已复制到项目根目录: %APK_NAME%
        echo.
    )
    
    :: 显示文件信息
    echo 文件大小:
    dir "%APK_PATH%" | findstr /C:"%APK_NAME%"
    echo.
    
    echo ========================================
    echo 构建成功！
    echo ========================================
    echo.
    echo 下一步操作:
    echo 1. 将 APK 传输到 Android 设备
    echo 2. 在设备上安装 APK
    echo 3. 允许"未知来源"安装权限（如需要）
    echo.
    
    :: 询问是否打开文件夹
    set /p OPEN_FOLDER="是否打开 APK 所在文件夹？(Y/N): "
    if /i "%OPEN_FOLDER%"=="Y" (
        explorer /select,"%APK_PATH%"
    )
) else (
    echo [错误] 找不到生成的 APK 文件
    echo 预期位置: %APK_PATH%
    pause
    exit /b 1
)

echo.
pause


