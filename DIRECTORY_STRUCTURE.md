# 食品溯源系统 - 详细目录结构说明

> **说明**: 本文档仅记录当前最新的目录结构。
>
> **变更历史**: 目录结构的变更历史请查看 [docs/directory-structure-changelog.md](docs/directory-structure-changelog.md)

## **当前项目状态** (2025-02-02更新)

### **开发工具链现代化状态**
- **Cursor Rules系统**: **生产就绪** (15个规则文件，100%格式合规，AAA+评级)
- **测试验证体系**: **高ROI优化完成** (4项优化完成，实用性显著提升)
- **文档管理**: **规范统一** (4层智能规则架构，10秒内定位相关规则)
- **开发效率**: **大幅提升** (AI辅助开发效率优化，规则执行自动化)
- **系统稳定性**: **优秀** (临时文件清理，文档一致性保障)

### **2025-02-02 - Cursor Rules系统现代化完成** - **开发工具链重大突破**
- **格式合规100%达成**: 15个主要规则文件 + 4个子模块规则完全合规
- **高ROI优化完成**: 测试验证体系4项核心优化，实用性显著提升
- **智能引用导航**: 4层规则架构，10秒内定位相关规则和指导
- **临时文件清理**: 4个临时报告文件清理，文档体系精简高效

### **开发工具链现代化成果验证**
```bash
# Cursor Rules系统状态
格式合规检查: PASS (15/15主要规则文件100%合规)
引用完整性: PASS (14/14引用链路有效)
架构层级: PASS (4层智能规则系统运行正常)

# 测试验证体系优化状态
命令参数透明度: PASS (关键参数说明完善)
Mock API验证: PASS (从3个扩展到7个验证标准)
规则互联优化: PASS (与核心开发原则强化链接)
基线管理: PASS (自动化基线提取指导完善)
```

### **当前可用功能**
- **Cursor Rules智能引用**: 4层规则架构，快速定位开发指导
- **格式合规验证**: 所有规则文件100%符合cursor-rules.mdc规范
- **测试验证体系**: 高ROI优化完成，Mock API增强验证
- **开发工作流程**: 统一规范管理，AI辅助开发效率提升
- **文档管理**: 智能引用导航，临时文件自动清理机制
- **规则执行**: 自动化规则应用，开发团队协作标准化

### **项目状态说明**
- `web-app/`: 原有系统 (稳定运行，84个页面待迁移，包含54个活跃脚本)
- `web-app-next/`: Phase-3现代化版本 (基础设施87.5%完成，核心功能100%完成，页面迁移0%完成)
- `.cursor/rules/`: Cursor规则系统 (100%格式合规，生产就绪，AAA+评级)
- `docs/`: 项目文档体系 (规范统一，变更历史完整记录)

### **web-app目录删除规划**
**删除条件**: 必须完成TASK-P3-020至P3-024 (84个页面完整迁移+业务功能验证)
**预计时间**: 2025年5月初 (约9周工期，41个工作日)
**风险控制**: 分阶段删除+完整备份+30天归档保留+快速回滚机制

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
│   │   ├── api-specification.md # 完整API接口规范(权威来源) [新增AI接口]
│   │   ├── ai-analytics.md    # AI数据分析API接口规范 [MVP核心] [新增]
│   │   ├── mock-api-guide.md  # Mock API完整使用指南 [更新AI接口]
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
│   │   ├── common/            # 通用验证工具
│   │   ├── reports/           # 验证报告
│   │   ├── scripts/           # 验证子脚本
│   │   ├── task-005/          # TASK-005验证
│   │   │   └── reports/       # 验证报告
│   │   ├── task-p2-001/       # TASK-P2-001移动端适配验证
│   │   │   └── reports/       # 验证报告
│   │   ├── task-p2-002/       # TASK-P2-002UI组件组织验证
│   │   │   └── reports/       # 验证报告
│   │   ├── task-p3-016a/      # TASK-P3-016A React Hook导出系统验证 [新增]
│   │   │   ├── comprehensive-validation.js  # 主验证脚本(5层验证架构) [完成]
│   │   │   ├── reports/       # 验证结果报告(JSON格式，时间戳命名) [完成]
│   │   │   │   ├── LATEST-VALIDATION-SUMMARY.md          # 最新验证摘要报告 [完成]
│   │   │   │   ├── comprehensive-regression-test-2025-01-15.md # 5层标准回归测试报告 [新增]
│   │   │   │   ├── validation-1748531196043.json        # 历史验证报告(JSON) [完成]
│   │   │   │   └── validation-1748531783539.json        # 历史验证报告(JSON) [完成]
│   │   │   └── scripts/       # 辅助验证脚本 [完成]
│   │   ├── task-api-docs-update/ # API文档更新任务验证 [新增]
│   │   │   ├── comprehensive-validation.js  # 文档完整性验证脚本 [新增]
│   │   │   └── reports/       # 验证报告目录 [新增]
│   │   ├── mobile-adaptation-validation.js    # 移动端适配验证
│   │   ├── performance-validation.js          # 性能验证
│   │   ├── accessibility-validation.js        # 可访问性验证
│   │   └── comprehensive-p2-validation.js     # Phase-2综合验证
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
│   ├── phase-3/               # 阶段三：技术栈现代化 (进行中 70-75%)
│   │   ├── PHASE-3-COMPREHENSIVE-PLAN.md    # Phase-3综合计划(合并规划、工作计划、问题分析等)
│   │   ├── PHASE-3-MASTER-STATUS.md         # Phase-3权威状态文档(单一信息源)
│   │   ├── PHASE-3-STATUS-UPDATE.md         # Phase-3状态更新记录
│   │   ├── REFACTOR-PHASE3-CHANGELOG.md     # Phase-3专门变更日志
│   │   ├── docs/              # 阶段三文档
│   │   │   ├── TECH-SELECTION.md            # 技术选型决策
│   │   │   ├── MIGRATION-STRATEGY.md        # 迁移策略
│   │   │   ├── COMPONENT-MIGRATION-GUIDE.md # 组件迁移指导
│   │   │   ├── technical-analysis.md        # 技术分析报告
│   │   │   ├── DEDUPLICATION-RESOLUTION.md  # 去重解决方案
│   │   │   ├── NEW-CONVERSATION-GUIDE.md    # 新对话指南
│   │   │   ├── 信息完整性验证报告.md          # 信息完整性验证
│   │   │   ├── 信息完整性基准.md             # 信息完整性基准
│   │   │   └── task-archives/               # 任务归档目录
│   │   ├── progress-reports/  # 进度报告
│   │   ├── review-notes/      # 评审记录
│   │   └── tasks/             # 任务文档 (26个任务文件) [新增Mock API重组任务]
│   │       ├── TASK_TEMPLATE.md                           # 任务模板
│   │       ├── TASK-P3-001_前端框架迁移评估与选型.md       # 技术选型任务(已完成)
│   │       ├── TASK-P3-002_构建工具现代化配置.md           # 构建工具现代化(已完成)
│   │       ├── TASK-P3-003_状态管理现代化.md               # 状态管理现代化(进行中)
│   │       ├── TASK-P3-007_组件库现代化迁移.md            # 组件库现代化(已完成100%)
│   │       ├── TASK-P3-007_布局组件验收报告.md            # 布局组件验收报告
│   │       ├── TASK-P3-007_MobileNav组件验收报告.md      # MobileNav组件验收报告
│   │       ├── TASK-P3-007_TouchGesture组件验收报告.md   # TouchGesture组件验收报告
│   │       ├── TASK-P3-013_主题系统现代化.md              # 主题系统现代化
│   │       ├── TASK-P3-014_Next.js项目标准化与配置完善.md # 项目标准化(已完成100%)
│   │       ├── TASK-P3-015_离线队列核心模块重建.md        # 离线队列核心模块重建
│   │       ├── TASK-P3-016_API客户端功能扩展.md           # API客户端功能扩展
│   │       ├── TASK-P3-016A-COMPLETION-REPORT.md         # TASK-P3-016A完成报告
│   │       ├── TASK-P3-016B_API客户端离线队列集成.md      # API客户端离线队列集成
│   │       ├── TASK-P3-017_状态管理集成扩展.md            # 状态管理集成扩展
│   │       ├── TASK-P3-017B_Mock_API统一架构设计.md       # Mock API统一架构设计 [新增]
│   │       ├── TASK-P3-018_兼容性验证与优化.md            # 兼容性验证与优化 [范围重新定义]
│   │       ├── TASK-P3-018B_中央Mock服务实现.md           # 中央Mock服务实现 [新增]
│   │       ├── TASK-P3-018C_UI_Hook层统一改造.md          # UI Hook层统一改造 [新增]
│   │       ├── TASK-P3-019_UI设计系统规范执行优化.md      # UI设计系统规范执行优化
│   │       ├── TASK-P3-020_静态页面现代化迁移.md          # 静态页面现代化迁移
│   │       ├── TASK-P3-020_静态页面现代化迁移架构设计.md  # 静态页面现代化迁移架构设计
│   │       ├── TASK-P3-021_P0核心页面迁移.md              # P0核心页面迁移
│   │       ├── TASK-P3-022_P1业务模块页面迁移.md          # P1业务模块页面迁移
│   │       ├── TASK-P3-023_P2管理页面迁移.md              # P2管理页面迁移
│   │       └── TASK-P3-024_现代化预览系统.md              # 现代化预览系统
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
│   └── rules/                 # Cursor规则文件目录 (100%格式合规，生产就绪)
│       ├── development-management-unified.mdc    # 主控规则(alwaysApply: true) [统一开发管理]
│       ├── refactor-management-unified.mdc       # 重构管理统一规则 [格式合规]
│       ├── test-validation-unified.mdc           # 测试验证统一规则 [高ROI优化完成]
│       ├── api-rules-usage-guide-manual.mdc      # API规则使用指南 [格式合规]
│       ├── task-management-manual.mdc            # 任务管理规范 [格式合规]
│       ├── cursor-rules.mdc                      # 规则格式规范文件 [格式合规]
│       ├── api-integration-agent.mdc             # API集成代理规则 [格式合规]
│       ├── api-interface-design-agent.mdc        # API接口设计规则 [格式合规]
│       ├── ui-design-system-auto.mdc             # UI设计系统规范 [格式合规]
│       ├── docs-reading-guide-agent.mdc          # 文档阅读指南规则 [格式合规]
│       ├── development-modules/               # 开发模块详细规则目录
│       │   ├── core-principles-detailed.mdc      # 详细核心开发原则 [格式合规]
│       │   ├── general-workflow-simplified.mdc   # 简化通用工作流程 [格式合规]
│       │   ├── project-management-detailed.mdc   # 详细项目管理规范 [格式合规]
│       │   └── workflow-procedures-detailed.mdc  # 详细工作流程规范 [格式合规]
│       └── backup-2025-02-02/             # 规则文件历史备份目录
├── .vscode/                   # VS Code配置
│   ├── settings.json          # 项目特定设置
│   ├── extensions.json        # 推荐扩展
│   └── launch.json            # 调试配置
├── .vscode/                  # VSCode配置(完成)
│   ├── settings.json         # 项目特定设置(TypeScript、格式化、Tailwind)
│   ├── extensions.json       # 推荐扩展(Prettier、ESLint、Tailwind等)
│   └── launch.json           # 调试配置(Next.js全栈调试)
├── .husky/                   # Git钩子配置(完成)
│   ├── pre-commit            # 提交前钩子(lint-staged)
│   └── commit-msg            # 提交消息钩子(预留commitlint)
├── tests/                    # 测试文件(完成)
│   ├── setup.ts              # 测试环境设置
│   └── unit/                 # 单元测试
│       ├── components/       # 组件测试
│       │   └── button.test.tsx # Button组件测试示例
│       └── hooks/            # Hook测试
│           └── useApi-comparison.test.tsx # useApi V1/V2功能一致性比较测试
├── public/                   # 静态资源
│   ├── assets/               # 资源文件
│   │   ├── icons/            # 图标文件
│   │   ├── images/           # 图片文件
│   │   └── media/            # 媒体文件
│   └── fonts/                # 字体文件
├── docs/                     # 项目文档
│   └── migration-guide-useApi-v2.md # useApi-v2迁移指南与API对照表
├── package.json              # 项目配置(完整脚本、lint-staged配置)(完成)
├── package-lock.json         # 依赖锁定
├── tsconfig.json             # TypeScript配置
├── tailwind.config.ts        # Tailwind CSS配置(TypeScript)(完成)
├── next.config.ts            # Next.js配置(完成)
├── jest.config.js            # Jest测试配置(完成)
├── .prettierrc               # Prettier配置(完成)
├── eslint.config.mjs         # ESLint配置
├── postcss.config.mjs        # PostCSS配置
├── env.example               # 环境变量示例
├── .gitignore                # Git忽略文件
├── README.md                 # 项目说明
└── vercel.json               # Vercel部署配置
└── DIRECTORY_STRUCTURE.md     # 目录结构详细说明（本文件）
```

## 2. web-app-next目录结构 (Phase-3现代化技术栈)

```
web-app-next/
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── ai-demo/           # AI演示页面
│   │   │   └── page.tsx       # AI数据分析演示页面(完整AI功能展示)
│   │   ├── api/               # API路由 (48个端点，100%覆盖业务模块)
│   │   │   ├── auth/          # 认证API路由 (5个端点)
│   │   │   │   ├── login/     # 登录API
│   │   │   │   ├── logout/    # 登出API
│   │   │   │   ├── status/    # 状态检查API
│   │   │   │   └── verify/    # 验证API
│   │   │   ├── farming/       # 农业模块API路由 (完整重新生成+ESLint修复+回归测试通过)
│   │   │   │   ├── route.ts   # 主农业API端点
│   │   │   │   ├── crops/     # 作物管理
│   │   │   │   │   └── route.ts # 作物API端点
│   │   │   │   ├── fields/    # 农田管理
│   │   │   │   │   └── route.ts # 农田API端点
│   │   │   │   ├── planting-plans/ # 种植计划
│   │   │   │   │   └── route.ts # 种植计划API端点
│   │   │   │   ├── farm-activities/ # 农业活动
│   │   │   │   │   └── route.ts # 农业活动API端点
│   │   │   │   └── harvest-records/ # 收获记录
│   │   │   │       └── route.ts # 收获记录API端点
│   │   │   ├── processing/    # 加工模块API路由 (12个端点)
│   │   │   ├── logistics/     # 物流模块API路由 (12个端点)
│   │   │   ├── admin/         # 管理模块API路由 (12个端点)
│   │   │   ├── products/      # 产品API路由
│   │   │   ├── trace/         # 溯源API路由
│   │   │   │   └── [id]/      # 动态ID路由
│   │   │   │       └── verify/ # 验证子路由
│   │   │   └── users/         # 用户API路由
│   │   │       └── profile/   # 用户资料API
│   │   ├── components/        # 组件演示页面
│   │   │   └── page.tsx       # 组件展示页面(含Badge、StatCard、布局组件等)
│   │   ├── demo/              # 功能演示页面
│   │   │   └── page.tsx       # 功能演示页面(代码分割和懒加载演示)
│   │   ├── globals.css        # 全局样式
│   │   ├── layout.tsx         # 根布局
│   │   ├── page.tsx           # 首页
│   │   ├── providers.tsx      # 全局Provider配置
│   │   └── favicon.ico        # 网站图标
│   ├── components/            # 组件库
│   │   ├── ui/                # 基础UI组件(TypeScript现代化版本 - 21个组件完成)
│   │   │   ├── advanced-table.tsx     # AdvancedTable高级表格组件(完成)
│   │   │   ├── ai-performance-monitor.tsx # AI性能监控面板(完成)
│   │   │   ├── badge.tsx              # Badge徽章组件系列(完成)
│   │   │   ├── button.tsx             # Button按钮组件(完成)
│   │   │   ├── card.tsx               # Card卡片组件(完成)
│   │   │   ├── column.tsx             # Column列布局组件(完成)
│   │   │   ├── dynamic-loader.tsx     # DynamicLoader动态加载组件(完成)
│   │   │   ├── fluid-container.tsx    # FluidContainer流式容器组件(完成)
│   │   │   ├── input.tsx              # Input输入框组件(完成)
│   │   │   ├── loading.tsx            # Loading加载组件(完成)
│   │   │   ├── mobile-nav.tsx         # MobileNav移动端导航组件(完成)
│   │   │   ├── mobile-search.tsx      # MobileSearch移动搜索组件(完成)
│   │   │   ├── modal.tsx              # Modal模态框组件(完成)
│   │   │   ├── page-layout.tsx        # PageLayout页面布局组件(完成)
│   │   │   ├── row.tsx                # Row行布局组件(完成)
│   │   │   ├── select.tsx             # Select选择器组件(完成)
│   │   │   ├── stat-card.tsx          # StatCard统计卡片组件(完成)
│   │   │   ├── table.tsx              # Table表格组件(完成)
│   │   │   ├── textarea.tsx           # Textarea文本域组件(完成)
│   │   │   ├── touch-gesture.tsx      # TouchGesture触摸手势组件(完成)
│   │   │   └── index.ts               # 组件导出索引
│   │   ├── collaboration/     # 协作功能组件
│   │   │   └── CollaborativeEditor.tsx # 协作编辑器组件
│   │   ├── common/            # 通用组件(预留)
│   │   └── modules/           # 业务模块组件(预留)
│   ├── config/                # 应用配置模块(新增)
│   │   ├── app.ts             # 应用基础配置(环境变量、API、功能开关)
│   │   ├── constants.ts       # 应用常量定义(API端点、路由、业务常量)
│   │   └── index.ts           # 配置模块导出索引
│   ├── lib/                   # 工具库与核心功能 (12个核心模块完成)
│   │   ├── ai-batch-controller.ts  # AI批量数据处理控制器(完成)
│   │   ├── ai-cache-manager.ts     # AI智能缓存管理器(完成)
│   │   ├── ai-error-handler.ts     # AI错误处理器(完成)
│   │   ├── ai-service.ts           # AI服务集成(完成)
│   │   ├── api-client.ts           # API客户端封装(完成)
│   │   ├── api.ts                  # 增强API客户端(29个MVP端点)(完成)
│   │   ├── constants.ts            # 常量定义(完成)
│   │   ├── logger.ts               # 日志工具(完成)
│   │   ├── queryClient.ts          # 查询客户端配置(完成)
│   │   ├── storage-adapter.ts      # 存储适配器(完成)
│   │   ├── utils.ts                # 工具函数库(完成)
│   │   └── websocket.ts            # WebSocket工具(完成)
│   ├── store/                 # 状态管理(Zustand + TypeScript 现代化 - 准备方案A架构调整)
│   │   ├── appStore.ts        # 全局应用状态管理(准备恢复离线队列集成 - 方案A)
│   │   ├── auth.ts            # 原有认证状态管理(简化版本，保留兼容性)
│   │   ├── authStore.ts       # 认证状态管理(企业级完整版本：登录、权限、令牌管理等)
│   │   ├── userStore.ts       # 用户偏好设置管理(仪表板、表格、显示设置等)
│   │   └── dashboardStore.ts  # 仪表板状态管理(新增)
│   ├── types/                 # TypeScript类型定义(完善)
│   │   ├── state.ts           # 状态管理类型定义(306行完整业务类型体系)
│   │   ├── offline.ts         # 离线队列相关类型定义(完整的TypeScript类型系统)
│   │   └── index.ts           # 全局类型定义
│   ├── hooks/                 # 自定义Hooks (4个Hook模块完成)
│   │   ├── useApi.ts          # API客户端Hook(原版本，@deprecated标记)(完成)
│   │   ├── useApi-simple.ts   # MVP API Hook系统(422行，简化版本)(完成)
│   │   ├── useAiDataFetch.ts  # AI数据获取专用Hook(648行，AI数据分析)(完成)
│   │   └── index.ts           # Hooks导出索引(完成)
│   ├── services/              # API服务层(新增)
│   │   └── index.ts           # 服务导出索引
│   ├── utils/                 # 工具函数(新增)
│   │   └── index.ts           # 工具函数导出索引
│   └── styles/                # 样式文件
│       ├── globals/           # 全局样式
│       │   ├── reset.css      # CSS重置
│       │   └── variables.css  # CSS变量
│       └── utilities/         # 工具类样式
│           └── animations.css # 动画样式
├── tests/                     # 测试文件(新增)
│   ├── setup.ts              # 测试环境设置
│   └── unit/                 # 单元测试
│       ├── components/       # 组件测试
│       │   └── button.test.tsx # Button组件测试示例
│       └── hooks/            # Hook测试 [新增]
│           └── useApi-comparison.test.tsx # useApi V1/V2功能一致性比较测试 [新增]
├── public/                    # 静态资源
│   ├── assets/               # 资源文件
│   │   ├── icons/            # 图标文件
│   │   ├── images/           # 图片文件
│   │   └── media/            # 媒体文件
│   └── fonts/                # 字体文件
├── .vscode/                  # VSCode配置(新增)
│   ├── settings.json         # 项目特定设置(TypeScript、格式化、Tailwind)
│   ├── extensions.json       # 推荐扩展(Prettier、ESLint、Tailwind等)
│   └── launch.json           # 调试配置(Next.js全栈调试)
├── .husky/                   # Git钩子配置(新增)
│   ├── pre-commit            # 提交前钩子(lint-staged)
│   └── commit-msg            # 提交消息钩子(预留commitlint)
├── .next/                    # Next.js构建输出
├── node_modules/             # 依赖包
├── package.json              # 项目配置(完善 - 完整脚本、lint-staged配置、Mock数据生成@faker-js/faker)
├── package-lock.json         # 依赖锁定
├── tsconfig.json             # TypeScript配置
├── tailwind.config.ts        # Tailwind CSS配置(TypeScript)
├── next.config.ts            # Next.js配置
├── jest.config.js            # Jest测试配置(新增)
├── .prettierrc               # Prettier配置(新增)
├── eslint.config.mjs         # ESLint配置
├── postcss.config.mjs        # PostCSS配置
├── env.example               # 环境变量示例
├── .gitignore                # Git忽略文件
└── README.md                 # 项目说明
```

## 3. web-app目录结构 (Phase-2传统技术栈)

```
web-app/
├── implementation-plan.md    # Web应用功能开发实施计划
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
│   ├── mocks/                 # Mock API服务系统 (Phase-3重组完成，Day 4实施完成)
│   │   ├── config/            # Mock环境配置
│   │   │   ├── environments.ts # 环境控制(dev/test/prod)
│   │   │   └── msw-config.ts  # MSW配置管理
│   │   ├── data/              # Mock数据层 (47个API端点完整覆盖)
│   │   │   ├── auth-data.ts   # 认证数据(JWT/权限/会话管理)
│   │   │   ├── users-data.ts  # 用户数据(20个预设用户/CRUD)
│   │   │   ├── farming-data.ts # 农业数据(15农田/12作物/25计划)
│   │   │   ├── processing-data.ts # 加工数据(15批次/20检测/12成品)
│   │   │   ├── logistics-data.ts # 物流数据(仓库/车辆/司机/订单)
│   │   │   ├── admin-data.ts  # 管理数据(配置/角色/权限/监控)
│   │   │   └── version-manager.ts # 版本管理器(Schema验证/数据迁移)
│   │   ├── handlers/          # MSW请求处理器 (50个handlers)
│   │   │   ├── auth.ts        # 认证处理器(5个endpoints)
│   │   │   ├── users.ts       # 用户处理器(8个endpoints)
│   │   │   ├── farming.ts     # 农业处理器(8个endpoints)
│   │   │   ├── processing.ts  # 加工处理器(8个endpoints)
│   │   │   ├── logistics.ts   # 物流处理器(9个endpoints)
│   │   │   ├── admin.ts       # 管理处理器(8个endpoints)
│   │   │   ├── trace.ts       # 溯源处理器(1个endpoint)
│   │   │   └── index.ts       # 处理器导出索引
│   │   ├── browser.ts         # 浏览器端MSW Worker
│   │   ├── node-server.ts     # Node端MSW服务器
│   │   └── mock-dev-tools.ts  # Mock开发工具(Handler统计/状态检查)
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
├── pages/                     # 页面文件目录 (26个核心静态页面 + 预览系统)
│   ├── index.html             # 页面预览系统 - 使用iframe展示所有页面的主展示页面
│   ├── product-trace.html     # 产品溯源查询主页 (740行, 21KB)
│   ├── coming-soon.html       # 即将上线页面 (125行, 6KB)
│   ├── _template.html         # 页面模板 (82行, 2.9KB)
│   ├── admin/                 # 管理后台页面 (6个页面)
│   │   ├── assets/            # 管理后台资源
│   │   ├── auth/              # 认证相关页面
│   │   │   └── login.html     # 管理员登录页面
│   │   ├── admin-dashboard.html # 管理员控制台
│   │   ├── data-import.html   # 数据导入页面
│   │   ├── user-management.html # 用户管理页面
│   │   ├── system-logs.html   # 系统日志页面
│   │   ├── template.html      # 模板配置器
│   │   ├── components/        # 管理后台组件
│   │   └── errors/            # 错误页面
│   ├── assets/                # 页面资源
│   │   ├── css/               # 页面CSS
│   │   └── icons/             # 页面图标
│   ├── auth/                  # 认证页面 (1个页面)
│   │   └── login.html         # 用户登录页面 (705行, 26KB)
│   ├── demo/                  # 演示页面
│   ├── errors/                # 错误页面
│   ├── farming/               # 农业页面 (5个页面)
│   │   ├── create-trace.html  # 创建溯源记录
│   │   ├── farming-vaccine.html # 疫苗录入
│   │   ├── farming-breeding.html # 繁育信息管理
│   │   ├── farming-monitor.html # 场地视频监控
│   │   └── assets/            # 农业页面资源
│   │       └── images/        # 农业页面图片
│   ├── home/                  # 首页模块 (4个页面)
│   │   ├── home-selector.html # 功能模块选择器 (883行, 34KB)
│   │   ├── home-farming.html  # 养殖管理首页
│   │   ├── home-processing.html # 生产加工首页
│   │   └── home-logistics.html # 销售物流首页
│   ├── logistics/             # 物流页面
│   ├── page-assets/           # 页面资源
│   │   └── icons/             # 页面图标
│   ├── pages/                 # 页面子目录
│   │   └── errors/            # 错误页面
│   ├── processing/            # 加工页面 (3个页面)
│   │   ├── processing-reports.html # 质检报告查询
│   │   ├── processing-quality.html # 肉质等级评定
│   │   ├── processing-photos.html # 加工拍照
│   │   └── assets/            # 加工页面资源
│   ├── profile/               # 用户资料页面 (3个页面)
│   │   ├── profile.html       # 个人中心
│   │   ├── settings.html      # 系统设置
│   │   └── help-center.html   # 帮助中心
│   └── trace/                 # 溯源页面 (6个页面)
│       ├── trace-query.html   # 溯源查询 (523行, 25KB)
│       ├── trace-detail.html  # 溯源详情页 (572行, 34KB)
│       ├── trace-list.html    # 溯源列表 (470行, 22KB)
│       ├── trace-certificate.html # 溯源证书 (343行, 15KB)
│   │   ├── trace-edit.html    # 溯源记录编辑 (229行, 12KB)
│   │   └── trace-map.html     # 地图展示 (310行, 15KB)
│   ├── components/                # 组件目录
│   │   ├── auth/                  # 认证组件
│   │   ├── data/                  # 数据组件
│   │   ├── documentation/         # 文档组件
│   │   ├── modules/               # 模块组件
│   │   │   ├── auth/              # 认证模块
│   │   │   ├── data/              # 数据模块
│   │   │   ├── store/             # 存储模块
│   │   │   ├── trace/             # 溯源模块
│   │   │   ├── ui/                # UI模块
│   │   │   ├── utils/             # 工具模块
│   │   │   └── web-app/           # Web应用模块
│   │   │   └── test-pages/    # 测试页面
│   │   ├── store/                 # 存储组件
│   │   ├── ui/                    # UI组件
│   │   ├── utils/                 # 工具组件
│   │   └── validation/            # 验证组件
│   │       └── screenshots/       # 验证截图
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

## 文档更新记录

### 2025-01-15 更新

#### Phase-3文档comprehensive更新 (基于API Client回归问题)
- **PHASE-3-MASTER-STATUS.md**: 添加API Client回归风险记录，调整完成度45-50%
- **PHASE-3-EMERGENCY-ASSESSMENT.md**: 新增回归问题分析章节，详细记录13个测试失败
- **PHASE-3-PLANNING.md**: 更新任务状态，反映API Client回归修复需求
- **PHASE-3-WORK-PLAN.md**: 添加API Client回归修复阶段，调整工作重点
- **PHASE-3-PROBLEM-ANALYSIS.md**: 深度分析回归根因，制定修复策略
- **REFACTOR-PHASE3-CHANGELOG.md**: 记录完整的回归发现和修复规划过程
- **TASK-P3-016A-标准化工作清单.md**: 添加回归问题修正说明
- **PHASE-3-ARCHITECTURE-RESTORATION-PLAN-A.md**: 更新最新状态和修复重点
- **PHASE-3-STATUS-UPDATE.md**: 调整状态概览，反映回归影响
- **TASK-P3-016A-真实状态追踪.md**: 记录回归问题发现和修复方案

**更新依据**: 按照@project-management-auto.mdc规则，确保项目状态文档与真实技术状态同步
**更新重点**: 反映用户代码修复引发的API Client回归问题，保持文档透明度和准确性

---

**文档性质**: 当前目录结构说明
**变更历史**: 请查看 [docs/directory-structure-changelog.md](docs/directory-structure-changelog.md)
**最后更新**: 2025-02-02 (已更新Cursor Rules系统现代化完成状态)
