# 📱 食品溯源App预览指南

## 🚀 快速启动

### 前置条件
1. 安装 Node.js (18+)
2. 安装 Expo CLI: `npm install -g @expo/cli`
3. 手机安装 Expo Go App

### 启动步骤

```bash
# 1. 进入移动应用目录
cd packages/mobile

# 2. 安装依赖 (使用yarn替代pnpm)
yarn install

# 3. 启动开发服务器
yarn start
# 或者
npx expo start

# 4. 选择预览方式:
# - 扫描二维码在手机Expo Go中预览
# - 按 'a' 启动Android模拟器
# - 按 'i' 启动iOS模拟器 (仅macOS)
# - 按 'w' 在浏览器中预览 (功能有限)
```

## 📱 App功能预览

### 🏠 主界面 (底部Tab导航)
- **仪表盘**: 实时数据、统计概览、快捷操作
- **加工管理**: 批次管理、质量检测、设备监控
- **溯源查询**: 二维码扫描、查询历史、结果展示
- **农业管理**: 农业相关功能框架
- **个人中心**: 用户资料、设置、安全

### 🔐 认证流程
- **登录页面**: 用户名/密码登录
- **注册页面**: 完整注册表单
- **忘记密码**: 密码重置功能

### 🎨 UI组件
- **15个高质量组件**: Button、Card、Modal、Loading等
- **移动端特色**: QR扫描、相机拍照、图表显示
- **Material Design**: 基于React Native Paper

### 📊 数据展示
- **实时统计**: 活跃批次、今日产量、质量评分
- **图表可视化**: 折线图、柱状图
- **列表展示**: 溯源记录、预警信息

## 🛠️ 开发工具

### 调试功能
- **热重载**: 代码修改实时预览
- **React DevTools**: 组件调试
- **网络请求**: API调用监控

### 构建命令
```bash
# 开发构建
yarn build:dev

# 预览构建
yarn build:preview

# 生产构建
yarn build:prod

# 华为版本
yarn build:huawei
```

## 🎯 核心特性

### 🔄 状态管理
- **Zustand**: 轻量级状态管理
- **React Query**: 数据缓存和同步
- **持久化**: AsyncStorage本地存储

### 🌐 网络层
- **API服务**: 统一的API调用层
- **错误处理**: 完善的错误处理机制
- **Mock数据**: 开发环境数据模拟

### 📱 移动端优化
- **响应式布局**: 适配不同屏幕尺寸
- **触摸友好**: 针对移动端优化的交互
- **性能优化**: 懒加载、虚拟列表等

## 🎨 设计系统

### 🎨 主题
- **主色调**: #2196F3 (蓝色)
- **辅助色**: #4caf50 (绿色), #ff9800 (橙色)
- **字体**: 系统默认字体

### 📐 布局
- **卡片设计**: 信息分组展示
- **间距统一**: 8px基础间距系统
- **图标统一**: Material Icons

## 🔧 故障排除

### 常见问题
1. **依赖安装失败**: 尝试删除 node_modules 后重新安装
2. **Expo Go连接失败**: 确保手机和电脑在同一网络
3. **模拟器启动失败**: 检查Android SDK或Xcode配置

### 性能优化
- 启用 Hermes 引擎 (Android)
- 使用 Flipper 调试工具
- 监控内存使用情况

## 📞 支持

如遇问题可参考:
1. [Expo官方文档](https://docs.expo.dev/)
2. [React Native官方文档](https://reactnative.dev/)
3. 项目issue跟踪