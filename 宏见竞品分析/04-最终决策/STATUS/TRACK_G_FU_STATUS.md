# Track G — Follow-up STATUS (U-NAV-1)

> 主 PR: #683 (Sprint2-G-1) + #684 (Sprint2-G-2), 已 merged 2026-05-15.
> 此文件记录 follow-up 工作.

---

## FU Chat 3 (2026-05-16) — Bucket → status filter mapping (P1)

**起因**: 主 PR Day 5 `handleWorkflowNodeClick` 是 `ElMessage.info('点击节点已记录, 多状态筛选待 Day 9 接入')` 占位 (5 ListView) + RN HomeScreen 4 个传 nodeId (bucket) 不翻译就当 statusFilter 走 — backend 不识别 `pending` / `in_progress` / `done` 作 status enum 值, 等于无效 filter.

**约束** (Steve 指令):
- 不动后端业务逻辑 (排除"加 ?statusIn=A,B,C 多值参数"路径)
- 复用现有 list filter (单值 statusFilter)
- → 走客户端 lossy 单值映射

**方案**: 客户端 `BUCKET_PRIMARY_STATUS` 映射表 — 每 bucket 取 1 个 representative status enum 值. 用户看子集 (非完整 bucket), 想看其他状态可在 list 状态下拉切换. UI toast 提示这是 lossy.

### 映射设计 (选最 actionable per bucket)

| Module | pending | in_progress | done |
|---|---|---|---|
| sales | `PENDING_FINANCE_REVIEW` (待财务审核, action needed) | `PROCESSING` (真实处理) | `COMPLETED` |
| purchase | `PENDING_FINANCE_REVIEW` | `PARTIAL_RECEIVED` (action visible) | `COMPLETED` |
| production | `PENDING` | `IN_PROGRESS` | `COMPLETED` |
| finance | `REQUESTED` | `ISSUED` | `ISSUED`* |
| inventory | `EXPIRED` (异常最 urgent) | `INSPECTING` (活动 workflow) | `AVAILABLE` |

*finance done 复合, backend 是 Payment.VERIFIED 但 invoice list 不能筛 payment, 暂取 ISSUED. Toast 指引"详情请去收款管理".

### 涉及文件 (1 commit, 12 文件 +~150/-30 行)

**Shared types** (RN + Vue):
- `frontend/CretasFoodTrace/src/types/workflow.ts`: 加 `BUCKET_PRIMARY_STATUS` map + `getBucketPrimaryStatus()` helper + 注释设计原则
- `web-admin/src/types/workflow.ts`: 同上 + 加 `BUCKET_LABEL` 中文 label + `getBucketLabel()` (toast 用)

**Vue 5 ListView** (handleWorkflowNodeClick 改 functional):
- `views/sales/orders/list.vue`: `getBucketPrimaryStatus('sales', nodeId)` → set statusFilter + loadData + ElMessage.success 带 bucket 完整说明
- `views/procurement/orders/list.vue`: 同
- `views/production/plans/list.vue`: 用 `searchForm.value.status` (此 view 字段名不同)
- `views/warehouse/inventory/index.vue`: 同 sales
- `views/finance/invoices/list.vue`: 同 + toast 额外提示 done 是复合状态

**RN 4 HomeScreen** (onNodePress translate):
- `screens/factory-admin/home/FAHomeScreen.tsx`: helper `navigateToModuleList(nav, module, bucketId)` 内部用 `getBucketPrimaryStatus(module, bucketId)` 翻译再 nav
- `screens/dispatcher/home/DSHomeScreen.tsx`: inline `getBucketPrimaryStatus(module, nodeId)` 在 onNodePress
- `screens/workshop-supervisor/home/WSHomeScreen.tsx`: 同
- `screens/warehouse/home/WHHomeScreen.tsx`: 同

**单元测试** (避免重复主 PR rn-test 全局 functions coverage 阈值踩坑):
- `__tests__/unit/types/workflow.test.ts`: 11 个 it() 覆盖 `getBucketPrimaryStatus` 5 module × 3 bucket + 异常 path + `BUCKET_PRIMARY_STATUS` 完整性验证

### 已知限制 (Day 后续 / 永久 trade-off)

1. **Lossy 子集显示**: user 点 "待审 5" 看到 ≤5 项 (只有 PENDING_FINANCE_REVIEW 那部分). Toast 提示已说明, list status 下拉可切其他. 接受.
2. **finance done 取 ISSUED**: invoice list 看不到 payment.VERIFIED 子集. Toast 提示去收款管理. 接受.
3. **理想方案**: 后端 list endpoint 加 `?statusIn=A,B,C` 多值参数, frontend 拿到 bucket 多 status 数组直接传. **未做** (Steve "不动后端业务逻辑"). 留 FU 大版本或 Sprint 3 P0 改 (Sales/Purchase/Production/Invoice/MaterialBatch 5 controller 各加 1 行 @RequestParam, 风险中).

### 工时 / Commit

- 实际工时: ~1.5h (低于预估 2-3h, 设计直接, 没遇到 unknown 现状)
- Commit: 1 个 `fix(workflow-fu): bucket→primary status mapping (RN + Vue, 9 file)`
- PR: `[Sprint2-G-FU3] U-NAV-1 follow-up — bucket→status filter mapping`

### Test plan

- [ ] Web sales/orders: 点 "待审" 节点 → statusFilter 切到 PENDING_FINANCE_REVIEW + ElMessage 显示 "已切到 待审 (PENDING_FINANCE_REVIEW)..."
- [ ] Web procurement: 同 sales
- [ ] Web production: 点 "进行中" 节点 → searchForm.value.status = IN_PROGRESS + loadData
- [ ] Web warehouse: 点 "需关注" → statusFilter = EXPIRED + 仅显示过期批次
- [ ] Web finance: 点 "已收款" → statusFilter = ISSUED + toast 提示 "详情请去收款管理"
- [ ] RN FA HomeScreen: 点 sales pending → SalesOrderList 自动 filter PENDING_FINANCE_REVIEW
- [ ] RN DS HomeScreen: 点 production in_progress → ProductionPlanManagement filter IN_PROGRESS
- [ ] RN WS HomeScreen: 点 production pending → ProductionPlanManagement filter PENDING
- [ ] RN WH HomeScreen: 点 inventory pending → WHInventoryList filter EXPIRED
- [ ] 单元测试: `npm run test -- workflow.test.ts` 11 个 it() 全 pass

完成跟 organizer 说 "Chat 3 FU 完了".
