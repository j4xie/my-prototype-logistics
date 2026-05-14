# Phase IIa PR-B Frontend — Marching Order

**Dispatched**: 2026-05-14
**Target chat**: fresh Claude Code session, no prior context
**Branch**: `feat/phase-iia-restaurant-sales-finance-frontend`
**Estimated effort**: 2-3 days
**Spec source**: `docs/superpowers/specs/2026-05-14-restaurant-phase-ii-analytics-spec.md`

## Goal

Replace `RestaurantPhaseIIPlaceholder` in `SalesAnalysis.vue` + `FinanceAnalysis.vue` with **real restaurant analytics blocks** powered by the new backend (PR-A). Restaurant tenants get a proper dashboard with revenue trends, dish rankings, payment channels, 堂食/外卖 splits — replacing the temporary placeholder shipped in PR #608.

## Prerequisites done

- ✅ Spec written and 4-cycle audited (PR #620 merged)
- ✅ Pre-II ETL Backfill done — 3 chains have Gold rows (PR #625 merged)
- ⏳ PR-A backend Python restaurant branch (sister chat, running parallel)
- ⏳ PR-C nginx allowlist (sister chat, running parallel)

## Read these files first

1. `docs/superpowers/specs/2026-05-14-restaurant-phase-ii-analytics-spec.md` — entire spec, especially:
   - **§4.2 + §4.3** — exact JSON shape your fetch will receive
   - **§4.5 Edge Cases** — 6 conditions to handle in UI
   - **§5 UI / Frontend Changes** — your blueprint, §5.1-5.8
   - **§5.6.1 UX positioning** — cross-link button wording
   - **§5.7 Rollback strategy** — keep `RestaurantPhaseIIPlaceholder.vue` file, add `phaseIIaEnabled` flag
   - **§5.8 LOC threshold** — extract sub-component if file exceeds 3500 LOC
2. `web-admin/src/views/smart-bi/SalesAnalysis.vue` — your target 1 (2309 LOC)
3. `web-admin/src/views/smart-bi/FinanceAnalysis.vue` — your target 2 (2972 LOC)
4. `web-admin/src/components/smartbi/RestaurantPhaseIIPlaceholder.vue` — PR #608 placeholder. **DO NOT DELETE THIS FILE** per §5.7 rollback strategy
5. `web-admin/src/components/smartbi/DynamicChartRenderer.vue` — reuse for all charts
6. `web-admin/src/components/smartbi/SmartBIEmptyState.vue` — empty state for chains with no/sparse data

## Concrete tasks

### Task 1 — Add `phaseIIaEnabled` feature flag (per §5.7)

In both files, add computed:
```typescript
const phaseIIaEnabled = computed(() => import.meta.env.VITE_PHASE_IIA_ENABLED !== 'false');
```

Template switching:
```vue
<RestaurantPhaseIIPlaceholder v-if="isRestaurantTenant && !phaseIIaEnabled" pageName="..." />
<div v-else-if="isRestaurantTenant && phaseIIaEnabled" class="restaurant-analytics">
  <!-- Phase IIa real content goes here -->
</div>
<div v-else class="factory-content">
  <!-- Existing factory content -->
</div>
```

This lets ops flip `VITE_PHASE_IIA_ENABLED=false` to roll back without code revert. `RestaurantPhaseIIPlaceholder.vue` stays in repo.

### Task 2 — SalesAnalysis.vue restaurant section

API call: `GET /api/mobile/{factoryId}/smart-bi/analysis/sales?startDate=...&endDate=...` (backend serves restaurant branch per PR-A).

Render sections (per spec §4.2 response):

1. **KPI strip**: 总营收 / 总单数 / 均客单价 / 在营门店数. Use `CapabilityGate` wrapper for `canViewPrice` on monetary values.
2. **Revenue trend chart**: `DynamicChartRenderer` with `revenueTrend` config (stacked BAR, 堂食 + 外卖)
3. **Order type pie**: `DynamicChartRenderer` with `orderTypeSplit` config
4. **Meal period bar**: `DynamicChartRenderer` with `mealPeriodBreakdown` config
5. **Product ranking table**: `el-table` with top 20 dishes (name / revenue / qtySold). Note 1-month grain per spec §4.2 — surface "本月排行" in column header.
6. **Channel breakdown**: bar or pie via `DynamicChartRenderer`
7. **Avg-per-capita trend**: LINE chart

### Task 3 — FinanceAnalysis.vue restaurant section

API call: `GET /api/mobile/{factoryId}/smart-bi/analysis/finance?analysisType=overview&startDate=...&endDate=...`

Render (per spec §4.3 response):

1. **KPI cards**: 总营收 / 总单数 / 均客单价 / 在营门店. Add coverage date range note.
2. **Monthly revenue chart**: `DynamicChartRenderer` with `revenueChart`
3. **Phase IIb preview placeholder**: small card showing `phaseIIbPreview.dataAvailability` field — if `"WASTAGE_NOT_TRACKED"` show "损耗数据将在 v2 中加入"
4. **Cross-link button** (per §5.6 + §5.6.1):
   ```vue
   <el-button type="primary" plain @click="$router.push('/smart-bi/revenue-report')">
     导出可打印的 可比同比/环比报表 →
   </el-button>
   ```

### Task 4 — Edge case handling (per spec §4.5)

For each:
1. Zero bills response → render `SmartBIEmptyState` instead of empty charts
2. `avgPerCapita: null` → render "—" not "¥0"
3. Deleted dish name (`(已下架菜品 #123)`) → render as-is, gray out
4. `coverageWarning` field present → show banner above charts: `<el-alert type="warning">{{ coverageWarning }}</el-alert>`

### Task 5 — File LOC threshold check (per §5.8)

After your changes:
- Run `wc -l SalesAnalysis.vue FinanceAnalysis.vue`
- If either exceeds **3500 LOC**, extract restaurant section to sub-component:
  - `web-admin/src/components/smartbi/RestaurantSalesContent.vue`
  - `web-admin/src/components/smartbi/RestaurantFinanceContent.vue`
- Import as `<RestaurantSalesContent v-if="isRestaurantTenant && phaseIIaEnabled" />` in parent

### Task 6 — `vite build` MUST PASS

Per HARD rule `feedback_vite_build_only_catches_vue_ts_import_paths.md`: run `npx vite build` in `web-admin/` and confirm 0 errors before commit. Vitest does NOT catch Vue/TS import path bugs; only `vite build` does.

## Coordination (CRITICAL)

Per spec §6.1, your frontend PR **MUST MERGE LAST**:
1. PR-A backend deploys prod first
2. PR-C nginx config swaps prod
3. **Then** your PR merges + web-admin deploys
4. This eliminates the race window where placeholder is removed but backend not ready

**Do NOT merge your PR until organizer confirms PR-A + PR-C are prod-green.**

## Output / PR

- Branch: `feat/phase-iia-restaurant-sales-finance-frontend`
- Open PR with title `feat(smart-bi): Phase IIa restaurant analytics UI for /smart-bi/{sales,finance}`
- PR body must include:
  - Links to spec sections (§4.2 / §4.3 response shape used)
  - LOC count before/after (and whether sub-component extracted)
  - `vite build` pass evidence
  - Screenshots if you can run a local dev server pointed at prod backend
- **DO NOT MERGE**. Ping organizer.

## Reporting back

When PR opens, report:
- PR URL + branch SHA
- LOC totals + sub-component decision
- `vite build` status
- Any spec deviations (with justification)
- Open questions for organizer

If you hit a blocker (e.g. PR-A backend response shape diverges from spec — happens during impl), pause and ping organizer to mediate with PR-A chat.
