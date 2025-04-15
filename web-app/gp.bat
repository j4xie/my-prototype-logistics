@echo off
:: Git Quick Push Shortcut
:: A shortcut to gitpush.bat for faster git commits and pushes

:: Get script directory
set "SCRIPT_DIR=%~dp0"

:: Call gitpush.bat and pass all arguments
call "%SCRIPT_DIR%gitpush.bat" %*

:: Exit with the same error level
exit /b %ERRORLEVEL% 