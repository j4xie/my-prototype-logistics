@echo off
:: Git Quick Push Script
:: For quickly adding, committing and pushing changes

setlocal enabledelayedexpansion

echo ===== Git Quick Push Tool =====
echo.

:: Check if commit message is provided
if "%~1"=="" (
    echo Error: Please provide a commit message!
    echo Usage: gitpush "Your commit message"
    exit /b 1
)

:: Save commit message
set "commit_msg=%~1"

:: Show current status
echo Current Git Status:
git status
echo.

:: Add all changes
echo Adding all changes...
git add .

:: Commit changes
echo Committing changes...
git commit -m "%commit_msg%"

:: Push to remote
echo Pushing to remote repository...
git push

:: Check if successful
if %ERRORLEVEL% equ 0 (
    echo.
    echo Operation completed successfully!
) else (
    echo.
    echo Error occurred, check messages above.
)

endlocal 