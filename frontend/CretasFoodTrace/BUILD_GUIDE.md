# Android APK 本地构建完整指南

## 📋 目录
- [前置要求](#前置要求)
- [快速开始](#快速开始)
- [详细步骤](#详细步骤)
- [常见问题](#常见问题)
- [APK 安装指南](#apk-安装指南)

---

## 🎯 前置要求

### 1. 安装 Node.js (v18+)
- 下载地址: https://nodejs.org/
- 推荐版本: LTS (长期支持版)
- 验证安装: `node --version`

### 2. 安装 Java JDK 17
- 下载地址: https://adoptium.net/temurin/releases/
- 选择: JDK 17 (LTS)
- 验证安装: `java -version`

### 3. 安装 Android Studio
- 下载地址: https://developer.android.com/studio
- 安装完成后，打开 Android Studio
- 进入 Settings → Appearance & Behavior → System Settings → Android SDK
- 安装以下组件：
  - Android SDK Platform 34 (推荐)
  - Android SDK Build-Tools
  - Android SDK Platform-Tools
  - Android SDK Command-line Tools

### 4. 配置环境变量

#### Windows 系统：
```powershell
# 添加到系统环境变量
ANDROID_HOME = C:\Users\你的用户名\AppData\Local\Android\Sdk
JAVA_HOME = C:\Program Files\Eclipse Adoptium\jdk-17.0.x-hotspot

# 添加到 Path
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\tools
%ANDROID_HOME%\tools\bin
%JAVA_HOME%\bin
```

**验证配置：**
```bash
# 打开新的命令提示符窗口
adb --version
java -version
```

---

## 🚀 快速开始

### 方法 1：使用自动构建脚本（推荐）

```bash
# 进入项目目录
cd frontend/CretasFoodTrace

# 运行构建脚本
build-android-apk.bat
```

脚本会自动完成：
1. ✅ 环境检查
2. ✅ 清理旧构建
3. ✅ 安装依赖
4. ✅ 构建 APK
5. ✅ 定位输出文件

### 方法 2：手动构建

```bash
# 1. 进入项目目录
cd frontend/CretasFoodTrace

# 2. 安装依赖（首次）
npm install

# 3. 进入 android 目录
cd android

# 4. 构建 Debug APK
gradlew.bat assembleDebug

# 或构建 Release APK
gradlew.bat assembleRelease

# 5. 返回项目根目录
cd ..
```

---

## 📝 详细步骤

### 步骤 1: 准备项目

```bash
# 确保在正确的目录
cd C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace

# 检查项目结构
dir android
# 应该看到 android 目录及其内容
```

### 步骤 2: 清理缓存（可选，建议首次构建时执行）

```bash
# 清理 Metro bundler 缓存
npm run start -- --clear

# 清理 Android 构建缓存
cd android
gradlew.bat clean
cd ..
```

### 步骤 3: 构建 APK

#### Debug 版本（带调试功能）
```bash
cd android
gradlew.bat assembleDebug
cd ..
```

**输出位置：**
```
frontend/CretasFoodTrace/android/app/build/outputs/apk/debug/app-debug.apk
```

#### Release 版本（优化后的生产版本）
```bash
cd android
gradlew.bat assembleRelease
cd ..
```

**输出位置：**
```
frontend/CretasFoodTrace/android/app/build/outputs/apk/release/app-release.apk
```

### 步骤 4: 验证 APK

```bash
# 查看 APK 信息
cd android
gradlew.bat signingReport
cd ..
```

---

## 🔧 配置说明

### 应用信息（已配置）

- **Package Name**: `com.cretas.foodtrace`
- **App Name**: CretasFoodTrace
- **Version**: 1.0.0 (versionCode: 1)
- **Min SDK**: 23 (Android 6.0)
- **Target SDK**: 34 (Android 14)

### 签名配置

当前使用 **Debug 签名**（开发测试用）：
- Keystore: `android/app/debug.keystore`
- Password: `android`
- Key Alias: `androiddebugkey`

⚠️ **生产环境警告**：
- 生产发布需要生成自己的签名密钥
- 不要使用 debug.keystore 发布到 Google Play

### 生成生产签名（可选）

```bash
# 生成 release keystore
keytool -genkeypair -v -storetype PKCS12 \
  -keystore cretas-release.keystore \
  -alias cretas-key \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass YOUR_STORE_PASSWORD \
  -keypass YOUR_KEY_PASSWORD
```

然后修改 `android/app/build.gradle` 添加 release 签名配置。

---

## ❓ 常见问题

### Q1: 构建失败 - "JAVA_HOME is not set"

**解决方案：**
```bash
# 设置 JAVA_HOME 环境变量
setx JAVA_HOME "C:\Program Files\Eclipse Adoptium\jdk-17.0.x-hotspot"

# 重新打开命令提示符窗口
```

### Q2: 构建失败 - "Android SDK not found"

**解决方案：**
```bash
# 设置 ANDROID_HOME 环境变量
setx ANDROID_HOME "%LOCALAPPDATA%\Android\Sdk"

# 或手动设置到你的 Android SDK 路径
setx ANDROID_HOME "C:\Android\Sdk"

# 重新打开命令提示符窗口
```

### Q3: 构建失败 - "Execution failed for task ':app:mergeDebugAssets'"

**解决方案：**
```bash
# 清理缓存并重新构建
cd android
gradlew.bat clean
gradlew.bat assembleDebug --stacktrace
cd ..
```

### Q4: 构建失败 - "Could not resolve all files for configuration"

**解决方案：**
```bash
# 删除 node_modules 和重新安装
rm -rf node_modules
npm install

# 清理 gradle 缓存
cd android
gradlew.bat clean
cd ..
```

### Q5: APK 安装后闪退

**可能原因：**
1. 后端服务未启动
2. 网络配置错误
3. 权限未授予

**检查步骤：**
```bash
# 查看 Android 日志
adb logcat | findstr CretasFoodTrace
```

### Q6: 构建太慢

**优化方案：**

在 `android/gradle.properties` 中添加：
```properties
# 启用并行构建
org.gradle.parallel=true

# 启用构建缓存
org.gradle.caching=true

# 配置守护进程
org.gradle.daemon=true

# 增加内存（如果你的电脑内存充足）
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m
```

### Q7: 需要不同架构的 APK

**修改 `android/gradle.properties`：**
```properties
# 只构建 ARM64（大多数现代设备）
reactNativeArchitectures=arm64-v8a

# 或只构建 ARM32（兼容性）
reactNativeArchitectures=armeabi-v7a

# 或构建所有架构（默认，文件较大）
reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
```

---

## 📱 APK 安装指南

### 方法 1：通过 USB 安装（ADB）

```bash
# 1. 启用 USB 调试
# 设备: 设置 → 关于手机 → 连续点击版本号 7 次 → 开发者选项 → USB 调试

# 2. 连接设备并安装
adb devices
adb install frontend/CretasFoodTrace/android/app/build/outputs/apk/debug/app-debug.apk
```

### 方法 2：通过文件传输

1. **传输 APK 到手机**
   - 使用 USB 数据线复制
   - 或通过微信/QQ发送文件
   - 或上传到云盘下载

2. **安装 APK**
   - 打开手机文件管理器
   - 找到 APK 文件
   - 点击安装
   - 允许"未知来源"安装（如提示）

### 方法 3：通过二维码（推荐）

```bash
# 1. 将 APK 上传到云存储
# 2. 生成下载链接
# 3. 创建二维码
# 4. 手机扫码下载安装
```

---

## 🎯 构建命令快速参考

```bash
# === 进入项目 ===
cd frontend/CretasFoodTrace

# === 构建命令 ===
# Debug APK（快速，带调试）
cd android && gradlew.bat assembleDebug && cd ..

# Release APK（优化，生产）
cd android && gradlew.bat assembleRelease && cd ..

# 清理构建
cd android && gradlew.bat clean && cd ..

# 查看构建配置
cd android && gradlew.bat signingReport && cd ..

# === 安装到设备 ===
# Debug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# Release
adb install -r android/app/build/outputs/apk/release/app-release.apk

# === 查看日志 ===
adb logcat | findstr CretasFoodTrace
```

---

## 📊 构建时间参考

| 配置 | 首次构建 | 后续构建 |
|------|---------|---------|
| Debug APK | 5-10分钟 | 2-5分钟 |
| Release APK | 8-15分钟 | 3-8分钟 |

*实际时间取决于电脑性能和网络状况*

---

## 🔍 构建产物说明

### Debug APK
- **文件名**: app-debug.apk
- **大小**: ~50-80 MB
- **特点**: 
  - 包含调试符号
  - 可以使用 Chrome DevTools 调试
  - 性能略低于 Release 版本
  - 适合开发测试

### Release APK
- **文件名**: app-release.apk
- **大小**: ~30-50 MB（经过优化）
- **特点**:
  - 代码经过混淆和优化
  - 性能最佳
  - 无法调试
  - 适合生产发布

---

## 📚 相关文档

- [Expo 文档](https://docs.expo.dev/)
- [React Native 文档](https://reactnative.dev/)
- [Android 开发者指南](https://developer.android.com/studio/build/building-cmdline)
- [项目配置文件](./app.json)
- [Gradle 配置](./android/app/build.gradle)

---

## 🆘 获取帮助

如果遇到问题：

1. **查看构建日志**
   ```bash
   cd android
   gradlew.bat assembleDebug --stacktrace --info
   cd ..
   ```

2. **清理并重试**
   ```bash
   # 清理所有缓存
   npm run start -- --clear
   cd android
   gradlew.bat clean
   cd ..
   rm -rf node_modules
   npm install
   ```

3. **检查环境**
   ```bash
   node --version
   java -version
   echo %ANDROID_HOME%
   adb --version
   ```

---

**最后更新**: 2025-11-24
**项目**: CretasFoodTrace 食品溯源系统
**版本**: 1.0.0


