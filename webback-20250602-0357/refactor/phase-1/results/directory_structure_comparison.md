# 目录结构重构比较

## 重构前目录结构
```
web-app/
  ├── assets/
  ├── components/
  │   ├── auth/
  │   ├── data/
  │   ├── documentation/
  │   ├── modules/
  │   │   ├── auth/
  │   │   ├── data/
  │   │   ├── store/
  │   │   ├── trace/
  │   │   ├── ui/
  │   │   ├── utils/
  │   │   ├── web-app/
  │   │   └── index.js
  │   ├── store/
  │   ├── ui/
  │   ├── utils/
  │   ├── validation/
  │   └── 各种分散的JS和HTML文件
  ├── debug-tools/
  ├── src/
  ├── styles/
  └── tests/
```

## 重构后目录结构
```
web-app/
  ├── config/
  │   ├── app/
  │   ├── build/
  │   ├── deploy/
  │   └── test/
  ├── public/
  │   ├── assets/
  │   │   ├── icons/
  │   │   ├── images/
  │   │   └── media/
  │   └── fonts/
  ├── src/
  │   ├── components/
  │   │   ├── common/
  │   │   ├── modules/
  │   │   │   ├── admin/
  │   │   │   ├── farming/
  │   │   │   ├── logistics/
  │   │   │   ├── processing/
  │   │   │   ├── profile/
  │   │   │   └── trace/
  │   │   └── ui/
  │   ├── hooks/
  │   ├── pages/
  │   │   ├── admin/
  │   │   ├── auth/
  │   │   ├── farming/
  │   │   ├── home/
  │   │   ├── logistics/
  │   │   ├── processing/
  │   │   ├── profile/
  │   │   └── trace/
  │   ├── services/
  │   ├── store/
  │   ├── styles/
  │   ├── types/
  │   └── utils/
  │       ├── auth/
  │       ├── common/
  │       ├── network/
  │       └── storage/
  └── tests/
      ├── e2e/
      ├── integration/
      └── unit/
```

## 重构变更说明

1. **规范化目录结构**：
   - 按照功能和类型将组件分类存放
   - 所有源代码集中在src目录下
   - 配置文件集中到config目录
   - 资源文件移到public目录

2. **模块化组织**：
   - 按业务功能将组件分到不同模块目录
   - 按页面类型组织页面代码
   - 分离通用组件和特定模块组件

3. **测试结构优化**：
   - 单元测试、集成测试和端到端测试分开存放
   - 保持与源代码目录结构对应

4. **工具函数分类**：
   - 网络、存储、认证和通用工具分开管理
   - 增强了代码的可维护性和可复用性

5. **配置管理优化**：
   - 按环境和用途分类存放配置
   - 构建、测试、应用和部署配置分开管理 