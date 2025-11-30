# 重新打包生产APK指南

在修复了环境变量和字体配置后，需要重新打包APK才能生效。

---

## 快速开始（推荐）

### 方法1：一键打包脚本

```bash
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace

# 清理 + 重新生成 + 打包
rm -rf android/app/build && \
rm -rf .expo && \
npx expo prebuild --clean --platform android && \
cd android && \
./gradlew clean && \
./gradlew assembleRelease

# 打包完成后，APK位置：
# android/app/build/outputs/apk/release/app-release.apk
```

### 方法2：分步执行

```bash
# 步骤1：清理缓存
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace
rm -rf android/app/build
rm -rf .expo
npx expo start --clear  # 启动后按 Ctrl+C 停止

# 步骤2：重新生成Android项目
npx expo prebuild --clean --platform android

# 步骤3：打包APK
cd android
./gradlew clean
./gradlew assembleRelease

# 步骤4：查找APK
ls -lh app/build/outputs/apk/release/app-release.apk
```

---

## 验证打包是否成功

### 检查1：APK文件存在

```bash
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace
ls -lh android/app/build/outputs/apk/release/app-release.apk
```

**预期输出**：
```
-rw-r--r--  1 user  staff   45M Nov 27 10:30 app-release.apk
```

### 检查2：版本号正确

```bash
# 查看APK信息
aapt dump badging android/app/build/outputs/apk/release/app-release.apk | grep version
```

**预期输出**：
```
package: name='com.cretas.foodtrace' versionCode='2' versionName='1.0.0'
```

**确认 `versionCode='2'`**（之前是1）

---

## 安装到三星设备

### 方法1：通过ADB安装（推荐）

```bash
# 步骤1：连接设备
adb devices

# 步骤2：卸载旧版本（重要！）
adb uninstall com.cretas.foodtrace

# 步骤3：安装新APK
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace
adb install android/app/build/outputs/apk/release/app-release.apk

# 步骤4：启动应用
adb shell am start -n com.cretas.foodtrace/.MainActivity
```

### 方法2：手动传输安装

```bash
# 步骤1：复制APK到桌面
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace
cp android/app/build/outputs/apk/release/app-release.apk ~/Desktop/CretasFoodTrace-v2-$(date +%Y%m%d).apk

# 步骤2：通过微信、QQ、邮件传输到手机

# 步骤3：在三星设备上
# 1. 卸载旧版本
# 2. 打开APK文件安装
# 3. 允许未知来源（如果需要）
```

---

## 验证修复是否生效

### 测试1：环境变量正确读取

```bash
# 安装并启动应用后，查看日志
adb logcat | grep "API Config"
```

**预期输出**：
```
[API Config] Using API URL from environment: http://139.196.165.140:10010
```

**如果看到**：
```
[API Config] Using default API URL: http://139.196.165.140:10010
```
→ 也是正常的（使用了默认值）

### 测试2：文字正常显示

打开应用，检查：
- ✅ 管理页面能看到中文文字（不只是图标）
- ✅ 首页能看到"今日产量"、"完成批次"等文字
- ✅ "我的"页面能看到用户信息

### 测试3：数据正常加载

- ✅ 首页统计数据不是全0
- ✅ 能看到批次列表
- ✅ 登录后角色显示正常（不是"未知鱼色"）

---

## 常见打包错误

### 错误1：Gradle Build失败

**错误信息**：
```
FAILURE: Build failed with an exception.
```

**解决方法**：
```bash
# 清理Gradle缓存
cd android
./gradlew clean
rm -rf .gradle
rm -rf app/build

# 重新打包
./gradlew assembleRelease
```

### 错误2：找不到NDK

**错误信息**：
```
NDK is not installed
```

**解决方法**：
1. 打开Android Studio
2. Preferences → Appearance & Behavior → System Settings → Android SDK
3. SDK Tools → 勾选 NDK
4. 点击Apply安装

### 错误3：内存不足

**错误信息**：
```
Expiring Daemon because JVM heap space is exhausted
```

**解决方法**：
```bash
# 修改 android/gradle.properties，添加：
org.gradle.jvmargs=-Xmx4096m -XX:MaxPermSize=512m
```

---

## 打包时间估算

| 步骤 | 时间 |
|------|------|
| 清理缓存 | 30秒 |
| 重新生成Android项目 | 2-3分钟 |
| Gradle打包 | 5-10分钟 |
| **总计** | **约10-15分钟** |

---

## 打包优化建议

### 减少APK大小

在 `android/app/build.gradle` 中：

```gradle
android {
  buildTypes {
    release {
      // 启用代码压缩
      minifyEnabled true
      shrinkResources true
      proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
  }

  // 只打包需要的CPU架构
  splits {
    abi {
      enable true
      reset()
      include "armeabi-v7a", "arm64-v8a"  // 排除x86
      universalApk false
    }
  }
}
```

### 加速打包

```bash
# 使用Gradle守护进程
cd android
./gradlew assembleRelease --daemon

# 使用并行编译
./gradlew assembleRelease --parallel
```

---

## 环境变量说明

当前使用的环境变量（`.env.production`）：

```env
REACT_APP_API_URL=http://139.196.165.140:10010
REACT_APP_DEBUG=false
REACT_APP_ENV=production
```

**如果需要打包测试版本**：

```bash
# 使用测试环境配置
npm run android:test

# 或者临时修改 .env.production
REACT_APP_API_URL=http://localhost:10010  # 改为本地测试
```

---

## 下一步

打包完成后：

1. ✅ 按照 `三星设备调试指南.md` 进行测试
2. ✅ 验证所有功能正常
3. ✅ 如果还有问题，查看Logcat日志
4. ✅ 收集反馈，继续优化

---

**最后更新**: 2024-11-27
