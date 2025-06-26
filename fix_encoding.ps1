# 修复 DIRECTORY_STRUCTURE.md 编码问题
$content = Get-Content 'DIRECTORY_STRUCTURE.md' -Raw -Encoding UTF8

# 修复常见的编码问题
$content = $content -replace '�?', ''
$content = $content -replace '\?\?\?', ''

# 保存修复后的内容
$content | Set-Content 'DIRECTORY_STRUCTURE.md' -Encoding UTF8

Write-Host "编码修复完成"
