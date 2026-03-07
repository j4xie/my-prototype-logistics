#!/bin/bash
# QI Tab screenshots using direct adb commands
# Run AFTER the QI login Maestro flow has completed and we're on the home screen
# Tab bar pixel coordinates (from uiautomator dump on 1080x2400):
#   首页: center (108, 2322)
#   质检: center (324, 2322)
#   记录: center (540, 2322)
#   分析: center (756, 2322)
#   我的: center (972, 2322)

ADB="/c/Users/Steve/AppData/Local/Android/Sdk/platform-tools/adb.exe"
SSDIR="/c/Users/Steve/my-prototype-logistics/screenshots/by-role/qi"

tap() {
    MSYS_NO_PATHCONV=1 "$ADB" shell input tap "$1" "$2"
    sleep 2
}

screenshot() {
    MSYS_NO_PATHCONV=1 "$ADB" shell screencap /sdcard/screen.png
    MSYS_NO_PATHCONV=1 "$ADB" pull /sdcard/screen.png "$SSDIR/$1.png"
    echo "Saved: $1.png"
}

echo "=== QI Tab Screenshots via ADB ==="

# 2. 质检 tab
echo "Tapping 质检 tab..."
tap 324 2322
screenshot "manual-ss-qi-inspect-list"

# 3. 记录 tab
echo "Tapping 记录 tab..."
tap 540 2322
screenshot "manual-ss-qi-records"

# Scroll for records
MSYS_NO_PATHCONV=1 "$ADB" shell input swipe 540 1500 540 800 600
sleep 2
screenshot "manual-ss-qi-records-scroll"
MSYS_NO_PATHCONV=1 "$ADB" shell input swipe 540 800 540 1500 600
sleep 1

# 4. 分析 tab
echo "Tapping 分析 tab..."
tap 756 2322
screenshot "manual-ss-qi-analysis"

# Scroll
MSYS_NO_PATHCONV=1 "$ADB" shell input swipe 540 1500 540 800 600
sleep 2
screenshot "manual-ss-qi-analysis-scroll"
MSYS_NO_PATHCONV=1 "$ADB" shell input swipe 540 800 540 1500 600
sleep 1

# 5. 我的 tab
echo "Tapping 我的 tab..."
tap 972 2322
screenshot "manual-ss-qi-profile"

# Scroll
MSYS_NO_PATHCONV=1 "$ADB" shell input swipe 540 1500 540 800 500
sleep 2
screenshot "manual-ss-qi-profile-scroll"

echo "=== Done ==="
