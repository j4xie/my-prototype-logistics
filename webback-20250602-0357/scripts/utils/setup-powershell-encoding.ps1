# PowerShell 编码设置脚本
# 用法: .\setup-powershell-encoding.ps1
# 描述: 为PowerShell设置正确的编码配置

Write-Host "🔧 设置PowerShell编码配置..." -ForegroundColor Cyan

# 检查PowerShell配置文件路径
$profilePath = $PROFILE
$profileDir = Split-Path $profilePath -Parent

# 确保配置文件目录存在
if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
    Write-Host "✅ 创建PowerShell配置目录: $profileDir" -ForegroundColor Green
}

# 编码设置内容
$encodingConfig = @'
# UTF-8 编码设置 - 防止中文乱码
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 设置默认参数
$PSDefaultParameterValues = @{
    'Out-File:Encoding' = 'utf8'
    'Set-Content:Encoding' = 'utf8'
    'Add-Content:Encoding' = 'utf8'
}

# Git 相关别名（可选）
function git-status-utf8 { git status --porcelain=v1 }
Set-Alias -Name gst -Value git-status-utf8

Write-Host "✅ PowerShell UTF-8 编码配置已加载" -ForegroundColor Green
'@

# 检查是否已有编码设置
$existingContent = ""
if (Test-Path $profilePath) {
    $existingContent = Get-Content $profilePath -Raw -ErrorAction SilentlyContinue
}

if ($existingContent -notmatch "UTF-8 编码设置") {
    # 添加编码设置到PowerShell配置文件
    if ($existingContent) {
        $newContent = $existingContent + "`n`n" + $encodingConfig
    } else {
        $newContent = $encodingConfig
    }

    try {
        $newContent | Set-Content $profilePath -Encoding UTF8
        Write-Host "✅ 编码设置已添加到PowerShell配置文件" -ForegroundColor Green
        Write-Host "📄 配置文件位置: $profilePath" -ForegroundColor Blue
        Write-Host "🔄 请重启PowerShell或运行 '. $profilePath' 使配置生效" -ForegroundColor Yellow
    }
    catch {
        Write-Host "❌ 无法写入PowerShell配置文件: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "请手动将以下内容添加到 $profilePath :" -ForegroundColor Yellow
        Write-Host $encodingConfig -ForegroundColor Gray
    }
} else {
    Write-Host "✅ PowerShell配置文件中已存在编码设置" -ForegroundColor Green
}

# 立即应用编码设置到当前会话
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "🎉 PowerShell编码设置完成！" -ForegroundColor Green
Write-Host "当前会话编码已设置为UTF-8" -ForegroundColor Blue
