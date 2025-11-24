# 快速检查 Java 17 安装状态

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Java 环境检查" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Java 版本
Write-Host "1. Java 版本：" -ForegroundColor Yellow
try {
    $javaVersion = java -version 2>&1 | Select-Object -First 1
    if ($javaVersion -match "version.*17") {
        Write-Host "   [完成] Java 17 已安装" -ForegroundColor Green
        java -version
    } elseif ($javaVersion -match "version") {
        Write-Host "   [警告] 当前版本不是 Java 17" -ForegroundColor Yellow
        java -version
    } else {
        Write-Host "   [错误] 未找到 Java" -ForegroundColor Red
    }
} catch {
    Write-Host "   [错误] 无法执行 java 命令" -ForegroundColor Red
}

Write-Host ""

# 检查 JAVA_HOME
Write-Host "2. JAVA_HOME 环境变量：" -ForegroundColor Yellow
$javaHome = [System.Environment]::GetEnvironmentVariable('JAVA_HOME', 'Machine')
if ($javaHome) {
    Write-Host "   [完成] JAVA_HOME = $javaHome" -ForegroundColor Green
    if (Test-Path $javaHome) {
        Write-Host "   [完成] 路径存在" -ForegroundColor Green
    } else {
        Write-Host "   [警告] 路径不存在" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [错误] JAVA_HOME 未设置" -ForegroundColor Red
}

Write-Host ""

# 检查 Java 17 安装目录
Write-Host "3. Java 17 安装目录检查：" -ForegroundColor Yellow
$java17Dirs = @(
    "C:\Program Files\Eclipse Adoptium\jdk-17*",
    "C:\Program Files\Java\jdk-17*"
)

$found = $false
foreach ($dir in $java17Dirs) {
    $paths = Get-ChildItem $dir -ErrorAction SilentlyContinue
    if ($paths) {
        foreach ($path in $paths) {
            Write-Host "   [发现] $($path.FullName)" -ForegroundColor Green
            $found = $true
        }
    }
}

if (-not $found) {
    Write-Host "   [未找到] 系统中未检测到 Java 17" -ForegroundColor Red
}

Write-Host ""

# 检查 javac 编译器
Write-Host "4. Java 编译器 (javac)：" -ForegroundColor Yellow
try {
    $javacVersion = javac -version 2>&1
    Write-Host "   [完成] $javacVersion" -ForegroundColor Green
} catch {
    Write-Host "   [错误] 未找到 javac 编译器" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "检查完成" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 总结
if ($javaVersion -match "version.*17" -and $javaHome) {
    Write-Host "[成功] Java 17 环境配置正确！" -ForegroundColor Green
    Write-Host ""
    Write-Host "可以开始构建 APK：" -ForegroundColor Yellow
    Write-Host "  cd android" -ForegroundColor Gray
    Write-Host "  .\gradlew.bat assembleRelease" -ForegroundColor Gray
} else {
    Write-Host "[需要] 请先完成 Java 17 安装" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "安装方法：" -ForegroundColor Yellow
    Write-Host "1. 右键运行: auto-install-java17.ps1 (以管理员身份)" -ForegroundColor White
    Write-Host "2. 或手动下载: https://adoptium.net/temurin/releases/" -ForegroundColor White
}

Write-Host ""


