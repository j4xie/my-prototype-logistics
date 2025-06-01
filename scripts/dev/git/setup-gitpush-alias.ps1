# PowerShell配置文件设置脚本
# 用于设置全局gitpush别名

param(
    [switch]$Remove
)

# 获取当前脚本所在目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$GitPushScript = Join-Path $ScriptDir "gitpush.ps1"

# 检查PowerShell配置文件路径
$ProfilePath = $PROFILE.CurrentUserAllHosts
$ProfileDir = Split-Path -Parent $ProfilePath

# 创建配置文件目录（如果不存在）
if (-not (Test-Path $ProfileDir)) {
    New-Item -ItemType Directory -Path $ProfileDir -Force | Out-Null
}

# 定义要添加的函数
$GitPushFunction = @"

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

if ($Remove) {
    # 移除别名
    if (Test-Path $ProfilePath) {
        $content = Get-Content $ProfilePath -Raw
        $content = $content -replace [regex]::Escape($GitPushFunction), ""
        $content = $content.Trim()
        Set-Content -Path $ProfilePath -Value $content
        Write-Host "✅ gitpush别名已移除" -ForegroundColor Green
        Write-Host "请重启PowerShell或运行: . `$PROFILE" -ForegroundColor Yellow
    }
} else {
    # 添加别名
    if (Test-Path $ProfilePath) {
        $content = Get-Content $ProfilePath -Raw
        if ($content -notlike "*function gitpush*") {
            Add-Content -Path $ProfilePath -Value $GitPushFunction
            Write-Host "✅ gitpush别名已添加到PowerShell配置文件" -ForegroundColor Green
        } else {
            Write-Host "ℹ️  gitpush别名已存在" -ForegroundColor Yellow
        }
    } else {
        Set-Content -Path $ProfilePath -Value $GitPushFunction
        Write-Host "✅ 已创建PowerShell配置文件并添加gitpush别名" -ForegroundColor Green
    }
    
    Write-Host "请重启PowerShell或运行以下命令使别名生效:" -ForegroundColor Cyan
    Write-Host ". `$PROFILE" -ForegroundColor White
    Write-Host ""
    Write-Host "使用方法:" -ForegroundColor Cyan
    Write-Host "gitpush `"你的提交信息`"" -ForegroundColor White
} 