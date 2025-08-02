# 黑牛系统服务管理脚本 (PowerShell版本)
# 支持更强大的功能和错误处理

param(
    [Parameter(Position=0)]
    [ValidateSet('start', 'stop', 'restart', 'status')]
    [string]$Action = 'restart'
)

# 设置编码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 颜色定义
$colors = @{
    'Success' = 'Green'
    'Warning' = 'Yellow'
    'Error' = 'Red'
    'Info' = 'Cyan'
}

# 项目路径
$projectRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $projectRoot "backend"
$frontendPath = Join-Path $projectRoot "frontend\web-app-next"

# 服务配置
$services = @(
    @{
        Name = "Frontend"
        Port = 3000
        Path = $frontendPath
        Command = "npm run dev"
        DisplayName = "黑牛前端服务"
    },
    @{
        Name = "Backend"
        Port = 3001
        Path = $backendPath
        Command = "npm run dev"
        DisplayName = "黑牛后端服务"
    }
)

# 函数：输出彩色信息
function Write-ColorOutput {
    param($Message, $Type = 'Info')
    Write-Host $Message -ForegroundColor $colors[$Type]
}

# 函数：检查端口占用
function Get-PortProcess {
    param($Port)
    $netstat = netstat -ano | Select-String ":$Port.*LISTENING"
    if ($netstat) {
        $pid = $netstat -split '\s+' | Select-Object -Last 1
        if ($pid -and $pid -ne '0') {
            return [int]$pid
        }
    }
    return $null
}

# 函数：停止占用端口的进程
function Stop-PortProcess {
    param($Port, $ServiceName)
    $pid = Get-PortProcess -Port $Port
    if ($pid) {
        Write-ColorOutput "[$ServiceName] 发现进程 PID: $pid 占用端口 $Port" 'Warning'
        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Write-ColorOutput "[$ServiceName] 进程已停止" 'Success'
            Start-Sleep -Seconds 1
        } catch {
            Write-ColorOutput "[$ServiceName] 停止进程失败: $_" 'Error'
        }
    }
}

# 函数：启动服务
function Start-Service {
    param($Service)
    Write-ColorOutput "`n正在启动 $($Service.DisplayName)..." 'Info'
    
    # 先停止占用端口的进程
    Stop-PortProcess -Port $Service.Port -ServiceName $Service.Name
    
    # 切换到服务目录并启动
    try {
        $startInfo = New-Object System.Diagnostics.ProcessStartInfo
        $startInfo.FileName = "cmd.exe"
        $startInfo.Arguments = "/c cd /d `"$($Service.Path)`" && $($Service.Command)"
        $startInfo.WorkingDirectory = $Service.Path
        $startInfo.UseShellExecute = $true
        $startInfo.CreateNoWindow = $false
        $startInfo.WindowStyle = 'Normal'
        
        $process = [System.Diagnostics.Process]::Start($startInfo)
        Write-ColorOutput "[$($Service.Name)] 启动命令已执行 (PID: $($process.Id))" 'Success'
    } catch {
        Write-ColorOutput "[$($Service.Name)] 启动失败: $_" 'Error'
    }
}

# 函数：停止服务
function Stop-Service {
    param($Service)
    Write-ColorOutput "`n正在停止 $($Service.DisplayName)..." 'Info'
    Stop-PortProcess -Port $Service.Port -ServiceName $Service.Name
}

# 函数：检查服务状态
function Get-ServiceStatus {
    param($Service)
    $pid = Get-PortProcess -Port $Service.Port
    if ($pid) {
        Write-ColorOutput "[$($Service.Name)] 运行中 (PID: $pid, Port: $($Service.Port))" 'Success'
    } else {
        Write-ColorOutput "[$($Service.Name)] 未运行" 'Warning'
    }
}

# 函数：检查MySQL服务
function Check-MySQL {
    try {
        $mysqlService = Get-Service -Name "MySQL" -ErrorAction SilentlyContinue
        if ($mysqlService) {
            if ($mysqlService.Status -eq 'Running') {
                Write-ColorOutput "[MySQL] 服务运行中" 'Success'
            } else {
                Write-ColorOutput "[MySQL] 服务已安装但未运行" 'Warning'
                if ($Action -eq 'start' -or $Action -eq 'restart') {
                    Write-ColorOutput "正在启动MySQL服务..." 'Info'
                    Start-Service -Name "MySQL"
                    Write-ColorOutput "[MySQL] 服务已启动" 'Success'
                }
            }
        } else {
            Write-ColorOutput "[MySQL] 服务未安装" 'Warning'
        }
    } catch {
        Write-ColorOutput "[MySQL] 检查失败: $_" 'Error'
    }
}

# 主程序
Write-Host ""
Write-ColorOutput "=====================================" 'Info'
Write-ColorOutput "   黑牛系统服务管理工具 v1.0" 'Info'
Write-ColorOutput "=====================================" 'Info'
Write-Host ""

switch ($Action) {
    'start' {
        Write-ColorOutput "执行操作: 启动所有服务" 'Info'
        Check-MySQL
        foreach ($service in $services) {
            Start-Service -Service $service
        }
    }
    'stop' {
        Write-ColorOutput "执行操作: 停止所有服务" 'Info'
        foreach ($service in $services) {
            Stop-Service -Service $service
        }
    }
    'restart' {
        Write-ColorOutput "执行操作: 重启所有服务" 'Info'
        foreach ($service in $services) {
            Stop-Service -Service $service
        }
        Start-Sleep -Seconds 2
        Check-MySQL
        foreach ($service in $services) {
            Start-Service -Service $service
        }
    }
    'status' {
        Write-ColorOutput "执行操作: 检查服务状态" 'Info'
        Check-MySQL
        foreach ($service in $services) {
            Get-ServiceStatus -Service $service
        }
    }
}

Write-Host ""
Write-ColorOutput "=====================================" 'Info'
Write-ColorOutput "操作完成！" 'Success'
Write-ColorOutput "=====================================" 'Info'
Write-Host ""
Write-ColorOutput "服务地址:" 'Info'
Write-ColorOutput "  前端: http://localhost:3000" 'Info'
Write-ColorOutput "  后端: http://localhost:3001" 'Info'
Write-ColorOutput "  数据库: localhost:3306" 'Info'
Write-Host ""