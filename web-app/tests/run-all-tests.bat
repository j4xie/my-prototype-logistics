@echo off
echo =======================================
echo      食品溯源系统 - 测试执行脚本
echo =======================================
echo.

:: 设置路径
set ROOT_DIR=%~dp0..
cd %ROOT_DIR%

:: 解析命令行参数
set RUN_UNIT=true
set RUN_INTEGRATION=true
set RUN_E2E=true
set RUN_SECURITY=true
set VERBOSE=false

:parse_args
if "%~1"=="" goto :end_parse_args
if /i "%~1"=="--unit-only" (
    set RUN_UNIT=true
    set RUN_INTEGRATION=false
    set RUN_E2E=false
    set RUN_SECURITY=false
)
if /i "%~1"=="--integration-only" (
    set RUN_UNIT=false
    set RUN_INTEGRATION=true
    set RUN_E2E=false
    set RUN_SECURITY=false
)
if /i "%~1"=="--e2e-only" (
    set RUN_UNIT=false
    set RUN_INTEGRATION=false
    set RUN_E2E=true
    set RUN_SECURITY=false
)
if /i "%~1"=="--security-only" (
    set RUN_UNIT=false
    set RUN_INTEGRATION=false
    set RUN_E2E=false
    set RUN_SECURITY=true
)
if /i "%~1"=="--no-unit" set RUN_UNIT=false
if /i "%~1"=="--no-integration" set RUN_INTEGRATION=false
if /i "%~1"=="--no-e2e" set RUN_E2E=false
if /i "%~1"=="--no-security" set RUN_SECURITY=false
if /i "%~1"=="--verbose" set VERBOSE=true
shift
goto :parse_args
:end_parse_args

:: 显示运行哪些测试
echo 将运行以下测试：
if "%RUN_UNIT%"=="true" echo - 单元测试
if "%RUN_INTEGRATION%"=="true" echo - 集成测试
if "%RUN_E2E%"=="true" echo - 端到端测试
if "%RUN_SECURITY%"=="true" echo - 安全测试
echo.

:: 准备命令参数
set VERBOSE_ARG=
if "%VERBOSE%"=="true" set VERBOSE_ARG=--verbose

:: 执行单元测试
if "%RUN_UNIT%"=="true" (
    echo 正在运行单元测试...
    cd %ROOT_DIR%
    node tests/run-unit-tests.js %VERBOSE_ARG%
    if %ERRORLEVEL% neq 0 (
        echo 单元测试失败！
        exit /b %ERRORLEVEL%
    )
    echo 单元测试完成。
    echo.
)

:: 执行集成测试
if "%RUN_INTEGRATION%"=="true" (
    echo 正在运行集成测试...
    cd %ROOT_DIR%
    node tests/run-integration-tests.js %VERBOSE_ARG%
    if %ERRORLEVEL% neq 0 (
        echo 集成测试失败！
        exit /b %ERRORLEVEL%
    )
    echo 集成测试完成。
    echo.
)

:: 执行端到端测试
if "%RUN_E2E%"=="true" (
    echo 正在运行端到端测试...
    cd %ROOT_DIR%
    node tests/e2e/run-e2e-tests.js %VERBOSE_ARG%
    if %ERRORLEVEL% neq 0 (
        echo 端到端测试失败！
        exit /b %ERRORLEVEL%
    )
    echo 端到端测试完成。
    echo.
)

:: A执行安全测试
if "%RUN_SECURITY%"=="true" (
    echo 正在运行安全测试...
    cd %ROOT_DIR%
    node tests/run-security-tests.js %VERBOSE_ARG%
    if %ERRORLEVEL% neq 0 (
        echo 安全测试失败！
        exit /b %ERRORLEVEL%
    )
    echo 安全测试完成。
    echo.
)

echo =======================================
echo           所有测试执行完成！
echo =======================================

exit /b 0 