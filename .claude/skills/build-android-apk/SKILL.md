---
name: build-android-apk
description: 自动化构建 React Native Android APK。包括依赖检查、Debug/Release 构建、设备安装。使用此 Skill 来构建 APK、测试安装、或排查构建问题。
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# Android APK 构建 Skill

自动化构建 Cretas 食品溯源系统的 Android APK。

## 项目信息

- **应用 ID**: `com.cretas.foodtrace`
- **版本**: 1.0.0
- **前端目录**: `frontend/CretasFoodTrace`
- **构建脚本**: `scripts/build-android-apk.sh`

## 快速构建

### 使用现有构建脚本

```bash
cd /Users/jietaoxie/my-prototype-logistics

# Debug APK（推荐用于测试）
./scripts/build-android-apk.sh

# Release APK（用于发布）
./scripts/build-android-apk.sh -t release

# 构建并自动安装到设备
./scripts/build-android-apk.sh -c -i

# 使用测试环境配置
./scripts/build-android-apk.sh -e .env.test
```

## 手动构建步骤

### 1. 检查依赖

```bash
# Node.js (需要 18+)
node --version

# Java JDK (需要 17)
java -version
echo $JAVA_HOME

# Android SDK
echo $ANDROID_HOME
ls $ANDROID_HOME/platform-tools/adb

# Gradle (可选，项目自带)
./gradlew --version
```

### 2. 设置环境变量

```bash
# macOS 环境变量
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home
export ANDROID_HOME=/Users/jietaoxie/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
```

### 3. 安装依赖

```bash
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace

# 安装 npm 依赖
npm install

# 生成 Android 原生项目（如果不存在）
npx expo prebuild --platform android
```

### 4. 构建 APK

```bash
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace/android

# Debug APK
./gradlew assembleDebug --no-daemon

# Release APK
./gradlew assembleRelease --no-daemon

# 清理并重新构建
./gradlew clean assembleDebug --no-daemon
```

### 5. 查找 APK 文件

```bash
# Debug APK 位置
ls -la app/build/outputs/apk/debug/app-debug.apk

# Release APK 位置
ls -la app/build/outputs/apk/release/app-release.apk

# 查看 APK 信息
$ANDROID_HOME/build-tools/*/aapt dump badging app/build/outputs/apk/debug/app-debug.apk | head -5
```

## 安装到设备

### 检查设备连接

```bash
# 列出已连接设备
$ANDROID_HOME/platform-tools/adb devices

# 如果没有设备，启动模拟器
$ANDROID_HOME/emulator/emulator -list-avds
$ANDROID_HOME/emulator/emulator -avd <avd_name> &
```

### 安装 APK

```bash
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace/android

# 安装 Debug APK
$ANDROID_HOME/platform-tools/adb install -r app/build/outputs/apk/debug/app-debug.apk

# 安装 Release APK
$ANDROID_HOME/platform-tools/adb install -r app/build/outputs/apk/release/app-release.apk

# 启动应用
$ANDROID_HOME/platform-tools/adb shell am start -n com.cretas.foodtrace/.MainActivity
```

## 常见问题排查

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| `JAVA_HOME not set` | 未设置 Java 环境 | `export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home` |
| `SDK location not found` | 未设置 Android SDK | `export ANDROID_HOME=~/Library/Android/sdk` |
| `Could not find tools.jar` | Java 版本不匹配 | 使用 JDK 17 |
| `No connected devices` | 没有模拟器/设备 | 启动 Android 模拟器或连接手机 |
| `Build failed` | Gradle 缓存问题 | `./gradlew clean` 或删除 `.gradle` 目录 |
| `Out of memory` | Gradle 内存不足 | 增加 `gradle.properties` 中的 `org.gradle.jvmargs` |

### 清理构建缓存

```bash
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace/android

# 停止 Gradle 守护进程
./gradlew --stop

# 清理构建产物
./gradlew clean

# 删除缓存目录（如果问题持续）
rm -rf ~/.gradle/caches
rm -rf .gradle
rm -rf app/build
```

### 检查构建日志

```bash
# 带详细日志构建
./gradlew assembleDebug --stacktrace --info

# 查看最近的构建日志
cat app/build/outputs/logs/*.log 2>/dev/null || echo "无日志文件"
```

## APK 签名（Release）

### 使用 Debug 签名

Debug APK 自动使用 `debug.keystore`，无需额外配置。

### 配置 Release 签名

1. 生成密钥库：
```bash
keytool -genkeypair -v -storetype PKCS12 -keystore cretas-release.keystore \
  -alias cretas -keyalg RSA -keysize 2048 -validity 10000
```

2. 配置 `android/gradle.properties`：
```properties
MYAPP_RELEASE_STORE_FILE=cretas-release.keystore
MYAPP_RELEASE_KEY_ALIAS=cretas
MYAPP_RELEASE_STORE_PASSWORD=your_password
MYAPP_RELEASE_KEY_PASSWORD=your_password
```

3. 构建签名 APK：
```bash
./gradlew assembleRelease
```

## 项目配置文件

| 文件 | 路径 | 用途 |
|------|------|------|
| Gradle 配置 | `android/app/build.gradle` | 构建配置、版本、依赖 |
| 签名配置 | `android/gradle.properties` | 密钥库配置 |
| 清单文件 | `android/app/src/main/AndroidManifest.xml` | 权限、Activity |
| 构建脚本 | `scripts/build-android-apk.sh` | 自动化构建 |

## 参考

- Expo 文档: https://docs.expo.dev/build/setup/
- React Native 文档: https://reactnative.dev/docs/signed-apk-android
- 项目构建脚本: `scripts/build-android-apk.sh` (382 行)
