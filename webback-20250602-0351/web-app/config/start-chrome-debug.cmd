@echo off
taskkill /F /IM chrome.exe /T
timeout /t 2
start "Chrome Debug" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 http://localhost:8888/debug-tools/debug-test.html 