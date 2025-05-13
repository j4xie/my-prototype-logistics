# PowerShell脚本：设置Git脚本别名
# 此脚本创建别名，使得用户可以从任何位置使用Git快捷命令

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$gitScriptsDir = Join-Path $scriptDir "git"

Write-Host "设置Git脚本别名..." -ForegroundColor Cyan

# 检查脚本目录是否存在
if (-not (Test-Path $gitScriptsDir)) {
    Write-Host "错误: Git脚本目录不存在: $gitScriptsDir" -ForegroundColor Red
    exit 1
}

# 获取所有脚本文件
$scriptFiles = Get-ChildItem -Path $gitScriptsDir -Filter "*.ps1"

# 为每个PS1脚本创建别名
foreach ($script in $scriptFiles) {
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
$batchFiles = Get-ChildItem -Path $gitScriptsDir -Include "*.bat","*.cmd" -File

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

Write-Host "`n设置完成! 现在您可以直接使用以下命令:" -ForegroundColor Cyan
Write-Host "  - g: 快速Git命令" -ForegroundColor Yellow
Write-Host "  - gitpush: 快速提交并推送" -ForegroundColor Yellow
Write-Host "  - gp: gitpush的别名" -ForegroundColor Yellow

Write-Host "`n使用示例:" -ForegroundColor Cyan
Write-Host "  g status" -ForegroundColor Yellow
Write-Host "  gitpush '提交信息'" -ForegroundColor Yellow
Write-Host "  gp '快速提交'" -ForegroundColor Yellow

Write-Host "`n注意: 这些别名仅在当前PowerShell会话中有效。" -ForegroundColor Magenta
Write-Host "要使其永久生效，请将此脚本添加到您的PowerShell配置文件中。" -ForegroundColor Magenta 