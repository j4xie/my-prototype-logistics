# 简化版PowerShell别名设置脚本

# 获取当前脚本所在目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$GitPushScript = Join-Path $ScriptDir "gitpush.ps1"

# 检查PowerShell配置文件路径
$ProfilePath = $PROFILE.CurrentUserAllHosts

Write-Host "正在设置gitpush别名..." -ForegroundColor Cyan

# 要添加的函数内容
$FunctionContent = @"

# Git Push 快捷函数
function gitpush {
    param([string]`$message)
    if (-not `$message) {
        Write-Host "用法: gitpush `"你的提交信息`"" -ForegroundColor Yellow
        return
    }
    & "$GitPushScript" `$message
}
"@

# 创建配置文件目录（如果不存在）
$ProfileDir = Split-Path -Parent $ProfilePath
if (-not (Test-Path $ProfileDir)) {
    New-Item -ItemType Directory -Path $ProfileDir -Force | Out-Null
}

# 检查配置文件是否存在
if (Test-Path $ProfilePath) {
    $content = Get-Content $ProfilePath -Raw -ErrorAction SilentlyContinue
    if ($content -and $content.Contains("function gitpush")) {
        Write-Host "gitpush别名已存在" -ForegroundColor Yellow
    } else {
        Add-Content -Path $ProfilePath -Value $FunctionContent
        Write-Host "gitpush别名已添加" -ForegroundColor Green
    }
} else {
    Set-Content -Path $ProfilePath -Value $FunctionContent
    Write-Host "已创建PowerShell配置文件并添加gitpush别名" -ForegroundColor Green
}

Write-Host ""
Write-Host "请运行以下命令使别名生效:" -ForegroundColor Cyan
Write-Host ". `$PROFILE" -ForegroundColor White
Write-Host ""
Write-Host "使用方法:" -ForegroundColor Cyan
Write-Host "gitpush `"你的提交信息`"" -ForegroundColor White 