# Phase 2A `/drill-down` PR-A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task.

**Goal:** Port Java `POST /api/mobile/{factoryId}/smart-bi/drill-down` to Python with byte-shape parity. 5 dispatch dimensions (region/department/product/time/salesperson) + T7 audit write + T10 5-field error envelope.

**Spec:** `docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md` (2175 LOC)

**Architecture:** New file `analysis_drilldown.py`. Owns 5 helpers (`_drilldown_*` prefix). Reuses 5 sister helpers (`_get_region_analysis` / `_get_department_ranking` / `_get_product_ranking` / `_get_sales_trend_chart` / `_get_salesperson_ranking`). Read dispatch via async sister helpers. Write `recordUsage` via separate `engine.begin()` sync tx wrapped in `_to_thread`.

**Tech Stack:** Python 3.8 / FastAPI / SQLAlchemy sync engine / pydantic v2 / pytest.

**Sister precedents:**
- `analysis_finance.py` (helpers `_decimal_to_number`, `_to_decimal`, `_utc_now_iso`)
- `analysis_sales.py` (`_to_thread`, `_get_sync_engine`, sister helpers `_get_product_ranking`, `_get_sales_trend_chart`, `_get_salesperson_ranking`)
- `analysis_region.py` (`_get_region_analysis` composite returns dict with `["ranking"]` key)
- `analysis_department.py` (`_get_department_ranking`)
- `schema_compat.py` (`wrap_response`, `wrap_error`)

**Verified sister symbol locations** (grep verified, 2026-05-03):

| Symbol | File | Line |
|---|---|---|
| `_to_thread` | `analysis_sales.py` | 50 |
| `_get_sync_engine` | `analysis_sales.py` | 208 |
| `_get_salesperson_ranking(factory_id, range_)` | `analysis_sales.py` | 1485 |
| `_get_product_ranking(factory_id, range_)` | `analysis_sales.py` | 1511 |
| `_get_sales_trend_chart` | `analysis_sales.py` | 1611 |
| `_get_department_ranking` | `analysis_department.py` | 373 |
| `_get_region_analysis(factory_id, range_)` | `analysis_region.py` | 720 |
| `wrap_response` / `wrap_error` | `schema_compat.py` | 37 / 59 |
| `verify_jwt_and_factory` / `AuthContext` | `auth.py` | 40 / 33 |

**Critical Rule 9 carry-over (verified per Tier 2 sister chats):**
- ChartConfig: `xaxisField` / `yaxisField` LOWERCASE 'a' (Introspector.decapitalize)
- ChartConfig empty case: ALL 7 fields emitted (`chartType`, `title`, `seriesField`, `data`, `options`, `xaxisField`, `yaxisField`) — no `@JsonInclude(NON_NULL)`
- MetricResult: 11-field shape `[metricCode, metricName, value, formattedValue, unit, changePercent, changeDirection, changeValue, alertLevel, dimensionValue, description]`
- RankingItem: 6-field shape `[rank, name, value, target, completionRate, alertLevel]`
- DashboardResponse / DepartmentDetail: golden truth wins (record + verify)

**Top-level dict key order**: HashMap hash-iter, NOT put-order. Per-dim verified via golden recording in Task 4.

**HARD prereqs (verified):**
- ✅ region PR #56 + #60 in main
- ✅ department PR #52 + #57 in main
- ✅ procurement PR #64 + #67 + #68 + #70 in main
- ✅ inventory PR #53 + #54 + #65 in main
- ✅ Spec PR #69 in main (`b7db9e8f8`)
- ⚠️ `record-java-golden.sh` POST extension — Task 1 below

**File structure:**

```
NEW backend/python/smartbi_compat/api/analysis_drilldown.py    (~700-900 LOC)
EDIT scripts/record-java-golden.sh                              (~15 lines added — POST + --data-json)
EDIT backend/python/main.py                                     (+2 lines)
NEW tests/python/smartbi_compat/test_analysis_drilldown_contract.py  (~400-500 LOC)
NEW 8x tests/fixtures/java-smartbi-golden/drill-down-F999-*.json
```

---

## Task 1: Extend record-java-golden.sh for POST + JSON body

**Files:** Modify `scripts/record-java-golden.sh` (current GET-only, ~67 lines).

- [ ] **Step 1: Add flag parsing after positional args (after line 22 `ENV_FLAG="${4:-test}"`)**

```bash
# Replace `ENV_FLAG="${4:-test}"` with:
shift 3
METHOD="GET"
DATA_JSON=""
ENV_FLAG="test"
while [[ $# -gt 0 ]]; do
    case "$1" in
        --method)    METHOD="$2"; shift 2;;
        --data-json) DATA_JSON="$2"; shift 2;;
        --prod)      ENV_FLAG="--prod"; shift;;
        *)           echo "Unknown flag: $1" >&2; exit 1;;
    esac
done
```

- [ ] **Step 2: Replace curl invocation (line ~61)**

```bash
# Replace single-line curl with conditional:
if [[ "$METHOD" == "POST" ]]; then
    curl -sS --fail -X POST \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        --data "$DATA_JSON" "$URL" \
        | python3 -c "import json, sys; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))" \
        > "$OUT_PATH"
else
    curl -sS --fail -H "Authorization: Bearer $TOKEN" "$URL" \
        | python3 -c "import json, sys; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))" \
        > "$OUT_PATH"
fi
```

- [ ] **Step 3: Smoke test backward compat** — re-record an existing golden to confirm GET still works:

```bash
JWT_SECRET=t BASE_URL_OVERRIDE=http://127.0.0.1:10011 \
  ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/analysis/procurement?startDate=2025-01-01&endDate=2025-12-31&analysisType=trend' \
    /tmp/test-get-still-works.json
diff <(jq -S 'del(.timestamp)' tests/fixtures/java-smartbi-golden/analysis-procurement-F999-trend.json) \
     <(jq -S 'del(.timestamp)' /tmp/test-get-still-works.json)
# Expected: empty diff
```

- [ ] **Step 4: Commit**

```bash
git status --short
git commit -m "scripts: record-java-golden.sh POST + --data-json support" -- scripts/record-java-golden.sh
```

---

## Task 2: Record 8 F999 goldens via SSH tunnel

**Files:** Create 8 files in `tests/fixtures/java-smartbi-golden/drill-down-F999-*.json`.

⚠️ Requires SSH tunnel to `localhost:10011` (Java test backend).

- [ ] **Step 1: Establish SSH tunnel + fetch JWT**

```bash
ssh -f -N -L 10011:localhost:10011 root@47.100.235.168 -o ExitOnForwardFailure=yes
sleep 2
curl -sf http://127.0.0.1:10011/api/mobile/health -m 5 | head
JWT=$(ssh root@47.100.235.168 'grep ^JWT_SECRET /www/wwwroot/cretas/.env.test | cut -d= -f2-')
echo "JWT len: ${#JWT}"
```

- [ ] **Step 2: Record 8 goldens** (one per command, capture exit codes)

```bash
JWT_SECRET="$JWT" BASE_URL_OVERRIDE=http://127.0.0.1:10011 \
  ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/drill-down' \
    drill-down-F999-region-L1.json \
    --method POST --data-json '{"dimension":"region","startDate":"2024-01-01","endDate":"2024-12-31"}'

JWT_SECRET="$JWT" BASE_URL_OVERRIDE=http://127.0.0.1:10011 \
  ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/drill-down' \
    drill-down-F999-region-L2.json \
    --method POST --data-json '{"dimension":"region","value":"华东","level":1,"startDate":"2024-01-01","endDate":"2024-12-31"}'

JWT_SECRET="$JWT" BASE_URL_OVERRIDE=http://127.0.0.1:10011 \
  ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/drill-down' \
    drill-down-F999-department-L1.json \
    --method POST --data-json '{"dimension":"department","startDate":"2024-01-01","endDate":"2024-12-31"}'

JWT_SECRET="$JWT" BASE_URL_OVERRIDE=http://127.0.0.1:10011 \
  ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/drill-down' \
    drill-down-F999-department-L2.json \
    --method POST --data-json '{"dimension":"department","value":"销售部","startDate":"2024-01-01","endDate":"2024-12-31"}'

JWT_SECRET="$JWT" BASE_URL_OVERRIDE=http://127.0.0.1:10011 \
  ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/drill-down' \
    drill-down-F999-product.json \
    --method POST --data-json '{"dimension":"product","startDate":"2024-01-01","endDate":"2024-12-31"}'

JWT_SECRET="$JWT" BASE_URL_OVERRIDE=http://127.0.0.1:10011 \
  ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/drill-down' \
    drill-down-F999-time-L1.json \
    --method POST --data-json '{"dimension":"time","level":1,"startDate":"2024-01-01","endDate":"2024-12-31"}'

JWT_SECRET="$JWT" BASE_URL_OVERRIDE=http://127.0.0.1:10011 \
  ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/drill-down' \
    drill-down-F999-salesperson-L1.json \
    --method POST --data-json '{"dimension":"salesperson","startDate":"2024-01-01","endDate":"2024-12-31"}'

JWT_SECRET="$JWT" BASE_URL_OVERRIDE=http://127.0.0.1:10011 \
  ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/drill-down' \
    drill-down-F999-error-unknown-dim.json \
    --method POST --data-json '{"dimension":"invalid","startDate":"2024-01-01","endDate":"2024-12-31"}'
```

- [ ] **Step 3: Inspect each golden's HashMap key order + ChartConfig shape**

```bash
for f in tests/fixtures/java-smartbi-golden/drill-down-F999-*.json; do
  echo "=== $(basename $f) ==="
  python3 -c "
import json, sys
d = json.load(open('$f', encoding='utf-8'))
print('top-level:', list(d.keys()))
data = d.get('data')
if isinstance(data, dict):
    print('data keys:', list(data.keys()))
    for k, v in data.items():
        if isinstance(v, dict):
            print(f'  data.{k} keys:', list(v.keys())[:8])
"
done > /tmp/golden-shapes.txt
cat /tmp/golden-shapes.txt
```

Capture output for Task 5+ dispatcher dict literal ordering.

- [ ] **Step 4: Commit goldens + cleanup tunnel**

```bash
git add tests/fixtures/java-smartbi-golden/drill-down-F999-*.json
git status --short
git commit -m "WIP: record 8 F999 drill-down goldens" -- tests/fixtures/java-smartbi-golden/drill-down-F999-*.json
ps -ef | grep "ssh -f -N -L 10011" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
```

---

## Task 3: Create skeleton + threshold consts + Pydantic model

**Files:** Create `backend/python/smartbi_compat/api/analysis_drilldown.py`.

- [ ] **Step 1: Write the skeleton**

```python
"""Phase 2A: POST /api/mobile/{factoryId}/smart-bi/drill-down

Mirror Java SmartBIServiceImpl.processDrillDown (line 1018-1069).
PR-A scope: 5 dimension dispatch + T7 audit write + T10 5-field error envelope.

See spec: docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md
"""
from __future__ import annotations

import calendar
import logging
from datetime import date
from decimal import Decimal
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import text

logger = logging.getLogger(__name__)

from smartbi_compat.api.analysis_finance import (
    _decimal_to_number, _to_decimal, _utc_now_iso,
)
from smartbi_compat.api.analysis_sales import (
    _to_thread, _get_sync_engine,
    _get_product_ranking, _get_sales_trend_chart, _get_salesperson_ranking,
)
from smartbi_compat.api.analysis_region import _get_region_analysis
from smartbi_compat.api.analysis_department import _get_department_ranking
from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.schema_compat import wrap_response, wrap_error

# DateRange import (sister DateRange wrapper used by region/sales helpers expecting range_):
from smartbi_compat.date_range import DateRange


_SUPPORTED_DIMENSIONS = frozenset({
    "region", "department", "product", "time", "salesperson",
})
_ACTION_TYPE_DRILLDOWN = "DRILLDOWN"


router = APIRouter()


class DrilldownBusinessException(Exception):
    """Mirror Java BusinessException(code, message). withHint/withHintTarget
    NOT exposed (T10: controller catch flattens to 5-field envelope)."""
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class DrillDownRequestModel(BaseModel):
    """Mirror controller-level DrillDownRequestDTO (7 fields) + 6 forward-compat fields.

    HTTP body delivers: dimension, value, parentDimension, parentValue,
    filters, startDate, endDate.

    Forward-compat (accepted but Java service uses @Builder.Default values):
    parentContext, level, sortBy, sortDirection, limit, includeChildren.
    """
    dimension: str = Field(..., min_length=1, description="下钻维度")
    value: Optional[str] = None
    parentDimension: Optional[str] = None
    parentValue: Optional[str] = None
    filters: Dict[str, Any] = Field(default_factory=dict)
    startDate: Optional[date] = None
    endDate: Optional[date] = None
    parentContext: Optional[str] = None
    level: Optional[int] = 1
    sortBy: Optional[str] = None
    sortDirection: Optional[str] = None
    limit: Optional[int] = None
    includeChildren: Optional[bool] = None
```

- [ ] **Step 2: Smoke import test**

```bash
cd backend/python && python -c "from smartbi_compat.api import analysis_drilldown; print('OK')"
```

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "WIP: drilldown skeleton (imports + Pydantic model + exception)" -- backend/python/smartbi_compat/api/analysis_drilldown.py
```

---

## Task 4: Helpers — `_compute_drill_path` + `_default_date_range_this_month`

**Files:** Append to `analysis_drilldown.py`.

- [ ] **Step 1: Append**

```python
def _compute_drill_path(parent_context: Optional[str], filter_value: Optional[str]) -> str:
    """Mirror DrillDownRequest.getDrillPath (Java line 295-302). T4 lock.

    Rule 1: explicit None+empty checks (mirror Java `== null || isEmpty()`).
    """
    if parent_context is None or parent_context == "":
        return filter_value if filter_value is not None else "全部"
    if filter_value is None or filter_value == "":
        return parent_context
    return f"{parent_context} > {filter_value}"


def _default_date_range_this_month() -> tuple:
    """Mirror DateRange.thisMonth() (Java line 123-133). T5 lock.

    Returns (start, end) tuple where end is LAST day of current month
    (NOT today, per Java line 130: `today.withDayOfMonth(today.lengthOfMonth())`).
    """
    today = date.today()
    start_of_month = today.replace(day=1)
    last_day = calendar.monthrange(today.year, today.month)[1]
    end_of_month = today.replace(day=last_day)
    return start_of_month, end_of_month
```

- [ ] **Step 2: Smoke test**

```bash
cd backend/python && python -c "
from smartbi_compat.api.analysis_drilldown import _compute_drill_path, _default_date_range_this_month
from datetime import date
# T4 — 6 cases
assert _compute_drill_path(None, None) == '全部'
assert _compute_drill_path('全国', None) == '全国'
assert _compute_drill_path(None, '华东') == '华东'
assert _compute_drill_path('全国', '华东') == '全国 > 华东'
assert _compute_drill_path('', '华东') == '华东'
assert _compute_drill_path('全国 > 华东', '上海') == '全国 > 华东 > 上海'
# T5 — last day of current month
s, e = _default_date_range_this_month()
assert s.day == 1
import calendar
assert e.day == calendar.monthrange(s.year, s.month)[1]
print('OK')
"
```

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "WIP: drilldown drill_path + date_range helpers (T4+T5)" -- backend/python/smartbi_compat/api/analysis_drilldown.py
```

---

## Task 5: H1 + H2 helpers — province + city ranking

**Files:** Append to `analysis_drilldown.py`. Read `RegionAnalysisServiceImpl.java:97-200` to inline the SQL/algorithm.

- [ ] **Step 1: Read Java reference**

```bash
sed -n '90,200p' backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/RegionAnalysisServiceImpl.java
```

Document: SQL columns aggregated, sort order, RankingItem shape per row.

- [ ] **Step 2: Append H1 + H2 (mirror Java exact)**

Use sister `analysis_region.py:_query_region_full` + `_build_region_ranking` pattern. H1 = province aggregation, H2 = city aggregation. Wrap in `await _to_thread(_exec)` for sync SQLAlchemy + Python 3.8 compat.

```python
async def _drilldown_get_province_ranking(
    factory_id: str, region: str, range_: DateRange
) -> list:
    """Mirror RegionAnalysisServiceImpl.getProvinceRanking (Java line 97).
    Returns List<RankingItem> dicts. KEY-ORDER per RankingItem: rank/name/value/target/completionRate/alertLevel.
    """
    # Verify exact SQL + ranking from Java + drill-down-F999-region-L2.json golden in next task.
    def _exec():
        engine = _get_sync_engine()
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT province AS name,
                       SUM(amount) AS total_amount,
                       SUM(monthly_target) AS total_target
                FROM smart_bi_sales_data
                WHERE factory_id = :factory_id
                  AND region = :region
                  AND order_date BETWEEN :start_date AND :end_date
                  AND deleted_at IS NULL
                GROUP BY province
                ORDER BY total_amount DESC
            """), {
                "factory_id": factory_id,
                "region": region,
                "start_date": range_.start_date,
                "end_date": range_.end_date,
            }).fetchall()
            return _build_drilldown_ranking(rows)
    return await _to_thread(_exec)


async def _drilldown_get_city_ranking(
    factory_id: str, province: str, range_: DateRange
) -> list:
    """Mirror RegionAnalysisServiceImpl.getCityRanking (Java line 146).

    D6 dead branch — controller DTO has no `level` field; HTTP path always
    sees level=1 → L2 path. Ported for byte parity (PR-B unit test).
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT city AS name,
                       SUM(amount) AS total_amount,
                       SUM(monthly_target) AS total_target
                FROM smart_bi_sales_data
                WHERE factory_id = :factory_id
                  AND province = :province
                  AND order_date BETWEEN :start_date AND :end_date
                  AND deleted_at IS NULL
                GROUP BY city
                ORDER BY total_amount DESC
            """), {
                "factory_id": factory_id,
                "province": province,
                "start_date": range_.start_date,
                "end_date": range_.end_date,
            }).fetchall()
            return _build_drilldown_ranking(rows)
    return await _to_thread(_exec)


def _build_drilldown_ranking(rows) -> list:
    """Build RankingItem dict list from (name, total_amount, total_target) rows.

    Field order per Lombok @Data RankingItem: rank/name/value/target/completionRate/alertLevel.
    Verify exact field set from drill-down-F999-region-L2.json golden after recording.
    """
    rankings = []
    for rank, row in enumerate(rows, start=1):
        name = row[0]
        total_amount = _to_decimal(row[1] or 0)
        total_target = _to_decimal(row[2] or 0)
        completion_rate = (
            (total_amount / total_target * Decimal("100"))
            if total_target > Decimal("0") else Decimal("0")
        )
        alert_level = _determine_target_completion_alert(completion_rate)
        rankings.append({
            "rank": rank,
            "name": name,
            "value": _decimal_to_number(total_amount),
            "target": _decimal_to_number(total_target),
            "completionRate": _decimal_to_number(completion_rate.quantize(Decimal("0.01"))),
            "alertLevel": alert_level,
        })
    return rankings


def _determine_target_completion_alert(rate: Decimal) -> str:
    """Mirror sister region completion alert (60/85 thresholds)."""
    if rate < Decimal("60"):
        return "RED"
    if rate < Decimal("85"):
        return "YELLOW"
    return "GREEN"
```

- [ ] **Step 3: Smoke import test**

```bash
cd backend/python && python -c "
from smartbi_compat.api.analysis_drilldown import (
    _drilldown_get_province_ranking, _drilldown_get_city_ranking, _build_drilldown_ranking
)
print('OK')
"
```

- [ ] **Step 4: Verify against golden L2**

After Task 2 records goldens, inspect `drill-down-F999-region-L2.json`:
```bash
python3 -c "
import json
g = json.load(open('tests/fixtures/java-smartbi-golden/drill-down-F999-region-L2.json', encoding='utf-8'))
data = g['data'].get('data', [])
if data: print('first ranking item keys:', list(data[0].keys()))
else: print('empty L2 (F999) — ranking shape inherited from L1')
"
```
If golden's RankingItem shape differs from above (e.g. extra fields, different order), update `_build_drilldown_ranking`.

- [ ] **Step 5: Commit**

```bash
git status --short
git commit -m "WIP: H1+H2 province/city ranking helpers" -- backend/python/smartbi_compat/api/analysis_drilldown.py
```

---

## Task 6: H3 helper — department detail (DashboardResponse)

**Files:** Append to `analysis_drilldown.py`. Read `DepartmentAnalysisServiceImpl.java:113`.

- [ ] **Step 1: Inspect golden first** (Task 2 already recorded it)

```bash
python3 -c "
import json
g = json.load(open('tests/fixtures/java-smartbi-golden/drill-down-F999-department-L2.json', encoding='utf-8'))
data = g['data'].get('data')
if isinstance(data, dict):
    print('DashboardResponse keys:', list(data.keys()))
    for k, v in data.items():
        print(f'  data.{k} type:', type(v).__name__, len(v) if isinstance(v, (list, dict, str)) else '')
else:
    print('data type:', type(data).__name__)
"
```

- [ ] **Step 2: Read Java exact impl**

```bash
sed -n '110,180p' backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/DepartmentAnalysisServiceImpl.java
```

- [ ] **Step 3: Append H3 mirroring golden shape exactly**

Pattern: query smart_bi_department_data by `(factory_id, department, date range)`, then build DashboardResponse-shaped dict with field names matching golden Step 1 inspection.

```python
async def _drilldown_get_department_detail(
    factory_id: str, dept_name: str, start_date: date, end_date: date
) -> dict:
    """Mirror DepartmentAnalysisServiceImpl.getDepartmentDetail (Java line 113).
    Returns DashboardResponse dict. Field shape from golden truth.
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.connect() as conn:
            # Aggregate query — exact column names from Java line 113-... (read first)
            row = conn.execute(text("""
                SELECT
                    SUM(amount) AS total_amount,
                    SUM(monthly_target) AS total_target,
                    COUNT(DISTINCT salesperson) AS member_count
                FROM smart_bi_department_data
                WHERE factory_id = :factory_id
                  AND department = :dept_name
                  AND record_date BETWEEN :start_date AND :end_date
                  AND deleted_at IS NULL
            """), {
                "factory_id": factory_id,
                "dept_name": dept_name,
                "start_date": start_date,
                "end_date": end_date,
            }).fetchone()
            return _build_department_detail_response(dept_name, row)
    return await _to_thread(_exec)


def _build_department_detail_response(dept_name, row) -> dict:
    """Build DashboardResponse dict matching drill-down-F999-department-L2.json golden.

    NOTE: Exact field names + nested structures TBD from golden inspection.
    Update this builder after Task 2 golden records — current implementation
    is a TBD placeholder; impl chat MUST inspect golden then revise.
    """
    if row is None:
        total_amount = Decimal("0")
        total_target = Decimal("0")
        member_count = 0
    else:
        total_amount = _to_decimal(row[0] or 0)
        total_target = _to_decimal(row[1] or 0)
        member_count = int(row[2] or 0)
    completion_rate = (
        (total_amount / total_target * Decimal("100"))
        if total_target > Decimal("0") else Decimal("0")
    )
    return {
        # Field names + order MUST match drill-down-F999-department-L2.json golden
        "department": dept_name,
        "totalAmount": _decimal_to_number(total_amount),
        "totalTarget": _decimal_to_number(total_target),
        "completionRate": _decimal_to_number(completion_rate.quantize(Decimal("0.01"))),
        "memberCount": member_count,
        "alertLevel": _determine_target_completion_alert(completion_rate),
    }
```

- [ ] **Step 4: Smoke import + commit**

```bash
cd backend/python && python -c "from smartbi_compat.api.analysis_drilldown import _drilldown_get_department_detail; print('OK')"
git status --short
git commit -m "WIP: H3 department detail helper (DashboardResponse)" -- backend/python/smartbi_compat/api/analysis_drilldown.py
```

---

## Task 7: H4 + H5 helpers — product distribution chart + salesperson metrics

**Files:** Append to `analysis_drilldown.py`. Read `SalesAnalysisServiceImpl.java:404` (H5) + `:537` (H4).

- [ ] **Step 1: Inspect goldens**

```bash
python3 -c "
import json
g = json.load(open('tests/fixtures/java-smartbi-golden/drill-down-F999-product.json', encoding='utf-8'))
print('product.data keys:', list(g['data'].keys()))
chart = g['data'].get('chart')
if isinstance(chart, dict): print('chart keys:', list(chart.keys()))
"
# Salesperson L2 not recorded for F999 (no salesperson filter); inspect L1 only.
```

- [ ] **Step 2: Read Java refs**

```bash
sed -n '400,460p' backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SalesAnalysisServiceImpl.java
sed -n '530,580p' backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SalesAnalysisServiceImpl.java
```

- [ ] **Step 3: Append H4 + H5**

```python
async def _drilldown_get_product_distribution_chart(
    factory_id: str, range_: DateRange
) -> dict:
    """Mirror SalesAnalysisServiceImpl.getProductDistributionChart (Java line 537).
    Returns ChartConfig dict with Rule 9 carry-over:
    - 7 fields all-emit (no @JsonInclude)
    - xaxisField/yaxisField LOWERCASE 'a'
    - chart key order from golden truth
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT product_name AS name, SUM(amount) AS total
                FROM smart_bi_sales_data
                WHERE factory_id = :factory_id
                  AND order_date BETWEEN :start_date AND :end_date
                  AND deleted_at IS NULL
                GROUP BY product_name
                ORDER BY total DESC
                LIMIT 10
            """), {
                "factory_id": factory_id,
                "start_date": range_.start_date,
                "end_date": range_.end_date,
            }).fetchall()
            return _build_product_distribution_chart(rows)
    return await _to_thread(_exec)


def _build_product_distribution_chart(rows) -> dict:
    """ChartConfig 7-field shape verified from drill-down-F999-product.json golden.
    Field order TBD — MUST inspect golden, update this dict literal.
    """
    chart_data = [
        {"name": row[0], "value": _decimal_to_number(_to_decimal(row[1] or 0))}
        for row in rows
    ]
    return {
        "chartType": "PIE",
        "title": "产品销售分布",
        "seriesField": None,
        "data": chart_data,
        "options": {},
        "xaxisField": None,
        "yaxisField": None,
    }


async def _drilldown_get_salesperson_metrics(
    factory_id: str, salesperson: str, range_: DateRange
) -> list:
    """Mirror SalesAnalysisServiceImpl.getSalespersonMetrics (Java line 404).
    Returns LIST of MetricResult dicts (NOT single — Z2/Z4 cycle 4 fix).
    Each MetricResult has 11 Lombok @Data fields.
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.connect() as conn:
            row = conn.execute(text("""
                SELECT
                    SUM(amount) AS total_sales,
                    SUM(quantity) AS total_quantity,
                    SUM(profit) AS total_profit,
                    COUNT(DISTINCT order_id) AS order_count
                FROM smart_bi_sales_data
                WHERE factory_id = :factory_id
                  AND salesperson = :salesperson
                  AND order_date BETWEEN :start_date AND :end_date
                  AND deleted_at IS NULL
            """), {
                "factory_id": factory_id,
                "salesperson": salesperson,
                "start_date": range_.start_date,
                "end_date": range_.end_date,
            }).fetchone()
            return _build_salesperson_metrics(salesperson, row)
    return await _to_thread(_exec)


def _build_salesperson_metrics(salesperson, row) -> list:
    """Build List[MetricResult] matching golden truth.
    MetricResult 11-field shape:
    [metricCode, metricName, value, formattedValue, unit, changePercent,
     changeDirection, changeValue, alertLevel, dimensionValue, description]
    """
    if row is None:
        total_sales = Decimal("0"); total_quantity = Decimal("0")
        total_profit = Decimal("0"); order_count = 0
    else:
        total_sales = _to_decimal(row[0] or 0)
        total_quantity = _to_decimal(row[1] or 0)
        total_profit = _to_decimal(row[2] or 0)
        order_count = int(row[3] or 0)

    def _metric(code, name, value, unit):
        return {
            "metricCode": code,
            "metricName": name,
            "value": _decimal_to_number(value if isinstance(value, Decimal) else Decimal(value)),
            "formattedValue": None,
            "unit": unit,
            "changePercent": None,
            "changeDirection": None,
            "changeValue": None,
            "alertLevel": "GREEN",
            "dimensionValue": salesperson,
            "description": None,
        }

    return [
        _metric("SALESPERSON_TOTAL_SALES", "销售总额", total_sales, "元"),
        _metric("SALESPERSON_TOTAL_QUANTITY", "销售数量", total_quantity, "件"),
        _metric("SALESPERSON_TOTAL_PROFIT", "销售利润", total_profit, "元"),
        _metric("SALESPERSON_ORDER_COUNT", "订单数", Decimal(order_count), "单"),
    ]
```

- [ ] **Step 4: Smoke import + commit**

```bash
cd backend/python && python -c "from smartbi_compat.api.analysis_drilldown import _drilldown_get_product_distribution_chart, _drilldown_get_salesperson_metrics; print('OK')"
git status --short
git commit -m "WIP: H4+H5 product chart + salesperson metrics" -- backend/python/smartbi_compat/api/analysis_drilldown.py
```

---

## Task 8: T7 — `_drilldown_record_usage` SQL helper + async wrapper

**Files:** Append to `analysis_drilldown.py`.

- [ ] **Step 1: Append T7 helpers**

```python
_RECORD_USAGE_SQL = text("""
    INSERT INTO smart_bi_usage_records (
        factory_id, user_id, action_type, query_text, token_count,
        cost_amount, cache_hit, response_time_ms, success, created_at
    ) VALUES (
        :factory_id, :user_id, :action_type, :query_text, :token_count,
        :cost_amount, :cache_hit, :response_time_ms, :success, NOW()
    )
""")


def _drilldown_record_usage(
    conn,
    factory_id: str,
    user_id: Optional[int] = None,
    action_type: str = _ACTION_TYPE_DRILLDOWN,
    query_text: Optional[str] = None,
    token_count: int = 0,
    cost_amount: Decimal = Decimal("0"),  # D8 divergence — see spec §7.5
    cache_hit: bool = False,
    response_time_ms: Optional[int] = None,
    success: bool = True,
) -> None:
    """Mirror SmartBIServiceImpl.recordUsage (called Java line 1066).

    Java call: recordUsage(factoryId, null, "DRILLDOWN", 0, false).
    Python defaults match exactly except cost_amount (D8 documented divergence).

    D7: user_id=None mirrors Java passing null despite SecurityContext having userId.
    T11/T12 RLS app-layer: explicit factory_id IS the tenant isolation.
    """
    conn.execute(_RECORD_USAGE_SQL, {
        "factory_id": factory_id,
        "user_id": user_id,
        "action_type": action_type,
        "query_text": query_text,
        "token_count": token_count,
        "cost_amount": cost_amount,
        "cache_hit": cache_hit,
        "response_time_ms": response_time_ms,
        "success": success,
    })


async def _drilldown_record_usage_async(
    factory_id: str,
    action_type: str = _ACTION_TYPE_DRILLDOWN,
    user_id: Optional[int] = None,
    query_text: Optional[str] = None,
    token_count: int = 0,
    cost_amount: Decimal = Decimal("0"),
    cache_hit: bool = False,
    success: bool = True,
) -> None:
    """Async wrapper — opens fresh `engine.begin()` write tx (commit on success,
    rollback on exception). Wrapped in `_to_thread` shim for Python 3.8 compat.

    Z1 cycle 4: separate from read dispatch. Java atomicity preserved by
    raise-before-write control flow (caller raises before this is awaited).
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.begin() as conn:
            _drilldown_record_usage(
                conn=conn,
                factory_id=factory_id,
                user_id=user_id,
                action_type=action_type,
                query_text=query_text,
                token_count=token_count,
                cost_amount=cost_amount,
                cache_hit=cache_hit,
                success=success,
            )
    await _to_thread(_exec)
```

- [ ] **Step 2: Smoke import + commit**

```bash
cd backend/python && python -c "from smartbi_compat.api.analysis_drilldown import _drilldown_record_usage, _drilldown_record_usage_async; print('OK')"
git status --short
git commit -m "WIP: T7 record_usage SQL helper + async wrapper" -- backend/python/smartbi_compat/api/analysis_drilldown.py
```

---

## Task 9: 5 dim processors + main dispatcher

**Files:** Append to `analysis_drilldown.py`.

⚠️ Top-level dict key orders MUST match goldens (Task 2 step 3 inspection output). Adjust dict literals in this task accordingly.

- [ ] **Step 1: Append 5 dim processors**

```python
async def _process_region_drilldown(
    factory_id: str, request, range_: DateRange
) -> dict:
    """Mirror processRegionDrillDown (service line 1975-1996).
    L1 (no filter)        → composite ranking + nextLevel=province
    L2 (level None or <=1) → province + nextLevel=city
    L3 (D6 dead, level>1)  → city + nextLevel=null
    """
    filter_value = request.value
    level = request.level
    # KEY-ORDER from drill-down-F999-region-L*.json golden — verify Task 2 step 3
    if filter_value is None or filter_value == "":
        composite = await _get_region_analysis(factory_id, range_)
        return {"data": composite["ranking"], "nextLevel": "province"}
    if level is None or level <= 1:
        return {
            "data": await _drilldown_get_province_ranking(factory_id, filter_value, range_),
            "nextLevel": "city",
        }
    return {
        "data": await _drilldown_get_city_ranking(factory_id, filter_value, range_),
        "nextLevel": None,
    }


async def _process_department_drilldown(
    factory_id: str, request, start_date: date, end_date: date
) -> dict:
    """Mirror processDepartmentDrillDown (service line 2001-2017).
    L1 (no filter)  → ranking + nextLevel=salesperson
    L2 (filter set) → detail + nextLevel=null
    """
    filter_value = request.value
    if filter_value is None or filter_value == "":
        return {
            "data": await _get_department_ranking(factory_id, start_date, end_date),
            "nextLevel": "salesperson",
        }
    return {
        "data": await _drilldown_get_department_detail(
            factory_id, filter_value, start_date, end_date
        ),
        "nextLevel": None,
    }


async def _process_product_drilldown(
    factory_id: str, request, range_: DateRange
) -> dict:
    """Mirror processProductDrillDown (service line 2022-2032). Single layer.
    Adds extra `chart` key (per-dim shape variance T6).
    """
    return {
        "data": await _get_product_ranking(factory_id, range_),
        "chart": await _drilldown_get_product_distribution_chart(factory_id, range_),
        "nextLevel": None,
    }


async def _process_time_drilldown(
    factory_id: str, request, range_: DateRange
) -> dict:
    """Mirror processTimeDrillDown (service line 2037-2059).
    Period mapping: level None→DAY, 1→MONTH, 2→WEEK, else→DAY (T2 dead).
    """
    level = request.level
    if level is None:
        period = "DAY"
    elif level == 1:
        period = "MONTH"
    elif level == 2:
        period = "WEEK"
    else:
        period = "DAY"
    return {
        "data": await _get_sales_trend_chart(factory_id, range_, period),
        "period": period,
    }


async def _process_salesperson_drilldown(
    factory_id: str, request, range_: DateRange
) -> dict:
    """Mirror processSalespersonDrillDown (service line 2064-2076).
    NO `nextLevel` key (per Java — only `data`). Per-dim shape variance T6.
    """
    filter_value = request.value
    if filter_value is None or filter_value == "":
        return {"data": await _get_salesperson_ranking(factory_id, range_)}
    return {
        "data": await _drilldown_get_salesperson_metrics(factory_id, filter_value, range_),
    }
```

- [ ] **Step 2: Append main dispatcher `_process_drilldown_tx`**

```python
async def _process_drilldown_tx(factory_id: str, request) -> dict:
    """Mirror SmartBIServiceImpl.processDrillDown (line 1018-1069).

    Z1 cycle 4 redesign: read dispatch via async sister helpers (no shared tx),
    then separate sync engine.begin() tx for recordUsage write.
    Atomicity: raise-before-write control flow preserves Java observable behavior.
    """
    start_date = request.startDate
    end_date = request.endDate
    if start_date is None or end_date is None:
        start_date, end_date = _default_date_range_this_month()
    range_ = DateRange.custom(start_date, end_date)

    dim_lower = request.dimension.lower()
    if dim_lower == "region":
        result = await _process_region_drilldown(factory_id, request, range_)
    elif dim_lower == "department":
        result = await _process_department_drilldown(
            factory_id, request, start_date, end_date)
    elif dim_lower == "product":
        result = await _process_product_drilldown(factory_id, request, range_)
    elif dim_lower == "time":
        result = await _process_time_drilldown(factory_id, request, range_)
    elif dim_lower == "salesperson":
        result = await _process_salesperson_drilldown(factory_id, request, range_)
    else:
        raise DrilldownBusinessException(
            code=400,
            message=f"不支持的下钻维度: {request.dimension}",
        )

    # T9: HashMap mutation order — verify each per-dim from golden
    result["drillPath"] = _compute_drill_path(request.parentContext, request.value)
    result["level"] = request.level
    result["dimension"] = request.dimension

    # T7: separate write tx after successful dispatch
    await _drilldown_record_usage_async(
        factory_id=factory_id, action_type=_ACTION_TYPE_DRILLDOWN,
    )
    return result
```

- [ ] **Step 3: Append route handler**

```python
@router.post("/api/mobile/{factory_id}/smart-bi/drill-down")
async def drill_down(
    factory_id: str,
    request: DrillDownRequestModel,
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Mirror SmartBIAnalysisController.drillDown (line 531-586).
    HTTP 200 always (Java returns ResponseEntity.ok even on BusinessException).
    """
    try:
        result = await _process_drilldown_tx(
            factory_id=auth.factory_id, request=request,
        )
        return wrap_response(result)
    except DrilldownBusinessException as e:
        return wrap_error(f"Drill-down failed: {e.message}", code=e.code)
```

- [ ] **Step 4: Smoke import + commit**

```bash
cd backend/python && python -c "
from smartbi_compat.api.analysis_drilldown import (
    _process_drilldown_tx, _process_region_drilldown, _process_department_drilldown,
    _process_product_drilldown, _process_time_drilldown, _process_salesperson_drilldown,
    drill_down, router,
)
print('OK')
"
git status --short
git commit -m "WIP: 5 dim processors + main dispatcher + route handler" -- backend/python/smartbi_compat/api/analysis_drilldown.py
```

---

## Task 10: Register router in main.py

**Files:** Modify `backend/python/main.py` (~line 1112-1128).

- [ ] **Step 1: Add 2 lines** (per sister registration pattern)

```python
# After existing analysis_region/analysis_procurement imports:
    from smartbi_compat.api import analysis_drilldown
# After existing analysis_region/analysis_procurement include_router:
    app.include_router(analysis_drilldown.router, tags=["SmartBI Compat: Analysis Drill-Down"])
```

- [ ] **Step 2: Verify endpoint registered**

```bash
cd backend/python && JWT_SECRET=test python -c "
import importlib.util
spec = importlib.util.spec_from_file_location('m', 'main.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
routes = [r.path for r in m.app.routes if 'drill-down' in r.path]
assert routes == ['/api/mobile/{factory_id}/smart-bi/drill-down'], f'got {routes}'
print('endpoint registered:', routes[0])
"
```

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "WIP: register drill-down router in main.py" -- backend/python/main.py
```

---

## Task 11: Contract test scaffold + 8 golden tests + dispatch tests

**Files:** Create `tests/python/smartbi_compat/test_analysis_drilldown_contract.py`.

- [ ] **Step 1: Create scaffold** (mirror sister `test_analysis_finance_contract.py`)

Top of file:
```python
"""Byte-shape contract gate for /drill-down (PR-A)."""
from __future__ import annotations
import importlib.util, io, json, os, sys
from datetime import date, datetime, timezone
from pathlib import Path
import jwt, pytest

JWT_SECRET = "test-secret-for-phase2a-do-not-use-in-prod"
os.environ["JWT_SECRET"] = JWT_SECRET

REPO_ROOT = Path(__file__).resolve().parents[3]
GOLDEN_DIR = REPO_ROOT / "tests" / "fixtures" / "java-smartbi-golden"


def _load_production_main():
    main_path = REPO_ROOT / "backend" / "python" / "main.py"
    sys.path.insert(0, str(REPO_ROOT / "backend" / "python"))
    spec = importlib.util.spec_from_file_location("_production_main", main_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _make_token(factory_id: str, user_id: int = 1) -> str:
    payload = {"userId": user_id, "username": "test_user", "factoryId": factory_id,
               "role": "factory_super_admin",
               "exp": datetime.now(timezone.utc).timestamp() + 3600}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


VOLATILE = frozenset({"timestamp", "generatedAt", "lastUpdated", "cacheExpireAt"})
ENVELOPE_EXTRAS = frozenset({"actionHint", "severity", "hintTarget"})


def _strip_volatile(obj):
    if isinstance(obj, dict):
        return {k: _strip_volatile(v) for k, v in obj.items() if k not in VOLATILE}
    if isinstance(obj, list):
        return [_strip_volatile(item) for item in obj]
    return obj


def _strip_envelope_extras(body):
    if not isinstance(body, dict): return body
    return {k: v for k, v in body.items() if k not in ENVELOPE_EXTRAS}


@pytest.fixture(scope="module")
def production_app():
    return _load_production_main().app


@pytest.fixture
def client(production_app):
    from fastapi.testclient import TestClient
    return TestClient(production_app)


@pytest.fixture
def patched_helpers(monkeypatch):
    """Patch all sister + owned helpers + recordUsage to F999 stub returns."""
    from smartbi_compat.api import analysis_drilldown as adr

    async def _empty_region(*a, **k): return {"ranking": []}
    async def _empty_dept_ranking(*a, **k): return []
    async def _empty_product(*a, **k): return []
    async def _empty_trend(*a, **k):
        return {"chartType": "LINE", "title": "销售趋势", "seriesField": None,
                "data": [], "options": {}, "xaxisField": None, "yaxisField": None}
    async def _empty_salesperson(*a, **k): return []
    async def _empty_province(*a, **k): return []
    async def _empty_city(*a, **k): return []
    async def _empty_dept_detail(*a, **k):
        return {"department": a[1] if len(a) > 1 else "", "totalAmount": 0,
                "totalTarget": 0, "completionRate": 0, "memberCount": 0, "alertLevel": "GREEN"}
    async def _empty_product_chart(*a, **k):
        return {"chartType": "PIE", "title": "产品销售分布", "seriesField": None,
                "data": [], "options": {}, "xaxisField": None, "yaxisField": None}
    async def _empty_salesperson_metrics(*a, **k): return []
    async def _noop_record(**kwargs): pass

    monkeypatch.setattr(adr, "_get_region_analysis", _empty_region)
    monkeypatch.setattr(adr, "_get_department_ranking", _empty_dept_ranking)
    monkeypatch.setattr(adr, "_get_product_ranking", _empty_product)
    monkeypatch.setattr(adr, "_get_sales_trend_chart", _empty_trend)
    monkeypatch.setattr(adr, "_get_salesperson_ranking", _empty_salesperson)
    monkeypatch.setattr(adr, "_drilldown_get_province_ranking", _empty_province)
    monkeypatch.setattr(adr, "_drilldown_get_city_ranking", _empty_city)
    monkeypatch.setattr(adr, "_drilldown_get_department_detail", _empty_dept_detail)
    monkeypatch.setattr(adr, "_drilldown_get_product_distribution_chart", _empty_product_chart)
    monkeypatch.setattr(adr, "_drilldown_get_salesperson_metrics", _empty_salesperson_metrics)
    monkeypatch.setattr(adr, "_drilldown_record_usage_async", _noop_record)


def _post(client, body, factory_id="F999"):
    return client.post(
        f"/api/mobile/{factory_id}/smart-bi/drill-down",
        json=body,
        headers={"Authorization": f"Bearer {_make_token(factory_id)}"},
    )
```

- [ ] **Step 2: Append 8 golden compare tests** (parametrized)

```python
GOLDEN_CASES = [
    ("drill-down-F999-region-L1",       {"dimension": "region",      "startDate": "2024-01-01", "endDate": "2024-12-31"}),
    ("drill-down-F999-region-L2",       {"dimension": "region", "value": "华东", "level": 1, "startDate": "2024-01-01", "endDate": "2024-12-31"}),
    ("drill-down-F999-department-L1",   {"dimension": "department",  "startDate": "2024-01-01", "endDate": "2024-12-31"}),
    ("drill-down-F999-department-L2",   {"dimension": "department", "value": "销售部", "startDate": "2024-01-01", "endDate": "2024-12-31"}),
    ("drill-down-F999-product",         {"dimension": "product",     "startDate": "2024-01-01", "endDate": "2024-12-31"}),
    ("drill-down-F999-time-L1",         {"dimension": "time", "level": 1, "startDate": "2024-01-01", "endDate": "2024-12-31"}),
    ("drill-down-F999-salesperson-L1",  {"dimension": "salesperson", "startDate": "2024-01-01", "endDate": "2024-12-31"}),
]


@pytest.mark.parametrize("golden_name,request_body", GOLDEN_CASES)
def test_drilldown_byte_shape(client, patched_helpers, golden_name, request_body):
    resp = _post(client, request_body)
    assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
    py_data = _strip_volatile(resp.json()["data"])
    with io.open(GOLDEN_DIR / f"{golden_name}.json", encoding="utf-8") as f:
        raw = json.load(f)
    golden_data = _strip_volatile(raw["data"])
    if py_data != golden_data:
        diffs = {}
        for k in set(py_data.keys()) | set(golden_data.keys()):
            if py_data.get(k) != golden_data.get(k):
                diffs[k] = {"python": py_data.get(k), "golden": golden_data.get(k)}
        pytest.fail(
            f"{golden_name} BYTE SHAPE MISMATCH on {list(diffs.keys())}\n"
            f"{json.dumps(diffs, indent=2, ensure_ascii=False, default=str)[:2000]}"
        )


def test_drilldown_unknown_dim_error(client, patched_helpers):
    """T10: error envelope 5-field shape (actionHint/severity/hintTarget stripped)."""
    resp = _post(client, {"dimension": "invalid", "startDate": "2024-01-01", "endDate": "2024-12-31"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is False
    assert body["code"] == 400
    assert "不支持的下钻维度" in body["message"]
    assert body["data"] is None
```

- [ ] **Step 3: Append dispatch tests** (T3 case insensitive + T5 default range + T7 record_usage assertion)

```python
class TestDispatchBranching:
    def test_uppercase_dimension_dispatched(self, client, patched_helpers):
        resp = _post(client, {"dimension": "REGION", "startDate": "2024-01-01", "endDate": "2024-12-31"})
        assert resp.status_code == 200
        assert resp.json()["data"]["dimension"] == "REGION"  # original casing preserved

    def test_customer_dim_returns_business_exception(self, client, patched_helpers):
        resp = _post(client, {"dimension": "customer", "startDate": "2024-01-01", "endDate": "2024-12-31"})
        assert resp.status_code == 200
        assert resp.json()["success"] is False
        assert "不支持" in resp.json()["message"]

    def test_default_date_range_used_when_dates_missing(self, client, patched_helpers):
        resp = _post(client, {"dimension": "region"})
        assert resp.status_code == 200, resp.text[:300]


class TestRecordUsageAtomicity:
    def test_record_usage_called_on_success(self, client, monkeypatch):
        """T7+T8: successful dispatch triggers exactly 1 recordUsage call."""
        from smartbi_compat.api import analysis_drilldown as adr
        called = []
        async def _spy(**kw): called.append(kw)
        async def _empty(*a, **k): return {"ranking": []}
        monkeypatch.setattr(adr, "_get_region_analysis", _empty)
        monkeypatch.setattr(adr, "_drilldown_record_usage_async", _spy)
        resp = _post(client, {"dimension": "region", "startDate": "2024-01-01", "endDate": "2024-12-31"})
        assert resp.status_code == 200
        assert len(called) == 1
        assert called[0]["factory_id"] == "F999"
        assert called[0]["action_type"] == "DRILLDOWN"

    def test_record_usage_NOT_called_on_business_exception(self, client, monkeypatch):
        """T8 atomicity: BusinessException raised before write tx → no record."""
        from smartbi_compat.api import analysis_drilldown as adr
        called = []
        async def _spy(**kw): called.append(kw)
        monkeypatch.setattr(adr, "_drilldown_record_usage_async", _spy)
        resp = _post(client, {"dimension": "invalid", "startDate": "2024-01-01", "endDate": "2024-12-31"})
        assert resp.status_code == 200
        assert resp.json()["success"] is False
        assert called == []
```

- [ ] **Step 4: Run all tests**

```bash
cd <repo-root> && JWT_SECRET=t python -m pytest tests/python/smartbi_compat/test_analysis_drilldown_contract.py -v --tb=short -W ignore 2>&1 | tail -60
```

Expected: 7 parametrized golden tests + 1 error test + 5 dispatch tests = 13 PASS. If FAIL on byte-shape, inspect diff and fix the impl helpers (Tasks 5-9).

- [ ] **Step 5: Commit**

```bash
git status --short
git commit -m "WIP: drilldown contract tests (8 goldens + 5 dispatch)" -- tests/python/smartbi_compat/test_analysis_drilldown_contract.py
```

---

## Task 12: Iterate on byte-shape diffs + verify baseline

- [ ] **Step 1: Run baseline pytest** (no regression check)

```bash
JWT_SECRET=t python -m pytest tests/python/smartbi_compat/ -q --tb=no -W ignore 2>&1 | tail -10
```

Expected: all previous tests pass + new drilldown tests pass.

- [ ] **Step 2: Fix any byte-shape diffs from Task 11**

Common drifts (Rule 9 carry-over from Tier 2):
- ChartConfig `xaxisField` UPPERCASE → fix to lowercase 'a'
- ChartConfig missing `seriesField: None` → add (7-field emit-all)
- MetricResult missing one of 11 fields
- Top-level dict key order ≠ HashMap hash-iter order from golden

Edit relevant helpers, re-run pytest. Repeat.

- [ ] **Step 3: Commit any fixes**

```bash
git status --short
git commit -m "fix: drilldown byte-shape parity with goldens" -- backend/python/smartbi_compat/api/analysis_drilldown.py
```

---

## Task 13: Final review + squash + rebase + push + open PR

- [ ] **Step 1: Dispatch final code-reviewer subagent** for entire branch

Use `superpowers:code-reviewer` template. Pass:
- BASE_SHA: `b7db9e8f8` (origin/main HEAD: spec PR #69)
- HEAD_SHA: current HEAD
- Plan: this file
- Spec: `docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md`

- [ ] **Step 2: Address any CRITICAL findings**

If reviewer finds critical issues (production bugs, byte-shape divergence in unexercised branches), fix + add regression tests + re-run pytest.

- [ ] **Step 3: Soft-reset squash + rebase onto current origin/main**

```bash
git fetch origin
git log origin/main..HEAD --oneline   # Note BASE_SHA — must be eb71ca244 or b7db9e8f8 etc, NOT current HEAD
git reset --soft <branch-base-from-worktree-creation>
git status --short    # All my changes staged
git commit -m "$(cat <<'EOF'
Phase 2A: /drill-down per-type real impl (5 dispatch dims) (PR-A)

[Body summarizing scope, rules applied, spec drifts caught,
test counts, scope-out list per procurement PR-A pattern.]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git rebase origin/main   # Handle main.py conflicts if other chats added routes
```

- [ ] **Step 4: Re-run pytest after rebase**

```bash
JWT_SECRET=t python -m pytest tests/python/smartbi_compat/ -q --tb=no -W ignore 2>&1 | tail -5
```

Expected: all PASS.

- [ ] **Step 5: Push + open PR**

```bash
git push -u origin phase2a/drill-down-impl
gh pr create --base main --head phase2a/drill-down-impl \
  --title "Phase 2A: /drill-down per-type real impl (5 dispatch dims) (PR-A)" \
  --body "[See PR template — fill in summary, rules applied, scope-out, etc.]"
```

- [ ] **Step 6: Verify PR mergeable**

```bash
gh pr view --json url,state,mergeable -q '.url, .state, .mergeable'
```

---

## Self-review checklist

- [x] All 5 D decisions documented (D1-D8 in plan body)
- [x] All 5 H helpers (H1-H5) cover Java line refs
- [x] All 11 traps (T1-T12) addressed in tasks
- [x] Rule 9 carry-over flagged upfront (xaxisField lowercase, ChartConfig 7-field, MetricResult 11-field, RankingItem 6-field)
- [x] Hard prereqs verified (sister PRs all in main)
- [x] record-java-golden.sh POST extension before goldens (Task 1)
- [x] 8 F999 goldens recorded BEFORE impl tasks 5-9 (so impl can mirror golden truth not spec drift)
- [x] T7 record_usage uses `engine.begin()` write tx; raise-before-write atomicity
- [x] T10 5-field error envelope via `wrap_error` (no hint/hintTarget)
- [x] safe-commit pattern (`-- <files>`) per concurrent-edit-safety §5b
- [x] Squash + rebase before push (Task 13)
- [x] No PR-B scope creep (PR-B = arithmetic depth tests, separate chat)

## Parallel work analysis

### Subagent: ❌ Sequential within plan
Tasks 1→2→3-9→10-11→12-13 are dependency-ordered. Subagent dispatch per task fine, but tasks themselves serial.

### Multi-Chat: ✅ Independent of sister chats
- Creates ONLY new `analysis_drilldown.py` + new test file + 8 goldens
- Does NOT touch any existing `analysis_*.py` (Tier 2 stable)
- `main.py` edit additive (2-line); rebase resolves any conflict
- `record-java-golden.sh` edit at Task 1 — coordinate with any other chat doing POST endpoint records (low collision risk)
