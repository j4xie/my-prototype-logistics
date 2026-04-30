# Phase 2A `/analysis/finance` Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay foundation for Phase 2A `/analysis/finance` endpoint port — new `analysis_finance.py` module with route + 6-key composite assembly + 4 sub-service stubs + 7 DTO dict factories (含新 `_new_metric_result_dict`) + F999 byte-shape contract gate. Stretch: payable per-type real impl as canonical sample for 4 后续副轨.

**Architecture:** Add dedicated `backend/python/smartbi_compat/api/analysis_finance.py` (parallel to sister's `analysis_sales.py`). Mirror sister's file structure verbatim for shared DTO/helper code. F999 byte-shape contract test gates merge — 4 个 per-type 兄弟副轨 (profit/cost/receivable/budget) 后续替换 stub bodies + 加 per-type 路径。skip Java fireGoldShadowRead async (zero byte impact) + skip smartBIService==null fallback path (accepted divergence per spec §3.3).

**Tech Stack:** Python 3.11 + FastAPI + SQLAlchemy text() + pytest + Lombok-generated Java DTO contracts (javap reference)

**Spec reference:** `docs/superpowers/specs/2026-04-29-phase2a-analysis-finance-foundation-design.md`

**Sister chat reference (sales precedent):** `.worktrees/phase2a-t5-poc/backend/python/smartbi_compat/api/analysis_sales.py` (lines 28-330 for shared DTO/helpers — copy verbatim)

**Sibling chats (DEFERRED):** profit / cost / receivable / budget per-type → `phase2a/t-finance-perX`; 3 sub-endpoints → `phase2a/t-finance-subroutes`; F001 calibration → `phase2a/t-finance-f001-record`

---

## Pre-flight check

Before starting Task A.1, confirm:

```bash
pwd  # Must be: /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance
git rev-parse --abbrev-ref HEAD  # Must be: phase2a/t-finance
git log --oneline -3
git status --short
```

Expected output:
```
/c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance
phase2a/t-finance
a788c1143 spec(phase2a/t-finance): apply code-reviewer findings (C1-C4 + I3 + I5 + m1 + I1)
ff64a7d4b spec(phase2a/t-finance): /analysis/finance foundation + payable per-type 样板 design
3292bd5e5 fix(food-kb): security guard 精化 ...
(no output — clean)
```

If any check fails, STOP and reconcile before proceeding.

**Worktree paths used throughout this plan**:
- This worktree (work here): `C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance`
- Sister worktree (read reference, do NOT edit): `C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc`
- Main worktree (Java sources here, also read-only for this chat): `C:/Users/Steve/my-prototype-logistics/`

**Commit safety**: every commit MUST use `--only` mode per `.claude/rules/concurrent-edit-safety.md` rule 5b:
```bash
git commit -m "..." -- <specific paths>     # ← good
# or
./scripts/safe-commit.sh "..." <paths>      # ← extra safety
```

---

## Phase A — Discovery / preparation (research-only, no code edits)

### Task A.1: javap MetricResult.java + verify 6 shared DTO field counts

**Files:** read-only (no edits in this task)

- [ ] **Step 1: Locate Java DTO source files**

```bash
ls backend/java/cretas-api/src/main/java/com/cretas/aims/dto/smartbi/MetricResult.java
ls backend/java/cretas-api/src/main/java/com/cretas/aims/dto/smartbi/{DashboardResponse,KPICard,RankingItem,ChartConfig,AIInsight,DateRange}.java
```

Expected: all 7 files exist (no error from `ls`).

- [ ] **Step 2: Read MetricResult.java fields**

Use Read tool on `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/smartbi/MetricResult.java`. Capture:
- All `private` field declarations (their order = Lombok @Data getter emit order)
- Whether class has `@Data` annotation (means all declared fields emit)
- The `AlertLevel` enum (typically nested or in same package): GREEN / YELLOW / RED string values

Expected fields (per spec §4.1, verify):
```
metricCode (String)
metricName (String)
value (BigDecimal)
formattedValue (String)
unit (String)
changePercent (BigDecimal)
changeDirection (String)
changeValue (BigDecimal)
alertLevel (AlertLevel enum)
dimensionValue (String)
description (String)
```

- [ ] **Step 3: Verify 6 shared DTO field counts match sister's `analysis_sales.py:75-228`**

For each of {DashboardResponse, KPICard, RankingItem, ChartConfig, AIInsight, DateRange}:
1. Read the Java class file (count `private` fields, ignore `private static` constants)
2. Compare to sister's Python factory in `analysis_sales.py` (lines 75-330)
3. Spot-check field NAMES match (camelCase Java → camelCase Python keys; xAxisField → "xaxisField" 注意 Jackson demangling per sister docstring line 192-194)

Expected: counts match sister's documented counts (DashboardResponse=16 incl 4 deprecated, KPICard=13, RankingItem=6, ChartConfig=7, AIInsight=5, DateRange=7).

- [ ] **Step 4: Document findings (no commit needed)**

Capture findings in your task notes (subagent reports back to dispatcher). No file change yet — used by Task B.4 to write the new `_new_metric_result_dict` factory.

---

### Task A.2: Read 4 composite sub-service Java implementations + record empty-state shapes

**Files:** read-only

- [ ] **Step 1: Locate `FinanceAnalysisServiceImpl.java`**

```bash
ls backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/FinanceAnalysisServiceImpl.java
```

- [ ] **Step 2: Read `getFinanceOverview` impl + identify empty-state shape**

Use Read tool with offset=70 limit=200 on the file. Find `getFinanceOverview` method (likely around line 88-189 per spec). Capture:
- What `DashboardResponse.builder()` fields are set when data is empty?
- Are `aiInsights` populated with YELLOW message OR `[]` empty?
- Are `suggestions` populated OR `[]` empty?
- What's `kpiCards` shape on empty?
- Is `lastUpdated` set?

Expected output to capture (one of two shapes):

  Option A (sales-style): `aiInsights:[YELLOW message], suggestions:["..."], kpiCards:[]`
  Option B (clean empty): `aiInsights:[], suggestions:[], kpiCards:[]`

This determines C.1 stub shape.

- [ ] **Step 3: Read `getProfitMetrics` empty-state**

Find method body. On empty data, does it return `[]` (empty list) or `null`? Java `List<MetricResult>` should never be null — confirm.

- [ ] **Step 4: Read `getCostStructureChart` empty-state**

Find method body. On empty data:
- Does it return a ChartConfig with empty data list (`data:[]`)?
- What's `chartType` ("PIE"?) / `title` ("成本结构"?)
- What's `options` value (null? specific dict?)

- [ ] **Step 5: Read `getReceivableAgingChart` empty-state**

Same shape questions as Step 4. Confirm method signature uses only `endDate` (no `startDate`).

- [ ] **Step 6: Document findings**

Capture all 4 empty-state shapes in subagent report. No code change yet — used by Task C.1.

---

### Task A.3: Read payable Java implementations + identify SQL data source

**Files:** read-only

- [ ] **Step 1: Read `getPayableMetrics` implementation**

Use Grep + Read on `FinanceAnalysisServiceImpl.java` to find `getPayableMetrics` method. Capture:
- What repository / DAO does it call?
- What table(s) and `RecordType` filter?
- How are `AP_BALANCE` and `AP_TURNOVER_DAYS` calculated?
- What `MetricResult` fields are set (which left null)?
- What `AlertLevel` (if any) is assigned?

```bash
grep -n "getPayableMetrics" backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/FinanceAnalysisServiceImpl.java
```

- [ ] **Step 2: Read `getPayableAgingChart` implementation**

Grep + Read. Capture:
- Data source (table + filter)
- Aging bucket logic (0-30, 31-60, 61-90, >90)
- ChartConfig output shape (chartType, title, data list shape)

- [ ] **Step 3: Identify the SQL/JPA queries**

Trace the repository methods called. Find the actual SQL or JPA criteria. Likely candidates:
- `SmartBiFinanceData` repo with `RecordType.PAYABLE`
- Independent `accounts_payable` / `ap_aging` table
- Other?

For Phase E SQL helper writing, capture:
- Source table name (snake_case)
- Filter columns (factory_id, record_type, record_date, etc.)
- Group by columns for aging
- Date column used for bucketing (record_date? due_date?)

- [ ] **Step 4: Document SQL findings**

Subagent report MUST include the actual SQL/JPA query text or pseudocode. Used by Task E.1.

---

### Task A.4: Verify F999 fixture pattern reusable from sister

**Files:** read-only

- [ ] **Step 1: Check if `tests/python/smartbi_compat/conftest.py` exists in this worktree**

```bash
ls tests/python/smartbi_compat/conftest.py 2>&1
```

If "No such file" → sister has not pushed and this dir doesn't exist yet. Plan: Phase B creates `tests/python/smartbi_compat/` and copies needed conftest from sister.

- [ ] **Step 2: Read sister's conftest from sister worktree**

```bash
ls C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc/tests/python/smartbi_compat/conftest.py 2>&1
```

If exists, Read the file. Capture:
- F999 fixture definition (factory_id, JWT generation, anything else?)
- pool fixture (mock SQL pool)
- TestClient factory pattern

- [ ] **Step 3: Check existing `tests/python/` infrastructure in origin/main**

```bash
ls tests/python/ 2>&1
ls tests/python/conftest.py 2>&1 | head -5
```

If origin/main has `tests/python/conftest.py` (top-level), inspect for shared fixtures.

- [ ] **Step 4: Document F999 fixture sourcing strategy**

Decide: copy from sister verbatim (default), or write minimal local. Subagent reports.

---

### Task A.5: Record F999 composite golden from test env Java backend

**CRITICAL: This task BEFORE Phase C** — Python composite dict order MUST match Jackson output, and Jackson order ≠ Java put order (sister sales hit this — see `analysis_sales.py:700-709` docstring).

**Files:**
- Create: `tests/fixtures/java-smartbi-golden/analysis-finance-F999-composite.json`

- [ ] **Step 1: Verify test env Java backend is up**

```bash
curl -s http://47.100.235.168:10011/api/mobile/health | head -3
```

Expected: `{"status":"UP",...}` or similar success. If 502/timeout, escalate — test env Java needed for golden recording.

- [ ] **Step 2: Acquire F999 JWT from sister test pattern**

Look up F999 JWT generation in sister's `conftest.py` or test fixtures:

```bash
grep -rn "F999" C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc/tests/python/ 2>&1 | head -20
```

Capture the JWT generation snippet. The F999 factory is a synthetic empty-state tenant (per memory).

Run a Python one-liner to generate fresh JWT (sister test uses HS256 + `JWT_SECRET` env var):

```python
import jwt, os, time
secret = os.getenv("JWT_SECRET", "default-secret-CHANGE-ME-MUST-BE-AT-LEAST-32-CHARS")
payload = {
    "userId": 999, "username": "f999_test_user",
    "factoryId": "F999", "role": "factory_super_admin",
    "iat": int(time.time()), "exp": int(time.time()) + 3600,
}
token = jwt.encode(payload, secret, algorithm="HS256")
print(token)
```

- [ ] **Step 3: Curl Java endpoint with F999 JWT, capture composite response**

```bash
JWT="<paste from Step 2>"
mkdir -p tests/fixtures/java-smartbi-golden
curl -s -H "Authorization: Bearer $JWT" \
  "http://47.100.235.168:10011/api/mobile/F999/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31" \
  | python -m json.tool > tests/fixtures/java-smartbi-golden/analysis-finance-F999-composite.json
```

Verify file is valid JSON:
```bash
python -c "import json; print(list(json.load(open('tests/fixtures/java-smartbi-golden/analysis-finance-F999-composite.json'))))"
```

Expected: prints a list of envelope keys, e.g., `['code', 'message', 'data', 'timestamp', 'success']`.

- [ ] **Step 4: Inspect golden's `data` key order**

```bash
python -c "
import json
g = json.load(open('tests/fixtures/java-smartbi-golden/analysis-finance-F999-composite.json'))
print('envelope keys:', list(g.keys()))
print('data keys:', list(g['data'].keys()))
"
```

Expected: data keys are some order like `['overview', 'profitMetrics', 'costStructure', 'receivableAging', 'dateRange', 'generatedAt']` — but **the order may differ**, since Java uses `HashMap`. Record the actual order — this is what Python composite dict MUST match.

If `data` returns 3-key shape (`['startDate', 'endDate', 'overview']` only) → that's the smartBIService==null fallback (per spec §3.3). Escalate — Python won't mirror this; need to investigate why test env smartBIService bean is missing.

- [ ] **Step 5: Commit the golden file**

```bash
git status --short    # ← verify only the golden file new
git commit -m "test(phase2a/t-finance): record F999 composite golden from test env (Java line 600-605)" \
  -- tests/fixtures/java-smartbi-golden/analysis-finance-F999-composite.json
```

Verify post-commit:
```bash
git show --stat HEAD | head -5    # ← only the golden file
```

---

### Task A.6: Resolve DateRange Python class dependency

Spec §10.2: try (α) cherry-pick first, fallback to (β) copy from sister worktree.

**Files:**
- Create: `backend/python/smartbi_compat/date_range.py` (via copy from sister)

- [ ] **Step 1: Confirm sister worktree has the file**

```bash
ls C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc/backend/python/smartbi_compat/date_range.py
```

Expected: file path printed.

- [ ] **Step 2: Try (α) cherry-pick — fetch sister branch as ref + cherry-pick 3 commits**

```bash
git fetch ../phase2a-t5-poc phase2a/t5-poc:refs/remotes/sister/t5-poc
git cherry-pick 517f4692a b648e7775 d301ff2d8
```

If cherry-pick succeeds → DateRange class + tests + dict factory all integrated. Skip to Step 4.

If cherry-pick fails (SHA not found, conflicts beyond DateRange, history rewritten) → abort with `git cherry-pick --abort`, proceed to Step 3.

- [ ] **Step 3: (β) Fallback — copy file directly**

```bash
cp ../phase2a-t5-poc/backend/python/smartbi_compat/date_range.py \
   backend/python/smartbi_compat/date_range.py
```

Verify the file exists and is a valid Python module:

```bash
python -c "
import sys; sys.path.insert(0, 'backend/python')
from smartbi_compat.date_range import DateRange
from datetime import date
r = DateRange.custom(date(2025,1,1), date(2025,12,31))
print('OK, DateRange usable:', r.start_date, r.end_date)
"
```

Expected: `OK, DateRange usable: 2025-01-01 2025-12-31` (or similar — fields may include `.days`, `.valid`).

- [ ] **Step 4: Commit DateRange (only this file, no scope creep)**

```bash
git status --short    # verify only date_range.py new (and its test if cherry-picked)
git commit -m "feat(phase2a/t-finance): bring DateRange from sister branch (cp/cherry-pick per spec §10.2)" \
  -- backend/python/smartbi_compat/date_range.py
```

If cherry-picked, the test file `tests/python/smartbi_compat/test_date_range.py` may also be staged — include it in the commit:

```bash
git status --short
# if test_date_range.py shows up:
git commit -m "..." -- backend/python/smartbi_compat/date_range.py tests/python/smartbi_compat/test_date_range.py
```

- [ ] **Step 5: Sanity test — run the date_range unit test (if exists)**

```bash
pytest tests/python/smartbi_compat/test_date_range.py -v 2>&1 | tail -10
```

Expected: tests pass (sister wrote them) OR "no tests collected" (only file copied without tests, that's fine).

---

## Phase B — File skeleton (DTO factories, helpers, route handler shell)

### Task B.1: Create `analysis_finance.py` with module docstring + imports

**Files:**
- Create: `backend/python/smartbi_compat/api/analysis_finance.py`

- [ ] **Step 1: Write the file with header docstring + imports**

```python
"""Phase 2A /analysis/finance endpoint port.

Implements composite Map<String, Object> response (6 keys for non-empty
analysisType), and per-type response shapes. Foundation scope:
  - Composite path (analysisType empty)  → 4 stub sub-services
  - Payable per-type path (analysisType=payable, stretch) → 2 real sub-services
  - 501 path for un-ported types (profit/cost/receivable/budget) → wrap_response

Sibling副轨 chats replace stubs / add per-types:
  - phase2a/t-finance-perX: profit/cost/receivable/budget real impls
  - phase2a/t-finance-subroutes: 3 standalone sub-endpoints

Java reference:
  - Controller: SmartBIAnalysisController.getFinanceAnalysis line 222-274
  - Service: SmartBIServiceImpl.getComprehensiveAnalysis line 600-605 + 612-613
  - Sub-services: FinanceAnalysisServiceImpl.{getFinanceOverview, getProfitMetrics,
    getCostStructureChart, getReceivableAgingChart, getPayableMetrics, getPayableAgingChart}

Skipped (per spec §3.3, §0):
  - fireGoldShadowRead async (FinanceAnalysisServiceImpl line 200-215, 0-byte impact)
  - smartBIService==null 3-key fallback (accepted divergence)

Spec: docs/superpowers/specs/2026-04-29-phase2a-analysis-finance-foundation-design.md
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text

from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.date_range import DateRange
from smartbi_compat.schema_compat import wrap_response

logger = logging.getLogger(__name__)
router = APIRouter()
```

- [ ] **Step 2: Verify imports work standalone**

```bash
python -c "
import sys; sys.path.insert(0, 'backend/python')
import smartbi_compat.api.analysis_finance as m
print('OK', m.router, m.logger)
"
```

Expected: `OK <fastapi.routing.APIRouter ...> <Logger ... (WARNING)>`

If `ImportError: cannot import name 'wrap_response'` → check `schema_compat.py` exports the name (it does in origin/main per spec §3.2). If `ImportError: ... 'DateRange'` → Phase A.6 wasn't completed; backtrack.

- [ ] **Step 3: Commit**

```bash
git status --short    # only the new file
git commit -m "feat(phase2a/t-finance): scaffold analysis_finance.py with module docstring + imports" \
  -- backend/python/smartbi_compat/api/analysis_finance.py
git show --stat HEAD | head -5
```

---

### Task B.2: Copy 6 shared DTO factories verbatim from sister

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (append after imports)

Per spec §4.1 + audit C2: copy verbatim from sister `analysis_sales.py` lines 46-228 to avoid re-deriving any field count / field name / Jackson demangle quirks.

- [ ] **Step 1: Append section header + 6 factories to the file**

Append the following code block to `analysis_finance.py` (after the existing `router = APIRouter()` line):

```python


# ============================================================
# Section 1: Shared DTO dict factories (copy from sister analysis_sales.py:46-228)
# Field counts/names/order identical to sister; do NOT re-derive.
# ============================================================


def _infer_granularity(start: date, end: date) -> str:
    """Mirror Java DateRangeUtils granularity inference.

    YEAR   — full calendar year (Jan 1 → Dec 31, same year)
    MONTH  — first day of month → last day of same month
    CUSTOM — anything else
    """
    if (start.month == 1 and start.day == 1
            and end.month == 12 and end.day == 31
            and start.year == end.year):
        return "YEAR"
    import calendar
    last_day = calendar.monthrange(start.year, start.month)[1]
    if (start.day == 1
            and end.year == start.year
            and end.month == start.month
            and end.day == last_day):
        return "MONTH"
    return "CUSTOM"


def _new_date_range_dict(range_: DateRange) -> dict:
    """Mirror DateRange.java @Data getters incl. derived `days` and `valid` (7 fields)."""
    days_count = (range_.end_date - range_.start_date).days + 1
    granularity = getattr(range_, "granularity", None) or _infer_granularity(
        range_.start_date, range_.end_date
    )
    original_expression = getattr(range_, "original_expression", None) or (
        f"{range_.start_date.isoformat()} 至 {range_.end_date.isoformat()}"
    )
    return {
        "startDate": range_.start_date.isoformat(),
        "endDate": range_.end_date.isoformat(),
        "granularity": granularity,
        "originalExpression": original_expression,
        "relative": getattr(range_, "relative", False),
        "days": days_count,
        "valid": range_.start_date <= range_.end_date,
    }


def _new_dashboard_response_dict(
    period: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    kpi_cards: Optional[list] = None,
    metric_cards: Optional[list] = None,
    rankings: Optional[dict] = None,
    charts: Optional[dict] = None,
    chart_list: Optional[list] = None,
    ai_insights: Optional[list] = None,
    alerts: Optional[list] = None,
    recommendations: Optional[list] = None,
    suggestions: Optional[list] = None,
    generated_at: Optional[str] = None,
    last_updated: Optional[str] = None,
    from_cache: bool = False,
    cache_expire_at: Optional[str] = None,
) -> dict:
    """Mirror DashboardResponse.java @Data getters (16 fields, 4 deprecated still emit per Lombok)."""
    return {
        "period": period,
        "startDate": start_date.isoformat() if start_date else None,
        "endDate": end_date.isoformat() if end_date else None,
        "kpiCards": kpi_cards if kpi_cards is not None else [],
        "metricCards": metric_cards,
        "rankings": rankings if rankings is not None else {},
        "charts": charts if charts is not None else {},
        "chartList": chart_list,
        "aiInsights": ai_insights if ai_insights is not None else [],
        "alerts": alerts,
        "recommendations": recommendations,
        "suggestions": suggestions,
        "generatedAt": generated_at,
        "lastUpdated": last_updated,
        "fromCache": from_cache,
        "cacheExpireAt": cache_expire_at,
    }


def _new_ranking_item_dict(
    rank: int,
    name: str,
    value: Decimal,
    target: Optional[Decimal] = None,
    completion_rate: Optional[Decimal] = None,
    alert_level: Optional[str] = None,
) -> dict:
    """Mirror RankingItem.java @Data getters (6 fields)."""
    return {
        "rank": rank,
        "name": name,
        "value": value,
        "target": target,
        "completionRate": completion_rate,
        "alertLevel": alert_level,
    }


def _new_chart_config_dict(
    chart_type: str,
    title: str,
    series_field: Optional[str] = None,
    data: Optional[list] = None,
    options: Optional[dict] = None,
    xaxis_field: Optional[str] = None,
    yaxis_field: Optional[str] = None,
) -> dict:
    """Mirror ChartConfig.java @Data getters (7 fields).

    `xaxisField` / `yaxisField` are LOWERCASE (Jackson demangles getXAxisField → "xaxisField").
    """
    return {
        "chartType": chart_type,
        "title": title,
        "seriesField": series_field,
        "data": data if data is not None else [],
        "options": options,
        "xaxisField": xaxis_field,
        "yaxisField": yaxis_field,
    }


def _new_ai_insight_dict(
    level: str,
    category: str,
    message: str,
    related_entity: Optional[str] = None,
    action_suggestion: Optional[str] = None,
) -> dict:
    """Mirror AIInsight.java @Data getters (5 fields). level: RED / YELLOW / GREEN / INFO."""
    return {
        "level": level,
        "category": category,
        "message": message,
        "relatedEntity": related_entity,
        "actionSuggestion": action_suggestion,
    }


def _new_kpi_card_dict(
    key: str,
    title: str,
    value: Optional[Any] = None,
    raw_value: Optional[Decimal] = None,
    unit: Optional[str] = None,
    change: Optional[Decimal] = None,
    change_rate: Optional[Decimal] = None,
    trend: Optional[str] = None,
    status: str = "green",
    compare_text: Optional[str] = None,
    description: Optional[str] = None,
    target_value: Optional[Decimal] = None,
    completion_rate: Optional[Decimal] = None,
) -> dict:
    """Mirror KPICard.java @Data getters (13 fields). status default "green" per Lombok @Builder.Default."""
    return {
        "key": key,
        "title": title,
        "value": value,
        "rawValue": raw_value,
        "unit": unit,
        "change": change,
        "changeRate": change_rate,
        "trend": trend,
        "status": status,
        "compareText": compare_text,
        "description": description,
        "targetValue": target_value,
        "completionRate": completion_rate,
    }
```

- [ ] **Step 2: Verify file imports + factories defined**

```bash
python -c "
import sys; sys.path.insert(0, 'backend/python')
from smartbi_compat.api import analysis_finance as m
factories = ['_new_date_range_dict', '_new_dashboard_response_dict', '_new_ranking_item_dict',
             '_new_chart_config_dict', '_new_ai_insight_dict', '_new_kpi_card_dict']
for f in factories:
    assert hasattr(m, f), f'missing {f}'
print('all 6 shared factories present')
"
```

Expected: `all 6 shared factories present`

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "feat(phase2a/t-finance): copy 6 shared DTO factories from sister analysis_sales.py" \
  -- backend/python/smartbi_compat/api/analysis_finance.py
git show --stat HEAD | head -5
```

---

### Task B.3: Append helpers (`_to_decimal`, `_decimal_to_number`, `_format_kpi_value`, `_strip_volatile`, `_utc_now_iso`)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`

Per audit + sister `analysis_sales.py:231-360` — copy verbatim.

- [ ] **Step 1: Append helpers to the file**

Append this block after the 6 factories from B.2:

```python


# ============================================================
# Section 2: Helpers (copy from sister analysis_sales.py:231-360)
# ============================================================


def _to_decimal(v: Any) -> Decimal:
    """Tolerant Number -> Decimal. Returns Decimal("0") on None / parse error."""
    if v is None:
        return Decimal("0")
    if isinstance(v, Decimal):
        return v
    if isinstance(v, bool):  # bool is int subclass; guard before int branch
        return Decimal("0")
    if isinstance(v, int):
        return Decimal(v)
    if isinstance(v, float):
        return Decimal(str(v))
    if isinstance(v, str):
        try:
            return Decimal(v)
        except Exception:
            return Decimal("0")
    return Decimal("0")


def _decimal_to_number(v: Decimal) -> Any:
    """Convert Decimal to int or float for JSON-safe serialization.

    FastAPI's default JSON encoder serializes Decimal as string, breaking byte
    parity with Java Jackson which emits numeric values. This helper converts
    to int when integer-valued, else float — mirroring Jackson's BigDecimal output.

    Used at every site emitting Decimal in response: rawValue, ranking value,
    chart amount, MetricResult value/changePercent/changeValue.
    """
    if v == v.to_integral_value():
        return int(v)
    return float(v)


def _format_kpi_value(v: Decimal, unit: str) -> str:
    """Format Decimal for KPICard.value. Yuan -> 2 decimals; other -> integer string.

    Use str() of quantize result, NOT normalize() — normalize strips trailing
    zeros (12.50 -> 12.5) and breaks Java byte parity.
    """
    if unit == "元":
        return str(v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    return str(v.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


VOLATILE_KEYS = frozenset({
    "generatedAt", "lastUpdated", "cacheExpireAt", "timestamp",
})


def _strip_volatile(obj: Any) -> Any:
    """Recursively strip timing/cache-dependent keys for byte-shape compare."""
    if isinstance(obj, dict):
        return {
            k: _strip_volatile(v)
            for k, v in obj.items()
            if k not in VOLATILE_KEYS
        }
    if isinstance(obj, list):
        return [_strip_volatile(item) for item in obj]
    return obj


def _utc_now_iso() -> str:
    """ISO LocalDateTime (no timezone, matching Java Jackson serialization)."""
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
```

- [ ] **Step 2: Verify helpers**

```bash
python -c "
import sys; sys.path.insert(0, 'backend/python')
from smartbi_compat.api import analysis_finance as m
from decimal import Decimal
assert m._to_decimal(None) == Decimal('0')
assert m._to_decimal(12.5) == Decimal('12.5')
assert m._decimal_to_number(Decimal('100')) == 100
assert m._decimal_to_number(Decimal('100.5')) == 100.5
assert m._format_kpi_value(Decimal('100'), '元') == '100.00'
assert m._strip_volatile({'a':1,'generatedAt':'x'}) == {'a':1}
assert isinstance(m._utc_now_iso(), str)
print('OK helpers')
"
```

Expected: `OK helpers`

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "feat(phase2a/t-finance): add Decimal helpers + _strip_volatile (copy from sister)" \
  -- backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task B.4: Add `_new_metric_result_dict` factory (NEW — finance-specific)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`

Per Task A.1 findings + spec §4.1: 11 declared @Data fields, all emit per Lombok.

- [ ] **Step 1: Append the new factory**

Append after the helpers from B.3:

```python


# ============================================================
# Section 2b: MetricResult factory (finance-specific; NOT in sister)
# ============================================================


def _new_metric_result_dict(
    metric_code: str,
    metric_name: str,
    value: Optional[Any] = None,           # Decimal or pre-converted number
    formatted_value: Optional[str] = None,
    unit: Optional[str] = None,
    change_percent: Optional[Any] = None,  # Decimal or number
    change_direction: Optional[str] = None,  # up / down / flat
    change_value: Optional[Any] = None,
    alert_level: Optional[str] = None,     # GREEN / YELLOW / RED
    dimension_value: Optional[str] = None,
    description: Optional[str] = None,
) -> dict:
    """Mirror MetricResult.java @Data getters (11 fields, all emit per Lombok).

    Field order matches Java declaration order (verified Phase A.1 javap):
      metricCode / metricName / value / formattedValue / unit /
      changePercent / changeDirection / changeValue / alertLevel /
      dimensionValue / description

    `value`, `changePercent`, `changeValue` callers should pass `_decimal_to_number(d)`
    OR a string (matching Java Jackson BigDecimal serialization). NEVER pass a Decimal
    directly without conversion — FastAPI will serialize as string and break byte parity.

    `alertLevel` is a string ("GREEN" / "YELLOW" / "RED") matching Java enum name().
    """
    return {
        "metricCode": metric_code,
        "metricName": metric_name,
        "value": value,
        "formattedValue": formatted_value,
        "unit": unit,
        "changePercent": change_percent,
        "changeDirection": change_direction,
        "changeValue": change_value,
        "alertLevel": alert_level,
        "dimensionValue": dimension_value,
        "description": description,
    }
```

- [ ] **Step 2: Verify factory**

```bash
python -c "
import sys; sys.path.insert(0, 'backend/python')
from smartbi_compat.api.analysis_finance import _new_metric_result_dict
m = _new_metric_result_dict('AP_BALANCE', '应付余额', value=1000, unit='元', alert_level='GREEN')
assert list(m.keys()) == ['metricCode', 'metricName', 'value', 'formattedValue', 'unit',
    'changePercent', 'changeDirection', 'changeValue', 'alertLevel', 'dimensionValue', 'description']
assert m['metricCode'] == 'AP_BALANCE'
assert m['alertLevel'] == 'GREEN'
print('OK MetricResult factory')
"
```

Expected: `OK MetricResult factory`. **If field order assertion fails, A.1 javap output didn't match — re-check Java source.**

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "feat(phase2a/t-finance): add _new_metric_result_dict factory (finance-specific, 11 fields)" \
  -- backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task B.5: Add route handler skeleton with composite + payable + 501 branches

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`

- [ ] **Step 1: Append placeholder sub-services + route handler**

Append after `_new_metric_result_dict`:

```python


# ============================================================
# Section 3: Sub-service stubs (composite path)
# Phase C.1 fills with Phase A.2-verified empty-state shapes.
# ============================================================


async def _get_finance_overview(factory_id: str, range_: DateRange) -> dict:
    """STUB — Phase C.1 fills based on Java FinanceAnalysisServiceImpl.getFinanceOverview empty path."""
    raise NotImplementedError("filled in Phase C.1")


async def _get_profit_metrics(factory_id: str, range_: DateRange) -> list:
    """STUB — Phase C.1 fills based on Java getProfitMetrics empty return."""
    raise NotImplementedError("filled in Phase C.1")


async def _get_cost_structure_chart(factory_id: str, range_: DateRange) -> dict:
    """STUB — Phase C.1 fills based on Java getCostStructureChart empty return."""
    raise NotImplementedError("filled in Phase C.1")


async def _get_receivable_aging_chart(factory_id: str, end_date: date) -> dict:
    """STUB — Phase C.1 fills. Note: signature uses end_date only, mirroring Java."""
    raise NotImplementedError("filled in Phase C.1")


# ============================================================
# Section 4: Composite + per-type assembly (fill in Phase C.2 + Phase E.4)
# ============================================================


async def _get_comprehensive_finance_analysis(factory_id: str, range_: DateRange) -> dict:
    """Filled in Phase C.2 — composite Map mirroring Java getComprehensiveAnalysis."""
    raise NotImplementedError("filled in Phase C.2")


async def _get_payable_analysis(factory_id: str, start_date: date, end_date: date) -> dict:
    """Filled in Phase E.4 — payable per-type 4-key shape."""
    raise NotImplementedError("filled in Phase E.4")


# ============================================================
# Section 5: Route handler
# ============================================================


@router.get("/api/mobile/{factory_id}/smart-bi/analysis/finance")
async def get_finance_analysis(
    factory_id: str,
    startDate: date = Query(..., alias="startDate"),
    endDate: date = Query(..., alias="endDate"),
    analysisType: Optional[str] = Query(None, alias="analysisType"),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Java reference: SmartBIAnalysisController.getFinanceAnalysis line 222-274.

    Branches:
      analysisType empty       → composite (6-key Map via getComprehensiveAnalysis)
      analysisType=payable     → payable per-type (4-key shape, real impl Phase E)
      analysisType=other       → 501 (un-ported, see spec §6 / §12)

    department query param accepted but IGNORED (mirror Java line 110 short-circuit).
    """
    range_ = DateRange.custom(startDate, endDate)

    if not analysisType:
        result = await _get_comprehensive_finance_analysis(auth.factory_id, range_)
        return wrap_response(result)

    if analysisType == "payable":
        result = await _get_payable_analysis(auth.factory_id, startDate, endDate)
        return wrap_response(result)

    return wrap_response(
        data=None,
        success=False,
        code=501,
        message=f"analysisType={analysisType} 尚未 port 至 Python，请暂用 Java endpoint 或等待 phase2a/t-finance-perX 副轨完成",
    )
```

- [ ] **Step 2: Verify route registers in import**

```bash
python -c "
import sys; sys.path.insert(0, 'backend/python')
from smartbi_compat.api.analysis_finance import router
routes = [r.path for r in router.routes]
print(routes)
assert '/api/mobile/{factory_id}/smart-bi/analysis/finance' in routes
print('OK route registered')
"
```

Expected: prints `['/api/mobile/{factory_id}/smart-bi/analysis/finance']` then `OK route registered`.

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "feat(phase2a/t-finance): add stub sub-services + route handler skeleton with 3-branch logic" \
  -- backend/python/smartbi_compat/api/analysis_finance.py
```

---

## Phase C — Composite path (4 stubs + assembly)

### Task C.1: Fill 4 sub-service stubs with Phase A.2-verified empty-state shapes

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`

Per Task A.2 findings — REPLACE the 4 `raise NotImplementedError` stubs with empty-state returns matching Java's actual return shape.

⚠️ **Do NOT blindly copy sales empty-state YELLOW+suggestion pattern** — Java finance impl may emit `aiInsights:[], suggestions:[]` (clean empty). A.2 should have captured the real shape.

- [ ] **Step 1: Replace `_get_finance_overview` stub**

If A.2 found Java emits clean empty (no insights, no suggestions):

```python
async def _get_finance_overview(factory_id: str, range_: DateRange) -> dict:
    """F999 empty-state — Java FinanceAnalysisServiceImpl.getFinanceOverview returns
    DashboardResponse.builder() with empty kpiCards/charts/rankings + lastUpdated.
    Phase A.2 verified shape; sister sales had YELLOW insight, finance does NOT."""
    return _new_dashboard_response_dict(
        kpi_cards=[],
        rankings={},
        charts={},
        ai_insights=[],
        suggestions=[],
        last_updated=_utc_now_iso(),
    )
```

If A.2 found Java emits YELLOW+suggestion pattern (sales-style), use this version instead:

```python
async def _get_finance_overview(factory_id: str, range_: DateRange) -> dict:
    """F999 empty-state — Java path emits YELLOW data-status insight per A.2."""
    return _new_dashboard_response_dict(
        ai_insights=[
            _new_ai_insight_dict(
                level="YELLOW",
                category="数据状态",
                message="当前时间范围内暂无财务数据",  # exact text from Java A.2
                action_suggestion="请上传财务数据或调整时间范围",
            ),
        ],
        suggestions=["请先上传财务数据以开始分析"],
        last_updated=_utc_now_iso(),
    )
```

Pick the correct version based on A.2 subagent report. Use `Edit` tool to replace the `raise NotImplementedError("filled in Phase C.1")` stub line for this function.

- [ ] **Step 2: Replace `_get_profit_metrics` stub**

```python
async def _get_profit_metrics(factory_id: str, range_: DateRange) -> list:
    """F999 empty-state — Java getProfitMetrics returns empty List<MetricResult> on no data."""
    return []
```

- [ ] **Step 3: Replace `_get_cost_structure_chart` stub**

Use A.2-verified chart_type / title / options:

```python
async def _get_cost_structure_chart(factory_id: str, range_: DateRange) -> dict:
    """F999 empty-state — Java getCostStructureChart returns ChartConfig with empty data list.
    Phase A.2 verified: chart_type, title, options values."""
    return _new_chart_config_dict(
        chart_type="PIE",       # ← confirm from A.2
        title="成本结构",        # ← confirm from A.2
        data=[],
        options=None,           # ← if A.2 found a non-null options dict, replace here
    )
```

- [ ] **Step 4: Replace `_get_receivable_aging_chart` stub**

```python
async def _get_receivable_aging_chart(factory_id: str, end_date: date) -> dict:
    """F999 empty-state — Java getReceivableAgingChart returns ChartConfig with empty data.
    Note: signature uses end_date only (mirrors Java line 226 / 252)."""
    return _new_chart_config_dict(
        chart_type="PIE",                  # ← confirm from A.2
        title="应收账款账龄分布",            # ← confirm from A.2
        data=[],
        options=None,
    )
```

- [ ] **Step 5: Verify all 4 stubs callable + return shape correct**

```bash
python -c "
import asyncio, sys
sys.path.insert(0, 'backend/python')
from datetime import date
from smartbi_compat.api.analysis_finance import (
    _get_finance_overview, _get_profit_metrics,
    _get_cost_structure_chart, _get_receivable_aging_chart,
)
from smartbi_compat.date_range import DateRange
r = DateRange.custom(date(2025,1,1), date(2025,12,31))
ov = asyncio.run(_get_finance_overview('F999', r))
pm = asyncio.run(_get_profit_metrics('F999', r))
cs = asyncio.run(_get_cost_structure_chart('F999', r))
ra = asyncio.run(_get_receivable_aging_chart('F999', date(2025,12,31)))
assert isinstance(ov, dict) and 'kpiCards' in ov, 'overview shape wrong'
assert pm == [], 'profitMetrics not empty list'
assert isinstance(cs, dict) and cs['data'] == [], 'cost chart not empty'
assert isinstance(ra, dict) and ra['data'] == [], 'aging chart not empty'
print('all 4 stubs return correct shape')
"
```

Expected: `all 4 stubs return correct shape`

- [ ] **Step 6: Commit**

```bash
git status --short
git commit -m "feat(phase2a/t-finance): fill 4 composite stubs with A.2-verified empty-state shapes" \
  -- backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task C.2: Fill `_get_comprehensive_finance_analysis` composite assembly

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`

⚠️ **CRITICAL — KEY ORDER**: Use the order recorded in `tests/fixtures/java-smartbi-golden/analysis-finance-F999-composite.json` from Phase A.5. **Java put-order ≠ Jackson output order** (sister sales hit this). Read golden's `data` keys order BEFORE writing the dict.

- [ ] **Step 1: Inspect golden's data key order**

```bash
python -c "
import json
g = json.load(open('tests/fixtures/java-smartbi-golden/analysis-finance-F999-composite.json'))
print(list(g['data'].keys()))
"
```

Capture the output, e.g.: `['receivableAging', 'overview', 'costStructure', 'profitMetrics', 'dateRange', 'generatedAt']` (your real order may differ).

- [ ] **Step 2: Replace the `_get_comprehensive_finance_analysis` stub**

Use Edit tool to replace `raise NotImplementedError("filled in Phase C.2")` with the real impl. Order keys EXACTLY matching golden Step 1 output:

```python
async def _get_comprehensive_finance_analysis(factory_id: str, range_: DateRange) -> dict:
    """Java reference: SmartBIServiceImpl.getComprehensiveAnalysis line 600-605 + 612-613.

    Java put order:
      overview / profitMetrics / costStructure / receivableAging / dateRange / generatedAt
    Jackson observed order (Phase A.5 golden):
      <FILL FROM golden's data.keys() — do NOT use Java put order>
    """
    # Order matches Phase A.5 golden's data.keys() — see comment above
    overview        = await _get_finance_overview(factory_id, range_)
    profit_metrics  = await _get_profit_metrics(factory_id, range_)
    cost_structure  = await _get_cost_structure_chart(factory_id, range_)
    receivable_aging = await _get_receivable_aging_chart(factory_id, range_.end_date)
    date_range_dict = _new_date_range_dict(range_)
    generated_at    = _utc_now_iso()

    # ⚠️ KEYS MUST BE INSERTED IN GOLDEN ORDER — fill below per A.5 inspection
    result = {}
    # Example (REPLACE with actual golden order):
    # result["overview"]         = overview
    # result["profitMetrics"]    = profit_metrics
    # result["costStructure"]    = cost_structure
    # result["receivableAging"]  = receivable_aging
    # result["dateRange"]        = date_range_dict
    # result["generatedAt"]      = generated_at
    # Replace the 6 lines above with the actual order from golden Step 1.
    return result
```

After looking at A.5 golden's actual key order, **replace the placeholder block above with the real ordered insertions**. Example (if golden key order is `['overview', 'receivableAging', 'profitMetrics', 'costStructure', 'dateRange', 'generatedAt']`):

```python
result = {
    "overview":         overview,
    "receivableAging":  receivable_aging,
    "profitMetrics":    profit_metrics,
    "costStructure":    cost_structure,
    "dateRange":        date_range_dict,
    "generatedAt":      generated_at,
}
return result
```

- [ ] **Step 3: Verify composite callable + shape matches golden**

```bash
python -c "
import asyncio, json, sys
sys.path.insert(0, 'backend/python')
from datetime import date
from smartbi_compat.api.analysis_finance import _get_comprehensive_finance_analysis, _strip_volatile
from smartbi_compat.date_range import DateRange
r = DateRange.custom(date(2025,1,1), date(2025,12,31))
result = asyncio.run(_get_comprehensive_finance_analysis('F999', r))
print('Python keys:', list(result.keys()))

golden = json.load(open('tests/fixtures/java-smartbi-golden/analysis-finance-F999-composite.json'))
print('Golden data keys:', list(golden['data'].keys()))
assert list(result.keys()) == list(golden['data'].keys()), 'KEY ORDER MISMATCH'
print('OK key order matches golden')
"
```

Expected: `OK key order matches golden`

If `KEY ORDER MISMATCH` → adjust dict key insertion order to match golden, re-run.

- [ ] **Step 4: Commit**

```bash
git status --short
git commit -m "feat(phase2a/t-finance): fill _get_comprehensive_finance_analysis with golden-verified key order" \
  -- backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task C.3: Verify route handler composite branch end-to-end

**Files:** read-only verification (route already wired in B.5)

- [ ] **Step 1: Run `python -c` smoke test through TestClient**

```bash
python -c "
import sys; sys.path.insert(0, 'backend/python')
from fastapi import FastAPI
from fastapi.testclient import TestClient
from smartbi_compat.api.analysis_finance import router

# Smoke-only — full middleware test in Phase D via _load_production_main()
app = FastAPI()
app.include_router(router)

# Auth middleware not loaded here, expect 422 or 401 from missing JWT
client = TestClient(app)
resp = client.get('/api/mobile/F999/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31')
print('status:', resp.status_code)
print('body:', resp.text[:200])
"
```

Expected: `status: 401` or `status: 422` — depending on whether auth dep raises before query parsing. Either is OK at this stage. **501 is NOT expected** (analysisType is empty so composite branch fires; auth/route works first).

- [ ] **Step 2: Run with auth bypass to confirm composite branch path**

```bash
python -c "
import sys; sys.path.insert(0, 'backend/python')
import asyncio
from datetime import date
from smartbi_compat.api.analysis_finance import (
    _get_comprehensive_finance_analysis, _get_payable_analysis
)
from smartbi_compat.date_range import DateRange

# Direct call — confirms composite path returns 6-key dict
r = DateRange.custom(date(2025,1,1), date(2025,12,31))
result = asyncio.run(_get_comprehensive_finance_analysis('F999', r))
print('composite keys:', list(result.keys()))
assert len(result) == 6, f'expected 6 keys, got {len(result)}'

# Payable still raises NotImplementedError
try:
    asyncio.run(_get_payable_analysis('F999', date(2025,1,1), date(2025,12,31)))
    print('FAIL — payable should NotImplementedError')
except NotImplementedError:
    print('OK payable correctly NotImplementedError (Phase E will fill)')
"
```

Expected: `composite keys: [...]` (6 items) then `OK payable correctly NotImplementedError (Phase E will fill)`

- [ ] **Step 3: Commit (no file changes; just task completion marker)**

No file changes in this task. Skip commit. Subagent reports task complete with smoke output.

---

## Phase D — Composite F999 byte gate

### Task D.1: Write `test_analysis_finance_contract.py` with composite byte-shape test

**Files:**
- Create: `tests/python/smartbi_compat/test_analysis_finance_contract.py`

⛔ **Use `_load_production_main()` importlib pattern** per spec §7.2 + audit I3. **Do NOT** `from smartbi_compat.api.analysis_finance import router` and bootstrap your own FastAPI app — that bypasses production JWT/CORS middleware.

- [ ] **Step 1: Inspect sister's contract test for the importlib helper**

```bash
head -70 C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc/tests/python/smartbi_compat/test_analysis_sales_contract.py
```

Capture the `_load_production_main()` function definition + how F999 JWT is generated.

- [ ] **Step 2: Create the contract test file**

```python
"""Byte-shape contract gate for /analysis/finance composite path.

Java reference:
  - Controller: SmartBIAnalysisController.getFinanceAnalysis line 222-274
  - Service: SmartBIServiceImpl.getComprehensiveAnalysis line 600-605

Test pattern:
  - Load production main via importlib (mirror sister test_analysis_sales_contract.py:41-66)
  - Mock SQL pool + sub-services to F999 empty-state shape
  - Hit /api/mobile/F999/smart-bi/analysis/finance via TestClient
  - Strip volatile keys (generatedAt/lastUpdated/cacheExpireAt/timestamp)
  - Assert byte-shape matches recorded golden

Golden source: Phase A.5 record from test env Java backend.
"""
from __future__ import annotations

import importlib.util
import json
import os
import sys
import time
from datetime import date
from pathlib import Path

import jwt
import pytest
from fastapi.testclient import TestClient


REPO_ROOT = Path(__file__).resolve().parents[3]
GOLDEN_DIR = REPO_ROOT / "tests" / "fixtures" / "java-smartbi-golden"


def _load_production_main():
    """Import backend/python/main.py as a module to get the production FastAPI app
    with all middleware (JWT auth, CORS, exception handlers) attached.

    Mirrors sister test_analysis_sales_contract.py:41-55.
    """
    main_path = REPO_ROOT / "backend" / "python" / "main.py"
    spec = importlib.util.spec_from_file_location("_production_main", main_path)
    module = importlib.util.module_from_spec(spec)
    sys.path.insert(0, str(REPO_ROOT / "backend" / "python"))
    spec.loader.exec_module(module)
    return module


def _f999_jwt() -> str:
    """Generate F999 test JWT matching test env JWT_SECRET."""
    secret = os.getenv("JWT_SECRET", "default-secret-CHANGE-ME-MUST-BE-AT-LEAST-32-CHARS")
    payload = {
        "userId": 999,
        "username": "f999_test_user",
        "factoryId": "F999",
        "role": "factory_super_admin",
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def _strip_volatile(obj):
    """Local copy of analysis_finance._strip_volatile for golden compare."""
    VOLATILE = frozenset({"generatedAt", "lastUpdated", "cacheExpireAt", "timestamp"})
    if isinstance(obj, dict):
        return {k: _strip_volatile(v) for k, v in obj.items() if k not in VOLATILE}
    if isinstance(obj, list):
        return [_strip_volatile(item) for item in obj]
    return obj


@pytest.fixture
def production_app():
    """Production FastAPI app with all routes registered."""
    return _load_production_main().app


@pytest.fixture
def client(production_app):
    return TestClient(production_app)


class TestAnalysisFinanceComposite:
    """F999 byte-shape gate for composite path (analysisType empty)."""

    def test_f999_composite_byte_shape(self, client, monkeypatch):
        """Hit /api/mobile/F999/smart-bi/analysis/finance with no analysisType,
        compare to recorded F999 composite golden.

        Pre-cond:
          - Phase A.5 recorded golden at tests/fixtures/java-smartbi-golden/analysis-finance-F999-composite.json
          - composite path uses 4 stub sub-services that return F999 empty-state shapes
        """
        token = _f999_jwt()
        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance"
            "?startDate=2025-01-01&endDate=2025-12-31",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"

        py_response = resp.json()
        py_stripped = _strip_volatile(py_response)

        golden_path = GOLDEN_DIR / "analysis-finance-F999-composite.json"
        golden = json.loads(golden_path.read_text())
        golden_stripped = _strip_volatile(golden)

        assert py_stripped == golden_stripped, (
            f"BYTE SHAPE MISMATCH\n"
            f"Python (stripped): {json.dumps(py_stripped, indent=2, ensure_ascii=False)[:1000]}\n"
            f"Golden  (stripped): {json.dumps(golden_stripped, indent=2, ensure_ascii=False)[:1000]}"
        )

    def test_f999_composite_data_keys_order(self, client):
        """Sanity check — Python composite must emit data keys in golden order."""
        token = _f999_jwt()
        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance"
            "?startDate=2025-01-01&endDate=2025-12-31",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        py_data_keys = list(resp.json()["data"].keys())

        golden_path = GOLDEN_DIR / "analysis-finance-F999-composite.json"
        golden_data_keys = list(json.loads(golden_path.read_text())["data"].keys())

        assert py_data_keys == golden_data_keys, (
            f"data key order: python={py_data_keys}, golden={golden_data_keys}"
        )
```

- [ ] **Step 3: Run test — expect failures or import errors**

```bash
pytest tests/python/smartbi_compat/test_analysis_finance_contract.py -v 2>&1 | tail -25
```

Expected outcomes:
- If `analysis_finance.router` not yet registered in `main.py` (Phase G.1 task) → test will get 404 from TestClient → expect FAIL "got 404: ..."
- If JWT_SECRET env not set in test env → may pass anyway (default fallback works) but production needs real env

We expect this test to FAIL until Phase G.1 wires the router into main.py. Capture the failure mode for Step 4.

- [ ] **Step 4: If 404 (route not found)**: that's expected — confirm by

```bash
python -c "
import sys; sys.path.insert(0, 'backend/python')
import importlib.util
from pathlib import Path
main_path = Path('backend/python/main.py')
spec = importlib.util.spec_from_file_location('_production_main', main_path)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
routes = [r.path for r in m.app.routes if hasattr(r, 'path')]
finance_routes = [r for r in routes if 'finance' in r]
print('finance routes in main.app:', finance_routes)
"
```

Expected: `finance routes in main.app: []` until G.1 wires include_router.

- [ ] **Step 5: Commit (test file only; route wiring deferred to G.1)**

```bash
git status --short
git commit -m "test(phase2a/t-finance): add composite byte-shape contract test (will pass after G.1 wires router)" \
  -- tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

### Task D.2: (deferred to G.1+G.2) Verify byte gate passes

This task is "verify the contract test passes against the golden".

The test was written in D.1; it will FAIL until Phase G.1 wires `include_router(analysis_finance.router)` into `main.py`. Verification happens in Phase G.2.

**No D.2 work right now. Task D.2 is a placeholder for the verification gate, executed in G.2.**

---

### Task D.3: Write `test_analysis_finance_factories.py` with 7 factory unit tests

**Files:**
- Create: `tests/python/smartbi_compat/test_analysis_finance_factories.py`

- [ ] **Step 1: Create factories test file**

```python
"""Unit tests for analysis_finance.py DTO dict factories.

Each factory must:
  - Emit fields in the expected order (matching Java declaration order)
  - Default optional Lists/Dicts to [] / {} (per Lombok @Data + sister precedent)
  - Default optional Optional<X> fields to None
  - Pass through provided values

Java DTO source files (read-only reference):
  - DashboardResponse.java (16 fields)
  - KPICard.java (13 fields)
  - RankingItem.java (6 fields)
  - ChartConfig.java (7 fields, xaxisField/yaxisField LOWERCASE)
  - AIInsight.java (5 fields)
  - DateRange.java (7 fields incl derived days/valid)
  - MetricResult.java (11 fields, ALL emit per Lombok)
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest


import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "backend" / "python"))

from smartbi_compat.api.analysis_finance import (
    _new_dashboard_response_dict,
    _new_kpi_card_dict,
    _new_metric_result_dict,
    _new_ranking_item_dict,
    _new_chart_config_dict,
    _new_ai_insight_dict,
    _new_date_range_dict,
)
from smartbi_compat.date_range import DateRange


class TestDashboardResponseFactory:
    def test_default_shape_has_16_fields(self):
        d = _new_dashboard_response_dict()
        assert len(d) == 16

    def test_field_order(self):
        d = _new_dashboard_response_dict()
        assert list(d.keys()) == [
            "period", "startDate", "endDate", "kpiCards", "metricCards",
            "rankings", "charts", "chartList", "aiInsights", "alerts",
            "recommendations", "suggestions", "generatedAt", "lastUpdated",
            "fromCache", "cacheExpireAt",
        ]

    def test_collection_defaults_empty(self):
        d = _new_dashboard_response_dict()
        assert d["kpiCards"] == []
        assert d["rankings"] == {}
        assert d["charts"] == {}
        assert d["aiInsights"] == []
        # Deprecated fields default to None (Java Optional<> behavior)
        assert d["metricCards"] is None
        assert d["chartList"] is None
        assert d["suggestions"] is None
        assert d["lastUpdated"] is None

    def test_passthrough(self):
        d = _new_dashboard_response_dict(period="month", from_cache=True)
        assert d["period"] == "month"
        assert d["fromCache"] is True


class TestKPICardFactory:
    def test_default_shape_has_13_fields(self):
        d = _new_kpi_card_dict(key="X", title="x")
        assert len(d) == 13

    def test_status_default_green(self):
        d = _new_kpi_card_dict(key="X", title="x")
        assert d["status"] == "green"

    def test_field_order(self):
        d = _new_kpi_card_dict(key="X", title="x")
        assert list(d.keys()) == [
            "key", "title", "value", "rawValue", "unit", "change", "changeRate",
            "trend", "status", "compareText", "description", "targetValue", "completionRate",
        ]


class TestMetricResultFactory:
    """11 declared @Data fields (NEW, not in sister analysis_sales.py)."""

    def test_default_shape_has_11_fields(self):
        d = _new_metric_result_dict(metric_code="AP_BALANCE", metric_name="应付余额")
        assert len(d) == 11, f"expected 11 fields, got {len(d)}: {list(d.keys())}"

    def test_field_order(self):
        d = _new_metric_result_dict(metric_code="A", metric_name="a")
        assert list(d.keys()) == [
            "metricCode", "metricName", "value", "formattedValue", "unit",
            "changePercent", "changeDirection", "changeValue", "alertLevel",
            "dimensionValue", "description",
        ]

    def test_alert_level_string(self):
        """alertLevel must be string, not enum object — Jackson serializes Java enum.name()."""
        d = _new_metric_result_dict(metric_code="X", metric_name="x", alert_level="GREEN")
        assert d["alertLevel"] == "GREEN"
        assert isinstance(d["alertLevel"], str)


class TestRankingItemFactory:
    def test_default_shape_has_6_fields(self):
        d = _new_ranking_item_dict(rank=1, name="A", value=Decimal("100"))
        assert len(d) == 6

    def test_field_order(self):
        d = _new_ranking_item_dict(rank=1, name="A", value=Decimal("100"))
        assert list(d.keys()) == ["rank", "name", "value", "target", "completionRate", "alertLevel"]


class TestChartConfigFactory:
    def test_default_shape_has_7_fields(self):
        d = _new_chart_config_dict(chart_type="PIE", title="t")
        assert len(d) == 7

    def test_field_order_lowercase_axes(self):
        """xaxisField / yaxisField are LOWERCASE per Jackson demangle of Lombok getXAxisField."""
        d = _new_chart_config_dict(chart_type="PIE", title="t")
        assert list(d.keys()) == [
            "chartType", "title", "seriesField", "data", "options", "xaxisField", "yaxisField",
        ]

    def test_data_default_empty_list(self):
        d = _new_chart_config_dict(chart_type="PIE", title="t")
        assert d["data"] == []


class TestAIInsightFactory:
    def test_default_shape_has_5_fields(self):
        d = _new_ai_insight_dict(level="YELLOW", category="cat", message="msg")
        assert len(d) == 5

    def test_field_order(self):
        d = _new_ai_insight_dict(level="YELLOW", category="cat", message="msg")
        assert list(d.keys()) == ["level", "category", "message", "relatedEntity", "actionSuggestion"]


class TestDateRangeFactory:
    def test_year_inference(self):
        r = DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
        d = _new_date_range_dict(r)
        assert d["granularity"] == "YEAR"

    def test_month_inference(self):
        r = DateRange.custom(date(2025, 3, 1), date(2025, 3, 31))
        d = _new_date_range_dict(r)
        assert d["granularity"] == "MONTH"

    def test_custom_inference(self):
        r = DateRange.custom(date(2025, 1, 5), date(2025, 1, 27))
        d = _new_date_range_dict(r)
        assert d["granularity"] == "CUSTOM"

    def test_derived_days_and_valid(self):
        r = DateRange.custom(date(2025, 1, 1), date(2025, 1, 10))
        d = _new_date_range_dict(r)
        assert d["days"] == 10
        assert d["valid"] is True

    def test_field_order(self):
        r = DateRange.custom(date(2025, 1, 1), date(2025, 1, 10))
        d = _new_date_range_dict(r)
        assert list(d.keys()) == [
            "startDate", "endDate", "granularity", "originalExpression",
            "relative", "days", "valid",
        ]
```

- [ ] **Step 2: Run factories test — expect all pass**

```bash
pytest tests/python/smartbi_compat/test_analysis_finance_factories.py -v 2>&1 | tail -30
```

Expected: all tests pass (factories were unit-verified during B.2/B.3/B.4 sanity checks; this just makes them pytest-managed).

If MetricResult test fails on field count: Phase A.1 javap output didn't match — re-check Java file.

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "test(phase2a/t-finance): add factories unit tests (7 DTOs incl new MetricResult)" \
  -- tests/python/smartbi_compat/test_analysis_finance_factories.py
```

---

### Task D.4: Verify 0 regression on existing pytest

**Files:** read-only verification

- [ ] **Step 1: Run full smartbi_compat test suite**

```bash
pytest tests/python/smartbi_compat/ -v 2>&1 | tail -50
```

Expected:
- New finance tests pass (factories test passes; contract test FAILs with 404 until G.1 wires router — that's expected)
- All other existing tests (alerts/contract/jwt/etc) pass

If any non-finance test FAILs that was passing on origin/main → escalate. The new finance code shouldn't touch any other module.

- [ ] **Step 2: Capture baseline test count**

```bash
pytest tests/python/smartbi_compat/ --collect-only -q 2>&1 | tail -3
```

Expected: prints something like `N tests collected`. Record N (this is the post-D baseline; G.2 will compare).

- [ ] **Step 3: No commit (verification task)**

---

## D-gate decision point

**Phase D complete; foundation+composite ready to ship.**

Audit decision criterion (per spec §8 + I5):
- If accumulated task count to here ≥ 18 → **STOP STRETCH**, skip Phase E + F, jump to Phase G.
  Payable per-type real impl moves to a follow-up副轨 chat (`phase2a/t-finance-payable`).
- If accumulated task count < 18 AND chat capacity feels healthy → continue Phase E.

To check accumulated count, count completed checkboxes in this plan up to and including D.4.

**Default decision: continue to Phase E if A+B+C+D used ≤ 16 tasks. Otherwise stop.**

---

## Phase E — Payable per-type real impl (STRETCH)

⚠️ Skip this phase if D-gate said STOP. Phase G can wrap up with foundation+composite-only.

### Task E.1: Implement `_query_finance_payable_data` SQL helper

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`

Per Phase A.3 findings — the SQL/JPA query that Java's `getPayableMetrics` and `getPayableAgingChart` use.

- [ ] **Step 1: Inspect Phase A.3 SQL findings + existing pool helper pattern**

Sister sales uses `_query_sales_data` from `smartbi_compat.api.analysis`. Finance writes its own. The shared SQL pool helper:

```bash
grep -n "get_pg_pool\|get_pool\|asyncpg\|psycopg" backend/python/smartbi_compat/*.py backend/python/smartbi/config.py 2>/dev/null | head -10
```

Capture the actual pool acquisition pattern (e.g., `from smartbi.config import get_pg_pool`).

- [ ] **Step 2: Append the SQL helper to analysis_finance.py**

Use Edit tool to add this section after the existing imports/factories/helpers but BEFORE the route handler (i.e., between `_strip_volatile` definition and `_get_finance_overview` stub):

```python


# ============================================================
# Section 6: SQL helpers (payable real impl, Phase E)
# ============================================================


async def _query_finance_payable_data(factory_id: str, end_date: date) -> list[dict]:
    """Query payable rows from <table from A.3> for factory + as-of end_date.

    Java reference: FinanceAnalysisServiceImpl.getPayableMetrics + getPayableAgingChart.
    Data source per Phase A.3: <fill from A.3 finding — e.g., smart_bi_finance_data
    with record_type='PAYABLE'>.

    Returns list of dicts with keys (replace per A.3):
      - amount (Decimal): outstanding payable amount
      - due_date (date): payable due date (for aging bucket calculation)
      - vendor / supplier_name (str, optional): for future sub-grouping
      - record_date (date): record entry date (for as-of filter)

    Returns [] when no data — caller handles empty by emitting empty
    MetricResult list and empty ChartConfig data list.
    """
    from smartbi.config import get_pg_pool   # lazy import to avoid module-load cycle
    pool = await get_pg_pool()

    # SQL TEMPLATE — replace the WHERE clause + columns based on A.3 findings:
    sql = text("""
        SELECT amount, due_date, vendor_name, record_date
        FROM smart_bi_finance_data
        WHERE factory_id = :factory_id
          AND record_type = 'PAYABLE'
          AND record_date <= :end_date
    """)

    async with pool.acquire() as conn:
        result = await conn.execute(sql, {"factory_id": factory_id, "end_date": end_date})
        rows = result.fetchall()

    return [
        {
            "amount": row[0],
            "due_date": row[1],
            "vendor_name": row[2],
            "record_date": row[3],
        }
        for row in rows
    ]
```

⚠️ **The SQL template above is illustrative**. **Replace** the table name / columns / where clauses with the EXACT values from Phase A.3 subagent report. If A.3 found data is in `accounts_payable` table or different schema, the SQL must match.

- [ ] **Step 3: Smoke-test the helper (with mocked pool)**

```bash
python -c "
import sys, asyncio
sys.path.insert(0, 'backend/python')
from datetime import date
from unittest.mock import patch, MagicMock, AsyncMock

# Mock the pool to verify the helper at least imports + has correct signature
mock_pool = MagicMock()
mock_conn = AsyncMock()
mock_conn.execute.return_value.fetchall.return_value = []
mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)

with patch('smartbi.config.get_pg_pool', new=AsyncMock(return_value=mock_pool)):
    from smartbi_compat.api.analysis_finance import _query_finance_payable_data
    result = asyncio.run(_query_finance_payable_data('F999', date(2025,12,31)))
    print('result:', result)
    assert result == [], 'expected empty list from mocked empty pool'
    print('OK SQL helper signature correct')
"
```

Expected: `OK SQL helper signature correct`

If error about `get_pg_pool` not importable → Phase A.3 should have captured the actual path to the pool factory. Adjust import.

- [ ] **Step 4: Commit**

```bash
git status --short
git commit -m "feat(phase2a/t-finance): add _query_finance_payable_data SQL helper (Phase A.3 schema)" \
  -- backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task E.2: Implement `_get_payable_metrics` real impl

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`

- [ ] **Step 1: Replace `_get_payable_metrics` stub (was added in B.5)**

Wait — `_get_payable_metrics` was NOT added in B.5; only the 4 composite stubs were (overview/profitMetrics/costStructure/receivableAging). Add `_get_payable_metrics` as a new function.

Use Edit tool to add this NEW function in the "Section 3: Sub-service stubs" area (or extend with "Section 3b: Payable sub-services real impls"):

```python


# ============================================================
# Section 3b: Payable sub-services (real impls, Phase E)
# ============================================================


async def _get_payable_metrics(factory_id: str, end_date: date) -> list[dict]:
    """REAL impl — returns List[MetricResult] mirroring Java getPayableMetrics.

    Two metrics:
      - AP_BALANCE: 应付余额 (sum of amount where due_date >= end_date OR all outstanding)
      - AP_TURNOVER_DAYS: 应付周转天数 (avg days outstanding)

    AlertLevel logic (per Phase A.3): TBD from Java impl. Default GREEN if balance
    is within tolerance.
    """
    rows = await _query_finance_payable_data(factory_id, end_date)

    if not rows:
        return []

    # AP_BALANCE: sum of amount across all rows
    total_balance = sum((r["amount"] or Decimal("0") for r in rows), Decimal("0"))

    # AP_TURNOVER_DAYS: average days from record_date to end_date
    days_list = [(end_date - r["record_date"]).days for r in rows if r.get("record_date")]
    avg_days = (sum(days_list) / len(days_list)) if days_list else 0

    metrics = [
        _new_metric_result_dict(
            metric_code="AP_BALANCE",
            metric_name="应付余额",
            value=_decimal_to_number(total_balance),
            formatted_value=_format_kpi_value(total_balance, "元"),
            unit="元",
            alert_level="GREEN",  # ← refine per Phase A.3 alert thresholds
        ),
        _new_metric_result_dict(
            metric_code="AP_TURNOVER_DAYS",
            metric_name="应付周转天数",
            value=int(avg_days),
            formatted_value=str(int(avg_days)),
            unit="天",
            alert_level="GREEN",
        ),
    ]

    return metrics
```

- [ ] **Step 2: Smoke test with mocked SQL helper**

```bash
python -c "
import sys, asyncio
sys.path.insert(0, 'backend/python')
from datetime import date
from decimal import Decimal
from unittest.mock import patch, AsyncMock

with patch('smartbi_compat.api.analysis_finance._query_finance_payable_data',
           new=AsyncMock(return_value=[
               {'amount': Decimal('1000'), 'due_date': date(2025,12,15),
                'vendor_name': 'V1', 'record_date': date(2025,11,1)},
               {'amount': Decimal('500'), 'due_date': date(2025,12,20),
                'vendor_name': 'V2', 'record_date': date(2025,11,15)},
           ])):
    from smartbi_compat.api.analysis_finance import _get_payable_metrics
    metrics = asyncio.run(_get_payable_metrics('F999', date(2025,12,31)))
    print('metrics:', metrics)
    assert len(metrics) == 2
    assert metrics[0]['metricCode'] == 'AP_BALANCE'
    assert metrics[0]['value'] == 1500   # 1000+500
    print('OK payable metrics shape')
"
```

Expected: `OK payable metrics shape`

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "feat(phase2a/t-finance): _get_payable_metrics real impl (AP_BALANCE + AP_TURNOVER_DAYS)" \
  -- backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task E.3: Implement `_get_payable_aging_chart` real impl

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`

- [ ] **Step 1: Add the function after `_get_payable_metrics`**

```python


async def _get_payable_aging_chart(factory_id: str, end_date: date) -> dict:
    """REAL impl — returns ChartConfig (PIE) of payable aging distribution.

    Buckets per FinanceAnalysisService constants (confirmed Phase A.3):
      0-30天: due_date >= end_date (not yet due) OR (end_date - due_date).days <= 30
      31-60天: 31 <= overdue_days <= 60
      61-90天: 61 <= overdue_days <= 90
      90天以上: overdue_days > 90

    Aging key per row: (end_date - row.due_date).days; 负数表示未到期 → 0-30 bucket.
    """
    rows = await _query_finance_payable_data(factory_id, end_date)

    buckets = {"0-30天": Decimal("0"), "31-60天": Decimal("0"),
               "61-90天": Decimal("0"), "90天以上": Decimal("0")}

    for row in rows:
        amount = row.get("amount") or Decimal("0")
        due = row.get("due_date")
        if due is None:
            continue
        overdue = (end_date - due).days
        if overdue <= 30:
            buckets["0-30天"] += amount
        elif overdue <= 60:
            buckets["31-60天"] += amount
        elif overdue <= 90:
            buckets["61-90天"] += amount
        else:
            buckets["90天以上"] += amount

    data = [
        {"name": bucket_name, "value": _decimal_to_number(amount)}
        for bucket_name, amount in buckets.items()
        if amount > Decimal("0")   # Java may emit empty buckets too — verify Phase A.3
    ]

    return _new_chart_config_dict(
        chart_type="PIE",
        title="应付账款账龄分布",
        data=data,
        options=None,
    )
```

⚠️ **The empty-bucket emission (`if amount > 0`) is illustrative**. Java may emit ALL 4 buckets even when zero. Phase A.3 should have captured this. **Adjust the condition based on actual Java behavior.**

- [ ] **Step 2: Smoke test**

```bash
python -c "
import sys, asyncio
sys.path.insert(0, 'backend/python')
from datetime import date
from decimal import Decimal
from unittest.mock import patch, AsyncMock

with patch('smartbi_compat.api.analysis_finance._query_finance_payable_data',
           new=AsyncMock(return_value=[
               {'amount': Decimal('100'), 'due_date': date(2025,12,15), 'vendor_name': 'V',
                'record_date': date(2025,12,1)},   # 0-30 bucket
               {'amount': Decimal('500'), 'due_date': date(2025,9,1), 'vendor_name': 'W',
                'record_date': date(2025,8,1)},    # >90 bucket
           ])):
    from smartbi_compat.api.analysis_finance import _get_payable_aging_chart
    chart = asyncio.run(_get_payable_aging_chart('F999', date(2025,12,31)))
    print('chart:', chart)
    assert chart['chartType'] == 'PIE'
    assert chart['title'] == '应付账款账龄分布'
    assert len(chart['data']) == 2   # 0-30 + >90
    print('OK aging chart shape')
"
```

Expected: `OK aging chart shape`

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "feat(phase2a/t-finance): _get_payable_aging_chart real impl (4 aging buckets)" \
  -- backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task E.4: Fill `_get_payable_analysis` composite assembly

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`

- [ ] **Step 1: Replace the `_get_payable_analysis` stub**

Use Edit tool to replace `raise NotImplementedError("filled in Phase E.4")` with:

```python
async def _get_payable_analysis(factory_id: str, start_date: date, end_date: date) -> dict:
    """Java reference: SmartBIAnalysisController.getFinanceAnalysis line 240-241 + 255-258.

    Java put order (LinkedHashMap-friendly via direct put on HashMap):
      startDate / endDate / metrics / agingChart

    Phase F.1 will record F999 payable golden to verify Jackson actual order;
    if it differs from put-order, adjust dict insertion below.
    """
    metrics = await _get_payable_metrics(factory_id, end_date)
    aging_chart = await _get_payable_aging_chart(factory_id, end_date)

    return {
        "startDate": start_date.isoformat(),
        "endDate": end_date.isoformat(),
        "metrics": metrics,
        "agingChart": aging_chart,
    }
```

- [ ] **Step 2: Smoke test composite assembly**

```bash
python -c "
import sys, asyncio
sys.path.insert(0, 'backend/python')
from datetime import date
from unittest.mock import patch, AsyncMock

with patch('smartbi_compat.api.analysis_finance._query_finance_payable_data',
           new=AsyncMock(return_value=[])):
    from smartbi_compat.api.analysis_finance import _get_payable_analysis
    result = asyncio.run(_get_payable_analysis('F999', date(2025,1,1), date(2025,12,31)))
    print('keys:', list(result.keys()))
    assert list(result.keys()) == ['startDate', 'endDate', 'metrics', 'agingChart']
    assert result['startDate'] == '2025-01-01'
    assert result['endDate'] == '2025-12-31'
    assert result['metrics'] == []   # empty SQL → empty metrics
    print('OK payable composite shape')
"
```

Expected: `OK payable composite shape`

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "feat(phase2a/t-finance): _get_payable_analysis composite assembly (4-key shape)" \
  -- backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task E.5: Verify route handler payable branch end-to-end (smoke)

**Files:** read-only verification (route already wired in B.5)

- [ ] **Step 1: Smoke test route handler with `analysisType=payable` parameter**

```bash
python -c "
import sys, asyncio, importlib.util
from pathlib import Path
sys.path.insert(0, 'backend/python')
from datetime import date
from unittest.mock import patch, AsyncMock

# Load production main
main_path = Path('backend/python/main.py')
spec = importlib.util.spec_from_file_location('_production_main', main_path)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
from fastapi.testclient import TestClient
client = TestClient(m.app)

# Mock SQL helper
with patch('smartbi_compat.api.analysis_finance._query_finance_payable_data',
           new=AsyncMock(return_value=[])):
    # No JWT → 401, but routing decision (payable branch) made first
    resp = client.get('/api/mobile/F999/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31&analysisType=payable')
    print('status:', resp.status_code)
    print('body:', resp.text[:200])
"
```

Expected: 401 (auth fail before routing) — confirms route is registered (otherwise 404). If 404, Phase G.1 hasn't wired router yet — proceed to Phase F (test infra) and Phase G (wire) before re-testing.

- [ ] **Step 2: No commit (verification task)**

---

## Phase F — Payable F999 byte gate (STRETCH)

### Task F.1: Record F999 payable golden from test env

**Files:**
- Create: `tests/fixtures/java-smartbi-golden/analysis-finance-F999-payable.json`

- [ ] **Step 1: Curl test env Java with `analysisType=payable`**

```bash
JWT="<F999 JWT from Phase A.5 Step 2>"
curl -s -H "Authorization: Bearer $JWT" \
  "http://47.100.235.168:10011/api/mobile/F999/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31&analysisType=payable" \
  | python -m json.tool > tests/fixtures/java-smartbi-golden/analysis-finance-F999-payable.json
```

- [ ] **Step 2: Inspect data key order**

```bash
python -c "
import json
g = json.load(open('tests/fixtures/java-smartbi-golden/analysis-finance-F999-payable.json'))
print('envelope:', list(g.keys()))
print('data:', list(g['data'].keys()))
"
```

Expected output: data keys like `['startDate', 'endDate', 'metrics', 'agingChart']` — but Jackson HashMap order may differ. **If different**, update `_get_payable_analysis` dict order to match.

- [ ] **Step 3: If golden order ≠ Python order, update `_get_payable_analysis`**

Use Edit tool to reorder dict keys in `_get_payable_analysis` to match golden Step 2 output.

- [ ] **Step 4: Commit golden + (if needed) the reorder**

```bash
git status --short
git commit -m "test(phase2a/t-finance): record F999 payable golden + match dict order" \
  -- tests/fixtures/java-smartbi-golden/analysis-finance-F999-payable.json \
     backend/python/smartbi_compat/api/analysis_finance.py
```

(Drop the second path if `_get_payable_analysis` didn't need reordering.)

---

### Task F.2: Extend contract test with payable byte-shape case

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py`

- [ ] **Step 1: Add `TestAnalysisFinancePayable` test class**

Append after the `TestAnalysisFinanceComposite` class:

```python


class TestAnalysisFinancePayable:
    """F999 byte-shape gate for payable per-type path (analysisType=payable)."""

    def test_f999_payable_byte_shape(self, client, monkeypatch):
        """Hit /api/mobile/F999/smart-bi/analysis/finance?analysisType=payable
        with mocked SQL pool returning empty result.

        Pre-cond:
          - Phase F.1 recorded golden at tests/fixtures/java-smartbi-golden/analysis-finance-F999-payable.json
          - _query_finance_payable_data returns [] for F999
        """
        # Mock SQL helper to return empty (F999 has no payable data)
        async def fake_empty(_factory_id, _end_date):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_payable_data",
            fake_empty,
        )

        token = _f999_jwt()
        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance"
            "?startDate=2025-01-01&endDate=2025-12-31&analysisType=payable",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"

        py_response = resp.json()
        py_stripped = _strip_volatile(py_response)

        golden_path = GOLDEN_DIR / "analysis-finance-F999-payable.json"
        golden = json.loads(golden_path.read_text())
        golden_stripped = _strip_volatile(golden)

        assert py_stripped == golden_stripped, (
            f"BYTE SHAPE MISMATCH (payable)\n"
            f"Python: {json.dumps(py_stripped, indent=2, ensure_ascii=False)[:1000]}\n"
            f"Golden: {json.dumps(golden_stripped, indent=2, ensure_ascii=False)[:1000]}"
        )

    def test_f999_payable_data_keys_order(self, client, monkeypatch):
        """Sanity check — data keys order matches golden."""
        async def fake_empty(_factory_id, _end_date):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_payable_data",
            fake_empty,
        )
        token = _f999_jwt()
        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance"
            "?startDate=2025-01-01&endDate=2025-12-31&analysisType=payable",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        py_data_keys = list(resp.json()["data"].keys())

        golden_path = GOLDEN_DIR / "analysis-finance-F999-payable.json"
        golden_data_keys = list(json.loads(golden_path.read_text())["data"].keys())

        assert py_data_keys == golden_data_keys, (
            f"data key order: python={py_data_keys}, golden={golden_data_keys}"
        )
```

- [ ] **Step 2: Run the new test (will FAIL until G.1 wires router)**

```bash
pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinancePayable -v 2>&1 | tail -20
```

Expected: 404 (route not in main.app) until G.1.

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "test(phase2a/t-finance): extend contract test with payable byte-shape gate" \
  -- tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

### Task F.3: Defer to G.2 verification

Verification of payable byte gate happens in Phase G.2 after router is wired. No work this task.

---

## Phase G — Wrap up

### Task G.1: Wire `analysis_finance.router` into `main.py`

**Files:**
- Modify: `backend/python/main.py`

This is the **shared file** flagged in spec §10.3 + audit I6 — must use `--only` mode to commit.

- [ ] **Step 1: Inspect main.py for sister registration pattern**

```bash
grep -n "analysis_sales\|analysis_finance\|smartbi_compat.api" backend/python/main.py
```

Find where sister sales `analysis.router` (or `analysis_sales.router` once sister pushes) is registered. Mirror that pattern.

```bash
grep -n "include_router" backend/python/main.py | head -10
```

- [ ] **Step 2: Pre-commit safety — check git status BEFORE editing main.py**

```bash
git status --short backend/python/main.py
```

Expected: clean (no unstaged change). If anything shows up that you didn't make → STOP, sister chat may have edited concurrently. Reconcile before proceeding.

- [ ] **Step 3: Edit main.py to add include_router line**

Use Edit tool to add the import + include_router line. Pattern (place near existing smartbi_compat router registrations):

```python
# Add to imports section:
from smartbi_compat.api import analysis_finance

# Add to router registration section:
app.include_router(analysis_finance.router)
```

- [ ] **Step 4: Verify route is now registered in main.app**

```bash
python -c "
import sys; sys.path.insert(0, 'backend/python')
import importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location('m', Path('backend/python/main.py'))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
finance_routes = [r.path for r in m.app.routes if hasattr(r, 'path') and 'finance' in r.path]
print('finance routes registered:', finance_routes)
assert finance_routes, 'route not registered'
"
```

Expected: prints something containing `/api/mobile/{factory_id}/smart-bi/analysis/finance`.

- [ ] **Step 5: Commit using safe-commit.sh (rule 5b — concurrent-edit safety)**

```bash
git status --short                                             # ← double-check before commit
./scripts/safe-commit.sh \
  "feat(phase2a/t-finance): wire analysis_finance.router into main.py" \
  backend/python/main.py
git show --name-only HEAD                                       # ← verify only main.py
```

If safe-commit.sh doesn't exist in this worktree, fall back to:
```bash
git status --short
git commit -m "feat(phase2a/t-finance): wire analysis_finance.router into main.py" \
  -- backend/python/main.py
git show --name-only HEAD                                       # ← MUST show only main.py
```

⚠️ If `git show --name-only HEAD` lists more than `backend/python/main.py` → husky/lint-staged stole files from concurrent session. Soft-reset and retry: `git reset --soft HEAD~1` then re-commit with explicit paths.

---

### Task G.2: Run full pytest suite + verify all byte gates pass

**Files:** read-only verification

- [ ] **Step 1: Run finance contract test (should now PASS)**

```bash
pytest tests/python/smartbi_compat/test_analysis_finance_contract.py -v 2>&1 | tail -30
```

Expected: all tests PASS (composite + payable byte gates if Phase E/F ran). Each test either passes or fails with byte-shape mismatch detail.

- [ ] **Step 2: If any test FAILS — fix by inspecting mismatch**

The byte-shape test prints both Python and Golden side by side on failure. Common fixes:
- Key order: re-order dict in `_get_comprehensive_finance_analysis` or `_get_payable_analysis`
- Field count: check factory has all fields per Java DTO
- Field name typo: e.g., `xaxisField` not `xAxisField` (Jackson lowercase quirk)
- Decimal serialization: ensure `_decimal_to_number(d)` not bare `d` for numeric fields
- Null vs empty: Lombok `@Data` emits null for unset Optional, not absent key

After fix, re-run from Step 1 until pass. Commit fix:
```bash
git commit -m "fix(phase2a/t-finance): byte-shape gate <specific fix>" -- <files>
```

- [ ] **Step 3: Run full smartbi_compat test suite for 0-regress check**

```bash
pytest tests/python/smartbi_compat/ -v 2>&1 | tail -50
```

Compare to Phase D.4 baseline test count + pass count. Expected:
- New finance tests pass (incremental: factories test + composite contract + payable contract if Phase F ran)
- All other tests still pass (0 regress on origin/main baseline)

- [ ] **Step 4: Run factory unit tests separately (sanity)**

```bash
pytest tests/python/smartbi_compat/test_analysis_finance_factories.py -v 2>&1 | tail -20
```

Expected: all factory tests PASS.

- [ ] **Step 5: No commit (verification only). Report findings.**

---

### Task G.3: Final verify report + decide on push to origin

**Files:** read-only

- [ ] **Step 1: Compile commits since worktree creation**

```bash
git log origin/main..HEAD --oneline
```

Expected: list of commits made during this chat. Verify each commit message matches its content (check 1-2 randomly with `git show --stat <SHA>`).

- [ ] **Step 2: Verify no scope creep — files touched should be in expected set**

```bash
git diff origin/main..HEAD --name-only
```

Expected file list (must be subset of):
```
docs/superpowers/specs/2026-04-29-phase2a-analysis-finance-foundation-design.md
docs/superpowers/plans/2026-04-30-phase2a-analysis-finance-foundation.md
backend/python/smartbi_compat/date_range.py            (Phase A.6, if (β) copy)
backend/python/smartbi_compat/api/analysis_finance.py  (Phase B-E)
backend/python/main.py                                  (Phase G.1)
tests/python/smartbi_compat/test_analysis_finance_contract.py    (Phase D.1, F.2)
tests/python/smartbi_compat/test_analysis_finance_factories.py   (Phase D.3)
tests/python/smartbi_compat/test_date_range.py          (Phase A.6, if (α) cherry-pick)
tests/fixtures/java-smartbi-golden/analysis-finance-F999-composite.json   (Phase A.5)
tests/fixtures/java-smartbi-golden/analysis-finance-F999-payable.json     (Phase F.1, stretch)
```

If any other file appears → scope creep, investigate.

- [ ] **Step 2: Generate verify report**

Produce final report covering:
- Phase A complete: T1-T6 findings (subagent reports)
- Phase B-D ship: foundation + composite byte gate PASS
- Phase E-F ship (or DEFERRED): payable per-type byte gate PASS / DEFERRED to phase2a/t-finance-payable副轨
- Phase G complete: router wired, full pytest 0 regress

Report format mirrors sister's per-spec verify reports (see memory `project_apr30_phase2a_sales_foundation_ship.md`).

- [ ] **Step 3: Decide on push to origin (default: NO)**

Per sister precedent + spec §11.2: this branch stays local until full Phase 2A merger or until user explicitly approves push. **Default: do NOT push** — chat ends with `git log` showing local-only commits.

If user explicitly says "push it":
```bash
git push -u origin phase2a/t-finance
```

Otherwise, end chat with:
```bash
git log origin/main..HEAD --oneline
echo "Branch phase2a/t-finance ready locally; not pushed (default per spec §11.2)."
```

---

## Self-Review (run by plan author after writing this plan)

### Spec coverage

Checked each section of `docs/superpowers/specs/2026-04-29-phase2a-analysis-finance-foundation-design.md`:

- §1 In-scope = Plan Phase A-G coverage; Out-of-scope items left to follow-up副轨
- §2 Java reference mapping → Plan Phase A.1-A.3 reads each
- §3 架构 → Plan Phase B.1-B.5 implements
- §4 组件 (DTO factories + helpers + sub-services) → Plan Phase B.2 (factories), B.3 (helpers), B.4 (MetricResult), B.5 (route + stubs), C.1 (real stub bodies), C.2 (composite), E.* (payable real)
- §5 响应形状 → Plan Phase A.5 records golden, C.2 + E.4 dict assemble
- §6 错误处理 → Plan Phase B.5 (route 501 path), Phase C.3 + E.5 (auth handled by `verify_jwt_and_factory`)
- §7 测试 → Plan Phase D.1 (contract), D.3 (factories), F.2 (payable contract), G.2 (verify)
- §8 阶段切分 → Plan mirrors A-G with explicit D-gate
- §9 风险 → Plan E/F marked stretch, D-gate for capacity
- §10 跨轨依赖 → Plan Phase A.6 with α/β fallback
- §11 worktree + git → Plan Pre-flight + commit safety throughout
- §12 不做的 → Plan stays in foundation+composite+payable scope
- §13 DoD → matches plan G.3 final report

**No gap detected.**

### Placeholder scan

Searched for "TBD" / "TODO" / "implement later" — only acceptable instances are Phase A discovery items where the spec already deferred (e.g., A.2 will discover empty-state shape, that's the task itself). No placeholder in implementation steps.

### Type consistency

- DTO factory function names consistent: `_new_<entity>_dict` pattern
- Sub-service names consistent: `_get_<entity>` async functions
- SQL helper: `_query_finance_<entity>_data`
- Helper names: `_to_decimal`, `_decimal_to_number`, `_format_kpi_value`, `_strip_volatile`, `_utc_now_iso`
- Auth: `verify_jwt_and_factory` + `AuthContext` (consistent with sister)

**No inconsistencies detected.**

---

## Plan complete

Plan saved to:
- `.worktrees/phase2a-finance/docs/superpowers/plans/2026-04-30-phase2a-analysis-finance-foundation.md`

Spec at:
- `.worktrees/phase2a-finance/docs/superpowers/specs/2026-04-29-phase2a-analysis-finance-foundation-design.md`

Total tasks: **17 必做 (A.1 + A.2 + A.3 + A.4 + A.5 + A.6 + B.1 + B.2 + B.3 + B.4 + B.5 + C.1 + C.2 + C.3 + D.1 + D.3 + D.4 + G.1 + G.2 + G.3) = 20 必做** + **8 stretch (E.1-E.5 + F.1 + F.2 + F.3) = 28 total**.

D-gate decision: skip stretch if A+B+C+D consumed > 18 tasks.

---

## Execution choice

**Two execution options:**

1. **Subagent-Driven (recommended)** — 我 dispatch fresh subagent per task, review between tasks, fast iteration. Uses `superpowers:subagent-driven-development` skill.

2. **Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch with checkpoints.

哪个？
