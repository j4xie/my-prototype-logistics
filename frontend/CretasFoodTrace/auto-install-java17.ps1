# Java 17 自动安装脚本
# 需要管理员权限运行

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Java 17 自动安装脚本" -ForegroundColor Cyan
Write-Host "  CretasFoodTrace 项目" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[错误] 此脚本需要管理员权限" -ForegroundColor Red
    Write-Host ""
    Write-Host "请按照以下步骤操作：" -ForegroundColor Yellow
    Write-Host "1. 右键点击此文件" -ForegroundColor Yellow
    Write-Host "2. 选择 '使用 PowerShell 运行'" -ForegroundColor Yellow
    Write-Host "3. 如果提示权限，选择 '是'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "或者手动运行：" -ForegroundColor Yellow
    Write-Host "  Start-Process powershell -Verb RunAs -ArgumentList '-File', '$PSCommandPath'" -ForegroundColor Gray
    Write-Host ""
    pause
    exit 1
}

Write-Host "[完成] 管理员权限检查通过" -ForegroundColor Green
Write-Host ""

# 检查 Chocolatey
$chocoInstalled = Get-Command choco -ErrorAction SilentlyContinue

if (-not $chocoInstalled) {
    Write-Host "[错误] 未找到 Chocolatey" -ForegroundColor Red
    Write-Host ""
    Write-Host "正在安装 Chocolatey..." -ForegroundColor Yellow
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[错误] Chocolatey 安装失败" -ForegroundColor Red
        pause
        exit 1
    }
    
    # 刷新环境变量
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

Write-Host "[完成] Chocolatey 已就绪" -ForegroundColor Green
choco --version
Write-Host ""

# 检查是否已安装 Java 17
Write-Host "检查是否已安装 Java 17..." -ForegroundColor Yellow
$java17Path = Get-ChildItem "C:\Program Files\Eclipse Adoptium" -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "jdk-17*" } | Select-Object -First 1

if ($java17Path) {
    Write-Host "[信息] 检测到已安装的 Java 17: $($java17Path.FullName)" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "是否重新安装？(Y/N)"
    if ($continue -ne "Y" -and $continue -ne "y") {
        Write-Host "[跳过] 使用现有安装" -ForegroundColor Green
        $javaHome = $java17Path.FullName
    } else {
        $javaHome = $null
    }
} else {
    $javaHome = $null
}

if (-not $javaHome) {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "开始安装 Java 17 (Eclipse Temurin)" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "这可能需要 3-5 分钟，请耐心等待..." -ForegroundColor Yellow
    Write-Host ""
    
    # 安装 Java 17
    choco install temurin17 -y
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "[错误] Java 17 安装失败" -ForegroundColor Red
        Write-Host ""
        Write-Host "请尝试手动安装：" -ForegroundColor Yellow
        Write-Host "1. 访问: https://adoptium.net/temurin/releases/" -ForegroundColor Yellow
        Write-Host "2. 下载 JDK 17 - Windows x64 .msi" -ForegroundColor Yellow
        Write-Host "3. 运行安装程序" -ForegroundColor Yellow
        Write-Host ""
        pause
        exit 1
    }
    
    # 查找安装路径
    $java17Path = Get-ChildItem "C:\Program Files\Eclipse Adoptium" -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "jdk-17*" } | Select-Object -First 1
    $javaHome = $java17Path.FullName
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "配置环境变量" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 设置 JAVA_HOME
Write-Host "设置 JAVA_HOME = $javaHome" -ForegroundColor Yellow
[System.Environment]::SetEnvironmentVariable('JAVA_HOME', $javaHome, 'Machine')

# 添加到 PATH
$currentPath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
if ($currentPath -notlike "*%JAVA_HOME%\bin*" -and $currentPath -notlike "*$javaHome\bin*") {
    Write-Host "添加到 PATH..." -ForegroundColor Yellow
    $newPath = "$currentPath;%JAVA_HOME%\bin"
    [System.Environment]::SetEnvironmentVariable('Path', $newPath, 'Machine')
    Write-Host "[完成] PATH 已更新" -ForegroundColor Green
} else {
    Write-Host "[完成] PATH 已包含 Java" -ForegroundColor Green
}

# 更新当前会话的环境变量
$env:JAVA_HOME = $javaHome
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "验证安装" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Java 版本：" -ForegroundColor Yellow
java -version
Write-Host ""

Write-Host "JAVA_HOME：" -ForegroundColor Yellow
Write-Host $env:JAVA_HOME -ForegroundColor Green
Write-Host ""

Write-Host "Java 编译器：" -ForegroundColor Yellow
javac -version
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "安装完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "下一步操作：" -ForegroundColor Yellow
Write-Host "1. 关闭所有终端窗口" -ForegroundColor White
Write-Host "2. 重新打开终端" -ForegroundColor White
Write-Host "3. 运行构建命令：" -ForegroundColor White
Write-Host "   cd C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\android" -ForegroundColor Gray
Write-Host "   .\gradlew.bat assembleRelease" -ForegroundColor Gray
Write-Host ""

pause


