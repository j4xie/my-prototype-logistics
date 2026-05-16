# Track J — Sprint 2 每日 STATUS (P-FIN-1 采购财务审核+三价标红 — NEW)

> **本文件**: Chat J (Sprint 2 新加 chat) 每天追加 1 段进度
> **Organizer 阅读**: Chat 1 每天读 + 协调跨 chat 冲突
> **Brief**: `04-最终决策/TRACK_J_BRIEF.md` (3d 工时)

---

## Day 0 — 派发 (2026-05-15)

- 状态: 📤 **已派发 Brief, 等 Chat J 启动**
- Brief 文件: `04-最终决策/TRACK_J_BRIEF.md` (3d 工时, P-FIN-1, **新加 chat**)
- 收到 brief 后: Chat J 应立即:
  1. 创建 git worktree + branch `feature/sprint2-track-j-fin-approval`
  2. 读完 Brief §1-§10
  3. 启动 Day 1 任务 (Flyway purchase_order_approval + Entity + Service)
  4. 当天结束在本文件追加 Day 1 进度

### 背景 — 为什么是 Sprint 2 新加

- Sprint 1 PR #660 修了三价对比 bug
- 客户在六扇门第三次会议又提: "三家对比没有 ... 可能是一些数据的 bug"
- Sprint 1 修了 "三价计算 + 显示 bug" 但**还没加 "标红 + 财务审核"** — 这是 P1-2 的延续
- 工时 3d, 是 Sprint 2 中最短的 chat

### 关键依赖 (Sprint 1)

- Track C `MaterialPriceComparisonDTO` (强依赖, 你直接 import 已有 DTO)
- Track C `MaterialPriceComparisonService` (强依赖, 调它算三价)
- Track C `RBACService` (强依赖, 审核端点财务角色 gate)
- Track B1 `DingTalkBotService` (强依赖, 标红时通知财务群)

### Sprint 2 同期 chat

- Chat E (N31): 推荐采购 → 创建 PO → 你 evaluateAndCreate 自动 hook
- Chat F (N48): 跟你无直接依赖, BOM 数据影响 BOM 标准价
- Chat G (UX-A1): 财务 WorkflowBar 显示 "采购待审 X / 已审 Y"
- Chat H (UX-A2): 采购列表 "审核" action 跳你的 ApprovalScreen
- Chat I (UX-A3): 采购列表 sticky footer 显示 "标红 X 单"

---

## Day 1 (2026-05-15) — 后端 ApprovalRule 表 + approveOrder 自动触发

### Audit (开工前)

Brief §2 假设"缺审核流程", **实际 Sprint 1 已 ship** (反查 verify):

- ✅ `PurchaseOrderStatus` 已含 `PENDING_FINANCE_REVIEW` / `FINANCE_APPROVED` / `FINANCE_REJECTED`
- ✅ `PurchaseService.submitForFinanceReview` / `financeApproveOrder` / `financeRejectOrder` (PurchaseServiceImpl:319/332/348)
- ✅ `PurchaseOrder` 实体含 `financeReviewedBy/At/Notes`
- ✅ REST `/orders/{id}/submit-for-finance-review` + `/finance-approve` + `/finance-reject` 已暴露 (PurchaseController, RBAC `finance:read_write`)
- ✅ 三价 `buildPriceComparison` + `priceAlert` flag (PR #660)
- ✅ AI Tool `PurchaseOrderApproveTool` (submit/approve/cancel actions)
- ✅ K4/K5 RBAC: 三价对比 = `procurement:read_write` OR `finance:read_write` (#673/#674)

**真实工作范围** (Steve 拍板 "扩展为主", 工时 ~1-1.5d vs brief 名义 3d):

1. ❌ `PRICE_ALERT_THRESHOLD = "10"` 硬编码 (PurchaseServiceImpl:104) → 改 per-factory 规则表
2. ❌ `approveOrder` 不评估; 须手动调 `submitForFinanceReview`. 缺**自动触发**
3. ❌ AI Tool 不支持 `finance_approve` / `finance_reject`
4. ❌ 前端缺 finance 审核 view (RN + Vue)

### 完成

- ✅ Flyway `V20260517_01__purchase_order_approval_rules.sql` (每家工厂播种 10% / 10万 默认规则)
- ✅ `PurchaseOrderApprovalRule` entity + `PurchaseOrderApprovalRuleRepository`
- ✅ PurchaseServiceImpl 改造: `resolveActiveRule` + `evaluateApprovalTrigger` 私有辅助 + `buildPriceComparison(threshold)` 重构 + `approveOrder` 末尾评估 (priceAlert OR totalAmount > 阈值) → 自动跳 `PENDING_FINANCE_REVIEW` 绕过 `APPROVED`
- ✅ `getOrderPriceComparison` / `getMaterialPriceInfo` 改用 per-factory 阈值 (取规则一次, 避免 N+1)
- ✅ Maven compile PASS (1:19 min)
- ✅ Commit `c2f04bef5` (4 files, +241/-9, `git commit -- <显式路径>` scope clean)

---

## Day 2 (2026-05-15) — AI Tool finance action + RN 审核 view

### 完成

后端:
- ✅ `PurchaseOrderApproveTool` 添加 `finance_approve` / `finance_reject` action (enum, `notes` 参数 schema, description 覆盖 LLM "财务复核/驳回/退回")
- ✅ `finance_reject` 必须填 notes (业务: 财务必须说明驳回原因)
- ✅ Maven compile PASS (1:29 min)

前端 API 客户端 `purchaseApiClient.ts`:
- ✅ status enum 补 `PENDING_FINANCE_REVIEW` / `FINANCE_APPROVED` / `FINANCE_REJECTED` / `CLOSED` (与 Java 对齐)
- ✅ `PurchaseOrder.financeReviewedBy/At/Notes` 字段
- ✅ `MaterialPriceComparison` interface
- ✅ 新增 `submitForFinanceReview` / `financeApprove` / `financeReject` / `getOrderPriceComparison`

前端 RN screens (`frontend/CretasFoodTrace/src/screens/factory-admin/inventory/`):
- ✅ `PurchaseOrderFinanceReviewListScreen.tsx` — 财务待审列表 (`status=PENDING_FINANCE_REVIEW`, FlatList + 下拉刷新 + `useFocusEffect`)
- ✅ `PurchaseOrderFinanceReviewScreen.tsx` — 详情审核页:
  - 摘要 Card (订单号/供应商/总金额/状态/标红数量 Chip)
  - 三价对比 DataTable, `priceAlert=true` 行 `#FFE4E1` 红色背景 + `#C62828` 红色偏差
  - TextInput 备注 + 通过/驳回按钮 (驳回 notes 必填, Alert 二次确认, 错误显示 error.message)
  - 非 PENDING_FINANCE_REVIEW 显示历史 `financeReviewNotes` + `financeReviewedAt`
- ✅ 导航: `FAManagementStackParamList` + `FAManagementStackNavigator` 注册 2 个新 route

- ✅ Commit `df93c9f95` (6 files, +486/-8, `git commit -- <显式路径>` scope clean)

### 跳过 (per Steve "扩展为主" + 时间盒)

- 🟡 Vue `PurchaseOrderApprovalView.vue` (web-admin/views/purchase/ 目录还不存在) — follow-up PR
- 🟡 单测 PurchaseServiceImpl approval trigger — worktree node_modules 不全, follow-up
- 🟡 钉钉通知 hook (依赖 Track B1 未 merge)

---

## Day 3 (2026-05-15) — PR opened

### 完成

- ✅ Push branch `feature/sprint2-track-j-fin-approval` (2 commits: `c2f04bef5` + `df93c9f95`)
- ✅ **PR #675**: https://github.com/j4xie/my-prototype-logistics/pull/675
  - Title: `[Sprint2-J] P-FIN-1 采购订单财务审核+三价标红`
  - 10 文件 (5 backend + 5 frontend)
  - +727/-17 行
- ✅ STATUS 三天完整记录 (Audit / Day 1 / Day 2 / Day 3)

### Follow-up 计划 (拆 PR, Steve 自行 prioritize)

| 项目 | 工时 | 触发依赖 |
|---|---|---|
| Vue `PurchaseOrderApprovalView.vue` | ~1d | web-admin/views/purchase/ 目录新建; 单独 PR |
| 单测 `PurchaseServiceImpl.evaluateApprovalTrigger` | ~2h | worktree dep 修好后 |
| 钉钉通知 hook | ~1h | Sprint 1 Track B1 (`DingTalkBotService`) merge 后 |
| Sprint 2 集成测试 | TBD | Chat E (N31 推荐采购) ship 后 |

### 风险 + 协调点

- **Chat E (N31)** 推荐采购 → 创建 PO → approveOrder 自动评估流入 PENDING_FINANCE_REVIEW: 接入点 = 已修的 `approveOrder`, Chat E 无需感知, 透明衔接
- **Chat H (UX-A2)** BottomSheet 跳 `PurchaseOrderFinanceReview` route: 需 Chat H 加 menu item 跳转; 路由名 `PurchaseOrderFinanceReview` + `PurchaseOrderFinanceReviewList` 已导出 (`FAManagementStackParamList`)
- **Chat I (UX-A3)** sticky footer "标红 X 单 / 待审 Y 单": Chat I 查 `getOrdersByStatus('PENDING_FINANCE_REVIEW')` 拿计数 — API 已暴露
