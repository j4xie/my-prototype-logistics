# PowerShell 脚本启动应用
Write-Host "正在启动食品溯源系统应用..."
Set-Location -Path .\web-app
npx serve -l 8080

# 如果上述命令出错，可以尝试以下替代命令
# Write-Host "正在使用备用方法启动..."
# npx serve -l 8080 web-app 