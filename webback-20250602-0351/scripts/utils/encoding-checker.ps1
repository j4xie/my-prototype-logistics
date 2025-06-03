# 编码完整性检查脚本
# 用法: .\encoding-checker.ps1
# 描述: 检查项目中关键文件的编码完整性，防止编码问题

param(
    [switch]$Fix,
    [switch]$Verbose
)

# 设置控制台编码为UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# 关键文件列表
$CriticalFiles = @(
    "DIRECTORY_STRUCTURE.md",
    "docs/directory-structure-changelog.md",
    "README.md",
    "TASKS.md",
    "重构阶段记录.md",
    "项目重构方案.md",
    "所有文件解释.md"
)

# 颜色函数
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )

    switch ($Color) {
        "Red" { Write-Host $Message -ForegroundColor Red }
        "Green" { Write-Host $Message -ForegroundColor Green }
        "Yellow" { Write-Host $Message -ForegroundColor Yellow }
        "Blue" { Write-Host $Message -ForegroundColor Blue }
        "Cyan" { Write-Host $Message -ForegroundColor Cyan }
        default { Write-Host $Message }
    }
}

# 检查文件编码
function Test-FileEncoding {
    param([string]$FilePath)

    if (-not (Test-Path $FilePath)) {
        return @{
            Status = "NotFound"
            Encoding = $null
            HasReplacementChars = $false
            CharCount = 0
        }
    }

    try {
        # 尝试以UTF-8读取文件
        $content = Get-Content $FilePath -Encoding UTF8 -Raw
        $hasReplacementChars = $content -match "�"

        # 检测编码
        $bytes = [System.IO.File]::ReadAllBytes($FilePath)
        $encoding = "Unknown"

        # BOM检测
        if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
            $encoding = "UTF-8 with BOM"
        }
        elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
            $encoding = "UTF-16 LE"
        }
        elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
            $encoding = "UTF-16 BE"
        }
        else {
            # 尝试检测是否为有效的UTF-8
            try {
                $utf8 = [System.Text.Encoding]::UTF8.GetString($bytes)
                if ($utf8 -eq $content) {
                    $encoding = "UTF-8 (no BOM)"
                }
            }
            catch {
                $encoding = "Non-UTF8"
            }
        }

        return @{
            Status = "Found"
            Encoding = $encoding
            HasReplacementChars = $hasReplacementChars
            CharCount = $content.Length
            Size = $bytes.Length
        }
    }
    catch {
        return @{
            Status = "Error"
            Encoding = $null
            HasReplacementChars = $false
            CharCount = 0
            Error = $_.Exception.Message
        }
    }
}

# 主检查函数
function Invoke-EncodingCheck {
    Write-ColorOutput "🔍 编码完整性检查开始..." "Cyan"
    Write-ColorOutput "检查时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" "Blue"
    Write-ColorOutput "=" * 80 "Blue"

    $results = @()
    $issueCount = 0

    foreach ($file in $CriticalFiles) {
        Write-ColorOutput "检查文件: $file" "Yellow"

        $result = Test-FileEncoding $file
        $result.FilePath = $file
        $results += $result

        switch ($result.Status) {
            "NotFound" {
                Write-ColorOutput "  ❌ 文件不存在" "Red"
                $issueCount++
            }
            "Error" {
                Write-ColorOutput "  ❌ 读取错误: $($result.Error)" "Red"
                $issueCount++
            }
            "Found" {
                if ($result.HasReplacementChars) {
                    Write-ColorOutput "  ❌ 发现替换字符 (�) - 编码损坏" "Red"
                    $issueCount++
                }
                else {
                    Write-ColorOutput "  ✅ 编码正常" "Green"
                }

                if ($Verbose) {
                    Write-ColorOutput "     编码: $($result.Encoding)" "Gray"
                    Write-ColorOutput "     大小: $($result.Size) 字节" "Gray"
                    Write-ColorOutput "     字符数: $($result.CharCount)" "Gray"
                }
            }
        }
        Write-Host ""
    }

    # 总结报告
    Write-ColorOutput "=" * 80 "Blue"
    Write-ColorOutput "📊 检查总结" "Cyan"
    Write-ColorOutput "总文件数: $($CriticalFiles.Count)" "Blue"
    Write-ColorOutput "问题文件数: $issueCount" $(if ($issueCount -eq 0) { "Green" } else { "Red" })

    if ($issueCount -eq 0) {
        Write-ColorOutput "🎉 所有关键文件编码正常！" "Green"
    }
    else {
        Write-ColorOutput "⚠️  发现 $issueCount 个编码问题，建议检查和修复。" "Yellow"
        Write-ColorOutput "如果有GitHub备份，可以使用 -Fix 参数尝试自动修复。" "Yellow"
    }

    return $results
}

# 自动修复函数
function Invoke-EncodingFix {
    Write-ColorOutput "🔧 尝试自动修复编码问题..." "Cyan"

    # 检查是否有GitHub版本可用
    $githubBackup = "b:\Download-Chrome\"
    if (-not (Test-Path $githubBackup)) {
        Write-ColorOutput "❌ 未找到GitHub备份目录: $githubBackup" "Red"
        Write-ColorOutput "请手动从GitHub下载干净版本。" "Yellow"
        return
    }

    $fixedCount = 0
    foreach ($file in $CriticalFiles) {
        $result = Test-FileEncoding $file
        if ($result.Status -eq "Found" -and $result.HasReplacementChars) {
            $githubFile = Join-Path $githubBackup (Split-Path $file -Leaf)
            if (Test-Path $githubFile) {
                Write-ColorOutput "修复文件: $file" "Yellow"
                try {
                    Copy-Item $githubFile $file -Force
                    Write-ColorOutput "  ✅ 修复成功" "Green"
                    $fixedCount++
                }
                catch {
                    Write-ColorOutput "  ❌ 修复失败: $($_.Exception.Message)" "Red"
                }
            }
            else {
                Write-ColorOutput "  ⚠️  GitHub备份中未找到: $githubFile" "Yellow"
            }
        }
    }

    Write-ColorOutput "📊 修复完成: $fixedCount 个文件已修复" "Green"
}

# 主执行逻辑
try {
    if ($Fix) {
        Invoke-EncodingFix
        Write-ColorOutput "`n重新检查修复结果..." "Cyan"
    }

    $results = Invoke-EncodingCheck

    # 保存检查结果
    $reportPath = "scripts/utils/encoding-check-report-$(Get-Date -Format 'yyyyMMdd-HHmm').json"
    $results | ConvertTo-Json -Depth 3 | Set-Content $reportPath -Encoding UTF8
    Write-ColorOutput "📄 详细报告已保存: $reportPath" "Blue"
}
catch {
    Write-ColorOutput "❌ 脚本执行出错: $($_.Exception.Message)" "Red"
    exit 1
}
