# MCP服务启动脚本 (PowerShell版本)
Write-Host "正在启动MCP服务..." -ForegroundColor Green

# 设置Magic MCP的API密钥环境变量
$env:TWENTY_FIRST_API_KEY = "72b532ab1fcdcfcb7f4556d0743434f10fb61dd929c12795d25565aca347ad3a"

# 创建日志目录
$logsDir = Join-Path $PSScriptRoot "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -Path $logsDir -ItemType Directory | Out-Null
}

# 启动Browser Tools MCP
Write-Host "启动Browser Tools MCP..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-Command `"npx -y @agentdeskai/browser-tools-mcp@1.2.0 | Tee-Object -FilePath `"$logsDir\browser-tools.log`"`"" -WindowStyle Normal

# 启动Magic MCP
Write-Host "启动Magic MCP..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-Command `"$env:TWENTY_FIRST_API_KEY='72b532ab1fcdcfcb7f4556d0743434f10fb61dd929c12795d25565aca347ad3a'; npx -y @smithery/cli@latest run @21st-dev/magic-mcp | Tee-Object -FilePath `"$logsDir\magic-mcp.log`"`"" -WindowStyle Normal

# 启动Neon MCP
Write-Host "启动Neon MCP..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-Command `"npx -y @neondatabase/mcp-server-neon start napi_88x8jzryt6fewwb8ts6owfi2ov23xptlb1798ynl3mlfymv17lzifduyr1t3ly88 | Tee-Object -FilePath `"$logsDir\neon-mcp.log`"`"" -WindowStyle Normal

Write-Host "所有MCP服务已启动！" -ForegroundColor Green
Write-Host "关闭此窗口将结束所有MCP服务" -ForegroundColor Yellow

# 保持脚本运行
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 