# React Native 环境配置检查清单

> 快速验证React Native + Expo开发环境是否正确配置
>
> 创建时间: 2025-01-25
> 版本: 1.0.0

## ✅ 必需软件检查

### Node.js 环境
- [ ] Node.js v18.x 或更高版本已安装
- [ ] npm v9.x 或更高版本已安装
- [ ] pnpm 已安装 (可选但推荐)

**验证命令**:
```bash
node --version    # 应显示 v18.x.x 或更高
npm --version     # 应显示 v9.x.x 或更高
pnpm --version    # 如果安装了pnpm
```

### React Native 工具链
- [ ] Expo CLI 已全局安装
- [ ] EAS CLI 已全局安装 (用于构建)

**验证命令**:
```bash
npx expo --version    # 应显示版本号
eas --version         # 应显示版本号
```

### Android 开发环境
- [ ] Android Studio 已安装
- [ ] Android SDK Platform 33+ 已安装
- [ ] Android SDK Build-Tools 33.0.0+ 已安装
- [ ] Android Emulator 已安装
- [ ] Android SDK Platform-Tools 已安装

**验证命令**:
```bash
adb --version         # 应显示版本信息
emulator -list-avds   # 应显示可用的虚拟设备
```

### 环境变量配置
- [ ] ANDROID_HOME 已设置
- [ ] ANDROID_SDK_ROOT 已设置
- [ ] PATH 包含 Android SDK 工具路径

**验证方法**:
```bash
echo $ANDROID_HOME        # (macOS/Linux)
echo %ANDROID_HOME%       # (Windows)
echo $PATH | grep android # (macOS/Linux)
```

## ✅ 开发工具检查

### VS Code 配置
- [ ] VS Code 已安装
- [ ] React Native Tools 插件已安装
- [ ] ES7+ React/Redux/React-Native snippets 插件已安装
- [ ] Prettier - Code formatter 插件已安装
- [ ] Auto Rename Tag 插件已安装

### Git 配置
- [ ] Git 已安装并配置
- [ ] 用户名和邮箱已设置

**验证命令**:
```bash
git --version
git config --global user.name
git config --global user.email
```

## ✅ 账号和服务检查

### Expo 账号
- [ ] Expo 开发者账号已注册
- [ ] 本地 CLI 已登录

**验证命令**:
```bash
npx expo whoami    # 应显示你的用户名
```

### Google Play Console (可选)
- [ ] Google Play 开发者账号已注册 ($25费用)
- [ ] 开发者资料已完善

## ✅ 功能验证测试

### 创建测试项目
```bash
# 创建新的Expo项目
npx create-expo-app rn-env-test --template

# 进入项目目录
cd rn-env-test

# 启动开发服务器
npx expo start
```

### Android 模拟器测试
- [ ] 可以启动 Android 模拟器
- [ ] 测试项目在模拟器中正常运行
- [ ] 热重载功能正常工作

**验证步骤**:
```bash
# 在模拟器中运行
npx expo start --android

# 验证应用正常启动
# 修改 App.js 文件，验证热重载
```

### 真机测试 (可选)
- [ ] Expo Go 应用已安装在手机上
- [ ] 可以通过扫码在真机上运行
- [ ] 真机上应用运行正常

**验证步骤**:
```bash
# 启动tunnel模式
npx expo start --tunnel

# 使用手机Expo Go扫描二维码
```

## ✅ 网络和代理检查

### 网络连接
- [ ] 可以正常访问 npm registry
- [ ] 可以正常访问 Expo services
- [ ] 可以正常下载 Android SDK 组件

**验证命令**:
```bash
npm ping                    # 测试npm连接
npx expo doctor            # 检查Expo配置
```

### 代理配置 (如需要)
- [ ] npm 代理已正确配置
- [ ] Android SDK Manager 代理已配置
- [ ] Git 代理已配置 (如需要)

## ✅ 性能和存储检查

### 系统要求
- [ ] 可用内存 > 8GB (推荐)
- [ ] 可用磁盘空间 > 20GB
- [ ] CPU 支持虚拟化 (Android 模拟器需要)

### Android 模拟器性能
- [ ] 模拟器启动时间 < 2分钟
- [ ] 模拟器运行流畅
- [ ] 模拟器内存分配合理

## 🚨 常见问题诊断

### Android 模拟器问题
**症状**: 模拟器启动失败或运行缓慢
**检查项目**:
- [ ] BIOS 中虚拟化技术已启用
- [ ] Hyper-V 已禁用 (Windows)
- [ ] 模拟器内存分配 > 2GB
- [ ] 硬件加速已启用

### 网络连接问题
**症状**: 无法下载依赖或连接服务
**检查项目**:
- [ ] 防火墙设置
- [ ] 代理配置
- [ ] DNS 解析
- [ ] VPN 连接

### 权限问题
**症状**: 命令执行失败或权限拒绝
**检查项目**:
- [ ] 管理员权限 (Windows)
- [ ] sudo 权限 (macOS/Linux)
- [ ] 文件夹读写权限
- [ ] Android SDK 路径权限

## 📊 验证报告模板

```markdown
# React Native 环境验证报告

**验证时间**: [填写日期]
**验证人员**: [填写姓名]
**操作系统**: [Windows/macOS/Linux]

## 软件版本
- Node.js: [版本号]
- npm: [版本号]
- Expo CLI: [版本号]
- Android Studio: [版本号]
- Android SDK: [API Level]

## 验证结果
- [x] 基础环境配置完成
- [x] 测试项目创建成功
- [x] Android 模拟器运行正常
- [ ] 真机调试可用 (可选)

## 遇到的问题
[记录配置过程中遇到的问题和解决方案]

## 备注
[其他需要说明的内容]
```

## 📞 获取帮助

### 官方文档
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/docs/environment-setup)
- [Android Developer Guide](https://developer.android.com/studio/install)

### 社区支持
- [Expo Discord](https://discord.gg/expo)
- [React Native Community](https://reactnative.dev/community/overview)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/react-native)

---

**提示**: 完成此检查清单后，你的开发环境就已经为 React Native 开发做好准备了！
