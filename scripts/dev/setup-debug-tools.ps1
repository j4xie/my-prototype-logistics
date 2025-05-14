# PowerShell脚本：设置调试工具别名
# 此脚本创建调试工具的别名，使得用户可以轻松启动各种调试选项

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$debugToolsDir = Join-Path $scriptDir "debug"

Write-Host "设置调试工具别名..." -ForegroundColor Cyan

# 检查脚本目录是否存在
if (-not (Test-Path $debugToolsDir)) {
    Write-Host "错误: 调试工具目录不存在: $debugToolsDir" -ForegroundColor Red
    exit 1
}

# 处理.ps1文件
$psScripts = Get-ChildItem -Path $debugToolsDir -Filter "*.ps1"

foreach ($script in $psScripts) {
    $scriptBaseName = $script.BaseName
    $scriptPath = $script.FullName
    $aliasName = $scriptBaseName

    # 检查别名是否已存在
    if (Get-Alias -Name $aliasName -ErrorAction SilentlyContinue) {
        Remove-Alias -Name $aliasName -Force -Scope Global
    }

    # 创建别名
    Set-Alias -Name $aliasName -Value $scriptPath -Scope Global
    Write-Host "已创建别名: $aliasName -> $scriptPath" -ForegroundColor Green
}

# 处理.bat和.cmd文件
$batchFiles = Get-ChildItem -Path $debugToolsDir -Include "*.bat","*.cmd" -File

foreach ($file in $batchFiles) {
    $fileBaseName = $file.BaseName
    $filePath = $file.FullName
    
    # 创建函数以执行批处理文件
    $functionName = $fileBaseName
    $functionDef = "function global:$functionName { & '$filePath' `$args }"
    
    # 执行函数定义
    Invoke-Expression $functionDef
    Write-Host "已创建函数: $functionName -> $filePath" -ForegroundColor Green
}

# 创建一些快捷别名
Set-Alias -Name "debug" -Value (Join-Path $debugToolsDir "start-debug.ps1") -Scope Global
Set-Alias -Name "debug-chrome" -Value (Join-Path $debugToolsDir "start-chrome-debug.cmd") -Scope Global
Set-Alias -Name "debug-edge" -Value (Join-Path $debugToolsDir "start-edge-debug.cmd") -Scope Global

Write-Host "`n设置完成! 现在您可以直接使用以下命令:" -ForegroundColor Cyan
Write-Host "  - debug: 启动默认调试" -ForegroundColor Yellow
Write-Host "  - debug-chrome: 使用Chrome启动调试" -ForegroundColor Yellow
Write-Host "  - debug-edge: 使用Edge启动调试" -ForegroundColor Yellow
Write-Host "  - start-debug: 启动默认调试" -ForegroundColor Yellow
Write-Host "  - start-chrome-debug: 使用Chrome启动调试" -ForegroundColor Yellow
Write-Host "  - start-edge-debug: 使用Edge启动调试" -ForegroundColor Yellow

Write-Host "`n注意: 这些别名仅在当前PowerShell会话中有效。" -ForegroundColor Magenta
Write-Host "要使其永久生效，请将此脚本添加到您的PowerShell配置文件中。" -ForegroundColor Magenta 