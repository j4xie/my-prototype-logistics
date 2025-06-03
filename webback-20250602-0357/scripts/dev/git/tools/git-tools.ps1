#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Git工具脚本，用于简化Git操作。
.DESCRIPTION
    此脚本提供了一组快速Git命令，帮助团队成员更高效地使用Git。
.PARAMETER Command
    要执行的命令，如push、s(status)、b(branch)等。
.PARAMETER Message
    提交信息（适用于push和commit命令）。
#>

param (
    [Parameter(Position=0)]
    [string]$Command,
    
    [Parameter(Position=1, ValueFromRemainingArguments=$true)]
    [string[]]$Args
)

# 快速提交并推送
function Push-Changes {
    param ([string]$Message)
    
    if (-not $Message) {
        Write-Host "错误: 提交信息不能为空" -ForegroundColor Red
        return
    }
    
    Write-Host "添加所有更改..." -ForegroundColor Cyan
    git add .
    
    Write-Host "提交更改: $Message" -ForegroundColor Cyan
    git commit -m "$Message"
    
    Write-Host "推送到远程仓库..." -ForegroundColor Cyan
    git push
    
    Write-Host "操作完成!" -ForegroundColor Green
}

# 查看简洁状态
function Get-Status {
    Write-Host "当前Git状态:" -ForegroundColor Cyan
    git status -s
}

# 添加所有更改
function Add-All {
    Write-Host "添加所有更改..." -ForegroundColor Cyan
    git add .
    git status -s
}

# 提交更改
function Commit-Changes {
    param ([string]$Message)
    
    if (-not $Message) {
        Write-Host "错误: 提交信息不能为空" -ForegroundColor Red
        return
    }
    
    Write-Host "提交更改: $Message" -ForegroundColor Cyan
    git commit -m "$Message"
}

# 推送到远程仓库
function Push-ToRemote {
    Write-Host "推送到远程仓库..." -ForegroundColor Cyan
    git push
}

# 列出分支
function List-Branches {
    Write-Host "分支列表:" -ForegroundColor Cyan
    git branch -a
}

# 切换分支
function Switch-Branch {
    param ([string]$Branch)
    
    if (-not $Branch) {
        Write-Host "错误: 分支名不能为空" -ForegroundColor Red
        return
    }
    
    Write-Host "切换到分支: $Branch" -ForegroundColor Cyan
    git checkout $Branch
}

# 查看最近提交记录
function Get-Log {
    param ([int]$Count = 5)
    
    Write-Host "最近 $Count 条提交记录:" -ForegroundColor Cyan
    git log --oneline -n $Count
}

# 显示帮助信息
function Show-Help {
    Write-Host "Git工具脚本 - 简化Git操作" -ForegroundColor Cyan
    Write-Host "用法: git-tools <命令> [参数]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "可用命令:" -ForegroundColor Yellow
    Write-Host "  push <message>    - 添加所有更改、提交并推送"
    Write-Host "  s                 - 查看简洁状态"
    Write-Host "  a                 - 添加所有更改"
    Write-Host "  c <message>       - 提交更改"
    Write-Host "  p                 - 推送到远程仓库"
    Write-Host "  b                 - 列出分支"
    Write-Host "  co <branch>       - 切换分支"
    Write-Host "  l [count]         - 查看最近提交记录"
    Write-Host "  help              - 显示此帮助信息"
}

# 主逻辑
switch ($Command) {
    "push" { Push-Changes -Message ($Args -join " ") }
    "s" { Get-Status }
    "a" { Add-All }
    "c" { Commit-Changes -Message ($Args -join " ") }
    "p" { Push-ToRemote }
    "b" { List-Branches }
    "co" { Switch-Branch -Branch $Args[0] }
    "l" { 
        if ($Args.Count -gt 0) {
            Get-Log -Count ([int]$Args[0]) 
        } else {
            Get-Log
        }
    }
    "help" { Show-Help }
    default { Show-Help }
} 