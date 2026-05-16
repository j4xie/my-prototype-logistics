# C-APPROVAL-EDITOR-1 Design Doc — Path C+ (ApprovalWorkflow Entity + Graph Executor)

**Sprint 3 Track-I**, 2026-05-16. Replaces marching-order's original "Path D (workflow-designer 复用)" — that was killed by Day 1 investigation. See `2026-05-16-c-approval-editor-investigation.md` for grep evidence.

**Estimated effort**: **8-12d** (frontend 5-7d + backend 3-5d). Beats brief original 12-15d by 3-7d.

**Owner**: this Track-I chat (single chat, no sub-dispatch).
**Branch**: `feature/sprint3-track-i-c-approval-editor-1`.
**Worktree**: `C:/Users/Steve/cretas-track-i`.

---

## 1. Background — 4 paths trade-off

| Path | 工时 | scope | trade-off | Verdict |
|---|---|---|---|---|
| **A** list-form CRUD UI on ApprovalChainConfig | 3-5d | 纯前端 schema 1:1 | brief 要"拖拽编辑器", list-form 满足不了客户感官诉求 (跟宏见拉平失败) | ❌ 排除 |
| **B+** new graph editor + 序列化 graph → multi-row flat ApprovalChainConfig | 12-15d | 纯前端 backend 0 改 | flat-list 表达不了真 DAG (并行/会签), editor 必须约束用户只画线性. 未来会签/转批/委托需求触发推倒重做 | ❌ 排除 (Steve 5月16决) |
| **C+** new `ApprovalWorkflow` entity (graph-native) + `ApprovalWorkflowExecutor` + dual-source ApprovalChainService | **8-12d** | backend 加性扩展 (新 entity 新 service, 现有不破) | graph 真消费, 4 种执行模式 (sequential/parallel/conditional/会签) 一次到位, Track-E/H 加性集成不撞 | ✅ **选** |
| **D** 复用 workflow-designer + entityType=APPROVAL_CHAIN | 3-7d | UI 复用最多, 改 StateMachine 表 | Day 1 investigation 死透: StateMachine 表 ≠ ApprovalChainConfig 表, ApprovalChainService 不读 StateMachine, 编辑器存图无人 consume = UI 糖衣空运转 | ❌ 排除 |

### 为什么 C+ (Steve 5月16决策)

1. **工时倒挂**: C+ 8-12d, B+ 12-15d — C+ 实际**比 B+ 快 3-4d** (新 entity simpler than squeezing graph into flat 17-field row + multi-row 反序列化逻辑)
2. **B+ 表达力封顶**: flat ApprovalChainConfig 写不出真 DAG, 第一个真客户提"会签 / N-of-M / 撤回 / 委托"需求 → B+ 12-15d 全废推倒. C+ 加 0d 工时避免未来重做, ROI > 0
3. **brief "纯前端" 约束是 brief 作者自设, 不是客户要求** — 这条 Steve 已戳穿, 后端加性扩展不破现状即可
4. **加性 not 破坏性**: ApprovalChainConfig 表保留, 现有 hardcoded 审批 callsites (FORCE_INSERT / QUALITY_RELEASE etc.) 继续工作. Track-E/H 不需要改, dual-source ApprovalChainService 自动 routing
5. **workflow-designer 943 行 UI pattern 仍然可参考** (节点 palette / 属性 tabs / save+publish / version diff / simulator) — copy-adapt 不 fork

---

## 2. Backend design

### 2.1 New entity: `ApprovalWorkflow`

**File**: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/ApprovalWorkflow.java`

```java
@Entity
@Table(name = "approval_workflows",
       uniqueConstraints = @UniqueConstraint(columnNames = {"factory_id", "decision_type", "name"}))
@Where(clause = "deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ApprovalWorkflow extends BaseEntity {

    @Id
    @GeneratedValue(generator = "uuid2")
    @org.hibernate.annotations.GenericGenerator(name = "uuid2", strategy = "uuid2")
    @Column(length = 36)
    private String id;

    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;

    /** 决策类型 — 复用 ApprovalChainConfig.DecisionType 10 种 enum, 不新增 */
    @Column(name = "decision_type", nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    private ApprovalChainConfig.DecisionType decisionType;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "description", length = 500)
    private String description;

    /**
     * Graph nodes — JSONB array of ApprovalWorkflowNode
     * 每节点: { id, type (start/approval/condition/parallel/join/notify/end),
     *           position {x,y}, config { ... type-specific } }
     */
    @Column(name = "nodes_json", nullable = false, columnDefinition = "jsonb")
    private String nodesJson;

    /**
     * Graph edges — JSONB array of ApprovalWorkflowEdge
     * 每 edge: { id, source (nodeId), target (nodeId),
     *            condition (SpEL), label }
     */
    @Column(name = "edges_json", nullable = false, columnDefinition = "jsonb")
    private String edgesJson;

    @Column(name = "start_node_id", length = 50)
    private String startNodeId;

    @Column(name = "version")
    @Builder.Default
    private Integer version = 1;

    @Column(name = "publish_status", length = 20)
    @Builder.Default
    private String publishStatus = "draft";    // draft / published / archived

    @Column(name = "enabled")
    @Builder.Default
    private Boolean enabled = true;

    @Column(name = "priority")
    @Builder.Default
    private Integer priority = 0;
}
```

**Co-located DTO classes** (`backend/.../entity/config/ApprovalWorkflowNode.java`, `ApprovalWorkflowEdge.java`) — POJO for Jackson, deserialized from `nodes_json` / `edges_json`.

### 2.2 ApprovalWorkflowNode types (7 types)

| `type` | 用途 | config schema |
|---|---|---|
| `start` | 工作流入口 | `{}` (无配置) |
| `approval` | 单个审批步骤 | `{ approverRoles: string[], approverUserIds?: string[], requiredApprovers: int (1=单签, ≥2=会签), timeoutMinutes: int, autoApproveCondition?: SpEL, autoRejectCondition?: SpEL }` |
| `condition` | 条件分叉 (相当于 if/else) | `{ description: string }` — 实际条件在 outgoing edges 的 `condition` 字段 |
| `parallel` | 并行分叉 (fan-out, 所有 outgoing 同时启动) | `{ description: string }` |
| `join` | 汇合节点 (会签 join / parallel join) | `{ mode: "ALL" \| "N_OF_M" \| "ANY", n?: int (mode=N_OF_M 时需要), description: string }` |
| `notify` | 通知节点 (推 InAppNotification, 不阻塞流程) | `{ notifyRoles: string[], notifyTemplate?: string }` |
| `end` | 工作流结束 | `{ outcome: "APPROVED" \| "REJECTED" \| "TIMEOUT" \| "CANCELLED" }` |

### 2.3 ApprovalWorkflowEdge structure

```typescript
{
  id: string,
  source: string,        // 起点 nodeId
  target: string,        // 终点 nodeId
  condition?: string,    // SpEL (空 = 无条件 / 总是走). 例: "#amount > 10000"
  label?: string         // 显示标签 (>10000 / 主管同意 / etc.)
}
```

### 2.4 Flyway migration

**File**: `backend/java/cretas-api/src/main/resources/db/migration/V20260516_05__create_approval_workflow.sql`

```sql
CREATE TABLE approval_workflows (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    decision_type VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    nodes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    edges_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    start_node_id VARCHAR(50),
    version INTEGER NOT NULL DEFAULT 1,
    publish_status VARCHAR(20) NOT NULL DEFAULT 'draft',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    priority INTEGER NOT NULL DEFAULT 0,

    -- BaseEntity audit (per database-entity-sync.md rule)
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP NULL,

    CONSTRAINT uk_approval_workflows_factory_type_name UNIQUE (factory_id, decision_type, name)
);

CREATE INDEX idx_approval_workflows_factory_type
    ON approval_workflows (factory_id, decision_type, enabled, publish_status)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_approval_workflows_priority
    ON approval_workflows (factory_id, decision_type, priority DESC)
    WHERE deleted_at IS NULL AND enabled = TRUE;

-- auto-update trigger (per database-entity-sync.md PG pattern)
CREATE OR REPLACE FUNCTION update_approval_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_approval_workflows_updated_at
BEFORE UPDATE ON approval_workflows
FOR EACH ROW EXECUTE FUNCTION update_approval_workflows_updated_at();
```

**Migration runner**: per `server-operations.md` ⛔ smartbi-migrations rule — 这是 cretas 主库不是 smartbi, 走标准 Flyway not the smartbi runner. Deploy `./scripts/deploy/deploy-backend.sh` automatically applies via Spring Boot Flyway integration.

### 2.5 ApprovalWorkflowService (CRUD)

**File**: `backend/.../service/ApprovalWorkflowService.java`

```java
public interface ApprovalWorkflowService {
    // CRUD
    ApprovalWorkflow create(String factoryId, ApprovalWorkflow workflow);
    ApprovalWorkflow update(String factoryId, String id, ApprovalWorkflow partial);
    void delete(String factoryId, String id);
    Optional<ApprovalWorkflow> getById(String factoryId, String id);
    List<ApprovalWorkflow> getAllByFactory(String factoryId);
    List<ApprovalWorkflow> getByDecisionType(String factoryId, ApprovalChainConfig.DecisionType decisionType);

    // Lookup for executor — published + enabled + highest priority for given decision type
    Optional<ApprovalWorkflow> getActiveByDecisionType(String factoryId, ApprovalChainConfig.DecisionType decisionType);

    // Lifecycle
    ApprovalWorkflow publishDraft(String factoryId, String id);
    ApprovalWorkflow archiveVersion(String factoryId, String id);

    // Validation
    Map<String, Object> validateGraph(ApprovalWorkflow workflow);    // 校验 start node 唯一 / 无孤立 / 无环 / join node mode 合法 / SpEL syntax valid
}
```

### 2.6 ApprovalWorkflowExecutor (graph runtime engine)

**File**: `backend/.../service/workflow/ApprovalWorkflowExecutor.java`

核心 API:

```java
public interface ApprovalWorkflowExecutor {

    /** 启动一个 approval workflow 实例 */
    ExecutionContext start(ApprovalWorkflow workflow, Map<String, Object> businessContext, Long initiatorUserId);

    /** 提交一个审批决定 (approve / reject) */
    ExecutionContext submit(ExecutionContext ctx, String currentNodeId, ApprovalDecision decision, Long approverUserId);

    /** 查询当前活跃节点 + 等待的 approver */
    List<PendingApproval> getPending(ExecutionContext ctx);

    /** 取消整个 workflow 实例 */
    ExecutionContext cancel(ExecutionContext ctx, Long cancellerUserId, String reason);

    /** 超时升级 (Scheduler 调用) */
    ExecutionContext escalate(ExecutionContext ctx, String timeoutNodeId);
}
```

**4 种执行模式** (per node `type`):

| Mode | Trigger | 行为 |
|---|---|---|
| **Sequential** | `approval` node, `requiredApprovers=1` | 单签, approve → 走 outgoing edges (按 condition 评估选第一个 match 的 edge); reject → 走标签 "REJECTED" 的 edge, 或回 start, 或 end(REJECTED) (per node config rejectionHandling) |
| **Parallel** | `parallel` node | Fan-out 所有 outgoing edges 同时启动子分支. 每条分支独立跑直到撞 `join` node. |
| **Conditional** | `condition` node | 评估 outgoing edges 的 `condition` SpEL, 选第一个 true 的 edge 走 (其余跳过). 全 false → end(REJECTED) with reason. |
| **会签 (N-of-M Join)** | `join` node, `mode=ALL/N_OF_M/ANY` | 等待 incoming branches 全部完成 (ALL) / N 个完成 (N_OF_M) / 任一完成 (ANY). 满足条件后继续 outgoing edge. |

**ExecutionContext** (运行时状态, 暂存内存或 Redis):

```java
class ExecutionContext {
    String workflowId;            // ApprovalWorkflow.id
    String businessRefId;         // 业务单据 ID (e.g. quality_inspection.id)
    DecisionType decisionType;
    Map<String, Object> businessContext;    // amount / department / role 等 SpEL evaluator input
    Set<String> activeNodeIds;    // 当前活跃节点 (并行时多个)
    Map<String, List<ApprovalRecord>> nodeHistory;    // 每节点的审批记录
    Long initiatorUserId;
    Instant startedAt;
    String status;    // RUNNING / APPROVED / REJECTED / CANCELLED / TIMEOUT
}
```

**Note on persistence**: Day 2-4 backend ship 时, ExecutionContext 可以先纯内存 + Redis cache (单实例 dev 部署够用). Production-grade 持久化到 `approval_workflow_instances` 表是 follow-up (P2, 不在本 Track 工时).

### 2.7 ApprovalChainService dual-source fallback

**File 改**: `backend/.../service/impl/ApprovalChainServiceImpl.java`

```java
@Override
public boolean requiresApproval(String factoryId, DecisionType decisionType, Map<String, Object> context) {
    // ① 先查 ApprovalWorkflow (graph-native)
    Optional<ApprovalWorkflow> workflow = approvalWorkflowService.getActiveByDecisionType(factoryId, decisionType);
    if (workflow.isPresent()) {
        log.debug("使用 graph workflow: factoryId={}, decisionType={}, workflowId={}",
                  factoryId, decisionType, workflow.get().getId());
        // graph 存在即认定需要审批 (graph 自身管 auto-approve 逻辑)
        return true;
    }

    // ② Fallback to legacy flat ApprovalChainConfig
    log.debug("Fallback to legacy ApprovalChainConfig: factoryId={}, decisionType={}",
              factoryId, decisionType);
    return existingLegacyRequiresApproval(factoryId, decisionType, context);
}
```

**核心: dual-source 读, single-source 写**:
- 新建审批 graph → 写 `ApprovalWorkflow` 表
- 老审批 flat config → 写 `ApprovalChainConfig` 表 (不动现有)
- ApprovalChainService.requiresApproval 优先读 graph, 否则 fallback
- Track-E/H callsites 调 `requiresApproval()` 不需要任何改动

### 2.8 单元测试

`backend/.../service/workflow/ApprovalWorkflowExecutorTest.java` ≥ 10 cases:

1. Sequential 1-step approve → end(APPROVED)
2. Sequential 1-step reject → end(REJECTED)
3. Sequential 3-step approve chain (起 → A → B → C → end)
4. Conditional split: amount > 10000 → A, else → B
5. Parallel fan-out 2 branches → join ALL → end
6. Parallel fan-out 3 branches → join N_OF_M (2 of 3) → end
7. Parallel fan-out 3 branches → join ANY → end (first done wins)
8. Timeout escalation: approver 不动 → timeoutMinutes 后升级到 escalationConfigId
9. AutoApprove SpEL: condition 满足 → 自动通过, 跳过 approver
10. Cancel mid-flow: 任意节点 cancel → 整个实例 status=CANCELLED

并加 parity test: 同样业务输入, dual-source fallback 路径跟 graph 路径在 simple linear case 下输出一致.

---

## 3. Frontend design

### 3.1 目录结构

```
web-admin/src/views/platform/approval-workflow-editor/
├── index.vue                      (主页面 ~600 行, copy-adapt from workflow-designer/index.vue)
├── components/
│   ├── NodePalette.vue            (左侧 7 节点拖拽栏)
│   ├── PropertyPanel.vue          (右侧节点+edge 属性面板, 含 SpEL editor)
│   ├── WorkflowSimulator.vue      (前端模拟 ApprovalWorkflowExecutor 逻辑)
│   ├── nodes/
│   │   ├── StartNode.vue
│   │   ├── ApprovalNode.vue        (含 approverRoles / requiredApprovers / timeoutMinutes / 会签人数)
│   │   ├── ConditionNode.vue       (rhombus shape)
│   │   ├── ParallelNode.vue        (fan-out)
│   │   ├── JoinNode.vue            (mode: ALL / N_OF_M / ANY)
│   │   ├── NotifyNode.vue
│   │   └── EndNode.vue             (outcome: APPROVED/REJECTED/TIMEOUT/CANCELLED)
│   └── edges/
│       └── ConditionalEdge.vue     (label + condition SpEL)
└── composables/
    ├── useApprovalWorkflow.ts     (load/save/publish workflow)
    └── useSimulator.ts            (run simulator + 高亮路径)
```

### 3.2 API client

**File**: `web-admin/src/api/approvalWorkflow.ts`

```typescript
export interface ApprovalWorkflowDTO {
  id: string;
  factoryId: string;
  decisionType: string;
  name: string;
  description?: string;
  nodesJson: ApprovalWorkflowNode[];   // 后端 JSONB, 前端 typed
  edgesJson: ApprovalWorkflowEdge[];
  startNodeId: string;
  version: number;
  publishStatus: 'draft' | 'published' | 'archived';
  enabled: boolean;
  priority: number;
}

export const getAllWorkflows = (factoryId: string) =>
  request.get<ApiResponse<ApprovalWorkflowDTO[]>>(`/api/mobile/${factoryId}/approval-workflows`);

export const getWorkflow = (factoryId: string, id: string) =>
  request.get<ApiResponse<ApprovalWorkflowDTO>>(`/api/mobile/${factoryId}/approval-workflows/${id}`);

export const saveWorkflow = (factoryId: string, payload: Partial<ApprovalWorkflowDTO>) =>
  request.post<ApiResponse<ApprovalWorkflowDTO>>(`/api/mobile/${factoryId}/approval-workflows`, payload);

export const publishWorkflow = (factoryId: string, id: string) =>
  request.patch<ApiResponse<ApprovalWorkflowDTO>>(`/api/mobile/${factoryId}/approval-workflows/${id}/publish`);

export const simulateWorkflow = (factoryId: string, id: string, businessContext: Record<string, unknown>) =>
  request.post<ApiResponse<SimulationResult>>(`/api/mobile/${factoryId}/approval-workflows/${id}/simulate`, businessContext);
```

### 3.3 Copy-adapt scope from workflow-designer/index.vue

| workflow-designer pattern | C-APPROVAL-EDITOR-1 adopt as-is | 改写需要 |
|---|---|---|
| `<VueFlow>` + `<Background>` + `<Controls>` 主画布 | ✅ as-is | 无 |
| 左侧 palette 拖拽 onDragStart/onDrop pattern | ✅ as-is | palette 改成 7 节点 (start/approval/condition/parallel/join/notify/end) |
| 右侧 propTab + el-tabs(基础/配置/高级) | ✅ as-is | 配置字段改为 ApprovalWorkflowNode.config (per type) |
| save/publish/version history dialog | ✅ as-is | API 改 approval-workflows endpoint |
| validateWorkflow() function | ✅ as-is | 校验规则改 (start node 唯一 / join node mode 合法 / etc.) |
| simulation mode (toggleSimulation/simStep/simReset/simAvailableTransitions) | 🟡 重写, 但 UI pattern 复用 | 跟 ApprovalWorkflowExecutor 逻辑 mirror (per ⚠ Rule below) |
| Custom node `<template #node-workflow>` rendering | 🟡 复用 pattern, 7 节点各自渲染 | 重写 7 个 node Vue component |
| edge label + animated styling | ✅ as-is | 添加 condition SpEL 显示在 label |

**⚠ Rule**: Simulator vs real executor parity 是 brief Day 10-11 已警告的关键 risk. 实施时:
- Simulator 跟 ApprovalWorkflowExecutor **共用 condition SpEL evaluator** (前端 simple JS impl, 后端 Spring SpEL — 实施时考察是否引入轻量 SpEL JS port, 或限定 condition syntax 为 simple expressions 前端可解析)
- 10 个 random mock case 跑 simulator vs `POST /simulate` endpoint 比对 — DoD: 10/10 一致
- 不一致点立即停 fix simulator

### 3.4 Vue Router 加 route

**File 改**: `web-admin/src/router/index.ts`

```typescript
{
  path: '/platform/approval-workflow-editor',
  name: 'ApprovalWorkflowEditor',
  component: () => import('@/views/platform/approval-workflow-editor/index.vue'),
  meta: {
    title: '审批流程编辑器',
    icon: 'mdi-account-check',
    requireAuth: true,
    requireRoles: ['factory_super_admin'],
    requirePermissions: ['system:read_write'],
  },
},
```

**冲突说明**: Track-J (C-PRT-EDITOR-1) 也加 router.ts route. 我 Track-I 后到的 PR 自己处理 3-行 rebase conflict (HARD rule: `feedback_organizer_brief_grep_before_assume.md` 之外, brief 已明示).

### 3.5 RBAC

- 只 `factory_super_admin` + `factory_admin` 可访问编辑器页 (per router meta)
- 后端 ApprovalWorkflowController 加 `@RequirePermission({"system:read_write"})` (同 ApprovalChainController pattern)

---

## 4. Track-E/H integration interface

**Track-E (F-VFLAG-1, 凭证 Voucher)** 跟 **Track-H (M-BOM-VER-1, ECN)** 触发审批的接口:

```java
// 他们的 service 调用 (已存在的接口, 不需要改):
boolean needsApproval = approvalChainService.requiresApproval(
    factoryId,
    ApprovalChainConfig.DecisionType.CUSTOM,    // 或 QUALITY_RELEASE / SUPPLIER_APPROVAL etc.
    Map.of(
        "amount", voucherAmount,
        "department", department,
        "businessRefId", voucherId
    )
);
```

**对 Track-E/H 的 commitment**:
- 他们调用的 method **签名不变, 行为加性扩展**:
  - 当 factory **有** ApprovalWorkflow (publishStatus=published, enabled=true) for given decisionType → 我新 service 接管, executor 跑 graph
  - 当 factory **无** ApprovalWorkflow → fallback to 现有 ApprovalChainConfig flat-list 逻辑 (Track-E/H 无感)
- Track-E/H 同一 Sprint 3 内不需要做任何配合改动
- 未来 (Sprint 4+) 客户配置 graph workflow 后, Track-E/H 业务自动获得新行为

**对 Track-E (Voucher) decisionType 建议**: 借用 `CUSTOM` enum (per 5-15 早决策), `name='Voucher_Approval_Standard'` 区分
**对 Track-H (ECN) decisionType 建议**: 借用 `CUSTOM`, `name='ECN_Approval_Standard'`

(Sprint 4 可考虑扩 DecisionType enum 加 `VOUCHER_APPROVAL` / `ECN_APPROVAL` — 但本 Track 不动)

---

## 5. Day timeline (replaces brief Day 1-15)

| Day | Phase | 输出 | Gate |
|---|---|---|---|
| **Day 1** (今 5-16) | Investigation + Design | `2026-05-16-c-approval-editor-investigation.md` + 本 design doc | 🛑 **Steve review 通过本 doc** 才开 Day 2 |
| **Day 2** | Backend entity + Flyway | `ApprovalWorkflow.java`, `ApprovalWorkflowNode.java`, `ApprovalWorkflowEdge.java`, `V20260516_05__*.sql` | 本地 `mvn clean package` 过, Flyway 本地 apply 成功 |
| **Day 3** | Backend service CRUD | `ApprovalWorkflowService` + impl + Controller + DTO + repository | 单测 CRUD ≥ 6 case PASS |
| **Day 4** | Backend executor | `ApprovalWorkflowExecutor` + 4 modes + ExecutionContext + integration with ApprovalChainService dual-source | 单测 executor ≥ 10 case PASS, parity test with flat-list fallback PASS |
| **Day 5** | Frontend scaffold | `views/platform/approval-workflow-editor/index.vue` (copy-adapt 主框架, 节点 palette 空, edge 空) | `vue-tsc` + `vite build` PASS |
| **Day 6** | 7 node Vue components | `StartNode/ApprovalNode/ConditionNode/ParallelNode/JoinNode/NotifyNode/EndNode.vue` | 7 节点拖到画布渲染正常 |
| **Day 7** | PropertyPanel + ConditionalEdge | 节点+edge 属性面板, SpEL editor input | 属性修改实时反映 graph |
| **Day 8** | API integration + save/publish | `useApprovalWorkflow.ts` composable, 接 backend endpoint | 拖图 → save → DB row 出现 → reload graph identity round-trip |
| **Day 9** | Simulator | `WorkflowSimulator.vue` + `useSimulator.ts`, 10 mock case parity with backend executor | 10/10 case 前后端一致 |
| **Day 10** | E2E + PR | Acceptance test (ECN graph + QUALITY_RELEASE graph + 真实业务单触发) + `gh pr create` | E2E PASS, vue-tsc + vitest + Java test 全过 |

**Steve gates**:
- Day 1 末: 本 design doc review (今天)
- Day 4 末: backend done, ping Steve verify schema + executor 行为
- Day 7 末: UI scaffold ping Steve 看交互流畅度
- Day 10: PR ping Steve

总: **8-12d (vs brief 12-15d)**. Day 2-10 实际 = 9 个 chat working day, 估 7-9 个 Claude 加速 day.

---

## 6. Risks + mitigations

| Risk | Mitigation | When? |
|---|---|---|
| **R1: SpEL JS 实现** — simulator 跟 backend SpEL evaluator 不一致 | Day 9 第一步: 选定 syntax 子集 (限制为 `#var > N`, `#var == "x"`, `&&`, `\|\|`, parens). 前端写 simple recursive descent parser ~150 行 | Day 9 |
| **R2: ExecutionContext 内存持久化** — 单实例 dev OK, 多实例 prod 重启丢状态 | Day 4 实施先 Redis cache pattern (key=executionId), prod 重启可恢复. Persistent table follow-up (Sprint 4) | Day 4 |
| **R3: workflow-designer copy-adapt 估值乐观** — 943 行直接拿过来可能跟新 API 不兼容 | Day 5 第一步: 把 workflow-designer 整文件复制 + rename + 改 import paths, 跑通 build. 跑不通 → 不 fork, 真重写 simple version | Day 5 |
| **R4: 并发编辑** — 2 个 admin 同时编辑同 workflow → 后保存覆盖前 | Day 8 后端加 optimistic-lock (version 字段递增 + 冲突报错), 前端 dialog 提示刷新. 复用 PageEditor 已有 rowVersion pattern | Day 8 |
| **R5: 图校验复杂性** — graph 拓扑校验 (无环 / 单 start / 所有 join 有对应 fan-out / SpEL syntax) 可能踩 corner case | Day 3 写完 validateGraph 后, 5 个 invalid graph fixture + 5 个 valid fixture 单测覆盖 | Day 3 |
| **R6: workflow-designer fork conflict** — 我加 entityType=APPROVAL_CHAIN 担心搞乱原 designer | **不 fork**: 新建独立 `approval-workflow-editor/`, workflow-designer 不动 | N/A |
| **R7: Track-J 同样改 router.ts** | 后到的 PR 自己 rebase 3 行 conflict (per brief 已说) | Day 10 PR |

---

## 7. Acceptance gates (DoD, 替换 brief 原 8 条)

- [ ] Backend: `approval_workflows` 表存在 + Flyway V20260516_05 ship
- [ ] Backend: `ApprovalWorkflowService` CRUD + lifecycle (draft/publish/archive) + validateGraph
- [ ] Backend: `ApprovalWorkflowExecutor` 4 modes (sequential / parallel / conditional / 会签 N-of-M) ≥ 10 单测 PASS
- [ ] Backend: `ApprovalChainService.requiresApproval` dual-source: graph 优先, fallback to flat ApprovalChainConfig — parity 单测 PASS
- [ ] Frontend: `views/platform/approval-workflow-editor/` 可拖 7 节点 + ConditionalEdge
- [ ] Frontend: PropertyPanel 字段对齐 ApprovalWorkflowNode.config schema (per node type)
- [ ] Frontend: Serialize round-trip identity (graph → JSON → save → reload → graph 完全一致)
- [ ] Frontend: WorkflowSimulator 跟 backend `/simulate` endpoint 10 random mock case 一致
- [ ] E2E: login factory_admin → 拖 ECN graph (Create→ApproverA→Conditional amount>10k→并行 [质检 + 采购] →Join ALL→End_APPROVED) → 保存发布 → 创建模拟 ECN 业务单 → 跑真实 executor → 路径正确
- [ ] E2E: 同 QUALITY_RELEASE 简单线性 graph (Create→Approver→End_APPROVED) 跑通
- [ ] 不破现状: 现有 hardcoded approval callsites (Track-E/H 当前 callsites + FactoryConfigAgentTool 等) regression PASS
- [ ] RBAC: 非 factory_admin 角色访问编辑器 → 403 (router guard + backend `@RequirePermission`)
- [ ] CI: `vue-tsc` + `vite build` + `vitest run` + `mvn test` 全过 (per HARD rules `vite-build-only-catches-vue-ts-import-paths` + `vitest-invariant-tests-not-run-by-vite-build`)

---

## 8. Open questions (Steve review 时确认)

1. **ExecutionContext 持久化**: Day 4 用 Redis cache 够 dev 用? Sprint 4 follow-up 加 `approval_workflow_instances` 表? (我假设 yes — Sprint 3 scope cap)
2. **SpEL JS subset**: 限制 condition 语法为 `#var op literal` + `&&` + `||` + parens + 不含函数调用 — 够 Day 10 demo? (我假设 yes — 复杂 SpEL fallback 到 backend `/simulate` 计算)
3. **DecisionType enum 扩展**: Track-E 凭证 / Track-H ECN 用 CUSTOM 兜底 + name 区分 (Sprint 3 内), 或 Sprint 4 加 `VOUCHER_APPROVAL` / `ECN_APPROVAL` 枚举值 — 我倾向后者 follow-up. 是?
4. **简化 vs 完整 - 起步**: Day 10 demo 是否只跑 sequential + conditional 2 种 mode? parallel + join 留到 Day 11-12 if time? (我估计 Day 10 全 4 种 mode 跑 demo 可行, 但 fallback plan)
5. **不动 ApprovalConfigTool (AI Tool 现存)**: brief Day 12 提的, 我假设 keep 现状 (它仍然写到 ApprovalChainConfig flat-list, 新 editor 不接管 AI 工具流) — 是?

---

**Day 1 写到这里 stop**. 等 Steve review.

Next action 取决于 review: GO → Day 2 backend entity + Flyway. HOLD → 改 design doc per Steve feedback.
