@echo off
echo 启动调试环境...

REM 杀死可能存在的Chrome进程
taskkill /F /IM chrome.exe /T 2>nul

REM 确保目录存在
if not exist "static\js" mkdir "static\js"

REM 启动HTTP服务器（使用Python的SimpleHTTPServer）
start "HTTP Server" cmd /c "python -m http.server 8888"

REM 等待服务器启动
timeout /t 2

REM 启动Chrome，开启远程调试
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
    --remote-debugging-port=9222 ^
    --user-data-dir="%TEMP%\chrome-debug" ^
    --no-first-run ^
    --no-default-browser-check ^
    http://localhost:8888/index.html

echo.
echo 调试环境已启动：
echo - HTTP服务器运行在 http://localhost:8888
echo - Chrome远程调试端口：9222
echo - 项目主页：http://localhost:8888/index.html
echo.
echo 按任意键退出...
pause > nul 