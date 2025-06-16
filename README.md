# 食品溯源系统

<!-- updated for: Phase-3技术栈现代化进行中，建立权威来源说明-->

一个基于Web应用的食品溯源系统，用于跟踪农产品从农场到餐桌的整个过程，确保食品安全和透明度。

## 🚀 项目状态
**当前阶段**: Phase-3 技术栈现代化(进行中)
**完成度**: 40%
**权威来源**: `web-app-next/` 目录 (Next.js 14 + TypeScript)

### 技术栈迁移状态
- ✅ **核心组件库**: 已完成迁移到TypeScript (8个组件)
- ✅ **构建系统**: Next.js 14 + Turbopack (构建性能提升96%)
- ✅ **类型系统**: TypeScript 5 (100%类型安全)
- ✅ **可访问性**: WCAG 2.1 AA标准支持
- ✅ **Mock API架构**: 统一Mock服务实现 (TASK-P3-018B: 90%完成)
- 🔄 **业务组件**: 迁移进行中
- 📋 **页面架构**: 等待迁移

**详细进展请查看**: [Phase-3工作计划](refactor/phase-3/PHASE-3-COMPREHENSIVE-PLAN.md)

## 功能特点

- **产品信息录入与管理**：支持批量和单个产品信息的录入和管理
- **二维码生成与扫描**：生成唯一二维码标识每批产品，并支持移动端扫描
- **物流轨迹追踪**：记录和展示产品在供应链中的流转路径
- **产品溯源查询**：面向消费者和企业用户的完整溯源信息查询
- **质量检测报告**：记录和展示产品质量检测结果
- **数据统计与分析**：对溯源数据进行多维度统计和分析
- **农业/养殖数据采集与监控**：支持自动化和手动数据采集
- **数据趋势预测与分析**：基于历史数据进行趋势预测和分析

## 快速开始
### 环境要求
- Node.js (18.x或更高版本)
- npm、yarn或pnpm包管理器

### 安装步骤

1. 克隆仓库:
```bash
git clone https://github.com/yourusername/food-traceability-system.git
cd food-traceability-system
```

2. 安装依赖:
```bash
# 当前推荐：直接进入新应用目录
cd web-app-next
npm install
```

3. 设置环境变量:
```bash
cp env.example .env
# 根据需要编辑.env文件
```

### 运行应用

```bash
# 开发环境
npm run dev

# 生产构建
npm run build
npm run start
```

服务器通常会启动在 http://localhost:3000

## 项目结构

项目采用模块化的目录结构，便于维护和扩展：

⚠️ **重要说明**: 项目正在进行Phase-3技术栈现代化，存在两个应用目录：
- `web-app-next/` - **权威来源** (Next.js 14 + TypeScript)
- `web-app/` - 废弃来源 (React 18 + JavaScript)

**新开发请使用** `web-app-next/` **目录**

```
.
├── web-app-next/             # 🎯 新应用目录(权威来源)
│  ├── src/                  # TypeScript源代码
│  │  ├── components/       # 现代化组件库
│  │  ├── app/              # Next.js App Router
│  │  ├── lib/              # 工具函数库
│  │  ├── store/            # 状态管理(Zustand)
│  │  ├── types/            # TypeScript类型定义
│  │  ├── hooks/            # React Hooks
│  │  └── mocks/            # Mock API服务 (MSW)
│  └── public/               # 静态资源
├── web-app/                  # ⚠️ 旧应用目录(废弃中)
├── docs/                      # 项目文档
│  ├── architecture/          # 架构文档
│  ├── api/                   # API文档
│  ├── components/            # 组件文档
│  └── guides/                # 开发指南
├── scripts/                   # 工具脚本
└── refactor/                  # 重构相关文档
   └── phase-3/               # Phase-3重构任务
```

详细的目录结构说明请查看[目录结构文档](DIRECTORY_STRUCTURE.md)。

## 核心模块

1. **认证 (Auth)**
   - 用户登录与认证
   - 权限管理

2. **核心溯源 (Trace)**
   - 溯源批次管理
   - 溯源查询
   - 溯源详情展示
   - 溯源地图展示
   - 溯源证书管理

3. **物流 (Logistics)**
   - 物流记录创建
   - 车辆监控
   - 物流报告
   - 销售数据分析

4. **加工 (Processing)**
   - 加工质量检测
   - 加工环境监控
   - 加工过程记录
   - 加工报告生成

5. **农业/养殖 (Farming)**
   - 数据采集中心
   - 二维码数据采集
   - 手动数据采集
   - 自动监控数据展示
   - 数据验证
   - 养殖过程记录
   - 疫苗接种记录
   - 溯源批次创建

6. **预测与分析**
   - 数据预测分析
   - 预测模型配置
   - 模型管理
   - 指标详情分析

7. **用户中心/设置**
   - 用户个人信息管理
   - 系统设置
   - 消息通知
   - 帮助中心

8. **管理后台**
   - 管理员仪表盘
   - 用户管理
   - 角色权限管理
   - 产品信息管理
   - 模板管理
   - 数据导入
   - 系统设置
   - 系统日志

## Phase-3 技术栈现代化

当前正在进行的技术栈现代化包括：

### 已完成
- ✅ Next.js 14 + TypeScript项目搭建
- ✅ 核心UI组件库迁移 (8个组件)
- ✅ Mock API统一架构 (MSW + OpenAPI)
- ✅ 构建系统优化 (Turbopack)
- ✅ 开发工具链现代化 (ESLint 9, Prettier, Husky)

### 进行中
- 🔄 业务组件迁移
- 🔄 页面架构现代化
- 🔄 状态管理集成

### 待开始
- 📋 静态页面迁移
- 📋 核心业务页面迁移
- 📋 管理页面迁移

详细进展查看: [Phase-3 Master Status](refactor/phase-3/PHASE-3-MASTER-STATUS.md)

## 文档

详细文档可在`docs`目录找到：

- **架构文档**
  - [系统架构概览](docs/architecture/overview.md)
  - [目录结构说明](DIRECTORY_STRUCTURE.md)
  - [技术栈说明](docs/architecture/technologies.md)
  - [Mock API架构](docs/architecture/mock-api-architecture.md)

- **API文档**
  - [API规范权威文档](docs/api/api-specification.md) - 完整48个接口规范
- [Mock API使用指南](docs/api/mock-api-guide.md) - Mock环境使用指南
- [认证API](docs/api/authentication.md) - 认证与授权
- [AI分析API](docs/api/ai-analytics.md) - AI分析功能接口

- **组件文档**
  - [组件概览](docs/components/overview.md)
  - [通用组件](docs/components/common/index.md)
  - [业务组件](docs/components/modules/index.md)

- **开发指南**
  - [快速开始](docs/guides/getting-started.md)
  - [开发流程](docs/guides/development.md)
  - [测试指南](docs/guides/testing.md)
  - [部署指南](docs/guides/deployment.md)

## 开发工作流

项目使用Git Flow工作流进行开发：

- **main**: 生产环境分支
- **rules-refactor-unified**: Phase-3重构工作分支
- **feature/xxx**: 新功能分支
- **bugfix/xxx**: 错误修复分支
- **release/xxx**: 发布准备分支

贡献代码前，请阅读[开发流程文档](docs/guides/development.md)。

## 测试

项目包含多种测试类型，确保代码质量：

```bash
# 进入新应用目录
cd web-app-next

# 运行所有测试
npm test

# 运行Mock API契约验证
npm test tests/contract-validation.test.ts

# 运行组件测试
npm test tests/unit/components

# 运行Hooks测试
npm test tests/unit/hooks
```

## 部署

### 开发环境
```bash
cd web-app-next
npm run dev
```

### 生产环境
```bash
cd web-app-next
npm run build
npm run start
```

### Vercel部署
项目已配置支持Vercel一键部署，详见[vercel.json](vercel.json)配置。

## 贡献

欢迎贡献代码！请遵循以下步骤：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 支持

如有问题，请通过以下方式获取帮助：

- 提交 [GitHub Issue](https://github.com/yourusername/food-traceability-system/issues)
- 查看[帮助文档](docs/guides/)
- 联系项目维护者
