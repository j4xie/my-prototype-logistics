# Java 17 快速安装指南

## 🚨 问题诊断

当前系统状态：
- ❌ Java 版本: **Java 8** (需要 Java 17)
- ❌ JAVA_HOME: **未设置**
- ✅ Gradle: 已就绪

## 📥 解决方案 1：自动安装（推荐）

### 使用 Chocolatey 包管理器

```powershell
# 1. 以管理员身份打开 PowerShell

# 2. 检查是否已安装 Chocolatey
choco --version

# 如果未安装，运行：
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# 3. 安装 JDK 17
choco install temurin17 -y

# 4. 刷新环境变量
refreshenv

# 5. 验证安装
java -version
```

## 📥 解决方案 2：手动安装

### 步骤 1: 下载 JDK 17

访问以下任一网站下载：

**选项 A: Eclipse Temurin (推荐)**
- 网址: https://adoptium.net/temurin/releases/
- 选择: `JDK 17 (LTS)`
- 架构: `x64`
- 操作系统: `Windows`
- 包类型: `.msi` 安装器

**选项 B: Oracle JDK**
- 网址: https://www.oracle.com/java/technologies/downloads/#java17
- 下载: `Windows x64 Installer`

### 步骤 2: 安装 JDK

1. 双击下载的安装器
2. 点击 "下一步"
3. **记住安装路径**（通常是 `C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot\`）
4. 完成安装

### 步骤 3: 配置环境变量

#### 方法 A: 使用图形界面

1. 按 `Win + R`，输入 `sysdm.cpl`，回车
2. 点击 "高级" 标签
3. 点击 "环境变量"
4. 在 "系统变量" 区域：
   - 点击 "新建"
   - 变量名: `JAVA_HOME`
   - 变量值: `C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot` (你的实际路径)
   - 点击 "确定"
5. 找到 `Path` 变量，点击 "编辑"
6. 点击 "新建"
7. 添加: `%JAVA_HOME%\bin`
8. 点击 "确定" 保存所有更改
9. **重启所有终端和 IDE**

#### 方法 B: 使用 PowerShell（管理员权限）

```powershell
# 设置 JAVA_HOME（替换为你的实际路径）
[System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot', 'Machine')

# 添加到 PATH
$currentPath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
$newPath = "$currentPath;%JAVA_HOME%\bin"
[System.Environment]::SetEnvironmentVariable('Path', $newPath, 'Machine')
```

### 步骤 4: 验证安装

**重新打开一个新的 PowerShell 窗口**，然后运行：

```powershell
# 检查 Java 版本（应该显示 17.x）
java -version

# 检查 JAVA_HOME
echo $env:JAVA_HOME

# 检查 javac 编译器
javac -version
```

**预期输出：**
```
openjdk version "17.0.x" 2024-xx-xx
OpenJDK Runtime Environment Temurin-17.0.x+x (build 17.0.x+x)
OpenJDK 64-Bit Server VM Temurin-17.0.x+x (build 17.0.x+x, mixed mode, sharing)
```

## 🔄 解决方案 3：临时设置（当前会话）

如果您不想永久更改系统设置，可以临时设置：

```powershell
# 设置当前会话的 JAVA_HOME（替换为你的路径）
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

# 验证
java -version
```

**注意：** 这种方式只在当前 PowerShell 窗口有效，关闭后失效。

## ☁️ 解决方案 4：使用 EAS Build 云端构建（无需本地 Java）

如果不想配置本地环境，可以使用 Expo 的云端构建服务：

```bash
# 1. 安装 EAS CLI
npm install -g eas-cli

# 2. 登录 Expo 账户
eas login

# 3. 配置 EAS Build
cd C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace
eas build:configure

# 4. 构建 APK（云端，无需本地 Java）
eas build --platform android --profile preview
```

优点：
- ✅ 无需配置本地环境
- ✅ 构建速度快
- ✅ 免费账户每月 30 次构建
- ✅ 自动优化和签名

缺点：
- ❌ 需要网络连接
- ❌ 需要等待队列（通常 5-15 分钟）

## 🎯 推荐流程

### 如果您想快速构建（30分钟内）：
→ 使用 **解决方案 4: EAS Build**

### 如果您想长期开发：
→ 使用 **解决方案 2: 手动安装 JDK 17**

### 如果您熟悉包管理器：
→ 使用 **解决方案 1: Chocolatey 自动安装**

## 📋 安装后检查清单

完成 Java 17 安装后，运行以下检查：

```bash
# 切换到项目目录
cd C:\Users\Steve\my-prototype-logistics\frontend\CretasFoodTrace\android

# 清理旧构建
.\gradlew.bat clean

# 检查构建配置
.\gradlew.bat tasks

# 尝试构建（Debug 版本更快）
.\gradlew.bat assembleDebug
```

## 🆘 常见问题

### Q: 设置后仍然找不到 Java？
**A:** 确保：
1. 完全关闭并重新打开所有终端和 IDE
2. `JAVA_HOME` 指向 JDK 目录（不是 JRE）
3. `PATH` 包含 `%JAVA_HOME%\bin`

### Q: 有多个 Java 版本怎么办？
**A:** 只需确保 `JAVA_HOME` 指向 Java 17，其他版本不影响。

### Q: 构建时内存不足？
**A:** 编辑 `android/gradle.properties`：
```properties
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m
```

### Q: 仍然无法构建？
**A:** 运行详细日志查看具体错误：
```bash
.\gradlew.bat assembleRelease --stacktrace --info
```

## 📞 需要帮助？

如果遇到问题，提供以下信息：
1. `java -version` 输出
2. `echo $env:JAVA_HOME` 输出  
3. `.\gradlew.bat assembleRelease --stacktrace` 完整输出

---

**更新时间**: 2025-11-24
**当前 Java 版本**: 1.8.0_471 (需要升级到 17)
**目标**: 构建 CretasFoodTrace Android APK


