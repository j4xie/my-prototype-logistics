# Q4 + Q5 Restaurant-Tenant `/analysis/production` + `/analysis/quality` Implementation Spec

**Status**: ⛔ DRAFT — Implementation design only. Code authoring HOLD per MO PR #249 §⛔ pre-flight (T6.5 Phase C close + active-E2E gate). This spec converts the decision ratification (PR #330 / `2026-05-12-t6-6-restaurant-semantics-decision.md`) into actionable Python module shape for the Sub-A / Sub-B impl chats.
**Spec date**: 2026-05-11
**Author**: q4-q5 restaurant-analysis impl-spec dispatch
**Branch**: `ops-q4-q5-restaurant-analysis-impl`
**Worktree**: `.worktrees/q4-q5-restaurant-analysis`
**Base SHA**: `83cb8996fa80578961c8b6206d68ec0200a5522a`
**Audience**: Sub-A (`/analysis/production` Python port impl) + Sub-B (`/analysis/quality` Python port impl) when T6.6 Phase B gate clears; reviewers running per-PR audit cycles
**Trigger**: task #60 + #64 ratified Option B (餐饮重定义); Q-DEC-6 = F1 + Q-DEC-8 = Option A verbal sign-off recorded in PR #330 (commit `68465a6fed`)

---

## 0. TL;DR

PR #330 ratifies the **semantic decisions** (what restaurant Production + Quality endpoints return). This spec ratifies the **module shape** (what Python files / functions / DB queries Sub-A and Sub-B should write).

| Item | This spec |
|---|---|
| Q4 endpoint | `GET /api/mobile/{factoryId}/smart-bi/analysis/production` |
| Q5 endpoint | `GET /api/mobile/{factoryId}/smart-bi/analysis/quality` |
| Endpoint shape | Single URL per endpoint, tenant-typed response envelope (per Q-DEC-8 = Option A, PR #330 §3.1) |
| Factory branch | Mirror Java `ProductionAnalysisServiceImpl` / `QualityAnalysisServiceImpl` mock (DEFERRED — out of Q4/Q5 scope; tracked by sister specs `2026-05-09-t6-6-production-port-detail.md` + `2026-05-09-t6-6-quality-port-detail.md`) |
| Restaurant branch | NEW Python code paths consuming `fact_pos_transaction` / `fact_pos_item` / `fact_restaurant_wastage` / `fact_restaurant_requisition` / `restaurant_reviews` |
| Tenant detection | `factories.type ∈ {RESTAURANT, BRANCH}` → restaurant branch; else factory branch (mirror Java `SmartBIServiceImpl.java:434-435` predicate) |
| New Python modules | `backend/python/smartbi_compat/api/analysis_production.py` + `analysis_quality.py` |
| Tenant detector helper | `backend/python/smartbi_compat/tenant.py` (new shared module) |
| Q-DEC-6 ETL extension | `V20260815_04__t6_6_etl_return_qty_columns.sql` (out of this spec; tracked by ETL infra spec PR #316 + Q-DEC-6 sign-off) |
| Effort estimate | Spec doc only this PR. Sub-A impl ~5-6pd. Sub-B impl ~9pd including Q-DEC-6 F1 ETL extension. See PR #330 §1.4 + §2.4. |

⛔ **HOLD blocks** (per dispatch + PR #330 §8 + MO PR #249 §⛔):
- Spec only. No Python module creation, no DB queries against `smartbi_db` / `smartbi_prod_db`, no migrations, no deploy.
- Sub-A / Sub-B impl HOLD until MO PR #249 §⛔ pre-flight gates clear (T6.5 Phase C close + active-E2E gate, ETA ~2026-08-15 per MO filename).
- STOP-and-ping organizer BEFORE pushing this spec per HARD `feedback_pause_before_deploy_or_push.md`.
- No Java side changes — `ProductionAnalysisServiceImpl` + `QualityAnalysisServiceImpl` stay KEEP forever (Dashboard composite caller binds these per PR #178 KEEP list).

---

## 1. Background

### 1.1 Decision provenance

- **PR #223** (Q1 real-DB amendment) flagged Q4 + Q5 PENDING in §8.
- **PR #298** (Phase B pre-flight audit) §6.1 recommended writing this implementation spec.
- **PR #316** (ETL infra design) §4 defines strict ETL boundary — this spec respects it, adds only Q-DEC-6 F1 as adjacent ~2.5pd extension to Sub-ETL-1c (if Steve approves at impl time).
- **PR #330** (decision ratification) ratifies:
  - Q4 = Option B 餐饮重定义 (kitchen station utilization / prep time / table turnover)
  - Q5 = Option B 餐饮重定义 (food safety incident rate / complaint rate / dish return rate / wastage rate)
  - Q-DEC-6 = F1 (extend `fact_pos_item` with `return_qty` + `return_amount`)
  - Q-DEC-8 = Option A (single endpoint per URL, tenant-typed envelope)

This spec is the operational sibling of PR #330 — same decision, lower-level "how to write the Python code" depth.

### 1.2 Why a separate impl spec

PR #330 is intentionally decision-centric (Q-DEC-1 through Q-DEC-10 with rationale). It does not specify:

- Tenant-detection helper module location (`smartbi_compat/tenant.py` vs inline)
- Per-metric Python query SQL (only conceptual formulas in §1.3 / §2.3)
- Module-level docstring conventions for the new `analysis_production.py` / `analysis_quality.py`
- Test fixture file naming (`tests/fixtures/java-smartbi-golden/analysis-production-{factory_type}-{factory_id}-{analysisType}.json`)
- Router registration in `backend/python/main.py`
- Rule 8 / 9 / 11 / 12 audit checklist tied to each metric envelope key

This spec provides those mechanical Sub-A / Sub-B inputs so impl chats can execute without re-reading the full PR #330 + Q1 amendment chain.

---

## 2. Tenant Detection Logic

### 2.1 Java reference (verified `SmartBIServiceImpl.java:434-435`)

```java
&& (f.getType() == com.cretas.aims.entity.enums.FactoryType.RESTAURANT
    || f.getType() == com.cretas.aims.entity.enums.FactoryType.BRANCH))
```

Restaurant tenants = `FactoryType ∈ {RESTAURANT, BRANCH}`. Factory tenants = everything else (`FACTORY` default, plus `HEADQUARTERS`, `CENTRAL_KITCHEN`).

Note: `HEADQUARTERS` and `CENTRAL_KITCHEN` are treated as **factory-branch** for Production + Quality semantics per Java precedent. Sub-A / Sub-B do NOT need separate `HEADQUARTERS` semantics for these endpoints.

### 2.2 Python tenant detector

New file `backend/python/smartbi_compat/tenant.py`:

```python
"""Tenant-type detection for restaurant vs factory semantic branching.

Mirrors Java SmartBIServiceImpl.java:434-435 predicate. Used by Phase B
T6.6 /analysis/production + /analysis/quality endpoints (Q4 + Q5 Option B
per PR #330) and any future polymorphic endpoint that varies output shape
by tenant type.

Source of truth: cretas_db.factories.type (PostgreSQL enum-as-VARCHAR).
"""
from __future__ import annotations

from enum import Enum
from typing import Optional


class TenantType(str, Enum):
    """Mirror Java FactoryType enum.

    Note: HEADQUARTERS + CENTRAL_KITCHEN treat as factory for Q4/Q5 per
    Java precedent (no restaurant semantics expected at HQ / central
    kitchen level).
    """
    FACTORY = "FACTORY"
    RESTAURANT = "RESTAURANT"
    HEADQUARTERS = "HEADQUARTERS"
    BRANCH = "BRANCH"
    CENTRAL_KITCHEN = "CENTRAL_KITCHEN"

    @property
    def is_restaurant_tenant(self) -> bool:
        """RESTAURANT or BRANCH → restaurant semantics."""
        return self in (TenantType.RESTAURANT, TenantType.BRANCH)

    @classmethod
    def from_db_value(cls, value: Optional[str]) -> "TenantType":
        """Parse cretas_db.factories.type VARCHAR column.

        Defaults to FACTORY for None / unknown values (Java
        Factory.java:55 default).
        """
        if not value:
            return cls.FACTORY
        try:
            return cls(value.upper())
        except ValueError:
            return cls.FACTORY


async def get_tenant_type(factory_id: str, conn) -> TenantType:
    """Query cretas_db.factories to determine tenant type.

    Args:
        factory_id: External factory_id (e.g. "F001", "R_ILTEATRO_REAL").
        conn: asyncpg connection bound to cretas_db (NOT smartbi_db).

    Returns:
        TenantType. Defaults to FACTORY if factory_id not found
        (graceful degradation — caller's middleware should already have
        validated factory_id).
    """
    row = await conn.fetchrow(
        "SELECT type FROM factories WHERE factory_id = $1",
        factory_id,
    )
    if row is None:
        return TenantType.FACTORY
    return TenantType.from_db_value(row["type"])
```

**Connection pool choice**: `cretas_db` (NOT `smartbi_db`) — `factories` table lives in main app DB. Sub-A / Sub-B must consume the existing cretas_db asyncpg pool (the same one used by `analysis_finance.py` for `smart_bi_*` table reads). Verify connection-pool config when implementing.

**Caching**: 1-minute TTL cache on factory_id → TenantType (optional; mirrors Java SmartBIService internal caching). Defer to Sub-A impl decision; spec recommends 60s TTL via `cachetools.TTLCache`.

---

## 3. Q4 — `/analysis/production` Implementation Shape

### 3.1 New Python module: `analysis_production.py`

Path: `backend/python/smartbi_compat/api/analysis_production.py`

Header docstring template:

```python
"""Phase 2B T6.6 /analysis/production endpoint port.

Implements 4-branch controller dispatcher (analysisType param) with
tenant-typed response envelope (Option A per Q-DEC-8, PR #330 §3.1).

Java reference:
- Controller: SmartBIAnalysisController.getProductionAnalysis line 80-115
- Service (factory branch only — mock): ProductionAnalysisServiceImpl
  (KEEP forever per PR #178; this Python port adds restaurant branch
  per Q-DEC-Q4 = Option B redefine).

Q4 restaurant semantics (PR #330 §1):
- M1: 厨房工位利用率 → DEFAULT null + dataAvailability marker (Q-DEC-1 = A1)
- M2: 备菜时间 → DEFAULT null + dataAvailability marker (Q-DEC-2 = B1)
- M3: 翻台率 → DEFAULT proxy bills_per_store_per_day (Q-DEC-3 = C1)

Tenant detection: smartbi_compat.tenant.TenantType.is_restaurant_tenant.

Spec: docs/superpowers/specs/2026-05-11-q4-q5-restaurant-analysis-impl-spec.md
Decision: docs/superpowers/specs/2026-05-12-t6-6-restaurant-semantics-decision.md (PR #330)
"""
```

### 3.2 Router signature

```python
router = APIRouter()

@router.get("/api/mobile/{factory_id}/smart-bi/analysis/production")
async def get_production_analysis(
    factory_id: str,
    startDate: date = Query(...),
    endDate: date = Query(...),
    analysisType: Optional[str] = Query(None, description="oee/efficiency/equipment, omit for overview"),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Mirror Java controller line 80-115 dispatch + tenant branch.

    Restaurant tenant: emit 3-metric envelope per PR #330 §1.2.
    Factory tenant: mirror Java mock generator (Sub-A out-of-scope —
    deferred to T6.6 main Phase B dispatch).
    """
```

### 3.3 4-branch dispatch (matches Java)

```python
tenant = await get_tenant_type(factory_id, cretas_conn)

if tenant.is_restaurant_tenant:
    return await _restaurant_production_dispatch(
        factory_id, startDate, endDate, analysisType
    )
else:
    return await _factory_production_dispatch(  # deferred per §3.6
        factory_id, startDate, endDate, analysisType
    )
```

Inside `_restaurant_production_dispatch`:

```python
result: dict[str, Any] = {
    "startDate": startDate.isoformat(),
    "endDate":   endDate.isoformat(),
    "tenantType": "RESTAURANT",
}

if analysisType == "oee":
    # Map factory OEE branch → restaurant 3-metric. No trendChart for restaurant
    # (Q-DEC-1 + Q-DEC-2 emit null → trend irrelevant).
    result["metrics"] = await _get_restaurant_production_metrics(...)
elif analysisType == "efficiency":
    result["metrics"] = await _get_restaurant_production_metrics(...)
    result["ranking"] = []  # restaurant tenants don't have production-line ranking
elif analysisType == "equipment":
    # Restaurant has no equipment concept; emit empty per PR #330 §1.2 omitted M4
    result["metrics"] = []
    result["ranking"] = []
    result["downtimeChart"] = None
else:
    # Default overview
    result["overview"] = await _get_restaurant_production_overview(
        factory_id, startDate, endDate
    )

return wrap_response(result)
```

### 3.4 Restaurant production metric computation

```python
async def _get_restaurant_production_metrics(
    factory_id: str, start_date: date, end_date: date, conn
) -> list[dict]:
    """3-metric envelope per PR #330 §1.2.

    Returns list of 3 metrics in canonical order:
      [M1 KITCHEN_STATION_UTILIZATION, M2 AVG_PREP_TIME, M3 TABLE_TURNOVER_RATE]
    """
    # M1: emit null per Q-DEC-1 = A1
    m1 = {
        "metricCode": "KITCHEN_STATION_UTILIZATION",
        "value": None,
        "unit": "%",
        "trend": None,
        "alertLevel": None,
        "dataAvailability": "MISSING_KITCHEN_STATION_DATA",
    }

    # M2: emit null per Q-DEC-2 = B1
    m2 = {
        "metricCode": "AVG_PREP_TIME",
        "value": None,
        "unit": "minutes",
        "trend": None,
        "alertLevel": None,
        "dataAvailability": "MISSING_ORDER_TIMESTAMP_SPLIT",
    }

    # M3: proxy bills_per_store_per_day per Q-DEC-3 = C1
    m3 = await _compute_table_turnover_proxy(factory_id, start_date, end_date, conn)

    return [m1, m2, m3]
```

### 3.5 M3 proxy query (PR #330 §1.3 C1)

```python
async def _compute_table_turnover_proxy(
    factory_id: str, start_date: date, end_date: date, conn
) -> dict:
    """bills_per_store_per_day proxy (PR #330 §1.3 C1, Q-DEC-3 default).

    Computes: COUNT(DISTINCT transaction_id) / store_count / operating_day_count.
    True M3 (table_turnover_rate) requires dim_store.table_count which is
    not yet populated for 14 chains — see Q-DEC-3 = C1.
    """
    row = await conn.fetchrow(
        '''
        SELECT
            COUNT(*) AS bill_count,
            COUNT(DISTINCT store_id) AS store_count,
            COUNT(DISTINCT date) AS day_count
        FROM fact_pos_transaction
        WHERE factory_id = $1
          AND date BETWEEN $2 AND $3
        ''',
        factory_id, start_date, end_date,
    )
    if (row is None
            or not row["bill_count"]
            or not row["store_count"]
            or not row["day_count"]):
        # No data → emit null with same marker
        return {
            "metricCode": "TABLE_TURNOVER_RATE",
            "value": None,
            "unit": "turns_per_day",
            "trend": None,
            "alertLevel": None,
            "dataAvailability": "PROXY_AS_BILLS_PER_STORE",
            "proxyMetric": {
                "metricCode": "BILLS_PER_STORE_PER_DAY",
                "value": None,
                "unit": "bills_per_store_per_day",
                "trend": None,
                "alertLevel": None,
            },
        }

    proxy_value = Decimal(row["bill_count"]) / (
        Decimal(row["store_count"]) * Decimal(row["day_count"])
    )
    # Rule 10: intermediate quantize at scale 4, then Rule 12 HALF_UP at scale 2
    proxy_q4 = proxy_value.quantize(Decimal("0.0001"), ROUND_HALF_UP)
    proxy_q2 = proxy_q4.quantize(Decimal("0.01"), ROUND_HALF_UP)

    return {
        "metricCode": "TABLE_TURNOVER_RATE",
        "value": None,
        "unit": "turns_per_day",
        "trend": None,
        "alertLevel": None,
        "dataAvailability": "PROXY_AS_BILLS_PER_STORE",
        "proxyMetric": {
            "metricCode": "BILLS_PER_STORE_PER_DAY",
            "value": _decimal_to_number(proxy_q2),
            "unit": "bills_per_store_per_day",
            "trend": None,         # trend computation requires prior period — defer to Phase 2D
            "alertLevel": None,    # threshold semantics undefined for proxy
        },
    }
```

**Note on null-handling**: Rule 1 of `python-java-port.md` — use `is not None` not Python `or` for None checks. The `if not row[...] or not row[...]` pattern above is OK because all 3 values are COUNT() results (never None, only 0). Sub-A may simplify to `row["bill_count"] == 0` for clarity.

### 3.6 Factory branch (deferred)

Sub-A factory branch ports the Java mock per `2026-05-09-t6-6-production-port-detail.md` (Chat M's detail spec). This spec does NOT redefine that work — it only adds the restaurant branch atop the existing factory port plan.

If the Java mock has not yet been ported by Sub-A by the time this restaurant branch lands, Sub-A's PR sequence should be:

1. PR-A.1: Factory branch mirror of Java mock (per Chat M detail spec).
2. PR-A.2: Restaurant branch addition (this spec §3.3-§3.5).

If the Java mock IS already ported, this restaurant branch is purely additive — Sub-A patches a `_restaurant_production_dispatch` branch into the existing `analysis_production.py`.

---

## 4. Q5 — `/analysis/quality` Implementation Shape

### 4.1 New Python module: `analysis_quality.py`

Path: `backend/python/smartbi_compat/api/analysis_quality.py`

Same header docstring style as §3.1. Reference Java `QualityAnalysisServiceImpl` for factory branch and PR #330 §2 for restaurant semantics.

### 4.2 4-branch dispatch (matches Java)

Java endpoints: `fpy` / `defect` / `rework` / default-overview (controller line 119-152).

Restaurant branch maps these to a 4-metric envelope per PR #330 §2.2:

```python
result: dict[str, Any] = {
    "startDate": startDate.isoformat(),
    "endDate":   endDate.isoformat(),
    "tenantType": "RESTAURANT",
}

if analysisType == "fpy":
    # Factory FPY → restaurant complaint rate (N2)
    result["metrics"] = await _get_restaurant_quality_metrics(...)
elif analysisType == "defect":
    # Factory defect ranking → restaurant return rate ranking (N3 product-grain)
    result["ranking"] = await _get_restaurant_return_rate_ranking(...)
    result["paretoChart"] = None  # restaurant doesn't have defect Pareto semantic
elif analysisType == "rework":
    # Factory rework cost → restaurant wastage (N4)
    result["metrics"] = await _get_restaurant_quality_metrics(...)
    result["costChart"] = None  # defer wastage distribution chart to Phase 2D
else:
    # Default overview
    result["overview"] = await _get_restaurant_quality_overview(...)

return wrap_response(result)
```

### 4.3 4-metric computation

```python
async def _get_restaurant_quality_metrics(
    factory_id: str, start_date: date, end_date: date, conn_smartbi, conn_cretas
) -> list[dict]:
    """4-metric envelope per PR #330 §2.2.

    Returns list in canonical order:
      [N1 FOOD_SAFETY_INCIDENT_RATE,
       N2 COMPLAINT_RATE,
       N3 DISH_RETURN_RATE,
       N4 WASTAGE_RATE]
    """
    n1 = _build_food_safety_incident_metric()    # always null per Q-DEC-4 = D1
    n2 = await _build_complaint_rate_metric(factory_id, start_date, end_date, conn_smartbi)
    n3 = await _build_return_rate_metric(factory_id, start_date, end_date, conn_smartbi)
    n4 = await _build_wastage_rate_metric(factory_id, start_date, end_date, conn_smartbi)
    return [n1, n2, n3, n4]
```

### 4.4 N1 — food safety incident rate (always null, Q-DEC-4 = D1)

```python
def _build_food_safety_incident_metric() -> dict:
    """Q-DEC-4 = D1: emit null with marker (no incident table)."""
    return {
        "metricCode": "FOOD_SAFETY_INCIDENT_RATE",
        "value": None,
        "unit": "incidents_per_period",
        "trend": None,
        "alertLevel": None,
        "dataAvailability": "MISSING_FOOD_SAFETY_INCIDENT_LOG",
    }
```

### 4.5 N2 — complaint rate (rating-based per chain, Q-DEC-5 = E1)

```python
async def _build_complaint_rate_metric(
    factory_id: str, start_date: date, end_date: date, conn
) -> dict:
    """Q-DEC-5 = E1: rating-based threshold for chains with restaurant_reviews;
    null with NO_REVIEW_DATA_FOR_CHAIN marker for the 13 chains without
    review data (only 青花椒 currently has reviews per PR #330 §2.3 N2).
    """
    row = await conn.fetchrow(
        '''
        SELECT
            COUNT(*) AS total_reviews,
            SUM(CASE WHEN rating < 3.0 THEN 1 ELSE 0 END) AS complaint_count
        FROM restaurant_reviews
        WHERE factory_id = $1
          AND review_time::date BETWEEN $2 AND $3
        ''',
        factory_id, start_date, end_date,
    )

    if row is None or not row["total_reviews"]:
        return {
            "metricCode": "COMPLAINT_RATE",
            "value": None,
            "unit": "%",
            "trend": None,
            "alertLevel": None,
            "dataAvailability": "NO_REVIEW_DATA_FOR_CHAIN",
        }

    # Rule 10: divide → multiply chain
    complaint_count = Decimal(row["complaint_count"] or 0)
    total = Decimal(row["total_reviews"])
    intermediate = (complaint_count / total).quantize(
        Decimal("0.0001"), ROUND_HALF_UP
    )
    rate_pct = (intermediate * Decimal("100")).quantize(
        Decimal("0.01"), ROUND_HALF_UP
    )

    return {
        "metricCode": "COMPLAINT_RATE",
        "value": _decimal_to_number(rate_pct),
        "unit": "%",
        "trend": None,             # prior-period trend deferred to Phase 2D
        "alertLevel": None,        # threshold spec undefined; defer
    }
```

### 4.6 N3 — return rate (Q-DEC-6 = F1 dependency)

```python
async def _build_return_rate_metric(
    factory_id: str, start_date: date, end_date: date, conn
) -> dict:
    """Q-DEC-6 = F1: query fact_pos_item.return_qty + return_amount.

    REQUIRES migration V20260815_04 (Q-DEC-6 ETL extension). If
    return_qty column does not exist, this query 500s. Sub-B must
    GATE on column existence via migration tracker check, OR fall
    back to RETURN_QTY_NOT_INGESTED marker (Q-DEC-6 = F3).
    """
    row = await conn.fetchrow(
        '''
        SELECT
            COALESCE(SUM(qty), 0) AS total_sales_qty,
            COALESCE(SUM(return_qty), 0) AS total_return_qty
        FROM fact_pos_item fpi
        INNER JOIN fact_pos_transaction fpt
            ON fpi.transaction_id = fpt.id
        WHERE fpi.factory_id = $1
          AND fpt.date BETWEEN $2 AND $3
        ''',
        factory_id, start_date, end_date,
    )

    if row is None or not row["total_sales_qty"]:
        return {
            "metricCode": "DISH_RETURN_RATE",
            "value": None,
            "unit": "%",
            "trend": None,
            "alertLevel": None,
            "dataAvailability": "NO_POS_DATA_FOR_PERIOD",
        }

    return_qty = Decimal(row["total_return_qty"])
    sales_qty = Decimal(row["total_sales_qty"])
    intermediate = (return_qty / sales_qty).quantize(
        Decimal("0.0001"), ROUND_HALF_UP
    )
    rate_pct = (intermediate * Decimal("100")).quantize(
        Decimal("0.01"), ROUND_HALF_UP
    )

    return {
        "metricCode": "DISH_RETURN_RATE",
        "value": _decimal_to_number(rate_pct),
        "unit": "%",
        "trend": None,
        "alertLevel": None,
    }
```

**Q-DEC-6 ETL extension prerequisite**: This metric requires `fact_pos_item.return_qty` + `return_amount` columns. Migration `V20260815_04__t6_6_etl_return_qty_columns.sql` (~10 LOC) per PR #330 §5.2:

```sql
ALTER TABLE fact_pos_item
    ADD COLUMN IF NOT EXISTS return_qty NUMERIC(18,3) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS return_amount NUMERIC(18,2) DEFAULT 0;
```

Plus Sub-ETL-1c canonical CSV mapping: `销售数量` → `qty`, `退货数量` → `return_qty`, `销售金额` → `amount`, `实退金额` → `return_amount`. This is **out of this spec's scope** — it lives in the PR #316 ETL infra spec extension. If migration not yet applied at Sub-B impl time, fall back to Q-DEC-6 = F3 (null + `RETURN_QTY_NOT_INGESTED` marker) for the 14 chains.

### 4.7 N4 — wastage rate (per-chain conditional, Q-DEC-7 = G1)

```python
async def _build_wastage_rate_metric(
    factory_id: str, start_date: date, end_date: date, conn
) -> dict:
    """Q-DEC-7 = G1: compute wastage_rate against fact_restaurant_wastage;
    for chains with 0 rows emit null with WASTAGE_NOT_TRACKED marker.
    """
    row = await conn.fetchrow(
        '''
        SELECT
            (SELECT COALESCE(SUM(estimated_cost), 0)
               FROM fact_restaurant_wastage
              WHERE factory_id = $1
                AND date BETWEEN $2 AND $3) AS total_wastage_cost,
            (SELECT COALESCE(SUM(est_cost), 0)
               FROM fact_restaurant_requisition
              WHERE factory_id = $1
                AND date BETWEEN $2 AND $3) AS total_requisition_cost,
            (SELECT COUNT(*)
               FROM fact_restaurant_wastage
              WHERE factory_id = $1
                AND date BETWEEN $2 AND $3) AS wastage_row_count
        ''',
        factory_id, start_date, end_date,
    )

    if (row is None
            or row["wastage_row_count"] == 0
            or not row["total_requisition_cost"]):
        # No wastage data tracked for this chain in this period
        return {
            "metricCode": "WASTAGE_RATE",
            "value": None,
            "unit": "%",
            "trend": None,
            "alertLevel": None,
            "dataAvailability": "WASTAGE_NOT_TRACKED",
        }

    wastage_cost = Decimal(row["total_wastage_cost"])
    requisition_cost = Decimal(row["total_requisition_cost"])
    intermediate = (wastage_cost / requisition_cost).quantize(
        Decimal("0.0001"), ROUND_HALF_UP
    )
    rate_pct = (intermediate * Decimal("100")).quantize(
        Decimal("0.01"), ROUND_HALF_UP
    )

    return {
        "metricCode": "WASTAGE_RATE",
        "value": _decimal_to_number(rate_pct),
        "unit": "%",
        "trend": None,
        "alertLevel": None,
    }
```

### 4.8 N3 ranking (defect mode)

```python
async def _get_restaurant_return_rate_ranking(
    factory_id: str, start_date: date, end_date: date, conn
) -> list[dict]:
    """Per-product return rate ranking (defect-mode replacement).

    Mirrors factory defect-type ranking by ranking products by their
    return_qty / sales_qty ratio descending. TOP 10 cap (matches Java
    factory ranking pattern).

    REQUIRES Q-DEC-6 = F1 migration. Falls back to empty list if column
    not present.
    """
    rows = await conn.fetch(
        '''
        SELECT
            dp.product_id,
            dp.product_name,
            COALESCE(SUM(fpi.qty), 0) AS total_sales_qty,
            COALESCE(SUM(fpi.return_qty), 0) AS total_return_qty
        FROM fact_pos_item fpi
        INNER JOIN fact_pos_transaction fpt
            ON fpi.transaction_id = fpt.id
        INNER JOIN dim_product dp
            ON fpi.product_id = dp.product_id
        WHERE fpi.factory_id = $1
          AND fpt.date BETWEEN $2 AND $3
        GROUP BY dp.product_id, dp.product_name
        HAVING SUM(fpi.qty) > 0
        ORDER BY (SUM(fpi.return_qty)::numeric / NULLIF(SUM(fpi.qty), 0)) DESC NULLS LAST
        LIMIT 10
        ''',
        factory_id, start_date, end_date,
    )

    ranking = []
    for rank_idx, row in enumerate(rows, start=1):
        return_qty = Decimal(row["total_return_qty"])
        sales_qty = Decimal(row["total_sales_qty"])
        if sales_qty == 0:
            continue
        intermediate = (return_qty / sales_qty).quantize(
            Decimal("0.0001"), ROUND_HALF_UP
        )
        rate = (intermediate * Decimal("100")).quantize(
            Decimal("0.01"), ROUND_HALF_UP
        )
        ranking.append({
            "rank": rank_idx,
            "name": row["product_name"],
            "value": _decimal_to_number(rate),
            "unit": "%",
        })
    return ranking
```

---

## 5. Response Envelope Contract

Per PR #330 §3.3 — single endpoint, tenant-typed envelope:

```jsonc
// Restaurant tenant, production /analysis/production?analysisType=oee:
{
  "success": true,
  "data": {
    "startDate": "2026-05-01",
    "endDate":   "2026-05-31",
    "tenantType": "RESTAURANT",
    "metrics": [
      {
        "metricCode": "KITCHEN_STATION_UTILIZATION",
        "value": null,
        "unit": "%",
        "trend": null,
        "alertLevel": null,
        "dataAvailability": "MISSING_KITCHEN_STATION_DATA"
      },
      {
        "metricCode": "AVG_PREP_TIME",
        "value": null,
        "unit": "minutes",
        "trend": null,
        "alertLevel": null,
        "dataAvailability": "MISSING_ORDER_TIMESTAMP_SPLIT"
      },
      {
        "metricCode": "TABLE_TURNOVER_RATE",
        "value": null,
        "unit": "turns_per_day",
        "trend": null,
        "alertLevel": null,
        "dataAvailability": "PROXY_AS_BILLS_PER_STORE",
        "proxyMetric": {
          "metricCode": "BILLS_PER_STORE_PER_DAY",
          "value": 47.3,
          "unit": "bills_per_store_per_day",
          "trend": null,
          "alertLevel": null
        }
      }
    ]
  },
  "message": "ok"
}
```

`dataAvailability` controlled vocabulary per PR #330 §3.4:

| Code | Q-DEC ref | Emit context |
|---|---|---|
| (omit) or "OK" | — | Real data, no caveat |
| `MISSING_KITCHEN_STATION_DATA` | Q-DEC-1 = A1 | M1 |
| `MISSING_ORDER_TIMESTAMP_SPLIT` | Q-DEC-2 = B1 | M2 |
| `PROXY_AS_BILLS_PER_STORE` | Q-DEC-3 = C1 | M3 |
| `MISSING_FOOD_SAFETY_INCIDENT_LOG` | Q-DEC-4 = D1 | N1 |
| `NO_REVIEW_DATA_FOR_CHAIN` | Q-DEC-5 = E1 | N2 (13 of 14 chains) |
| `RETURN_QTY_NOT_INGESTED` | Q-DEC-6 = F3 (fallback) | N3 (pre-migration) |
| `NO_POS_DATA_FOR_PERIOD` | (custom) | N3 (post-migration but zero rows) |
| `WASTAGE_NOT_TRACKED` | Q-DEC-7 = G1 | N4 (14 chains with no wastage rows) |

**Per Q-DEC-9 default**: omit `dataAvailability` field when value is OK (do not emit `"dataAvailability": "OK"`). Frontend treats absence as OK.

---

## 6. Rule 1-12 Audit Checklist (Sub-A / Sub-B)

Per `.claude/rules/python-java-port.md`:

| Rule | Check | Applies to |
|---|---|---|
| Rule 1 | `is not None` not `or` | All None-check fallback paths |
| Rule 2 | calendar year for WEEK | Trend computations (deferred Phase 2D — N/A this PR) |
| Rule 3 | Signature 1:1 mirror | `_compute_*` and `_build_*` use `(factory_id, start_date, end_date)` not `DateRange` |
| Rule 4 | `_decimal_to_number` | M3 proxy value, N2 / N3 / N4 percentages |
| Rule 5 | `SELECT *` in shared helpers | Per-metric SQL is endpoint-specific, NOT shared — narrow `SELECT col1, col2` is OK |
| Rule 6 | Precondition assertions | New SQL helpers raise `ValueError` if `start_date`/`end_date` None |
| Rule 7 | Decimal threshold compare | Restaurant has no thresholds yet (all alertLevel = null this PR) |
| Rule 8 | `Map.of` key order | Java has no `Map.of` for restaurant branch (new Python code); golden recording from F999 still applies for factory branch |
| Rule 9 | Lombok null emit | New restaurant code emits all fields explicitly per envelope contract §5 |
| Rule 10 | divide-then-multiply pattern | M3 proxy, N2 / N3 / N4 percentages |
| Rule 11 | `_java_isoformat` | `startDate` / `endDate` use `date.isoformat()` (LocalDate, no microseconds — Rule 11 not triggered) |
| Rule 12 | `_format_decimal_half_up` | Defer — restaurant metrics don't use String.format in factory mock (no display formatting on Python side; raw numeric only) |

---

## 7. Tests Outline

### 7.1 Unit test files (Sub-A / Sub-B)

- `backend/python/tests/test_analysis_production.py` — factory branch (mock parity) + restaurant branch (Q4 metrics)
- `backend/python/tests/test_analysis_quality.py` — factory branch (mock parity) + restaurant branch (Q5 metrics)
- `backend/python/tests/test_tenant_detector.py` — `TenantType` enum + `get_tenant_type()` against fixture DB

### 7.2 Mock pattern (per `python-java-port.md` test mock reference)

```python
@pytest.fixture
def fake_pos_data():
    async def fake_query(factory_id, start_date, end_date, conn):
        return [{"total_sales_qty": 100, "total_return_qty": 5}]
    return fake_query

async def test_n3_return_rate_basic(monkeypatch, fake_pos_data):
    monkeypatch.setattr(
        "smartbi_compat.api.analysis_quality._build_return_rate_metric",
        fake_pos_data,
    )
    # ... assert metric envelope shape + value = 5.00
```

### 7.3 Golden recording

Per `python-java-port.md` Golden 命名 convention:

- `tests/fixtures/java-smartbi-golden/analysis-production-F999-oee.json` (factory)
- `tests/fixtures/java-smartbi-golden/analysis-production-F001-overview.json` (factory)
- `tests/fixtures/java-smartbi-golden/analysis-production-R_ILTEATRO_REAL-oee.json` (restaurant, NEW)
- `tests/fixtures/java-smartbi-golden/analysis-quality-R_QINGHUAJIAO_REAL-fpy.json` (restaurant N2 has data, NEW)
- `tests/fixtures/java-smartbi-golden/analysis-quality-R_ILTEATRO_REAL-fpy.json` (restaurant N2 null, NEW)

Per PR #330 §6.1 / §6.2 — Sub-A / Sub-B record at least 2 restaurant goldens per endpoint to cover with-data vs without-data branches.

---

## 8. Migration / Rollout Plan

### 8.1 Spec PR (this doc)

- Ship `2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` only.
- No Python module created.
- No DB queries executed.
- Steve sign-off NOT required to merge spec (decision sign-off already in PR #330).

### 8.2 Q-DEC-6 ETL extension (separate PR, gated by Steve)

- Q-DEC-6 = F1 already SIGNED-OFF per PR #330 §9 sign-off table.
- Migration `V20260815_04__t6_6_etl_return_qty_columns.sql` ships via PR #316 ETL infra spec Sub-ETL-1c follow-up.
- Sub-ETL-1c MO extends to include `销售数量` → `qty`, `退货数量` → `return_qty`, `销售金额` → `amount`, `实退金额` → `return_amount` mapping.

### 8.3 Sub-A impl PR (HOLD per MO #249)

- Sequence: Day 0 = tenant detector + factory branch port; Day 1-3 = factory mock mirror per Chat M detail spec; Day 4-5 = restaurant branch per this spec §3.
- Test gate: Phase 2A dict-eq parity on F999 / F001 factory goldens + new F-RESTAURANT-* goldens regression-only.
- Reviewer: 2-3 audit cycles per `feedback_subagent_driven_audit_pattern.md`.

### 8.4 Sub-B impl PR (HOLD per MO #249)

- Sequence: Day 0-5 = factory mock mirror; Day 6-8 = restaurant branch per this spec §4 (incl. Q-DEC-6 = F1 gated by V20260815_04 presence); Day 9 = reviewer audit.
- Test gate: same as Sub-A.

### 8.5 Sub-F nginx routing (post-impl)

- No nginx config changes from this spec — single endpoint per Q-DEC-8.
- 14 real customer factory_ids may need adding to factory_id alternation regex per Q1 §10 default (internal showcase only by default). Out of this spec.

### 8.6 Phase D Java controller body removal

- Same pattern as Phase 2A `/analysis/finance` cutover.
- T+30 days post-cutover, Java `SmartBIAnalysisController.getProductionAnalysis` body + `QualityAnalysisServiceImpl` `getQualitySummary` body get pruned to throw 410.
- `ProductionAnalysisServiceImpl` + `QualityAnalysisServiceImpl` stay (KEEP forever for Dashboard composite).

---

## 9. Open Questions for Steve

All Q-DEC-* from PR #330 §4 still apply. This spec does NOT alter those defaults. **Specific to this impl spec**, no new sign-off needed — it's a pure expansion of PR #330's defaults into code shape.

If Sub-A / Sub-B impl chats hit an ambiguity not covered here, they STOP-and-ping organizer per HARD `feedback_pause_before_deploy_or_push.md` rather than self-resolve.

---

## 10. Cross-references

| Doc | Path | Relation |
|---|---|---|
| Decision ratification | `docs/superpowers/specs/2026-05-12-t6-6-restaurant-semantics-decision.md` (PR #330) | **Authoritative parent** — this spec is mechanical sibling |
| Q1 real-DB amendment | `docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md` (PR #223) | Trigger — §8 Q4 + Q5 |
| Phase B pre-flight audit | `docs/qa-audits/2026-05-11-t6-6-phase-b-pre-flight-blockers.md` (PR #298) | §6.1 recommended writing the impl spec |
| ETL infra design | `docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md` (PR #316) | Q-DEC-6 F1 extension lives in Sub-ETL-1c |
| Phase A design | `docs/superpowers/specs/2026-05-09-t6-6-phase-a-design.md` (PR #196) | Java method inventory |
| Production-port detail (factory branch) | `docs/superpowers/specs/2026-05-09-t6-6-production-port-detail.md` (PR #199) | Chat M factory branch spec |
| Quality-port detail (factory branch) | `docs/superpowers/specs/2026-05-09-t6-6-quality-port-detail.md` (PR #203) | Chat N factory branch spec |
| Phase B execute MO | `docs/superpowers/dispatch/2026-08-15-t6-6-phase-b-execute-marching-order.md` (PR #249) | Sub-A / Sub-B dispatch protocol; HOLD per §⛔ |
| Existing silver dimensions | `backend/python/smartbi/database/migrations/2026_04_28_silver_dimensions.sql` | `dim_store` lacks `table_count` |
| Existing silver facts | `backend/python/smartbi/database/migrations/2026_04_29_silver_facts.sql` | `fact_pos_transaction` + `fact_pos_item` schemas |
| Existing silver restaurant ops | `backend/python/smartbi/database/migrations/2026_04_24_silver_restaurant_ops.sql` | `fact_restaurant_wastage` + `fact_restaurant_requisition` schemas |
| Existing reviews | `backend/python/smartbi/database/migrations/20260408_restaurant_reviews.sql` | `restaurant_reviews` schema (N2 base) |
| Java FactoryType enum | `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/enums/FactoryType.java` | RESTAURANT / BRANCH literal source |
| Java tenant detection | `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SmartBIServiceImpl.java:434-435` | Predicate mirror source |
| Java controller | `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/SmartBIAnalysisController.java:80-152` | Dispatcher mirror source |
| python-java-port Rules 1-12 | `.claude/rules/python-java-port.md` | Applies to Sub-A / Sub-B per §6 |
| Concurrent edit safety | `.claude/rules/concurrent-edit-safety.md` | Rule 5b `git commit -- <paths>` for Sub-A / Sub-B |
| Server operations migration runner | `.claude/rules/server-operations.md` | `apply-smartbi-migrations.sh` for V20260815_04 |

---

## 11. ⛔ HOLD Blocks

- ⛔ **This is an impl-shape spec only.** Zero code edits, zero migrations, zero DDL apply, zero deploys, zero nginx mutations.
- ⛔ **Sub-A / Sub-B impl chats remain HOLD** per MO PR #249 §⛔ pre-flight (T6.5 Phase C close + active-E2E gate).
- ⛔ **Q-DEC-6 = F1 migration (V20260815_04)** is gated by Sub-ETL-1c MO extension per PR #316 boundary, not authorized by this spec.
- ⛔ **No Java side changes.** Java service classes stay KEEP forever (Dashboard composite binds).
- ⛔ **STOP-and-ping organizer** before this spec's PR push per HARD `feedback_pause_before_deploy_or_push.md`.
- ⛔ **No customer-facing nginx routing** for new factory_ids — Q1 §8 Q3 default = internal showcase only.
- ⛔ **Phase 2A dict-eq parity gate**: factory branch dict-eq Java-vs-Python; restaurant branch is Python-vs-Python regression only (no Java equivalent to compare).

---

## 12. Sign-off

- [x] Steve — Q4 + Q5 Option B verbal sign-off 2026-05-11 (recorded in PR #330)
- [x] Steve — Q-DEC-6 = F1 + Q-DEC-8 = Option A verbal sign-off 2026-05-12 (recorded in PR #330)
- [ ] Reviewer audit cycle on this impl spec per `feedback_subagent_driven_audit_pattern.md` — recommend 1-2 cycles
- [ ] Sub-A impl chat ack of §3 module shape when dispatched
- [ ] Sub-B impl chat ack of §4 module shape when dispatched
- [ ] PR #316 ETL infra chat ack Sub-ETL-1c extension scope (Q-DEC-6 = F1 column mapping)
- [ ] Engineering organizer dispatch trigger after MO PR #249 §⛔ gates clear

---

## 13. Predecessor Chain

- PR #178 — T6.5 Phase A retrospective audit (KEEP list); merged
- PR #180 — T6.6 main spec; merged
- PR #196 — T6.6 Phase A design; merged
- PR #199 — production-port detail (factory branch); merged
- PR #203 — quality-port detail (factory branch); merged
- PR #220 — cross-PR consistency audit; merged
- PR #223 — Q1 real-DB sign-off; merged
- PR #249 — T6.6 Phase B execute MO (DRAFT/HOLD); merged
- PR #298 — T6.6 Phase B pre-flight audit; merged
- PR #316 — T6.6 ETL infra design; merged
- PR #326 — Q4 + Q5 decision ratification spec (Option B); merged
- PR #328 — Q-ETL-1/2/3 + Q4/Q5 verbal sign-off ratification; merged
- PR #330 — Q-DEC-6 F1 + Q-DEC-8 Option A + gitignore policy; merged

This spec is the **operational sibling of PR #330**, lowering the decision-spec level into mechanical Python module shape for Sub-A / Sub-B execution post-MO #249 gate clear.

---

**End of Q4 + Q5 Restaurant-Tenant `/analysis/production` + `/analysis/quality` Implementation Spec.**

*Author: q4-q5 restaurant-analysis impl-spec chat (2026-05-11). Worktree: `.worktrees/q4-q5-restaurant-analysis`. Branch: `ops-q4-q5-restaurant-analysis-impl` rooted at `origin/main` HEAD `83cb8996fa`.*
*Triggered by: organizer dispatch — "Q4/Q5 餐饮 tenant production + quality data source impl spec (Option B per PR #330)".*
*Predecessors: PR #330 (decision ratification) + PR #298 (Phase B pre-flight audit recommendation) + PR #316 (ETL infra design strict boundary).*
*Per HARD memories `feedback_pause_before_deploy_or_push.md` + `feedback_dispatch_on_technical_readiness.md`: STOP-and-ping organizer BEFORE push.*
