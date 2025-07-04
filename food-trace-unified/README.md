# 🍃 食品溯源系统 - 统一多端解决方案

> 基于 React Native + Expo + Monorepo 的企业级食品安全追溯平台

## 🏗️ 项目架构

本项目采用 Monorepo 架构，支持 Web 端和移动端的统一开发和部署。

```
food-trace-unified/
├── packages/
│   ├── core/           # 🎯 核心业务逻辑 (状态管理、API、类型)
│   ├── ui-shared/      # 🎨 UI组件抽象层
│   ├── web/            # 🌐 Next.js Web应用
│   └── mobile/         # 📱 React Native应用
├── tools/              # 🛠️ 开发工具
└── docs/               # 📚 项目文档
```

## 🚀 快速开始

### 环境要求
- Node.js 18+
- pnpm 8+
- Expo CLI
- 移动端开发环境 (Xcode/Android Studio)

### 安装依赖
```bash
# 安装所有依赖
pnpm install

# 构建核心包
pnpm build:core
```

### 开发模式
```bash
# 启动所有开发服务
pnpm dev

# 或分别启动
pnpm dev:web     # Web端开发 (http://localhost:3000)
pnpm dev:mobile  # 移动端开发 (Expo DevTools)
```

### 构建部署
```bash
# 构建所有平台
pnpm build:all

# 部署Web端
pnpm deploy:web

# 部署移动端
pnpm deploy:mobile:ios      # iOS App Store
pnpm deploy:mobile:android  # Google Play
pnpm deploy:mobile:huawei   # 华为应用市场
```

## 📱 支持平台

- **Web端**: 现代浏览器 (Chrome, Safari, Firefox, Edge)
- **iOS**: iOS 13.0+
- **Android**: API 21+ (Android 5.0+)
- **华为生态**: EMUI 10+ (HMS Core)

## 📊 技术栈

### 共享技术栈
- **语言**: TypeScript 5+
- **状态管理**: Zustand + React Query
- **API**: Axios + MSW (Mock)
- **测试**: Jest + Testing Library

### Web端技术栈
- **框架**: Next.js 15.3.2
- **样式**: TailwindCSS 4
- **UI库**: 自定义组件库

### 移动端技术栈
- **框架**: React Native 0.73 + Expo SDK 50
- **导航**: React Navigation 6
- **UI库**: React Native Paper + NativeWind
- **构建**: EAS Build
- **更新**: EAS Update (OTA)

## 🔄 代码复用策略

通过 Monorepo 架构实现高达 **80%** 的代码复用率：

| 模块类型 | 复用率 | 说明 |
|---------|--------|------|
| 业务逻辑 | 95% | 状态管理、API调用、数据处理 |
| 类型定义 | 100% | 完全共享 TypeScript 类型 |
| 工具函数 | 95% | 格式化、验证、计算逻辑 |
| UI组件 | 70% | 业务逻辑复用，UI层平台适配 |

## 🎯 功能特性

### 核心业务模块
- **🌾 农业管理**: 田地、作物、种植计划、收获记录
- **🏭 加工处理**: 生产批次、质量检测、原料管理
- **🚚 物流管理**: 运输订单、车辆跟踪、仓储管理
- **🔍 产品溯源**: 全链路追踪、二维码验证、证书管理
- **👥 用户管理**: 认证授权、角色权限、组织架构
- **📊 数据分析**: 实时监控、趋势分析、AI洞察

### 移动端特色功能
- **📷 二维码扫描**: 产品追溯、批次查询
- **📍 GPS定位**: 物流跟踪、农场定位
- **📱 推送通知**: 任务提醒、异常告警
- **💾 离线支持**: 核心功能离线可用
- **🔔 实时同步**: WebSocket 数据推送

## 📚 文档

- [开发指南](./docs/development-guide.md)
- [API文档](./docs/api-documentation.md)
- [部署文档](./docs/deployment-guide.md)
- [迁移指南](./docs/migration-guide.md)

## 🤝 贡献

欢迎参与项目开发！请查看 [贡献指南](./CONTRIBUTING.md) 了解详细信息。

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

---

**项目状态**: 🚧 开发中  
**最后更新**: 2025-01-07  
**维护团队**: 食品溯源系统开发团队