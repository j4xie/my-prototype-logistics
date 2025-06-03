# Simple encoding checker script
# Usage: .\simple-encoding-check.ps1

$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$CriticalFiles = @(
    "DIRECTORY_STRUCTURE.md",
    "docs/directory-structure-changelog.md",
    "README.md",
    "TASKS.md"
)

Write-Host "=== Encoding Check Started ===" -ForegroundColor Cyan
Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Blue

$issueCount = 0

foreach ($file in $CriticalFiles) {
    Write-Host "Checking: $file" -ForegroundColor Yellow

    if (-not (Test-Path $file)) {
        Write-Host "  X File not found" -ForegroundColor Red
        $issueCount++
        continue
    }

    try {
        $content = Get-Content $file -Encoding UTF8 -Raw
        $hasReplacementChars = $content -match "�"

        if ($hasReplacementChars) {
            Write-Host "  X Found replacement characters - encoding damaged" -ForegroundColor Red
            $issueCount++
        } else {
            Write-Host "  OK Encoding normal" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "  X Read error: $($_.Exception.Message)" -ForegroundColor Red
        $issueCount++
    }
}

Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Total files: $($CriticalFiles.Count)" -ForegroundColor Blue
Write-Host "Issues found: $issueCount" -ForegroundColor $(if ($issueCount -eq 0) { "Green" } else { "Red" })

if ($issueCount -eq 0) {
    Write-Host "All files are OK!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Found $issueCount encoding issues" -ForegroundColor Red
    exit 1
}
