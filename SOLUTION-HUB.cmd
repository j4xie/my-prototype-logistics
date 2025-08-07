@echo off
title Solution Hub - PowerShell & React Native Dev
color 0B
cls

echo ========================================
echo  SOLUTION HUB - All PowerShell Fixes
echo ========================================
echo.
echo Choose the best solution for your situation:
echo.

:menu
echo [1] NO-PROFILE DEV ENVIRONMENT (Recommended)
echo     - Instant startup, full React Native functionality  
echo     - Completely bypasses PowerShell profile issues
echo.
echo [2] FAST POWERSHELL (Quick Fix)
echo     - Start PowerShell without any profile
echo     - Manual commands, but very fast
echo.
echo [3] DIAGNOSE ISSUES (Find Root Cause)
echo     - Run comprehensive diagnostics
echo     - Identify specific problems
echo.
echo [4] NUCLEAR OPTION (Complete Reset)
echo     - Delete all PowerShell configurations
echo     - Fresh start with minimal setup
echo.
echo [5] WINDOWS DEFENDER FIX (Performance)
echo     - Add PowerShell to antivirus exclusions
echo     - May solve scanning delays
echo.
echo [6] EXIT
echo.
set /p choice=Enter choice (1-6): 

if "%choice%"=="1" goto solution1
if "%choice%"=="2" goto solution2  
if "%choice%"=="3" goto solution3
if "%choice%"=="4" goto solution4
if "%choice%"=="5" goto solution5
if "%choice%"=="6" goto exit

echo Invalid choice!
timeout /t 2 /nobreak >nul
goto menu

:solution1
cls
echo Starting NO-PROFILE Development Environment...
echo This is the BEST solution for your React Native development.
echo.
start "" "C:\Users\Steve\heiniu\NO-PROFILE-DEV.cmd"
echo NO-PROFILE-DEV.cmd has been launched in a new window.
echo This solution provides all React Native commands without PowerShell issues.
echo.
pause
goto menu

:solution2
cls
echo Starting Fast PowerShell (No Profile)...
echo This PowerShell session will load instantly.
echo.
echo Note: You'll need to manually navigate and run commands.
echo Useful commands:
echo   cd C:\Users\Steve\heiniu
echo   cd backend  ^&^& npm run dev
echo   cd frontend\HainiuFoodTrace ^&^& npx expo start
echo.
powershell -NoProfile -NoLogo
goto menu

:solution3
cls
echo Running PowerShell diagnostics...
call "C:\Users\Steve\heiniu\DIAGNOSE-PS-ISSUE.cmd"
goto menu

:solution4
cls
echo ========================================
echo  NUCLEAR OPTION - Complete Reset
echo ========================================
echo.
echo WARNING: This will delete ALL PowerShell customizations!
echo This includes:
echo   - All PowerShell profiles
echo   - PowerShell history
echo   - Module cache
echo   - Custom settings
echo.
echo Are you absolutely sure? This cannot be undone!
echo.
set /p confirm=Type YES to continue: 
if not "%confirm%"=="YES" (
    echo Cancelled.
    pause
    goto menu
)

echo.
echo Performing complete PowerShell reset...
rd /s /q "%USERPROFILE%\Documents\WindowsPowerShell" >nul 2>&1
rd /s /q "%USERPROFILE%\Documents\PowerShell" >nul 2>&1  
rd /s /q "%APPDATA%\Microsoft\Windows\PowerShell" >nul 2>&1
rd /s /q "%LOCALAPPDATA%\Microsoft\Windows\PowerShell" >nul 2>&1

echo Creating minimal profile structure...
mkdir "%USERPROFILE%\Documents\WindowsPowerShell" >nul 2>&1
echo # Minimal PowerShell Profile > "%USERPROFILE%\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1"

echo.
echo Complete reset finished!
echo PowerShell should now start much faster.
echo Test by opening a new PowerShell window.
echo.
pause
goto menu

:solution5
cls
echo ========================================
echo  Windows Defender Exclusions
echo ========================================
echo.
echo This will attempt to add PowerShell to Windows Defender exclusions.
echo This may require administrator privileges.
echo.
pause

echo Adding PowerShell directories to exclusions...
powershell -NoProfile -Command "Add-MpPreference -ExclusionPath 'C:\Windows\System32\WindowsPowerShell'" 2>nul
powershell -NoProfile -Command "Add-MpPreference -ExclusionPath 'C:\Program Files\PowerShell'" 2>nul
powershell -NoProfile -Command "Add-MpPreference -ExclusionPath '%USERPROFILE%\Documents\WindowsPowerShell'" 2>nul

echo Adding PowerShell processes to exclusions...
powershell -NoProfile -Command "Add-MpPreference -ExclusionProcess 'powershell.exe'" 2>nul
powershell -NoProfile -Command "Add-MpPreference -ExclusionProcess 'pwsh.exe'" 2>nul

echo.
echo Defender exclusions added (if you have admin rights).
echo This may improve PowerShell startup performance.
echo Test by opening a new PowerShell window.
echo.
pause
goto menu

:exit
cls
echo ========================================
echo  Solution Summary  
echo ========================================
echo.
echo Available solutions created:
echo.
echo 1. NO-PROFILE-DEV.cmd - Full React Native environment
echo 2. DIAGNOSE-PS-ISSUE.cmd - Diagnostic tool
echo 3. SOLUTION-HUB.cmd - This menu (current file)
echo.
echo RECOMMENDED: Use NO-PROFILE-DEV.cmd for all your development work.
echo It completely bypasses PowerShell issues while providing full functionality.
echo.
echo Files are located in: C:\Users\Steve\heiniu\
echo.
echo Good luck with your React Native development!
echo.
timeout /t 5 /nobreak >nul
exit