# 食品溯源系统 - 目录结构说明

> **文档版本**: v5.0 (2025-07-15)  
> **最后更新**: 项目重构后完整清理与优化  
> **重要变更**: 删除了100+个不必要的文件，优化了目录结构

## 🎯 项目概览

本项目采用前后端分离架构，包含完整的食品溯源系统功能。项目结构已经过全面清理和优化。

### 📁 根目录结构

```
.
├── .claude/                      # Claude AI 配置
├── .cursor/                      # Cursor IDE配置目录
├── .github/                      # GitHub配置
├── .husky/                       # Git hooks配置
├── .vscode/                      # VS Code配置
├── backend/                      # 🔧 后端服务
├── frontend/                     # 🎨 前端应用集合
├── README.md                     # 项目主说明文档
└── .gitignore                    # Git忽略配置
```

## 🔧 后端服务 (backend/)

Node.js + Express + Prisma 架构的后端服务：

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js          # 数据库配置
│   │   └── jwt.js               # JWT认证配置
│   ├── controllers/             # 控制器
│   ├── middleware/              # 中间件
│   ├── models/                  # 数据模型
│   ├── routes/                  # 路由定义
│   ├── services/                # 业务逻辑
│   ├── utils/                   # 工具函数
│   └── index.js                 # 应用入口
├── prisma/
│   └── schema.prisma            # 数据库Schema
└── package.json                 # 后端依赖配置
```

## 🎨 前端应用 (frontend/)

### 📁 前端目录结构

```
frontend/
├── docs/                        # 📚 项目文档中心
├── prototype/                   # 🎨 原型系统
├── scripts/                     # 🛠️ 工具脚本
├── web-app-next/                # 🚀 主要Web应用 (Next.js)
├── DIRECTORY_STRUCTURE.md       # 📋 本文档
├── README.md                    # 前端说明文档
├── package.json                 # 前端项目配置
└── workspace.json               # 工作区配置
```

### 1. 📚 docs/ - 文档中心

完整的项目文档管理中心：

```
docs/
├── api/                         # API文档
│   ├── ai-analytics.md         # AI分析API
│   ├── api-specification.md    # API规范
│   ├── async-api.yaml          # 异步API
│   ├── authentication.md       # 认证API
│   ├── data-models.md          # 数据模型
│   ├── mock-api-guide.md       # Mock API指南
│   ├── openapi.yaml            # OpenAPI规范
│   ├── README.md               # API文档说明
│   └── schema-version-management.md  # Schema版本管理
├── architecture/               # 系统架构
│   ├── adr-001-mock-api-architecture.md  # ADR-001决策
│   ├── backend-architecture-design.md   # 后端架构设计
│   ├── design-principles.md            # 设计原则
│   ├── mock-api-architecture.md        # Mock API架构
│   ├── overview.md                     # 架构概览
│   └── technologies.md                 # 技术栈
├── backup-system-guide.md       # 备份系统指南
├── components/                  # 组件文档
│   ├── common/index.md         # 通用组件
│   ├── modules/index.md        # 模块组件
│   └── overview.md             # 组件概览
├── guides/                      # 开发指南
│   ├── configuration.md        # 配置指南
│   └── getting-started.md      # 快速开始
├── prd/                         # 产品需求
│   └── food-traceability-system-prd.md  # PRD文档
└── processing/                  # 加工模块文档
    ├── templates/               # 模板文件
    │   ├── meat-processing-template.json
    │   └── seafood-processing-template.json
    ├── database-schema.md       # 数据库架构
    ├── erDiagram.mmd           # ER图
    ├── field-definitions.csv   # 字段定义
    ├── README-vscode-guide.md  # VS Code指南
    ├── template-schema.json    # 模板Schema
    └── workflow-config.yaml    # 工作流配置
```

### 2. 🎨 prototype/ - 原型系统

HTML原型和静态资源：

```
prototype/
├── DEPLOY.md                    # 部署说明
├── modern-app/                  # 现代应用原型
│   ├── assets/                 # 资源文件
│   ├── pages/                  # 页面原型
│   │   ├── admin/             # 管理页面
│   │   ├── auth/              # 认证页面
│   │   ├── farming/           # 农业页面
│   │   ├── logistics/         # 物流页面
│   │   ├── processing/        # 加工页面
│   │   ├── profile/           # 用户页面
│   │   └── trace/             # 溯源页面
│   ├── styles/                # 样式文件
│   │   ├── admin-layout.css   # 管理布局
│   │   └── main.css           # 主样式
│   ├── README.md              # 原型说明
│   └── index.html             # 原型入口
└── vercel.json                 # Vercel部署配置
```

### 3. 🛠️ scripts/ - 工具脚本

开发和部署工具脚本：

```
scripts/
├── api-generator/               # API生成工具
│   ├── mock-data/              # Mock数据
│   │   └── farming.js          # 农业数据
│   └── generate-api.js         # API生成脚本
├── deployment/                  # 部署脚本
│   ├── api-switch.sh           # API切换
│   └── README.md               # 部署说明
├── dev/                        # 开发工具
│   └── git/                    # Git工具
│       ├── tools/              # Git工具集
│       │   ├── git-tools.sh    # Git工具脚本
│       │   └── README.md       # 工具说明
│       ├── QUICK-START.md      # 快速开始
│       └── README-gitpush.md   # Git推送说明
├── utils/                      # 通用工具
│   ├── Create-ProjectBackup.ps1 # 项目备份(保留)
│   ├── memory-stress-test.js   # 内存压力测试
│   └── Setup-DailyBackup.ps1  # 每日备份(保留)
├── validation/                 # 验证脚本
│   ├── enhanced-regression-test-main.js  # 增强回归测试
│   ├── functional-verification.js        # 功能验证
│   ├── page-regression-test.js          # 页面回归测试
│   ├── phase3-tasks-comprehensive-test.js # 综合测试
│   ├── preview-system-full-test.js      # 预览系统测试
│   ├── regression-baseline.json         # 回归基线
│   └── test-validation.js               # 测试验证
├── README.md                   # 脚本说明
└── SCRIPT_INVENTORY.md         # 脚本清单
```

### 4. 🚀 web-app-next/ - 主要Web应用

基于Next.js的现代化Web应用：

```
web-app-next/
├── .husky/                     # Git hooks
├── .vscode/                    # VS Code配置
├── public/                     # 静态资源
│   ├── images/                 # 图片资源
│   │   └── avatar-placeholder.svg
│   └── mockServiceWorker.js    # MSW服务工作者
├── src/                        # 源代码
│   ├── app/                    # Next.js App Router
│   │   ├── (admin)/           # 管理员路由组
│   │   ├── (auth)/            # 认证路由组
│   │   ├── (dashboard)/       # 仪表板路由组
│   │   ├── (farming)/         # 农业路由组
│   │   ├── (logistics)/       # 物流路由组
│   │   ├── (processing)/      # 加工路由组
│   │   ├── (trace)/           # 溯源路由组
│   │   ├── admin/             # 管理模块 (16个子页面)
│   │   ├── api/               # API路由
│   │   │   ├── admin/         # 管理API
│   │   │   ├── auth/          # 认证API (9个接口)
│   │   │   ├── products/      # 产品API
│   │   │   ├── proxy/         # 代理API
│   │   │   ├── trace/         # 溯源API
│   │   │   └── users/         # 用户API
│   │   ├── auth/              # 认证页面
│   │   ├── components/        # 组件展示
│   │   ├── crm/               # CRM模块
│   │   ├── demo/              # 演示页面
│   │   ├── farming/           # 农业模块 (17个页面)
│   │   ├── finance/           # 财务模块
│   │   ├── help-center/       # 帮助中心
│   │   ├── inventory/         # 库存管理
│   │   ├── logistics/         # 物流模块 (4个页面)
│   │   ├── platform/          # 平台管理
│   │   ├── preview/           # 预览系统
│   │   ├── processing/        # 加工模块 (11个页面)
│   │   ├── procurement/       # 采购模块
│   │   ├── profile/           # 用户资料 (8个页面)
│   │   ├── quality/           # 质量管理
│   │   ├── sales/             # 销售模块 (3个页面)
│   │   ├── settings/          # 系统设置
│   │   ├── globals.css        # 全局样式
│   │   ├── layout.tsx         # 根布局
│   │   └── page.tsx           # 首页
│   ├── components/            # React组件
│   │   ├── admin/             # 管理组件
│   │   ├── collaboration/     # 协作组件
│   │   ├── dev/               # 开发组件
│   │   ├── layout/            # 布局组件
│   │   ├── providers/         # 提供者组件
│   │   ├── test/              # 测试组件
│   │   ├── ui/                # UI组件库 (20+组件)
│   │   └── ai-global-monitor.tsx  # AI全局监控
│   ├── config/                # 配置文件
│   │   ├── api-endpoints.ts   # API端点
│   │   ├── app.ts             # 应用配置
│   │   ├── constants.ts       # 常量
│   │   └── index.ts           # 配置入口
│   ├── hooks/                 # React Hooks
│   │   ├── api/               # API Hooks
│   │   ├── index.ts           # Hooks入口
│   │   ├── useAiDataFetch.ts  # AI数据Hook
│   │   ├── useAiState.ts      # AI状态Hook
│   │   ├── useApi-simple.ts   # 简化API Hook
│   │   ├── useMockAuth.ts     # Mock认证Hook
│   │   └── useMockStatus.ts   # Mock状态Hook
│   ├── lib/                   # 工具库
│   │   ├── api/               # API工具
│   │   │   └── platform.ts    # 平台API
│   │   ├── ai-batch-controller.ts  # AI批处理
│   │   ├── ai-cache-manager.ts     # AI缓存
│   │   ├── ai-error-handler.ts     # AI错误处理
│   │   ├── ai-service.ts           # AI服务
│   │   ├── api-client.ts           # API客户端
│   │   ├── api-config.ts           # API配置
│   │   ├── api.ts                  # API工具
│   │   ├── constants.ts            # 常量
│   │   ├── logger.ts               # 日志
│   │   ├── queryClient.ts          # 查询客户端
│   │   ├── storage-adapter.ts      # 存储适配器
│   │   ├── utils.ts                # 工具函数
│   │   └── websocket.ts            # WebSocket
│   ├── mocks/                 # Mock数据和MSW
│   │   ├── config/            # Mock配置
│   │   │   ├── environments.ts # 环境配置
│   │   │   └── middleware.ts   # 中间件
│   │   ├── data/              # Mock数据
│   │   │   ├── migrations/     # 数据迁移
│   │   │   ├── schemas/        # 数据Schema
│   │   │   ├── admin-data.ts   # 管理数据
│   │   │   ├── auth-data.ts    # 认证数据
│   │   │   ├── farming-data.ts # 农业数据
│   │   │   ├── logistics-data.ts # 物流数据
│   │   │   ├── platform-data.ts  # 平台数据
│   │   │   ├── processing-data.ts # 加工数据
│   │   │   ├── users-data.ts   # 用户数据
│   │   │   └── version-manager.ts # 版本管理
│   │   ├── handlers/          # MSW处理器
│   │   │   ├── admin.ts        # 管理处理器
│   │   │   ├── auth.ts         # 认证处理器
│   │   │   ├── farming.ts      # 农业处理器
│   │   │   ├── index.ts        # 处理器入口
│   │   │   ├── logistics.ts    # 物流处理器
│   │   │   ├── platform.ts     # 平台处理器
│   │   │   ├── processing.ts   # 加工处理器
│   │   │   ├── products.ts     # 产品处理器
│   │   │   ├── sales.ts        # 销售处理器
│   │   │   ├── trace.ts        # 溯源处理器
│   │   │   └── users.ts        # 用户处理器
│   │   ├── browser.ts          # 浏览器Mock
│   │   ├── node-server.ts      # Node服务器Mock
│   │   ├── setup-version-management.ts # 版本管理设置
│   │   ├── setup.ts            # Mock设置
│   │   └── test-setup.ts       # 测试设置
│   ├── services/              # 服务层
│   │   ├── api-service-factory.ts # API服务工厂
│   │   ├── auth.service.ts        # 认证服务
│   │   └── index.ts               # 服务入口
│   ├── store/                 # 状态管理
│   │   ├── appStore.ts         # 应用状态
│   │   ├── auth.ts             # 认证状态
│   │   ├── authStore.ts        # 认证存储
│   │   ├── dashboardStore.ts   # 仪表板状态
│   │   ├── traceStore.ts       # 溯源状态
│   │   └── userStore.ts        # 用户状态
│   ├── styles/                # 样式文件
│   │   ├── globals/           # 全局样式
│   │   │   ├── reset.css       # 重置样式
│   │   │   └── variables.css   # 变量样式
│   │   ├── utilities/         # 工具样式
│   │   │   └── animations.css  # 动画样式
│   │   └── advanced-optimizations.css # 高级优化样式
│   ├── types/                 # TypeScript类型
│   │   ├── api/               # API类型
│   │   │   ├── shared/        # 共享类型
│   │   │   │   └── base.ts     # 基础类型
│   │   │   ├── admin.ts        # 管理类型
│   │   │   ├── farming.ts      # 农业类型
│   │   │   ├── index.ts        # 类型入口
│   │   │   ├── logistics.ts    # 物流类型
│   │   │   └── processing.ts   # 加工类型
│   │   ├── api-response.ts     # API响应类型
│   │   ├── auth.ts             # 认证类型
│   │   ├── index.ts            # 类型入口
│   │   └── state.ts            # 状态类型
│   └── utils/                 # 工具函数
│       └── index.ts           # 工具入口
├── scripts/                   # 应用脚本
│   ├── dev/                   # 开发脚本
│   │   ├── data-migration-scanner.ts # 数据迁移扫描
│   │   ├── environment-adapter.ts    # 环境适配
│   │   ├── fix-migrated-routes.ts    # 路由修复
│   │   ├── migrate-api-routes.ts     # API路由迁移
│   │   └── mock-dev-tools.ts         # Mock开发工具
│   ├── advanced-ui-optimization.js  # 高级UI优化
│   ├── test-mock-api.js             # Mock API测试
│   ├── test-version-management.ts   # 版本管理测试
│   └── ui-compliance-check.js       # UI合规检查
├── tests/                     # 测试文件
│   ├── types/                 # 测试类型
│   │   └── mock-types.d.ts     # Mock类型定义
│   ├── unit/                  # 单元测试
│   │   ├── components/        # 组件测试
│   │   │   └── button.test.tsx # 按钮测试
│   │   ├── hooks/             # Hook测试
│   │   ├── lib/               # 库测试
│   │   └── services/          # 服务测试
│   ├── utils/                 # 测试工具
│   │   └── expectResponse.ts   # 响应期望
│   ├── contract-validation.test.ts   # 合约验证测试
│   ├── msw-comprehensive.test.ts     # MSW综合测试
│   ├── msw-functional.test.ts        # MSW功能测试
│   └── setup.ts                      # 测试设置
├── .prettierrc                # Prettier配置
├── env.example                # 环境变量示例
├── eslint.config.mjs          # ESLint配置
├── jest.config.js             # Jest配置
├── middleware.ts              # Next.js中间件
├── next-env.d.ts              # Next.js类型定义
├── next.config.ts             # Next.js配置
├── package.json               # 项目配置
├── postcss.config.mjs         # PostCSS配置
├── README.md                  # 项目说明
├── tailwind.config.ts         # Tailwind配置
├── tsconfig.json              # TypeScript配置
└── vercel.json                # Vercel部署配置
```

## 🔍 重要特性

### 已清理的内容
- ✅ 删除了所有PowerShell脚本 (Linux环境不兼容)
- ✅ 删除了所有验证报告和临时文件
- ✅ 删除了重复的目录结构
- ✅ 删除了中文文件名 (避免编码问题)
- ✅ 删除了空目录和过时文档
- ✅ 删除了开发工件和测试临时文件

### 保留的核心功能
- ✅ 完整的Next.js应用架构
- ✅ 完整的API路由系统
- ✅ 完整的Mock数据系统
- ✅ 完整的组件库
- ✅ 完整的状态管理
- ✅ 完整的测试框架
- ✅ 完整的文档系统

## 📋 使用指南

### 开发环境启动
```bash
# 后端
cd backend && npm install && npm start

# 前端
cd frontend/web-app-next && npm install && npm run dev
```

### 部署方式
- **前端**: Vercel部署 (配置文件已准备)
- **后端**: 支持多种部署方式
- **原型**: 独立静态部署

### 主要技术栈
- **后端**: Node.js + Express + Prisma + PostgreSQL
- **前端**: Next.js + React + TypeScript + Tailwind CSS
- **测试**: Jest + MSW + React Testing Library
- **开发**: ESLint + Prettier + Husky

---

**维护信息**：
- **版本**: v5.0
- **清理日期**: 2025-07-15
- **清理内容**: 删除100+个不必要文件
- **项目状态**: 生产就绪
- **维护责任**: 开发团队