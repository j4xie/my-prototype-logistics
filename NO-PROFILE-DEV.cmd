@echo off
title React Native Dev - No Profile Solution
color 0A
cls

echo ========================================
echo  React Native Development - No Profile
echo ========================================
echo.
echo This solution completely bypasses PowerShell profile issues
echo and gives you instant access to all development commands.
echo.

:menu
echo Current time: %time%
echo.
echo [1] Start Full Environment (MySQL + Backend + RN)
echo [2] Start Backend Only
echo [3] Start React Native Only  
echo [4] Stop All Services
echo [5] Service Status
echo [6] Fast PowerShell (No Profile)
echo [7] Kill All Node Processes
echo [8] Open Project Folders
echo [9] Exit
echo.
set /p choice=Choose option (1-9): 

if "%choice%"=="1" goto start_all
if "%choice%"=="2" goto start_backend
if "%choice%"=="3" goto start_rn
if "%choice%"=="4" goto stop_all
if "%choice%"=="5" goto status
if "%choice%"=="6" goto fast_powershell
if "%choice%"=="7" goto kill_node
if "%choice%"=="8" goto open_folders
if "%choice%"=="9" goto exit

echo Invalid choice!
timeout /t 2 /nobreak >nul
goto menu

:start_all
cls
echo ========================================
echo  Starting Full Environment
echo ========================================
echo.
echo [1/4] Cleaning up existing processes...
taskkill /f /im node.exe /t >nul 2>&1
taskkill /f /im expo.exe /t >nul 2>&1

echo [2/4] Starting MySQL...
net start MySQL80 >nul 2>&1
if errorlevel 1 (
    echo   MySQL80 start failed or already running
) else (
    echo   MySQL80 started successfully
)

echo [3/4] Starting Backend API...
start "Backend API" /d "C:\Users\Steve\heiniu\backend" cmd /k "echo Backend API - http://localhost:3001 && npm run dev"
timeout /t 3 /nobreak >nul

echo [4/4] Starting React Native...
start "React Native" /d "C:\Users\Steve\heiniu\frontend\HainiuFoodTrace" cmd /k "echo React Native - http://localhost:8081 && npx expo start"

echo.
echo ========================================
echo  Environment Started Successfully!
echo ========================================
echo.
echo Services running:
echo   Backend API: http://localhost:3001
echo   React Native: http://localhost:8081
echo   MySQL80: Database service
echo.
echo Test credentials: admin / Admin@123456
echo.
pause
goto menu

:start_backend
cls
echo Starting Backend Only...
taskkill /f /im node.exe /t >nul 2>&1
net start MySQL80 >nul 2>&1
start "Backend API" /d "C:\Users\Steve\heiniu\backend" cmd /k "echo Backend API - http://localhost:3001 && npm run dev"
echo Backend started on http://localhost:3001
pause
goto menu

:start_rn
cls
echo Starting React Native Only...
start "React Native" /d "C:\Users\Steve\heiniu\frontend\HainiuFoodTrace" cmd /k "echo React Native - http://localhost:8081 && npx expo start"
echo React Native started on http://localhost:8081
pause
goto menu

:stop_all
cls
echo Stopping all services...
taskkill /f /im node.exe /t >nul 2>&1
taskkill /f /im expo.exe /t >nul 2>&1
taskkill /f /im npm.exe /t >nul 2>&1
echo All development services stopped.
pause
goto menu

:status
cls
echo ========================================
echo  Service Status Check
echo ========================================
echo.
netstat -an | find ":3001" >nul
if errorlevel 1 (
    echo   Backend API (3001): STOPPED
) else (
    echo   Backend API (3001): RUNNING
)

netstat -an | find ":8081" >nul  
if errorlevel 1 (
    echo   React Native (8081): STOPPED
) else (
    echo   React Native (8081): RUNNING
)

sc query MySQL80 | find "RUNNING" >nul
if errorlevel 1 (
    echo   MySQL80: STOPPED
) else (
    echo   MySQL80: RUNNING  
)

tasklist | find "node.exe" >nul
if errorlevel 1 (
    echo   Node.js processes: NONE
) else (
    echo   Node.js processes: ACTIVE
)

echo.
pause
goto menu

:fast_powershell
cls
echo Starting Fast PowerShell (bypasses all profile issues)...
echo.
powershell -NoProfile -NoLogo -Command "Write-Host 'Fast PowerShell - No Profile Loaded' -ForegroundColor Green; Write-Host 'Change directory: cd C:\Users\Steve\heiniu' -ForegroundColor Yellow; Write-Host 'Exit: type exit' -ForegroundColor Gray"
goto menu

:kill_node
cls
echo Killing all Node.js processes...
taskkill /f /im node.exe /t >nul 2>&1
taskkill /f /im npm.exe /t >nul 2>&1  
taskkill /f /im expo.exe /t >nul 2>&1
echo All Node processes terminated.
pause
goto menu

:open_folders
cls
echo Opening project folders...
start "" "C:\Users\Steve\heiniu"
start "" "C:\Users\Steve\heiniu\backend" 
start "" "C:\Users\Steve\heiniu\frontend\HainiuFoodTrace"
echo Project folders opened in Explorer.
pause
goto menu

:exit
cls
echo.
echo Thanks for using React Native Dev Environment!
echo.
echo Remember: This tool completely bypasses PowerShell profile issues.
echo Save this file for future use: NO-PROFILE-DEV.cmd
echo.
timeout /t 3 /nobreak >nul
exit