# ========================================
# PowerShell Profile Manager - Safe Management Tool
# ========================================
# Provides safe management of PowerShell Profile content
# Prevents corruption through proper validation and backup

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("add", "remove", "list", "backup", "restore", "health", "reset", "help")]
    [string]$Action = "help",
    
    [Parameter(Mandatory=$false)]
    [string]$SectionName,
    
    [Parameter(Mandatory=$false)]
    [string]$ContentFile,
    
    [Parameter(Mandatory=$false)]
    [string]$BackupPath
)

# Color output functions
function Write-Success { param($Message) Write-Host $Message -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host $Message -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host $Message -ForegroundColor Red }
function Write-Info { param($Message) Write-Host $Message -ForegroundColor Cyan }
function Write-Subtitle { param($Message) Write-Host $Message -ForegroundColor Gray }

# Profile health check
function Test-ProfileHealth {
    param([string]$ProfilePath)
    
    if (!(Test-Path $ProfilePath)) {
        Write-Info "Profile doesn't exist: $ProfilePath"
        return @{ Status = "NotExists"; Size = 0; Lines = 0; IsHealthy = $true }
    }
    
    $size = (Get-Item $ProfilePath).Length
    $content = Get-Content $ProfilePath -ErrorAction SilentlyContinue
    $lines = if ($content) { $content.Count } else { 0 }
    
    $isHealthy = ($size -lt 100KB) -and ($lines -lt 1000)
    
    return @{
        Status = "Exists"
        Size = $size
        Lines = $lines
        IsHealthy = $isHealthy
        SizeKB = [math]::Round($size/1KB, 2)
    }
}

# Create backup
function New-ProfileBackup {
    param([string]$ProfilePath, [string]$BackupDir = "")
    
    if (!(Test-Path $ProfilePath)) {
        Write-Warning "Profile doesn't exist, no backup needed."
        return $null
    }
    
    if ($BackupDir -eq "") {
        $BackupDir = Split-Path $ProfilePath -Parent
    }
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupName = "Microsoft.PowerShell_profile.ps1.backup.$timestamp"
    $backupPath = Join-Path $BackupDir $backupName
    
    try {
        Copy-Item $ProfilePath $backupPath -ErrorAction Stop
        Write-Success "✓ Backup created: $backupName"
        return $backupPath
    } catch {
        Write-Error "✗ Failed to create backup: $($_.Exception.Message)"
        return $null
    }
}

# List all sections in profile
function Get-ProfileSections {
    param([string]$ProfilePath)
    
    if (!(Test-Path $ProfilePath)) {
        return @()
    }
    
    $content = Get-Content $ProfilePath -Raw -ErrorAction SilentlyContinue
    if (!$content) { return @() }
    
    $sections = @()
    $matches = [regex]::Matches($content, '# === (.+?) START ===')
    
    foreach ($match in $matches) {
        $sectionName = $match.Groups[1].Value
        $startMarker = "# === $sectionName START ==="
        $endMarker = "# === $sectionName END ==="
        
        # Check if end marker exists
        $hasEnd = $content -match [regex]::Escape($endMarker)
        
        $sections += @{
            Name = $sectionName
            StartMarker = $startMarker
            EndMarker = $endMarker
            HasEnd = $hasEnd
            Status = if ($hasEnd) { "Complete" } else { "Incomplete" }
        }
    }
    
    return $sections
}

# Add or update section in profile
function Set-ProfileSection {
    param(
        [string]$ProfilePath,
        [string]$SectionName,
        [string]$Content
    )
    
    # Validate inputs
    if ([string]::IsNullOrWhiteSpace($SectionName)) {
        Write-Error "Section name cannot be empty"
        return $false
    }
    
    if ([string]::IsNullOrWhiteSpace($Content)) {
        Write-Error "Content cannot be empty"
        return $false
    }
    
    # Create backup first
    $backup = New-ProfileBackup -ProfilePath $ProfilePath
    if ((Test-Path $ProfilePath) -and !$backup) {
        Write-Error "Failed to create backup, aborting for safety"
        return $false
    }
    
    # Ensure profile directory exists
    $profileDir = Split-Path $ProfilePath -Parent
    if (!(Test-Path $profileDir)) {
        try {
            New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
            Write-Success "✓ Created profile directory"
        } catch {
            Write-Error "Failed to create profile directory: $($_.Exception.Message)"
            return $false
        }
    }
    
    # Read existing content
    $existingContent = ""
    if (Test-Path $ProfilePath) {
        $existingContent = Get-Content $ProfilePath -Raw -ErrorAction SilentlyContinue
        if ($null -eq $existingContent) { $existingContent = "" }
    }
    
    # Define markers
    $startMarker = "# === $SectionName START ==="
    $endMarker = "# === $SectionName END ==="
    
    # Remove old section if exists
    $pattern = [regex]::Escape($startMarker) + "[\s\S]*?" + [regex]::Escape($endMarker)
    $cleanContent = $existingContent -replace $pattern, ""
    $cleanContent = $cleanContent.Trim()
    
    # Create new section
    $wrappedContent = @"
$startMarker
$Content
$endMarker
"@
    
    # Combine content
    if ($cleanContent) {
        $finalContent = $cleanContent + "`n`n" + $wrappedContent
    } else {
        $finalContent = $wrappedContent
    }
    
    # Write to file
    try {
        Set-Content -Path $ProfilePath -Value $finalContent -Encoding UTF8 -ErrorAction Stop
        Write-Success "✓ Section '$SectionName' added/updated successfully"
        
        # Verify health after update
        $health = Test-ProfileHealth -ProfilePath $ProfilePath
        if (!$health.IsHealthy) {
            Write-Warning "⚠ Profile size is large after update ($(health.SizeKB) KB, $($health.Lines) lines)"
            Write-Warning "  Consider reviewing the content for potential issues"
        }
        
        return $true
    } catch {
        Write-Error "✗ Failed to update profile: $($_.Exception.Message)"
        
        # Try to restore backup if something went wrong
        if ($backup -and (Test-Path $backup)) {
            Write-Warning "Attempting to restore backup..."
            try {
                Copy-Item $backup $ProfilePath -Force
                Write-Success "✓ Backup restored"
            } catch {
                Write-Error "✗ Failed to restore backup: $($_.Exception.Message)"
            }
        }
        
        return $false
    }
}

# Remove section from profile
function Remove-ProfileSection {
    param(
        [string]$ProfilePath,
        [string]$SectionName
    )
    
    if (!(Test-Path $ProfilePath)) {
        Write-Warning "Profile doesn't exist"
        return $false
    }
    
    # Create backup first
    $backup = New-ProfileBackup -ProfilePath $ProfilePath
    if (!$backup) {
        Write-Error "Failed to create backup, aborting for safety"
        return $false
    }
    
    # Read content
    $content = Get-Content $ProfilePath -Raw -ErrorAction SilentlyContinue
    if (!$content) {
        Write-Warning "Profile is empty"
        return $false
    }
    
    # Define markers
    $startMarker = "# === $SectionName START ==="
    $endMarker = "# === $SectionName END ==="
    
    # Check if section exists
    if (!($content -match [regex]::Escape($startMarker))) {
        Write-Warning "Section '$SectionName' not found"
        return $false
    }
    
    # Remove section
    $pattern = [regex]::Escape($startMarker) + "[\s\S]*?" + [regex]::Escape($endMarker)
    $newContent = $content -replace $pattern, ""
    $newContent = $newContent.Trim()
    
    # Write back
    try {
        if ($newContent) {
            Set-Content -Path $ProfilePath -Value $newContent -Encoding UTF8 -ErrorAction Stop
        } else {
            # If content is empty, create minimal profile
            $minimalContent = "# PowerShell Profile`nWrite-Host `"PowerShell Ready`" -ForegroundColor Green"
            Set-Content -Path $ProfilePath -Value $minimalContent -Encoding UTF8 -ErrorAction Stop
        }
        
        Write-Success "✓ Section '$SectionName' removed successfully"
        return $true
    } catch {
        Write-Error "✗ Failed to remove section: $($_.Exception.Message)"
        return $false
    }
}

# Main script logic
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " PowerShell Profile Manager" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$profilePath = $PROFILE

switch ($Action.ToLower()) {
    "health" {
        Write-Info "Checking Profile Health..."
        Write-Host ""
        
        $health = Test-ProfileHealth -ProfilePath $profilePath
        
        Write-Host "Profile Path: " -NoNewline
        Write-Host $profilePath -ForegroundColor Yellow
        
        switch ($health.Status) {
            "NotExists" {
                Write-Host "Status: " -NoNewline
                Write-Host "Not Created" -ForegroundColor Gray
            }
            "Exists" {
                Write-Host "Status: " -NoNewline
                Write-Host "Exists" -ForegroundColor Green
                
                Write-Host "Size: " -NoNewline
                $sizeColor = if ($health.IsHealthy) { "Green" } else { "Red" }
                Write-Host "$($health.SizeKB) KB" -ForegroundColor $sizeColor
                
                Write-Host "Lines: " -NoNewline
                $lineColor = if ($health.Lines -lt 1000) { "Green" } else { "Red" }
                Write-Host "$($health.Lines)" -ForegroundColor $lineColor
                
                Write-Host "Health: " -NoNewline
                if ($health.IsHealthy) {
                    Write-Host "✓ Healthy" -ForegroundColor Green
                } else {
                    Write-Host "⚠ May need attention" -ForegroundColor Yellow
                    Write-Warning "Large profile files can slow PowerShell startup"
                }
            }
        }
    }
    
    "list" {
        Write-Info "Listing Profile Sections..."
        Write-Host ""
        
        $sections = Get-ProfileSections -ProfilePath $profilePath
        
        if ($sections.Count -eq 0) {
            Write-Host "No managed sections found in profile" -ForegroundColor Gray
        } else {
            Write-Host "Found $($sections.Count) section(s):" -ForegroundColor Green
            Write-Host ""
            
            foreach ($section in $sections) {
                Write-Host "  • " -NoNewline -ForegroundColor Cyan
                Write-Host $section.Name -NoNewline -ForegroundColor White
                Write-Host " (" -NoNewline -ForegroundColor Gray
                if ($section.Status -eq "Complete") {
                    Write-Host $section.Status -NoNewline -ForegroundColor Green
                } else {
                    Write-Host $section.Status -NoNewline -ForegroundColor Red
                }
                Write-Host ")" -ForegroundColor Gray
            }
        }
        
        # Show health summary
        Write-Host ""
        $health = Test-ProfileHealth -ProfilePath $profilePath
        if ($health.Status -eq "Exists") {
            Write-Host "Profile: $($health.SizeKB) KB, $($health.Lines) lines " -NoNewline -ForegroundColor Gray
            if ($health.IsHealthy) {
                Write-Host "✓" -ForegroundColor Green
            } else {
                Write-Host "⚠" -ForegroundColor Yellow
            }
        }
    }
    
    "backup" {
        Write-Info "Creating Profile Backup..."
        Write-Host ""
        
        $customBackupDir = if ($BackupPath) { $BackupPath } else { "" }
        $backup = New-ProfileBackup -ProfilePath $profilePath -BackupDir $customBackupDir
        
        if ($backup) {
            Write-Host "Backup Location: " -NoNewline
            Write-Host $backup -ForegroundColor Yellow
        }
    }
    
    "add" {
        if (!$SectionName -or !$ContentFile) {
            Write-Error "Usage: Profile-Manager.ps1 -Action add -SectionName 'NAME' -ContentFile 'path/to/file.ps1'"
            Write-Host ""
            Write-Host "Example:" -ForegroundColor Gray
            Write-Host "  .\Profile-Manager.ps1 -Action add -SectionName 'MY COMMANDS' -ContentFile 'my-functions.ps1'" -ForegroundColor Gray
            break
        }
        
        if (!(Test-Path $ContentFile)) {
            Write-Error "Content file not found: $ContentFile"
            break
        }
        
        Write-Info "Adding Section '$SectionName' to Profile..."
        Write-Host ""
        
        $content = Get-Content $ContentFile -Raw -ErrorAction SilentlyContinue
        if (!$content) {
            Write-Error "Content file is empty or unreadable"
            break
        }
        
        $success = Set-ProfileSection -ProfilePath $profilePath -SectionName $SectionName -Content $content
        
        if ($success) {
            Write-Host ""
            Write-Success "Section added successfully!"
            Write-Host "Restart PowerShell to use the new commands" -ForegroundColor Gray
        }
    }
    
    "remove" {
        if (!$SectionName) {
            Write-Error "Usage: Profile-Manager.ps1 -Action remove -SectionName 'NAME'"
            break
        }
        
        Write-Info "Removing Section '$SectionName' from Profile..."
        Write-Host ""
        
        $success = Remove-ProfileSection -ProfilePath $profilePath -SectionName $SectionName
        
        if ($success) {
            Write-Host ""
            Write-Success "Section removed successfully!"
            Write-Host "Restart PowerShell for changes to take effect" -ForegroundColor Gray
        }
    }
    
    "reset" {
        Write-Warning "This will reset your PowerShell Profile to minimal state!"
        Write-Host "All custom functions and configurations will be lost." -ForegroundColor Red
        Write-Host ""
        
        $confirm = Read-Host "Are you sure? Type 'YES' to confirm"
        if ($confirm -eq "YES") {
            # Create backup first
            $backup = New-ProfileBackup -ProfilePath $profilePath
            
            # Create minimal profile
            $minimalContent = @"
# ========================================
# PowerShell Profile - Reset on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
# ========================================

Write-Host "PowerShell Ready" -ForegroundColor Green
"@
            
            try {
                Set-Content -Path $profilePath -Value $minimalContent -Encoding UTF8 -ErrorAction Stop
                Write-Success "✓ Profile reset successfully!"
                
                if ($backup) {
                    Write-Host "Previous profile backed up to: $([System.IO.Path]::GetFileName($backup))" -ForegroundColor Gray
                }
                
                Write-Host "Restart PowerShell for changes to take effect" -ForegroundColor Gray
            } catch {
                Write-Error "Failed to reset profile: $($_.Exception.Message)"
            }
        } else {
            Write-Host "Reset cancelled" -ForegroundColor Yellow
        }
    }
    
    "help" {
        Write-Host "PowerShell Profile Manager - Safe Profile Management" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Usage:" -ForegroundColor Yellow
        Write-Host "  .\Profile-Manager.ps1 -Action <action> [options]" -ForegroundColor White
        Write-Host ""
        Write-Host "Actions:" -ForegroundColor Yellow
        Write-Host "  health                    - Check profile health and size" -ForegroundColor White
        Write-Host "  list                      - List all managed sections" -ForegroundColor White
        Write-Host "  backup [-BackupPath]      - Create profile backup" -ForegroundColor White
        Write-Host "  add -SectionName -ContentFile - Add section from file" -ForegroundColor White
        Write-Host "  remove -SectionName       - Remove section" -ForegroundColor White
        Write-Host "  reset                     - Reset profile to minimal state" -ForegroundColor White
        Write-Host "  help                      - Show this help" -ForegroundColor White
        Write-Host ""
        Write-Host "Examples:" -ForegroundColor Yellow
        Write-Host "  .\Profile-Manager.ps1 -Action health" -ForegroundColor Gray
        Write-Host "  .\Profile-Manager.ps1 -Action list" -ForegroundColor Gray
        Write-Host "  .\Profile-Manager.ps1 -Action backup" -ForegroundColor Gray
        Write-Host "  .\Profile-Manager.ps1 -Action add -SectionName 'DEV COMMANDS' -ContentFile 'dev-functions.ps1'" -ForegroundColor Gray
        Write-Host "  .\Profile-Manager.ps1 -Action remove -SectionName 'DEV COMMANDS'" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Safety Features:" -ForegroundColor Yellow
        Write-Host "  • Automatic backup before changes" -ForegroundColor Gray
        Write-Host "  • Health monitoring and warnings" -ForegroundColor Gray
        Write-Host "  • Safe section-based content management" -ForegroundColor Gray
        Write-Host "  • Corruption prevention and recovery" -ForegroundColor Gray
    }
    
    default {
        Write-Error "Unknown action: $Action"
        Write-Host "Use -Action help for usage information" -ForegroundColor Gray
    }
}

Write-Host ""