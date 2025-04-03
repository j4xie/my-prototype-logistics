@echo off
set DEBUG_DIR=%TEMP%\edge-debug-clear
taskkill /F /IM msedge.exe /T
timeout /t 2
rmdir /s /q "%DEBUG_DIR%"
mkdir "%DEBUG_DIR%"
start "Edge Debug" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=3029 --user-data-dir="%DEBUG_DIR%" --no-first-run --enable-automation --remote-allow-origins=* --disable-background-timer-throttling --disable-web-security --allow-running-insecure-content http://localhost:8888/
echo 调试端口: 3029
echo 调试目录: %DEBUG_DIR% 