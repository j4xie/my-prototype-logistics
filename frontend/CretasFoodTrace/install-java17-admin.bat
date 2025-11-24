@echo off
chcp 65001 >nul
echo ========================================
echo   自动安装 Java 17 (需要管理员权限)
echo ========================================
echo.

:: 检查管理员权限
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 此脚本需要管理员权限
    echo.
    echo 请按照以下步骤操作：
    echo 1. 右键点击此文件
    echo 2. 选择"以管理员身份运行"
    echo.
    pause
    exit /b 1
)

echo [完成] 管理员权限检查通过
echo.

:: 检查 Chocolatey
where choco >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未找到 Chocolatey
    echo 请先安装 Chocolatey 或使用手动安装方式
    pause
    exit /b 1
)

echo [完成] Chocolatey 已安装
choco --version
echo.

echo ========================================
echo 开始安装 Java 17
echo ========================================
echo.
echo 这可能需要 3-5 分钟...
echo.

choco install temurin17 -y

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [错误] Java 17 安装失败
    echo 请查看上方错误信息，或尝试手动安装
    echo 手动安装步骤请查看：安装Java17步骤.txt
    pause
    exit /b 1
)

echo.
echo ========================================
echo 安装成功！验证中...
echo ========================================
echo.

:: 刷新环境变量
call refreshenv

echo Java 版本：
java -version
echo.

echo JAVA_HOME：
echo %JAVA_HOME%
echo.

echo ========================================
echo 安装完成！
echo ========================================
echo.
echo 下一步操作：
echo 1. 关闭所有终端窗口
echo 2. 重新打开终端
echo 3. 运行构建命令：
echo    cd C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\android
echo    .\gradlew.bat assembleRelease
echo.

pause


