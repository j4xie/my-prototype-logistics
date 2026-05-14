# Phase IIa PR-A Backend — Marching Order

**Dispatched**: 2026-05-14
**Target chat**: fresh Claude Code session, no prior context
**Branch**: `feat/phase-iia-restaurant-sales-finance-backend`
**Estimated effort**: 2-3 days
**Spec source**: `docs/superpowers/specs/2026-05-14-restaurant-phase-ii-analytics-spec.md`

## Goal

Add **restaurant tenant branch** to `analysis_sales.py` + `analysis_finance.py`. Mirror the polymorphic dispatch pattern from `analysis_production.py:440-506`. After this PR ships, restaurant tenants hitting `/api/mobile/{factoryId}/smart-bi/analysis/{sales,finance}` get a real response (currently 404 from Java).

## Prerequisites done

- ✅ Spec written and 4-cycle audited (PR #620 merged)
- ✅ Pre-II ETL Backfill done — 3 chains have Gold rows: `RES_3101_009`, `R_GML_DEMO`, `R_XMX_CHAIN` (PR #625 merged)
- ⏳ PR-B frontend + PR-C nginx are running in parallel sister chats

## Read these files first

1. `docs/superpowers/specs/2026-05-14-restaurant-phase-ii-analytics-spec.md` — entire spec, especially:
   - **§4 API Contracts** — response shape, JSON examples
   - **§4.5 Edge Cases** — 6 conditions you must handle
   - **§6.3.1 RLS Pattern Decision** — use WHERE-clause pattern
   - **§9 Implementation Map** — pre-deploy checklist
2. `backend/python/smartbi_compat/api/analysis_production.py:440-506` — the dispatch template
3. `backend/python/smartbi_compat/api/analysis_sales.py` — your target file 1
4. `backend/python/smartbi_compat/api/analysis_finance.py` — your target file 2
5. `backend/python/smartbi/gold/queries.py` — `finance_summary()` + `daily_trend()` you may reuse
6. `.claude/rules/python-java-port.md` — Rules 1, 4, 6, 10, 11, 12 (audit at end)

## Concrete tasks

### Task 1 — Add restaurant dispatch in `analysis_sales.py`

At the top of `get_sales_analysis()`, insert tenant detection + restaurant branch:

```python
# Mirror analysis_production.py:480-506 exactly. Use WHERE-clause RLS pattern.
pool = None
try:
    from smartbi.config import get_cretas_pool
    pool = await get_cretas_pool()
except Exception as e:
    logger.warning("cretas pool acquisition failed: %s", e)

if pool is None:
    tenant = TenantType.FACTORY  # defensive
else:
    async with pool.acquire() as conn:
        tenant = await get_tenant_type(factory_id, conn)

if tenant.is_restaurant_tenant:
    envelope = await _restaurant_sales_dispatch(
        factory_id, startDate, endDate, analysisType
    )
    if isinstance(envelope, dict):
        strip_price_for_role(envelope.get("data"), auth.role)
    return envelope
```

### Task 2 — Implement `_restaurant_sales_dispatch()`

Returns the JSON shape per spec §4.2 (read it carefully). Required sub-sections:

- `tenantType: "RESTAURANT"` discriminator
- `dateRange: { startDate, endDate, days }`
- `overview: { totalRevenue, billCount, avgPerCapita, storeCount, dataSource: "agg_daily" }`
- `revenueTrend` (BAR chart, 堂食 + 外卖 stacked, from `agg_daily_order_type_meal`)
- `orderTypeSplit` (PIE, 堂食/外卖)
- `mealPeriodBreakdown` (BAR, 午市/晚市)
- `productRanking` (top 20 from `agg_product`, **must JOIN dim_product** for name — see §2.3)
- `channelBreakdown` (from `agg_channel`, **must JOIN dim_payment_channel** for name)
- `avgPerCapitaTrend` (LINE)
- `generatedAt` (use `_java_isoformat()` per Rule 11)

### Task 3 — Add restaurant dispatch in `analysis_finance.py`

Same pattern. Implement `_restaurant_finance_overview()` returning spec §4.3 shape:

- `tenantType / analysisType: "overview"`
- `kpi: { totalRevenue, billCount, avgPerCapita, storeCount, coverageStart, coverageEnd }`
- `revenueChart` (BAR, monthly)
- `phaseIIbPreview: { wastageRate: null, dataAvailability: "WASTAGE_NOT_TRACKED" }` (seeds IIb placeholder)
- `generatedAt`

### Task 4 — Edge cases per spec §4.5 (mandatory unit tests)

6 conditions, each needs a unit test:

1. Zero bills in range → `totalRevenue: 0.0`, `billCount: 0`, **empty arrays** (NOT null) for productRanking/channelBreakdown
2. `customerCount == 0` but `billCount > 0` → `avgPerCapita: null` (NOT 0.0)
3. Deleted dish (product_id no longer in dim_product) → `COALESCE(dim_product.name, '(已下架菜品 #' || product_id || ')')`
4. `startDate > endDate` → HTTP 400 with `code: "INVALID_DATE_RANGE"` (Rule 6)
5. Single-day query (start == end) → normal response, one xAxis element
6. Range exceeds Gold coverage → `dateRange.coverageWarning: "数据起始 ..."` field

### Task 5 — Python rules audit (per `.claude/rules/python-java-port.md`)

Mandatory before merge:

- **Rule 1**: `is not None` not `or` for null checks on `agg_daily.gross_amount` etc.
- **Rule 4**: `_decimal_to_number()` for ALL monetary values in JSON output
- **Rule 6**: `raise ValueError` if start_date / end_date None in any helper
- **Rule 10**: `(actual / target).quantize(Decimal("0.0001"), ROUND_HALF_UP) * 100` for percentages — intermediate quantize at scale 4 before final scale 2
- **Rule 11**: `_java_isoformat()` for datetime fields
- **Rule 12**: `Decimal.quantize(..., ROUND_HALF_UP)` for display, not f-string `:.Nf`

## Test strategy

3 chains have data on prod (per acceptance memo §0.5.1):
- `RES_3101_009`: 1730 days, full year, all 5 Gold tables populated
- `R_GML_DEMO`: 132 stores, 1 day, agg_daily + agg_product + agg_daily_order_type_meal only
- `R_XMX_CHAIN`: 1 store, 1 day, agg_daily + agg_product + agg_daily_order_type_meal only

Test against test env (port 8084) first. If test DB has no R_*_REAL data, smoke-test direct against prod port 8083 for `RES_3101_009` (paused-traffic factory_id).

Pre-deploy checklist (per spec §9):
- [ ] `\du cretas` on smartbi_prod_db — confirm Bypass RLS attribute. If NOT bypass, add `SELECT set_config('app.factory_id', $1, true)` in restaurant query helpers
- [ ] `agg_product` index for `WHERE factory_id=$1 AND month BETWEEN $2 AND $3 ORDER BY revenue DESC LIMIT 20` — verify EXPLAIN. If missing, add migration `V20260514_XX__agg_product_revenue_idx.sql`
- [ ] Same check for `agg_daily_order_type_meal`

## Deploy coordination (CRITICAL)

Per spec §6.1, your backend PR ships **BEFORE** frontend, **WITH** nginx:
1. Your PR test deploy first (test 8084)
2. Sister chat PR-C deploys nginx test config
3. Smoke test
4. Your PR prod deploy (Blue-Green 8083)
5. PR-C deploys nginx prod config
6. **Sister chat PR-B merges + deploys frontend LAST** (placeholder swap)

If you merge before nginx routes restaurants to Python, restaurants still 404 at nginx — broken UX. **Do NOT merge your PR independently. Coordinate with PR-C chat.**

## Output / PR

- Branch: `feat/phase-iia-restaurant-sales-finance-backend`
- Open PR with title `feat(smartbi): Phase IIa restaurant branch for /analysis/{sales,finance}`
- PR body must include: links to spec sections, edge case test list, pre-deploy checklist completion status
- **DO NOT MERGE** the PR yourself. Ping organizer for admin-merge after sister chats PR-B + PR-C ready, in the deploy order above.

## Reporting back

When PR opens, report:
- PR URL
- Branch SHA
- Any deviations from spec (with justification)
- Open questions for organizer

If you hit a blocker (e.g. `\du cretas` reveals no BYPASSRLS — need to switch to set_config pattern, or agg_product missing index requires migration), pause and ping organizer.
