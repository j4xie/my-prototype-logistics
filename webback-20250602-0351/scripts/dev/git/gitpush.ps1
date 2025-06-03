param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$CommitMessage
)

# 设置错误处理
$ErrorActionPreference = "Stop"

# 颜色输出函数
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

# 检查是否在Git仓库中
if (-not (Test-Path ".git")) {
    Write-ColorOutput "错误: 当前目录不是Git仓库" "Red"
    exit 1
}

try {
    Write-ColorOutput "🔄 开始Git推送流程..." "Cyan"
    Write-ColorOutput "提交信息: $CommitMessage" "Yellow"
    
    # 1. 添加所有更改
    Write-ColorOutput "📁 添加所有更改 (git add .)..." "Green"
    git add .
    
    # 检查是否有更改需要提交
    $status = git status --porcelain
    if (-not $status) {
        Write-ColorOutput "ℹ️  没有更改需要提交" "Yellow"
        exit 0
    }
    
    # 2. 提交更改
    Write-ColorOutput "💾 提交更改 (git commit)..." "Green"
    git commit -m $CommitMessage
    
    # 3. 推送到远程仓库
    Write-ColorOutput "🚀 推送到远程仓库 (git push)..." "Green"
    git push
    
    Write-ColorOutput "✅ Git推送完成!" "Green"
    Write-ColorOutput "提交信息: $CommitMessage" "Cyan"
    
} catch {
    Write-ColorOutput "❌ Git操作失败: $($_.Exception.Message)" "Red"
    exit 1
} 