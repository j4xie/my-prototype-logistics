# 食品溯源系统目录结构说明

<!-- updated for: 项目重构阶段一 - 文档统一与更新 -->

## 1. 目录结构概述

食品溯源系统重构后采用了更加清晰和模块化的目录结构，遵循现代前端项目的组织原则，将相关文件按功能和类型组织在一起，提高了代码的可维护性和可扩展性。

## 2. 根目录结构

```
.
├── web-app/                   # Web应用主目录
├── docs/                      # 项目文档
│   ├── architecture/          # 架构文档
│   ├── api/                   # API文档
│   ├── components/            # 组件文档
│   └── guides/                # 开发指南
├── scripts/                   # 工具脚本目录
│   ├── dev/                   # 开发相关脚本
│   ├── build/                 # 构建相关脚本
│   └── deploy/                # 部署相关脚本
├── refactor/                  # 重构相关文档和脚本
│   ├── docs/                  # 重构文档
│   ├── phase-1/               # 阶段一：结构清理与统一
│   └── phase-2/               # 阶段二：代码优化与模块化
├── .github/                   # GitHub配置
├── .husky/                    # Git钩子配置
├── .vscode/                   # VS Code配置
├── package.json               # 项目依赖配置
├── README.md                  # 项目说明文档
└── ...                        # 其他配置文件
```

## 3. web-app目录结构

```
web-app/
├── src/                       # 源代码目录
│   ├── components/            # 组件目录
│   │   ├── common/            # 通用组件
│   │   ├── modules/           # 业务模块组件
│   │   │   ├── trace/         # 溯源相关组件
│   │   │   ├── farming/       # 农业/养殖相关组件
│   │   │   ├── processing/    # 加工相关组件
│   │   │   ├── logistics/     # 物流相关组件
│   │   │   └── admin/         # 管理后台组件
│   │   └── ui/                # UI基础组件
│   ├── pages/                 # 页面组件
│   │   ├── auth/              # 认证相关页面
│   │   ├── trace/             # 溯源相关页面
│   │   ├── farming/           # 农业/养殖相关页面
│   │   ├── processing/        # 加工相关页面
│   │   ├── logistics/         # 物流相关页面
│   │   ├── admin/             # 管理后台页面
│   │   └── error/             # 错误页面
│   ├── hooks/                 # 自定义Hooks
│   ├── utils/                 # 工具函数
│   │   ├── network/           # 网络相关工具
│   │   ├── storage/           # 存储相关工具
│   │   ├── auth/              # 认证相关工具
│   │   └── common/            # 通用工具
│   ├── services/              # API服务
│   │   ├── trace/             # 溯源相关API
│   │   ├── farming/           # 农业/养殖相关API
│   │   ├── processing/        # 加工相关API
│   │   ├── logistics/         # 物流相关API
│   │   └── auth/              # 认证相关API
│   ├── store/                 # 状态管理
│   ├── styles/                # 全局样式
│   │   ├── themes/            # 主题样式
│   │   ├── components/        # 组件样式
│   │   ├── pages/             # 页面样式
│   │   └── globals/           # 全局样式
│   └── types/                 # 类型定义
├── public/                    # 静态资源
│   ├── assets/                # 图片、图标等
│   │   ├── images/            # 图片资源
│   │   ├── icons/             # 图标资源
│   │   └── logos/             # Logo资源
│   └── fonts/                 # 字体文件
├── tests/                     # 测试文件
│   ├── unit/                  # 单元测试
│   ├── integration/           # 集成测试
│   └── e2e/                   # 端到端测试
├── config/                    # 配置文件
│   ├── app/                   # 应用配置
│   ├── build/                 # 构建配置
│   ├── test/                  # 测试配置
│   └── deploy/                # 部署配置
├── scripts/                   # 脚本文件
│   ├── dev/                   # 开发脚本
│   ├── build/                 # 构建脚本
│   └── release/               # 发布脚本
└── ...                        # 其他配置文件
```

## 4. 目录用途说明

### 4.1 根目录文件

| 文件/目录 | 用途 |
|----------|------|
| web-app/ | 包含Web应用的所有代码和资源 |
| docs/ | 包含项目文档 |
| scripts/ | 包含项目相关的工具脚本 |
| refactor/ | 包含重构相关的文档和脚本 |
| .github/ | 包含GitHub相关配置，如GitHub Actions工作流程 |
| .husky/ | 包含Git钩子配置，用于提交前代码检查 |
| .vscode/ | 包含VS Code编辑器配置 |
| package.json | 项目依赖配置和脚本定义 |
| README.md | 项目说明文档 |

### 4.2 web-app目录说明

#### 4.2.1 src目录

| 目录 | 用途 |
|-----|------|
| components/ | 包含所有React组件，按功能模块组织 |
| pages/ | 包含应用的页面组件 |
| hooks/ | 包含自定义React Hooks |
| utils/ | 包含通用工具函数 |
| services/ | 包含API服务，处理与后端的交互 |
| store/ | 包含状态管理相关代码 |
| styles/ | 包含全局样式和主题 |
| types/ | 包含TypeScript类型定义 |

#### 4.2.2 public目录

| 目录 | 用途 |
|-----|------|
| assets/ | 包含静态资源，如图片、图标等 |
| fonts/ | 包含字体文件 |

#### 4.2.3 tests目录

| 目录 | 用途 |
|-----|------|
| unit/ | 包含单元测试 |
| integration/ | 包含集成测试 |
| e2e/ | 包含端到端测试 |

#### 4.2.4 config目录

| 目录 | 用途 |
|-----|------|
| app/ | 包含应用的配置，如API端点、特性开关等 |
| build/ | 包含构建配置，如webpack配置 |
| test/ | 包含测试配置，如Jest配置 |
| deploy/ | 包含部署配置，如环境特定的配置 |

#### 4.2.5 scripts目录

| 目录 | 用途 |
|-----|------|
| dev/ | 包含开发相关脚本，如启动开发服务器 |
| build/ | 包含构建相关脚本，如优化构建 |
| release/ | 包含发布相关脚本，如版本管理 |

## 5. 组织原则

### 5.1 模块化原则

系统按功能模块组织代码，主要模块包括：

1. **认证模块**：处理用户认证和权限管理
2. **溯源模块**：处理核心溯源功能
3. **农业/养殖模块**：处理农业和养殖相关功能
4. **加工模块**：处理加工相关功能
5. **物流模块**：处理物流相关功能
6. **管理模块**：处理管理后台功能

每个模块包含自己的组件、服务和工具，以实现模块内聚合，模块间松耦合。

### 5.2 文件命名规范

1. **组件文件**：使用PascalCase（如`TraceList.jsx`、`FarmingCard.tsx`）
2. **工具函数文件**：使用camelCase（如`apiService.js`、`dateUtils.ts`）
3. **样式文件**：与组件同名，使用CSS模块或Styled Components（如`TraceList.module.css`）
4. **测试文件**：与被测试文件同名，添加.test或.spec后缀（如`TraceList.test.js`）
5. **类型定义文件**：使用.d.ts后缀（如`trace.d.ts`）

### 5.3 导入与导出规范

1. **使用索引文件**：每个目录使用index.js或index.ts导出该目录的公共API
2. **使用绝对导入路径**：使用基于src的绝对路径，避免深层嵌套的相对路径
3. **按类型分组导入**：将导入按类型分组（如React、组件、工具等）

## 6. 与旧结构的对比

重构后的目录结构与旧结构相比，主要有以下改进：

1. **清晰的层次结构**：明确区分了组件、页面、服务和工具
2. **模块化组织**：按功能模块组织代码，提高了可维护性
3. **统一的命名规范**：采用一致的命名规范，提高了可读性
4. **测试文件集中管理**：将测试文件集中到tests目录，便于管理
5. **配置文件集中管理**：将配置文件集中到config目录，便于维护
6. **删除了冗余目录**：删除了功能重复的目录，如多个测试目录
7. **优化了静态资源管理**：将静态资源集中到public目录，便于管理
8. **改进了脚本组织**：按用途组织脚本，提高了可用性

## 7. 目录结构演进计划

目录结构的优化是一个持续的过程，未来计划的改进包括：

1. **进一步模块化**：将模块拆分为更小的子模块，提高复用性
2. **微前端架构准备**：为未来可能的微前端架构做准备
3. **多语言支持优化**：优化多语言支持的目录结构
4. **主题系统改进**：完善主题系统的目录结构
5. **文档自动生成**：集成自动文档生成，保持文档与代码的一致性 