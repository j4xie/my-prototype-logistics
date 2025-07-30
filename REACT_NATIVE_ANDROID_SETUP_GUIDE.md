# React Native + Expo Android开发准备指南

> 海牛食品溯源系统 - Android原生应用开发准备文档
>
> 创建时间: 2025-01-25
> 版本: 1.0.0

## 📋 开发环境准备清单

### 1. **必需软件安装**

#### **Node.js 环境**
- **Node.js**: v18.x 或更高版本
- **npm**: v9.x 或更高版本 (推荐使用 pnpm)
- **检查命令**: `node --version && npm --version`

#### **React Native CLI 工具**
```bash
# 全局安装 Expo CLI
npm install -g @expo/cli

# 全局安装 EAS CLI (用于构建和发布)
npm install -g eas-cli
```

#### **Android 开发环境**
- **Android Studio**: 最新稳定版本
- **Android SDK**: API Level 33+ (Android 13)
- **Android SDK Build-Tools**: 33.0.0+
- **Android Emulator**: 推荐 Pixel 6 API 33

#### **开发工具**
- **VS Code**: 主要IDE
- **VS Code插件**:
  - React Native Tools
  - ES7+ React/Redux/React-Native snippets
  - Prettier - Code formatter
  - Auto Rename Tag

### 2. **账号和服务准备**

#### **Expo账号**
- 注册 Expo 开发者账号: https://expo.dev/signup
- 配置本地CLI: `npx expo login`

#### **Google Play Console**
- Google Play 开发者账号: $25 一次性费用
- 配置应用签名密钥
- 准备应用图标和截图素材

#### **推送通知服务** (可选)
- Firebase Cloud Messaging (FCM)
- 配置 google-services.json

## 🛠️ 项目初始化步骤

### 第一步: 创建项目
```bash
# 在 heiniu 根目录下创建
npx create-expo-app heiniu-mobile --template

# 进入项目目录
cd heiniu-mobile

# 安装核心依赖
npx expo install expo-dev-client
```

### 第二步: 安装必需依赖
```bash
# 导航相关
npm install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs

# UI和交互
npm install react-native-screens react-native-safe-area-context
npm install react-native-gesture-handler react-native-reanimated

# 原生功能
npx expo install expo-camera expo-barcode-scanner
npx expo install expo-location expo-notifications
npx expo install expo-image-picker expo-document-picker

# 状态管理和网络
npm install zustand @tanstack/react-query
npm install axios @react-native-async-storage/async-storage

# UI组件库
npm install @react-native-community/datetimepicker
npm install react-native-modal react-native-toast-message
```

### 第三步: 配置项目结构
```
heiniu-mobile/
├── src/
│   ├── components/          # 组件库
│   │   ├── ui/             # 基础UI组件
│   │   └── business/       # 业务组件
│   ├── screens/            # 页面
│   ├── navigation/         # 导航配置
│   ├── services/          # API服务 (复用web-app-next)
│   ├── types/             # 类型定义 (复用web-app-next)
│   ├── hooks/             # 自定义Hooks
│   ├── utils/             # 工具函数
│   ├── stores/            # 状态管理
│   └── constants/         # 常量配置
├── assets/                # 静态资源
└── app.json              # Expo配置
```

## 📱 关键配置文件

### app.json 配置
```json
{
  "expo": {
    "name": "海牛食品溯源",
    "slug": "heiniu-traceability",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#1890FF"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      },
      "package": "com.heiniu.traceability",
      "versionCode": 1,
      "permissions": [
        "CAMERA",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "WRITE_EXTERNAL_STORAGE",
        "READ_EXTERNAL_STORAGE"
      ]
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-camera",
      "expo-location",
      "expo-notifications"
    ]
  }
}
```

### EAS构建配置 (eas.json)
```json
{
  "cli": {
    "version": ">= 5.9.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "gradleCommand": ":app:assembleDebug"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "aab"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

## 🔧 Cursor Rules 集成指导

### Cursor Rules 在 React Native 项目中的应用

React Native项目需要充分利用现有的Cursor Rules体系，确保开发规范的一致性和代码质量。

#### **1. 现有规则复用**

```bash
# 在 heiniu-mobile 项目中创建 .cursor/rules 目录
mkdir -p heiniu-mobile/.cursor/rules

# 复用核心规则文件
cp .cursor/rules/ui-design-system-auto.mdc heiniu-mobile/.cursor/rules/
cp .cursor/rules/api-integration-agent.mdc heiniu-mobile/.cursor/rules/
cp .cursor/rules/development-management-unified.mdc heiniu-mobile/.cursor/rules/
cp .cursor/rules/test-validation-unified.mdc heiniu-mobile/.cursor/rules/
```

#### **2. React Native 特定规则配置**

创建 `heiniu-mobile/.cursor/rules/react-native-mobile-rules.mdc`:

```mdc
---
description: React Native移动端开发规范 - 开发React Native组件时 - 实现原生功能时 - 遵循移动端UI规范和性能优化
globs: **/*.tsx, **/*.ts, **/*.js
alwaysApply: true
---

# React Native 移动端开发规范

## 使用场景
- 开发React Native组件时
- 实现原生功能集成时
- 移动端UI界面开发时

## 关键规则
- 使用React Native StyleSheet替代CSS
- 实现响应式设计，考虑不同屏幕尺寸
- 使用Expo提供的原生功能API
- 遵循Material Design 3 for Android规范
- 优先使用Animated API实现动画效果
- 合理使用FlatList/SectionList处理长列表
- 实现错误边界和加载状态管理
```

#### **3. 规则适配指导**

| 现有规则 | React Native 适配方式 | 注意事项 |
|----------|----------------------|----------|
| **ui-design-system-auto** | 适配为React Native组件 | Tailwind → StyleSheet |
| **api-integration-agent** | 直接复用API调用逻辑 | fetch → axios适配 |
| **development-management-unified** | 项目管理规范保持一致 | 任务跟踪方式相同 |
| **test-validation-unified** | 适配移动端测试框架 | Jest + React Native Testing Library |

#### **4. 开发工作流程集成**

遵循现有的统一开发管理规则：

- **阶段1-3层**: 应用现有的核心开发原则
- **文档读取**: 按照 `docs-reading-guide-agent` 阅读相关架构文档
- **API开发**: 使用 `api-rules-usage-guide-manual` 指导API集成
- **验证标准**: 采用 `test-validation-unified` 的5层验证标准

## 🔄 代码复用策略

### 从 web-app-next 复用的内容:

#### 1. **类型定义** (100%复用)
```typescript
// src/types/index.ts
export * from '../../web-app-next/src/types';

// 添加移动端特定类型
export interface MobileAppState {
  isOnline: boolean;
  cameraPermission: 'granted' | 'denied' | 'pending';
  locationPermission: 'granted' | 'denied' | 'pending';
}
```

#### 2. **API服务** (80%复用)
- 复用 AuthService、UserService 等
- 适配网络请求层 (fetch → axios)
- 添加离线存储策略

#### 3. **业务逻辑** (70%复用)
- 数据处理函数
- 验证逻辑
- 常量定义

#### 4. **需要重写的部分**
- UI组件 (Web → Native)
- 路由导航 (Next.js → React Navigation)
- 本地存储 (localStorage → AsyncStorage)

## 🎨 UI设计系统适配

### Material Design 3 for Android
- **主色调**: #1890FF (与Web保持一致)
- **卡片设计**: elevation + rounded corners
- **按钮样式**: Material Design规范
- **导航**: Bottom Navigation + Stack Navigation

### 组件库构建优先级:
1. **基础组件**: Button, Card, Input, Text
2. **导航组件**: Header, TabBar, DrawerMenu
3. **业务组件**: ProductCard, ScanResult, TraceTimeline
4. **页面组件**: Login, Dashboard, Scanner, Profile

## 📊 开发流程规划

### **Sprint 1** (第1-2周): 基础架构
- [ ] 项目初始化和环境配置
- [ ] **Cursor Rules 设置**: 复用现有规则，创建移动端特定规则
- [ ] 基础组件库开发 (遵循 `ui-design-system-auto` 规范)
- [ ] 导航系统实现
- [ ] API服务层适配 (遵循 `api-integration-agent` 规范)

### **Sprint 2** (第3-4周): 核心功能
- [ ] 用户认证和权限系统
- [ ] 二维码扫描功能
- [ ] 产品追踪查询
- [ ] 相机拍照上传

### **Sprint 3** (第5-6周): 高级功能
- [ ] 地理定位服务
- [ ] 推送通知
- [ ] 离线功能
- [ ] 性能优化

### **Sprint 4** (第7-8周): 测试和发布
- [ ] 功能测试和修复
- [ ] 性能测试和优化
- [ ] 打包和上架准备
- [ ] Google Play Store 发布

## 🚀 构建和发布流程

### 开发阶段
```bash
# 启动开发服务器
npx expo start

# 在Android模拟器中运行
npx expo start --android

# 在真机上测试
npx expo start --tunnel
```

### 构建阶段
```bash
# 开发构建 (内部测试)
eas build --platform android --profile development

# 预览构建 (APK)
eas build --platform android --profile preview

# 生产构建 (AAB)
eas build --platform android --profile production
```

### 发布阶段
```bash
# 提交到Google Play Store
eas submit --platform android
```

## 📋 质量保证

### 测试策略
- **单元测试**: Jest + React Native Testing Library
- **集成测试**: Detox E2E测试框架
- **性能测试**: Flipper + React DevTools
- **设备测试**: 至少5款不同Android设备

### 性能指标
- **启动时间**: < 3秒
- **页面切换**: < 500ms
- **内存使用**: < 200MB
- **APK大小**: < 50MB

## 📝 检查清单

### 开发准备完成标志:
- [ ] 所有必需软件已安装并可正常运行
- [ ] Android模拟器可以正常启动
- [ ] Expo CLI可以创建并运行项目
- [ ] 能够在真机上调试应用
- [ ] Google Play Console账号已注册

### 项目就绪标志:
- [ ] 项目结构已按规划创建
- [ ] 核心依赖已安装无冲突
- [ ] 基础配置文件已正确设置
- [ ] **Cursor Rules已正确配置**:
  - [ ] 核心规则文件已复用到移动端项目
  - [ ] React Native特定规则已创建
  - [ ] VS Code Cursor可以识别并应用规则
- [ ] 能够成功构建APK文件
- [ ] 基础UI组件库已实现

## 🔗 参考资源

### 官方文档
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Android Developer Guide](https://developer.android.com/guide)

### 社区资源
- [React Navigation](https://reactnavigation.org/)
- [React Native Elements](https://reactnativeelements.com/)
- [NativeBase](https://nativebase.io/)

### 工具和服务
- [Expo Snack](https://snack.expo.dev/) - 在线IDE
- [React Native Debugger](https://github.com/jhen0409/react-native-debugger)
- [Flipper](https://fbflipper.com/) - 调试工具

---

## 📞 下一步行动

1. **立即开始**: 按照"开发环境准备清单"安装必需软件
2. **环境验证**: 确保Android模拟器和Expo CLI正常工作
3. **项目初始化**: 创建heiniu-mobile项目并完成基础配置
4. **Cursor Rules 配置**:
   - 复用现有的核心规则文件到移动端项目
   - 创建React Native特定的开发规范
   - 验证VS Code Cursor可以正确识别规则
5. **团队协作**: 确定开发人员分工和时间规划，确保团队了解Cursor Rules的使用

**预计完成时间**: 6-8周
**建议团队规模**: 1-2个React Native开发者

---

*本文档将随着项目进展持续更新，请定期检查最新版本。*
