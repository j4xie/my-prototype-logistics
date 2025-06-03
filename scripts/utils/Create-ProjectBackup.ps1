# 项目自动备份脚本
# 用法: .\Create-ProjectBackup.ps1
# 描述: 创建项目的每日备份，保留最多2个版本

param(
    [int]$MaxBackups = 2,
    [switch]$Verbose
)

# 设置编码
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 配置参数
$ProjectRoot = "C:\Users\Steve\heiniu"
$BackupPrefix = "webback"
$TimeStamp = Get-Date -Format "yyyyMMdd-HHmm"
$BackupName = "$BackupPrefix-$TimeStamp"
$BackupPath = Join-Path $ProjectRoot $BackupName

# 排除的文件和目录
$ExcludeDirs = @(
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    "coverage",
    "tmp",
    "webback-*",
    "backup-*",
    "backups"
)

$ExcludeFiles = @(
    "*.log",
    "*.tmp",
    "*.cache",
    "package-lock.json",
    ".DS_Store",
    "Thumbs.db"
)

function Write-ColorLog {
    param(
        [string]$Message,
        [string]$Color = "White"
    )

    $timestamp = Get-Date -Format "HH:mm:ss"
    switch ($Color) {
        "Red" { Write-Host "[$timestamp] $Message" -ForegroundColor Red }
        "Green" { Write-Host "[$timestamp] $Message" -ForegroundColor Green }
        "Yellow" { Write-Host "[$timestamp] $Message" -ForegroundColor Yellow }
        "Blue" { Write-Host "[$timestamp] $Message" -ForegroundColor Blue }
        "Cyan" { Write-Host "[$timestamp] $Message" -ForegroundColor Cyan }
        default { Write-Host "[$timestamp] $Message" }
    }
}

function Remove-OldBackups {
    param([string]$ProjectPath, [string]$Prefix, [int]$MaxCount)

    try {
        $backupDirs = Get-ChildItem -Path $ProjectPath -Directory |
                     Where-Object { $_.Name -like "$Prefix-*" } |
                     Sort-Object CreationTime -Descending

        if ($backupDirs.Count -gt $MaxCount) {
            $toDelete = $backupDirs | Select-Object -Skip $MaxCount
            foreach ($dir in $toDelete) {
                Write-ColorLog "删除旧备份: $($dir.Name)" "Yellow"
                Remove-Item -Path $dir.FullName -Recurse -Force
            }
            Write-ColorLog "已删除 $($toDelete.Count) 个旧备份" "Green"
        }
    }
    catch {
        Write-ColorLog "清理旧备份时出错: $($_.Exception.Message)" "Red"
    }
}

function Copy-ProjectFiles {
    param([string]$SourcePath, [string]$DestPath, [array]$ExcludeDirs, [array]$ExcludeFiles)

    try {
        # 创建备份目录
        New-Item -ItemType Directory -Path $DestPath -Force | Out-Null

        # 获取所有文件和目录
        $items = Get-ChildItem -Path $SourcePath -Recurse
        $totalItems = $items.Count
        $copiedItems = 0
        $skippedItems = 0

        foreach ($item in $items) {
            $relativePath = $item.FullName.Substring($SourcePath.Length + 1)
            $shouldExclude = $false

            # 检查是否在排除目录中
            foreach ($excludeDir in $ExcludeDirs) {
                if ($relativePath -like "$excludeDir*" -or $relativePath -like "*\$excludeDir\*") {
                    $shouldExclude = $true
                    break
                }
            }

            # 检查是否在排除文件中
            if (-not $shouldExclude) {
                foreach ($excludeFile in $ExcludeFiles) {
                    if ($item.Name -like $excludeFile) {
                        $shouldExclude = $true
                        break
                    }
                }
            }

            if (-not $shouldExclude) {
                $destItemPath = Join-Path $DestPath $relativePath
                $destItemDir = Split-Path $destItemPath -Parent

                # 确保目标目录存在
                if (-not (Test-Path $destItemDir)) {
                    New-Item -ItemType Directory -Path $destItemDir -Force | Out-Null
                }

                # 复制文件
                if ($item.PSIsContainer) {
                    if (-not (Test-Path $destItemPath)) {
                        New-Item -ItemType Directory -Path $destItemPath -Force | Out-Null
                    }
                } else {
                    Copy-Item -Path $item.FullName -Destination $destItemPath -Force
                    $copiedItems++
                }
            } else {
                $skippedItems++
                if ($Verbose) {
                    Write-ColorLog "跳过: $relativePath" "Gray"
                }
            }
        }

        return @{
            Success = $true
            CopiedItems = $copiedItems
            SkippedItems = $skippedItems
            TotalItems = $totalItems
        }
    }
    catch {
        return @{
            Success = $false
            Error = $_.Exception.Message
        }
    }
}

function Get-DirectorySize {
    param([string]$Path)

    try {
        $size = (Get-ChildItem -Path $Path -Recurse -File | Measure-Object -Property Length -Sum).Sum
        return [math]::Round($size / 1MB, 2)
    }
    catch {
        return 0
    }
}

# 主执行逻辑
try {
    Write-ColorLog "开始项目备份..." "Cyan"
    Write-ColorLog "项目路径: $ProjectRoot" "Blue"
    Write-ColorLog "备份名称: $BackupName" "Blue"
    Write-ColorLog "最大备份数: $MaxBackups" "Blue"

    # 检查项目目录是否存在
    if (-not (Test-Path $ProjectRoot)) {
        Write-ColorLog "项目目录不存在: $ProjectRoot" "Red"
        exit 1
    }

    # 检查备份目录是否已存在
    if (Test-Path $BackupPath) {
        Write-ColorLog "备份目录已存在，删除后重新创建: $BackupName" "Yellow"
        Remove-Item -Path $BackupPath -Recurse -Force
    }

    Write-ColorLog "开始复制文件..." "Yellow"
    $result = Copy-ProjectFiles -SourcePath $ProjectRoot -DestPath $BackupPath -ExcludeDirs $ExcludeDirs -ExcludeFiles $ExcludeFiles

    if ($result.Success) {
        $backupSize = Get-DirectorySize -Path $BackupPath
        Write-ColorLog "备份完成!" "Green"
        Write-ColorLog "已复制文件: $($result.CopiedItems)" "Green"
        Write-ColorLog "跳过文件: $($result.SkippedItems)" "Green"
        Write-ColorLog "备份大小: $backupSize MB" "Green"
        Write-ColorLog "备份位置: $BackupPath" "Green"

        # 清理旧备份
        Write-ColorLog "清理旧备份..." "Yellow"
        Remove-OldBackups -ProjectPath $ProjectRoot -Prefix $BackupPrefix -MaxCount $MaxBackups

        Write-ColorLog "备份任务完成!" "Cyan"
    } else {
        Write-ColorLog "备份失败: $($result.Error)" "Red"
        exit 1
    }

    # 显示当前所有备份
    Write-ColorLog "当前备份列表:" "Blue"
    $currentBackups = Get-ChildItem -Path $ProjectRoot -Directory | Where-Object { $_.Name -like "$BackupPrefix-*" } | Sort-Object CreationTime -Descending
    foreach ($backup in $currentBackups) {
        $size = Get-DirectorySize -Path $backup.FullName
        Write-ColorLog "  $($backup.Name) (创建于: $($backup.CreationTime.ToString('yyyy-MM-dd HH:mm')), 大小: $size MB)" "White"
    }
}
catch {
    Write-ColorLog "备份脚本执行出错: $($_.Exception.Message)" "Red"
    exit 1
}
