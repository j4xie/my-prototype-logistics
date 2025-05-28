# 食品溯源系统 - 详细目录结构说明

> **说明**: 本文档仅记录当前最新的目录结构。
> 
> **变更历史**: 目录结构的变更历史请查看 [docs/directory-structure-changelog.md](docs/directory-structure-changelog.md)

## 1. 根目录结构

```
.
├── web-app/                   # Web应用主目录
├── docs/                      # 项目文档
│   ├── architecture/          # 架构文档
│   │   ├── overview.md        # 系统架构概览
│   │   ├── design-principles.md # 架构设计原则
│   │   └── technologies.md    # 技术栈说明
│   ├── api/                   # API文档
│   │   ├── README.md          # API文档索引和概览
│   │   ├── overview.md        # API概览
│   │   ├── trace.md           # 溯源API文档
│   │   ├── authentication.md  # 认证API文档
│   │   ├── farming.md         # 农业模块API文档
│   │   ├── processing.md      # 加工模块API文档
│   │   ├── logistics.md       # 物流模块API文档
│   │   ├── admin.md           # 管理模块API文档
│   │   ├── profile.md         # 用户中心API文档
│   │   └── data-models.md     # 统一数据模型文档
│   ├── components/            # 组件文档
│   │   ├── overview.md        # 组件概览
│   │   ├── common/            # 通用组件文档
│   │   │   └── index.md       # 通用组件索引
│   │   └── modules/           # 业务模块组件文档
│   │       └── index.md       # 业务组件索引
│   ├── guides/                # 开发指南
│   │   └── getting-started.md # 快速开始指南
│   ├── prd/                   # 产品需求文档
│   ├── archive/               # 归档文档
│   └── project-management/    # 项目管理文档
├── scripts/                   # 工具脚本目录
│   ├── build/                 # 构建相关脚本
│   ├── deploy/                # 部署相关脚本
│   ├── dev/                   # 开发环境相关脚本
│   │   ├── git/               # Git相关开发脚本
│   │   │   ├── tools/         # Git工具脚本
│   │   │   │   ├── git-tools.ps1  # PowerShell版本
│   │   │   │   ├── git-tools.bat  # 批处理版本
│   │   │   │   ├── git-tools.sh   # Shell版本
│   │   │   │   └── README.md      # 使用说明
│   │   └── debug/             # 调试相关脚本
│   ├── data/                  # 数据处理相关脚本
│   ├── utils/                 # 工具类脚本
│   │   ├── modules/           # 模块相关工具脚本
│   │   ├── button-fixes/      # 按钮修复相关脚本
│   │   └── resource-fixes/    # 资源修复相关脚本
│   ├── validation/            # 验证相关脚本（Phase-2重构验证）
│   │   ├── core/              # 核心验证模块
│   │   ├── modules/           # 模块化验证
│   │   ├── tasks/             # 任务专项验证
│   │   ├── reports/           # 验证报告
│   │   ├── mobile-adaptation-validation.js    # 移动端适配验证
│   │   ├── performance-validation.js          # 性能验证
│   │   ├── accessibility-validation.js        # 可访问性验证
│   │   ├── comprehensive-p2-validation.js     # Phase-2综合验证
│   │   └── scripts/           # 验证子脚本
│   ├── README.md              # 脚本使用说明文档
│   └── SCRIPT_INVENTORY.md    # 脚本清单
├── refactor/                  # 重构相关文档和脚本
│   ├── docs/                  # 重构文档
│   │   ├── plan.md            # 重构总体计划
│   │   └── guidelines.md      # 重构指南
│   ├── assets/                # 重构相关资源文件
│   ├── REFACTOR_LOG.md        # 重构日志记录
│   ├── README.md              # 重构说明文档
│   ├── phase-1/               # 阶段一：结构清理与统一 (已完成)
│   │   ├── PHASE-1-WORK-PLAN.md       # 阶段一工作计划
│   │   ├── TASKS.md           # 任务列表
│   │   ├── progress-reports/  # 进度报告
│   │   │   ├── task002_progress.md # TASK-002进度报告
│   │   │   └── task007_progress.md # TASK-007进度报告
│   │   └── results/           # 完成报告
│   │       ├── TASK-001_completion_report.md # TASK-001完成报告
│   │       ├── TASK-002_completion_report.md # TASK-002完成报告
│   │       ├── TASK-004_completion_report.md # TASK-004完成报告
│   │       └── TASK-007_completion_report.md # TASK-007完成报告
│   ├── phase-2/               # 阶段二：代码优化与模块化 (进行中)
│   │   ├── PHASE-2-WORK-PLAN.md       # 阶段二工作计划
│   │   ├── README.md          # 阶段二说明文档
│   │   ├── TASKS.md           # 阶段二任务列表
│   │   ├── tasks/             # 具体任务文档
│   │   │   ├── TASK_TEMPLATE.md                    # 任务模板
│   │   │   ├── TASK-005_代码模块化改造.md           # 代码模块化任务
│   │   │   ├── TASK-P2-001_移动端UI适配问题修复.md  # 移动端适配任务
│   │   │   ├── TASK-P2-002_OrganizeUIComponents.md # UI组件组织任务
│   │   │   ├── TASK-P2-003_ModularizeUtilFunctions.md # 工具函数模块化
│   │   │   ├── TASK-P2-004_ImplementFluidLayouts.md   # 流式布局实现
│   │   │   ├── TASK-P2-005_优化登录页面移动端适配.md  # 登录页面优化
│   │   │   ├── TASK-P2-006_布局组件拓展.md           # 布局组件扩展
│   │   │   └── TASK-P2-007_API接口文档完善.md       # API接口文档完善
│   │   ├── progress-reports/  # 进度报告
│   │   │   └── PROGRESS_TEMPLATE.md  # 进度报告模板
│   │   └── review-notes/      # 评审记录
│   │       └── REVIEW_TEMPLATE.md    # 评审记录模板
│   ├── phase-3/               # 阶段三：技术栈现代化 (进行中 37%)
│   │   ├── PHASE-3-WORK-PLAN.md       # 阶段三详细工作计划
│   │   ├── REFACTOR-PHASE3-CHANGELOG.md # Phase-3专门变更日志
│   │   ├── docs/              # 阶段三文档
│   │   │   ├── TECH-SELECTION.md     # 技术选型决策
│   │   │   ├── MIGRATION-STRATEGY.md # 迁移策略
│   │   │   └── COMPONENT-MIGRATION-GUIDE.md # 组件迁移指导
│   │   ├── progress-reports/  # 进度报告
│   │   ├── review-notes/      # 评审记录
│   │   └── tasks/             # 任务文档
│   │       ├── TASK-P3-001_前端框架迁移评估与选型.md # 技术选型任务(已完成)
│   │       ├── TASK-P3-007_组件库现代化迁移.md        # 组件库现代化(进行中85%)
│   │       └── TASK-P3-014_Next.js项目标准化与配置完善.md # 项目标准化(新建)
│   └── phase-4/               # 阶段四：性能与安全优化 (未开始)
│       ├── PHASE-4-WORK-PLAN.md       # 阶段四工作计划
│       ├── progress-reports/  # 进度报告
│       ├── review-notes/      # 评审记录
│       └── tasks/             # 任务文档
├── .github/                   # GitHub配置
│   └── workflows/             # GitHub Actions工作流程
│       ├── build.yml          # 构建工作流
│       └── test.yml           # 测试工作流
├── .husky/                    # Git钩子配置
│   ├── pre-commit             # 提交前钩子
│   └── commit-msg             # 提交消息钩子
├── .cursor/                   # Cursor AI编辑器配置
│   └── rules/                 # Cursor规则文件目录
│       ├── development-principles-always.mdc      # 核心开发原则(自动应用)
│       ├── project-management-auto.mdc            # 项目管理与文档规范
│       ├── task-management-manual.mdc             # 任务管理规范
│       ├── refactor-phase2-agent.mdc             # 重构阶段二代理规则
│       ├── refactor-phase3-agent.mdc             # 重构阶段三代理规则(2025-05-27更新)
│       ├── ui-design-system-auto.mdc             # UI设计系统规范
│       ├── api-interface-design-agent.mdc        # API接口设计规范
│       ├── documentation-deduplication-manual.mdc # 文档去重规范
│       ├── test-validation-standards-manual.mdc   # 测试验证文件规范化规则
│       └── cursor-rules.mdc                      # 规则索引文件
├── .vscode/                   # VS Code配置
│   ├── settings.json          # 项目特定设置
│   ├── extensions.json        # 推荐扩展
│   └── launch.json            # 调试配置
├── package.json               # 项目依赖配置
├── package-lock.json          # 依赖锁定文件
├── workspace.json             # 工作区配置文件
├── vercel.json                # Vercel部署配置
├── test-server.js             # 测试服务器
├── .gitignore                 # Git忽略文件
├── README.md                  # 项目说明文档
├── README.md.bak              # README备份文件
├── TASKS.md                   # 项目任务概览（引用权威来源）
├── 重构阶段记录.md             # 重构阶段记录
├── 项目重构方案.md             # 项目重构方案
├── 所有文件解释.md             # 所有文件解释文档
└── DIRECTORY_STRUCTURE.md     # 目录结构详细说明（本文件）
```

## 2. web-app-next目录结构 (Phase-3现代化技术栈)

```
web-app-next/
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── components/        # 组件演示页面
│   │   │   └── page.tsx       # 组件展示页面(含Badge、StatCard、布局组件等)
│   │   ├── demo/              # 功能演示页面
│   │   │   └── page.tsx       # 功能演示页面
│   │   ├── globals.css        # 全局样式
│   │   ├── layout.tsx         # 根布局
│   │   └── page.tsx           # 首页
│   ├── components/            # 组件库
│   │   └── ui/                # 基础UI组件(TypeScript现代化版本)
│   │       ├── badge.tsx      # Badge徽章组件系列(完成✅)
│   │       ├── stat-card.tsx  # StatCard统计卡片组件(完成✅)
│   │       ├── mobile-search.tsx # MobileSearch移动搜索组件(完成✅)
│   │       ├── touch-gesture.tsx # TouchGesture触摸手势组件(完成✅)
│   │       ├── mobile-nav.tsx # MobileNav移动端导航组件(完成✅)
│   │       ├── fluid-container.tsx # FluidContainer流式容器组件(完成✅)
│   │       ├── row.tsx        # Row行布局组件(完成✅)
│   │       ├── column.tsx     # Column列布局组件(完成✅)
│   │       ├── page-layout.tsx # PageLayout页面布局组件(完成✅)
│   │       ├── button.tsx     # Button按钮组件(完成✅)
│   │       ├── card.tsx       # Card卡片组件(完成✅)
│   │       ├── modal.tsx      # Modal对话框组件(完成✅)
│   │       ├── loading.tsx    # Loading加载组件(完成✅)
│   │       ├── input.tsx      # Input输入框组件(完成✅)
│   │       ├── select.tsx     # Select选择框组件(完成✅)
│   │       ├── textarea.tsx   # Textarea文本域组件(完成✅)
│   │       ├── table.tsx      # Table表格组件(完成✅)
│   │       └── index.ts       # 组件导出索引
│   ├── lib/
│   │   └── utils.ts           # 工具函数
│   ├── store/
│   │   └── authStore.ts       # 认证状态管理
│   └── types/                 # TypeScript类型定义
├── public/                    # 静态资源
├── .next/                     # Next.js构建输出(自动生成)
├── package.json               # 项目依赖
├── tsconfig.json              # TypeScript配置
├── tailwind.config.js         # Tailwind CSS配置
└── next.config.js             # Next.js配置
```

## 3. web-app目录结构 (Phase-2传统技术栈)

```
web-app/
├── implementation-plan.mdc    # Web应用功能开发实施计划
├── api-router.js              # API路由配置
├── local-server.js            # 本地开发服务器
├── test-data.js               # 测试数据
├── server.js                  # 服务器配置
├── index.html                 # 主页面入口
├── coming-soon.html           # 即将上线页面
├── package.json               # Web应用依赖配置
├── package-lock.json          # 依赖锁定文件
├── webpack.config.js          # Webpack配置
├── .babelrc                   # Babel配置
├── vercel.json                # Vercel部署配置
├── README.md                  # Web应用说明文档
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
│   │   │   │   ├── TraceRecordView.jsx # 现代化React版本的溯源记录视图组件
│   │   │   │   ├── TraceRecordForm.jsx # 现代化React版本的溯源记录表单组件
│   │   │   │   ├── index.js           # 追溯模块组件导出索引
│   │   │   │   ├── TraceQuery/        # 溯源查询组件（传统）
│   │   │   │   ├── TraceResult/       # 溯源结果组件（传统）
│   │   │   │   ├── TraceTimeline/     # 溯源时间线组件（传统）
│   │   │   │   └── ...                # 其他溯源组件
│   │   │   ├── farming/       # 农业/养殖相关组件
│   │   │   │   ├── FarmingRecordView.jsx # 现代化React版本的养殖记录视图组件
│   │   │   │   ├── index.js           # 养殖模块组件导出索引
│   │   │   │   ├── DataCollection/    # 数据采集组件（传统）
│   │   │   │   ├── EnvironmentMonitor/ # 环境监控组件（传统）
│   │   │   │   └── ...                # 其他农业组件
│   │   │   ├── processing/    # 加工相关组件
│   │   │   │   ├── ProcessingRecordView.jsx # 现代化React版本的加工记录视图组件
│   │   │   │   ├── index.js           # 加工模块组件导出索引
│   │   │   │   ├── QualityTest/       # 质量检测组件（传统）
│   │   │   │   ├── ProcessingRecord/  # 加工记录组件（传统）
│   │   │   │   └── ...                # 其他加工组件
│   │   │   ├── logistics/     # 物流相关组件
│   │   │   │   ├── LogisticsRecordView.jsx # 现代化React版本的物流记录视图组件
│   │   │   │   ├── index.js           # 物流模块组件导出索引
│   │   │   │   ├── ShipmentTracker/   # 运输跟踪组件（传统）
│   │   │   │   ├── RouteMap/          # 路线地图组件（传统）
│   │   │   │   └── ...                # 其他物流组件
│   │   │   ├── admin/         # 管理后台组件
│   │   │   │   ├── AdminDashboard.jsx # 现代化React版本的管理员仪表板组件
│   │   │   │   ├── index.js           # 管理员模块组件导出索引
│   │   │   │   ├── UserManagement/    # 用户管理组件（传统）
│   │   │   │   ├── Dashboard/         # 仪表盘组件（传统）
│   │   │   │   └── ...                # 其他管理组件
│   │   │   └── profile/       # 用户档案相关组件
│   │   │       ├── UserProfile.jsx   # 现代化React版本的用户档案组件
│   │   │       ├── index.js           # 用户档案模块组件导出索引
│   │   │       └── ...                # 其他用户档案组件
│   │   └── ui/                # UI基础组件
│   │       ├── Button.js      # 标准化按钮组件
│   │       ├── Card.js        # 卡片组件
│   │       ├── Loading.js     # 加载状态组件
│   │       ├── Modal.js       # 模态框组件
│   │       ├── form/          # 表单组件
│   │       │   ├── Input.js   # 输入框组件
│   │       │   ├── Select.js  # 选择框组件
│   │       │   └── index.js   # 表单组件导出
│   │       ├── navigation/    # 导航组件
│   │       │   ├── MobileNav.js # 移动端导航组件
│   │       │   ├── MobileDrawer.js # 移动端导航抽屉组件
│   │       │   └── index.js   # 导航组件导出
│   │       ├── TouchGesture.js # 触摸手势支持组件
│   │       ├── MobileSearch.js # 移动端搜索组件
│   │       ├── layout/        # 布局组件
│   │       │   ├── FluidContainer.js  # 响应式流式布局容器
│   │       │   ├── Row.js             # 响应式行布局
│   │       │   ├── Column.js          # 响应式列布局
│   │       │   ├── PageLayout.js      # 页面布局组件
│   │       │   └── index.js           # 布局组件导出
│   │       ├── icons/         # 图标组件
│   │       ├── theme/         # 主题组件
│   │       └── index.js       # UI组件统一导出
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
│   │   ├── performance/       # 性能监控相关工具
│   │   │   ├── performance-tracker.js  # 性能追踪工具
│   │   │   ├── resource-monitor.js     # 资源监控工具
│   │   │   ├── performance-test-tool.js # 性能测试工具
│   │   │   └── index.js               # 性能工具统一导出
│   │   ├── common/            # 通用工具
│   │   │   ├── date.js        # 日期处理
│   │   │   ├── format.js      # 格式化工具
│   │   │   ├── validation.js  # 验证工具
│   │   │   ├── responsive-helper.js # 响应式布局辅助工具
│   │   │   ├── media-query-manager.js # 媒体查询管理系统
│   │   │   ├── event-emitter.js     # 事件触发器
│   │   │   ├── logger.js            # 日志工具
│   │   │   ├── Lock.js              # 锁机制工具
│   │   │   ├── config-loader.js     # 配置加载器（已模块化）
│   │   │   └── index.js             # 通用工具统一导出
│   │   └── index.js           # 工具函数总导出入口
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
│   │       ├── typography.css # 排版样式
│   │       └── responsive.css # 响应式样式
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
├── dist/                      # 构建输出目录
│   ├── bundle.js              # 打包后的JavaScript文件
│   ├── *.js                   # 其他生成的JS文件
│   └── assets/                # 打包后的资源文件
├── js/                        # JavaScript文件目录
├── static/                    # 静态资源目录
│   ├── css/                   # CSS样式文件
│   ├── images/                # 图片资源
│   └── js/                    # JavaScript文件
├── styles/                    # 样式文件目录
├── assets/                    # 资源文件目录
│   ├── components/            # 组件相关资源
│   ├── css/                   # CSS样式文件
│   ├── icons/                 # 图标资源
│   │   ├── home/              # 首页图标
│   │   ├── info/              # 信息图标
│   │   ├── record/            # 记录图标
│   │   └── user/              # 用户图标
│   ├── images/                # 图片资源
│   ├── monitoring/            # 监控相关资源
│   │   └── thumbnails/        # 缩略图
│   └── styles/                # 样式资源
├── pages/                     # 页面文件目录
│   ├── admin/                 # 管理后台页面
│   │   ├── assets/            # 管理后台资源
│   │   ├── auth/              # 认证相关页面
│   │   ├── components/        # 管理后台组件
│   │   └── errors/            # 错误页面
│   ├── assets/                # 页面资源
│   │   ├── css/               # 页面CSS
│   │   └── icons/             # 页面图标
│   ├── auth/                  # 认证页面
│   ├── demo/                  # 演示页面
│   ├── errors/                # 错误页面
│   ├── farming/               # 农业页面
│   │   └── assets/            # 农业页面资源
│   │       └── images/        # 农业页面图片
│   ├── home/                  # 首页
│   ├── logistics/             # 物流页面
│   ├── page-assets/           # 页面资源
│   │   └── icons/             # 页面图标
│   ├── pages/                 # 页面子目录
│   │   └── errors/            # 错误页面
│   ├── processing/            # 加工页面
│   │   └── assets/            # 加工页面资源
│   ├── profile/               # 用户资料页面
│   └── trace/                 # 溯源页面
├── components/                # 组件目录
│   ├── auth/                  # 认证组件
│   ├── data/                  # 数据组件
│   ├── documentation/         # 文档组件
│   ├── modules/               # 模块组件
│   │   ├── auth/              # 认证模块
│   │   ├── data/              # 数据模块
│   │   ├── store/             # 存储模块
│   │   ├── trace/             # 溯源模块
│   │   ├── ui/                # UI模块
│   │   ├── utils/             # 工具模块
│   │   └── web-app/           # Web应用模块
│   │       └── test-pages/    # 测试页面
│   ├── store/                 # 存储组件
│   ├── ui/                    # UI组件
│   ├── utils/                 # 工具组件
│   └── validation/            # 验证组件
│       └── screenshots/       # 验证截图
├── coverage/                  # 测试覆盖率报告
│   ├── auth/                  # 认证模块覆盖率
│   ├── data/                  # 数据模块覆盖率
│   ├── lcov-report/           # LCOV格式报告
│   │   ├── auth/              # 认证模块报告
│   │   ├── components/        # 组件报告
│   │   │   ├── data/          # 数据组件报告
│   │   │   ├── modules/       # 模块组件报告
│   │   │   │   ├── auth/      # 认证模块报告
│   │   │   │   ├── data/      # 数据模块报告
│   │   │   │   ├── store/     # 存储模块报告
│   │   │   │   ├── trace/     # 溯源模块报告
│   │   │   │   ├── ui/        # UI模块报告
│   │   │   │   └── utils/     # 工具模块报告
│   │   │   ├── store/         # 存储组件报告
│   │   │   ├── ui/            # UI组件报告
│   │   │   └── utils/         # 工具组件报告
│   │   ├── data/              # 数据报告
│   │   ├── modules/           # 模块报告
│   │   │   ├── auth/          # 认证模块报告
│   │   │   ├── data/          # 数据模块报告
│   │   │   ├── store/         # 存储模块报告
│   │   │   ├── ui/            # UI模块报告
│   │   │   └── utils/         # 工具模块报告
│   │   ├── src/               # 源代码覆盖率报告
│   │   │   ├── auth/          # 认证源码报告
│   │   │   ├── compatibility/ # 兼容性源码报告
│   │   │   │   └── polyfills/ # Polyfills报告
│   │   │   ├── components/    # 组件源码报告
│   │   │   │   ├── common/    # 通用组件报告
│   │   │   │   ├── modules/   # 模块组件报告
│   │   │   │   │   ├── farming/ # 农业模块报告
│   │   │   │   │   └── trace/ # 溯源模块报告
│   │   │   │   └── ui/        # UI组件报告
│   │   │   ├── examples/      # 示例源码报告
│   │   │   ├── network/       # 网络源码报告
│   │   │   ├── performance-tracking/ # 性能追踪报告
│   │   │   ├── security/      # 安全源码报告
│   │   │   ├── storage/       # 存储源码报告
│   │   │   ├── tools/         # 工具源码报告
│   │   │   └── utils/         # 工具函数报告
│   │   │       ├── auth/      # 认证工具报告
│   │   │       ├── common/    # 通用工具报告
│   │   │       ├── network/   # 网络工具报告
│   │   │       └── storage/   # 存储工具报告
│   │   ├── store/             # 存储报告
│   │   ├── ui/                # UI报告
│   │   ├── utils/             # 工具报告
│   │   └── web-app/           # Web应用报告
│   │       └── components/    # Web应用组件报告
│   │           └── modules/   # Web应用模块报告
│   │               ├── auth/  # 认证模块报告
│   │               ├── data/  # 数据模块报告
│   │               ├── store/ # 存储模块报告
│   │               ├── trace/ # 溯源模块报告
│   │               ├── ui/    # UI模块报告
│   │               └── utils/ # 工具模块报告
│   ├── modules/               # 模块覆盖率
│   │   ├── auth/              # 认证模块
│   │   ├── data/              # 数据模块
│   │   ├── store/             # 存储模块
│   │   ├── ui/                # UI模块
│   │   └── utils/             # 工具模块
│   ├── store/                 # 存储覆盖率
│   ├── ui/                    # UI覆盖率
│   ├── utils/                 # 工具覆盖率
│   └── web-app/               # Web应用覆盖率
│       └── components/        # Web应用组件覆盖率
│           └── modules/       # Web应用模块覆盖率
│               ├── auth/      # 认证模块覆盖率
│               ├── data/      # 数据模块覆盖率
│               ├── store/     # 存储模块覆盖率
│               ├── trace/     # 溯源模块覆盖率
│               ├── ui/        # UI模块覆盖率
│               └── utils/     # 工具模块覆盖率
├── logs/                      # 日志文件目录
├── screenshots/               # 截图目录
├── tmp/                       # 临时文件目录
├── web-app/                   # Web应用子目录
│   └── coverage/              # Web应用覆盖率报告
│       └── lcov-report/       # LCOV格式报告
├── .github/                   # GitHub配置
│   └── workflows/             # GitHub Actions工作流
└── .husky/                    # Git钩子配置
├── tests/                     # 测试文件
│   ├── e2e/                   # 端到端测试
│   │   ├── global-setup.js    # 全局测试设置
│   │   └── *.test.js          # 端到端测试用例
│   ├── integration/           # 集成测试
│   │   ├── mock-server/       # 模拟服务器
│   │   │   ├── index.js       # 模拟服务器实现
│   │   │   ├── mockFetch.js   # Fetch请求模拟工具
│   │   │   └── static/        # 静态资源目录
│   │   └── *.test.js          # 集成测试用例
│   ├── unit/                  # 单元测试
│   │   ├── utils/             # 工具函数单元测试
│   │   └── *.test.js          # 单元测试用例
│   ├── utils/                 # 测试工具
│   │   ├── fileMock.js        # 文件模拟
│   │   ├── styleMock.js       # 样式模拟
│   │   └── test-environment-mocks.js # 测试环境模拟
│   ├── setup.js               # 测试环境设置
│   ├── run-all-tests.js       # 测试运行脚本
│   └── README.md              # 测试使用指南
├── config/                    # 配置文件
│   ├── default/               # 默认配置
│   │   ├── app.js             # 应用基本配置
│   │   ├── api.js             # API相关配置
│   │   ├── auth.js            # 认证相关配置
│   │   ├── ui.js              # UI相关配置
│   │   ├── features.js        # 功能特性配置
│   │   ├── storage.js         # 存储相关配置
│   │   ├── performance.js     # 性能相关配置
│   │   └── integration.js     # 第三方集成配置
│   ├── environments/          # 环境特定配置
│   │   ├── development.js     # 开发环境配置
│   │   ├── testing.js         # 测试环境配置
│   │   └── production.js      # 生产环境配置
│   ├── server/                # 服务器配置
│   │   ├── default.js         # 默认服务器配置
│   │   ├── development.js     # 开发环境服务器配置
│   │   ├── testing.js         # 测试环境服务器配置
│   │   └── production.js      # 生产环境服务器配置
│   ├── build/                 # 构建配置
│   │   ├── webpack.config.js  # Webpack构建配置
│   │   ├── babel.config.js    # Babel配置
│   │   └── postcss.config.js  # PostCSS配置
│   ├── test/                  # 测试配置
│   │   ├── jest.config.js     # Jest主配置
│   │   ├── jest.setup.js      # Jest设置文件
│   │   └── playwright.config.js # Playwright端到端测试配置
│   └── assets.js              # 资源管理配置
└── .browserslistrc            # 浏览器支持列表
```

## 3. 目录结构说明

### 3.1 根目录文件与目录说明

| 目录/文件 | 说明 |
|---------|------|
| `web-app/` | 包含Web应用的所有源代码、资源和配置，是项目的核心开发目录。 |
| `docs/` | 包含项目所有文档，按类型（架构、API、组件、指南、PRD、项目管理）分类组织。提供开发者理解系统的重要资源。 |
| `scripts/` | 包含用于开发、构建和部署的工具脚本。这些脚本自动化常见任务，提高开发效率。 |
| `refactor/` | 包含项目重构的计划、任务和结果文档。记录重构过程和成果，便于追踪重构进度。当前正在进行阶段二(代码优化与模块化)。 |
| `.cursor/` | 包含Cursor AI编辑器的规则配置，定义了开发原则、项目管理规范、任务管理规范等，确保AI辅助开发的一致性和质量。 |
| `.github/` | 包含GitHub相关配置，主要是CI/CD工作流程定义。 |
| `.husky/` | 包含Git钩子配置，用于在Git操作前执行代码检查等任务。 |
| `.vscode/` | 包含VS Code编辑器的项目特定配置，确保团队使用一致的编辑器设置。 |
| `package.json` | 项目依赖和脚本定义，是npm/yarn/pnpm包管理的核心文件。 |
| `workspace.json` | 工作区配置文件，定义项目工作区的结构和设置。 |
| `vercel.json` | Vercel部署平台的配置文件，定义部署规则和设置。 |
| `test-server.js` | 测试服务器配置，用于本地开发和测试环境。 |
| `TASKS.md` | 项目任务概览，提供高级摘要并引用权威来源获取详细信息。 |
| `重构阶段记录.md` | 重构阶段的详细记录文档，记录各阶段的进展和成果。 |
| `项目重构方案.md` | 项目重构的总体方案和计划文档。 |
| `所有文件解释.md` | 项目中所有文件的详细解释文档。 |
| `.gitignore` | 指定Git应忽略的文件和目录。 |
| `README.md` | 项目主要说明文档，提供项目概述、功能和使用指南。 |
| `README.md.bak` | README文档的备份文件。 |
| `DIRECTORY_STRUCTURE.md` | 当前文件，详细说明项目目录结构。 |

### 3.2 web-app目录说明

#### 3.2.1 src目录

| 目录 | 说明 |
|------|------|
| `components/` | 包含所有React组件，分为通用组件、业务模块组件和UI基础组件三个子目录。在重构阶段二中，业务模块组件结构得到了完善，新增了处理(processing)、物流(logistics)和管理后台(admin)等模块目录；同时在UI基础组件中新增了标准化组件(Button, Card, Input, MobileNav, PageLayout)和响应式布局组件(FluidContainer, Row, Column)，建立了完整的移动端UI适配框架。每个组件使用独立目录组织，包含实现、样式和测试文件。 |
| `pages/` | 包含应用的页面级组件，按功能模块组织。每个页面组件整合多个小组件，实现完整业务功能。 |
| `hooks/` | 包含自定义React Hooks，封装可复用的逻辑，如表单处理、认证逻辑等。 |
| `utils/` | 包含通用工具函数，按功能分类（网络、存储、认证、通用、性能监控）。在重构阶段二中，对工具函数进行了完整的模块化改造，将`config-loader.js`迁移到`common/`目录，建立了统一的导出体系，每个子目录都有独立的`index.js`导出文件。提高了组织结构清晰度和代码复用性，同时确保向后兼容性。 |
| `services/` | 包含API服务，处理与后端的交互，按业务模块组织。每个服务封装特定领域的API调用逻辑。 |
| `store/` | 包含状态管理相关代码，按功能模块组织。负责管理应用全局状态，响应用户操作并更新UI。 |
| `styles/` | 包含全局样式和主题，包括变量、重置、排版和响应式样式等。在重构阶段二中，新增了响应式样式支持，确保应用视觉风格的一致性和跨设备适配能力。 |
| `types/` | 包含TypeScript类型定义，按业务领域组织。提供类型安全，提高代码可维护性。 |

#### 3.2.2 其他目录

| 目录 | 说明 |
|------|------|
| `public/` | 包含静态资源，如图片、图标、字体等。这些资源直接被部署到服务器，不经过打包处理。 |
| `tests/` | 包含测试文件，分为单元测试、集成测试和端到端测试。在重构阶段二中，新增了测试环境模拟(test-environment-mocks.js)，为性能监控和网络测试提供模拟环境。确保代码质量和功能正确性。 |
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

配置系统采用分层加载机制，通过 `src/utils/common/config-loader.js` 统一访问，可自动识别当前环境并合并相应配置。

在TASK-003中，原先位于项目根目录的配置文件（如babel.config.js、postcss.config.js、jest.config.js等）已全部迁移到对应的子目录中并删除原始文件，以实现更好的组织和管理。

 

---

**文档性质**: 当前目录结构说明  
**变更历史**: 请查看 [docs/directory-structure-changelog.md](docs/directory-structure-changelog.md)  
**最后更新**: 2025-05-21 