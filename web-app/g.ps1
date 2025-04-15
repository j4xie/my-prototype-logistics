# Git Command Shortcuts Script

param(
    [string]$cmd = 'status',
    [string[]]$rest
)

function Show-Help {
    Write-Host "Git Command Shortcuts Tool" -ForegroundColor Cyan
    Write-Host "Usage: g <command> [arguments...]" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Common Commands:" -ForegroundColor Yellow
    Write-Host "  g s       - Show short status" -ForegroundColor Yellow
    Write-Host "  g a       - Add all files" -ForegroundColor Yellow
    Write-Host "  g c 'msg' - Commit changes" -ForegroundColor Yellow
    Write-Host "  g p       - Push to remote" -ForegroundColor Yellow
    Write-Host "  g b       - List branches" -ForegroundColor Yellow
    Write-Host "  g co name - Checkout branch" -ForegroundColor Yellow
    Write-Host "  g l       - View log" -ForegroundColor Yellow
    Write-Host ""
}

if ($cmd -eq "help" -or $cmd -eq "?") {
    Show-Help
    exit 0
}

Write-Host "Executing: git $cmd $rest" -ForegroundColor Cyan

switch ($cmd) {
    's' { git status -s }
    'a' { git add . }
    'p' { git push }
    'c' { git commit -m "$rest" }
    'b' { git branch }
    'co' { git checkout $rest }
    'l' { git log --oneline -n 10 }
    default { git $cmd $rest }
} 