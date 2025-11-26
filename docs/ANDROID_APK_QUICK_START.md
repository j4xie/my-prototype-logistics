# Android APK 打包快速开始指南

**项目**: 白垩纪食品溯源系统
**版本**: 1.0.0
**更新时间**: 2025-11-25

---

## 📋 前提条件

在开始之前，请确保：

- ✅ 已阅读 [`ANDROID_BUILD_GUIDE.md`](./ANDROID_BUILD_GUIDE.md)
- ✅ 已安装 Android Studio 和 Android SDK
- ✅ 已配置 `ANDROID_HOME` 环境变量
- ✅ 已安装 JDK 17+
- ✅ 已安装 Node.js 18+

---

## 🚀 快速构建（5分钟）

### 方式 1: 使用自动化脚本（推荐）

```bash
# 1. 进入项目根目录
cd /Users/jietaoxie/my-prototype-logistics

# 2. 运行构建脚本（Debug APK + 生产环境）
./scripts/build-android-apk.sh

# 3. 等待构建完成（约 3-5 分钟）
# APK 位置: builds/cretas-foodtrace-debug-latest.apk
```

**完成！** APK 已生成，可以安装测试。

---

### 方式 2: 手动构建（适合高级用户）

```bash
# 1. 进入前端目录
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace

# 2. 安装依赖（首次需要）
npm install

# 3. 准备环境配置
cp .env.production .env

# 4. 生成原生 Android 项目
npx expo prebuild --clean --platform android

# 5. 构建 APK
cd android
./gradlew assembleDebug

# 6. 获取 APK
# 位置: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🎯 不同场景的构建命令

### 场景 1: 开发测试（连接本地后端）

```bash
./scripts/build-android-apk.sh -e .env.local
```

**说明**: 使用 `.env.local` 配置，API 地址为 `http://localhost:10010`

### 场景 2: 测试环境（连接测试服务器）

```bash
./scripts/build-android-apk.sh -e .env.test
```

**说明**: 使用 `.env.test` 配置，连接到测试服务器

### 场景 3: 生产环境（默认）

```bash
./scripts/build-android-apk.sh
# 或
./scripts/build-android-apk.sh -e .env.production
```

**说明**: 使用 `.env.production` 配置，连接到 `http://139.196.165.140:10010`

### 场景 4: 发布版本（Release APK）

```bash
./scripts/build-android-apk.sh -t release
```

**注意**: Release 版本需要签名密钥，请先配置签名（见下文）

### 场景 5: 清理构建

```bash
./scripts/build-android-apk.sh -c
```

**说明**: 删除现有 `android` 目录，重新生成原生项目

### 场景 6: 构建并自动安装

```bash
./scripts/build-android-apk.sh -i
```

**说明**: 构建完成后自动安装到已连接的 Android 设备

---

## 📱 安装 APK 到设备

### 方法 1: 通过 USB 连接

```bash
# 1. 启用手机的 USB 调试
# 设置 → 关于手机 → 连续点击版本号7次 → 开发者选项 → USB调试

# 2. 连接手机到电脑，检查连接
adb devices

# 应该看到类似输出：
# List of devices attached
# ABCD1234    device

# 3. 安装 APK
adb install -r builds/cretas-foodtrace-debug-latest.apk

# 4. 启动应用
adb shell monkey -p com.cretas.foodtrace -c android.intent.category.LAUNCHER 1
```

### 方法 2: 通过文件传输

```bash
# 1. 将 APK 复制到手机
adb push builds/cretas-foodtrace-debug-latest.apk /sdcard/Download/

# 2. 在手机上打开文件管理器，找到 Download 目录
# 3. 点击 APK 文件安装
```

### 方法 3: 通过网络传输

```bash
# 使用微信、QQ、邮件等发送 APK 文件到手机
# 或使用云盘（Google Drive、百度网盘等）
```

---

## 🐛 调试和日志

### 查看应用日志

```bash
# 实时查看日志（过滤 React Native 相关）
adb logcat | grep ReactNative

# 或只看 Cretas 相关日志
adb logcat | grep Cretas

# 保存日志到文件
adb logcat > app-debug.log
```

### 查看崩溃日志

```bash
# 查看最近的崩溃
adb logcat -b crash

# 查看应用特定崩溃
adb logcat -b crash | grep com.cretas.foodtrace
```

### 清除应用数据

```bash
# 清除应用数据和缓存
adb shell pm clear com.cretas.foodtrace

# 重新启动应用
adb shell monkey -p com.cretas.foodtrace -c android.intent.category.LAUNCHER 1
```

---

## 🔐 配置 Release 签名（用于生产发布）

### Step 1: 生成签名密钥

```bash
# 进入前端目录
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace

# 生成密钥库（首次需要）
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore android/cretas-release-key.keystore \
  -alias cretas-key-alias \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# 按照提示输入信息：
# - 密钥库密码: 输入并记住（例如: Cretas@2025）
# - 密钥密码: 输入并记住（可以与密钥库密码相同）
# - 姓名/组织等信息: 根据实际情况填写
```

**重要**: 妥善保管密钥库文件和密码！丢失后无法更新应用！

### Step 2: 配置 Gradle

编辑 `android/gradle.properties`，添加签名配置：

```properties
CRETAS_UPLOAD_STORE_FILE=cretas-release-key.keystore
CRETAS_UPLOAD_KEY_ALIAS=cretas-key-alias
CRETAS_UPLOAD_STORE_PASSWORD=你的密钥库密码
CRETAS_UPLOAD_KEY_PASSWORD=你的密钥密码
```

### Step 3: 修改 `android/app/build.gradle`

在 `android` 块中添加签名配置：

```gradle
android {
    // ... 其他配置

    signingConfigs {
        release {
            if (project.hasProperty('CRETAS_UPLOAD_STORE_FILE')) {
                storeFile file(CRETAS_UPLOAD_STORE_FILE)
                storePassword CRETAS_UPLOAD_STORE_PASSWORD
                keyAlias CRETAS_UPLOAD_KEY_ALIAS
                keyPassword CRETAS_UPLOAD_KEY_PASSWORD
            }
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### Step 4: 构建 Release APK

```bash
# 使用脚本构建
./scripts/build-android-apk.sh -t release

# 或手动构建
cd frontend/CretasFoodTrace/android
./gradlew assembleRelease

# APK 位置：
# android/app/build/outputs/apk/release/app-release.apk
```

---

## 📊 构建输出说明

### 文件位置

```
/Users/jietaoxie/my-prototype-logistics/
├── builds/                                      # 构建输出目录
│   ├── cretas-foodtrace-debug-latest.apk       # 最新 Debug APK（符号链接）
│   ├── cretas-foodtrace-debug-20251125_143022.apk  # 带时间戳的 APK
│   └── cretas-foodtrace-release-latest.apk     # 最新 Release APK
└── frontend/CretasFoodTrace/
    └── android/app/build/outputs/apk/
        ├── debug/
        │   └── app-debug.apk                    # 原始 Debug APK
        └── release/
            └── app-release.apk                  # 原始 Release APK
```

### 文件大小对比

| 类型 | 大小 | 说明 |
|------|------|------|
| Debug APK | 50-80 MB | 包含调试符号，未压缩 |
| Release APK | 30-50 MB | 已优化、混淆、压缩 |

---

## ⚠️ 常见问题排查

### 问题 1: `ANDROID_HOME not set`

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

# 验证
echo $ANDROID_HOME
```

### 问题 2: Gradle 下载失败

**错误信息**:
```
Could not download gradle-8.x-all.zip
```

**解决方法**:

编辑 `android/gradle/wrapper/gradle-wrapper.properties`:
```properties
# 使用腾讯云镜像
distributionUrl=https://mirrors.cloud.tencent.com/gradle/gradle-8.3-all.zip
```

### 问题 3: 内存不足

**错误信息**:
```
java.lang.OutOfMemoryError: Java heap space
```

**解决方法**:

编辑 `android/gradle.properties`:
```properties
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m
```

### 问题 4: 构建卡住不动

**症状**: Gradle 构建过程长时间无输出

**解决方法**:
```bash
# 1. 停止构建（Ctrl+C）

# 2. 清理 Gradle 缓存
cd android
./gradlew clean
rm -rf .gradle

# 3. 重新构建
./gradlew assembleDebug --info  # 显示详细日志
```

### 问题 5: APK 安装后闪退

**排查步骤**:

1. **查看日志**:
   ```bash
   adb logcat | grep -E "AndroidRuntime|ReactNative|Cretas"
   ```

2. **检查 API 连接**:
   ```bash
   # 在手机上测试（连接同一 WiFi）
   curl http://139.196.165.140:10010/api/mobile/health
   ```

3. **确认环境配置**:
   ```bash
   cat frontend/CretasFoodTrace/.env
   ```

4. **重新安装**:
   ```bash
   adb uninstall com.cretas.foodtrace
   adb install -r builds/cretas-foodtrace-debug-latest.apk
   ```

---

## 📝 脚本命令参考

### 完整命令格式

```bash
./scripts/build-android-apk.sh [选项]
```

### 选项说明

| 选项 | 说明 | 示例 |
|------|------|------|
| `-t TYPE` | 构建类型 (debug/release) | `-t release` |
| `-e ENV` | 环境配置文件 | `-e .env.test` |
| `-c` | 清理构建 | `-c` |
| `-i` | 自动安装 | `-i` |
| `-h` | 显示帮助 | `-h` |

### 常用组合

```bash
# Debug + 生产环境（默认）
./scripts/build-android-apk.sh

# Debug + 测试环境
./scripts/build-android-apk.sh -e .env.test

# Release + 生产环境
./scripts/build-android-apk.sh -t release

# 清理构建 + 自动安装
./scripts/build-android-apk.sh -c -i

# Debug + 本地开发
./scripts/build-android-apk.sh -e .env.local -i

# Release + 测试环境
./scripts/build-android-apk.sh -t release -e .env.test
```

---

## 🎓 下一步

构建成功后，您可以：

1. **内部测试**: 将 APK 分发给测试团队
2. **用户测试**: 邀请真实用户测试功能和体验
3. **Google Play 上架**: 准备 Release APK 和应用商店资料
4. **企业分发**: 使用内部分发平台（如蒲公英、Fir.im）

---

## 📚 相关文档

- [完整构建指南](./ANDROID_BUILD_GUIDE.md) - 详细的安装和配置说明
- [项目快速开始](../QUICK_START.md) - 项目整体开发指南
- [前端开发文档](../IMPLEMENTATION_SUMMARY.md) - React Native 开发文档
- [CLAUDE.md](../CLAUDE.md) - AI 辅助开发指南

---

## 💡 技巧和建议

### 1. 首次构建优化

```bash
# 首次构建会下载大量依赖，建议使用镜像
export GRADLE_USER_HOME=~/.gradle
mkdir -p $GRADLE_USER_HOME
cat > $GRADLE_USER_HOME/init.gradle << 'EOF'
allprojects {
    repositories {
        maven { url 'https://maven.aliyun.com/repository/public/' }
        maven { url 'https://maven.aliyun.com/repository/google/' }
    }
}
EOF
```

### 2. 并行构建加速

编辑 `android/gradle.properties`:
```properties
org.gradle.parallel=true
org.gradle.daemon=true
org.gradle.configureondemand=true
```

### 3. 版本管理

每次发布新版本时，更新版本号：

编辑 `app.json`:
```json
{
  "expo": {
    "version": "1.0.1",  // 增加版本号
    "android": {
      "versionCode": 2   // 每次发布递增
    }
  }
}
```

### 4. 自动化测试

```bash
# 安装后自动启动并测试
./scripts/build-android-apk.sh -i

# 在另一个终端查看日志
adb logcat | grep -E "ReactNative|Cretas"
```

---

**最后更新**: 2025-11-25
**维护者**: Claude Code
**问题反馈**: 请查看项目 Issues
