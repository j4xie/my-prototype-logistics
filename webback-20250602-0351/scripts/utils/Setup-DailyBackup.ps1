# Windows任务计划程序设置脚本
# 用法: .\Setup-DailyBackup.ps1
# 描述: 设置每日自动备份任务

param(
    [string]$BackupTime = "02:00",  # 默认凌晨2点备份
    [switch]$Remove  # 移除已存在的任务
)

# 设置编码
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 配置参数
$TaskName = "HeiNiu-Project-Daily-Backup"
$ProjectRoot = "C:\Users\Steve\heiniu"
$ScriptPath = "$ProjectRoot\scripts\utils\Create-ProjectBackup.ps1"
$LogPath = "$ProjectRoot\scripts\utils\backup.log"

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

function Test-AdminRights {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Remove-ExistingTask {
    param([string]$Name)

    try {
        $task = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
        if ($task) {
            Unregister-ScheduledTask -TaskName $Name -Confirm:$false
            Write-ColorLog "已删除现有任务: $Name" "Yellow"
            return $true
        } else {
            Write-ColorLog "任务不存在: $Name" "Blue"
            return $false
        }
    }
    catch {
        Write-ColorLog "删除任务时出错: $($_.Exception.Message)" "Red"
        return $false
    }
}

function Create-BackupTask {
    param(
        [string]$Name,
        [string]$Time,
        [string]$Script,
        [string]$WorkingDir,
        [string]$LogFile
    )

    try {
        # 创建任务动作
        $action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Script`" > `"$LogFile`" 2>&1" -WorkingDirectory $WorkingDir

        # 创建任务触发器（每日）
        $trigger = New-ScheduledTaskTrigger -Daily -At $Time

        # 创建任务设置
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable:$false

        # 创建任务主体（使用当前用户）
        $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

        # 注册任务
        Register-ScheduledTask -TaskName $Name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "HeiNiu项目每日自动备份"

        Write-ColorLog "任务创建成功: $Name" "Green"
        Write-ColorLog "备份时间: 每日 $Time" "Green"
        Write-ColorLog "日志文件: $LogFile" "Green"

        return $true
    }
    catch {
        Write-ColorLog "创建任务失败: $($_.Exception.Message)" "Red"
        return $false
    }
}

function Show-TaskInfo {
    param([string]$Name)

    try {
        $task = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
        if ($task) {
            Write-ColorLog "任务信息:" "Blue"
            Write-ColorLog "  名称: $($task.TaskName)" "White"
            Write-ColorLog "  状态: $($task.State)" "White"

            $trigger = $task.Triggers[0]
            if ($trigger) {
                Write-ColorLog "  触发时间: 每日 $($trigger.StartBoundary.ToString('HH:mm'))" "White"
            }

            # 获取最后运行时间
            $taskInfo = Get-ScheduledTaskInfo -TaskName $Name -ErrorAction SilentlyContinue
            if ($taskInfo) {
                if ($taskInfo.LastRunTime) {
                    Write-ColorLog "  上次运行: $($taskInfo.LastRunTime.ToString('yyyy-MM-dd HH:mm:ss'))" "White"
                }
                if ($taskInfo.NextRunTime) {
                    Write-ColorLog "  下次运行: $($taskInfo.NextRunTime.ToString('yyyy-MM-dd HH:mm:ss'))" "White"
                }
                Write-ColorLog "  最后结果: $($taskInfo.LastTaskResult)" "White"
            }
        } else {
            Write-ColorLog "任务不存在: $Name" "Yellow"
        }
    }
    catch {
        Write-ColorLog "获取任务信息时出错: $($_.Exception.Message)" "Red"
    }
}

# 主执行逻辑
try {
    Write-ColorLog "HeiNiu项目每日备份任务设置" "Cyan"
    Write-ColorLog "项目路径: $ProjectRoot" "Blue"
    Write-ColorLog "脚本路径: $ScriptPath" "Blue"
    Write-ColorLog "日志路径: $LogPath" "Blue"

    # 检查管理员权限
    if (-not (Test-AdminRights)) {
        Write-ColorLog "警告: 建议以管理员身份运行以确保任务正常工作" "Yellow"
        $continue = Read-Host "是否继续? (y/N)"
        if ($continue -ne "y" -and $continue -ne "Y") {
            Write-ColorLog "操作已取消" "Yellow"
            exit 0
        }
    }

    # 检查脚本文件是否存在
    if (-not (Test-Path $ScriptPath)) {
        Write-ColorLog "备份脚本不存在: $ScriptPath" "Red"
        exit 1
    }

    # 如果指定了Remove参数，删除任务并退出
    if ($Remove) {
        Write-ColorLog "删除现有备份任务..." "Yellow"
        $removed = Remove-ExistingTask -Name $TaskName
        if ($removed) {
            Write-ColorLog "任务删除完成" "Green"
        }
        exit 0
    }

    # 检查并删除现有任务
    $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-ColorLog "发现现有任务，正在删除..." "Yellow"
        Remove-ExistingTask -Name $TaskName | Out-Null
    }

    # 创建新任务
    Write-ColorLog "创建每日备份任务..." "Yellow"
    $success = Create-BackupTask -Name $TaskName -Time $BackupTime -Script $ScriptPath -WorkingDir $ProjectRoot -LogFile $LogPath

    if ($success) {
        Write-ColorLog "备份任务设置完成!" "Green"
        Write-ColorLog "" "White"

        # 显示任务信息
        Show-TaskInfo -Name $TaskName

        Write-ColorLog "" "White"
        Write-ColorLog "使用说明:" "Blue"
        Write-ColorLog "  手动运行备份: npm run backup" "White"
        Write-ColorLog "  查看备份日志: Get-Content '$LogPath'" "White"
        Write-ColorLog "  管理任务: 搜索 '任务计划程序' 并找到 '$TaskName'" "White"
        Write-ColorLog "  删除任务: .\Setup-DailyBackup.ps1 -Remove" "White"

        # 询问是否立即测试备份
        Write-ColorLog "" "White"
        $test = Read-Host "是否立即测试一次备份? (y/N)"
        if ($test -eq "y" -or $test -eq "Y") {
            Write-ColorLog "开始测试备份..." "Yellow"
            & $ScriptPath
        }
    } else {
        Write-ColorLog "备份任务设置失败!" "Red"
        exit 1
    }
}
catch {
    Write-ColorLog "脚本执行出错: $($_.Exception.Message)" "Red"
    exit 1
}

Write-ColorLog "脚本执行完成" "Cyan"
