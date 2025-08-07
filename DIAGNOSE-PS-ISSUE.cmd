@echo off
title PowerShell Deep Diagnostics
color 0C
cls

echo ========================================
echo  PowerShell Deep Diagnostics
echo ========================================
echo.
echo This will help identify the root cause of PowerShell issues.
echo.

echo [1/10] Testing PowerShell without profile...
powershell -NoProfile -NoLogo -Command "Measure-Command { Write-Host 'Test' }" 2>temp_error.txt
if errorlevel 1 (
    echo   FAILED: PowerShell has fundamental issues
    type temp_error.txt
) else (
    echo   SUCCESS: PowerShell works without profile
)
del temp_error.txt >nul 2>&1
echo.

echo [2/10] Checking PowerShell version...
powershell -NoProfile -Command "$PSVersionTable.PSVersion" 2>nul
echo.

echo [3/10] Checking profile file existence...
if exist "%USERPROFILE%\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1" (
    echo   Profile exists: %USERPROFILE%\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1
    for %%I in ("%USERPROFILE%\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1") do echo   Size: %%~zI bytes
) else (
    echo   No profile found (this is good for testing)
)
echo.

echo [4/10] Checking PowerShell execution policy...
powershell -NoProfile -Command "Get-ExecutionPolicy" 2>nul
echo.

echo [5/10] Testing simple PowerShell command speed...
echo   Testing: powershell -NoProfile -Command "1+1"
for /f %%i in ('powershell -NoProfile -Command "(Measure-Command { 1+1 }).TotalMilliseconds"') do set speed=%%i
echo   Speed: %speed% milliseconds
echo.

echo [6/10] Checking Windows Defender real-time protection...
powershell -NoProfile -Command "Get-MpPreference | Select-Object DisableRealtimeMonitoring" 2>nul
echo.

echo [7/10] Checking system resources...
echo   CPU Usage:
wmic cpu get loadpercentage /value | find "LoadPercentage"
echo   Available Memory:
wmic OS get FreePhysicalMemory /value | find "FreePhysicalMemory"
echo.

echo [8/10] Checking for PowerShell modules...
powershell -NoProfile -Command "Get-Module -ListAvailable | Measure-Object | Select-Object Count"
echo.

echo [9/10] Testing profile creation...
echo # Test Profile > "%USERPROFILE%\Documents\WindowsPowerShell\TEST_profile.ps1"
powershell -NoProfile -Command ". '$env:USERPROFILE\Documents\WindowsPowerShell\TEST_profile.ps1'; Write-Host 'Profile test OK'"
del "%USERPROFILE%\Documents\WindowsPowerShell\TEST_profile.ps1" >nul 2>&1
echo.

echo [10/10] PowerShell startup benchmark...
echo   Testing normal PowerShell startup time...
powershell -Command "exit" >nul 2>&1
echo   (If this hangs, the issue is confirmed)
echo.

echo ========================================
echo  Diagnostic Complete
echo ========================================
echo.
echo Recommendations:
echo.
echo 1. If PowerShell without -NoProfile is slow:
echo    - Use Windows Defender exclusions for PowerShell
echo    - Check for corrupt modules
echo    - Restart Windows
echo.
echo 2. If only profile loading is slow:
echo    - Use the NO-PROFILE-DEV.cmd solution
echo    - Recreate profile from scratch
echo.
echo 3. If everything is slow:
echo    - Check antivirus software
echo    - Check system performance
echo    - Consider PowerShell reinstall
echo.
pause