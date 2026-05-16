# Sprint 3 Track-I C-APPROVAL-EDITOR-1 — Marching Order

**Dispatched**: 2026-05-16
**Target chat**: fresh Claude Code session, no prior context
**Branch**: `feature/sprint3-track-i-c-approval-editor-1`
**Estimated effort**: **12-15 days frontend major** (原估 20d, grep 发现 @vue-flow/core + PageEditor 现存可复用, 下调)
**Backlog**: `宏见竞品分析/06-宏见测试账号深度审计/28-CRETAS-PRIORITIZED-BACKLOG.md` §1.1 row 5 (P0 战略)
**Audit reference**: `宏见竞品分析/06-宏见测试账号深度审计/30-BACKLOG-STATUS-AUDIT.md` §2

## Goal

实现 **工作流可视化拖拽编辑器** (后端 ApprovalChainConfig 100% ready, 仅缺前端). 客户自服务能力 — 不用找开发改审批流, 可视化拖拽:

- 节点类型: 创建 / 审批 / 系统操作 / 通知
- 节点属性: 审批人角色 (`approverRoles`) / 审批级别 (`approvalLevel`) / 超时 (`timeoutMinutes`) / 自动通过条件 (`autoApproveCondition`)
- 流转规则: 金额阈值 / 部门 / 角色判断
- 多分支 + 并行 + 会签

宏见参考: `workflow.hongjian.com/workflow/workflowshow.jsp` — jsPlumb 拖拽 + 126 个独立工作流定义.

⭐ **Cretas 现状 (grep verify)**:
- `@vue-flow/core 1.48.2` 已 install (`@vue-flow/background` + `@vue-flow/controls` 同 install)
- `web-admin/src/views/platform/canvas-editor/PageEditor.vue` 现存 (Sprint 0 → Sprint 1 Track-A 已 ship 的 canvas editor)
- ApprovalChainConfig 全字段 ready: `decisionType / approvalLevel / requiredApprovers / approverRoles / approverUserIds / timeoutMinutes / autoApproveCondition / autoRejectCondition / priority / enabled / version`

**这意味着 20d 估算 高估了 5-8d**. 实际 12-15d 含: 5d 节点/edge 组件 + 4d 序列化到 ApprovalChainConfig JSON + 3d 模拟测试 + 2-3d acceptance.

## Prerequisites done

- ✅ Backend 100% ready: ApprovalChainConfig + Controller + Service + ApprovalNode + ApprovalTimeoutScheduler
- ✅ @vue-flow/core 1.48.2 + Vue 编辑器组件库
- ✅ PageEditor.vue (Sprint 1 Track-A ship 的 canvas editor) 提供拖拽 + 保存 pattern
- ✅ ApprovalConfigTool (AI Tool 现存) — 可作为 backend integration test
- ⏳ Track-H (M-BOM-VER-1) 同期 ship — ECN 审批可作为本编辑器第一个真实场景
- ⏳ Track-E (F-VFLAG-1) 同期 ship — 凭证审批可作为本编辑器第二个真实场景

## Read these files first

1. `宏见竞品分析/06-宏见测试账号深度审计/02-系统管理-deep-audit.md` Round 5 工作流可视化实测
2. `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/ApprovalChainConfig.java` — 17 字段全 verified
3. `backend/java/cretas-api/src/main/java/com/cretas/aims/service/workflow/impl/ApprovalNode.java` — 节点结构
4. `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ApprovalChainController.java` — REST endpoints
5. `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/system/ApprovalConfigTool.java` — 现存 AI Tool
6. `web-admin/src/views/platform/canvas-editor/PageEditor.vue` — Sprint 1 ship 的 canvas editor (复用基础)
7. `web-admin/src/views/platform/canvas-editor/components/FormCanvas.vue` — canvas 渲染 reference
8. `web-admin/package.json` — `@vue-flow/*` 1.48.2 / 1.3.2 / 1.1.3 verified
9. `.claude/rules/api-response-handling.md` / `typescript-type-safety.md`

## Concrete tasks

### Day 1-2: 评估 PageEditor 复用度 + 设计

打开 `PageEditor.vue` + `FormCanvas.vue` 看现有 canvas 编辑器架构. 决定:

- **方案 A (推荐)**: 新建 `WorkflowEditor.vue` (类比 PageEditor) + 复用 `@vue-flow/core` (PageEditor 也用它), 但节点类型完全不同 (4 节点类型 vs PageEditor 的 form 字段类型)
- **方案 B**: 直接 fork PageEditor → 大量修改, 风险耦合
- **方案 C**: 跟 PageEditor 共享 base canvas component, 节点类型 plug-in

写 design doc `docs/superpowers/specs/2026-05-16-c-approval-editor-design.md` (~200 lines).

### Day 3-5: Workflow nodes + edges Vue 组件

`web-admin/src/views/platform/workflow-editor/`:

```
WorkflowEditor.vue          (主页面)
nodes/
  CreateNode.vue           (创建节点 - 业务单提交入口)
  ApproveNode.vue          (审批节点 - 含 approver / level / timeout 属性)
  SystemNode.vue           (系统操作节点 - 自动改状态/触发 hook)
  NotifyNode.vue           (通知节点 - 推送 InAppNotification)
edges/
  ConditionalEdge.vue      (条件 edge - 金额 / 部门 / 角色判断)
  ParallelEdge.vue         (并行 edge - 多审批人 同时进行)
sidebar/
  NodePalette.vue          (左侧节点拖拽栏)
  PropertyPanel.vue        (右侧节点属性配置面板)
toolbar/
  WorkflowToolbar.vue      (保存/测试/版本切换)
```

### Day 6-7: 节点属性 ↔ ApprovalChainConfig 字段映射

每节点属性面板 ↔ Backend ApprovalChainConfig field:

| Vue 节点属性 | Backend ApprovalChainConfig field | 说明 |
|---|---|---|
| 节点名称 | `name` | required |
| 描述 | `description` | optional |
| 触发条件 | `triggerCondition` | JSON e.g. `{amount: {gt: 10000}}` |
| 审批级别 | `approvalLevel` | int 1-N |
| 审批人数 | `requiredApprovers` | int (1=单人, ≥2=会签) |
| 审批人角色 | `approverRoles` | "factory_admin,finance_manager" |
| 审批人 userIds | `approverUserIds` | "u1,u2" |
| 超时 (分钟) | `timeoutMinutes` | int |
| 升级到... | `escalationConfigId` | FK to 另一 ApprovalChainConfig |
| 自动通过条件 | `autoApproveCondition` | JSON |
| 自动拒绝条件 | `autoRejectCondition` | JSON |
| 优先级 | `priority` | int (高优先级先匹配) |
| 启用 | `enabled` | boolean |

### Day 8-9: 序列化 + 反序列化

VueFlow nodes/edges → JSON ApprovalChain 结构:

```typescript
interface ApprovalChainDefinition {
  factoryId: string;
  decisionType: "SALES_ORDER_APPROVAL" | "PURCHASE_ORDER_APPROVAL" | "ECN_APPROVAL" | ...;
  name: string;
  startNodeId: string;
  nodes: WorkflowNode[];     // 含 ApprovalChainConfig 字段
  edges: WorkflowEdge[];     // 含 condition expression
  version: number;
}
```

POST `/api/mobile/{factoryId}/config/approval-chain` 保存. 用 ApprovalChainController 现存 endpoint.

### Day 10-11: 测试模拟器 (前端)

`WorkflowSimulator.vue`:
- 输入 mock 业务单 (e.g. salesOrder amount=15000)
- 跑工作流: 触发哪个 node → 走哪条 edge → 最终 approver 列表
- 高亮显示执行路径
- 不实际调 backend, 纯前端模拟引擎 (跟 ApprovalChainService 后端逻辑 mirror)

### Day 12: 接入 Cretas 真实场景

- ECN 审批 (Track-H ship 后): factory admin 拖拽创建 ECN 审批链, 保存, 立即生效
- 凭证审批 (Track-E ship 后): finance manager 拖拽创建 Voucher 审批链 (借贷 ≥ 1万自动多级)
- 销售单审批: 已有 hardcoded, 用 editor 接管 (向后兼容)

### Day 13-14: Acceptance + smoke

E2E:
1. Login admin → 进 WorkflowEditor → 拖 5 节点 (Create → Approve A → Conditional → Approve B/C → Notify)
2. 设置 conditional edge: amount > 10000 → Approve B, else Approve C
3. 保存 → POST 到 ApprovalChainController → ApprovalChainConfig + nodes saved
4. 跑 Simulator: 销售单 amount=15000 → 高亮 A → B → Notify 路径
5. 创建真实销售单 amount=15000 → 走真实审批 → 跟 simulator 一致

### Day 15: PR

```bash
gh pr create --title "[Sprint3-I] C-APPROVAL-EDITOR-1 工作流可视化编辑器 (Vue + @vue-flow + ApprovalChainConfig serialize)"
```

## Acceptance gates (DoD)

- [ ] WorkflowEditor.vue 可拖 4 节点 + 2 edge 类型
- [ ] PropertyPanel.vue 13 字段对齐 ApprovalChainConfig
- [ ] 序列化 ↔ 反序列化 round-trip identity
- [ ] WorkflowSimulator.vue 前端模拟引擎跟后端 ApprovalChainService 一致 (随机 10 mock case 比对)
- [ ] E2E: 拖拽 + 保存 + simulator + 真实业务单跑通
- [ ] 不破坏现存 hardcoded approval chains (regression: 现存 ApprovalChainConfig 行 还可用)
- [ ] RBAC: 只 factory_admin / role:workflow:edit 可编辑
- [ ] Vue build + vitest 全过 (per HARD rule `feedback_vite_build_only_catches_vue_ts_import_paths.md` + `feedback_vitest_invariant_tests_not_run_by_vite_build.md`)

## Branch + PR

```bash
git checkout -b feature/sprint3-track-i-c-approval-editor-1
gh pr create --title "[Sprint3-I] C-APPROVAL-EDITOR-1 工作流可视化编辑器"
```

## Risks + watchouts

1. **PageEditor 复用度评估** — Day 1-2 关键. 若 PageEditor 内部架构跟 workflow 节点完全不兼容, 可能要重做基础. Day 2 末必出 design doc 给 Steve approve 之后才开始 Day 3+
2. **@vue-flow learning curve** — 之前 PageEditor 用了, 但 workflow 节点更复杂 (conditional edge / parallel branch). 估 1d 学习
3. **JSON schema 跟 ApprovalChainConfig 字段映射** — 字段 13 个, 不要漏 timeoutMinutes / escalationConfigId
4. **Simulator vs real engine 一致** — 关键 risk. ApprovalChainService 后端逻辑 复杂 (会签 / 升级 / 超时), 前端 simulator 必须 mirror. Day 10-11 投足时间, 否则客户上线后 simulator 跟实际不一致
5. **多 Tab 并发编辑** — Steve 现在常 2 个 Vue editor 开同 chain 风险. localStorage lock or backend lastUpdated check
6. **canViewPrice RBAC** — 节点属性配置不含价格. 但 triggerCondition 可能含 amount > N, UI 显示要照 canViewPrice 隐藏数字 (跟 Track-B1 C-RBAC-1 hooks 配合)
7. **Flyway 不要碰** (本 Track 纯前端, 不加表). 若需新表 (e.g. WorkflowDefinition 独立), 加 V20260516_05 (协调 Wave 1+2)
8. **CI: vite build + vitest 必跑** (HARD rule). 别 push 前少检
9. **现存 ApprovalConfigTool AI Tool** — 跟新 editor 可能 redundant. Day 12 决定 keep or deprecate

## Reference

- 宏见 deep-audit: `02-系统管理-deep-audit.md` Round 5 jsPlumb 实测
- Memory rules: `feedback_organizer_brief_grep_before_assume.md` / `feedback_vite_build_only_catches_vue_ts_import_paths.md` / `feedback_vitest_invariant_tests_not_run_by_vite_build.md`

---

**Total**: 12-15 days frontend major (~7-9d Claude 加速). Wave 2 中等头. 跟 Track-H + Track-J 完全并行. ship 后 Cretas 客户自服务能力跟宏见拉平.
