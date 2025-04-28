# Web App Migration Script
# Move existing web application to web-app subdirectory
# This will allow adding Flutter app in the same repository

# Setup paths
$rootDir = Get-Location
$webAppDir = Join-Path -Path $rootDir -ChildPath "web-app"

# Create web-app directory if it doesn't exist
if (-not (Test-Path -Path $webAppDir)) {
    Write-Host "Creating web-app directory..."
    New-Item -Path $webAppDir -ItemType Directory | Out-Null
} else {
    Write-Host "web-app directory already exists..."
}

# Create list of files to keep in root
$filesToKeepInRoot = @(
    ".git",
    ".gitignore",
    "README.md",
    "LICENSE",
    "move-to-web-app.ps1",
    "web-app"
)

# Create list of directories for special handling
$specialDirs = @(
    "node_modules"
)

# Move files to web-app directory
Write-Host "Moving files to web-app directory..."
$allItems = Get-ChildItem -Path $rootDir -Force

foreach ($item in $allItems) {
    $itemName = $item.Name
    
    # Skip files to keep in root
    if ($filesToKeepInRoot -contains $itemName) {
        Write-Host "Keeping in root: $itemName"
        continue
    }
    
    # Skip special directories (like node_modules)
    if ($specialDirs -contains $itemName) {
        Write-Host "Skipping special directory: $itemName"
        continue
    }
    
    # Target path
    $targetPath = Join-Path -Path $webAppDir -ChildPath $itemName
    
    # Check if target path already exists
    if (Test-Path -Path $targetPath) {
        Write-Host "Target already exists, skipping: $itemName"
        continue
    }
    
    # Move item
    try {
        Write-Host "Moving: $itemName to web-app/"
        Move-Item -Path $item.FullName -Destination $targetPath -Force
    } catch {
        Write-Host "Error moving $itemName`: $($Error[0].Exception.Message)"
    }
}

# Process paths in package.json
$packageJsonPath = Join-Path -Path $webAppDir -ChildPath "package.json"
if (Test-Path -Path $packageJsonPath) {
    Write-Host "Updating paths in package.json..."
    
    try {
        # Read file content
        $packageJson = Get-Content -Path $packageJsonPath -Raw | ConvertFrom-Json
        
        # Check and update paths in scripts section
        if ($packageJson.PSObject.Properties.Name -contains "scripts") {
            $modified = $false
            $scripts = $packageJson.scripts
            
            foreach ($prop in $scripts.PSObject.Properties) {
                $value = $prop.Value
                
                # Update paths (add ./ prefix if needed)
                if ($value -match "^(node|npm|npx)\s+((?!\./).+)") {
                    $newValue = $value -replace "^(node|npm|npx)\s+((?!\./).+)", '$1 ./$2'
                    if ($newValue -ne $value) {
                        $scripts.($prop.Name) = $newValue
                        $modified = $true
                    }
                }
            }
            
            # If modified, save file
            if ($modified) {
                $packageJson | ConvertTo-Json -Depth 10 | Set-Content -Path $packageJsonPath
                Write-Host "package.json updated"
            } else {
                Write-Host "package.json does not need path updates"
            }
        } else {
            Write-Host "No scripts section found in package.json"
        }
    } catch {
        Write-Host "Error updating package.json`: $($Error[0].Exception.Message)"
    }
}

# Create .gitignore file if it doesn't exist
$rootGitignore = Join-Path -Path $rootDir -ChildPath ".gitignore"
if (-not (Test-Path -Path $rootGitignore)) {
    Write-Host "Creating root .gitignore file..."
    @"
# Flutter/Dart related
.dart_tool/
.flutter-plugins
.flutter-plugins-dependencies
.packages
.pub-cache/
.pub/
build/
*.iml
*.log
.metadata

# Android related
android/app/debug
android/app/profile
android/app/release

# iOS related
ios/Pods/
ios/Flutter/Debug.xcconfig
ios/Flutter/Release.xcconfig
ios/Flutter/App.framework
ios/Flutter/Flutter.framework
ios/Flutter/Generated.xcconfig

# Web related
lib/generated_plugin_registrant.dart

# Other files
.DS_Store
.vscode/
.idea/
"@ | Set-Content -Path $rootGitignore
    Write-Host ".gitignore file created"
}

# Create a new README.md file (backup if exists)
$rootReadme = Join-Path -Path $rootDir -ChildPath "README.md"
if (Test-Path -Path $rootReadme) {
    $backupReadme = Join-Path -Path $rootDir -ChildPath "README.md.bak"
    if (-not (Test-Path -Path $backupReadme)) {
        Write-Host "Backing up existing README.md file..."
        Copy-Item -Path $rootReadme -Destination $backupReadme
    }
    
    # Update README.md
    Write-Host "Updating root README.md file..."
    @"
# Food Traceability System

This project contains both a web application and a mobile application for food traceability.

## Project Structure

- `web-app/` - Contains web application code
- `android/` - Android app code (created by Flutter)
- `ios/` - iOS app code (created by Flutter)
- `lib/` - Flutter/Dart shared code

## Development Guide

### Web Application

```bash
cd web-app
npm install
npm start
```

### Mobile Application

Make sure Flutter SDK is installed, then run:

```bash
flutter pub get
flutter run
```

"@ | Set-Content -Path $rootReadme
    Write-Host "README.md file updated"
}

# Done
Write-Host "Now you can create a new Flutter project in the root directory and can run the web app by using 'cd web-app' and 'npm start'." 