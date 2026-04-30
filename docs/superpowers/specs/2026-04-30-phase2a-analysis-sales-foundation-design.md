# Phase 2A `/analysis/sales` — Foundation Spec

| Field | Value |
|---|---|
| **Type** | Foundation (1 of 4 sub-specs) |
| **Status** | Drafted, awaiting user review |
| **Endpoint** | `GET /api/mobile/{factoryId}/smart-bi/analysis/sales` |
| **Java reference** | `SmartBIAnalysisController.getSalesAnalysis` line 98-138 → `SmartBIServiceImpl.getComprehensiveAnalysis(..., "sales")` line 568-616 → `SalesAnalysisServiceImpl` (1261 LOC) |
| **Phase 2A counter** | This is endpoint #6 (after alerts + recommendations + 3 prior batch 2 thin Z) |
| **Branch** | `phase2a/t5-poc` (worktree at `.worktrees/phase2a-t5-poc`) |
| **Sibling specs** | overview / rankings / trend (each adds 1+ sub-service real impl) |

## §1. Why split into 4 specs

`/analysis/sales` is materially bigger than `/alerts` or `/recommendations`:

- Composite `Map<String, Object>` with **7 keys** (overview + 3 rankings + trend chart + dateRange + generatedAt)
- `overview` field is `DashboardResponse` (16-field DTO, 5 deprecated fields still emit nulls per Lombok @Data)
- `SalesAnalysisServiceImpl` is **1261 LOC Java** (~10× alerts generator)
- F001 golden is **1708 lines** (vs 78 for F999 empty state)
- T0 estimate: 15-20h, post-calibration unknown until first sub-spec ships

Decomposed into 4 specs to:

1. Lock interface contracts before implementation diverges (DTO dict factory shapes, sub-service signatures, composite key order)
2. Allow sequential execution across 3-4 chats with each chat owning ~300 LOC
3. Gate F999 contract test (empty-state envelope match) at foundation merge — not after everything done
4. Keep concurrent-edit risk on `analysis_sales.py` manageable (≤1 chat editing at a time)

See sibling specs for what each owns:

- **`overview`** — `_get_sales_overview` real impl + KPICard / MetricResult dict factories + AI insight dynamic generator (1261 LOC Java reference's biggest chunk)
- **`rankings`** — `_get_salesperson_ranking` / `_get_product_ranking` / `_get_customer_ranking` real impls (3 same-pattern functions) + sort stability via secondary key
- **`trend`** — `_get_sales_trend_chart` real impl + DAY/WEEK/MONTH bucketing

## §2. Scope (what foundation OWNS vs PUNTS)

### In-scope (foundation merge unblocks F999 contract test)

1. **New module file**: `backend/python/smartbi_compat/api/analysis_sales.py`
2. **Route registration**: `@router.get("/api/mobile/{factory_id}/smart-bi/analysis/sales")`
3. **Composite assembly**: `_get_comprehensive_sales_analysis(factory_id, range_)` → 7-key dict
4. **5 sub-service stubs** returning F999-shape (empty state, never raise)
5. **DTO dict factories** (4 of them):
   - `_new_dashboard_response_dict(...)` — 16 fields incl. 5 deprecated (DashboardResponse.java)
   - `_new_ranking_item_dict(...)` — RankingItem.java declared + derived getters
   - `_new_chart_config_dict(...)` — ChartConfig.java declared + derived getters
   - `_new_ai_insight_dict(...)` — AIInsight.java declared + derived getters
6. **DateRange Python port enhancement** in `smartbi_compat/date_range.py`:
   - Verify `days` / `valid` derived getters exist; add if missing
   - `_new_date_range_dict(range_)` factory matching F999 golden 7-field shape
7. **SQL helper extension**: `_query_sales_data` in `analysis.py` adds `order_date` column to SELECT (foundation in-scope; trend spec depends)
8. **Test fixture file**: `tests/python/smartbi_compat/test_analysis_sales_contract.py` with F999 envelope-only test class
9. **Strip-volatile helper**: `_strip_volatile()` shared utility (new module or co-located)
10. **Goldens recording script**: `scripts/phase2a/record-analysis-sales-goldens.sh`

### Out-of-scope (PUNT to sibling specs)

| Item | Owned by |
|---|---|
| Real KPI calculations / `_get_sales_overview` impl | overview spec |
| KPICard / MetricResult dict factories | overview spec |
| AI insight dynamic generator (multi-branch logic) | overview spec |
| 3 ranking real impls (`_get_salesperson_ranking` / `_get_product_ranking` / `_get_customer_ranking`) | rankings spec |
| Sort stability fix (secondary key) | rankings spec |
| Generic `_build_ranking()` helper | rankings spec |
| Trend chart bucketing (DAY/WEEK/MONTH) | trend spec |
| `_bucket_sales_by_period` helper | trend spec |
| F001 byte-shape contract tests | each sibling spec adds its own |
| Java code modifications (e.g. TreeMap fixes) | none (Python-side fixes only) |

## §3. Architecture

### File layout

```
backend/python/smartbi_compat/
├── api/
│   ├── analysis.py                ← UNCHANGED except _query_sales_data adds order_date
│   └── analysis_sales.py          ← NEW. Foundation creates with stubs.
│                                    Sibling specs replace stub bodies.
└── date_range.py                  ← UNCHANGED unless days/valid getters missing
```

```
tests/python/smartbi_compat/
└── test_analysis_sales_contract.py  ← NEW. Foundation creates with TestEnvelope class.
                                       Sibling specs add TestOverview / TestRankings /
                                       TestTrend test classes.
```

```
tests/fixtures/java-smartbi-golden/
├── analysis-sales-F999.json                  ← EXISTS (78 lines, empty state)
├── analysis-sales-dimension-salesperson-F999.json  ← EXISTS (79 lines, near-identical)
└── analysis-sales-F001.json                  ← EXISTS (1708 lines, full data)
```

```
scripts/phase2a/
└── record-analysis-sales-goldens.sh  ← NEW. Records F999 + F001 against test env (10011).
                                        Triggered when Java-side schema changes.
```

### Composite Map shape (7 keys)

Per `SmartBIServiceImpl.getComprehensiveAnalysis` line 578-584 + 612-613:

```java
result.put("overview", salesService.getSalesOverview(...));
result.put("salespersonRanking", salesService.getSalespersonRanking(...));
result.put("productRanking", salesService.getProductRanking(...));
result.put("customerRanking", salesService.getCustomerRanking(...));
result.put("trendChart", salesService.getSalesTrendChart(..., "DAY"));
// ... after switch ...
result.put("dateRange", DateRange.custom(startDate, endDate));
result.put("generatedAt", LocalDateTime.now());
```

**Java HashMap iteration order ≠ Java `.put()` order** (HashMap is hash-bucket-ordered). Jackson serializes by HashMap entrySet iterator. F999 golden observed actual JSON key order:

```
overview / customerRanking / productRanking / dateRange / salespersonRanking / generatedAt / trendChart
```

**Python composite must construct dict in this exact order** (Python dict is insertion-ordered ≥3.7) for byte-shape match. Code:

```python
def _get_comprehensive_sales_analysis(factory_id: str, range_: DateRange) -> dict:
    """Java reference: SmartBIServiceImpl.getComprehensiveAnalysis sales branch.

    Key order matches F999/F001 golden (Jackson serialization of Java HashMap),
    NOT Java result.put() order.
    """
    return {
        "overview":           _get_sales_overview(factory_id, range_),
        "customerRanking":    _get_customer_ranking(factory_id, range_),
        "productRanking":     _get_product_ranking(factory_id, range_),
        "dateRange":          _new_date_range_dict(range_),
        "salespersonRanking": _get_salesperson_ranking(factory_id, range_),
        "generatedAt":        _utc_now_iso(),
        "trendChart":         _get_sales_trend_chart(factory_id, range_, "DAY"),
    }
```

### Sub-service stub strategy

Foundation merge must allow F999 contract test to PASS without sibling spec impls. Stubs return F999-shape (NOT raise NotImplementedError):

```python
def _get_sales_overview(factory_id: str, range_: DateRange) -> dict:
    """STUB — overview spec replaces. Returns F999 empty-state DashboardResponse."""
    return _new_dashboard_response_dict(
        ai_insights=[
            _new_ai_insight_dict(
                level="YELLOW",
                category="数据状态",
                message="当前时间范围内暂无销售数据",
                action_suggestion="请上传销售数据或调整时间范围",
            ),
        ],
        suggestions=["请先上传销售数据以开始分析"],
        last_updated=_utc_now_iso(),
    )

def _get_salesperson_ranking(factory_id: str, range_: DateRange) -> list:
    """STUB — rankings spec replaces."""
    return []

def _get_product_ranking(factory_id: str, range_: DateRange) -> list:
    """STUB — rankings spec replaces."""
    return []

def _get_customer_ranking(factory_id: str, range_: DateRange) -> list:
    """STUB — rankings spec replaces."""
    return []

def _get_sales_trend_chart(factory_id: str, range_: DateRange, period: str = "DAY") -> dict:
    """STUB — trend spec replaces. Returns F999 empty-state ChartConfig."""
    return _new_chart_config_dict(
        chart_type="LINE",
        title="销售趋势",
        xaxis_field="date",
        yaxis_field="amount",
        data=[],
        options={"showDataLabels": False, "smooth": True},
    )
```

After foundation merge:

- F999 contract test PASS (envelope + empty-state byte match)
- F001 contract test SKIP / NOT EXIST (sibling specs add)

### Route handler

```python
@router.get("/api/mobile/{factory_id}/smart-bi/analysis/sales")
async def get_sales_analysis(
    factory_id: str,
    startDate: date = Query(..., alias="startDate"),
    endDate: date = Query(..., alias="endDate"),
    department: Optional[str] = None,  # Java accepts but ignores when smartBIService≠null
    dimension: Optional[str] = None,   # ditto
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict[str, Any]:
    """Java reference: SmartBIAnalysisController.getSalesAnalysis line 98-138.

    Note: department/dimension query params accepted but IGNORED when
    smartBIService is non-null (Java line 110 short-circuit). F999 goldens
    confirm this — `dimension=salesperson` golden is byte-identical to
    no-dimension golden except `_meta`.
    """
    range_ = DateRange.custom(startDate, endDate)
    result = _get_comprehensive_sales_analysis(auth.factory_id, range_)
    return wrap_response(result)
```

## §4. Public Contract — DTO dict factory shapes (FROZEN)

**Foundation plan task #1: javap each Java class to enumerate ALL getters (declared + Lombok-derived). Freeze final fields list before any sub-spec writes impl.**

Tentative shapes below. ⚠ symbols mark fields needing javap confirmation.

### `_new_dashboard_response_dict`

DashboardResponse.java (164 LOC) declared 16 fields, all @Data getters emit:

```python
def _new_dashboard_response_dict(
    period: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    kpi_cards: list[dict] = None,
    metric_cards: Optional[list] = None,           # @Deprecated
    rankings: dict = None,
    charts: dict = None,
    chart_list: Optional[list] = None,             # @Deprecated
    ai_insights: list[dict] = None,
    alerts: Optional[list] = None,
    recommendations: Optional[list] = None,
    suggestions: Optional[list] = None,            # @Deprecated
    generated_at: Optional[str] = None,
    last_updated: Optional[str] = None,            # @Deprecated
    from_cache: bool = False,
    cache_expire_at: Optional[str] = None,
) -> dict:
    """Mirror DashboardResponse.java @Data getters. ALL 16 fields emit, including
    deprecated ones (Jackson sees them via @Data even if @Deprecated).

    F999 empty-state observed:
      kpi_cards=[], metric_cards=null, rankings={}, charts={}, chart_list=null,
      ai_insights=[<single yellow>], alerts=null, recommendations=null,
      suggestions=["..."], generated_at=null, last_updated=<ts>, from_cache=false,
      cache_expire_at=null
    """
    return {
        "period": period,
        "startDate": start_date.isoformat() if start_date else None,
        "endDate": end_date.isoformat() if end_date else None,
        "kpiCards": kpi_cards or [],
        "metricCards": metric_cards,
        "rankings": rankings or {},
        "charts": charts or {},
        "chartList": chart_list,
        "aiInsights": ai_insights or [],
        "alerts": alerts,
        "recommendations": recommendations,
        "suggestions": suggestions,
        "generatedAt": generated_at,
        "lastUpdated": last_updated,
        "fromCache": from_cache,
        "cacheExpireAt": cache_expire_at,
    }
```

⚠ Field order matches Java DashboardResponse declaration order — verify against F999 golden during impl.

### `_new_ranking_item_dict`

RankingItem.java is 53 LOC. **Confirmed 6 declared fields** (rankings spec direct file read 2026-04-30):

| # | Field | JSON key | Notes |
|---|---|---|---|
| 1 | `rank` (Integer) | `rank` | 1-indexed |
| 2 | `name` (String) | `name` | salesperson / product category / customer |
| 3 | `value` (BigDecimal scale=2) | `value` | always set |
| 4 | `target` (BigDecimal) | `target` | only salesperson sets; product/customer null |
| 5 | `completionRate` (BigDecimal) | `completionRate` | **Dual-purpose**: target completion (salesperson) OR percentage of total (product/customer) |
| 6 | `alertLevel` (String) | `alertLevel` | RED / YELLOW / GREEN |

```python
def _new_ranking_item_dict(
    rank: int,
    name: str,
    value: Decimal,
    target: Optional[Decimal] = None,
    completion_rate: Optional[Decimal] = None,
    alert_level: Optional[str] = None,
) -> dict:
    """Mirror RankingItem.java @Data getters (6 fields exactly, NO derived getters).

    Note: `completionRate` is overloaded — represents target completion percent
    for salesperson rankings (vs `target`), or share-of-total percentage for
    product/customer rankings (where `target` stays null). Rankings spec §8.
    """
    return {
        "rank": rank,
        "name": name,
        "value": value,
        "target": target,
        "completionRate": completion_rate,
        "alertLevel": alert_level,
    }
```

⚠ **No `percentage` field** — earlier draft erroneously assumed product/customer rankings had a separate `percentage`. They reuse `completionRate` instead. Direct read of RankingItem.java confirms 6 fields, no Lombok-derived getters.

### `_new_chart_config_dict`

ChartConfig.java is 68 LOC. F999 observed 7 keys:

```python
def _new_chart_config_dict(
    chart_type: str,
    title: str,
    series_field: Optional[str] = None,
    data: list = None,
    options: dict = None,
    xaxis_field: Optional[str] = None,
    yaxis_field: Optional[str] = None,
) -> dict:
    """Mirror ChartConfig.java @Data getters. F999 observed 7 keys; javap
    plan task #1 to confirm full set."""
    return {
        "chartType": chart_type,
        "title": title,
        "seriesField": series_field,
        "data": data or [],
        "options": options or {},
        "xaxisField": xaxis_field,
        "yaxisField": yaxis_field,
    }
```

⚠ ChartConfig may have `categories` / `subtitle` / `chartId` fields not seen in F999 (because empty); javap to confirm.

### `_new_ai_insight_dict`

AIInsight.java is 46 LOC. F999 observed 5 keys:

```python
def _new_ai_insight_dict(
    level: str,                # RED / YELLOW / GREEN
    category: str,
    message: str,
    related_entity: Optional[str] = None,
    action_suggestion: Optional[str] = None,
) -> dict:
    """Mirror AIInsight.java @Data getters. F999 observed 5 keys."""
    return {
        "level": level,
        "category": category,
        "message": message,
        "relatedEntity": related_entity,
        "actionSuggestion": action_suggestion,
    }
```

### `_new_date_range_dict`

DateRange.java is 322 LOC. F999 observed 7 keys (5 declared + 2 derived):

```python
def _new_date_range_dict(range_: DateRange) -> dict:
    """Mirror DateRange.java @Data getters incl. derived `days` and `valid`.

    F999 observed:
      startDate / endDate (LocalDate)
      granularity (String, e.g. 'YEAR' / 'MONTH' / 'CUSTOM')
      originalExpression (String)
      relative (boolean)
      days (derived = (endDate - startDate).days + 1)
      valid (derived = startDate <= endDate)
    """
    days = (range_.end_date - range_.start_date).days + 1
    return {
        "startDate": range_.start_date.isoformat(),
        "endDate": range_.end_date.isoformat(),
        "granularity": range_.granularity,
        "originalExpression": range_.original_expression,
        "relative": range_.relative,
        "days": days,
        "valid": range_.start_date <= range_.end_date,
    }
```

⚠ Plan task #1: verify `granularity` enum values (YEAR / MONTH / WEEK / DAY / CUSTOM) and how `originalExpression` is built. F999 shows `"2025-01-01 至 2025-12-31"` for custom range with `granularity: "YEAR"` — odd ⇒ Java may auto-promote 365-day range to YEAR granularity. Confirm during impl.

## §5. Sub-service signature contracts (FROZEN)

After foundation merge, sibling specs MUST implement these exact signatures by replacing stub bodies. Foundation does NOT change these signatures across sub-spec execution.

```python
def _get_sales_overview(factory_id: str, range_: DateRange) -> dict:
    """Returns DashboardResponse-shaped dict per _new_dashboard_response_dict.
    Owned by overview spec.
    """

def _get_salesperson_ranking(factory_id: str, range_: DateRange) -> list[dict]:
    """Returns list of RankingItem-shaped dicts. Sorted by value DESC, then
    name ASC for tie stability. No limit. Owned by rankings spec.
    """

def _get_product_ranking(factory_id: str, range_: DateRange) -> list[dict]:
    """Returns list of RankingItem-shaped dicts with percentage field set.
    Sorted by value DESC, then name ASC. No limit. Owned by rankings spec.
    """

def _get_customer_ranking(factory_id: str, range_: DateRange) -> list[dict]:
    """Returns list of RankingItem-shaped dicts with percentage field set.
    Sorted by value DESC, then name ASC. Top 10 cap. Owned by rankings spec.
    """

def _get_sales_trend_chart(factory_id: str, range_: DateRange, period: str = "DAY") -> dict:
    """Returns ChartConfig-shaped dict. period: DAY / WEEK / MONTH / YEAR.
    Composite always passes 'DAY'. Owned by trend spec.
    """
```

**Sibling specs MUST NOT**:

- Change function names or argument signatures (composite calls these directly)
- Modify dict factory return shapes (foundation freezes)
- Modify route handler or composite assembly
- Add new query params to the route

**Sibling specs MAY**:

- Add new private helpers (`_query_X_aggregates`, `_calculate_growth_rate`, `_bucket_sales_by_period`, etc.)
- Add new dict factories specific to their scope (KPICard / MetricResult for overview)
- Replace stub bodies with real impl
- Add test classes to `test_analysis_sales_contract.py` (TestOverview / TestRankings / TestTrend)
- Re-record F001 golden if Python-side sort changes break byte-match (rankings spec)

## §6. SQL helper extension

`smartbi_compat/api/analysis.py` line 283-308 currently:

```python
def _query_sales_data(factory_id, range_):
    sql = text(
        "SELECT salesperson_name, amount, monthly_target, "
        "       product_category, customer_name "
        "FROM smart_bi_sales_data "
        "WHERE factory_id = :fid AND order_date BETWEEN :start AND :end"
    )
```

Foundation extends to add `order_date`:

```python
def _query_sales_data(factory_id, range_):
    sql = text(
        "SELECT salesperson_name, amount, monthly_target, "
        "       product_category, customer_name, order_date "
        "FROM smart_bi_sales_data "
        "WHERE factory_id = :fid AND order_date BETWEEN :start AND :end"
    )
```

**Why foundation owns this change**: trend spec depends. Single-write here keeps `analysis_sales.py` as caller-only (cleaner separation than each spec mutating shared SQL).

**Compatibility**: alerts/recommendations callers don't access `row.order_date` (verified: `_generate_sales_alerts` line 405-505 reads only salesperson_name, amount, monthly_target, customer_name; `_generate_sales_recommendations` line 730-801 same). Adding column to SELECT preserves compatibility.

**Plan task**: re-run `tests/python/smartbi_compat/test_alerts_logic.py` and `test_alerts_contract.py` after change to confirm 0 regressions.

## §7. F999 contract test (foundation merge gate)

`tests/python/smartbi_compat/test_analysis_sales_contract.py`:

```python
"""Contract tests: Python /analysis/sales must match Java byte-shape goldens.

Foundation merge gates:
  - TestEnvelope.test_route_registered
  - TestEnvelope.test_F999_empty_state_byte_shape  ← MUST PASS

Sibling specs add TestOverview / TestRankings / TestTrend.
"""
from __future__ import annotations

import importlib.util
import json
import os
import pathlib
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import jwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

JWT_SECRET = "test-secret-for-phase2a-do-not-use-in-prod"
os.environ["JWT_SECRET"] = JWT_SECRET

GOLDEN_DIR = (
    pathlib.Path(__file__).resolve().parents[2] / "fixtures" / "java-smartbi-golden"
)


def _load_production_main() -> Any:
    main_py = (
        pathlib.Path(__file__).resolve().parents[3]
        / "backend" / "python" / "main.py"
    )
    spec = importlib.util.spec_from_file_location(
        "phase2a_production_main_analysis_sales", main_py
    )
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_production_main = _load_production_main()


def _strip_volatile(obj: Any) -> Any:
    """Strip timing/cache-dependent fields before byte compare."""
    VOLATILE_KEYS = {
        "generatedAt", "lastUpdated", "cacheExpireAt", "timestamp",
    }
    if isinstance(obj, dict):
        return {
            k: _strip_volatile(v)
            for k, v in obj.items()
            if k not in VOLATILE_KEYS
        }
    if isinstance(obj, list):
        return [_strip_volatile(item) for item in obj]
    return obj


@pytest.fixture
def app(monkeypatch):
    """F999 empty-state — stubs already return empty shapes, no patch needed."""
    return _production_main.app


@pytest.fixture
def client(app):
    return TestClient(app)


def _make_token(factory_id: str) -> str:
    payload = {
        "userId": 1,
        "username": "test_user",
        "factoryId": factory_id,
        "role": "factory_super_admin",
        "exp": datetime.now(timezone.utc).timestamp() + 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


@pytest.fixture
def f999_token():
    return _make_token("F999")


class TestEnvelope:
    """Foundation merge gate. Sibling specs add Test{Overview,Rankings,Trend}."""

    def test_route_registered(self, client, f999_token):
        response = client.get(
            "/api/mobile/F999/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f999_token}"},
        )
        assert response.status_code == 200

    def test_jwt_required(self, client):
        response = client.get(
            "/api/mobile/F999/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
        )
        assert response.status_code in (401, 403)

    def test_factory_id_isolation(self, client, f999_token):
        # F999 token must be rejected for F001 path
        response = client.get(
            "/api/mobile/F001/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f999_token}"},
        )
        assert response.status_code == 403

    def test_F999_empty_state_byte_shape(self, client, f999_token):
        """F999 has no sales data → composite Map matches golden after
        strip-volatile."""
        response = client.get(
            "/api/mobile/F999/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f999_token}"},
        )
        assert response.status_code == 200

        actual = _strip_volatile(response.json())

        with open(GOLDEN_DIR / "analysis-sales-F999.json", encoding="utf-8") as f:
            golden = json.load(f)
        expected = _strip_volatile(golden["response"])

        assert actual == expected, (
            f"F999 byte-shape mismatch.\n"
            f"Actual keys: {sorted(actual.get('data', {}).keys()) if isinstance(actual, dict) else 'N/A'}\n"
            f"Expected keys: {sorted(expected.get('data', {}).keys()) if isinstance(expected, dict) else 'N/A'}"
        )

    def test_dimension_param_ignored(self, client, f999_token):
        """Java line 110 short-circuit: when smartBIService≠null, dimension
        query param is read but NOT branched on. Two F999 goldens (with/without
        dimension=salesperson) are byte-identical except _meta."""
        r_no_dim = client.get(
            "/api/mobile/F999/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f999_token}"},
        )
        r_with_dim = client.get(
            "/api/mobile/F999/smart-bi/analysis/sales",
            params={
                "startDate": "2025-01-01",
                "endDate": "2025-12-31",
                "dimension": "salesperson",
            },
            headers={"Authorization": f"Bearer {f999_token}"},
        )
        assert _strip_volatile(r_no_dim.json()) == _strip_volatile(r_with_dim.json())
```

## §8. Risk register

| # | Risk | Severity | Mitigation | Owner |
|---|---|---|---|---|
| **R1** | Java rankings use HashMap groupBy → unstable sort, F001 golden recorded with one ordering, Python with secondary sort key produces another | High | Python adds secondary key `name ASC`. Re-record F001 golden once during rankings impl. | rankings spec |
| **R2** | KPICard 239 LOC has many derived getters; missing one fails F001 byte match | High | foundation plan task #1: javap 4 DTOs (DashboardResponse / RankingItem / ChartConfig / AIInsight). overview plan adds KPICard / MetricResult javap. | foundation + overview |
| **R3** | BigDecimal precision: Java `setScale(2)` vs default; Python Decimal needs matching `quantize` per field | Medium-High | overview/rankings plan tasks: read Java per-field setScale calls, mirror in Python. | overview, rankings |
| **R4** | AI insight Chinese message strings built via Java `String.format()` + business rules; strict byte match requires 1:1 string template port | High | overview plan task: line-by-line read Java SalesAnalysisServiceImpl insight generators, extract every template + threshold. | overview spec |
| **R5** | F001 data shape: F001 golden 1708 lines comes from **Gold path** (`GoldDashboardBuilder.buildFromGoldWithCharts`), NOT legacy `getSalesOverview`. F001's `smart_bi_sales_data` has **0 rows in 2025 query window** (verified via golden inspection: salespersonRanking=[], productRanking=[], customerRanking=[], trendChart.data=[], all empty due to legacy SQL filter `order_date BETWEEN`). Only `overview` field has data (4 KPIs from Gold path Silver/Gold projection). | High | (a) Overview spec uses Gold-vs-legacy env switch (`SMARTBI_GOLD_READ_PRIMARY_ENABLED`) — when on, Python returns Gold-shape; when off, legacy. (b) Rankings + trend specs recommend **Option C calibration goldens** (precedent commit `f84101d53`): seed synthetic `smart_bi_sales_data` rows in test env so legacy SQL non-empty path actually runs + byte-tests. (c) Without seed, F001 byte test only validates empty path through legacy route. | foundation + overview + rankings |
| **R6** | 4 chats may concurrently edit `analysis_sales.py` → file overwrite | High | Strategy: sequential execution (foundation → overview → rankings → trend). If parallel needed, use sub-worktrees per concurrent-edit-safety rule 2. Always `git commit -- analysis_sales.py` (rule 5b). | all chats |
| **R7** | Foundation freezes dict factory shapes; if sibling spec finds Java has more fields → must update foundation factory + re-record F999 golden | Low | Task #1 javap freezes shape upfront. Sibling specs must escalate if shape change needed (rare). | foundation + sibling escalation |
| **R8** | `_query_sales_data` extension adds order_date column → may inadvertently break alerts/recommendations | Low-Medium | Re-run `test_alerts_logic.py`, `test_alerts_contract.py`, `test_recommendations_contract.py` after change. | foundation plan |
| **R9** | F999/F001 goldens have key order from Java HashMap iteration (Jackson serialization), not Java `result.put()` order. Python must construct dict in observed order | Medium | Foundation locks composite key order to F999 observed: `overview/customerRanking/productRanking/dateRange/salespersonRanking/generatedAt/trendChart`. | foundation impl |
| **R10** | period / generatedAt / lastUpdated in DashboardResponse have subtle nulls in F999 (`generatedAt: null`, `lastUpdated: <ts>`) — possibly Java behavior bug | Low | overview plan task: read Java to confirm intentional vs bug. Python mirrors observed (do not fix Java). | overview spec |
| **R11** | **Gold path discovery** — overview agent confirmed F001 golden's `overview` field comes from `GoldDashboardBuilder.buildFromGoldWithCharts`, a SEPARATE Java code path from legacy `getSalesOverview`. F001 KPI cards are restaurant-flavored (`total_revenue / bill_count / avg_bill_value / store_count`), implying F001 is a restaurant tenant whose Gold projection is fed by POS data, not factory `smart_bi_sales_data`. The 1261 LOC `SalesAnalysisServiceImpl` is essentially **dead code path on F001**. | High | overview spec §2 already encodes Gold-vs-legacy branch decision via env var `SMARTBI_GOLD_READ_PRIMARY_ENABLED`. Foundation does NOT need to port Gold client (overview punts to `_build_from_gold_with_charts` helper, defers Java port to plan task if needed). F999 (cleared smart_bi data, also cleared Gold projection) routes to `buildEmptyDashboard` short-circuit. **Strategy: fall through to legacy stub if Gold not available — F999 contract test still PASS via stub.** | overview spec (architectural decision); foundation acknowledges dependency |
| **R12** | **F001 byte-shape match completeness** — given R5 + R11, F001 byte test as currently shaped only validates: (a) Gold-path overview output (overview spec must port Gold client OR F001 golden re-recorded with Gold disabled to force legacy), (b) all top-level rankings/trend keys = `[]` (foundation stub already matches). Without synthetic data seeding, no test validates non-empty rankings/trend path. | Medium | Plan tasks per spec: (a) overview decides Gold port scope (full / mocked / disabled); (b) rankings + trend specs propose Option C calibration goldens with synthetic rows. **Hard limit**: foundation does NOT alter test env data — F001 schema/data changes are sibling-spec scope, with explicit approval gate before seeding. | overview + rankings + trend |

## §9. Open questions (TBD until impl)

These are intentionally deferred to plan tasks:

1. **DTO field enumeration** (R2): javap each Java DTO class to confirm full @Data getter list. ⚠ marked fields above. RankingItem already confirmed via direct file read (6 fields, no derived getters); KPICard / MetricResult deferred to overview spec; ChartConfig / AIInsight deferred to foundation plan task #1.
2. **DateRange granularity auto-promotion**: F999 shows `granularity: "YEAR"` for 365-day custom range → Java must have logic. Confirm in DateRange.java.
3. **DashboardResponse.lastUpdated vs generatedAt in non-empty data case**: F999 has lastUpdated=ts but generatedAt=null. Is this a Java bug or intentional fallback? Determined during overview impl.
4. **ChartConfig optional fields**: F999 only shows 7 keys; ChartConfig.java 68 LOC + `@Deprecated` (per trend spec) may have more fields. Confirm via javap.
5. **AIInsight optional fields**: F999 shows 5 keys; AIInsight.java 46 LOC may have more.
6. **Composite generatedAt format**: Java `LocalDateTime.now()` → Jackson serializes as ISO with nanos (`2026-04-30T06:34:34.172252663`). Python must match format (use `datetime.now().isoformat()` or fixed precision).
7. **Gold path port strategy** (R11): overview spec proposes env-var gated branch. Decision needed before overview chat: (a) port Java `GoldDashboardBuilder` + `GoldFinanceClient` to Python; (b) re-record F001 golden with Gold disabled (forces legacy); (c) write `_build_from_gold_with_charts` Python stub that returns hardcoded golden-shape for tests, real impl deferred. Default: (b) for simplicity unless overview chat finds Gold projection is actually used in prod.
8. **F001 calibration goldens** (R5 + R12): rankings + trend specs each recommend seeding synthetic `smart_bi_sales_data` rows in F001 test env so legacy non-empty path is exercised. Foundation does NOT seed; sibling specs propose with explicit user approval gate. Precedent: commit `f84101d53` "bonus F999 calibration goldens".

## §10. Plan structure preview (foundation plan)

The foundation plan (separate file `docs/superpowers/plans/2026-04-30-phase2a-analysis-sales-foundation.md`) will have phases:

- **Phase A** (~2-3 tasks): Pre-impl exploration
  - Task A.1: javap 4 DTOs, freeze dict factory field lists
  - Task A.2: Confirm F001 data in test env (psql query)
  - Task A.3: Verify DateRange Python class has days/valid getters

- **Phase B** (~4-6 tasks): Code creation
  - Task B.1: Extend `_query_sales_data` SQL with `order_date` column
  - Task B.2: Re-run alerts/recommendations tests, confirm 0 regression
  - Task B.3: Create `analysis_sales.py` with route + composite + 5 stubs + 4 dict factories
  - Task B.4: Add `_strip_volatile` helper (shared utility)
  - Task B.5: Register router in `main.py` (or smartbi_compat/__init__.py)

- **Phase C** (~3-4 tasks): Test creation
  - Task C.1: Create `test_analysis_sales_contract.py` with TestEnvelope class
  - Task C.2: Run F999 contract test, debug any byte-shape mismatch
  - Task C.3: Add goldens recording script
  - Task C.4: Document sibling-spec extension points

- **Phase D** (~2 tasks): Verification
  - Task D.1: Run full pytest suite (74+ tests pass)
  - Task D.2: Deploy to test env (10011), verify route responds

Total: ~12-16 tasks, ~3-4h work for foundation chat.

## §11. Acceptance criteria

Foundation merge is complete when:

- [x] `analysis_sales.py` exists with route + composite + 5 stubs + 4 dict factories
- [x] `test_analysis_sales_contract.py` exists with TestEnvelope class
- [x] `test_F999_empty_state_byte_shape` PASSES
- [x] All 4 dict factories have field shapes confirmed by javap
- [x] `_query_sales_data` extends with `order_date`; alerts/recommendations tests still pass
- [x] DateRange Python class has `days` / `valid` getters (or `_new_date_range_dict` factory derives them)
- [x] Sub-service stubs return F999-shape values (do not raise)
- [x] Composite key order matches F999 golden
- [x] Goldens recording script exists
- [x] No changes to `analysis.py` other than `_query_sales_data` SQL extension

Sibling specs (overview / rankings / trend) gate on foundation merge.

## §12. Parallel work analysis

| Dimension | Parallel possible? |
|---|---|
| Writing 4 specs (now) | Yes — foundation written first (defines contract), then overview/rankings/trend specs in 3 parallel subagents |
| Writing foundation plan | No — single document, sequential thinking |
| Executing 4 specs (later chats) | Recommend sequential: foundation → overview → rankings → trend. If parallel needed, sub-worktrees + sub-PRs. |
| Multiple chats editing `analysis_sales.py` | NO — concurrent-edit-safety rule 1+2+5b. Sequential or sub-worktrees only. |

End of foundation spec.
