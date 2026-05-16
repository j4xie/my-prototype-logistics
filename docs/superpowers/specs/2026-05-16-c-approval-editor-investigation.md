# Track-I 调查报告 — StateMachine vs ApprovalChain 双系统真相

**Day 1**, 2026-05-16. 调查 ~45 min. 写代码前 stop, 把真实数据给 Steve.

---

## 任务 1 — StateMachineExecutor 真存在 + 真在跑?

**结论: ✅ 真存在, 真在跑, 但 scope 只覆盖 PRODUCTION_WORKFLOW (跟 approval chain 无关).**

### 关键 evidence (file:line)

- `service/StateMachineService.java:117` — `executeTransition(...)` 接口方法存在
- `service/StateMachineService.java:133` — `executeTransitionByEvent(...)` 接口方法存在
- `service/impl/StateMachineServiceImpl.java:196` — `getAvailableTransitions` 实现
- `service/impl/StateMachineServiceImpl.java:285` — `executeTransition` 实现 (含 guard 评估)
- `service/impl/ProcessTaskServiceImpl.java:53-62` — `stateMachineRepository.findByFactoryIdAndEntityTypeAndPublishStatus(factoryId, "PRODUCTION_WORKFLOW", "published")` — ProcessTask 创建时自动绑定已发布 PRODUCTION_WORKFLOW 状态机的 versionId
- `service/impl/ProcessTaskServiceImpl.java:322-328` — 同样 PRODUCTION_WORKFLOW 自动绑定 (第二条业务流)

### 真相 nuance

state machine 引擎是 **production-workflow centric**:
- 真生产代码只用 `entityType="PRODUCTION_WORKFLOW"`
- `MATERIAL_BATCH` / `QUALITY_INSPECTION` grep 命中的全是 form-template / encoding-rule / field-visibility / voice-recognition 上下文 — **不是状态机驱动**, 是其他子系统的实体类型分类
- ProcessTaskServiceImpl 在 create 时**只绑定 workflowVersionId** (即记录用哪个状态机版本), 后续 ProcessTask 状态变更是否走 `executeTransition` — grep 在 backend 外部 callsite **0 命中** (除了 StateMachineService 自身). 可能 ProcessTask 状态变更走的是直接 setter, 不经状态机. 需要进一步追溯, 但对本 Track-I 决策无影响.

判定: **1a (有 executor + 至少 1 entityType 真用)** — 至少 PRODUCTION_WORKFLOW 是 working infra (ProcessTask 真读 state machine version).

---

## 任务 2 — workflow-designer APPROVAL 节点是真支持还是 placeholder?

**结论: ✅ 真支持 (full config schema, Spring @Component 注册, getNodeSchemas API 返回), 但语义是"报工审批", 跟 ApprovalChainConfig 是两套独立系统.**

### 关键 evidence (file:line)

- `web-admin/src/views/system/workflow-designer/` grep "APPROVAL" — **0 hits** (前端无 hardcoded 节点类型, 全部 dynamic 从 API 加载)
- `views/system/workflow-designer/index.vue:825` — `'审批': '✅'` 这只是 emoji map (`nodeIcon` 函数), 不是节点定义
- `views/system/workflow-designer/index.vue:482` — `getNodeSchemas()` API call, 加载 backend 返回的全部节点
- `controller/WorkflowNodeController.java:28-31` — `/api/mobile/workflow/node-schemas` 返回 `workflowNodeRegistry.getAllNodeSchemas()`
- `service/workflow/WorkflowNodeRegistry.java:34-57` — Spring DI 自动收集所有 `WorkflowNodeDescriptor` 实现
- `service/workflow/impl/` 目录共 **10 个 @Component 节点实现**:
  - `ApprovalNode.java` ← **审批节点**
  - CheckinCheckoutNode, CompletionMarkNode, CumulativeReportNode, EquipmentCheckNode
  - ExclusiveGatewayNode, ParallelGatewayNode, PlanCreationNode, QualityCheckNode, TimerTriggerNode

### ApprovalNode 真实配置 schema (`ApprovalNode.java:30-44`)

```yaml
nodeType: "approval"
displayName: "报工审批"          # ← 注意: 是"报工审批"不是通用审批
category: "审批"
configSchema:
  autoApproveRoles: [string]    # 自动审批角色
  batchApproveEnabled: boolean  # 批量审批
  reversalEnabled: boolean      # 冲销
  approvalLevels: int           # 1/2/3 级
  minApproversPerLevel: int
  approvalTimeoutMinutes: int   # 超时
  rejectionHandling: enum       # return_to_reporter / return_to_previous_node / escalate_to_admin
allowedNextNodes: ["completion_mark", "quality_check"]   # ← 流向: 报工审批后只能去完工或质检
```

### 真相 nuance

ApprovalNode 是 **production workflow state machine 里的"审批 state"**, 跟 `entity/config/ApprovalChainConfig.java` 是 **两套独立的审批系统**:

| 系统 | 后端实体 | 服务 | UI | 目的 |
|---|---|---|---|---|
| 生产工作流审批 | `StateMachine` + `WorkflowNodeDescriptor (ApprovalNode)` | `StateMachineService` (executeTransition) | `workflow-designer/index.vue` (已 ship 943 行) | ProcessTask "审批报工记录" 状态流转 |
| 通用审批链 | `ApprovalChainConfig` (flat list, 17 字段) | `ApprovalChainService` (requiresApproval / hasApprovalPermission) | **❌ 无 UI** | FORCE_INSERT / QUALITY_RELEASE / SUPPLIER_APPROVAL / ... 10 种决策类型的审批 |

两套**互不交换数据**:
- StateMachineService.executeTransition 读 StateMachine, 不读 ApprovalChainConfig
- ApprovalChainService.requiresApproval 读 ApprovalChainConfig, 不读 StateMachine
- ApprovalNode 的 `approvalLevels` / `autoApproveRoles` 字段跟 ApprovalChainConfig 的 `approvalLevel` / `approverRoles` **字段名相似但是不同表的不同数据**

判定: **2a (APPROVAL 节点真支持, 跟其他 9 节点同等级)** — 但语义指向 production workflow 不是 approval chain.

---

## 综合评估 — Path D 重判

Steve 的 rubric:
> 1a + 2a → Path D 3-7d 仍成立, 推荐 D

我的发现挑战这个判定: **1a + 2a 成立, 但 D 的目标 (统一审批编辑器) 跟现状结构不匹配**.

### Path D (原方案: 复用 workflow-designer 加 `entityType=APPROVAL_CHAIN`) 重新评估

- ✅ workflow-designer 真 ship 真 work — UI 层完全可复用
- ✅ ApprovalNode 真存在 — palette 拖出来直接用
- ❌ 但保存到 **StateMachine 表**, 而 ApprovalChainService (真审批引擎) 读 **ApprovalChainConfig 表**
- ❌ 即使存了, 没 executor 会 consume 这个 APPROVAL_CHAIN entityType 的 state machine — 因为 ApprovalChainService 不知道 StateMachine 表的存在
- ❌ Brief Day 12 "销售单审批 hardcoded → editor 接管" 不能通过 Path D 实现, 因为 hardcoded 审批走的是 ApprovalChainService.requiresApproval 路径
- **真实效果**: 编辑器存图, 但图没人执行 — UI 是糖衣, 后端审批引擎照跑老逻辑

### 三条修正后的路径

**Path D' (workflow-designer 复用 + StateMachine 表存图 + 加 ApprovalChain executor adapter)**
- 复用 workflow-designer UI ~1d (加 entityType=APPROVAL_CHAIN dropdown)
- 加 backend adapter: 让 `ApprovalChainService.requiresApproval` 优先读 StateMachine(entityType=APPROVAL_CHAIN, decisionType=X), 失败 fallback 到 ApprovalChainConfig — 5-7d
- 改 10 个 hardcoded approval callsites (QUALITY_RELEASE / FORCE_INSERT / etc.) 让它们通过新 adapter ~2-3d
- 改 backend → 越界 brief "纯前端" 约束
- 总: **8-11d (跨 backend)**

**Path B+ (新建 graph editor + 序列化进 ApprovalChainConfig flat rows)**
- 新建 `views/platform/approval-chain-editor/` ~3d
- 复用 @vue-flow ~2d
- 4 节点 + 2 edge Vue 组件 ~3d
- 序列化: graph → 多个 ApprovalChainConfig 行 (每节点 = 1 行, edge = escalationConfigId), 反序列化 multi-row → graph ~2-3d
- 限制 graph 拓扑只表达 flat-ApprovalChainConfig 能支持的 (线性审批级 + 条件分支)
- WorkflowSimulator mirror ApprovalChainService.requiresApproval 逻辑 ~2-3d
- Acceptance + E2E ~2d
- **纯前端**, backend 0 改
- 总: **12-15d (跟 brief 原估一致)**

**Path C+ (扩 backend schema, 真做 graph 引擎)**
- 新建 `ApprovalWorkflow` entity 含 nodes+edges columns ~2d backend
- ApprovalChainService 改读 ApprovalWorkflow (graph-aware) ~3-4d
- 前端复用 workflow-designer 加 APPROVAL_CHAIN entityType, 但写到 ApprovalWorkflow 而非 StateMachine ~3-5d
- 跨 scope, 跟 Track-E/H 撞 backend 修改风险
- 总: **8-12d (BUT 跨 backend, 跟 Track-E/H 协调)**

---

## 推荐

**Path B+ (新建独立 graph editor + 序列化到 flat ApprovalChainConfig 行)**, 12-15d 跟 brief 原估一致.

理由:
1. 严格遵守 brief "纯前端" 约束 — backend 0 改, 不跟 Track-E/H 撞
2. ApprovalChainConfig schema 不变, 现有 hardcoded callsites (FORCE_INSERT / QUALITY_RELEASE) 继续工作
3. 编辑器存的 graph **直接转成** ApprovalChainConfig 行, ApprovalChainService 真读到 — 真审批引擎真消费
4. workflow-designer/index.vue 仍然可参考其 UI pattern (节点拖拽 / 属性面板 tab / save / version / simulator), copy-adapt 不直接 fork — 估 30% time saving 仍然 valid
5. WorkflowSimulator mirror ApprovalChainService.requiresApproval 是 brief Day 10-11 已警告的关键 risk, Path B+ 透明可控 (前端拼 rows, 走同样的判断逻辑)

**不推荐 Path D**: UI 漂亮但跟真审批引擎脱钩, 是糖衣. brief Day 12 "editor 接管 hardcoded 审批" 不能交付.

**不推荐 Path C+**: 跨 scope, brief 说"纯前端", 跟 Track-E/H backend 协调风险.

**Path A list-form (我之前没列)**: 给 ApprovalChainConfig 做表格 CRUD UI, 3-5d, schema 1:1, 但 brief 明确要"拖拽编辑器" + "跟宏见拉平" — list-form 满足不了客户感官诉求, 排除.

---

## 等 Steve 拍板

D / B+ / C+ / 重新换 Path A / 还是其他.

Brief 原 12-15d 估值对应 Path B+ 是 honest. Path D 表面 3-7d 但因为编辑器存图无人 consume 是空运转, 不省时间, 只省 UI 工时.

(Day 1 用 ~45 min 完成 verification, Day 2 不开工等回复.)
