# 根目录文件整理脚本 (PowerShell 版) - 2026-04-22
# 用途: 组织杂乱的临时脚本、截图、数据文件
# 安全: 仅做本地操作，不涉及 git 删除

Write-Host "======================================" -ForegroundColor Yellow
Write-Host "根目录文件整理工具 (PowerShell)" -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Yellow
Write-Host ""

$ROOT = Get-Location

# 第一步: 创建目录结构
Write-Host "[第1步] 创建目录结构" -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path @(
    "archive/yolo-experiments/scripts/apr12",
    "archive/yolo-experiments/scripts/apr13",
    "archive/yolo-experiments/scripts/apr14_15",
    "archive/yolo-experiments/scripts/apr16_17",
    "archive/yolo-experiments/scripts/apr18_20",
    "scripts/yolo-training/active",
    "scripts/yolo-training/phase-a",
    "scripts/yolo-training/phase-b",
    "scripts/yolo-training/phase-c",
    "scripts/yolo-training/utilities",
    "config/aiquery",
    "test-results/archived",
    "docs/screenshots/e2e",
    "docs/screenshots/server",
    "docs/screenshots/demo",
    "docs/screenshots/misc",
    "releases",
    "data/samples"
) | Out-Null
Write-Host "✓ 目录创建完成" -ForegroundColor Green
Write-Host ""

# 第二步: 整理截图
Write-Host "[第2步] 整理截图" -ForegroundColor Yellow
@{
    'e2e-*.png' = 'docs/screenshots/e2e'
    'ssc-*.png' = 'docs/screenshots/server'
    'demo-*.png' = 'docs/screenshots/demo'
    'r*-*.png' = 'docs/screenshots/misc'
    'qa-*.png' = 'docs/screenshots/misc'
    'fallback-*.png' = 'docs/screenshots/misc'
    'w*-*.png' = 'docs/screenshots/misc'
}.GetEnumerator() | ForEach-Object {
    $files = Get-Item $_.Key -ErrorAction SilentlyContinue
    if ($files) {
        Move-Item -Path $_.Key -Destination $_.Value -Force -ErrorAction SilentlyContinue
        Write-Host "✓ $($_.Key)" -ForegroundColor Green
    }
}
Write-Host ""

# 第三步: 整理配置文件
Write-Host "[第3步] 整理配置文件" -ForegroundColor Yellow
Get-Item "aiquery-*.yml" -ErrorAction SilentlyContinue |
    Move-Item -Destination "config/aiquery/" -Force -ErrorAction SilentlyContinue
if ($?) { Write-Host "✓ aiquery 配置" -ForegroundColor Green }
Write-Host ""

# 第四步: 整理测试结果
Write-Host "[第4步] 整理测试结果" -ForegroundColor Yellow
@('p1_batch*.txt', 'p1_all.txt', 'prod_batch*.txt') | ForEach-Object {
    Get-Item $_ -ErrorAction SilentlyContinue |
        Move-Item -Destination "test-results/archived/" -Force -ErrorAction SilentlyContinue
    if ($?) { Write-Host "✓ $_" -ForegroundColor Green }
}
Write-Host ""

# 第五步: 整理大文件
Write-Host "[第5步] 整理大文件" -ForegroundColor Yellow
@(
    @('CretasFoodTrace*.apk', 'releases/'),
    @('zenodo_sample.zip', 'data/samples/'),
    @('*订单销售明细表.zip', 'data/samples/')
) | ForEach-Object {
    Get-Item $_[0] -ErrorAction SilentlyContinue |
        Move-Item -Destination $_[1] -Force -ErrorAction SilentlyContinue
    if ($?) { Write-Host "✓ $($_[0])" -ForegroundColor Green }
}
Write-Host ""

# 第六步: 删除无用文件（可选）
Write-Host "[第6步] 清理根目录日志 (可选)" -ForegroundColor Yellow
Write-Host "将执行以下删除:" -ForegroundColor Cyan
Write-Host "  - 2026-04-07-*.txt (旧验证计划)"
Write-Host "  - bash.exe.stackdump, du.exe.stackdump"
Write-Host "  - nul, NOW()"
$confirm = Read-Host "是否继续? [y/N]"
if ($confirm -eq 'y') {
    Remove-Item "2026-04-07-*.txt" -Force -ErrorAction SilentlyContinue
    Remove-Item "bash.exe.stackdump", "du.exe.stackdump" -Force -ErrorAction SilentlyContinue
    Remove-Item "nul", "NOW()" -Force -ErrorAction SilentlyContinue
    Write-Host "✓ 清理完成" -ForegroundColor Green
} else {
    Write-Host "跳过删除步骤" -ForegroundColor Yellow
}
Write-Host ""

# 最后: 统计
Write-Host "======================================" -ForegroundColor Green
Write-Host "整理完成！" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "根目录文件统计:"
$tmpCount = @(Get-Item tmp_*.py -ErrorAction SilentlyContinue).Count
$coreCount = @(Get-Item labeling_pipeline*.py, orchestrator.py, post_pipeline.py, final_merge.py, leakage_check.py -ErrorAction SilentlyContinue).Count
$screenshotCount = @(Get-ChildItem -Recurse docs/screenshots -Name "*.png" -ErrorAction SilentlyContinue).Count
Write-Host "  - 临时脚本: $tmpCount 个 (根目录等待分类)"
Write-Host "  - 核心脚本: $coreCount 个 (根目录)"
Write-Host "  - 截图: $screenshotCount 个 (已整理)"
Write-Host ""
Write-Host "下一步:" -ForegroundColor Cyan
Write-Host "  1. 手动分类 tmp_*.py (活跃脚本 → scripts/yolo-training/active/)"
Write-Host "  2. 提交整理结果: git add -A && git commit -m 'chore: organize root directory'"
Write-Host ""
