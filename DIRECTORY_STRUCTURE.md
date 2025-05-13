# 食品溯源系统 - 详细目录结构说明

<!-- updated for: 项目重构阶段一 - 文档统一与更新 -->

<!-- updated for: 项目重构阶段一 - 配置文件整合 -->

## 1. 根目录结构

```
.
├── web-app/                   # Web应用主目录
├── docs/                      # 项目文档
│   ├── architecture/          # 架构文档
│   │   ├── overview.md        # 系统架构概览
│   │   ├── directory.md       # 目录结构说明
│   │   └── technologies.md    # 技术栈说明
│   ├── api/                   # API文档
│   │   ├── overview.md        # API概览
│   │   ├── trace.md           # 溯源API文档
│   │   └── authentication.md  # 认证API文档
│   ├── components/            # 组件文档
│   │   ├── overview.md        # 组件概览
│   │   ├── common/            # 通用组件文档
│   │   │   └── index.md       # 通用组件索引
│   │   └── modules/           # 业务模块组件文档
│   │       └── index.md       # 业务组件索引
│   └── guides/                # 开发指南
│       └── getting-started.md # 快速开始指南
├── scripts/                   # 工具脚本目录
│   ├── dev/                   # 开发相关脚本
│   │   ├── start.sh           # 开发服务器启动脚本
│   │   └── debug.sh           # 调试模式启动脚本
│   ├── build/                 # 构建相关脚本
│   │   ├── build.sh           # 项目构建脚本
│   │   └── analyze.sh         # 打包分析脚本
│   └── deploy/                # 部署相关脚本
│       ├── deploy-prod.sh     # 生产环境部署脚本
│       └── deploy-test.sh     # 测试环境部署脚本
├── refactor/                  # 重构相关文档和脚本
│   ├── docs/                  # 重构文档
│   │   ├── plan.md            # 重构总体计划
│   │   └── guidelines.md      # 重构指南
│   ├── phase-1/               # 阶段一：结构清理与统一
│   │   ├── TASKS.md           # 任务列表
│   │   ├── progress-reports/  # 进度报告
│   │   │   └── task002_progress.md # TASK-002进度报告
│   │   └── results/           # 完成报告
│   │       ├── TASK-001_completion_report.md # TASK-001完成报告
│   │       ├── TASK-002_completion_report.md # TASK-002完成报告
│   │       ├── TASK-004_completion_report.md # TASK-004完成报告
│   │       └── TASK-007_completion_report.md # TASK-007完成报告
│   └── phase-2/               # 阶段二：代码优化与模块化
│       └── plan.md            # 阶段二计划详情
├── .github/                   # GitHub配置
│   └── workflows/             # GitHub Actions工作流程
│       ├── build.yml          # 构建工作流
│       └── test.yml           # 测试工作流
├── .husky/                    # Git钩子配置
│   ├── pre-commit             # 提交前钩子
│   └── commit-msg             # 提交消息钩子
├── .vscode/                   # VS Code配置
│   ├── settings.json          # 项目特定设置
│   ├── extensions.json        # 推荐扩展
│   └── launch.json            # 调试配置
├── package.json               # 项目依赖配置
├── package-lock.json          # 依赖锁定文件
├── tsconfig.json              # TypeScript配置
├── .eslintrc.js               # ESLint配置
├── .prettierrc                # Prettier配置
├── .gitignore                 # Git忽略文件
├── .env.example               # 环境变量示例
├── README.md                  # 项目说明文档
└── DIRECTORY_STRUCTURE.md     # 目录结构详细说明（本文件）
```

## 2. web-app目录结构

```
web-app/
├── src/                       # 源代码目录
│   ├── components/            # 组件目录
│   │   ├── common/            # 通用组件
│   │   │   ├── Button/        # 按钮组件
│   │   │   │   ├── index.js   # 导出入口
│   │   │   │   ├── Button.jsx # 组件实现
│   │   │   │   ├── Button.module.css # 组件样式
│   │   │   │   └── Button.test.js # 组件测试
│   │   │   ├── Input/         # 输入框组件
│   │   │   ├── Select/        # 选择框组件
│   │   │   ├── Modal/         # 模态框组件
│   │   │   ├── Card/          # 卡片组件
│   │   │   ├── Table/         # 表格组件
│   │   │   └── ...            # 其他通用组件
│   │   ├── modules/           # 业务模块组件
│   │   │   ├── trace/         # 溯源相关组件
│   │   │   │   ├── TraceQuery/    # 溯源查询组件
│   │   │   │   ├── TraceResult/   # 溯源结果组件
│   │   │   │   ├── TraceTimeline/ # 溯源时间线组件
│   │   │   │   └── ...            # 其他溯源组件
│   │   │   ├── farming/       # 农业/养殖相关组件
│   │   │   │   ├── DataCollection/ # 数据采集组件
│   │   │   │   ├── EnvironmentMonitor/ # 环境监控组件
│   │   │   │   └── ...              # 其他农业组件
│   │   │   ├── processing/    # 加工相关组件
│   │   │   │   ├── QualityTest/    # 质量检测组件
│   │   │   │   ├── ProcessingRecord/ # 加工记录组件
│   │   │   │   └── ...              # 其他加工组件
│   │   │   ├── logistics/     # 物流相关组件
│   │   │   │   ├── ShipmentTracker/ # 运输跟踪组件
│   │   │   │   ├── RouteMap/        # 路线地图组件
│   │   │   │   └── ...              # 其他物流组件
│   │   │   └── admin/         # 管理后台组件
│   │   │       ├── UserManagement/  # 用户管理组件
│   │   │       ├── Dashboard/       # 仪表盘组件
│   │   │       └── ...              # 其他管理组件
│   │   └── ui/                # UI基础组件
│   │       ├── icons/         # 图标组件
│   │       ├── layout/        # 布局组件
│   │       └── theme/         # 主题组件
│   ├── pages/                 # 页面组件
│   │   ├── auth/              # 认证相关页面
│   │   │   ├── LoginPage.jsx  # 登录页面
│   │   │   ├── RegisterPage.jsx # 注册页面
│   │   │   └── ...            # 其他认证页面
│   │   ├── trace/             # 溯源相关页面
│   │   │   ├── TracePage.jsx  # 溯源查询页面
│   │   │   ├── TraceDetailPage.jsx # 溯源详情页面
│   │   │   └── ...            # 其他溯源页面
│   │   ├── farming/           # 农业/养殖相关页面
│   │   ├── processing/        # 加工相关页面
│   │   ├── logistics/         # 物流相关页面
│   │   ├── admin/             # 管理后台页面
│   │   └── error/             # 错误页面
│   │       ├── NotFoundPage.jsx # 404页面
│   │       └── ErrorPage.jsx  # 通用错误页面
│   ├── hooks/                 # 自定义Hooks
│   │   ├── useAuth.js         # 认证Hook
│   │   ├── useTrace.js        # 溯源Hook
│   │   ├── useForm.js         # 表单Hook
│   │   └── ...                # 其他自定义Hook
│   ├── utils/                 # 工具函数
│   │   ├── network/           # 网络相关工具
│   │   │   ├── api.js         # API请求工具
│   │   │   ├── interceptors.js # 请求拦截器
│   │   │   └── errorHandler.js # 错误处理
│   │   ├── storage/           # 存储相关工具
│   │   │   ├── localStorage.js # 本地存储工具
│   │   │   └── sessionStorage.js # 会话存储工具
│   │   ├── auth/              # 认证相关工具
│   │   │   ├── token.js       # 令牌管理
│   │   │   └── permissions.js # 权限检查
│   │   └── common/            # 通用工具
│   │       ├── date.js        # 日期处理
│   │       ├── format.js      # 格式化工具
│   │       ├── validation.js  # 验证工具
│   │       └── ...            # 其他通用工具
│   ├── services/              # API服务
│   │   ├── trace/             # 溯源相关API
│   │   │   ├── traceService.js # 溯源服务
│   │   │   └── eventService.js # 事件服务
│   │   ├── farming/           # 农业/养殖相关API
│   │   ├── processing/        # 加工相关API
│   │   ├── logistics/         # 物流相关API
│   │   └── auth/              # 认证相关API
│   │       ├── authService.js # 认证服务
│   │       └── userService.js # 用户服务
│   ├── store/                 # 状态管理
│   │   ├── auth/              # 认证状态
│   │   ├── trace/             # 溯源状态
│   │   ├── ui/                # UI状态
│   │   └── index.js           # 状态管理入口
│   ├── styles/                # 全局样式
│   │   ├── themes/            # 主题样式
│   │   │   ├── light.css      # 亮色主题
│   │   │   └── dark.css       # 暗色主题
│   │   ├── components/        # 组件样式
│   │   ├── pages/             # 页面样式
│   │   └── globals/           # 全局样式
│   │       ├── variables.css  # CSS变量
│   │       ├── reset.css      # CSS重置
│   │       └── typography.css # 排版样式
│   └── types/                 # 类型定义
│       ├── trace.d.ts         # 溯源类型
│       ├── auth.d.ts          # 认证类型
│       └── ...                # 其他类型定义
├── public/                    # 静态资源
│   ├── assets/                # 资源文件
│   │   ├── images/            # 图片资源
│   │   ├── icons/             # 图标资源
│   │   └── logos/             # Logo资源
│   ├── fonts/                 # 字体文件
│   ├── favicon.ico            # 网站图标
│   └── index.html             # HTML模板
└── tests/                     # 测试文件
    ├── e2e/                 # 端到端测试
    │   ├── global-setup.js  # 全局测试设置
    │   └── *.test.js        # 端到端测试用例
    ├── integration/         # 集成测试
    │   ├── mock-server/     # 模拟服务器
    │   │   ├── index.js     # 模拟服务器实现
    │   │   ├── mockFetch.js # Fetch请求模拟工具
    │   │   └── static/      # 静态资源目录
    │   └── *.test.js        # 集成测试用例
    ├── unit/                # 单元测试
    │   └── *.test.js        # 单元测试用例
    ├── utils/               # 测试工具
    │   ├── fileMock.js      # 文件模拟
    │   └── styleMock.js     # 样式模拟
    ├── setup.js             # 测试环境设置
    ├── run-all-tests.js     # 测试运行脚本
    └── README.md            # 测试使用指南
└── config/                    # 配置文件
    ├── default/               # 默认配置
    │   ├── app.js             # 应用基本配置
    │   ├── api.js             # API相关配置
    │   ├── auth.js            # 认证相关配置
    │   ├── ui.js              # UI相关配置
    │   ├── features.js        # 功能特性配置
    │   ├── storage.js         # 存储相关配置
    │   ├── performance.js     # 性能相关配置
    │   └── integration.js     # 第三方集成配置
    ├── environments/          # 环境特定配置
    │   ├── development.js     # 开发环境配置
    │   ├── testing.js         # 测试环境配置
    │   └── production.js      # 生产环境配置
    ├── server/                # 服务器配置
    │   ├── default.js         # 默认服务器配置
    │   ├── development.js     # 开发环境服务器配置
    │   ├── testing.js         # 测试环境服务器配置
    │   └── production.js      # 生产环境服务器配置
    ├── build/                 # 构建配置
    │   ├── babel.config.js    # Babel配置
    │   └── postcss.config.js  # PostCSS配置
    ├── test/                  # 测试配置
    │   ├── jest.config.js     # Jest主配置
    │   ├── jest.setup.js      # Jest设置文件
    │   └── test.config.js     # 通用测试配置
    └── assets.js              # 资源管理配置
```

## 3. 目录结构说明

### 3.1 根目录文件与目录说明

| 目录/文件 | 说明 |
|---------|------|
| `web-app/` | 包含Web应用的所有源代码、资源和配置，是项目的核心开发目录。 |
| `docs/` | 包含项目所有文档，按类型（架构、API、组件、指南）分类组织。提供开发者理解系统的重要资源。 |
| `scripts/` | 包含用于开发、构建和部署的工具脚本。这些脚本自动化常见任务，提高开发效率。 |
| `refactor/` | 包含项目重构的计划、任务和结果文档。记录重构过程和成果，便于追踪重构进度。 |
| `.github/` | 包含GitHub相关配置，主要是CI/CD工作流程定义。 |
| `.husky/` | 包含Git钩子配置，用于在Git操作前执行代码检查等任务。 |
| `.vscode/` | 包含VS Code编辑器的项目特定配置，确保团队使用一致的编辑器设置。 |
| `package.json` | 项目依赖和脚本定义，是npm/yarn/pnpm包管理的核心文件。 |
| `tsconfig.json` | TypeScript配置文件，定义TypeScript编译选项和规则。 |
| `.eslintrc.js` | ESLint配置，定义代码质量和风格规则。 |
| `.prettierrc` | Prettier配置，确保代码格式一致性。 |
| `.gitignore` | 指定Git应忽略的文件和目录。 |
| `.env.example` | 环境变量示例文件，为开发者提供配置参考。 |
| `README.md` | 项目主要说明文档，提供项目概述、功能和使用指南。 |
| `DIRECTORY_STRUCTURE.md` | 当前文件，详细说明项目目录结构。 |

### 3.2 web-app目录说明

#### 3.2.1 src目录

| 目录 | 说明 |
|------|------|
| `components/` | 包含所有React组件，分为通用组件、业务模块组件和UI基础组件三个子目录。每个组件使用独立目录组织，包含实现、样式和测试文件。 |
| `pages/` | 包含应用的页面级组件，按功能模块组织。每个页面组件整合多个小组件，实现完整业务功能。 |
| `hooks/` | 包含自定义React Hooks，封装可复用的逻辑，如表单处理、认证逻辑等。 |
| `utils/` | 包含通用工具函数，按功能分类（网络、存储、认证、通用）。这些工具提供基础功能支持，不包含业务逻辑。其中包含`config-loader.js`提供统一的配置访问机制。 |
| `services/` | 包含API服务，处理与后端的交互，按业务模块组织。每个服务封装特定领域的API调用逻辑。 |
| `store/` | 包含状态管理相关代码，按功能模块组织。负责管理应用全局状态，响应用户操作并更新UI。 |
| `styles/` | 包含全局样式和主题，包括变量、重置、排版等。确保应用视觉风格的一致性。 |
| `types/` | 包含TypeScript类型定义，按业务领域组织。提供类型安全，提高代码可维护性。 |

#### 3.2.2 其他目录

| 目录 | 说明 |
|------|------|
| `public/` | 包含静态资源，如图片、图标、字体等。这些资源直接被部署到服务器，不经过打包处理。 |
| `tests/` | 包含测试文件，分为单元测试、集成测试和端到端测试。确保代码质量和功能正确性。 |
| `config/` | 包含配置文件，按用途分类（默认配置、环境配置、服务器配置、构建配置、测试配置）。集中管理应用的各种配置项，提供单一真相来源。这一结构是TASK-003配置文件整合的成果，将原本分散的配置文件集中并按职责组织。 |

### 3.2.3 配置目录结构

`config/` 目录采用了模块化和环境分离的原则，组织如下：

| 目录/文件 | 说明 |
|---------|------|
| `default/` | 包含各模块的默认配置，适用于所有环境 |
| `environments/` | 包含针对特定环境的配置覆盖，仅包含与默认配置不同的内容 |
| `server/` | 服务器相关配置，包括API服务器、开发服务器等设置 |
| `build/` | 构建工具配置，如Babel、PostCSS等，从项目根目录迁移 |
| `test/` | 测试框架配置，包括Jest等测试工具的设置 |
| `assets.js` | 资源管理相关配置 |

配置系统采用分层加载机制，通过 `src/utils/config-loader.js` 统一访问，可自动识别当前环境并合并相应配置。

在TASK-003中，原先位于项目根目录的配置文件（如babel.config.js、postcss.config.js、jest.config.js等）已全部迁移到对应的子目录中并删除原始文件，以实现更好的组织和管理。

## 4. 组织原则与设计思想

### 4.1 模块化设计

系统采用模块化设计，将代码按功能领域（溯源、农业、加工、物流等）组织，各模块内聚，模块间松耦合。这种设计提高了代码的可维护性和可扩展性。

### 4.2 层级分明

代码结构采用清晰的层级：
- 组件层（components, pages）：负责UI渲染和用户交互
- 逻辑层（hooks, services, store）：负责业务逻辑和数据处理
- 工具层（utils, types）：提供基础功能支持

### 4.3 关注点分离

系统实现了关注点分离：
- UI与业务逻辑分离
- 数据获取与状态管理分离
- 可重用逻辑与特定逻辑分离

### 4.4 命名与组织约定

- 使用一致的命名约定（PascalCase用于组件，camelCase用于工具函数等）
- 文件和目录命名反映其用途和内容
- 相关文件放在一起，便于查找和维护

## 5. 未来演进计划

随着项目发展，目录结构将继续优化，计划包括：

1. **进一步模块化**：将大型模块拆分为更小的子模块，提高复用性
2. **微前端架构准备**：为未来可能的微前端架构做准备
3. **多语言支持优化**：完善国际化支持的目录结构
4. **组件库独立化**：将通用组件提取为独立库
5. **API服务层改进**：优化API服务结构，支持更灵活的数据获取模式 