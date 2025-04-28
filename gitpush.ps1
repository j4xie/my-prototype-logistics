param(
    [Parameter(Mandatory=$true)]
    [string]$commitMessage
)

# 添加所有更改的文件
git add .

# 提交更改
git commit -m "$commitMessage"

# 推送到远程仓库
git push

Write-Host "已完成推送！提交信息: $commitMessage" -ForegroundColor Green 