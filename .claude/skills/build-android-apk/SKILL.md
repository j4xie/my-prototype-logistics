---
name: build-android-apk
description: 自动化构建 React Native Android APK。包括依赖检查、Debug/Release 构建、设备安装。使用此 Skill 来构建 APK、测试安装、或排查构建问题。
allowed-tools:
  - Bash
  - Read
---

# 构建 APK

## 快速构建

```bash
# Release（增量，2-5分钟）
export JAVA_HOME="/Library/Java/JavaVirtualMachines/jdk-17.0.1.jdk/Contents/Home"
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace/android
./gradlew assembleRelease

# Debug
./gradlew assembleDebug
```

## 输出到根目录

```bash
cp android/app/build/outputs/apk/release/app-release.apk ./CretasFoodTrace.apk
```

## 清理重建

```bash
./gradlew clean && ./gradlew assembleRelease
```
