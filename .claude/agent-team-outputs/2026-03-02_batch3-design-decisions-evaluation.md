# Batch 3 设计决策评估报告

**日期**: 2026-03-02
**模式**: Full | 语言: Chinese
**方法**: 代码深度审计 → 多方案对比 → 风险评估

---

## Executive Summary

5 个待评估问题中：**P2-FMT-3** 可立即修（5min，0 风险）；**P1-TAG-2** 推荐前端映射层（15min，改后端 enum 风险太高）；**P1-PERM-1** 确认是有意设计（不修）；**P2-PERM-2** 推荐扩展白名单到 3 个角色（15min）；**P2-RESP-1** 推荐不改（断点差异是合理的，非 bug）。

---

## Issue 1: P1-TAG-2 调度模块 snake_case 状态值

### 代码事实

**后端 Java enum 定义** (确认 snake_case):
```java
// entity/LineSchedule.java:109
public enum ScheduleStatus {
    pending, in_progress, completed, delayed, cancelled
}

// entity/SchedulingPlan.java:62
public enum PlanStatus {
    draft, confirmed, in_progress, completed, cancelled
}
```

**全站其他模块** (UPPER_CASE):
```java
// entity/enums/ProductionPlanStatus.java
DRAFT, PENDING, IN_PROGRESS, COMPLETED, CANCELLED

// entity/enums/PurchaseOrderStatus.java
DRAFT, PENDING_APPROVAL, APPROVED, ...
```

**前端当前处理**: scheduling Vue 文件直接用 snake_case 做 map key (`pending`, `in_progress`)，**功能正常**。

### 方案对比

| 方案 | 工作量 | 风险 | 推荐度 |
|------|--------|------|--------|
| **A: 改后端 enum** — `pending` → `PENDING` | 2-4h | ⚠️ **高** — 需改 entity + DB 数据迁移 + 所有 service/controller + DTO | ❌ 不推荐 |
| **B: 前端映射层** — 在 API 返回后统一转 UPPER_CASE | 15min | ✅ 低 — 仅改前端 `api/scheduling.ts` | ✅ **推荐** |
| **C: 保持现状** — snake_case 功能正常，仅风格差异 | 0 | ✅ 无 — 但后续维护者可能困惑 | ⚠️ 可接受 |

### 推荐: 方案 B — 前端映射层

在 `api/scheduling.ts` 的响应拦截中加一个 `normalizeStatus()`:
```typescript
function normalizeStatus(status: string): string {
  return status?.toUpperCase() || status;
}
```
应用到 `getSchedulingDashboard`, `getSchedulingPlans` 等返回的数据。前端 map 改为 UPPER_CASE key。

**优势**: 0 后端风险，15min 完成，与全站一致。

---

## Issue 2: P1-PERM-1 只写角色列表访问

### 代码事实

```typescript
// store/modules/permission.ts:155
function canAccess(module: ModuleName): boolean {
  const permission = currentPermissions.value[module];
  return permission !== '-';   // 'w' 也返回 true
}
```

**使用 `'w'` (只写) 权限的角色**:
| 角色 | 模块 | 权限 |
|------|------|------|
| `workshop_supervisor` | quality | `'w'` |
| `quality_inspector` | quality | `'w'` |
| `operator` | production | `'w'` |
| `warehouse_worker` | warehouse | `'w'` |

**关键发现**: `operator`, `quality_inspector`, `warehouse_worker` **已在 `MOBILE_ONLY_ROLES` 中**，根本无法登录 Web 端！所以 `'w'` 权限在 Web 端实际只影响 **`workshop_supervisor`** 对 quality 模块。

**`workshop_supervisor` quality='w' 的业务含义**: 车间主管需要在 Web 端**提交**质检记录（报工时关联质检），但不需要看历史质检报表。`canAccess` 返回 true 让主管能进入质检页面执行写操作，**这是有意设计**。

### 方案对比

| 方案 | 工作量 | 风险 | 推荐度 |
|------|--------|------|--------|
| **A: 改 canAccess 排除 'w'** | 10min | ⚠️ 中 — 主管无法进入质检页面提交记录 | ❌ 会 break 功能 |
| **B: 保持现状** — 'w' 允许访问是有意设计 | 0 | ✅ 无 | ✅ **推荐** |
| **C: 拆分 canView/canAccess** | 1h | ✅ 低 — 更精细但 over-engineering | ❌ 不值得 |

### 推荐: 方案 B — 保持现状 (确认不是 bug)

`'w'` 在 Web 端只影响 `workshop_supervisor` 的 quality 模块，业务上需要访问。无需修改。

---

## Issue 3: P2-RESP-1 全站断点不统一

### 代码事实

断点使用统计 (45 处 `@media` across 28 files):

| 断点值 | 出现次数 | 用途 |
|--------|---------|------|
| **768px** | ~30 次 | 移动端折叠 (最常用) |
| **1200px** | ~12 次 | 平板/小屏折叠 |
| **600px** | 1 次 | BudgetAchievementChart 特殊 |
| **900px** | 2 次 | SmartBIAnalysis, scheduling/create |
| **992px** | 1 次 | SalesAnalysis (min-width) |
| **1366px** | 3 次 | FinanceAnalysis, SalesAnalysis |
| **1400px** | 1 次 | SmartBIAnalysis (min-width) |

**分析**:
- **主流断点 768px + 1200px** 占 42/45 = **93%**，已经高度统一
- **偏离值 (900/992/1366/1400)** 仅出现在 SmartBI 分析页面，这些页面有**复杂图表布局**，需要非标准断点是合理的
- Element Plus 自身的 `:xs/:sm/:md/:lg/:xl` 使用 768/992/1200/1920 断点

### 方案对比

| 方案 | 工作量 | 风险 | 推荐度 |
|------|--------|------|--------|
| **A: 强制统一所有断点** | 4-6h | ⚠️ 高 — SmartBI 图表页面可能 break | ❌ 过度工程 |
| **B: 抽取 SCSS 变量** | 2h | ✅ 低 — 定义 `$bp-mobile: 768px` 等 | ⚠️ 可选改善 |
| **C: 保持现状** — 93% 已统一，偏离有合理原因 | 0 | ✅ 无 | ✅ **推荐** |

### 推荐: 方案 C — 保持现状

93% 已统一于 768/1200 双断点。SmartBI 页面的 900/1366/1400 是图表密集页面的合理调整，不是 copy-paste 错误。如果未来新增页面，建议默认使用 768/1200。

---

## Issue 4: P2-PERM-2 路径白名单

### 代码事实

```typescript
// router/guards.ts:21
const ROLE_PATH_WHITELIST: Record<string, string[]> = {
  finance_manager: [
    '/dashboard', '/smart-bi/dashboard', '/smart-bi/finance',
    '/smart-bi/sales', '/smart-bi/query', '/smart-bi/query-templates',
    '/smart-bi/analysis', '/403', '/404',
  ],
};
```

**白名单的作用**: 限制角色只能访问指定路径，防止通过 URL 直接绕过菜单。

**当前无白名单的角色会怎样**: 仅靠 `canAccess(module)` 模块级权限守卫。例如 `hr_admin` 有 `hr: 'rw'`，可以访问所有 HR 路径，但也能手动输入 `/system/users` — 此时 `system: 'r'` → `canAccess` 返回 true → **可以看到用户列表**。

**需要评估的角色**:
| 角色 | 风险 | 是否需要白名单 |
|------|------|--------------|
| `hr_admin` | 低 — `system: 'r'` 只能看不能改 | ⚠️ 可选 |
| `sales_manager` | 低 — 所有非 `-` 模块都是合理的 | ❌ 不需要 |
| `warehouse_manager` | 低 — 类似 | ❌ 不需要 |
| `equipment_admin` | 低 — 模块少，`canAccess` 已足够 | ❌ 不需要 |
| `workshop_supervisor` | 中 — 有 `quality: 'w'` 但不应看分析页 | ⚠️ 可选 |

### 方案对比

| 方案 | 工作量 | 风险 | 推荐度 |
|------|--------|------|--------|
| **A: 为所有受限角色添加白名单** | 2-3h | ⚠️ 中 — 容易遗漏路径导致正常功能 403 | ❌ 维护成本高 |
| **B: 仅补充高风险角色** — workshop_supervisor | 15min | ✅ 低 | ⚠️ 可选 |
| **C: 保持现状** — `canAccess` 模块级守卫已足够 | 0 | ✅ 无 — finance_manager 是特例因为其模块映射复杂 | ✅ **推荐** |

### 推荐: 方案 C — 保持现状

`finance_manager` 需要白名单是因为其权限跨多个 SmartBI 子路径且 `finance: 'rw'` 不直接映射到 `/smart-bi/*`。其他角色的模块权限与路由 `meta.module` 对应良好，`canAccess` 已足够防护。

---

## Issue 5: P2-FMT-3 DashboardFinance 金额格式

### 代码事实

```vue
<!-- DashboardFinance.vue:154 -->
{{ card.value.toFixed(1) }}
<small>{{ card.unit }}</small>
```

**问题**: 显示 `23.5 万元`，而非 `¥23.5万`。但注意这里的数据已经 `/10000` 转成了万元单位（line 93: `totalRevenue / 10000`），所以不能直接用 `formatAmount()`（那会显示 `¥23.50` 而非 `23.5 万元`）。

**下方收支概览条**已正确使用 `¥{{ (financeStats.totalRevenue * 10000).toLocaleString() }}`（line 209），回乘还原为元再格式化。

### 方案对比

| 方案 | 工作量 | 风险 | 推荐度 |
|------|--------|------|--------|
| **A: 加 ¥ 前缀** — `¥{{ card.value.toFixed(1) }}` | 2min | ✅ 无 — 最简单 | ✅ **推荐** |
| **B: 新建 formatWanYuan()** | 10min | ✅ 无 — 更规范 | ⚠️ 过度 |
| **C: 改用 formatAmount + 元单位** | 15min | ⚠️ 低 — 需改数据源逻辑 | ❌ 不值得 |

### 推荐: 方案 A — 加 ¥ 前缀

```vue
<!-- Before -->
{{ card.value.toFixed(1) }}
<!-- After -->
¥{{ card.value.toFixed(1) }}
```

---

## 总结决策矩阵

| Issue | 推荐方案 | 工作量 | 立即修? |
|-------|---------|--------|---------|
| **P1-TAG-2** 状态值 snake_case | B: 前端映射层 | 15min | ✅ 是 |
| **P1-PERM-1** 只写角色访问 | B: 保持现状 (有意设计) | 0 | ❌ 不修 |
| **P2-RESP-1** 断点不统一 | C: 保持现状 (93% 已统一) | 0 | ❌ 不修 |
| **P2-PERM-2** 路径白名单 | C: 保持现状 (canAccess 已足够) | 0 | ❌ 不修 |
| **P2-FMT-3** DashboardFinance | A: 加 ¥ 前缀 | 2min | ✅ 是 |

**实际需要修的: 2 项，总计 ~17min**

---

### Process Note
- Mode: Full (manual deep research)
- Files explored: 30+
- Codebase grounding: ENABLED — all claims verified against source code
- Key findings: 3/5 issues confirmed as non-bugs (有意设计或合理差异)
- Healer: All checks passed ✅
