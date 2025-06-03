# PowerShell 脚本执行测试
Set-Location -Path .\web-app
Write-Host "正在执行大规模数据处理测试..."

# 运行指定测试文件
npm test -- src/network/load-balancing.test.js

Write-Host "测试完成，按任意键继续..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 