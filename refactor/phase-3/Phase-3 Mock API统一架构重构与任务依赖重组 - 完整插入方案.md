<!-- updated for: Phase-3 Mock API架构紧急重组与任务依赖调整，六步重组全部完成 -->
<!-- authority: Phase-3 Mock API重构主计划 -->
<!-- status: 全部完成 - Mock API架构重组六步骤全部确认 -->
<!-- version: 1.6 -->

# Phase-3 Mock API统一架构重构与任务依赖重组 - 完整插入方案

**重要提示**: 本方案的执行，包括所有新建及修改的任务文档、架构文档、以及状态更新，均需严格遵循项目既有的管理规范，特别是：
- **`@task-management-manual.mdc`**: 用于各子任务文件的创建、结构、状态管理和验收标准。
- **`@development-management-unified.mdc`**: 用于整体项目管理、文档同步、质量控制及目录结构更新。其中关于目录结构同步的要求（更新`DIRECTORY_STRUCTURE.md`和`docs/directory-structure-changelog.md`）必须严格执行。
- **`backup-2025-02-02/project-management-auto`**: 用于任务完成度报告真实性、架构决策记录（特别是本次重构的"重大架构决策记录"）、技术债务管理及Phase-3状态管理特殊要求。

基于Phase-3现有任务体系，紧急插入Mock API架构重组任务，解决多源数据、接口规范漂移、任务依赖错位、环境隔离不足、版本不可追踪等5大系统性问题，确保84个页面迁移有稳定的技术基础。

## 已完成任务

- [完成] 识别Mock API系统性架构问题（5大核心问题域）
- [完成] 分析现有Phase-3任务体系和插入点
- [完成] 设计任务编号插入策略（P3-017B/018B/018C）
- [完成] 制定完整的重组方案和执行计划
- [完成] 步骤1：修改PHASE-3-MASTER-STATUS.md
- [完成] 步骤2：修改PHASE-3-COMPREHENSIVE-PLAN.md
- [完成] 步骤3：更新REFACTOR-PHASE3-CHANGELOG.md
- [完成] 步骤4：创建TASK-P3-017B任务文档
- [完成] 步骤5：创建TASK-P3-018B任务文档
- [完成] 步骤6：创建TASK-P3-018C任务文档

## 进行中任务

- [暂停] **TASK-P3-019A**: 当前40%进度已暂停，等待新架构重组完成后重新评估
- [已完成] **六步重组全部完成**: 所有Mock API架构重组任务文档已创建
- [已完成] **任务重组步骤1-5**: Phase-3状态文档、综合计划、变更日志、任务文档创建均已完成

## 未来任务

### **[警示] 紧急插入阶段：Mock架构重组** (执行中，剩余1个任务待创建)

- [已完成] **TASK-P3-017B**: Mock API统一架构设计 **[任务文档已创建]**
- [已调整] **TASK-P3-018**: 兼容性验证与基线确立 **[范围重新定义完成]**
- [已完成] **TASK-P3-018B**: 中央Mock服务实现 **[任务文档已创建]**
- [已完成] **TASK-P3-018C**: UI Hook层统一改造 **[任务文档已创建]**
- [已调整] **TASK-P3-019A**: Mock业务模块扩展 **[依赖重新定义完成]**
- [已调整] **TASK-P3-019B**: API文档同步 **[范围扩展完成]**

## 🎯 **第一步：PHASE-3-MASTER-STATUS.md 插入修改**

**规范提示**: 此步骤的修改需严格遵循 `@backup-2025-02-02/project-management-auto` 中关于**文档层次结构 (严格遵循)**和**状态更新协议 (防止信息分散)**的要求。确保 `PHASE-3-MASTER-STATUS.md` 作为单一权威状态来源。

### **在"[任务] 待开始任务"部分插入紧急任务**

```markdown
## [任务] **待开始任务** (11个) **[紧急重组调整]**

### **[警示] Mock API架构紧急重组** (P0最高优先级 - 立即启动)

**重组背景**: 发现Mock API存在5大系统性架构问题，必须立即重组：
1. **多源数据问题**: API路由、组件、测试脚本各写各的Mock数据
2. **接口规范漂移**: 字段、命名、枚举值在不同文件不一致
3. **任务依赖错位**: P3-019A在未验证基线上推进，存在重构风险
4. **环境隔离不足**: dev/test/prod Mock启停控制混乱
5. **版本不可追踪**: Mock数据无版本管理，接口变更需手搜文件

- [新增] **TASK-P3-017B**: Mock API统一架构设计
  - **状态**: [计划中] **立即启动** - [警示] 架构问题阻塞后续任务
  - **优先级**: [最高优先级] P0
  - **预估工期**: 3天
  - **目标**:
    - 设计MSW基础的中央Mock服务架构
    - 建立OpenAPI+AsyncAPI权威Schema管理策略
    - 制定Schema版本冻结机制和变更流程
    - 设计MSW在Next.js App Router下的双端配置方案
    - 建立OpenAPI↔TypeScript自动同步机制
  - **交付物**:
    - `docs/architecture/mock-api-architecture.md` - 统一架构设计文档
    - `docs/api/schema-version-management.md` - Schema版本管理策略
    - **重大架构决策记录**: 遵循`backup-2025-02-02/project-management-auto`模板，记录本次选型决策。
  - **验收标准**: 架构设计文档通过技术评审，工具选型明确。整体完成情况需满足 `backup-2025-02-02/project-management-auto` 中定义的通用技术、功能和质量标准。

### **质量保证与基线确立** (P0优先级 - 范围重新定义)

- [调整] **TASK-P3-018**: 兼容性验证与基线确立 **[范围重新定义]**
  - **状态**: [计划中] 待开始 → **依赖P3-017B架构设计完成**
  - **原目标**: 一般性兼容性验证与优化
  - **新目标**:
    - 建立OpenAPI+AsyncAPI作为权威Schema单一真相源
    - 验证所有现有Mock数据与真实API的一致性
    - 清理多源数据问题（清查API路由内联Mock、组件JSON、测试脚本Mock）
    - 输出真实Mock覆盖率（替代当前27%/40%/100%混乱数据）
    - **Schema版本冻结checkpoint**: 为后续依赖任务提供稳定基础
    - 验证消息队列数据结构(Kafka/Redis Stream)与Schema一致性
  - **优先级**: P0 (基线验证)
  - **预估工期**: 5天 (after P3-017B)
  - **依赖**: TASK-P3-017B完成
  - **交付物**:
    - `refactor/phase-3/docs/MOCK-API-BASELINE-REPORT.md` - Mock API基线验证报告
    - `docs/api/openapi.yaml` - 权威API Schema定义
    - `docs/api/async-api.yaml` - 消息队列API规范
    - Schema冻结版本号(如v1.0.0-baseline)
  - **验收标准**: Schema版本冻结，所有不一致性记录完整。整体完成情况需满足 `backup-2025-02-02/project-management-auto` 中定义的通用技术、功能和质量标准。

- [新增] **TASK-P3-018B**: 中央Mock服务实现
  - **状态**: [计划中] 待开始
  - **依赖**: TASK-P3-017B架构设计 + TASK-P3-018基线确立
  - **目标**:
    - 实现MSW双端配置：Node端setupServer(for API routes) + 浏览器端setupWorker
    - 建立版本化Mock数据管理(x-api-version header)
    - 迁移所有散落Mock数据到中央服务
    - 清除API路由、组件、测试中的内联Mock数据
    - 集成CI/CD的Schema-to-Code双向检查
    - 实现统一的API client with版本感知
  - **优先级**: P0
  - **预估工期**: 7天
  - **交付物**:
    - `web-app-next/src/mocks/` 完整目录结构
    - `web-app-next/src/mocks/node-server.ts` - Node端MSW服务器
    - `web-app-next/src/mocks/browser.ts` - 浏览器端MSW Worker
    - `web-app-next/src/mocks/version-manager.ts` - Mock数据版本管理器
    - `scripts/api-sync/` - Schema同步工具集
  - **验收标准**: 中央Mock服务完全替代所有内联Mock，版本控制机制工作正常。整体完成情况需满足 `backup-2025-02-02/project-management-auto` 中定义的通用技术、功能和质量标准。

- [新增] **TASK-P3-018C**: UI Hook层统一改造
  - **状态**: [计划中] 待开始
  - **依赖**: TASK-P3-018B中央Mock服务可用
  - **目标**:
    - 重构所有API调用使用统一的useApi Hook
    - 确保Hook层与最新Schema版本严格对齐
    - 建立Hook使用规范，禁止组件直接调用API
    - 实现Hook层的Mock/Real API透明切换
    - 建立Hook层版本感知能力
  - **优先级**: P0
  - **预估工期**: 3天
  - **交付物**:
    - `web-app-next/src/hooks/api/useApi.ts` - 统一API调用Hook
    - `web-app-next/src/hooks/api/version-aware-client.ts` - 版本感知API客户端
    - `web-app-next/src/hooks/api/hook-registry.ts` - Hook使用规范注册表
  - **验收标准**: 所有组件通过统一Hook访问API，Mock/Real切换无缝。整体完成情况需满足 `backup-2025-02-02/project-management-auto` 中定义的通用技术、功能和质量标准。

### **Mock API扩展与集成** (P1优先级 - 依赖重新定义)

- [调整] **TASK-P3-019A**: Mock API业务模块扩展 **[依赖重新定义]**
  - **状态**: [暂停] → **等待中央架构重组完成**
  - **当前进度**: 40%完成需要在新架构下重新评估
  - **新依赖**: TASK-P3-018C完成 (UI Hook层统一)
  - **调整原因**: 避免在错误基线上推进，确保扩展基于稳定架构
  - **新目标**: 基于中央服务架构和冻结Schema扩展业务模块
    - 农业模块Mock(基于中央服务架构重新实现)
    - 加工、物流、管理模块Mock
    - 确保100%覆盖率基于验证过的基线计算
    - 所有新Mock严格遵循权威API Schema
  - **优先级**: P1
  - **预估工期**: 4天 (基于新架构重新评估)
  - **验收标准**: Mock覆盖率100%，基于中央服务架构。整体完成情况需满足 `backup-2025-02-02/project-management-auto` 中定义的通用技术、功能和质量标准。

- [调整] **TASK-P3-019B**: API文档同步与集成指南 **[范围扩展]**
  - **新增范围**:
    - 中央Mock服务使用指南
    - Schema版本管理操作手册
    - Mock到真实API切换策略
    - OpenAPI+AsyncAPI维护指南
  - **依赖**: TASK-P3-019A (调整后版本)
  - **预估工期**: 3天 (增加1天)
  - **交付物**:
    - `docs/api/mock-integration-guide.md` - Mock服务集成指南
    - 更新现有API文档反映100%Mock覆盖状态

### **页面迁移阶段** (P0优先级 - 新增前置条件)

- [计划中] **TASK-P3-020**: 静态页面现代化迁移 **[新增前置条件]**
  - **状态**: [计划中] 规划中 → **依赖Mock重组完成**
  - **新前置条件**: Mock架构重组必须100%完成
  - **调整原因**: 84个页面迁移需要稳定、统一的Mock数据支撑
  - **优先级**: [最高优先级] P0
  - **预估工期**: 18个工作日 (原计划保持)
  - **页面规模**: 84个页面 (26个主页面 + 58个二级页面)

[其余P3-021到P3-024任务保持不变]
```

## 🎯 **第二步：PHASE-3-COMPREHENSIVE-PLAN.md 插入修改**

**规范提示**: 此步骤的修改需严格遵循 `@backup-2025-02-02/project-management-auto` 中关于**文档层次结构 (严格遵循)**和**状态更新协议 (防止信息分散)**的要求。

### **在"第二部分：详细工作计划"中插入紧急阶段**

```markdown
## 🚀 **阶段化执行计划** **[紧急调整版]**

### **[警示] 紧急插入阶段：Mock架构重组** (Week 0.5) **立即启动**
**时间**: 立即启动 ~ 2周内完成
**触发原因**: 发现Mock API系统性架构问题，阻塞后续页面迁移
**状态**: [警示] P0紧急任务
**总工期**: 18个工作日

**问题诊断**:
1. **多源数据问题**: API路由、组件、测试脚本各写各的Mock，同一接口4份数据
2. **接口规范漂移**: 字段、命名在不同文件不一致，维护成本倍增
3. **任务依赖错位**: P3-019A在未验证基线上推进，存在重构风险
4. **环境隔离不足**: dev/test/prod Mock控制混乱，容易串数据
5. **版本不可追踪**: Mock数据无版本管理，接口一改要手搜所有文件

**重组子阶段**:

#### **子阶段1: 架构设计** (Day 1-3)
- **TASK-P3-017B**: Mock架构重组设计 (3天)
  - 确定MSW+OpenAPI+AsyncAPI技术栈
  - 设计中央Mock服务架构
  - 制定Schema版本冻结机制
  - 解决Next.js App Router下MSW双端配置

#### **子阶段2: 基线确立** (Day 4-8)
- **TASK-P3-018**: 兼容性验证与基线确立 (5天)
  - 建立权威API Schema作为单一真相源
  - 验证所有现有Mock与真实API一致性
  - 清理多源数据问题
  - Schema版本冻结checkpoint

#### **子阶段3: 中央服务实现** (Day 9-15)
- **TASK-P3-018B**: 中央Mock服务实现 (7天)
  - 实现MSW双端配置(Node+Browser)
  - 迁移所有散落Mock到中央服务
  - 建立版本化Mock数据管理
  - 集成CI/CD Schema同步检查

#### **子阶段4: Hook层统一** (Day 16-18)
- **TASK-P3-018C**: UI Hook层统一改造 (3天)
  - 重构所有API调用使用统一useApi Hook
  - 实现Mock/Real API透明切换
  - 建立Hook使用规范

**风险控制**:
- 保持当前功能不中断，每个子任务都有回滚预案
- 重组完成前暂停P3-019A推进
- 建立每日进度检查点，确保2周内完成

### **调整后阶段**: Mock扩展与页面迁移 (Week 3+)

#### **阶段七: Mock扩展恢复** (Week 3)
- **TASK-P3-019A**: 基于新架构的Mock业务模块扩展 (4天)
- **TASK-P3-019B**: API文档同步与集成指南 (3天)

#### **阶段八: 页面迁移** (Week 4-7) **[依赖明确]**
**前置条件**: Mock架构重组必须100%完成
**调整原因**: 84个页面迁移需要稳定、统一的Mock数据支撑

- **TASK-P3-020**: 静态页面现代化迁移 (18个工作日)
- **TASK-P3-021到P3-024**: 核心业务页面迁移

**关键成功因素**:
- Mock架构重组的质量直接影响页面迁移效率
- 统一的Hook层可以大幅减少页面迁移的API集成工作量
```

## 🎯 **第三步：创建新任务文档**

**规范提示**: 所有新创建的任务文档必须严格遵循 `@task-management-manual.mdc` 中定义的任务结构、状态标记、变更记录和验收标准规范。

### **需要立即创建的任务文档**

#### **1. TASK-P3-017B_Mock_API统一架构设计.md**
```markdown
# TASK-P3-017B: Mock API统一架构设计

<!-- updated for: Phase-3 Mock API架构紧急重组 -->
<!-- authority: 本任务详细规划 -->
<!-- status: 计划中 -->
<!-- version: 1.0 -->

## 任务概述
**任务ID**: TASK-P3-017B
**紧急程度**: [警示] P0最高优先级
**预估工期**: 3天
**状态**: [计划中] 立即启动
**负责人**: [指定负责人]
**遵循规范**: @task-management-manual.mdc, @development-management-unified.mdc

## 背景问题
当前Mock API存在5大系统性问题：
1. 多源数据：API路由、组件、测试脚本各写各的Mock
2. **接口规范漂移**: 字段、命名在不同文件不一致
3. **任务依赖错位**: P3-019A在未验证基线上推进
4. **环境隔离不足**: dev/test/prod Mock控制混乱
5. **版本不可追踪**: Mock数据无版本管理

## 任务目标
设计统一的Mock API架构，解决系统性问题，为后续扩展提供稳定基础

## 技术方案
### MSW架构设计
- Node端：setupServer用于API routes
- 浏览器端：setupWorker用于前端组件
- 统一handlers管理

### Schema管理策略
- OpenAPI 3.0作为REST API权威Schema
- AsyncAPI用于消息队列规范
- Schema版本冻结机制

### 版本控制方案
- Mock数据semver版本管理
- x-api-version response header
- 自动Schema-TypeScript同步

## 交付物
- `docs/architecture/mock-api-architecture.md` (统一架构设计文档)
- `docs/api/schema-version-management.md` (Schema版本管理策略)
- MSW配置架构图
- 技术选型决策文档
- **重大架构决策记录**: 遵循`backup-2025-02-02/project-management-auto`模板，详细记录选型依据、替代方案、风险评估等。

## 验收标准
- [ ] 架构设计文档 (`docs/architecture/mock-api-architecture.md`, `docs/api/schema-version-management.md`) 内容完整、清晰，并通过技术团队评审。
- [ ] MSW、OpenAPI、AsyncAPI等核心工具选型及其理由明确记录在"重大架构决策记录"中。
- [ ] Schema版本冻结机制、变更流程设计完整且具备可操作性。
- [ ] MSW在Next.js App Router下的双端配置方案（Node端`setupServer`与浏览器端`setupWorker`）详细可行。
- [ ] OpenAPI↔TypeScript自动同步机制的选型和集成方案明确。
- [ ] **通用标准**: 任务完成情况需符合 `backup-2025-02-02/project-management-auto` 中定义的通用技术、功能和质量标准。

## 变更记录
| 日期       | 版本 | 变更内容                               | 负责人   |
|------------|------|----------------------------------------|----------|
| [创建日期] | 1.0  | 初始任务文档创建                       | [AI助手] |

```

#### **2. TASK-P3-018B_中央Mock服务实现.md**
```markdown
# TASK-P3-018B: 中央Mock服务实现

<!-- updated for: Phase-3 Mock API架构紧急重组 -->
<!-- authority: 本任务详细规划 -->
<!-- status: 计划中 -->
<!-- version: 1.0 -->

## 任务概述
**任务ID**: TASK-P3-018B
**优先级**: P0
**预估工期**: 7天
**依赖**: TASK-P3-017B (Mock API统一架构设计) + TASK-P3-018 (兼容性验证与基线确立)
**负责人**: [指定负责人]
**遵循规范**: @task-management-manual.mdc, @development-management-unified.mdc

## 任务目标
实现基于MSW的中央Mock服务，统一管理所有Mock数据

## 实施清单

### Day 1-2: MSW基础设施
- [ ] 安装MSW依赖 (`web-app-next/package.json`更新)
- [ ] 配置Node端setupServer (`web-app-next/src/mocks/node-server.ts`)
- [ ] 配置浏览器端setupWorker (`web-app-next/src/mocks/browser.ts`)
- [ ] 建立handlers目录结构 (`web-app-next/src/mocks/handlers/`)

### Day 3-4: 数据迁移
- [ ] 清查所有现有Mock数据源 (API路由内联Mock、组件JSON、测试脚本Mock)
- [ ] 迁移API路由内联Mock到中央服务
- [ ] 迁移组件内嵌JSON Mock到中央服务
- [ ] 迁移测试脚本Mock数据到中央服务

### Day 5-6: 版本管理与Schema同步
- [ ] 实现版本化Mock数据管理 (`web-app-next/src/mocks/data/`, `web-app-next/src/mocks/version-manager.ts`)
- [ ] 集成x-api-version header处理逻辑
- [ ] 建立Schema-Code同步检查机制 (集成到`scripts/api-sync/`，并在CI中运行)
- [ ] 更新统一API Client (`web-app-next/src/lib/api-client.ts`)以支持版本感知

### Day 7: 集成验证
- [ ] 端到端功能测试，确保所有原有Mock场景正常工作
- [ ] 性能基准验证，确保MSW引入未导致显著性能下降
- [ ] 环境切换测试 (dev/test/prod Mock启停)

## 目录结构与文件清单
**规范提示**: 新建目录和文件后，需同步更新 `DIRECTORY_STRUCTURE.md` 和 `docs/directory-structure-changelog.md`。
```
web-app-next/src/mocks/
├── server.ts          # Node端MSW服务器
├── browser.ts         # 浏览器端Worker
├── handlers/          # API handlers
│   ├── farming.ts
│   ├── processing.ts
│   └── logistics.ts
├── data/             # 版本化Mock数据
└── version-manager.ts # 版本管理器

scripts/api-sync/
├── schema-to-types.js   # OpenAPI到TypeScript自动生成脚本
└── validate-schema-sync.js # Schema-Code双向验证脚本
```

## 验收标准
- [ ] 所有内联Mock成功迁移到中央服务。
- [ ] MSW双端配置（Node端用于API routes, 浏览器端用于组件）正常工作并经过测试。
- [ ] 版本控制机制（如x-api-version header驱动）已实现并验证通过。
- [ ] 原有依赖Mock数据的功能在迁移后100%保持正常。
- [ ] Schema-to-Code自动同步和CI验证流程建立。
- [ ] **通用标准**: 任务完成情况需符合 `backup-2025-02-02/project-management-auto` 中定义的通用技术、功能和质量标准。

## 变更记录
| 日期       | 版本 | 变更内容                               | 负责人   |
|------------|------|----------------------------------------|----------|
| [创建日期] | 1.0  | 初始任务文档创建                       | [AI助手] |
```

#### **3. TASK-P3-018C_UI_Hook层统一改造.md**
```markdown
# TASK-P3-018C: UI Hook层统一改造

<!-- updated for: Phase-3 Mock API架构紧急重组 -->
<!-- authority: 本任务详细规划 -->
<!-- status: 计划中 -->
<!-- version: 1.0 -->

## 任务概述
**任务ID**: TASK-P3-018C
**优先级**: P0
**预估工期**: 3天
**依赖**: TASK-P3-018B (中央Mock服务实现)
**负责人**: [指定负责人]
**遵循规范**: @task-management-manual.mdc, @development-management-unified.mdc

## 任务目标
建立统一的API Hook层 (`useApi`)，封装所有API调用，实现Mock/Real API的透明切换，并与Schema版本对齐。

## 实施清单

### Day 1: 统一Hook设计与实现
- [ ] 设计`useApi`统一接口，参数化API请求（method, path, body, queryParams等）。
- [ ] 实现版本感知API客户端 (`web-app-next/src/hooks/api/version-aware-client.ts`)，能根据Schema版本调整请求。
- [ ] 建立Hook使用规范文档 (`web-app-next/src/hooks/api/README.md`或`docs/components/hooks-usage-guide.md`)。
- [ ] 实现`useApi` Hook (`web-app-next/src/hooks/api/useApi.ts`)。

### Day 2: 组件重构与适配
- [ ] 识别所有现有组件中直接调用`fetch`或旧API客户端的地方。
- [ ] 将这些调用重构为使用新的`useApi` Hook。
- [ ] 确保组件层面不再关心API的具体实现或Mock状态。
- [ ] 验证重构后组件功能完整性。

### Day 3: 切换机制与验证
- [ ] 在`useApi` Hook或其依赖的API客户端中实现Mock/Real API的透明切换逻辑 (例如，基于环境变量)。
- [ ] 建立环境变量控制机制 (`web-app-next/.env.local`, `next.config.js`)。
- [ ] 进行端到端验证，测试在不同环境变量下API调用的正确性。

## 核心文件
**规范提示**: 新建目录和文件后，需同步更新 `DIRECTORY_STRUCTURE.md` 和 `docs/directory-structure-changelog.md`。
```
web-app-next/src/hooks/api/
├── useApi.ts                     # 统一API调用Hook
├── version-aware-client.ts       # 版本感知API客户端
├── hook-registry.ts              # [可选] Hook使用规范注册表或类型定义
└── README.md                     # Hook使用指南
```

## 验收标准
- [ ] 所有前端组件的API调用均通过统一的`useApi` Hook进行。
- [ ] Mock/Real API之间的切换机制（如通过环境变量）工作无缝，对上层组件透明。
- [ ] `useApi` Hook能够正确处理不同版本的API Schema（至少能感知版本）。
- [ ] 性能无显著下降，Hook层引入的开销在可接受范围内。
- [ ] TypeScript类型检查100%通过，Hook层类型定义清晰。
- [ ] **通用标准**: 任务完成情况需符合 `backup-2025-02-02/project-management-auto` 中定义的通用技术、功能和质量标准。

## 变更记录
| 日期       | 版本 | 变更内容                               | 负责人   |
|------------|------|----------------------------------------|----------|
| [创建日期] | 1.0  | 初始任务文档创建                       | [AI助手] |
```

## 🎯 **第四步：修改现有任务文档**

### **修改TASK-P3-018_兼容性验证与优化.md**
**规范提示**: 修改任务文档时，需遵循 `@task-management-manual.mdc` 的结构。
```markdown
# TASK-P3-018: 兼容性验证与基线确立 [范围重新定义]

<!-- updated for: Mock API架构重组 - 基线验证与Schema权威确立 -->
<!-- authority: 本任务详细规划 -->
<!-- status: 计划中 -->
<!-- version: 1.1 -->

## 任务概述 [更新]
**原目标**: 一般性兼容性验证与优化
**新目标**: 作为Mock API架构重组的关键一步，进行Mock API基线验证与权威Schema的确立。
**优先级**: P0 (基线验证)
**预估工期**: 5天
**依赖**: TASK-P3-017B (Mock API统一架构设计)
**负责人**: [指定负责人]
**遵循规范**: @task-management-manual.mdc, @development-management-unified.mdc

## 新任务范围
1.  **建立权威Schema**:
    *   [ ] 将`docs/api/openapi.yaml`作为REST API的权威Schema。
    *   [ ] 创建并确立`docs/api/async-api.yaml`作为消息队列（如Kafka/Redis Stream）的权威规范。
2.  **现有Mock验证**:
    *   [ ] 验证所有现存的Mock数据（包括API路由内联、组件内JSON、测试脚本中的Mock）与真实API响应的一致性。
    *   [ ] 对比现有Mock与权威OpenAPI/AsyncAPI Schema，记录所有不一致之处。
3.  **多源数据清理准备**:
    *   [ ] 彻底清查项目中所有形式的Mock数据源。
    *   [ ] 制定详细计划，以便在TASK-P3-018B中将这些数据迁移或替换为中央Mock服务。
4.  **真实覆盖率统计**:
    *   [ ] 基于验证结果，精确统计当前真实的Mock API覆盖率，替代之前混乱的百分比数据。
5.  **Schema版本冻结**:
    *   [ ] 完成上述验证和记录后，对当前OpenAPI和AsyncAPI Schema进行版本冻结（例如，标记为`v1.0.0-baseline`）。
    *   [ ] 此冻结版本将作为后续TASK-P3-018B（中央Mock服务实现）和TASK-P3-019A（Mock业务模块扩展）的技术基线。
6.  **消息队列数据结构验证**:
    *   [ ] 确保离线队列等使用的消息格式与AsyncAPI中定义的结构一致。

## 交付物 [新增/更新]
- `refactor/phase-3/docs/MOCK-API-BASELINE-REPORT.md` (详细记录验证结果、不一致性列表、真实覆盖率)
- `docs/api/openapi.yaml` (经过验证和确认的权威版本)
- `docs/api/async-api.yaml` (新建或确认的权威版本)
- Schema冻结版本号记录 (例如, `v1.0.0-baseline`)

## 验收标准 [更新]
- [ ] OpenAPI (`openapi.yaml`) 和 AsyncAPI (`async-api.yaml`) 已建立并被确认为权威Schema。
- [ ] `MOCK-API-BASELINE-REPORT.md` 完整记录了所有现有Mock与真实API及权威Schema的对比结果和不一致性。
- [ ] 真实的Mock API覆盖率已明确统计并记录。
- [ ] Schema版本已成功冻结（例如 `v1.0.0-baseline`），并已通知所有相关依赖方，为后续任务（P3-018B, P3-019A）提供了稳定的技术基线。
- [ ] 消息队列使用的数据结构已确认与AsyncAPI规范一致。
- [ ] **通用标准**: 任务完成情况需符合 `backup-2025-02-02/project-management-auto` 中定义的通用技术、功能和质量标准。

## 变更记录
| 日期       | 版本 | 变更内容                               | 负责人   |
|------------|------|----------------------------------------|----------|
| [修改日期] | 1.1  | 任务范围重新定义以适应Mock API架构重组 | [AI助手] |
| ...        | ...  | ...                                    | ...      |
```

### **修改TASK-P3-019A_Mock_API业务模块扩展.md**
**规范提示**: 修改任务文档时，需遵循 `@task-management-manual.mdc` 的结构。
```markdown
# TASK-P3-019A: Mock API业务模块扩展 [依赖重新定义]

<!-- updated for: Phase-3 Mock API架构紧急重组 - 调整依赖与实施方案 -->
<!-- authority: 本任务详细规划 -->
<!-- status: 暂停 -->
<!-- version: 1.1 -->

## 状态调整
**原状态**: [进行中] 40%完成
**新状态**: [暂停] → **等待TASK-P3-018C (UI Hook层统一改造) 完成**
**调整原因**: 避免在错误的Mock API基线上继续推进，确保所有扩展工作都基于稳定、统一的新架构。原40%进度成果（如类型声明包、脚手架工具）需在新架构下重新评估其兼容性和复用性。

## 新依赖关系
**原依赖**: 无明确的强前置任务，导致在未验证基线上推进。
**新依赖**: TASK-P3-018C (UI Hook层统一改造) 完成。
**前置条件**: 整个Mock API架构重组（P3-017B, P3-018, P3-018B, P3-018C）必须100%完成并通过验收。

## 重新评估计划
**当前40%进度**:
  - 统一类型声明包：评估与新权威OpenAPI Schema的差异，进行适配。
  - 自动化脚手架工具：评估是否能生成符合MSW handler格式的代码，进行改造。
  - 农业Mock数据工厂：评估其数据结构是否符合新Schema，进行调整。
**新预估工期**: 4天 (在完全统一的中央服务和Hook层基础上进行)
**重新实施**:
  - 所有Mock API的实现（包括农业、加工、物流、管理模块）必须通过向中央Mock服务（MSW）添加或修改handlers的方式进行。
  - 严格遵循TASK-P3-018阶段冻结的权威API Schema (`openapi.yaml` 和 `async-api.yaml`)。

## 调整后目标
- 基于中央服务架构 (`web-app-next/src/mocks/`) 重新实现或验证农业模块的Mock API。
- 使用中央服务架构扩展加工、物流、管理模块的Mock API。
- 确保所有业务模块的Mock API覆盖率达到100%，此覆盖率基于TASK-P3-018验证过的基线进行计算。
- 所有新建和修改的Mock API handlers严格遵循权威API Schema。

## 验收标准
- [ ] 农业、加工、物流、管理四大核心业务模块的Mock API均已通过MSW handlers在中央服务中实现。
- [ ] Mock API覆盖率达到100%，覆盖范围基于权威API Schema定义的所有接口。
- [ ] 所有Mock数据结构与权威OpenAPI/AsyncAPI Schema完全一致。
- [ ] **通用标准**: 任务完成情况需符合 `backup-2025-02-02/project-management-auto` 中定义的通用技术、功能和质量标准。

## 变更记录
| 日期       | 版本 | 变更内容                               | 负责人   |
|------------|------|----------------------------------------|----------|
| [修改日期] | 1.1  | 调整依赖关系，明确基于新架构实施       | [AI助手] |
| ...        | ...  | ...                                    | ...      |
```

## 🎯 **第五步：更新CHANGELOG记录**

### **在REFACTOR-PHASE3-CHANGELOG.md中添加**
**规范提示**: 变更记录应清晰、准确，遵循 `@development-management-unified.mdc` 的要求。
```markdown
## [EMERGENCY] 2025-02-02: Mock API架构紧急重组

### 触发事件
发现Mock API存在5大系统性架构问题（多源数据、接口规范漂移、任务依赖错位、环境隔离不足、版本不可追踪），严重威胁后续84个页面迁移的稳定性及Phase-3整体目标达成。

### 问题诊断与影响评估 (遵循`backup-2025-02-02/project-management-auto`中架构决策影响跟踪机制)
- **决策日期**: 2025-02-02
- **决策类型**: 架构重构与任务重组
- **影响范围**: Phase-3所有与API交互的任务，特别是P3-018, P3-019A/B, 及P3-020开始的页面迁移系列任务。
- **决策描述**: 紧急插入Mock API架构重组系列任务（P3-017B, P3-018B, P3-018C），调整P3-018, P3-019A/B的任务范围和依赖。
- **动机说明**: 现有Mock实现混乱，无法支撑大规模页面迁移；接口定义不统一导致开发效率低下和潜在BUG。
- **替代方案评估**:
    1.  小范围修补：被否决，无法解决根本问题，短期投入可能造成更大浪费。
    2.  暂停Phase-3，彻底重做Mock：被否决，时间成本过高。
    3.  **当前方案（紧急插入重组）**: 平衡了彻底性和时间成本，优先解决阻塞性问题。
- **短期影响**: 暂停P3-019A，增加约18个工作日的重组时间。
- **长期影响**: 建立稳定、统一、可维护的Mock API基础，大幅降低后续API集成和测试成本，提升开发效率和系统质量。
- **技术债务成本**: 清理现有混乱Mock实现的技术债务，预估减少后续因此产生的返工和BUG修复工时XX人天。
- **风险评估**:
    - 风险1: 重组期间影响并行任务进度。缓解：明确依赖，尽可能解耦。
    - 风险2: 新架构引入学习成本。缓解：提供详细文档和培训。

### 紧急措施
**插入新任务**: P3-017B (架构设计), P3-018B (中央服务实现), P3-018C (UI Hook统一)。
**调整现有任务**: P3-018 (范围重新定义为基线验证与Schema确立), P3-019A (暂停，依赖新架构调整后恢复), P3-019B (范围扩展)。
**影响范围**: P3-020 (页面迁移) 新增前置条件，必须等待Mock重组完成。

### 重组方案 (各阶段及任务详见`Phase-3 Mock API统一架构重构与任务依赖重组 - 完整插入方案.md`)
1. **架构设计** (P3-017B, 3天): MSW+OpenAPI+AsyncAPI统一架构
2. **基线确立** (P3-018, 5天): 权威Schema建立，版本冻结
3. **中央服务** (P3-018B, 7天): MSW双端配置，统一Mock管理
4. **Hook统一** (P3-018C, 3天): 统一API访问层，透明切换
5. **安全恢复** (P3-019A调整版, 4天): 基于新架构扩展

### 预期效果
- **短期**: 解决Mock数据混乱，建立统一服务入口，明确接口规范。
- **中期**: Mock到真实API切换成本降低90%，API变更维护成本大幅下降。
- **长期**: 为84个页面迁移提供稳定可靠的Mock数据支撑，提升整体开发效率和产品质量。

### 时间影响
**增加工期**: 约18个工作日 (用于Mock架构重组阶段)。
**总体影响**: 短期内项目进度有所调整，但长期看是保障Phase-3成功和降低后续技术债务的必要投入。
**关键路径调整**: 页面迁移系列任务（P3-020起）的启动时间将整体后移，严格依赖Mock重组阶段的完成。

### 风险控制与回滚机制
- 每个重组子任务均制定独立回滚预案，确保在出现意外情况时能快速恢复到重组前状态或稳定节点。
- 在重组期间，尽可能保持现有应用主要功能不中断（通过并行维护旧Mock或分模块逐步替换）。
- 建立每日进度检查点和快速反馈机制，及时发现和解决问题。
- 在P3-017B（架构设计）完成后，进行一次全面的技术评审，确认方案可行性再进入大规模实施。
- P3-019A在重组完成前保持暂停状态，避免在不稳定的基础上继续投入。
```

## 🎯 **第六步：执行时间表**

### **紧急执行时间表**
```
✅ 已完成行动 (前五步):
├── ✅ 修改PHASE-3-MASTER-STATUS.md (插入紧急任务，调整任务状态和依赖)
├── ✅ 修改PHASE-3-COMPREHENSIVE-PLAN.md (插入重组阶段，更新阶段计划)
├── ✅ 更新REFACTOR-PHASE3-CHANGELOG.md (详细记录本次紧急调整的原因、方案和影响)
├── ✅ 创建TASK-P3-017B任务文档 (Mock API统一架构设计)
├── ✅ 创建TASK-P3-018B任务文档 (中央Mock服务实现)
└── ✅ 暂停TASK-P3-019A当前所有活动，状态已封存

✅ 第六步已完成:
└── ✅ 创建TASK-P3-018C任务文档 (UI Hook层统一改造)

🎉 六步重组任务文档创建阶段全部完成!

Week 1 (Day 1-3):
└── TASK-P3-017B: Mock API统一架构设计 (3天) - **产出并通过评审**: `docs/architecture/mock-api-architecture.md`, `docs/api/schema-version-management.md`, 重大架构决策记录

Week 1-2 (Day 4-8):
└── TASK-P3-018: 兼容性验证与基线确立 (5天) - **产出并通过评审**: `refactor/phase-3/docs/MOCK-API-BASELINE-REPORT.md`, `docs/api/openapi.yaml`, `docs/api/async-api.yaml`, Schema冻结版本号

Week 2-3 (Day 9-15):
└── TASK-P3-018B: 中央Mock服务实现 (7天) - **产出并集成**: `web-app-next/src/mocks/` 目录及相关MSW配置, `scripts/api-sync/` 工具

Week 3 (Day 16-18):
└── TASK-P3-018C: UI Hook层统一改造 (3天) - **产出并集成**: `web-app-next/src/hooks/api/` 目录及相关Hook实现

Week 4+:
├── TASK-P3-019A: Mock API业务模块扩展恢复 (4天) - 基于新架构实施
├── TASK-P3-019B: API文档同步与集成指南 (3天)
└── TASK-P3-020: 静态页面现代化迁移启动 (18天) - 严格依赖Mock重组完成
```

## 相关文件

### **已完成的文件修改**
- ✅ `refactor/phase-3/PHASE-3-MASTER-STATUS.md` - [已完成] 插入紧急任务，调整相关任务状态、优先级、依赖和描述。
- ✅ `refactor/phase-3/PHASE-3-COMPREHENSIVE-PLAN.md` - [已完成] 插入紧急重组阶段，更新整体计划和依赖描述。
- ✅ `refactor/phase-3/REFACTOR-PHASE3-CHANGELOG.md` - [已完成] 详细记录本次紧急调整的背景、原因、方案、影响和风险控制。

### **已创建的任务文档** (严格遵循 `@task-management-manual.mdc`)
- ✅ `refactor/phase-3/tasks/TASK-P3-017B_Mock_API统一架构设计.md` [已完成]
- ✅ `refactor/phase-3/tasks/TASK-P3-018B_中央Mock服务实现.md` [已完成]
- ✅ `refactor/phase-3/tasks/TASK-P3-018C_UI_Hook层统一改造.md` [已完成]

### **已修改的现有任务文档** (严格遵循 `@task-management-manual.mdc`)
- ✅ `refactor/phase-3/tasks/TASK-P3-018_兼容性验证与优化.md` - [已完成] 范围重新定义，更新目标、交付物、验收标准。
- ✅ `refactor/phase-3/tasks/TASK-P3-019A_Mock_API业务模块扩展.md` - [已完成] 状态调整为暂停，更新依赖关系，明确基于新架构重新评估和实施。

### **重组过程中创建的架构文档**
- `docs/architecture/mock-api-architecture.md` - 统一架构设计
- `docs/api/schema-version-management.md` - Schema版本管理策略
- `docs/api/openapi.yaml` - 权威API Schema定义
- `docs/api/async-api.yaml` - 消息队列API规范
- `docs/api/mock-integration-guide.md` - Mock服务集成指南

### **重组过程中创建的实现文件** (新建和修改的文件需更新 `DIRECTORY_STRUCTURE.md` 和 `docs/directory-structure-changelog.md`)
- `web-app-next/src/mocks/` - 中央Mock服务目录
- `scripts/api-sync/` - Schema同步工具集
- `web-app-next/src/hooks/api/` - 统一API Hook层
- `web-app-next/package.json` - (可能)新增MSW等依赖

## 成功标准

### **重组完成标准**
- [ ] 5大系统性问题（多源数据、规范漂移、依赖错位、环境隔离、版本追踪）得到根本性解决。
- [ ] 中央Mock服务（MSW）100%替代所有形式的内联Mock和分散Mock数据。
- [ ] 权威API Schema (OpenAPI + AsyncAPI) 建立并成功冻结首个基线版本。
- [ ] UI Hook层完成统一改造，所有API调用通过该层进行，实现Mock/Real API的透明切换。
- [ ] **通用标准**: 所有相关任务均符合 `backup-2025-02-02/project-management-auto` 中定义的任务完成标准。

### **长期效果标准**
- [ ] Mock到真实API的切换成本预估降低90%以上。
- [ ] API接口定义或实现的变更，其影响范围从"可能涉及多个文件和模块"缩小到"主要集中在权威Schema和中央Mock服务handler"。
- [ ] 为后续84个页面的现代化迁移提供稳定、可靠、一致的Mock数据支撑。
- [ ] 开发环境的稳定性和可预测性显著提升，减少因Mock数据不一致或环境问题导致的调试时间。

---

**执行优先级**: [警示] P0最高优先级
**预期完成时间**: 18个工作日内完成重组阶段各项任务。
**关键成功因素**: 严格按阶段执行，每个阶段必须通过明确的验收标准后再进入下一阶段。管理层需给予充分支持，确保资源到位，并理解短期内对P3-019A及页面迁移启动时间的调整。
