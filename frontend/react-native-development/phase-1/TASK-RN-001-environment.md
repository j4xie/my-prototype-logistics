# TASK-RN-001: 开发环境配置

> React Native Android开发 - 环境配置任务
>
> 创建时间: 2025-01-25
> 预计工期: 1天 (8小时)
> 优先级: 高
> 状态: 待开始

## 📋 任务概述

配置完整的React Native + Expo Android开发环境，确保所有必需的软件、工具和服务都已正确安装并可以正常工作。

## 🎯 任务目标

- 建立完整的React Native开发环境
- 确保Android开发工具链正常工作
- 验证所有工具的兼容性和稳定性
- 为团队提供标准化的开发环境

## 📋 详细步骤

### **步骤1: Node.js环境配置** (1小时)

#### 1.1 安装Node.js
```bash
# 下载并安装Node.js v18.x或更高版本
# 官网: https://nodejs.org/

# 验证安装
node --version  # 应显示 v18.x.x 或更高
npm --version   # 应显示 v9.x.x 或更高
```

#### 1.2 配置包管理器
```bash
# 安装pnpm (推荐)
npm install -g pnpm

# 验证安装
pnpm --version
```

### **步骤2: React Native CLI工具** (45分钟)

#### 2.1 安装Expo CLI
```bash
# 全局安装Expo CLI
npm install -g @expo/cli

# 验证安装
npx expo --version
```

#### 2.2 安装EAS CLI
```bash
# 全局安装EAS CLI (用于构建和发布)
npm install -g eas-cli

# 验证安装
eas --version
```

#### 2.3 安装认证相关全局工具 (新增)
```bash
# 全局安装React Native调试工具
npm install -g react-native-debugger

# 安装生物识别测试工具 (可选)
npm install -g expo-module-scripts
```

### **步骤3: Android开发环境** (3小时)

#### 3.1 安装Android Studio
1. 下载Android Studio: https://developer.android.com/studio
2. 安装Android Studio
3. 启动Android Studio，完成初始设置

#### 3.2 配置Android SDK
```bash
# 在Android Studio中安装:
# - Android SDK Platform 33 (Android 13)
# - Android SDK Build-Tools 33.0.0
# - Android Emulator
# - Android SDK Platform-Tools
```

#### 3.3 配置环境变量
**Windows:**
```cmd
# 添加到系统环境变量
ANDROID_HOME=C:\Users\[用户名]\AppData\Local\Android\Sdk
ANDROID_SDK_ROOT=%ANDROID_HOME%

# 添加到PATH
%ANDROID_HOME%\tools
%ANDROID_HOME%\tools\bin
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\emulator
```

**macOS/Linux:**
```bash
# 添加到 ~/.bashrc 或 ~/.zshrc
export ANDROID_HOME=$HOME/Android/Sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/tools/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
```

#### 3.4 创建Android虚拟设备
1. 打开Android Studio
2. 点击 "AVD Manager"
3. 创建新的虚拟设备:
   - 设备: Pixel 6
   - 系统镜像: API 33 (Android 13)
   - 配置: 默认设置

### **步骤4: 开发工具配置** (1小时)

#### 4.1 VS Code配置
安装VS Code插件:
- React Native Tools
- ES7+ React/Redux/React-Native snippets
- Prettier - Code formatter
- Auto Rename Tag
- Bracket Pair Colorizer

#### 4.2 Git配置
```bash
# 配置Git (如果尚未配置)
git config --global user.name "你的姓名"
git config --global user.email "你的邮箱"
```

### **步骤5: 账号和服务配置** (1小时)

#### 5.1 Expo账号
```bash
# 注册Expo账号: https://expo.dev/signup
# 登录CLI
npx expo login
```

#### 5.2 Google Play Console (可选)
- 注册Google Play开发者账号 ($25一次性费用)
- 配置开发者资料

### **步骤6: 环境验证** (2小时)

#### 6.1 创建测试项目
```bash
# 创建测试项目
npx create-expo-app test-rn-env --template

# 进入项目
cd test-rn-env

# 安装认证相关依赖进行测试
npx expo install @react-native-async-storage/async-storage
npx expo install expo-secure-store
npx expo install expo-local-authentication

# 启动项目
npx expo start
```

#### 6.2 Android模拟器测试
```bash
# 启动Android模拟器
npx expo start --android

# 验证项目在模拟器中正常运行
```

#### 6.3 认证功能测试 (新增)
```bash
# 测试AsyncStorage功能
npx expo start --web

# 在浏览器开发者工具中测试本地存储
# 验证SecureStore是否可用 (仅真机)
```

#### 6.4 真机测试 (推荐)
```bash
# 通过Expo Go应用测试
npx expo start --tunnel

# 使用手机扫描二维码
# 测试生物识别API (需要真机)
```

## ✅ 验收标准 (更新)

### 必须完成的验证项目
- [ ] Node.js v18+正确安装
- [ ] Expo CLI可以创建新项目
- [ ] Android Studio正确安装和配置
- [ ] Android模拟器可以正常启动
- [ ] 测试项目在模拟器中正常运行
- [ ] VS Code插件正确安装
- [ ] Expo账号已登录
- [ ] **AsyncStorage在测试项目中可用** (新增)
- [ ] **SecureStore模块可以正常导入** (新增)
- [ ] **LocalAuthentication模块可以正常导入** (新增)

### 强烈推荐的验证项目
- [ ] **真机调试正常工作** (提升优先级)
- [ ] **生物识别API在真机上可用** (新增)
- [ ] **网络状态检测正常工作** (新增)

### 可选验证项目
- [ ] Google Play Console账号已注册
- [ ] EAS构建工具可用
- [ ] **React Native Debugger可以连接** (新增)

## 📊 时间分配 (更新)

| 步骤 | 预计时间 | 实际时间 | 备注 |
|------|----------|----------|------|
| Node.js环境 | 1小时 | - | 包括pnpm配置 |
| React Native CLI | 45分钟 | - | Expo和EAS CLI + 认证工具 |
| Android环境 | 3小时 | - | 最耗时的部分 |
| 开发工具 | 1小时 | - | VS Code和Git |
| 账号服务 | 1小时 | - | Expo账号必需 |
| 环境验证 | 2小时 | - | 包含认证功能验证 |
| **总计** | **8.75小时** | **-** | **约一个工作日** |

### 时间分配说明 (新增)
- **认证依赖测试**: 额外30分钟验证认证相关包
- **真机测试**: 强烈建议额外1小时进行真机验证
- **调试工具配置**: 可选额外30分钟配置高级调试工具

## 🚨 常见问题和解决方案

### 问题1: Android SDK下载缓慢
**解决方案**:
- 使用VPN或代理
- 尝试使用镜像源
- 分批下载SDK组件

### 问题2: 模拟器启动失败
**解决方案**:
- 检查BIOS虚拟化设置
- 增加模拟器内存分配
- 尝试不同的系统镜像

### 问题3: Expo CLI安装失败
**解决方案**:
- 清理npm缓存: `npm cache clean --force`
- 使用yarn替代npm
- 检查网络连接

### 问题4: 环境变量配置无效
**解决方案**:
- 重启终端或IDE
- 检查路径是否正确
- 验证权限设置

### 问题5: 认证相关包安装失败 (新增)
**解决方案**:
- 检查Expo版本兼容性
- 使用 `npx expo install` 而不是 `npm install`
- 清理缓存后重新安装: `npx expo r -c`

### 问题6: 生物识别API无法使用 (新增)
**解决方案**:
- 确认设备支持生物识别
- 检查设备设置中是否启用生物识别
- 在真机上测试，模拟器不支持
- 提供密码登录备选方案

### 问题7: SecureStore在Web端报错 (新增)
**解决方案**:
- SecureStore仅在移动端可用
- Web端使用LocalStorage备选方案
- 使用平台检测条件渲染

## 📝 输出文档 (更新)

任务完成后需要提供:

### 1. 环境配置报告
```markdown
# 认证系统开发环境配置报告

## 软件版本信息
- Node.js: v18.x.x
- npm: v9.x.x
- Expo CLI: vx.x.x
- Android Studio: vx.x.x
- Android SDK: API Level 33

## 认证相关依赖验证
- [x] @react-native-async-storage/async-storage: vx.x.x
- [x] expo-secure-store: vx.x.x  
- [x] expo-local-authentication: vx.x.x
- [x] @react-native-community/netinfo: vx.x.x

## 验证结果
- [x] 测试项目创建成功
- [x] Android模拟器运行正常
- [x] 真机调试可用
- [x] 认证相关API可用
- [x] 生物识别功能测试通过 (真机)

## 遇到的问题和解决方案
[记录具体问题和解决过程，特别是认证相关问题]
```

### 2. 认证开发环境指南 (新增)
基于实际配置过程，创建专门的认证系统开发环境配置指南，包括:
- 认证相关依赖的最佳版本组合
- 生物识别测试流程
- 调试工具配置建议

### 3. 团队环境配置指南 (更新)
基于实际配置过程，更新和完善团队使用的配置指南。

## 🔄 下一步行动 (更新)

任务完成后:
1. 通知项目负责人环境配置完成
2. 将环境配置文档分享给团队
3. **验证认证相关依赖在团队环境中的一致性** (新增)
4. 协助其他团队成员配置环境
5. **准备认证系统技术调研资料** (新增)
6. 开始TASK-RN-002项目初始化

## 📞 支持联系

**负责人**: [待分配]
**技术支持**: [项目技术负责人]
**文档位置**: frontend/react-native-development/phase-1/

---

**任务创建时间**: 2025-01-25
**任务更新时间**: 2025-08-05 (新增认证系统支持)
**计划开始时间**: [待确定]
**计划完成时间**: 开始后1个工作日 (约9小时包含认证验证)
