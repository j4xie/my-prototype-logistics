# 食品溯源系统 - 目录结构说明

> **文档版本**: v4.6 (2025-02-02)
> **最后更新**: TASK-P3-024 Stage 4 Flow模式详细增强完成 - 解决用户反馈"没有细节展示"问题，实现沉浸式业务流程体验
> **变更历史**: 目录结构的变更历史请查看 [docs/directory-structure-changelog.md](docs/directory-structure-changelog.md)

## 🎯 目录结构概览

本项目采用模块化的目录组织方式，包含两个主要的Web应用版本（旧版和Next.js版）以及完整的文档、重构管理和工具脚本体系。

### 📁 根目录结构

```
.
├── .cursor/                      # Cursor IDE配置目录
│   └── rules/                   # Cursor Rules规则文件系统
├── .github/                      # GitHub配置
│   └── workflows/               # GitHub Actions工作流程
├── .husky/                       # Git hooks配置
├── .vscode/                      # VS Code配置
├── backup-encoding-damaged-20250602-0335/  # 编码损坏备份目录
├── docs/                         # 📚 项目文档中心
├── refactor/                     # 🔄 重构文档与计划
├── reports/                      # 📊 项目报告中心
├── scripts/                      # 🛠️ 工具脚本集合
├── src/                          # 项目根级源代码
│   ├── app/                     # 应用模块
│   ├── hooks/                   # React Hooks
│   └── lib/                     # 工具库
├── tests/                        # 项目根级测试文件
│   └── unit/                    # 单元测试
├── web-app/                      # 🕰️ 旧版Web应用 (保留备用)
├── web-app-next/                 # 🚀 当前主要Web应用 (Next.js)
├── webback-20250602-0351/        # Web应用备份目录
├── webback-20250602-0357/        # Web应用备份目录
├── .gitignore                    # Git忽略配置
├── DIRECTORY_STRUCTURE.md        # 📋 本文档
├── README.md                     # 项目主说明文档
├── backend-architecture-design.md  # 后端架构设计文档
├── current_directory_structure.txt # 当前目录结构快照
├── current_directory_tree.txt    # 当前目录树快照
├── fix_encoding.ps1              # 编码修复脚本
├── package-lock.json             # NPM依赖锁定文件
├── package.json                  # 项目配置文件
├── vercel.json                   # Vercel部署配置
└── workspace.json                # 工作区配置
```

## 🗂️ 核心目录详细说明

### 1. ⚙️ .cursor/ - Cursor IDE配置

Cursor IDE的配置和规则管理系统：

```
.cursor/
└── rules/                       # Cursor Rules规则文件系统
    ├── development-modules/     # 开发模块规则
    ├── backup-2025-02-02/      # 规则备份
    ├── api-integration-agent.mdc         # API集成规则
    ├── api-interface-design-agent.mdc    # API接口设计规则
    ├── api-rules-usage-guide-manual.mdc  # API规则使用指南
    ├── cursor-rules.mdc                  # Cursor规则规范
    ├── development-management-unified.mdc # 统一开发管理规则
    ├── docs-reading-guide-agent.mdc      # 文档阅读指南
    ├── refactor-management-unified.mdc   # 统一重构管理规则
    ├── refactor-phase3-agent.mdc         # Phase-3重构规则
    ├── test-validation-unified.mdc       # 统一测试验证规则
    └── ui-design-system-auto.mdc         # UI设计系统规则
```

### 2. 🐙 .github/ - GitHub配置

GitHub相关配置和自动化：

```
.github/
└── workflows/                   # GitHub Actions工作流程
    └── ci.yml                  # 持续集成配置
```

### 3. 📚 docs/ - 文档中心

统一的项目文档管理中心，按功能模块组织：

```
docs/
├── api/                         # API文档集合
│   ├── archive/                # API文档归档
│   │   ├── admin.md           # 管理模块API文档
│   │   ├── authentication.md  # 认证API文档
│   │   ├── farming.md         # 农业模块API文档
│   │   ├── logistics.md       # 物流模块API文档
│   │   ├── mock-api-status.md # Mock API状态文档
│   │   ├── overview.md        # API概览归档
│   │   ├── processing.md      # 加工模块API文档
│   │   ├── profile.md         # 用户中心API文档
│   │   └── trace.md           # 溯源API文档
│   ├── .version-baseline      # 版本基线文件
│   ├── ai-analytics.md        # AI数据分析API规范
│   ├── api-specification.md   # 完整API接口规范
│   ├── async-api.yaml         # 异步API规范
│   ├── authentication.md      # 认证API主文档
│   ├── data-models.md         # 数据模型文档
│   ├── mock-api-guide.md      # Mock API指南
│   ├── openapi.yaml           # OpenAPI规范文件
│   ├── README.md              # API文档说明
│   ├── schema-version-management.md  # Schema版本管理
│   └── trace.md               # 溯源API文档
├── architecture/                # 系统架构文档
│   ├── adr-001-mock-api-architecture.md  # ADR-001: Mock API架构决策
│   ├── design-principles.md     # 架构设计原则
│   ├── mock-api-architecture.md # Mock API架构文档 [重要]
│   ├── overview.md             # 系统架构概览
│   └── technologies.md         # 技术栈说明
├── archive/                     # 归档文档
│   └── resource-loader-implementation-plan.mdc
├── components/                  # 组件文档
│   ├── common/                 # 通用组件文档
│   ├── modules/                # 业务模块组件文档
│   └── overview.md             # 组件概览
├── guides/                      # 开发指南
│   ├── configuration.md        # 配置指南
│   └── getting-started.md      # 快速开始指南
├── merged-docs-archive/         # 文档合并归档
├── prd/                         # 产品需求文档
│   └── food-traceability-system-prd.md
├── processing/                  # 生产加工模块数据结构文档 [新增]
│   ├── templates/              # 行业模板示例
│   ├── erDiagram.mmd           # ER关系图
│   ├── field-definitions.csv   # 字段定义表
│   ├── README-vscode-guide.md  # VS Code使用指南
│   ├── template-schema.json    # 模板Schema定义
│   ├── workflow-config.yaml    # 工作流配置
│   └── 生产加工模块数据结构说明.md # 主要说明文档
├── project-management/          # 项目管理文档
│   ├── documentation-deduplication-implementation.md
│   ├── documentation-deduplication-rule.md
│   └── evolution-roadmap.md
├── backup-system-guide.md       # 备份系统指南
├── directory-structure-changelog.md     # 目录结构变更日志
├── directory-structure-changelog-backup.md  # 目录结构变更日志备份
├── directory-structure-changelog-fixed.md   # 目录结构变更日志修复版
├── directory-structure-management-improvement.md  # 目录结构管理改进
├── encoding-prevention-guide.md         # 编码问题预防指南
└── 生产加工模块数据结构说明.md         # 生产加工模块数据结构说明
```

### 4. 🔄 refactor/ - 重构管理中心

重构工作的统一管理和文档中心：

```
refactor/
├── archive/                     # 已完成阶段归档
│   ├── phase-1/                # 阶段一：结构清理与统一 (已完成)
│   └── phase-2/                # 阶段二：代码优化与模块化 (已完成)
├── assets/                      # 重构相关资源文件
│   ├── CHECKLIST_TEMPLATE.md   # 检查清单模板
│   ├── DECISION_TEMPLATE.md    # 决策记录模板
│   └── DECISION-001_目录结构重组策略.md
├── docs/                        # 重构指导文档
│   ├── mobile-ui-best-practices.md
│   ├── 文档更新计划.md
│   └── 目录结构分析.md
├── phase-3/                     # 阶段三：技术栈现代化 [进行中]
│   ├── docs/                   # 阶段三专项文档
│   ├── progress-reports/       # 进度报告
│   ├── review-notes/           # 评审记录
│   ├── tasks/                  # 任务文档 (TASK-P3-001至TASK-P3-026)
│   ├── PHASE-3-COMPREHENSIVE-PLAN.md     # 综合计划文档
│   ├── PHASE-3-MASTER-STATUS.md          # 主状态文档
│   ├── REFACTOR-PHASE3-CHANGELOG.md      # 变更日志
│   └── Phase-3 Mock API统一架构重构与任务依赖重组 - 完整插入方案.md
├── phase-4/                     # 阶段四：性能与安全优化 [规划中]
│   ├── progress-reports/       # 进度报告
│   ├── review-notes/           # 评审记录
│   ├── tasks/                  # 任务文档
│   └── PHASE-4-WORK-PLAN.md    # 工作计划
├── README.md                    # 重构说明文档
└── REFACTOR_LOG.md              # 重构日志记录
```

### 5. 📊 reports/ - 项目报告中心

项目测试和性能报告：

```
reports/
├── coverage/                    # 测试覆盖率报告
│   └── summary.json
├── device-performance-report.html  # 设备性能报告
├── device-performance.json         # 设备性能数据
└── loader-performance-report.json  # 加载器性能报告
```

### 6. 🛠️ scripts/ - 工具脚本集合

开发、部署、验证等工具脚本的统一管理：

```
scripts/
├── api-generator/               # API生成工具
│   ├── mock-data/              # Mock数据
│   └── generate-api.js         # API生成脚本
├── build/                       # 构建脚本
├── data/                        # 数据脚本
├── deploy/                      # 部署脚本
├── deployment/                  # 部署配置
│   ├── api-switch.sh           # API环境切换脚本
│   └── README.md               # 部署工具说明
├── dev/                         # 开发工具
│   ├── debug/                  # 调试脚本
│   ├── git/                    # Git工具脚本
│   │   ├── tools/              # Git工具集
│   │   │   ├── git-tools.bat   # Git工具批处理脚本
│   │   │   ├── git-tools.ps1   # Git工具PowerShell脚本
│   │   │   ├── git-tools.sh    # Git工具Shell脚本
│   │   │   └── README.md       # Git工具说明
│   │   ├── gitpull.bat         # Git拉取脚本
│   │   ├── gitpush.bat         # Git推送脚本
│   │   ├── gitpush.ps1         # Git推送PowerShell脚本
│   │   ├── QUICK-START.md      # Git快速开始指南
│   │   ├── README-gitpush.md   # Git推送说明
│   │   ├── setup-gitpush-alias.ps1      # 设置Git推送别名
│   │   ├── setup-gitpush-simple.ps1     # 简单Git推送设置
│   │   └── setup-git-scripts.ps1        # Git脚本设置
│   ├── run-test.bat            # 测试运行脚本 (Windows)
│   ├── run-test.ps1            # 测试运行脚本 (PowerShell)
│   ├── run-tests.bat           # 批量测试脚本
│   ├── setup-debug-tools.ps1   # 调试工具设置
│   ├── start-app.bat           # 应用启动脚本 (Windows)
│   └── start-app.ps1           # 应用启动脚本 (PowerShell)
├── utils/                       # 通用工具脚本
│   ├── button-fixes/           # 按钮修复脚本
│   │   ├── fix-button-navigation.js    # 修复按钮导航
│   │   ├── fix-page-transitions.js     # 修复页面转换
│   │   ├── fix-specific-buttons.js     # 修复特定按钮
│   │   └── test-button-navigation.js   # 测试按钮导航
│   ├── modules/                # 模块工具
│   │   ├── check-module-consistency.js   # 检查模块一致性
│   │   ├── convert-module-format.js      # 转换模块格式
│   │   ├── convert-to-commonjs.js        # 转换为CommonJS
│   │   ├── find-mixed-module-files.js    # 查找混合模块文件
│   │   └── fix-mixed-module-files.js     # 修复混合模块文件
│   ├── resource-fixes/         # 资源修复脚本
│   │   ├── fix-resources.js            # 修复资源
│   │   └── fix-specific-resources.js   # 修复特定资源
│   ├── check-encoding.js       # 编码检查脚本
│   ├── check-progress-ticks.js # 进度检查脚本
│   ├── Create-ProjectBackup.ps1 # 项目备份脚本
│   ├── encoding-checker.ps1    # 编码检查器
│   ├── fix-button-navigation.js # 修复按钮导航(根级)
│   ├── fix-resource-paths.js   # 修复资源路径
│   ├── memory-stress-test.js   # 内存压力测试
│   ├── Setup-DailyBackup.ps1   # 设置每日备份
│   ├── setup-powershell-encoding.ps1  # 设置PowerShell编码
│   └── simple-encoding-check.ps1       # 简单编码检查
├── validation/                  # 验证脚本 [已大幅优化]
│   ├── common/                 # 通用验证工具
│   ├── reports/                # 验证报告 (保留最新)
│   ├── scripts/                # 验证子脚本
│   ├── task-005/               # 特定任务验证
│   ├── task-api-docs-update/   # API文档更新验证
│   ├── task-p2-001/            # Phase-2任务验证
│   ├── task-p2-002/            # Phase-2任务验证
│   ├── task-p3-016a/           # Phase-3任务验证
│   ├── task-p3-016b/           # Phase-3任务验证
│   ├── task-p3-019a/           # Phase-3任务验证
│   ├── task-p3-020/            # Phase-3任务验证
│   ├── task-p3-025/            # Phase-3任务验证
│   ├── enhanced-regression-test-main.js  # 增强回归测试主脚本
│   ├── enhanced-regression-test.js       # 增强回归测试脚本
│   └── farming-module-100-complete.md    # 农业模块完成度验证
├── README.md                    # 脚本使用说明
└── SCRIPT_INVENTORY.md          # 脚本清单
```

### 7. 💻 src/ - 项目根级源代码

项目根级的源代码目录：

```
src/
├── app/                         # 应用模块
│   ├── admin/                  # 管理模块
│   ├── processing/             # 加工模块
│   └── profile/                # 用户模块
├── hooks/                       # React Hooks
│   ├── useApi-v2.ts           # API Hook v2版本
│   └── useApi.ts              # API Hook
└── lib/                         # 工具库
```

### 8. 🧪 tests/ - 项目根级测试文件

项目根级的测试文件目录：

```
tests/
└── unit/                        # 单元测试
    └── hooks/                  # Hook测试
```

### 9. 🕰️ web-app/ - 旧版Web应用 (保留备用)

基于传统技术栈的Web应用（保留用于兼容性和备份）：

```
web-app/
├── .husky/                      # Git hooks配置
├── assets/                      # 静态资源
│   ├── components/             # 组件资源
│   ├── css/                    # 样式文件
│   ├── icons/                  # 图标资源
│   ├── images/                 # 图片资源
│   ├── monitoring/             # 监控资源
│   └── styles/                 # 样式表
├── components/                  # 组件库
│   ├── auth/                   # 认证组件
│   ├── data/                   # 数据组件
│   ├── documentation/          # 文档组件
│   ├── modules/                # 业务模块组件
│   ├── store/                  # 状态管理组件
│   ├── ui/                     # UI组件
│   ├── utils/                  # 工具组件
│   ├── validation/             # 验证组件
│   ├── autoload-button-upgrade.js  # 按钮自动升级
│   ├── browser-compatibility.js    # 浏览器兼容性
│   └── offline-support.js          # 离线支持
├── config/                      # 配置文件
│   ├── app/                    # 应用配置
│   ├── build/                  # 构建配置
│   ├── default/                # 默认配置
│   ├── deploy/                 # 部署配置
│   ├── environments/           # 环境配置
│   ├── server/                 # 服务器配置
│   ├── test/                   # 测试配置
│   ├── assets.js               # 资源配置
│   ├── create-workspace.js     # 工作区创建
│   └── debug-config.json       # 调试配置
├── coverage/                    # 测试覆盖率
├── dist/                        # 构建输出
├── docs/                        # 文档
├── js/                          # JavaScript文件
├── pages/                       # 页面文件
│   ├── admin/                  # 管理页面
│   ├── assets/                 # 页面资源
│   ├── auth/                   # 认证页面
│   ├── demo/                   # 演示页面
│   ├── errors/                 # 错误页面
│   ├── farming/                # 农业页面
│   ├── home/                   # 首页
│   ├── logistics/              # 物流页面
│   ├── page-assets/            # 页面资源
│   ├── pages/                  # 页面集合
│   ├── processing/             # 加工页面
│   ├── profile/                # 用户页面
│   ├── trace/                  # 溯源页面
│   ├── _template.html          # 页面模板
│   ├── coming-soon.html        # 即将推出页面
│   └── product-trace.html      # 产品溯源页面
├── public/                      # 公共资源
├── screenshots/                 # 截图文件
├── src/                         # 源代码
│   ├── auth/                   # 认证模块
│   ├── compatibility/          # 兼容性模块
│   ├── components/             # 组件
│   ├── config/                 # 配置
│   ├── examples/               # 示例
│   ├── hooks/                  # Hooks
│   ├── network/                # 网络模块
│   ├── pages/                  # 页面组件
│   ├── performance-tracking/   # 性能跟踪
│   ├── security/               # 安全模块
│   ├── services/               # 服务层
│   ├── storage/                # 存储模块
│   ├── store/                  # 状态管理
│   ├── styles/                 # 样式模块
│   ├── tools/                  # 工具模块
│   ├── types/                  # 类型定义
│   ├── utils/                  # 工具函数
│   ├── index.js                # 入口文件
│   └── trace-main.js           # 溯源主文件
├── static/                      # 静态文件
├── styles/                      # 样式文件
├── tests/                       # 测试文件
├── web-app/                     # 子应用
├── api-router.js                # API路由
├── coming-soon.html             # 即将推出页面
└── implementation-plan.md       # 实施计划
```

### 10. 🚀 web-app-next/ - 当前主要Web应用 (Next.js)

基于Next.js的现代化Web应用，包含完整的页面、API路由、组件和测试体系：

```
web-app-next/
├── .husky/                      # Git hooks配置
│   ├── commit-msg              # 提交信息钩子
│   └── pre-commit              # 提交前钩子
├── .vscode/                     # VS Code配置
│   ├── extensions.json         # 推荐扩展
│   ├── launch.json             # 调试配置
│   └── settings.json           # 编辑器设置
├── docs/                        # 应用专属文档
│   ├── fixes/                  # 修复文档
│   │   └── TASK-P3-018B-PATCH-CONTRACT-FIX.md
│   ├── migration/              # 迁移文档
│   │   └── day6-configuration-cleanup.md
│   ├── api-integration-guide.md      # API集成指南
│   └── backend-integration-checklist.md # 后端集成检查清单
├── public/                      # 静态资源
│   └── mockServiceWorker.js    # MSW服务工作者
├── scripts/                     # 应用专用脚本
│   ├── dev/                    # 开发脚本
│   │   ├── data-migration-scanner.ts    # 数据迁移扫描器
│   │   ├── environment-adapter.ts       # 环境适配器
│   │   ├── fix-migrated-routes.ts       # 路由修复脚本
│   │   ├── migrate-api-routes.ts        # API路由迁移
│   │   └── mock-dev-tools.ts            # Mock开发工具
│   ├── migration-backups/      # 迁移备份 (27个route备份文件)
│   ├── reports/                # 报告文件
│   │   ├── ui-compliance-2025-06-14T04-27-58.json
│   │   └── ui-compliance-2025-06-14T04-35-18.json
│   ├── validation/             # 验证脚本
│   │   ├── enhanced-validation-summary.md
│   │   ├── page-validation.js
│   │   ├── phase1-api-proxy-validation.js
│   │   ├── quick-api-test.js
│   │   ├── reports/            # 验证报告
│   │   ├── task-p3-016a/       # TASK-P3-016A验证
│   │   ├── task-p3-016b/       # TASK-P3-016B验证
│   │   ├── task-p3-017/        # TASK-P3-017验证
│   │   ├── task-p3-017b/       # TASK-P3-017B验证
│   │   ├── task-p3-018/        # TASK-P3-018验证
│   │   └── task-p3-020-trace-validation.md
│   ├── advanced-ui-optimization.js      # 高级UI优化
│   ├── test-mock-api.js                 # Mock API测试
│   ├── test-version-management.ts       # 版本管理测试
│   ├── ui-compliance-check.js           # UI合规检查
│   ├── ui-optimization-batch.js         # 批量UI优化
│   ├── validate-contract-fix.js         # 合约修复验证
│   ├── validate-contract-simple.js      # 简单合约验证
│   └── validate-task-18b-final.ts       # TASK-18B最终验证
├── src/                         # 源代码
│   ├── app/                    # Next.js App Router
│   │   ├── (admin)/            # 管理员路由组
│   │   │   └── dashboard/      # 管理仪表板
│   │   ├── (auth)/             # 认证路由组
│   │   │   └── login/          # 登录页面
│   │   ├── (dashboard)/        # 仪表板路由组
│   │   │   └── home/           # 首页选择器
│   │   ├── (farming)/          # 农业路由组
│   │   │   └── monitor/        # 监控页面
│   │   ├── (logistics)/        # 物流路由组
│   │   │   └── tracking/       # 跟踪页面
│   │   ├── (processing)/       # 加工路由组
│   │   │   └── reports/        # 报告页面
│   │   ├── (trace)/            # 溯源路由组
│   │   │   ├── certificate/    # 证书页面
│   │   │   ├── detail/         # 详情页面
│   │   │   ├── list/           # 列表页面
│   │   │   └── query/          # 查询页面
│   │   ├── admin/              # 管理模块 (16个子页面)
│   │   │   ├── admin-users/    # 管理员用户
│   │   │   ├── audit/          # 审计
│   │   │   ├── backup/         # 备份
│   │   │   ├── dashboard/      # 仪表板
│   │   │   ├── import/         # 导入
│   │   │   ├── login/          # 管理员登录
│   │   │   ├── logs/           # 日志
│   │   │   ├── notifications/  # 通知
│   │   │   ├── performance/    # 性能
│   │   │   ├── permissions/    # 权限
│   │   │   ├── products/       # 产品
│   │   │   ├── reports/        # 报告
│   │   │   ├── roles/          # 角色
│   │   │   ├── system/         # 系统
│   │   │   ├── template/       # 模板
│   │   │   └── users/          # 用户
│   │   ├── ai-demo/            # AI演示
│   │   │   └── page.tsx        # AI演示页面
│   │   ├── api/                # API路由 (6大模块)
│   │   │   ├── admin/          # 管理API
│   │   │   │   ├── audit-logs/ # 审计日志接口
│   │   │   │   ├── notifications/  # 通知接口
│   │   │   │   ├── roles/      # 角色接口
│   │   │   │   ├── users/      # 用户管理接口
│   │   │   │   └── route.ts    # 管理主接口
│   │   │   ├── auth/           # 认证API (9个接口)
│   │   │   │   ├── login/      # 登录接口
│   │   │   │   ├── logout/     # 登出接口
│   │   │   │   ├── profile/    # 用户资料接口
│   │   │   │   ├── register/   # 注册接口
│   │   │   │   ├── reset-password/  # 重置密码接口
│   │   │   │   ├── send-reset-code/ # 发送重置验证码接口
│   │   │   │   ├── status/     # 状态检查接口
│   │   │   │   ├── verify/     # 验证接口
│   │   │   │   └── verify-reset-code/  # 验证重置验证码接口
│   │   │   ├── products/       # 产品API
│   │   │   ├── proxy/          # 代理API
│   │   │   │   └── auth/       # 代理认证
│   │   │   ├── trace/          # 溯源API
│   │   │   │   └── [id]/       # 动态溯源ID接口
│   │   │   └── users/          # 用户API
│   │   │       ├── profile/    # 用户资料接口
│   │   │       └── route.ts    # 用户主接口
│   │   ├── api-debug/          # API调试
│   │   │   └── page.tsx        # API调试页面
│   │   ├── auth/               # 认证模块
│   │   │   └── login/          # 登录页面
│   │   │       └── page.tsx    # 登录页面组件
│   │   ├── components/         # 组件演示
│   │   │   └── page.tsx        # 组件演示页面
│   │   ├── crm/                # 客户关系管理模块
│   │   │   └── customers/      # 客户管理
│   │   │       └── page.tsx    # 客户页面
│   │   ├── demo/               # 演示模块
│   │   │   └── page.tsx        # 演示页面
│   │   ├── farming/            # 农业模块 (17个页面)
│   │   │   ├── breeding/       # 繁殖管理
│   │   │   ├── create-trace/   # 创建溯源
│   │   │   ├── crops/          # 作物管理
│   │   │   ├── data-collection-center/  # 数据收集中心
│   │   │   ├── farm-activities/         # 农场活动
│   │   │   ├── farm-management/         # 农场管理
│   │   │   ├── fields/         # 田地管理
│   │   │   ├── harvest-records/         # 收获记录
│   │   │   ├── indicator-detail/        # 指标详情
│   │   │   ├── manual-collection/       # 手动数据收集
│   │   │   ├── model-management/        # 模型管理
│   │   │   ├── planting-plans/          # 种植计划
│   │   │   ├── prediction-analytics/    # 预测分析
│   │   │   ├── prediction-config/       # 预测配置
│   │   │   ├── qrcode-collection/       # 二维码收集
│   │   │   ├── vaccine/        # 疫苗管理
│   │   │   ├── video-monitoring/        # 视频监控
│   │   │   └── page.tsx        # 农业模块主页
│   │   ├── finance/            # 财务模块
│   │   │   └── reports/        # 财务报告
│   │   │       └── page.tsx    # 财务报告页面
│   │   ├── help-center/        # 帮助中心
│   │   │   └── page.tsx        # 帮助中心页面
│   │   ├── inventory/          # 库存管理模块
│   │   │   └── stocks/         # 库存管理
│   │   │       └── page.tsx    # 库存页面
│   │   ├── login/              # 登录页面
│   │   │   └── page.tsx        # 登录页面组件
│   │   ├── logistics/          # 物流模块 (4个页面)
│   │   │   ├── delivery-management/     # 配送管理
│   │   │   ├── transport-orders/        # 运输订单
│   │   │   ├── vehicles/       # 车辆管理
│   │   │   ├── warehouses/     # 仓库管理
│   │   │   └── page.tsx        # 物流模块主页
│   │   ├── preview/            # 预览系统
│   │   │   └── page.tsx        # 预览页面
│   │   ├── processing/         # 加工模块 (11个页面)
│   │   │   ├── finished-products/       # 成品管理
│   │   │   ├── photos/         # 照片管理
│   │   │   ├── production/     # 生产管理
│   │   │   ├── production-batches/      # 生产批次
│   │   │   ├── production-planning/     # 生产计划
│   │   │   ├── quality/        # 质量管理
│   │   │   ├── quality-tests/  # 质量测试
│   │   │   ├── raw-materials/  # 原材料管理
│   │   │   ├── recipes/        # 配方管理
│   │   │   ├── reports/        # 加工报告
│   │   │   ├── storage/        # 存储管理
│   │   │   └── page.tsx        # 加工模块主页
│   │   ├── procurement/        # 采购模块
│   │   │   └── suppliers/      # 供应商管理
│   │   │       └── page.tsx    # 供应商页面
│   │   ├── profile/            # 用户资料模块 (8个页面)
│   │   │   ├── about/          # 关于我
│   │   │   ├── data-export/    # 数据导出
│   │   │   ├── edit/           # 编辑资料
│   │   │   ├── feedback/       # 反馈
│   │   │   ├── notifications/  # 通知设置
│   │   │   ├── password/       # 密码管理
│   │   │   ├── privacy/        # 隐私设置
│   │   │   ├── security/       # 安全设置
│   │   │   └── page.tsx        # 用户资料主页
│   │   ├── quality/            # 质量模块
│   │   │   └── inspections/    # 质量检验
│   │   │       └── page.tsx    # 质量检验页面
│   │   ├── register/           # 注册页面
│   │   │   └── page.tsx        # 注册页面组件
│   │   ├── reset-password/     # 重置密码页面
│   │   │   └── page.tsx        # 重置密码页面组件
│   │   ├── sales/              # 销售模块 (3个页面)
│   │   │   ├── orders/         # 订单管理
│   │   │   ├── pricing/        # 定价管理
│   │   │   └── reports/        # 销售报告
│   │   ├── settings/           # 系统设置
│   │   │   └── page.tsx        # 设置页面
│   │   ├── favicon.ico         # 网站图标
│   │   ├── globals.css         # 全局样式
│   │   ├── layout.tsx          # 根布局
│   │   ├── msw-provider.tsx    # MSW提供者组件
│   │   ├── page.tsx            # 根页面
│   │   └── providers.tsx       # 提供者组件
│   ├── components/             # React组件
│   │   ├── collaboration/      # 协作组件
│   │   ├── common/             # 通用组件
│   │   ├── dev/                # 开发组件
│   │   ├── modules/            # 模块组件
│   │   ├── test/               # 测试组件
│   │   ├── ui/                 # UI组件库 (20+组件)
│   │   └── ai-global-monitor.tsx  # AI全局监控
│   ├── config/                 # 配置文件
│   │   ├── app.ts              # 应用配置
│   │   ├── constants.ts        # 常量
│   │   └── index.ts            # 配置入口
│   ├── hooks/                  # React Hooks
│   │   ├── api/                # API相关Hooks
│   │   ├── index.ts            # Hooks入口
│   │   ├── useAiDataFetch.ts   # AI数据获取Hook
│   │   ├── useAiState.ts       # AI状态Hook
│   │   ├── useApi.ts           # API Hook
│   │   ├── useApi-simple.ts    # 简化API Hook
│   │   └── useMockStatus.ts    # Mock状态Hook
│   ├── lib/                    # 工具库
│   │   ├── ai-batch-controller.ts    # AI批处理控制器
│   │   ├── ai-cache-manager.ts       # AI缓存管理器
│   │   ├── ai-error-handler.ts       # AI错误处理器
│   │   ├── ai-service.ts             # AI服务
│   │   ├── api.ts              # API工具
│   │   ├── api-client.ts       # API客户端
│   │   ├── api-config.ts       # API配置
│   │   ├── constants.ts        # 常量
│   │   ├── logger.ts           # 日志工具
│   │   ├── queryClient.ts      # 查询客户端
│   │   ├── storage-adapter.ts  # 存储适配器
│   │   ├── utils.ts            # 工具函数
│   │   └── websocket.ts        # WebSocket
│   ├── mocks/                  # Mock数据和MSW设置
│   │   ├── config/             # Mock配置
│   │   ├── data/               # Mock数据
│   │   │   ├── migrations/     # 数据迁移
│   │   │   ├── schemas/        # 数据Schema
│   │   │   ├── admin-data.ts   # 管理数据
│   │   │   ├── auth-data.ts    # 认证数据
│   │   │   ├── farming-data.ts # 农业数据
│   │   │   ├── logistics-data.ts  # 物流数据
│   │   │   ├── processing-data.ts # 加工数据
│   │   │   ├── users-data.ts   # 用户数据
│   │   │   └── version-manager.ts # 版本管理器
│   │   ├── handlers/           # MSW处理器
│   │   │   ├── admin.ts        # 管理处理器
│   │   │   ├── auth.ts         # 认证处理器
│   │   │   ├── farming.ts      # 农业处理器
│   │   │   ├── logistics.ts    # 物流处理器
│   │   │   ├── processing.ts   # 加工处理器
│   │   │   ├── products.ts     # 产品处理器
│   │   │   ├── sales.ts        # 销售处理器
│   │   │   ├── trace.ts        # 溯源处理器
│   │   │   └── users.ts        # 用户处理器
│   │   ├── browser.ts          # 浏览器Mock设置
│   │   ├── node-server.ts      # Node服务器Mock
│   │   ├── setup.ts            # Mock设置
│   │   ├── setup-version-management.ts  # 版本管理设置
│   │   └── test-setup.ts       # 测试设置
│   ├── services/               # 服务层
│   │   ├── api-service-factory.ts  # API服务工厂
│   │   └── index.ts            # 服务入口
│   ├── store/                  # 状态管理
│   │   ├── appStore.ts         # 应用状态
│   │   ├── auth.ts             # 认证状态
│   │   ├── authStore.ts        # 认证存储
│   │   ├── dashboardStore.ts   # 仪表板状态
│   │   ├── traceStore.ts       # 溯源状态
│   │   └── userStore.ts        # 用户状态
│   ├── styles/                 # 样式文件
│   │   ├── globals/            # 全局样式
│   │   ├── utilities/          # 工具样式
│   │   └── advanced-optimizations.css  # 高级优化样式
│   ├── types/                  # TypeScript类型定义
│   │   ├── api/                # API类型
│   │   │   ├── shared/         # 共享类型
│   │   │   ├── admin.ts        # 管理类型
│   │   │   ├── farming.ts      # 农业类型
│   │   │   ├── logistics.ts    # 物流类型
│   │   │   └── processing.ts   # 加工类型
│   │   ├── api-response.ts     # API响应类型
│   │   ├── index.ts            # 类型入口
│   │   └── state.ts            # 状态类型
│   └── utils/                  # 工具函数
│       └── index.ts            # 工具入口
├── tests/                       # 测试文件
│   ├── types/                  # 类型测试
│   │   └── mock-types.d.ts     # Mock类型定义
│   ├── unit/                   # 单元测试
│   │   ├── components/         # 组件测试
│   │   ├── hooks/              # Hook测试
│   │   ├── lib/                # 库测试
│   │   └── services/           # 服务测试
│   ├── utils/                  # 测试工具
│   │   └── expectResponse.ts   # 响应期望工具
│   ├── contract-validation.test.ts      # 合约验证测试
│   ├── debug.test.ts                    # 调试测试
│   ├── debug-msw.js                     # MSW调试
│   ├── env.setup.js                     # 环境设置
│   ├── jest-environment-msw.js          # Jest MSW环境
│   ├── jest-typescript-fix-verification.test.ts  # TypeScript修复验证
│   ├── msw-comprehensive.test.ts        # MSW综合测试
│   ├── msw-functional.test.ts           # MSW功能测试
│   └── setup.ts                         # 测试设置
├── web-app-next/                # 子应用目录
│   └── scripts/                # 子应用脚本
├── .env.local                   # 本地环境变量
├── .prettierrc                  # Prettier配置
├── env.example                  # 环境变量示例
├── eslint.config.mjs            # ESLint配置
├── fix-eslint.ps1               # ESLint修复脚本
├── jest.config.js               # Jest测试配置
├── next.config.ts               # Next.js配置
├── next-env.d.ts                # Next.js类型定义
├── package.json                 # 项目配置
├── package-lock.json            # NPM依赖锁定
├── postcss.config.mjs           # PostCSS配置
├── README.md                    # 项目说明
├── tailwind.config.ts           # Tailwind CSS配置
├── tsconfig.json                # TypeScript配置
├── 高级响应式设计回归测试报告.md    # 高级响应式设计测试报告
└── 高级响应式设计优化报告.md        # 高级响应式设计优化报告
```

### 11. 📦 备份目录

项目包含多个备份目录用于版本控制和数据保护：

```
backup-encoding-damaged-20250602-0335/  # 编码损坏备份
webback-20250602-0351/                  # Web应用备份
webback-20250602-0357/                  # Web应用备份
```

## 🔍 重要文件说明

### 配置文件
- `package.json` - 项目依赖和脚本配置
- `vercel.json` - Vercel部署配置
- `workspace.json` - 工作区配置
- `fix_encoding.ps1` - 编码修复脚本

### 文档文件
- `README.md` - 项目主说明文档
- `DIRECTORY_STRUCTURE.md` - 本目录结构说明文档
- `backend-architecture-design.md` - 后端架构设计文档
- `current_directory_structure.txt` - 当前目录结构快照
- `current_directory_tree.txt` - 当前目录树快照

## 📋 使用说明

### 当前开发重点
- **主要开发**: `web-app-next/` - 基于Next.js的现代化应用
- **重构管理**: `refactor/phase-3/` - 技术栈现代化正在进行
- **文档中心**: `docs/` - 完整的项目文档体系
- **规则管理**: `.cursor/rules/` - 统一的开发规则体系

### 目录选择指南
- **新功能开发** → 使用 `web-app-next/`
- **文档维护** → 使用 `docs/`
- **重构工作** → 参考 `refactor/` 相应阶段
- **工具脚本** → 使用 `scripts/` 对应功能目录
- **规则查询** → 参考 `.cursor/rules/` 相关规则文件

---

**维护信息**：
- **创建日期**：2024年初
- **最后更新**：2025-02-02 (v4.2)
- **下次更新**：根据项目结构变化及时更新
- **更新责任**：项目开发团队
