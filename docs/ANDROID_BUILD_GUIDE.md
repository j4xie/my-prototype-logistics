# Android APK 本地打包完整指南

## 📋 目录
1. [环境准备](#环境准备)
2. [Android Studio 安装](#android-studio-安装)
3. [项目配置](#项目配置)
4. [构建 APK](#构建-apk)
5. [常见问题](#常见问题)

---

## 环境准备

### 系统要求
- **操作系统**: macOS 10.14+ / Windows 10+ / Linux
- **磁盘空间**: 至少 10GB 可用空间
- **内存**: 建议 8GB+
- **网络**: 稳定的网络连接（首次下载约 3-5GB）

### 已安装工具检查
在开始前，确保已安装：
```bash
# 检查 Node.js（需要 18+）
node --version

# 检查 npm
npm --version

# 检查 Java（需要 JDK 17）
java -version
```

---

## Android Studio 安装

### Step 1: 下载 Android Studio

**macOS**:
```bash
# 方式1: 官网下载
# 访问: https://developer.android.com/studio
# 下载 Android Studio Koala | 2024.1.1 或更高版本

# 方式2: 使用 Homebrew（推荐）
brew install --cask android-studio
```

**Windows**:
1. 访问 https://developer.android.com/studio
2. 下载 `.exe` 安装程序
3. 双击运行安装程序，按照向导完成安装

**Linux (Ubuntu/Debian)**:
```bash
sudo snap install android-studio --classic
```

### Step 2: 首次启动 Android Studio

1. 打开 Android Studio
2. 选择 **Standard** 安装类型
3. 选择 UI 主题（Light/Dark）
4. 等待下载 SDK 组件（约 2-3GB，需要 10-20 分钟）

### Step 3: 安装 Android SDK

1. 打开 Android Studio
2. 点击 **More Actions** → **SDK Manager**
3. 在 **SDK Platforms** 标签页：
   - ✅ 勾选 **Android 14.0 (API 34)** - 推荐
   - ✅ 勾选 **Android 13.0 (API 33)** - 备用

4. 在 **SDK Tools** 标签页，勾选：
   - ✅ Android SDK Build-Tools 34.0.0
   - ✅ Android Emulator
   - ✅ Android SDK Platform-Tools
   - ✅ Android SDK Command-line Tools
   - ✅ Google Play services

5. 点击 **Apply**，等待下载完成（约 2-3GB）

### Step 4: 配置环境变量

**macOS/Linux**:
```bash
# 编辑 ~/.zshrc 或 ~/.bash_profile
nano ~/.zshrc

# 添加以下内容：
export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
# 或
# export ANDROID_HOME=$HOME/Android/Sdk        # Linux

export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin

# 保存后刷新配置
source ~/.zshrc
```

**Windows**:
1. 右键 **此电脑** → **属性** → **高级系统设置**
2. 点击 **环境变量**
3. 在 **系统变量** 中点击 **新建**：
   - 变量名: `ANDROID_HOME`
   - 变量值: `C:\Users\YourUsername\AppData\Local\Android\Sdk`
4. 编辑 **Path** 变量，添加：
   - `%ANDROID_HOME%\platform-tools`
   - `%ANDROID_HOME%\emulator`
   - `%ANDROID_HOME%\cmdline-tools\latest\bin`

### Step 5: 验证安装

```bash
# 检查 ANDROID_HOME
echo $ANDROID_HOME  # macOS/Linux
echo %ANDROID_HOME%  # Windows

# 检查 Android SDK 工具
adb --version
sdkmanager --version

# 检查 Java（需要 JDK 17）
java -version
```

**预期输出**:
```
ANDROID_HOME=/Users/yourname/Library/Android/sdk
Android Debug Bridge version 1.0.41
...
openjdk version "17.0.x"
```

---

## 项目配置

### Step 1: 安装项目依赖

```bash
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace

# 安装 Node.js 依赖
npm install

# 安装环境变量管理工具
npm install --save-dev react-native-dotenv
```

### Step 2: 配置 Babel

编辑 `babel.config.js`，添加 react-native-dotenv 插件：
```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: '.env',
          safe: false,
          allowUndefined: true,
        },
      ],
    ],
  };
};
```

### Step 3: 生成原生 Android 项目

```bash
# 清理之前的构建（如果有）
rm -rf android ios

# 生成原生项目
npx expo prebuild --clean

# 如果提示选择，按照以下选择：
# - Android package: com.cretas.foodtrace
# - iOS bundle identifier: com.cretas.foodtrace
```

**重要**: 这将在项目根目录生成 `android/` 文件夹

### Step 4: 准备环境配置

```bash
# 复制生产环境配置为 .env
cp .env.production .env

# 验证内容
cat .env
```

应该看到：
```
REACT_APP_API_URL=http://139.196.165.140:10010
REACT_APP_DEBUG=false
REACT_APP_ENV=production
```

---

## 构建 APK

### 方式 1: 使用自动化脚本（推荐）

我已经为您创建了自动化构建脚本：

```bash
# 赋予执行权限
chmod +x scripts/build-android-apk.sh

# 运行构建（Debug 版本 + 生产配置）
./scripts/build-android-apk.sh

# 构建完成后，APK 位置：
# android/app/build/outputs/apk/debug/app-debug.apk
```

### 方式 2: 手动构建

#### 2.1 构建 Debug APK（用于测试）

```bash
cd android

# 清理之前的构建
./gradlew clean

# 构建 Debug APK
./gradlew assembleDebug

# 构建成功后，APK 位置：
# android/app/build/outputs/apk/debug/app-debug.apk
```

#### 2.2 构建 Release APK（用于生产）

**注意**: Release 版本需要签名密钥

```bash
# 1. 生成签名密钥（首次需要）
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore cretas-release-key.keystore \
  -alias cretas-key-alias \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# 2. 配置 gradle.properties
echo "CRETAS_UPLOAD_STORE_FILE=cretas-release-key.keystore" >> android/gradle.properties
echo "CRETAS_UPLOAD_KEY_ALIAS=cretas-key-alias" >> android/gradle.properties
echo "CRETAS_UPLOAD_STORE_PASSWORD=your_store_password" >> android/gradle.properties
echo "CRETAS_UPLOAD_KEY_PASSWORD=your_key_password" >> android/gradle.properties

# 3. 构建 Release APK
cd android
./gradlew assembleRelease

# APK 位置：
# android/app/build/outputs/apk/release/app-release.apk
```

---

## 安装和测试

### 通过 USB 安装到 Android 设备

```bash
# 1. 启用 USB 调试（在手机设置中）
# 设置 → 关于手机 → 连续点击版本号7次 → 开发者选项 → USB调试

# 2. 连接手机到电脑，检查设备
adb devices

# 应该看到类似输出：
# List of devices attached
# ABCD1234    device

# 3. 安装 APK
adb install android/app/build/outputs/apk/debug/app-debug.apk

# 或直接从构建目录安装
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### 通过文件传输安装

1. 将 APK 复制到手机：
   ```bash
   adb push android/app/build/outputs/apk/debug/app-debug.apk /sdcard/Download/
   ```

2. 在手机上打开文件管理器，找到 `app-debug.apk`，点击安装

### 使用模拟器测试

```bash
# 1. 列出可用的模拟器
emulator -list-avds

# 2. 启动模拟器（如果没有，在 Android Studio 中创建）
emulator -avd Pixel_7_API_34 &

# 3. 等待模拟器启动后，安装 APK
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 常见问题

### Q1: `ANDROID_HOME` 未设置错误

**错误信息**:
```
SDK location not found. Define location with an ANDROID_SDK_ROOT environment variable
```

**解决方法**:
```bash
# macOS/Linux
export ANDROID_HOME=$HOME/Library/Android/sdk
echo 'export ANDROID_HOME=$HOME/Library/Android/sdk' >> ~/.zshrc
source ~/.zshrc

# Windows
# 按照上面 Step 4 配置环境变量
```

### Q2: Gradle 构建失败 - 网络问题

**错误信息**:
```
Could not download gradle-8.x-all.zip
```

**解决方法**:
```bash
# 1. 编辑 gradle-wrapper.properties
nano android/gradle/wrapper/gradle-wrapper.properties

# 2. 使用腾讯云镜像
distributionUrl=https://mirrors.cloud.tencent.com/gradle/gradle-8.3-all.zip

# 3. 或使用本地已下载的 Gradle
distributionUrl=file:///path/to/gradle-8.3-all.zip
```

### Q3: `java.lang.OutOfMemoryError`

**解决方法**:
```bash
# 编辑 android/gradle.properties
echo "org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m" >> android/gradle.properties

# 重新构建
cd android && ./gradlew clean assembleDebug
```

### Q4: Metro bundler 端口冲突

**错误信息**:
```
Error: listen EADDRINUSE: address already in use :::8081
```

**解决方法**:
```bash
# 查找占用端口的进程
lsof -i :8081  # macOS/Linux
netstat -ano | findstr :8081  # Windows

# 杀死进程
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows

# 或使用不同端口
npx expo start --port 3010
```

### Q5: APK 安装后闪退

**排查步骤**:
1. 检查日志：
   ```bash
   adb logcat | grep "ReactNative\|Cretas"
   ```

2. 确认 API 地址可访问：
   ```bash
   curl http://139.196.165.140:10010/api/mobile/health
   ```

3. 检查 .env 配置是否正确打包进 APK

---

## 构建输出文件说明

构建成功后，会生成以下文件：

```
android/app/build/outputs/apk/
├── debug/
│   ├── app-debug.apk              # Debug APK（约 50-80MB）
│   └── output-metadata.json       # 构建元数据
└── release/
    ├── app-release.apk            # Release APK（已签名，约 30-50MB）
    ├── app-release-unsigned.apk   # 未签名版本
    └── output-metadata.json
```

**APK 大小说明**:
- Debug APK: 50-80MB（包含调试符号）
- Release APK: 30-50MB（优化和混淆后）

---

## 下一步

构建成功后，您可以：

1. **分发测试**: 将 APK 发送给测试人员
2. **Google Play 上架**: 需要签名的 Release APK
3. **企业分发**: 使用内部应用分发平台

---

## 参考资源

- [Expo 官方文档 - Building Standalone Apps](https://docs.expo.dev/build/setup/)
- [React Native 官方文档 - Publishing to Google Play](https://reactnative.dev/docs/signed-apk-android)
- [Android 开发者文档 - Build your app from the command line](https://developer.android.com/build/building-cmdline)

---

**最后更新**: 2025-11-25
**项目**: 白垩纪食品溯源系统 v1.0.0
