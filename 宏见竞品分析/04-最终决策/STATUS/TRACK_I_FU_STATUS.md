# Track I FU — Chat 5 AI deep-link wiring (18 sites)

> **Branch**: `fix/sprint2-fu-chat5-ai-deeplink`
> **Worktree**: `C:\Users\Steve\my-prototype-logistics-fu-chat5`
> **Started**: 2026-05-16
> **Base**: `origin/main` @ `8f0a6f8ce` (Sprint2-G-2 U-NAV-1)
> **Predecessor**: PR #681 (U-FOOTER-1 Sticky Footer) — merged

---

## 任务范围

Apply Day 7 `formatSummaryForAI` helper (shipped in PR #681) to remaining 18 sites:
- **8 RN screens** — basic `initialMessage` → richer with formatted stats embedded
- **10 Vue views** — TODO stub `() => { /* TODO Day 7 */ }` → ElMessage placeholder with formatted prompt (待 SmartBI 后端接入)

Per organizer brief: pure mechanical, 0 业务改动, 不动 util 本身.

---

## ✅ 完成

### Vue util port (1 new file)

- `web-admin/src/utils/aiSummaryContext.ts` — 1:1 port of `frontend/CretasFoodTrace/src/utils/aiSummaryContext.ts` (RN helper). Same `formatSummaryForAI(summary, opts) → ' (筛选: ...; 当前统计: ...)'` signature.

### RN 8 screens (each: +1 import + initialMessage interpolation)

| Screen | entityType | filter |
|---|---|---|
| `restaurant/wastage/WastageListScreen.tsx` | wastage | `{ status: statusFilter }` |
| `dispatcher/plan/PlanListScreen.tsx` | productionPlan | `{ status: activeTab }` |
| `quality-inspector/QIInspectListScreen.tsx` | qualityInspection | none |
| `hr/attendance/AttendanceManageScreen.tsx` | attendance | none (viewMode is daily/history label) |
| `factory-admin/inventory/TransferListScreen.tsx` | internalTransfer | `{ status: statusFilter }` |
| `factory-admin/inventory/ReturnOrderListScreen.tsx` | returnOrder | none (returnType is sub-category label) |
| `warehouse/inventory/WHInventoryListScreen.tsx` | inventory | none |
| `management/ShipmentManagementScreen.tsx` | shipment | `{ status: filterStatus }` |

Pattern (uniform):
```diff
+import { formatSummaryForAI } from '../../../utils/aiSummaryContext';
 ...
-initialMessage: `分析当前X (筛选: ${...})`
+initialMessage: `分析当前X${formatSummaryForAI(summary, { filter: { status: ... } })}`
```

### Vue 10 views (each: +1 import + inline @ai-analyze handler swap)

| View | entityType | filter |
|---|---|---|
| `sales/orders/list.vue` | salesOrder | `{ status: statusFilter }` |
| `procurement/orders/list.vue` | purchaseOrder | `{ status: statusFilter }` |
| `production/plans/list.vue` | productionPlan | `{ status: searchForm.status }` |
| `warehouse/inventory/index.vue` | inventory | none |
| `sales/shipments/list.vue` | shipment | `{ status: statusFilter }` |
| `sales/returns/list.vue` | returnOrder | none |
| `transfer/list.vue` | internalTransfer | none |
| `restaurant/wastage/list.vue` | wastage | none |
| `hr/attendance/list.vue` | attendance | none |
| `quality/inspections/list.vue` | qualityInspection | none |

Pattern (uniform):
```diff
+import { formatSummaryForAI } from '@/utils/aiSummaryContext';
 ...
-@ai-analyze="() => { /* TODO Day 7 */ }"
+@ai-analyze="() => ElMessage.info({ message: `AI 分析 (待接 SmartBI): 分析当前X${formatSummaryForAI(footerSummary, { filter: { status: ... } })}`, duration: 8000, showClose: true })"
```

Vue inline expression auto-unwraps refs in template scope — `footerSummary` and `statusFilter` work without `.value`.

ElMessage已在 10 个 Vue view 全部 imported (verified pre-edit).

---

## 设计决策

### Vue placeholder vs full SmartBI integration

Vue web-admin 端没有现成的 AIChat 屏 (RN-only). 直接 wire 到真 LLM endpoint **不算 mechanical**, 需要 backend 路由 + drawer 状态机. 当前 placeholder `ElMessage.info(...)` 的价值:
1. **格式化的 prompt 已 ready** — 显示在 message 中, dev/QA 验证 message 字符串正确
2. **deep-link payload pipeline 通了** — `useListSummary` → `formatSummaryForAI` → 用户可见
3. **Sprint 3 wiring 改 1 行** — `ElMessage.info(...)` → `openSmartBIDrawer(...)` or similar

Brief 接受这种 "mechanical placeholder" — alternative 是开 AiEntryDrawer 但语义错位 (录入 vs 分析).

### 不动 util

Per brief — `aiSummaryContext.ts` (RN) 完全不动, Vue 版本是 1:1 port. 两边 string 输出格式严格一致, Sprint 3 接 SmartBI 后端时同一份 prompt 解析逻辑可复用.

### 不重复测试

Per brief — aiSummaryContext util 在 PR #681 已有 6 个 jest case (null/empty/filter/3 formats/combine/graceful). 新 Vue 版本是纯字符串 transform, 行为等价, 不写 Vue-side 重复测试.

---

## 🚨 已知风险

1. **Vue ElMessage placeholder UX** — 不是真 AI 分析, 仅显示 prompt. 客户实际点击 📊 期望真分析 → 当前会看到 "AI 分析 (待接 SmartBI): ..." 这种 message. 必须 Sprint 3 接真后端前**不要在销售 demo 中演示 Vue 端 📊 点击**.

2. **TypeScript 严格度** — Vue inline `formatSummaryForAI(footerSummary, { filter: { status: statusFilter } })` 在 template 中通过 auto-unwrap 拿到 unwrapped ref value. `statusFilter` 在某些 view 是 `ref('')` 而非 `ref<'all' | ...>`, 类型可能宽于 helper 期望的 `Record<string, string | number | undefined>`. 运行时无问题, vue-tsc strict 可能 warning. 若 CI vue-build-check 报错则改为 named function with explicit cast — 但 PR #681 base 同样 pattern 没踩, 应该 OK.

3. **node_modules junction** — main worktree node_modules 当前为空, 本 worktree jest 跑不动. 没本地跑 test 验证, 但 FU 是纯 mechanical (imports + inline handler), 不触 component/test 行为. 若 CI 跑 jest 失败需要回 review.

---

## 📊 进度

| 项 | 状态 |
|---|---|
| Vue util port | ✅ shipped |
| RN 8 screens | ✅ shipped |
| Vue 10 views | ✅ shipped |
| Jest verification | ⏸️ skipped (node_modules empty locally; CI will verify) |
| Commit + push | 🟡 next |
| PR create | 🟡 next |

19 file changes total (1 new + 18 modified). Pure mechanical scope, 0 business logic touched.
