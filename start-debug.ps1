# 停止现有的Chrome进程
taskkill /F /IM chrome.exe /T 2>$null
Start-Sleep -Seconds 2

# 清理调试目录
Remove-Item -Recurse -Force C:\temp\chrome-debug -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path C:\temp\chrome-debug | Out-Null

# 启动Chrome
$chromeArgs = @(
    "--remote-debugging-port=9222",
    "--user-data-dir=C:\temp\chrome-debug",
    "--no-first-run",
    "--enable-automation",
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-breakpad",
    "--disable-client-side-phishing-detection",
    "--disable-default-apps",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-features=site-per-process",
    "--disable-hang-monitor",
    "--disable-ipc-flooding-protection",
    "--disable-popup-blocking",
    "--disable-prompt-on-repost",
    "--disable-renderer-backgrounding",
    "--disable-sync",
    "--force-color-profile=srgb",
    "--metrics-recording-only",
    "--no-sandbox",
    "--password-store=basic",
    "http://localhost:3000"
)

Start-Process "chrome.exe" -ArgumentList $chromeArgs

Write-Host "Chrome已启动，调试端口：9222"
Write-Host "请等待几秒钟让Chrome完全启动..."
Start-Sleep -Seconds 5

# 检查调试端口是否正常工作
try {
    $response = Invoke-WebRequest -Uri "http://localhost:9222/json/version" -UseBasicParsing
    Write-Host "调试连接成功！"
    Write-Host $response.Content
} catch {
    Write-Host "调试连接失败：" $_.Exception.Message
} 