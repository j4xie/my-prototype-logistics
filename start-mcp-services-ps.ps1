# MCP服务启动脚本 (PowerShell版本)
Write-Host "正在启动MCP服务..." -ForegroundColor Green

# 创建日志目录
$logsDir = Join-Path $PSScriptRoot "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -Path $logsDir -ItemType Directory | Out-Null
}

# 使用JSON配置文件，确保环境变量正确设置
$configPath = Join-Path $PSScriptRoot "mcp.json"
$config = Get-Content -Raw -Path $configPath | ConvertFrom-Json

# 启动Browser Tools MCP
Write-Host "启动Browser Tools MCP..." -ForegroundColor Cyan
$browserToolsConfig = $config.mcpServers.'browser-tools'
$browserToolsCmd = $browserToolsConfig.command
$browserToolsArgs = $browserToolsConfig.args -join ' '
Start-Process powershell -ArgumentList "-Command `"& {$browserToolsCmd $browserToolsArgs | Tee-Object -FilePath `"$logsDir\browser-tools.log`"}`"" -WindowStyle Normal

# 启动Magic MCP
Write-Host "启动Magic MCP..." -ForegroundColor Cyan
$magicConfig = $config.mcpServers.'magic-mcp'
$magicCmd = $magicConfig.command
$magicArgs = $magicConfig.args -join ' '
$magicEnv = ''
if ($magicConfig.env) {
    # 正确设置环境变量
    foreach ($key in $magicConfig.env.PSObject.Properties.Name) {
        $value = $magicConfig.env.$key
        $magicEnv += "`$env:$key=`'$value`'; "
    }
}
Start-Process powershell -ArgumentList "-Command `"& {$magicEnv $magicCmd $magicArgs | Tee-Object -FilePath `"$logsDir\magic-mcp.log`"}`"" -WindowStyle Normal

# 启动Neon MCP
Write-Host "启动Neon MCP..." -ForegroundColor Cyan
$neonConfig = $config.mcpServers.neon
$neonCmd = $neonConfig.command
$neonArgs = $neonConfig.args -join ' '
Start-Process powershell -ArgumentList "-Command `"& {$neonCmd $neonArgs | Tee-Object -FilePath `"$logsDir\neon-mcp.log`"}`"" -WindowStyle Normal

Write-Host "所有MCP服务已启动！" -ForegroundColor Green
Write-Host "关闭此窗口将结束所有MCP服务" -ForegroundColor Yellow

# 保持脚本运行
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 