# PowerShell Git一键提交脚本

Write-Host "===== 一键Git提交工具 =====" -ForegroundColor Cyan

# 检查是否提供了提交信息
if ($args.Count -eq 0) {
    Write-Host "错误：请提供提交信息！" -ForegroundColor Red
    Write-Host "用法：.\git-push.ps1 '你的提交信息'" -ForegroundColor Yellow
    exit 1
}

# 保存提交信息
$commit_msg = $args[0]

# 显示当前状态
Write-Host ""
Write-Host "当前Git状态:" -ForegroundColor Cyan
git status
Write-Host ""

# 添加所有更改
Write-Host "正在添加所有更改..." -ForegroundColor Yellow
git add .

# 提交更改
Write-Host "正在提交更改..." -ForegroundColor Yellow
git commit -m "$commit_msg"

# 推送到远程仓库
Write-Host "正在推送到远程仓库..." -ForegroundColor Yellow
git push

# 完成
Write-Host ""
if ($LASTEXITCODE -eq 0) {
    Write-Host "√ 成功完成所有操作！" -ForegroundColor Green
} else {
    Write-Host "× 操作过程中出现错误，请检查上方信息。" -ForegroundColor Red
} 