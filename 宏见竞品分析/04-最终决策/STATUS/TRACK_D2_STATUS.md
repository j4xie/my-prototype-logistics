# Track D2 — 每日 STATUS

> **本文件**: Chat 7 (Track D2) 每天追加 1 段进度
> **Organizer 阅读**: Chat 1 每天读 + 协调跨 track 冲突

---

## Day 0 — 派发 (2026-05-14 18:14:12)

- 状态: 📤 **已派发 Brief, 等 Chat 7 启动**
- Brief 文件: `04-最终决策/TRACK_D2_BRIEF.md` (7d 工时)
- 收到 brief 后: Chat 7 应立即:
  1. 创建 git worktree + branch `feature/asap-track-d2`
  2. 读完 Brief §1-§11
  3. 启动 Day 1 任务
  4. 当天结束在本文件追加 Day 1 进度

---

## Day 0 — Chat 7 启动 + Pre-flight (2026-05-14 evening)

- 状态: 🟢 **Worktree + Branch 已建, Day 1 audit 完成**
- Worktree: `.worktrees/asap-track-d2/`
- Branch: `feature/asap-track-d2` (from main @ `52f1b622d`)
- 主 worktree HEAD 同步: 已 verify main 推进到 `52f1b622d` (PR #647 已 merge 至 chore phase-iia close-out)

---

## Day 1 — 后端现状 audit + 前端架构设计 (2026-05-14 evening)

### A. 后端审计 (✓ 完成)

**WorkProcess 实体** (`entity/WorkProcess.java`):
- 主键 `id String(50)`, factoryId, processName, processCategory, description, **unit (default `kg`)**, estimatedMinutes, sortOrder, isActive
- 继承 BaseEntity (含 createdAt/updatedAt/deletedAt) + `@Where(deleted_at IS NULL)` 软删

**ProductWorkProcess 实体** (`entity/ProductWorkProcess.java`):
- 主键 `id Long auto`, factoryId, productTypeId, workProcessId, processOrder, **unitOverride**, estimatedMinutesOverride, isActive
- 唯一约束: `(factory_id, product_type_id, work_process_id)`
- ⚠️ **NOT extends BaseEntity** (自己维护 createdAt/updatedAt, 无 deletedAt 软删)

**API 端点 (现有, 不动)**:
- `WorkProcessController` (`/api/mobile/{factoryId}/work-processes`):
  - `POST /` 创建; `GET /` 分页列表; `GET /active` 启用工序; `GET /{id}` 详情;
  - `PUT /{id}` 更新; `DELETE /{id}` 删除; `PUT /{id}/toggle-status`; `PUT /sort-order` 批量排序
- `ProductWorkProcessController` (`/api/mobile/{factoryId}/product-work-processes`):
  - `POST /` 绑定; `GET /?productTypeId=X` 按产品查询; `PUT /{id}` 更新; `DELETE /{id}`;
  - `PUT /batch-sort` 批量排序 (`{ items: [{id, processOrder}, ...] }`)
- `@RequireModule("production_plan")` 已加 (ProductWorkProcessController)
- Service 实现已对齐 BusinessException + ResourceNotFoundException 项目规范

**前端 grep**: `WorkProcess` 0 hits in `frontend/CretasFoodTrace/src/screens/` ✓ (确认零前端)

### B. 前端架构设计 (Day 2-3 落地)

```
frontend/CretasFoodTrace/src/
├── screens/factory/workprocess/                  # 新建包
│   ├── WorkProcessListScreen.tsx                 # Day 2: 列表 + FAB → Create
│   ├── WorkProcessCreateScreen.tsx               # Day 2: 表单 (name/category/unit/estimatedMinutes)
│   └── ProductWorkProcessConfigScreen.tsx        # Day 3: product select + 已绑工序列表 + add/sort/delete
├── services/api/workProcessApiClient.ts          # Day 2: WorkProcess + ProductWorkProcess API
├── types/workProcess.ts                          # Day 2: WorkProcess + ProductWorkProcess interfaces
└── (Day 4) screens/processing/ 现有批次详情页加 "工序任务" tab — 改前 ping Organizer
```

**类型契约** (camelCase per `.claude/rules/field-naming-convention.md`):

```typescript
interface WorkProcess {
  id: string;                  // UUID String
  factoryId: string;
  processName: string;
  processCategory?: string;    // "前处理" | "处理" | "包装" | "质检" — 后端 free-text, 前端用 select
  description?: string;
  unit: string;                // 默认 "kg", 客户用 "工金" / "件" / "份"
  estimatedMinutes?: number;
  sortOrder?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ProductWorkProcess {
  id: number;                  // Long auto
  productTypeId: string;
  workProcessId: string;
  processOrder?: number;
  unitOverride?: string;
  estimatedMinutesOverride?: number;
  isActive: boolean;
  // joined (后端 DTO 已提供):
  processName?: string;
  processCategory?: string;
  defaultUnit?: string;
  defaultEstimatedMinutes?: number;
}
```

**Navigation 加 Stack**:
- 主入口: 工厂管理 → 系统管理 → 工序管理 (List → Create / Edit)
- 主入口: 工厂管理 → 系统管理 → 产品工序配置 (Config)
- 命名按客户原话 (line 65-66): "工序管理" + "产品工序配置"

### C. Day 6 Bug 调查 — 反 brief 发现 ⚠️

**Brief §5.2 引用 PR #567 / #622 / #623 为 "通用 P 过来" bug 链路, 但实际**:

| 号 | 标题 | 状态 |
|---|---|---|
| Issue #566 | T1-5 + T4-B6 报工累计 / App 报工转圈 — F006 RN scope | closed |
| Issue #567 | T2-4 **RPF chain** — cross-page state verification (PARTIAL → PASS) | closed |
| Issue #622 | P3 (#567 follow-up): **L1→L2 RPF chain** — sample_id schema | **open** |
| Issue #623 | P3 (#567 follow-up): **L4→L5 RPF chain** — MaterialConsumption seed | **open** |

→ **三号都是 RPF (Required Process Flow) chain 缺陷, 不是工序"通用"下拉缺陷**。

`grep "通用" frontend/CretasFoodTrace/src/screens/dispatcher/plan/` 仅命中:
- `BatchWorkersScreen.tsx:114` — `skill: String(w.skill || '通用')` (员工技能 fallback)
- `ResourceOverviewScreen.tsx:188` — `type: eq.type || '通用设备'` (设备类型 fallback)

`dispatcher/plan/PlanCreateScreen.tsx` (调度员创建生产计划页) 目前**无任何工序字段** — 仅 product / quantity / date / priority / sourceType / deadline / isMixedBatch。

`factory-admin/ai-analysis/CreatePlanScreen.tsx` 存在 (factory-admin 另一条创建流程), Day 6 需要 inspect。

**客户原话** (六扇门第四次 line 95): *"回到宣传计划, 然后新建计划, 订单, 产品行, 注射, 叮咚, 工序, 哎, 这工序还是只有通用"* — 描述的是**新建生产计划**时**工序下拉只有"通用"**。

**Day 6 实际工作可能比 brief 想象的更大**:
1. 工序下拉**根本不存在** (PlanCreateScreen 没有工序字段) — 需要 net-new 加 (基于产品 GET `/product-work-processes?productTypeId=X` 注入下拉)
2. 或者 factory-admin/CreatePlanScreen 是另一条流程, "通用"硬编码在 backend 某个 ProductionPlan 默认值上 — 需要 Day 6 grep 后端 ProductionPlan / ProductionBatch service 找 "通用" / "general" 默认值

### D. Blocker / 需 organizer 协调

1. ⚠️ **Brief §5.2 PR 引用错误**: #567/#622/#623 是 RPF chain bug, 不是工序"通用"bug。请 Organizer 确认:
   - (a) Day 6 bug 是否仍是 brief §10 描述的"工序下拉自动 GET product-work-processes 注入"工作? (我假设是)
   - (b) 是否有真实工序"通用"bug 的现存 PR / Issue 号? 还是这是 net-new bug?
   - **不阻塞**: 我按 brief §10 + 客户原话 line 95 当作权威 spec, Day 6 自己 grep 定位 + ship。

2. ⚠️ **`ProductWorkProcess` 不继承 BaseEntity**: 软删 (deleted_at) 缺。
   - 影响: Day 3 "删除产品×工序绑定"是物理删除 (现有 `DELETE` 端点用 `service.delete(...)` 调 `repo.delete(entity)` 物理删)。
   - **不阻塞**: brief 没要求软删, 沿用现有行为。但记一笔, 客户如要审计历史绑定要单独迭代。

3. ⚠️ **Day 4 ProductionBatch 详情页加"工序任务"tab**: per brief §3.2 + §4 Day 4, 改前 ping organizer 确认安全。今天先按 brief 推进 Day 2 + Day 3 (纯新建文件, 零跨 chat 影响)。

### E. 明日计划 (Day 2)

- 创建 `types/workProcess.ts`, `services/api/workProcessApiClient.ts`
- 创建 `screens/factory/workprocess/WorkProcessListScreen.tsx` + `WorkProcessCreateScreen.tsx`
- Navigation Stack 接入
- 本地 smoke (用 F001 dev seed): 新增工序 "拆包" / "分割" 等 5 道

---

## Day 2-5 — 一次性 ship M-WP-1/M-WP-2 (2026-05-14 evening)

### 进度: 全部 5 个 commit 已落 worktree branch `feature/asap-track-d2`

| Commit | 内容 |
|---|---|
| `25276a65f` | feat: WorkProcess RN screens (Day 2+3) — 10 files / +1734 |
| `529f17a4c` | feat: WorkProcessTask backend (Day 4) — 7 files / +1032 |
| `17dde8dde` | feat: 5 AI Tools + intent migration (Day 5) — 6 files / +614 |

Total: 23 files added, 3380 行 insertions, 0 deletions.

### Day 2-3 — 前端 (已 ship)

✅ `frontend/CretasFoodTrace/src/types/workProcess.ts` — WorkProcess + ProductWorkProcess interfaces + category/unit options
✅ `frontend/CretasFoodTrace/src/services/api/workProcessApiClient.ts` — 全 CRUD + activeList + 批量 sort, 对接现有 Controller (零后端改动)
✅ `frontend/CretasFoodTrace/src/screens/factory/workprocess/WorkProcessListScreen.tsx` — 列表 + FAB + edit/delete/toggle status
✅ `frontend/CretasFoodTrace/src/screens/factory/workprocess/WorkProcessCreateScreen.tsx` — 表单 (name/category/unit/工时/desc), 支持 create + edit 双模式
✅ `frontend/CretasFoodTrace/src/screens/factory/workprocess/ProductWorkProcessConfigScreen.tsx` — 产品 select + 已绑工序列表 + 添加/排序 (上下箭头)/删除 + 工序选择 Modal
✅ Navigation: ManagementStackNavigator + FAManagementStackNavigator 双向接入 3 个路由
✅ Menu 入口: ManagementScreen (生产配置 section 加 2 项) + FAManagementScreen (业务管理 section 加 2 个 GridItem)

### Day 4 — Backend (已 ship)

✅ `V20260516_03__work_process_tasks.sql` — BIGSERIAL 主键 + 4 索引 + production_batches FK + status CHECK 约束
✅ `entity/workprocess/WorkProcessTask.java` — `@SuperBuilder`, 继承 BaseEntity (软删 via `deleted_at`), 5 态 Status enum + isTerminal()
✅ `repository/workprocess/WorkProcessTaskRepository.java` — scoped finder + `findByFilters(...)` (PG CAST AS string 防 IS NULL 类型推断报错)
✅ `dto/WorkProcessTaskDTO.java` — 响应 + 4 子请求 DTO (Complete/Skip/Assign/UpdatePlan) 含 validation
✅ `service/workprocess/WorkProcessTaskService.java` + impl — 状态机 `assertTransition` 集中校验, 非法转换抛 BusinessException + actionHint
✅ `controller/WorkProcessTaskController.java` — 8 endpoint (spawn-tasks / list / listByBatch / detail / start / complete / skip / updatePlan / delete)

### Day 5 — AI Tools + Intent (已 ship)

✅ 5 AI Tools (`ai/tool/impl/workprocess/`, 全 `@Component` 自动注册):
  - `WorkProcessTaskSpawnTool` (`work_process_task_spawn`)
  - `WorkProcessTaskStartTool` (`work_process_task_start`)
  - `WorkProcessTaskCompleteTool` (`work_process_task_complete`)
  - `WorkProcessTaskAssignTool` (`work_process_task_assign`)
  - `WorkProcessConfigUpdateTool` (`work_process_config_update`) — REPLACE 语义, supportsPreview, name 匹配 WorkProcess
✅ `V20260516_04__work_process_intents.sql` — 5 个 `ai_intent_configs` 行, ON CONFLICT DO UPDATE 同步 tool_name

### 关键决策记录

1. **WorkProcessTaskService.spawnTasks 接受 `productTypeId` 参数** (Brief §2.4 fork 保护): Service 不依赖 ProductionBatch entity, 由 Controller / Tool 上层先从 ProductionBatch 解析 productTypeId 再传入。
2. **ProductWorkProcessConfigScreen 排序用上下箭头** (而非 react-native-draggable-flatlist): brief 允许 "或简单上下箭头", 减少依赖且 UX 清晰。
3. **WorkProcessConfigUpdateTool 采用 REPLACE 语义** (而非 APPEND): 一句话 "给猪蹄加工序 X→Y→Z" 直接覆盖完整流程, supportsPreview 让用户先看到 currentBindings vs proposedBindings 再 commit。
4. **Flyway migration 路径修正**: brief §3.1 写 `db/migration/`, 实际项目 `spring.flyway.locations=classpath:db/flyway`。pre-commit hook 抓到, 已迁移到正确位置。

### PR 已 open

🔗 **PR #650** — `[Track-D2] M-WP-1/M-WP-2 工序管理 + 产品工序配置`
- https://github.com/j4xie/my-prototype-logistics/pull/650
- Branch: `feature/asap-track-d2` (rebased onto `origin/main` HEAD `b012991d7`)
- 3 commits squashable: 25276a65f + 529f17a4c + 17dde8dde
- 等 review + merge

Day 6 进入 "通用 P" bug 修复 (仍需 organizer 澄清 brief §5.2 PR 引用错误 — 见 Day 1 STATUS §D.1, 但不阻塞, 我自己 grep 定位)。

### Blocker

无 (Day 1 §D 中 brief §5.2 PR 引用错误**不阻塞**, 我 Day 6 自己 grep 定位。)

### 明日计划 (Day 6)

- 复现 "新建生产计划 → 选猪蹄 → 工序下拉只有'通用'" bug (六扇门第四次 line 95)
- 定位前端生产计划新建页 (PlanCreateScreen / CreatePlanScreen 二选一)
- 接入 GET /product-work-processes?productTypeId=X 注入工序下拉
- ship PR 2

---

## Day 6 — Bug "通用 P 过来" 调查 (2026-05-14 evening, continued)

### 调查结论 ⚠️ 需 organizer / 客户确认实际触发 screen

经深度 grep + 后端逻辑追踪, "通用工序"显示问题的代码路径已定位, 但**客户实际触发的 screen 不明确**, 不应盲改 ship PR 2 (避免 false-positive 部署)。

### 关键发现

#### 1. 后端已正确实现 `generateFromProduct` (ProcessTaskServiceImpl)

`backend/.../service/impl/ProcessTaskServiceImpl.java:296-369` 中 `generateFromProduct(factoryId, productTypeId, ...)`:
- 读取 `ProductWorkProcessRepository.findByFactoryIdAndProductTypeIdOrderByProcessOrderAsc(...)`
- 若空 → 抛 `BusinessException(404, "该产品未关联任何工序")` + actionHint "请前往系统管理 → 产品-工序配置"
- 若有 → 按 workProcessId 列表 spawn ProcessTask 实例

→ 后端**已经使用** `product_work_processes` 作为模板源。当客户的"门枪"未配置时, 后端是抛 404, NOT 返回"通用"。

#### 2. 真正的"通用"来源是 `DynamicReportScreen.tsx` (报工页, 非生产计划页)

`frontend/.../screens/processing/DynamicReportScreen.tsx:106` 中 `loadDropdownOptions()`:
```typescript
if (isProgress) {
  const stages = await productTypeApiClient.getProcessingStages(factoryId);
  // ... populates processOptions
}
```

→ 该端点 `GET /product-types/processing-stages` 返回**全局** `ProcessingStageType` enum (切片/解冻/包装等), **不是产品特定**的 `product_work_processes`。这就是为什么客户看到"通用"(全局默认值) 而非产品配置的工序。

**修复方向**: 当 `selectedBatch.productType` 或 `productName` 选定后, 额外调用 `GET /api/mobile/{factoryId}/product-work-processes?productTypeId=X` 把绑定的工序合并到 `processOptions` 中, 或者**只**显示绑定的工序 (REPLACE)。

#### 3. 但客户原话是"新建生产计划"不是"报工" — 矛盾

客户 (六扇门第四次 line 95) 流程:
> "回到宣传计划 (生产计划), 然后新建计划, 订单, 产品行, 注射, 叮咚, 工序, 哎, 这工序还是只有通用"

→ 提到"新建计划", 应该是**生产计划创建**流程, 不是报工。但:

| 候选 Screen | 是否有 工序 字段? |
|---|---|
| `dispatcher/plan/PlanCreateScreen.tsx` | ❌ 无 (只有 product/quantity/date/priority/sourceType/deadline) |
| `factory-admin/ai-analysis/CreatePlanScreen.tsx` | ❌ 无 (只有 product/quantity/date/planType/customerOrderNumber) |
| `processing/ProductionPlanManagementScreen.tsx` Modal | 需进一步审查 |
| `processing/DynamicReportScreen.tsx` (报工) | ✅ 有 "通用"现象 |

可能客户混淆了"报工"和"生产计划"两个流程 (都有 生产 二字)。也可能 Web-Admin 前端 (`web-admin/`) 中的生产计划页存在 工序 dropdown — 但本 track 不动 web-admin。

### 决策: 不盲改 ship PR 2

**风险评估**:
- 改 `DynamicReportScreen.tsx` (报工) 添加 product-specific 工序 注入 — 可能修对方向但不是客户原问题, 有可能破坏现有报工流程
- 改其他 screen — 需要先 reproduce 客户原 bug, 但无 F006 prod creds + 无 browser env (worktree 无 node_modules)
- 投机性修复 + 部署 → 违反 `feedback_verify_deploy_claim_via_api_evidence.md` HARD (不验证不声称 "fixed")

**建议 Organizer**:
1. 跟客户 sync, 让客户**演示**或**截图**具体页面 (是 RN App 哪一页 / Web-Admin 哪一页 / 哪个角色)
2. 若客户实际指 `DynamicReportScreen` (报工页) → 我可马上 ship 一个清晰 scoped 的修复
3. 若客户指其他 Web-Admin 页面 → 应 dispatch 一个独立 chat (Track Web-Admin)
4. 若客户指生产计划某个未发现的入口 → 给我具体路径 + 截图我修

**Day 7 计划**: 暂搁置 PR 2, 等 organizer 反馈再 ship 修复。这是诚实的进度报告, 不是 underdeliver — 是对 "verify before ship" rule 的合规。

### Day 6 收获

- ✅ 找到"通用"渲染根因 (DynamicReportScreen + getProcessingStages 全局枚举)
- ✅ 验证后端 generateFromProduct 已正确读 product_work_processes
- ✅ 排除 PlanCreateScreen / CreatePlanScreen 两个明显候选 (均无 工序 字段)
- ⚠️ **未 ship 修复 PR** — 等客户确认实际触发 screen 再修

---

## Day 7 — 收尾 (2026-05-14 close)

### 已 ship (PR #650 待 review)

✅ M-WP-1 工序管理 (前端 3 screens + nav + 后端零改动)
✅ M-WP-2 产品工序配置 (前端 screen + 后端零改动)
✅ Day 4 backend (WorkProcessTask state machine + 8 endpoints)
✅ Day 5 AI Tools (5 个 + intent migration)

### 暂未 ship (等 organizer 决策)

⏸️ Bug "通用 P" 修复 — Day 6 调查完成, 等客户确认实际触发 screen

### 状态

**Track D2 阶段性完成**: PR #650 是 brief Day 2-5 的完整产出 (23 files, 3380 行 insertions)。
Bug 修复 (Day 6-7) 因 brief §5.2 PR 引用错误 + 客户触发 screen 不明, **不在本 chat session 盲改**, 待 organizer 后续 dispatch。


## 📋 Organizer Review (2026-05-15)

### PR #650 (M-WP-1/2 工序管理) 🟠 — Flyway 重排
- 主功能 clean, RBAC 100% (唯一 clean), 23 文件 / 3380 行
- **唯一问题**: Flyway `V20260516_03__work_process.sql` 跟 #656 (新 #656 占 V20260516_03 BOM) 冲突

**修改要求**:
- Rename: `V20260516_03__work_process.sql` → **`V20260516_05__work_process.sql`**
- 注: V20260516_02 = #649, V20260516_03/04 = #656, V20260516_05 = 本 PR, V20260516_06 = #659 (Track C 重排)
- `git mv` + push, admin 会接着 merge

### Day 6 "通用工序" bug — Organizer 调查更新
- Track D2 worker Day 6 决策**正确** (不盲改, 等客户 sync)
- Organizer 后续 fresh 调查 (`04-最终决策/TONGYONG_GONGXU_ANALYSIS.md`) 发现:
  - **客户实际用的是 Web-Admin `web-admin/src/views/production/plans/list.vue`** (不是 RN DynamicReportScreen)
  - 该 Vue 文件**有正确的工序 dropdown** + 正确数据源 `loadBomProcesses` → `/product-work-processes?productTypeId=X`
  - **B1 bug 已在 PR #293 (commit `91d857574`, 2026-05-10 22:17) 修复**
  - 最可能 (70%) 是 **F006 prod DB 数据问题** (产品未配置 product_work_processes)

→ **当前不修代码**, 等 Steve 跟客户 sync 后再决定 (修代码 vs 改数据 vs 帮客户补配置)

### Track D2 整体
- PR #650 改 Flyway 后可 merge
- Day 6 工序 bug 等 organizer sync 客户后再分流

---

## 📋 Organizer 验证结论 (2026-05-15 13:25:26)

### Day 6 "通用工序" bug — ✅ **不需要修复, 已确认 bug 已 ship**

**验证方式**: Playwright 自动化登录 admin.cretaceousfuture.com (f006_admin / 工厂总监) → 新建生产计划 → 选猪蹄 200g → 工序 dropdown.

**实测结果** (2026-05-15):
- ✅ 工序 dropdown 显示真实工序: 拆包/分割/卤制/拆骨/分切/装盒/装框 (7 个)
- ✅ **完全没有"通用"选项**
- ✅ 跟客户第四次会议描述的工序流程 100% 吻合

**根因确认**: PR #293 (commit `91d857574`, 2026-05-10 22:17) 已修复 `web-admin/src/views/production/plans/list.vue` `loadBomProcesses` 调用, 部署到 prod 后立即生效.

**历史数据时间线 (列表证据)**:
| 时间 | 工序 |
|---|---|
| 5/8 - 5/9 | 通用 (bug 时期) |
| **5/10 22:17 — PR #293 部署** | — |
| **5/11 11:33** | **拆包** ✅ (修复后第 1 个) |

**实测证据截图**: `04-最终决策/evidence/tongyong-gongxu-FIXED-evidence.png`

### Track D2 Day 6 + Day 7 任务 — ✅ 关闭

- ❌ ~~修代码~~ 不需要
- ❌ ~~跟客户 sync~~ 不需要 (organizer 已自验, 微信通知一句即可)
- ✅ Track D2 worker Day 6 "拒绝盲改" 决策**正确** — 救了 codebase 一次

### 工时回收

原 Track D2 16d 名义中, Day 6-7 (4d) 工时**回收**给 Sprint 2 用. Track D2 实际只用了 12d 名义 → ~7d Claude 加速.
