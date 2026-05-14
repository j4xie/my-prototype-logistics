# R7 Path F1 — Residual `canViewPrice` Closeout Audit

**Date**: 2026-05-14
**Branch**: `qa/r7-f1-canviewprice-residual`
**Predecessor**: PR #520 (`feat(rbac): UI defense — canViewPrice v-if on 35 Vue views`)
**Trigger**: chat-x F006 coverage handoff doc (PR #528 merged) flagged ~29 Vue views with `formatAmount`/`totalAmount`/`unitPrice`/`totalCost`/`salePrice` rendering but no `canViewPrice` guard.

---

## Step 0 — Refresh count (HARD: count, not estimate)

Ran the audit grep from the marching order in this worktree (rebased on `origin/main`
post PR #520 merge):

```bash
cd web-admin
for F in $(grep -rln -E "formatAmount|totalAmount|unitPrice|totalCost|salePrice" src/views); do
  grep -q "canViewPrice" "$F" || echo "$F"
done
```

**Output (8 files)**:

```
src/views/inventory/by-warehouse/index.vue
src/views/modules/components/__tests__/LineItemsEditor.spec.ts
src/views/modules/components/__tests__/SchemaTableRenderer.spec.ts
src/views/smart-bi/FinanceAnalysis.vue
src/views/smart-bi/GoldPreview.vue
src/views/smart-bi/ProductionAnalysis.vue
src/views/smart-bi/WhatIfSimulator.vue
src/views/smart-bi/__tests__/GoldPreview.spec.ts
```

### Count comparison

| Snapshot | Count | Source |
|---|---|---|
| Pre-#520 baseline | 43 | PR #520 description |
| Handoff doc estimate | ~29 | `docs/superpowers/handoffs/2026-05-13-f006-coverage-residual-handoff.md` |
| **Post-#520 / this audit** | **8** | grep `web-admin/src/views/**/*` |

So PR #520 swept significantly more than its 35-file headline count — the residual is
much smaller than the handoff doc estimated, presumably because some of the "29" the
handoff doc described were already addressed by #520's broad sweep.

---

## Triage — customer-reachable vs admin-only / out-of-scope

Per PR #520's stated criterion ("MO source-path hint was wrong — `canViewPrice` is exported
by `permissionStore`; chat6 territory is out-of-scope smart-bi") and the test-file exclusion
rule (PR #520 description §"Scope reconciliation"):

| File | Type | Verdict | Reason |
|---|---|---|---|
| `src/views/modules/components/__tests__/LineItemsEditor.spec.ts` | Test | **Skip** | Vitest spec — no template, no UI render. |
| `src/views/modules/components/__tests__/SchemaTableRenderer.spec.ts` | Test | **Skip** | Same. |
| `src/views/smart-bi/__tests__/GoldPreview.spec.ts` | Test | **Skip** | Same. |
| `src/views/inventory/by-warehouse/index.vue` | Vue | **Skip** | `unitPrice` only appears in TypeScript interface `FinishedGoodsRow` (line 141). No `el-table-column` for `unitPrice`, no template binding renders it. False positive — PR #520 docs flagged this exact pattern as "correctly skipped". Backend price-stripping nulls the field anyway. |
| `src/views/smart-bi/FinanceAnalysis.vue` | Vue | **GUARD** | Entire view renders 利润/成本/应收/应付/预算 KPIs. `viewer` (analytics: 'r') can navigate to it but is NOT in `PRICE_VIEW_ROLES`. |
| `src/views/smart-bi/GoldPreview.vue` | Vue | **GUARD** | Entire view renders 营收/客单价/账单 (Gold layer revenue preview). `viewer` reachable. |
| `src/views/smart-bi/ProductionAnalysis.vue` | Vue | **GUARD** (narrow) | Only 1 KPI card "总成本" — filter it out of `kpiData` array for non-PRICE_VIEW_ROLES. Other 3 KPI cards (产量/良率/批次数) remain. |
| `src/views/smart-bi/WhatIfSimulator.vue` | Vue | **GUARD** | Entire tool simulates price/cost/revenue scenarios. `viewer` reachable. |

**Breakdown**: 3 test-file skips + 1 false-positive (interface-only) skip = **4 skipped**;
**4 customer-reachable Vue views guarded**.

### Why "customer-reachable"

Per `web-admin/src/store/modules/permission.ts`:

- `analytics` module access (smart-bi routes meta.module='analytics'): includes
  `factory_super_admin`, `dispatcher`, `production_manager`, `sales_manager` (r),
  `finance_manager`, `restaurant_manager` (r), `viewer` (r), `platform_admin`.
- `PRICE_VIEW_ROLES`: `factory_super_admin`, `platform_admin`, `procurement_manager`,
  `finance_manager`, `sales_manager`, `dispatcher`, `production_manager`,
  `restaurant_manager`, `permission_admin`, `department_admin`.

**Gap**: `viewer` has `analytics: 'r'` but is NOT in PRICE_VIEW_ROLES. So a viewer can
load smart-bi pages, backend strips price fields to null (per `PriceFieldResponseAdvice`
shipped in PR #423), and the UI would render misleading empty KPI cards / NaN values.
PR #520's UI-defense pattern (v-if + `<el-empty>` fallback) is the canonical fix.

`viewer` is real, assignable (`src/types/auth.ts:40`, `src/views/system/users/list.vue:125`).

---

## Strategy per file

| File | Pattern (per PR #520) | Implementation |
|---|---|---|
| FinanceAnalysis.vue | Large-block `<template v-if>` + `<el-empty v-else>` | Wrap entire main content after page-header + Gold CTA. |
| GoldPreview.vue | Same large-block | Wrap entire content after filter card. |
| ProductionAnalysis.vue | Per-card filter at data layer | Conditionally `.push()` 总成本 card into `kpiData` based on `canViewPrice.value`. |
| WhatIfSimulator.vue | Same large-block | Wrap entire simulator body after page-header. |

All 4 files now import from `@/store/modules/permission` (canonical per PR #472)
and use `permissionStore.canViewPrice`. Zero modification of `permissionStore` itself.

---

## Post-rebase reconciliation (2026-05-14) — defense-in-depth with PR #598

While PR #595 was OPEN, **PR #598** (`feat(rbac): canViewPrice sweep — 15 views`,
merged at `84b14b2de`) shipped a parallel granular sweep across 15 Vue views,
including 3 of this PR's 4 targets: `FinanceAnalysis.vue`, `GoldPreview.vue`,
`WhatIfSimulator.vue`. `ProductionAnalysis.vue` was NOT in #598's scope.

PR #598's strategy is **granular**: `v-if="canViewPrice"` on individual
`el-col` / `el-table-column` / `el-card` elements (hides per-cell).

PR #595's strategy is **large-block**: outer `<template v-if="canViewPrice">`
wrapper + `<el-empty v-else>` fallback (hides the entire content block, shows
user-friendly permission-denied message).

### Rebase resolution

Per `feedback_byte_similarity_not_content_similarity.md` HARD, the two
approaches were inspected at the template-element level (not line-similarity).

Conclusion: **complementary, not duplicate**. PR #595 is strictly stronger —
hides more (including filters/charts) AND adds an `<el-empty>` fallback to
inform the user. PR #598's per-cell guards remain in place as inner v-if,
making the resolved file **double-guarded** (outer + inner). Inner guards
are now redundant in the `canViewPrice = false` branch (outer hides
everything), but they remain useful documentation of intent and provide
defense-in-depth if the outer wrapper is ever refactored away.

The single conflict per file was in the script section: a duplicate
`canViewPrice` computed declaration (PR #598 added it before `useRouter`,
PR #595 added it after, with a different comment). Resolved by keeping
one declaration with a merged comment block citing both PRs.

| File | Conflict location | Resolution |
|---|---|---|
| FinanceAnalysis.vue | Line 63 (script) | Dedupe `canViewPrice` decl, kept PR #595's comment + cross-ref to #598 |
| GoldPreview.vue | Line 36-43 (script) | Dedupe duplicate `canViewPrice` decl (PR #598 had it 2x in rebase output) |
| WhatIfSimulator.vue | Line 30 (script) | Dedupe `canViewPrice` decl + merged comment |

Templates auto-merged successfully (no markers): outer `<template v-if>` +
inner `v-if` guards from #598 coexist in the resolved file.

### Final scope of this PR post-rebase

- `ProductionAnalysis.vue`: sole NEW guard (was not in #598's scope)
- `FinanceAnalysis.vue` / `GoldPreview.vue` / `WhatIfSimulator.vue`:
  defense-in-depth — adds outer large-block wrapper + `<el-empty>` fallback
  on top of #598's granular guards
- Audit doc (this file)

Net behavior change for non-PRICE-VIEW roles (e.g. `viewer`):
- Before #598: misleading empty KPI cards / NaN
- After #598: KPI cards hidden but filters/charts still visible (broken-looking UI)
- After this PR: clean `<el-empty>` permission-denied message

---

## Verification

### Vite build

```bash
cd web-admin && npm run build
```

Result: **PASS** (39.09s, exit 0). Pre-existing chunk-size warning unchanged.

### Manual 5+5 smoke

**Deferred** — local backend not running in this worktree. Per the handoff doc and
prior PR #520's "deferred to post-deploy" precedent, manual screenshot verification
of the 4 changed views (warehouse_mgr login vs admin login) is deferred to the
organizer / post-deploy E2E session. The 4 files to verify:

- `/smart-bi/finance` (FinanceAnalysis.vue)
- `/smart-bi/gold-preview` (GoldPreview.vue)
- `/smart-bi/whatif` (WhatIfSimulator.vue)
- `/smart-bi/analysis` → 生产分析 tab (ProductionAnalysis.vue) — verify "总成本" KPI card hidden for viewer

Expected behavior:
- `factory_super_admin` / `finance_manager` / `viewer-with-analytics-rw`: all KPIs visible.
- `viewer` role (analytics:'r' but NOT in PRICE_VIEW_ROLES): finance/gold/whatif pages show
  `<el-empty description="您没有查看价格/...数据的权限" />`; ProductionAnalysis shows 3 KPI cards
  instead of 4 (no 总成本).

Note: `viewer` cannot easily be tested via existing F001 seed accounts; this may need
ad-hoc role assignment in test env.

---

## Out-of-scope (not addressed in this PR)

- `permissionStore.canViewPrice` definition — canonical per PR #472, untouched.
- `PRICE_VIEW_ROLES` Set itself — backend-mirrored, untouched.
- Re-running PR #520's full 35-file sweep — those are already merged.
- Backend `PriceFieldResponseAdvice` (PR #423) — already strips price values regardless of UI.
- Any other permission concept (order-edit, finance-write, etc.) — out of scope.

---

## References

- Handoff: `docs/superpowers/handoffs/2026-05-13-f006-coverage-residual-handoff.md` (PR #528)
- PR #467 (`493782b3c`): purchase + sales price column header hide
- PR #472 (`def3ad007`): centralized `canViewPrice` to `permissionStore`
- PR #487 (`af8171b76`): orders/detail price elements hide
- PR #520 (`320357f52`): 35 Vue views sweep + LineItemsEditor priceSensitive flag
- Memory: `feedback_vite_build_only_catches_vue_ts_import_paths.md` HARD
- Memory: `feedback_count_dont_estimate_at_close_out.md`
- Memory: `feedback_concurrent_edit_safety.md` Rule 5b
