# Phase 2A `/analysis/sales` — Gold Adapter Spec

| Field | Value |
|---|---|
| **Type** | Gold adapter (5 of 5 sub-specs) |
| **Status** | Drafted, awaiting user review |
| **Endpoint** | `GET /api/mobile/{factoryId}/smart-bi/analysis/sales` (overview field) |
| **Java reference** | `GoldDashboardBuilder.java` (247 LOC) — adapter only, no Gold infrastructure to port |
| **Python infra** | EXISTS — `backend/python/smartbi/gold/queries.py` (`finance_summary`, `kpi_summary`, daily trend, top products) |
| **Branch** | `phase2a/t5-poc` |
| **Sibling specs** | foundation / overview / rankings / trend |

## §1. Why this spec exists

Overview agent's exploration discovered that `F001 golden's overview field comes from `GoldDashboardBuilder.buildFromGoldWithCharts`, NOT legacy `SalesAnalysisServiceImpl.getSalesOverview`. Without a Gold-path port, F001 byte-shape test cannot pass.

Subsequent investigation (post-overview-agent) discovered:

1. **Gold infrastructure already exists in Python**:
   - `backend/python/smartbi/api/gold_reads.py` (388 LOC) exposes Gold endpoints
   - `backend/python/smartbi/gold/queries.py` exports `finance_summary()` (line 364) returning `total_revenue / bill_count / avg_bill_value / store_count / top_stores` — exact fields the Java adapter needs
   - SQL migration `2026_05_05_gold_aggregations.sql` defines `agg_daily` Gold projection table
   - Tests: `test_gold_aggregations.py`, `test_gold_analysis_results_batch.py`

2. **Java `GoldDashboardBuilder` is purely a SHAPE ADAPTER** — it makes HTTP calls to Python's Gold endpoints and converts the JSON response into `DashboardResponse` shape. The "business logic" is 100% in Python; Java is a HTTP-RPC boundary.

3. **Python-on-Python won't need HTTP self-call** — Phase 2A port becomes:
   ```
   Python /api/mobile/F001/smart-bi/analysis/sales 
     → _get_sales_overview 
     → from smartbi.gold.queries import finance_summary; await finance_summary(pool, fid, range_)
     → _build_from_gold_finance_summary (Python adapter, mirrors Java GoldDashboardBuilder)
     → DashboardResponse-shape dict
   ```

This sub-spec defines the Python adapter — ~150-200 LOC mirroring Java `GoldDashboardBuilder.buildFromGoldWithCharts` lines 58-227. No new SQL, no new Gold infrastructure.

## §2. Scope (what gold OWNS vs PUNTS)

### In-scope (this sub-spec)

1. **Replace `_get_sales_overview` stub body in `analysis_sales.py`** with Gold-first impl:
   - Call `_build_from_gold_with_charts(factory_id, range_)` first
   - If non-null → return as overview dict
   - If null (Gold reports zero revenue + zero bills) → fall back to legacy path defined by overview spec
2. **`_build_from_gold_finance_summary(factory_id, range_) -> Optional[dict]`** — adapter mirroring Java `buildFromFinanceSummary` (lines 58-117):
   - Direct call: `await finance_summary(pool, factory_id, (range_.start_date, range_.end_date), top_n_stores=10)` from `smartbi.gold.queries`
   - Empty short-circuit: revenue==0 AND bills==0 → return None
   - Build 4 KPI cards: `total_revenue / bill_count / avg_bill_value / store_count` (hardcoded titles + units + status="green")
   - Build `top_stores` ranking from `gold["top_stores"]` (rank+name+value only, no target/completionRate/alertLevel)
   - Assemble DashboardResponse-shape dict via foundation factory `_new_dashboard_response_dict(...)`
3. **`_build_from_gold_with_charts(factory_id, range_) -> Optional[dict]`** — wrapper mirroring Java `buildFromGoldWithCharts` (lines 135-158):
   - Calls `_build_from_gold_finance_summary` first
   - Returns None if base is None
   - Otherwise: try `_fetch_gold_trend_chart` + `_fetch_gold_category_chart`, populate `charts` dict
   - Tolerates chart fetch failures (log warning, continue)
4. **`_fetch_gold_trend_chart(factory_id, range_) -> Optional[dict]`** — mirrors Java `fetchTrendChart` (lines 160-191):
   - Direct call: `await daily_trend(pool, factory_id, (range_.start_date, range_.end_date))` from `smartbi.gold.queries`
   - Build ChartConfig: type=LINE, title="销售趋势", xaxisField="date", yaxisField="amount"
   - data: list of `{date: str, amount: Decimal}` from gold response `points` field
   - Empty `points` → return None
5. **`_fetch_gold_category_chart(factory_id, range_) -> Optional[dict]`** — mirrors Java `fetchCategoryChart` (lines 193-227):
   - Direct call: `await top_products(pool, factory_id, (range_.start_date, range_.end_date), limit=8)` from `smartbi.gold.queries`
   - Build ChartConfig: type=PIE, title="产品类别占比", xaxisField="category", yaxisField="amount"
   - data: list of `{category: str, amount: Decimal}` from gold response `top_products` field
   - Empty `top_products` → return None
6. **Helpers** mirroring Java helpers (lines 229-246):
   - `_to_decimal(v: Any) -> Decimal` — tolerant Number → Decimal, returns ZERO on null/error (mirrors `toBigDecimal`)
   - `_format_kpi_value(v: Decimal, unit: str) -> str` — "元" units → 2-decimal string; others → 0-decimal string (mirrors `formatKpiValue`)
7. **`TestGold` test class** in `test_analysis_sales_contract.py`:
   - `test_F001_overview_byte_shape_via_gold` — Gold path active, byte match against F001 golden
   - `test_gold_empty_short_circuit_falls_back_to_legacy` — synthetic factory with revenue=0 → null → legacy fallback called
   - `test_gold_chart_failure_tolerated` — monkey-patch `daily_trend` to raise; assert `charts` excludes "sales_trend" but rest of response is intact
   - `test_kpi_card_shape` — 4 KPIs with correct keys/titles/units/status="green"
   - `test_top_stores_ranking_shape` — RankingItem with only rank/name/value set; target/completionRate/alertLevel null

### Out-of-scope (PUNT)

| Item | Owned by |
|---|---|
| Foundation `_new_dashboard_response_dict` / `_new_kpi_card_dict` / `_new_ranking_item_dict` / `_new_chart_config_dict` factories | foundation spec |
| Overview legacy 5-KPI path (when `gold_response is None`) | overview spec |
| Rankings real impl (top-level composite `salespersonRanking` etc) | rankings spec |
| Trend real impl (top-level composite `trendChart`) | trend spec |
| `_query_sales_data` SQL extension | foundation spec |
| Java code modifications | NONE |
| Porting Gold infrastructure (agg_daily table, finance_summary SQL, top_products SQL) | NONE — already exists in Python |
| HTTP self-calls / FastAPI TestClient invocation of Gold endpoints | NONE — direct function imports |

## §3. Architecture

### Data flow

```
_get_sales_overview(factory_id, range_)
  ├─ try:
  │    pool = await get_pg_pool()
  │    gold_dashboard = await _build_from_gold_with_charts(factory_id, range_, pool)
  │    if gold_dashboard is not None:
  │      return gold_dashboard            # F001 path today (Gold has data)
  │    # Gold reports empty; fall through to legacy
  │ except Exception as e:
  │    logger.warning("[gold-builder] Gold fetch failed: %s; falling back to legacy", e)
  │    # fall through
  └─ return _build_legacy_sales_overview(factory_id, range_)  # overview spec impl


_build_from_gold_with_charts(factory_id, range_, pool)
  ├─ base = await _build_from_gold_finance_summary(factory_id, range_, pool)
  ├─ if base is None: return None
  ├─ trend_chart = await _fetch_gold_trend_chart(factory_id, range_, pool)
  ├─ category_chart = await _fetch_gold_category_chart(factory_id, range_, pool)
  ├─ charts = {}
  ├─ if trend_chart: charts["sales_trend"] = trend_chart
  ├─ if category_chart: charts["category_distribution"] = category_chart
  ├─ if charts: base["charts"] = charts  # else leave default {}
  └─ return base


_build_from_gold_finance_summary(factory_id, range_, pool)
  ├─ from smartbi.gold.queries import finance_summary
  ├─ gold = await finance_summary(pool, factory_id, (range_.start_date, range_.end_date), top_n_stores=10)
  ├─ revenue = _to_decimal(gold["total_revenue"])
  ├─ bills   = _to_decimal(gold["bill_count"])
  ├─ avg_bill = _to_decimal(gold["avg_bill_value"])
  ├─ stores  = _to_decimal(gold["store_count"])
  ├─ if revenue == 0 AND bills == 0: return None  # legacy fallback
  ├─ kpi_cards = [
  │    _new_kpi_card_dict(key="total_revenue", title="总营收",
  │      value=_format_kpi_value(revenue, "元"), raw_value=revenue, unit="元", status="green"),
  │    _new_kpi_card_dict(key="bill_count", title="账单数",
  │      value=_format_kpi_value(bills, "单"), raw_value=bills, unit="单", status="green"),
  │    _new_kpi_card_dict(key="avg_bill_value", title="客单价",
  │      value=_format_kpi_value(avg_bill, "元"), raw_value=avg_bill, unit="元", status="green"),
  │    _new_kpi_card_dict(key="store_count", title="门店数",
  │      value=_format_kpi_value(stores, "家"), raw_value=stores, unit="家", status="green"),
  │  ]
  ├─ top_stores = []
  ├─ for i, store in enumerate(gold.get("top_stores", []), start=1):
  │    top_stores.append(_new_ranking_item_dict(
  │      rank=i, name=str(store["store_name"]), value=_to_decimal(store["revenue"]),
  │      target=None, completion_rate=None, alert_level=None,
  │    ))
  ├─ return _new_dashboard_response_dict(
  │    kpi_cards=kpi_cards,
  │    rankings={"top_stores": top_stores},
  │    charts={},                           # populated by buildFromGoldWithCharts wrapper
  │    ai_insights=[],                      # Java line 113: empty list
  │    suggestions=[],                      # Java line 114: empty list
  │    last_updated=_utc_now_iso(),
  │  )
```

### Empty short-circuit semantics

Java line 68-72:
```java
if (revenue.signum() == 0 && bills.signum() == 0) {
    log.info("[gold-builder] factory={} ... empty Gold → null (legacy fallback)", ...);
    return null;
}
```

Python equivalent:
```python
if revenue == Decimal("0") and bills == Decimal("0"):
    logger.info(
        "[gold-builder] factory=%s range=%s..%s empty Gold → None (legacy fallback)",
        factory_id, range_.start_date, range_.end_date,
    )
    return None
```

⚠ Subtle: Java's `signum() == 0` is true for both `BigDecimal.ZERO` and `BigDecimal("0.00")`. Python `Decimal("0") == Decimal("0.00")` is also True (Decimal compares by value, not representation). Safe to use `==`.

### Chart failure tolerance

Java lines 186-190 (trend) + 222-226 (category):
```java
catch (Exception e) {
    log.warn("[gold-builder] trend fetch failed ...: {}", e.getMessage());
    return null;
}
```

Python equivalent:
```python
async def _fetch_gold_trend_chart(factory_id, range_, pool):
    try:
        from smartbi.gold.queries import daily_trend
        resp = await daily_trend(pool, factory_id, (range_.start_date, range_.end_date))
        ...
    except Exception as e:
        logger.warning(
            "[gold-builder] trend fetch failed factory=%s range=%s..%s: %s",
            factory_id, range_.start_date, range_.end_date, e,
        )
        return None
```

## §4. Java reference enumeration (mirrored 1:1)

| Java function | Java lines | Python function | Python lines (estimate) |
|---|---|---|---|
| `buildFromFinanceSummary` | 58-117 (60 LOC) | `_build_from_gold_finance_summary` | ~50 LOC |
| `buildFromGoldWithCharts` | 135-158 (24 LOC) | `_build_from_gold_with_charts` | ~30 LOC |
| `fetchTrendChart` | 160-191 (32 LOC) | `_fetch_gold_trend_chart` | ~30 LOC |
| `fetchCategoryChart` | 193-227 (35 LOC) | `_fetch_gold_category_chart` | ~30 LOC |
| `toBigDecimal` | 230-238 (9 LOC) | `_to_decimal` | ~10 LOC |
| `formatKpiValue` | 241-246 (6 LOC) | `_format_kpi_value` | ~6 LOC |
| **Total** | **166 LOC Java** | **~156 LOC Python** | |

⚠ The 247 - 166 = 81 LOC Java overhead is class boilerplate (imports, @Component, @RequiredArgsConstructor, javadoc). Python equivalent has no class wrapper, just module-level functions.

## §5. KPICard field shape (subset used by Gold path)

From Java `buildFromFinanceSummary` lines 75-90, Gold-path KPI cards set 6 fields:

| Field | Java setter | Example value | Notes |
|---|---|---|---|
| `key` | `.key("total_revenue")` | `"total_revenue"` | Stable identifier, hardcoded per card |
| `title` | `.title("总营收")` | `"总营收"` | Hardcoded Chinese, per card |
| `value` | `.value(formatKpiValue(revenue, "元"))` | `"20639884.52"` (string) | Formatted string per `formatKpiValue` |
| `rawValue` | `.rawValue(revenue)` | `BigDecimal("20639884.52")` | Numeric for downstream (charts/sorting) |
| `unit` | `.unit("元")` | `"元"` | Hardcoded per card |
| `status` | `.status("green")` | `"green"` | Hardcoded; @Builder.Default also "green" |

The remaining 7 KPICard fields (`change / changeRate / trend / compareText / description / targetValue / completionRate`) stay null on Gold path. Foundation's `_new_kpi_card_dict` factory (defined by overview spec, since overview spec owns KPICard) MUST emit nulls for these.

⚠ This means **gold spec depends on overview spec's KPICard factory existing**. Two options:

| Option | Pro | Con |
|---|---|---|
| **(i) Move `_new_kpi_card_dict` to foundation** | Gold + overview both consume from foundation | foundation grows; foundation already big |
| **(ii) Keep KPICard factory in overview spec; gold spec waits for overview merge before merging** | foundation small; clean ownership | sequential dependency: overview must merge before gold |

**Recommendation: (i)** — foundation owns KPICard factory. Trade-off: foundation +50 LOC, but cleaner dependency graph (gold + overview both depend on foundation only, not each other). Foundation plan task #1 (javap KPICard) already in scope.

## §6. RankingItem field shape (Gold path subset)

Java lines 99-103 set only 3 of 6 RankingItem fields:

| Field | Gold sets? | Value |
|---|---|---|
| `rank` | Yes | 1-indexed, post-loop |
| `name` | Yes | `String.valueOf(store.get("store_name"))` |
| `value` | Yes | `toBigDecimal(store.get("revenue"))` |
| `target` | No | null |
| `completionRate` | No | null |
| `alertLevel` | No | null |

Foundation's `_new_ranking_item_dict` (already FROZEN at 6 fields per rankings spec direct read) accepts None for the unset fields and emits `"target": null, "completionRate": null, "alertLevel": null` in JSON. ✓ Compatible.

## §7. ChartConfig field shape (Gold path)

Java lines 179-185 (trend) + 215-221 (category) build ChartConfig with only 5 of 7 declared fields:

| Field | Gold trend | Gold category |
|---|---|---|
| `chartType` | "LINE" | "PIE" |
| `title` | "销售趋势" | "产品类别占比" |
| `seriesField` | not set → null | not set → null |
| `data` | `[{date, amount}]` | `[{category, amount}]` |
| `options` | not set → null | not set → null |
| `xaxisField` | "date" | "category" |
| `yaxisField` | "amount" | "amount" |

⚠ **Gold-path `options` is null** (Java doesn't set it). This DIFFERS from foundation's stub for `_get_sales_trend_chart` which hardcodes `options={"showDataLabels": False, "smooth": True}` per F999 golden empty-state. So:
- composite `trendChart` (top-level, foundation stub for F999) → options=`{"showDataLabels": false, "smooth": true}` (matches F999 empty state — but F999 came from legacy path, not Gold)
- overview embedded `charts.sales_trend` (gold-path) → options=null

Both are valid because they cover different code paths. Foundation factory accepts both via parameter. Plan task: confirm F001 byte includes `charts.sales_trend.options` as null (verify against golden).

## §8. Test fixtures

### Test class added to `test_analysis_sales_contract.py`

```python
class TestGold:
    """Gold-path adapter contract tests. Foundation/overview gates run first."""

    @pytest.fixture
    def mock_finance_summary_f001(self):
        """Mock smartbi.gold.queries.finance_summary returning F001-shaped data."""
        return {
            "factory_id": "F001",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
            "total_revenue": 20639884.52,
            "bill_count": 140541,
            "avg_bill_value": 146.86,
            "store_count": 8,
            "top_stores": [
                # ... synthetic stores matching F001 golden's top_stores list
            ],
        }

    def test_F001_overview_byte_shape_via_gold(
        self, monkeypatch, client, f001_token, mock_finance_summary_f001
    ):
        """Gold path produces overview matching F001 golden after strip-volatile."""
        from smartbi_compat.api import analysis_sales as router_module
        async def fake_finance_summary(pool, fid, range_, top_n_stores=10):
            return mock_finance_summary_f001
        monkeypatch.setattr(router_module, "_call_finance_summary", fake_finance_summary)
        # ... fetch + strip + compare overview field byte against golden

    def test_gold_empty_short_circuit_falls_back_to_legacy(
        self, monkeypatch, client, f001_token,
    ):
        """revenue=0, bills=0 → None → legacy path engaged."""
        from smartbi_compat.api import analysis_sales as router_module
        async def empty_gold(pool, fid, range_, top_n_stores=10):
            return {"total_revenue": 0, "bill_count": 0, ...}
        monkeypatch.setattr(router_module, "_call_finance_summary", empty_gold)
        # ... assert response uses legacy shape (kpi_cards calculated from sales_data, not Gold)

    def test_gold_chart_failure_tolerated(self, monkeypatch, client, f001_token):
        """daily_trend raises → charts excludes 'sales_trend' but rest intact."""
        from smartbi_compat.api import analysis_sales as router_module
        async def failing_trend(*args, **kwargs):
            raise RuntimeError("simulated Gold trend failure")
        monkeypatch.setattr(router_module, "_call_daily_trend", failing_trend)
        # ... assert overview.charts has category_distribution but not sales_trend
        # ... assert kpi_cards still populated

    def test_kpi_card_shape(self, monkeypatch, client, f001_token, mock_finance_summary_f001):
        """4 Gold KPI cards have key/title/value/rawValue/unit/status fields."""
        # ... assert each card has 13 fields (per overview spec), with the 6 Gold-set
        # fields populated and 7 others null

    def test_top_stores_ranking_shape(self, monkeypatch, client, f001_token, mock_finance_summary_f001):
        """top_stores ranking has only rank/name/value populated; target/completionRate/alertLevel null."""
```

### Monkey-patch indirection

Direct imports of `smartbi.gold.queries.finance_summary / daily_trend / top_products` make monkey-patching tricky. Wrap them in module-level seam functions in `analysis_sales.py`:

```python
# In analysis_sales.py
async def _call_finance_summary(pool, factory_id, date_range, top_n_stores=10):
    """Module-level seam for monkey-patching contract tests."""
    from smartbi.gold.queries import finance_summary
    return await finance_summary(pool, factory_id, date_range, top_n_stores=top_n_stores)

async def _call_daily_trend(pool, factory_id, date_range):
    from smartbi.gold.queries import daily_trend
    return await daily_trend(pool, factory_id, date_range)

async def _call_top_products(pool, factory_id, date_range, limit=8):
    from smartbi.gold.queries import top_products
    return await top_products(pool, factory_id, date_range, limit=limit)
```

Then `_build_from_gold_finance_summary` calls `_call_finance_summary(...)` instead of `finance_summary(...)` directly. Mirrors alerts contract test pattern (`monkeypatch.setattr(analysis_router, "_query_sales_data", ...)`).

## §9. F001 byte-shape strategy

### What F001 byte test actually validates (via Gold path)

| Field | Source | Validates |
|---|---|---|
| `overview.kpiCards[0..3]` | `_build_from_gold_finance_summary` | KPI card shape + Gold field mapping + format function |
| `overview.rankings.top_stores` | `_build_from_gold_finance_summary` | top_stores ranking adapter |
| `overview.charts.sales_trend` | `_fetch_gold_trend_chart` | trend chart adapter (LINE) |
| `overview.charts.category_distribution` | `_fetch_gold_category_chart` | category chart adapter (PIE) |
| `overview.aiInsights` | hardcoded `[]` | matches Java line 113 |
| `overview.suggestions` | hardcoded `[]` | matches Java line 114 |
| `overview.lastUpdated` | `_utc_now_iso()` | volatile, stripped |
| `overview.fromCache` | factory default `false` | matches Java |
| `overview.{period, startDate, endDate, metricCards, chartList, alerts, recommendations, generatedAt, cacheExpireAt}` | factory defaults (null/None) | DashboardResponse 16-field shape |

### Decimal precision (per Java `setScale(DISPLAY_SCALE=2, ROUNDING_MODE=HALF_UP)`)

- `total_revenue` → 2 decimals (元)
- `avg_bill_value` → 2 decimals (元)
- `bill_count` → 0 decimals (单)
- `store_count` → 0 decimals (家)
- Trend chart `amount` → 2 decimals
- Category chart `amount` → 2 decimals

⚠ Python `Decimal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)` matches Java `setScale(2, HALF_UP)` exactly. Plan task: spot-check 1 KPI value byte-equal between Java and Python after this.

## §10. Risk register (Gold-specific, plus inherited)

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| **G1** | `smartbi.gold.queries` API may change between when this spec was written and impl. Adapter tests would break. | Low | Pin via direct import + version-controlled SQL migration. Plan task: `pytest tests/test_gold_aggregations.py` to confirm Gold infra is healthy before adapter port begins. |
| **G2** | F001 test env may not have `agg_daily` table populated (Gold projection runs from Silver via cron/trigger; if cron hasn't run, table is empty) | Medium | Plan task: `psql smartbi_db -c "SELECT COUNT(*) FROM agg_daily WHERE factory_id='F001'"`. If 0, run aggregation manually or seed. |
| **G3** | Java `formatKpiValue` for "元" returns `.toPlainString()` — could be `"20639884.52"` or `"20639884.5"` depending on how setScale handles trailing zeros. Python `Decimal.quantize(Decimal("0.01")).normalize()` may strip `.50` → `.5`, breaking byte match | Medium | Use `str(Decimal("20639884.52").quantize(Decimal("0.01")))` (no normalize) — preserves trailing zero. Mirror Java's `toPlainString()` semantics. Plan task: write unit test for `_format_kpi_value(Decimal("100.50"), "元")` → `"100.50"` (not `"100.5"`). |
| **G4** | Gold response `top_stores` field may have different `store_name` / `revenue` keys than expected — schema drift risk | Low | Direct read of `finance_summary` Python function (queries.py:364) confirmed key names. Compatibility guaranteed by import. |
| **G5** | Async/sync boundary: `_get_sales_overview` is currently sync (foundation defines `def`, not `async def`). Gold queries are async. Need to bridge. | High | Two options: (a) make `_get_sales_overview` async + propagate up to route handler (already async); (b) use `asyncio.run()` inside sync function (anti-pattern, bad). **Choose (a)**. Foundation needs updating: change all 5 sub-service signatures to `async def`. **Affects all 4 sibling specs** — coordinated change. |
| **G6** | Inherited R5 (F001 data shape): with Gold port, F001 byte test now validates Gold path real data. Legacy 1261 LOC stays dead code on F001 — that's OK. | (resolves R5/R11) | Gold port is the resolution. |
| **G7** | Inherited R12 (F001 byte-shape match completeness): rankings + trend top-level still empty on F001. Gold port doesn't help those (they're top-level composite, not embedded in overview) | Medium | Sibling specs (rankings + trend) still recommend Option C synthetic data goldens for non-empty path coverage. Gold spec doesn't address this. |

## §11. Open questions (TBD until impl)

1. **agg_daily table existence in test env (G2)**: plan task to verify `psql smartbi_db -c "\d agg_daily"` exists, has correct schema, has F001 rows.
2. **Async signature change (G5)**: all 5 sub-services need `async def`. Confirms foundation §5 sub-service contract update. Plan task to re-write contract section.
3. **`top_stores` revenue field BigDecimal precision**: Java `RankingItem.value` is BigDecimal scale=2 (per rankings spec §9). Gold returns float. Plan task: confirm `_to_decimal(float) → Decimal` produces same scale as Java `new BigDecimal(String.valueOf(float))`.
4. **Chart `data` field key order**: Java uses `LinkedHashMap` for `{date, amount}` and `{category, amount}` — preserves insertion order. Python `dict` is insertion-ordered ≥3.7. ✓ compatible. Confirm by inspection of F001 golden chart data.
5. **Java line 137 `setCharts(charts)` AFTER line 110 `.charts(new LinkedHashMap<>())`**: builds with empty charts then overwrites. Python factory should support `charts=None` initially with mutation later, OR construct once with all charts. Recommendation: construct once. Adjust §3 flow accordingly.
6. **Gold response cache**: Does Java cache Gold response within request? Python should match. Plan task: check `GoldFinanceClient.fetchFinanceSummary` for cache annotations. If cached, Python adapter should also avoid duplicate calls.

## §12. Acceptance criteria

Gold spec impl is complete when:

- [ ] `_build_from_gold_finance_summary` returns DashboardResponse-shape dict on F001 mock
- [ ] `_build_from_gold_with_charts` populates `charts` map with sales_trend + category_distribution
- [ ] Empty Gold response returns None (legacy fallback engaged)
- [ ] Chart fetch failures logged but tolerated
- [ ] `TestGold` class passes all 5 tests
- [ ] F001 byte-shape contract test PASSES (via Gold path, after strip-volatile)
- [ ] Java `setScale(2, HALF_UP)` formatting matches Python `Decimal.quantize(Decimal("0.01"))` for 元 unit values, preserving trailing zeros
- [ ] All sub-service signatures changed to `async def` (foundation update)
- [ ] No HTTP self-calls (direct function imports only)
- [ ] No new SQL helpers (reuse `smartbi.gold.queries` exports)
- [ ] No Java code modifications

## §13. Plan structure preview

When gold chat runs, expected phases:

- **Phase A** (~3 tasks): Pre-impl verify
  - A.1: `pytest tests/test_gold_aggregations.py` to confirm Gold infra healthy
  - A.2: `psql smartbi_db -c "SELECT COUNT(*) FROM agg_daily WHERE factory_id='F001'"` to confirm F001 has Gold data
  - A.3: Read `smartbi.gold.queries.finance_summary` + `daily_trend` + `top_products` signatures, confirm types

- **Phase B** (~5 tasks): Adapter impl
  - B.1: Add 3 module-level seam functions (`_call_finance_summary` / `_call_daily_trend` / `_call_top_products`)
  - B.2: Add 2 helpers (`_to_decimal`, `_format_kpi_value`) with unit tests
  - B.3: Implement `_build_from_gold_finance_summary` (~50 LOC)
  - B.4: Implement `_fetch_gold_trend_chart` + `_fetch_gold_category_chart` (~60 LOC combined)
  - B.5: Implement `_build_from_gold_with_charts` wrapper (~30 LOC)

- **Phase C** (~3 tasks): Wire into overview
  - C.1: Replace `_get_sales_overview` stub: try Gold first, null → legacy fallback
  - C.2: Async signature change (foundation update — coordinate with overview/rankings/trend specs)
  - C.3: Run F001 contract test, debug byte mismatches

- **Phase D** (~3 tasks): Verification
  - D.1: Run full `test_analysis_sales_contract.py` (all classes pass)
  - D.2: Run `test_alerts_contract.py` + `test_recommendations_contract.py` (no regression)
  - D.3: Deploy to test env (10011), curl `/analysis/sales` against F001, confirm response shape

Total: ~14 tasks, ~3-4h work for gold chat.

## §14. Parallel work analysis

| Dimension | Parallel possible? |
|---|---|
| Writing this spec (now) | DONE — written sequentially after foundation/overview/rankings/trend |
| Writing gold plan | No — single document |
| Executing gold spec (later chat) | **Sequential after overview spec merged**. Reason: gold relies on overview's KPICard factory (per §5 option (i), KPICard moves to foundation; if not, gold blocks on overview). Recommend: foundation → overview → gold → rankings → trend. |
| Multiple chats editing `analysis_sales.py` | NO — concurrent-edit-safety rule 1+2+5b. Sequential or sub-worktrees only. |

## §15. Cross-cutting impact on sibling specs

Gold spec introduces **2 cross-cutting changes** that affect sibling specs:

### Change 1: All sub-service signatures `async def`

Foundation §5 currently freezes:
```python
def _get_sales_overview(factory_id: str, range_: DateRange) -> dict: ...
def _get_salesperson_ranking(factory_id: str, range_: DateRange) -> list[dict]: ...
# etc
```

Gold spec needs `async def` because it awaits Gold queries. Update foundation §5 to:
```python
async def _get_sales_overview(factory_id: str, range_: DateRange) -> dict: ...
async def _get_salesperson_ranking(factory_id: str, range_: DateRange) -> list[dict]: ...
# etc
```

Composite assembly + route handler also `async def`. Already `async def` on the route per foundation §3, so propagation is mechanical.

Sibling specs (rankings, trend) need to use `async def` for their stubs too. Overview spec already assumes async (Gold-vs-legacy branch).

### Change 2: KPICard factory ownership

Per §5 option (i), `_new_kpi_card_dict` moves to foundation (was originally in overview spec). Foundation plan task #1 expands from "javap 4 DTOs" to "javap 5 DTOs" (DashboardResponse / RankingItem / ChartConfig / AIInsight / KPICard). Overview spec §4 keeps `_new_metric_result_dict` only.

This decouples gold + overview: both consume from foundation, neither depends on the other.

End of gold spec.
