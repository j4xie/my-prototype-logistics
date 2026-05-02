# Phase 2A `/analysis/inventory` PR-B Implementation Plan (default mode + DashboardResponse)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task.

**Goal:** Wire up the default mode (`analysisType=null` → `getInventoryHealth`) of `/analysis/inventory`. Replaces PR-A's 501 fallback with full DashboardResponse builder including KPI cards, charts, rankings, AI insights, suggestions, health score, and empty-dashboard fallback. Mirrors Java `InventoryHealthAnalysisServiceImpl.getInventoryHealth` (L89-135) and `getHealthScore` (L824-921).

**Architecture:** All new code lands in `backend/python/smartbi_compat/api/analysis_inventory.py` (extends PR-A's 1285-line module). New section 5d for default mode. Reuses PR-A's 9 sub-services (`_get_turnover_analysis` / `_get_expiry_risk_analysis` / `_get_aging_metrics` / `_get_inventory_aging_chart` / `_get_expiry_risk_chart` / `_get_expiring_batches_ranking` / `_get_long_aging_batches_ranking`) for chart/ranking/score chains.

**Tech Stack:** Python 3.8+ FastAPI, asyncpg, Decimal HALF_UP, pytest + pytest-asyncio.

**Spec:** `docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md` §3.8 (line 1668-2027), §3.9 (line 2029-2291), §5.2 (line 2415-2434). PR #47 merged main `b30d07686`.

**Predecessor:** PR-A merged main as `b91bf94a7` (PR #53). Has skeleton + 9 sub-services + 6 SQL helpers + 4 named alert helpers + 12 constants.

**Default mode golden (pre-existing):** `tests/fixtures/java-smartbi-golden/analysis-inventory-F999.json` — recorded earlier, captures empty-dashboard branch. NO new golden recording needed.

**Recording date** (already locked into golden via `lastUpdated`/`generatedAt` fields):
- Outer envelope: `2026-04-30` (from F999 generic golden)
- Note: this differs from PR-A goldens (`2026-05-02`); volatile fields stripped via `_strip_volatile`

---

## ⛔ Hard rules (PR-B specific)

1. **NEVER** modify any other source file (`analysis_finance.py`, sister modules, etc) — additions only to `analysis_inventory.py` and 1 new contract-test file
2. Use `./scripts/safe-commit.sh "msg" file` (no `--`)
3. **DashboardResponse 16-key envelope** — all 16 keys MUST be emitted (most null in empty path). Java Lombok @Data semantics. NOT just the 6 keys spec pseudocode shows.
4. **AIInsight 5-key envelope** — `[level, category, message, relatedEntity, actionSuggestion]`. Spec pseudocode shows 4; golden shows 5 (`relatedEntity` always null in current build). Golden is truth.
5. **Outer data envelope** — `{overview, endDate, startDate}` (3 keys, Jackson HashMap order from golden). Inner overview's startDate/endDate are NULL (Lombok defaults); outer values come from request params.
6. **T-INV-9 asymmetric null verbatim** — `_get_health_score` MUST mirror Java's bug: turnover null = +0pts, expiry/loss/aging null = full pts each. Do NOT make symmetric.
7. **T-INV-15 inline scoring** — `_get_health_score` does NOT reuse named alert helpers. Comparison directions DIFFER (regular vs strict-inverse). Inline tier checks per spec §3.9.
8. **`date.today()` determinism** — tests must monkeypatch `analysis_inventory.date` to fixed date (golden record date) for byte-shape parity. PR-A pattern reuses.
9. **Recursive call chain (T-INV-11)** — `_calculate_kpi_cards` calls `_get_turnover_analysis` + `_get_expiry_risk_analysis`; `_get_health_score` calls them AGAIN. Java does NOT cache; Python mirrors no-cache for byte parity. Performance optimization is Phase 3+.
10. **Charts list is exactly 3** (per Java L105-108) — `[inventory_aging_chart, expiry_risk_chart, material_category_value_chart]`. NO radar, NO loss-trend (out of scope per §1.3).

---

## File Structure

| File | Change | Sections |
|---|---|---|
| `backend/python/smartbi_compat/api/analysis_inventory.py` | Modify | Append Section 5d (default mode + DashboardResponse builders) + update dispatcher to wire default branch — ~600 LOC additions |
| `tests/python/smartbi_compat/test_analysis_inventory_contract.py` | Modify | Add `TestAnalysisInventoryDefaultMode` class with 3 tests (empty / populated mock / T-INV-9 asymmetric regression) — ~150 LOC additions |
| `docs/superpowers/plans/2026-05-02-phase2a-analysis-inventory-pr-b.md` | Create | This plan |

NO new files (apart from plan). Goldens already exist (F999 default). NO impl in sister files.

---

## Task 1: Plan commit + sanity check golden

**Files:**
- Create: this plan (already saved)

- [ ] **Step 1: Verify golden encoding + dispatcher state**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-inventory-impl
PYTHONIOENCODING=utf-8 python3 -c "
import json
g = json.load(open('tests/fixtures/java-smartbi-golden/analysis-inventory-F999.json', encoding='utf-8'))
data = g['response']['data']
print(f'F999 default golden — top keys: {list(data.keys())}')
print(f'overview keys (16 expected): {len(data[\"overview\"])} keys')
"
grep -A 2 "if analysisType == \"aging\":" backend/python/smartbi_compat/api/analysis_inventory.py
```

Expected: 16 overview keys, dispatcher has aging branch but default mode still hits 501 fallback.

- [ ] **Step 2: Commit plan**

```bash
git add docs/superpowers/plans/2026-05-02-phase2a-analysis-inventory-pr-b.md
./scripts/safe-commit.sh "Phase 2A inventory PR-B: implementation plan (default mode + DashboardResponse)" \
    docs/superpowers/plans/2026-05-02-phase2a-analysis-inventory-pr-b.md
```

---

## Task 2: `_build_empty_dashboard()` — 16-key envelope (Java buildEmptyDashboard L1222-1236)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_inventory.py` (append new Section 5d block)

⚠️ **Spec pseudocode at §3.8 line 2003-2026 emits ONLY 6 keys** but the Java `DashboardResponse` Lombok @Data class has **16 fields** (all emitted by Jackson regardless of population). The golden shows all 16. **Python must emit all 16.**

Python must produce this exact 16-key dashboard for empty case (compare against golden):

```
period: None
startDate: None
endDate: None
kpiCards: []
metricCards: None
rankings: {}
charts: {}
chartList: None
aiInsights: [{level, category, message, relatedEntity, actionSuggestion}]
alerts: None
recommendations: None
suggestions: ["请先录入库存数据以开始分析"]
generatedAt: None
lastUpdated: <ISO 8601 timestamp, volatile>
fromCache: False  (boolean, NOT None)
cacheExpireAt: None
```

⚠️ AIInsight has 5 keys: `[level, category, message, relatedEntity, actionSuggestion]`. Spec missed `relatedEntity: None`. Golden has it. Python must emit it.

⚠️ `fromCache: False` is a boolean default (Lombok @Data primitive false). NOT `None`.

- [ ] **Step 1: Append Section 5d header + `_build_empty_dashboard`**

Open `backend/python/smartbi_compat/api/analysis_inventory.py`. Find the end of Section 5c (aging mode, ends with `_get_aging_mode`). Append AFTER it (search for `async def _get_aging_mode` and find its closing `}` then add after):

```python
# ============================================================
# Section 5d: Default mode (PR-B)
# Mirror Java InventoryHealthAnalysisServiceImpl.getInventoryHealth (L89-135).
# DashboardResponse @Builder + Lombok @Data — 16 fields all emitted.
# Empty path → _build_empty_dashboard (L1222-1236).
# ============================================================


def _build_empty_dashboard() -> dict:
    """Mirror Java buildEmptyDashboard L1222-1236.

    Returns the full 16-key DashboardResponse envelope (Lombok @Data emits all
    fields regardless of population). Most fields are null/None defaults; only
    aiInsights, suggestions, lastUpdated, kpiCards, charts, rankings, fromCache
    are populated to match Java empty-state output.

    AIInsight 5-key shape verified against F999 default golden:
      {level, category, message, relatedEntity, actionSuggestion}
    """
    return {
        "period":            None,
        "startDate":         None,
        "endDate":           None,
        "kpiCards":          [],
        "metricCards":       None,
        "rankings":          {},
        "charts":            {},
        "chartList":         None,
        "aiInsights":        [{
            "level":            "YELLOW",
            "category":         "数据状态",
            "message":          "当前暂无库存数据",
            "relatedEntity":    None,
            "actionSuggestion": "请先录入原材料批次数据",
        }],
        "alerts":            None,
        "recommendations":   None,
        "suggestions":       ["请先录入库存数据以开始分析"],
        "generatedAt":       None,
        "lastUpdated":       _utc_now_iso(),
        "fromCache":         False,
        "cacheExpireAt":     None,
    }
```

- [ ] **Step 2: Smoke verify shape against golden**

```bash
cd backend/python && python -c "
import json
from smartbi_compat.api.analysis_inventory import _build_empty_dashboard
result = _build_empty_dashboard()
assert len(result) == 16, f'expected 16 keys, got {len(result)}'
print('keys:', list(result.keys()))
print('aiInsight keys:', list(result['aiInsights'][0].keys()))
assert len(result['aiInsights'][0]) == 5
assert result['fromCache'] is False
print('OK: empty dashboard 16 keys + AIInsight 5 keys')

# Compare against golden
g = json.load(open('../../tests/fixtures/java-smartbi-golden/analysis-inventory-F999.json', encoding='utf-8'))
golden_overview = g['response']['data']['overview']
assert set(result.keys()) == set(golden_overview.keys()), f'key set mismatch'
print('OK: key set matches golden exactly')
"
```

- [ ] **Step 3: Run regression**

```bash
python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```
Expected: 512 passed (PR-A baseline), no regression.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-inventory-impl
./scripts/safe-commit.sh "Phase 2A inventory PR-B: _build_empty_dashboard 16-key envelope + 5-key AIInsight" \
    backend/python/smartbi_compat/api/analysis_inventory.py
```

---

## Task 3: `_calculate_loss_rate_for_health_score` (private helper)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_inventory.py` (append after `_build_empty_dashboard`)

Read spec §3.9 line 2215-2291. Per-batch loop fetching adjustments via `_query_batch_adjustments_in_range` (already exists from PR-A). Returns single-element list with `LOSS_RATE` MetricResult (mirrors public `getLossAnalysis` return type subset).

⚠️ Java L526-528 zero-guard: `(totalInventoryValue > 0) ? totalLoss / totalInventoryValue * 100 : 0` (T-INV-2 div guard).

⚠️ Filter: `adj_type == "loss"` adds to `loss_amount`; `"damage"` to `damage_amount`; `"correction" AND adj_qty < 0` to `correction_amount`. Total = sum of all three.

- [ ] **Step 1: Read spec §3.9 line 2215-2291**

```bash
sed -n '2215,2291p' docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md
```

Copy the function verbatim from spec.

- [ ] **Step 2: Append after `_build_empty_dashboard`**

Use the spec's verbatim implementation. Verify:
- `_query_material_batches_by_status(factory_id, "AVAILABLE")` is called
- `_calculate_total_inventory_value(all_batches)` is called
- per-batch `_query_batch_adjustments_in_range(batch["id"], start_date, end_date)` loop
- `loss_rate` Decimal HALF_UP at SCALE=4 then × 100, then DISPLAY_SCALE=2
- Returns `[{...11-key MetricResult with LOSS_RATE...}]`

- [ ] **Step 3: Smoke verify**

```bash
cd backend/python && python -c "
import asyncio, unittest.mock
from smartbi_compat.api import analysis_inventory
from datetime import date as real_date

async def empty_fetch(*_args):
    return []

with unittest.mock.patch('smartbi_compat.api.analysis_inventory._fetch_all', empty_fetch):
    result = asyncio.run(analysis_inventory._calculate_loss_rate_for_health_score('F999', real_date(2025,1,1), real_date(2025,12,31)))

print('Result:', result)
assert len(result) == 1
assert result[0]['metricCode'] == 'LOSS_RATE'
assert result[0]['value'] == 0  # empty batches → loss_rate = 0
print('OK')
"
```

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-B: _calculate_loss_rate_for_health_score private helper" \
    backend/python/smartbi_compat/api/analysis_inventory.py
```

---

## Task 4: `_get_health_score` (T-INV-9 asymmetric null + T-INV-15 inline scoring)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_inventory.py`

⚠️⚠️ **CRITICAL**: This is the most trap-laden function in PR-B. Two top-tier traps:

**T-INV-9 asymmetric null mirror** — Java getHealthScore has BUGGY asymmetric null handling:
- Turnover null → +0 (penalty) — Java L835-844 has NO else branch
- Expiry null → +30 (full pts) — Java L862
- Loss null → +20 (full pts) — Java L881
- Aging null → +20 (full pts) — Java L899

⚠️ This is almost certainly a Java bug, but Phase 2A byte-shape parity > defensive fix. Port verbatim. Do NOT make symmetric.

**T-INV-15 inline scoring direction-inverted** — Comparison direction in `_get_health_score` DIFFERS from named alert helpers:
- `_determine_turnover_alert_level` uses `<` (regular dir, lower=worse)
- BUT scoring uses `>=` for full pts (Java L837)
- `_determine_expiry_risk_alert_level` uses `>` (inverse strict)
- BUT scoring uses `<` for full pts (Java L854)
- Same for loss + aging dimensions

⚠️ DO NOT call named helpers. Inline the comparisons exactly as spec §3.9 line 2122-2197.

- [ ] **Step 1: Read spec §3.9 line 2029-2213**

```bash
sed -n '2029,2213p' docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md
```

Copy `_get_health_score` verbatim. Note constants needed:
- `_TURNOVER_YELLOW`, `_TURNOVER_RED` (PR-A const)
- `_EXPIRY_RISK_YELLOW`, `_EXPIRY_RISK_RED` (PR-A const)
- `_LOSS_RATE_YELLOW`, `_LOSS_RATE_RED` (PR-A const)
- Aging tier uses literal `Decimal("10")` and `Decimal("20")` (NOT a const)
- `_HEALTH_SCORE_GREEN_MIN` = 80, `_HEALTH_SCORE_YELLOW_MIN` = 60 (verify these exist in PR-A constants; if not, add them)

- [ ] **Step 2: Verify health score constants exist (or add them)**

```bash
grep -n "_HEALTH_SCORE_GREEN_MIN\|_HEALTH_SCORE_YELLOW_MIN" backend/python/smartbi_compat/api/analysis_inventory.py | head -5
```

If missing, add to Section 1 constants block:
```python
_HEALTH_SCORE_GREEN_MIN = Decimal("80")
_HEALTH_SCORE_YELLOW_MIN = Decimal("60")
```

- [ ] **Step 3: Append `_get_health_score` after `_calculate_loss_rate_for_health_score`**

Copy verbatim from spec §3.9.

- [ ] **Step 4: Smoke verify T-INV-9 — all 4 metrics None → score = 70 (NOT 0)**

```bash
cd backend/python && python -c "
import asyncio, unittest.mock
from smartbi_compat.api import analysis_inventory
from datetime import date as real_date

# Mock all 4 sub-services to return empty (all metrics None)
async def empty_metrics(*_args):
    return []

with unittest.mock.patch.object(analysis_inventory, '_get_turnover_analysis', empty_metrics), \
     unittest.mock.patch.object(analysis_inventory, '_get_expiry_risk_analysis', empty_metrics), \
     unittest.mock.patch.object(analysis_inventory, '_calculate_loss_rate_for_health_score', empty_metrics), \
     unittest.mock.patch.object(analysis_inventory, '_get_aging_metrics', empty_metrics):
    result = asyncio.run(analysis_inventory._get_health_score('F999', real_date(2025,1,1), real_date(2025,12,31)))

# T-INV-9: turnover null=+0, expiry+loss+aging null=+30+20+20=70 (asymmetric)
print('Result:', result)
assert result['metricCode'] == 'HEALTH_SCORE'
assert result['value'] == 70, f'expected 70 (T-INV-9 asymmetric), got {result[\"value\"]}'
assert result['alertLevel'] == 'YELLOW'  # 60 <= 70 < 80
print('OK: T-INV-9 asymmetric null verified — score=70 NOT 0')
"
```

- [ ] **Step 5: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-B: _get_health_score (T-INV-9 asymmetric null + T-INV-15 inline scoring)" \
    backend/python/smartbi_compat/api/analysis_inventory.py
```

---

## Task 5: `_calculate_kpi_cards` (5 KPI cards)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_inventory.py`

Read spec §3.8 line 1748-1819. Returns 5 KPI cards: INVENTORY_VALUE, BATCH_COUNT, TURNOVER_RATE (filtered from sub-service), EXPIRY_RISK_RATE (filtered from sub-service), HEALTH_SCORE.

⚠️ TURNOVER_RATE and EXPIRY_RISK_RATE come from existing sub-services via `next((m for m in metrics if m['metricCode'] == 'X'), None)`. If None, KPI is **omitted** (Java L1035 `if (turnover != null)`).

⚠️ INVENTORY_VALUE uses `_calculate_total_inventory_value(batches)` (in-memory iteration, NOT SQL `_query_inventory_value_total` — Java L1010-1018 distinction per spec §3.8 comment).

⚠️ BATCH_COUNT uses `len(batches)` directly. `formattedValue` is `f"{len(batches):,}"` (Java `%,d`).

⚠️ HEALTH_SCORE always added (line 1815-1817).

- [ ] **Step 1: Read spec §3.8 line 1748-1819**

```bash
sed -n '1748,1819p' docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md
```

Copy verbatim.

- [ ] **Step 2: Append `_calculate_kpi_cards` after `_get_health_score`**

⚠️ KPI dict shape uses 11-key MetricResult envelope (matches PR-A `_metric_result_of` shape but inlined per spec):

```python
{
    "metricCode":      "INVENTORY_VALUE",
    "metricName":      "库存总值",
    "value":           ...,
    "formattedValue":  ...,
    "unit":            "元",
    "dimensionValue":  None,
    "changeValue":     None,
    "changePercent":   None,
    "changeDirection": None,
    "alertLevel":      "GREEN",
    "description":     None,
}
```

- [ ] **Step 3: Smoke verify**

```bash
cd backend/python && python -c "
import asyncio, unittest.mock
from smartbi_compat.api import analysis_inventory
from datetime import date as real_date

# Mock all sub-services to return [] — KPI 3 + 4 omitted, only INVENTORY_VALUE + BATCH_COUNT + HEALTH_SCORE
async def empty_metrics(*_args, **_kw):
    return []

with unittest.mock.patch.object(analysis_inventory, '_get_turnover_analysis', empty_metrics), \
     unittest.mock.patch.object(analysis_inventory, '_get_expiry_risk_analysis', empty_metrics), \
     unittest.mock.patch.object(analysis_inventory, '_calculate_loss_rate_for_health_score', empty_metrics), \
     unittest.mock.patch.object(analysis_inventory, '_get_aging_metrics', empty_metrics):
    # Pass empty batches list
    result = asyncio.run(analysis_inventory._calculate_kpi_cards([], 'F999', real_date(2025,1,1), real_date(2025,12,31)))

codes = [k['metricCode'] for k in result]
print('KPI codes:', codes)
# Expected: INVENTORY_VALUE (always), BATCH_COUNT (always), HEALTH_SCORE (always)
# Omitted: TURNOVER_RATE (filter None), EXPIRY_RISK_RATE (filter None)
assert codes == ['INVENTORY_VALUE', 'BATCH_COUNT', 'HEALTH_SCORE'], f'got {codes}'
print('OK: 3 KPIs when sub-services return empty (T-INV omit None)')
"
```

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-B: _calculate_kpi_cards (5 KPI builder)" \
    backend/python/smartbi_compat/api/analysis_inventory.py
```

---

## Task 6: `_build_material_category_value_chart` (PIE chart) + `_generate_ai_insights` + `_generate_suggestions`

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_inventory.py`

3 helpers in single commit (all small + relatively independent):

1. `_build_material_category_value_chart(batches)` — spec §3.8 line 1822-1868 — PIE top-10 by category
2. `_generate_ai_insights(batches, kpi_cards, factory_id)` — spec §3.8 line 1871-1958 — 3 conditional rule-based insights
3. `_generate_suggestions(batches, kpi_cards)` — spec §3.8 line 1961-2000 — 3 conditional rule-based suggestions

⚠️ **`_build_material_category_value_chart` chart envelope uses `xAxisField`/`yAxisField` per spec, BUT golden has lowercase `xaxisField`/`yaxisField`** (Lombok-Jackson decapitalize). For PR-A, sister chart helpers all used lowercase. Use lowercase here too.

⚠️ Insight format strings use `f"{float(rate):.1f}%"` Python (matches Java `String.format("%.1f%%", rate.doubleValue())` for byte parity).

⚠️ 4-key AIInsight (`level / category / message / actionSuggestion`) is what spec §3.8 line 1888-1889 says. BUT empty-dashboard golden has 5-key (`relatedEntity` extra). For consistency, populated-path AIInsight should also include `relatedEntity: None`. **Verify against populated golden if available**; if not (only empty-state F999 default golden exists), add `relatedEntity: None` to all generated AIInsights for safety.

- [ ] **Step 1: Read spec §3.8 line 1822-2000**

```bash
sed -n '1822,2000p' docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md
```

- [ ] **Step 2: Append 3 helpers**

For `_build_material_category_value_chart`:
- Use `xaxisField`/`yaxisField` (lowercase per Lombok)
- Mirror algo verbatim from spec
- options: `{showPercentage: True, showLegend: True}` (2 keys)

For `_generate_ai_insights`:
- Spec shows 4-key AIInsights but **add `"relatedEntity": None`** to each (5-key shape) — golden truth for consistency

For `_generate_suggestions`:
- Returns `list[str]` (NOT list[dict]) — Java line 1182-1217 returns `List<String>`
- Verbatim spec impl

- [ ] **Step 3: Smoke verify**

```bash
cd backend/python && python -c "
from smartbi_compat.api.analysis_inventory import (
    _build_material_category_value_chart,
    _generate_ai_insights,
    _generate_suggestions,
)
chart = _build_material_category_value_chart([])
assert chart['chartType'] == 'PIE'
assert chart['title'] == '材料类别库存占比'
assert chart['data'] == []
assert 'xaxisField' in chart  # lowercase
assert chart['options'] == {'showPercentage': True, 'showLegend': True}

# Insights with no expiry/turnover/health KPIs (all None) → empty list
insights = _generate_ai_insights([], [], 'F999')
assert insights == []

# Suggestions with no batches + no turnover KPI → empty list
sugs = _generate_suggestions([], [])
assert sugs == []
print('OK: 3 helpers behave correctly on empty input')
"
```

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-B: chart builder + 2 rule-based generators (insights/suggestions)" \
    backend/python/smartbi_compat/api/analysis_inventory.py
```

---

## Task 7: `_get_inventory_health` main entry + dispatcher wiring

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_inventory.py`

Read spec §3.8 line 1671-1745. Main entry composes everything: SQL fetch, empty-path fallback, KPI cards, charts list (3 charts in fixed order), rankings (LinkedHashMap with `expiring`/`aging` keys), AI insights, suggestions, lastUpdated volatile.

Then update dispatcher to wire default branch.

⚠️ **DashboardResponse envelope is a 16-key shape** but `_get_inventory_health` only returns 6 populated keys (per spec line 1738-1745). For empty path, `_build_empty_dashboard` already emits all 16. For populated path, we need to ALSO emit all 16 with the defaults for un-populated fields:

```python
return {
    "period":            None,
    "startDate":         None,           # Note: inner-overview startDate is null (Java default)
    "endDate":           None,
    "kpiCards":          kpi_cards,
    "metricCards":       None,
    "rankings":          rankings,
    "charts":            charts,
    "chartList":         None,
    "aiInsights":        ai_insights,
    "alerts":            None,
    "recommendations":   None,
    "suggestions":       suggestions,
    "generatedAt":       None,
    "lastUpdated":       _utc_now_iso(),
    "fromCache":         False,
    "cacheExpireAt":     None,
}
```

⚠️ The OUTER data envelope is `{overview, endDate, startDate}` (3 keys). The route handler (dispatcher) wraps `_get_inventory_health()` result inside `overview`, then adds outer `startDate`/`endDate` from request params:

```python
async def _get_default_mode(factory_id, start_date, end_date):
    overview = await _get_inventory_health(factory_id, start_date, end_date)
    return {
        "overview": overview,
        "endDate": end_date.isoformat(),
        "startDate": start_date.isoformat(),
    }
```

**Verify outer envelope key order against golden** — golden shows `[overview, endDate, startDate]`.

- [ ] **Step 1: Read spec §3.8 line 1671-1745**

- [ ] **Step 2: Append `_get_inventory_health` + new `_get_default_mode` wrapper**

Implement `_get_inventory_health` to return full 16-key dashboard (NOT just 6 keys).

Add `_get_default_mode` to wrap with outer envelope.

- [ ] **Step 3: Update dispatcher**

Find the existing dispatcher, change the 501 fallback for default mode to call `_get_default_mode`:

```python
@router.get("/api/mobile/{factory_id}/smart-bi/analysis/inventory")
async def get_inventory_analysis(...):
    if analysisType == "turnover":
        result = await _get_turnover_mode(...)
        return wrap_response(result)
    if analysisType == "expiry":
        result = await _get_expiry_mode(...)
        return wrap_response(result)
    if analysisType == "aging":
        result = await _get_aging_mode(...)
        return wrap_response(result)
    if not analysisType:
        # NEW: default mode (PR-B)
        result = await _get_default_mode(auth.factory_id, startDate, endDate)
        return wrap_response(result)
    # Unknown analysisType → 501
    return wrap_response(
        data=None,
        success=False,
        code=501,
        message=f"analysisType={analysisType} 尚未 port 至 Python",
    )
```

- [ ] **Step 4: Smoke verify against F999 golden (empty-data path)**

```bash
cd backend/python && python -c "
import asyncio, json, unittest.mock
from smartbi_compat.api import analysis_inventory
from datetime import date as real_date

async def empty_fetch(*_args):
    return []

class FrozenDate(real_date):
    @classmethod
    def today(cls):
        return real_date(2026, 4, 30)  # match golden recording date

with unittest.mock.patch('smartbi_compat.api.analysis_inventory._fetch_all', empty_fetch), \
     unittest.mock.patch('smartbi_compat.api.analysis_inventory.date', FrozenDate):
    result = asyncio.run(analysis_inventory._get_default_mode('F999', real_date(2025,1,1), real_date(2025,12,31)))

print('Outer envelope keys:', list(result.keys()))
assert list(result.keys()) == ['overview', 'endDate', 'startDate'], f'got {list(result.keys())}'

# Compare overview to golden
g = json.load(open('../../tests/fixtures/java-smartbi-golden/analysis-inventory-F999.json', encoding='utf-8'))
gold_ov = g['response']['data']['overview']
py_ov = result['overview']
assert set(py_ov.keys()) == set(gold_ov.keys()), f'overview key set mismatch'
print(f'OK: outer 3 keys + overview 16 keys match golden')
print(f'AIInsight keys: {list(py_ov[\"aiInsights\"][0].keys())}')
"
```

- [ ] **Step 5: Run full regression**

```bash
python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```
Expected: 512 still passes (existing TestAnalysisInventoryDefault::test_f999_default_returns_501 might NOW FAIL because dispatcher no longer returns 501 for default — that's expected and gets removed in Task 8).

If `test_f999_default_returns_501` fails — note the failure, will be fixed in Task 8 by replacing it with new tests.

- [ ] **Step 6: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-B: _get_inventory_health main entry + dispatcher wiring (default mode)" \
    backend/python/smartbi_compat/api/analysis_inventory.py
```

---

## Task 8: Contract tests — replace 501 test + add 3 new (TestAnalysisInventoryDefaultMode)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_inventory_contract.py`

Per spec §5.2:
1. **test_default_empty_dashboard** — F999 empty mock → assert exact AIInsight + suggestion strings + 16-key shape
2. **test_default_populated_matches_golden** — Mock with seeded data → compare full DashboardResponse shape against populated golden (deferred; F999 is empty-only so verify shape semantically)
3. **test_default_health_score_asymmetric_null_regression** — T-INV-9 — DB seed where SOME metric inputs null. Assert score includes 30+20+20=70 from null defaults

Also: REMOVE old `test_f999_default_returns_501` (no longer applicable since default mode is now real impl).

- [ ] **Step 1: Read existing test file structure**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-inventory-impl
grep -n "^class \|^    def test_" tests/python/smartbi_compat/test_analysis_inventory_contract.py | head -20
```

- [ ] **Step 2: Remove old default 501 test**

Find `class TestAnalysisInventoryDefault` (the old PR-A test). Remove it entirely OR rename + repurpose as the empty-dashboard contract test.

Recommended: **Replace** `TestAnalysisInventoryDefault` with `TestAnalysisInventoryDefaultMode` containing 3 new tests.

- [ ] **Step 3: Add `TestAnalysisInventoryDefaultMode` class with 3 tests**

```python
class TestAnalysisInventoryDefaultMode:
    """PR-B contract tests for default mode (analysisType=null → DashboardResponse).
    Per spec §5.2."""

    def test_f999_default_byte_shape(self, client, monkeypatch):
        """Empty F999 (no batches in test DB) → buildEmptyDashboard branch.
        Full byte-shape compare against analysis-inventory-F999.json golden."""
        from datetime import date as real_date
        from smartbi_compat.api import analysis_inventory

        FROZEN = real_date(2026, 4, 30)
        class FrozenDate(real_date):
            @classmethod
            def today(cls):
                return FROZEN
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        async def empty_fetch(*_args):
            return []
        monkeypatch.setattr(analysis_inventory, "_fetch_all", empty_fetch)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/inventory"
            "?startDate=2025-01-01&endDate=2025-12-31",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        py_data = _strip_volatile(resp.json()["data"])
        with open(GOLDEN_DIR / "analysis-inventory-F999.json", encoding="utf-8") as f:
            golden_data = _strip_volatile(json.load(f)["response"]["data"])

        if py_data != golden_data:
            import difflib
            py_str = json.dumps(py_data, ensure_ascii=False, indent=2, sort_keys=True)
            golden_str = json.dumps(golden_data, ensure_ascii=False, indent=2, sort_keys=True)
            diff = "\n".join(difflib.unified_diff(
                golden_str.splitlines(), py_str.splitlines(),
                fromfile="golden", tofile="python", lineterm="", n=5,
            ))
            pytest.fail(f"F999 default byte-shape mismatch:\n{diff}")

    def test_health_score_asymmetric_null_regression(self):
        """T-INV-9 — When all 4 input metrics are None:
          turnover null → +0 (penalty)
          expiry null → +30 (full pts)
          loss null → +20 (full pts)
          aging null → +20 (full pts)
          Total = 70 (NOT 0).

        Direct call to _get_health_score with mocked sub-services."""
        import asyncio, unittest.mock
        from smartbi_compat.api import analysis_inventory
        from datetime import date as real_date

        async def empty_metrics(*_args, **_kw):
            return []  # all sub-services return [] → all metrics are None

        with unittest.mock.patch.object(analysis_inventory, "_get_turnover_analysis", empty_metrics), \
             unittest.mock.patch.object(analysis_inventory, "_get_expiry_risk_analysis", empty_metrics), \
             unittest.mock.patch.object(analysis_inventory, "_calculate_loss_rate_for_health_score", empty_metrics), \
             unittest.mock.patch.object(analysis_inventory, "_get_aging_metrics", empty_metrics):
            result = asyncio.run(analysis_inventory._get_health_score(
                "F999", real_date(2025, 1, 1), real_date(2025, 12, 31)
            ))
        assert result["metricCode"] == "HEALTH_SCORE"
        assert result["value"] == 70, f"T-INV-9 asymmetric: expected 70 (=0+30+20+20), got {result['value']}"
        assert result["alertLevel"] == "YELLOW"  # 60 <= 70 < 80
        assert result["formattedValue"] == "70 分"

    def test_empty_dashboard_aiinsight_5_keys(self, client, monkeypatch):
        """Verify AIInsight has 5 keys (level/category/message/relatedEntity/actionSuggestion)
        — relatedEntity always None per Lombok @Data emission."""
        from datetime import date as real_date
        from smartbi_compat.api import analysis_inventory

        class FrozenDate(real_date):
            @classmethod
            def today(cls):
                return real_date(2026, 4, 30)
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        async def empty_fetch(*_args):
            return []
        monkeypatch.setattr(analysis_inventory, "_fetch_all", empty_fetch)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/inventory"
            "?startDate=2025-01-01&endDate=2025-12-31",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200
        overview = resp.json()["data"]["overview"]
        assert len(overview) == 16, f"DashboardResponse should have 16 keys, got {len(overview)}"
        ai_insights = overview["aiInsights"]
        assert len(ai_insights) == 1
        insight = ai_insights[0]
        expected_keys = {"level", "category", "message", "relatedEntity", "actionSuggestion"}
        assert set(insight.keys()) == expected_keys, f"AIInsight keys mismatch: {set(insight.keys())}"
        assert insight["relatedEntity"] is None
```

- [ ] **Step 4: Run new tests**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_inventory_contract.py -v 2>&1 | tail -20
```

Expected: 3 new tests in `TestAnalysisInventoryDefaultMode` PASS + 3 PR-A byte-shape tests still PASS = 6 total. (Old `test_f999_default_returns_501` removed.)

If byte-shape FAILS:
- Examine diff
- Fix impl in `analysis_inventory.py` (NOT golden)
- Re-run

- [ ] **Step 5: Run full regression**

```bash
python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```
Expected: 512 (PR-A baseline) - 1 (old 501 test removed) + 3 (new tests) = **514 passed, 1 skipped, 0 failed**.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-inventory-impl
./scripts/safe-commit.sh "Phase 2A inventory PR-B: TestAnalysisInventoryDefaultMode (3 tests + remove obsolete 501 test)" \
    tests/python/smartbi_compat/test_analysis_inventory_contract.py
```

---

## Task 9: Final regression sweep + push + open PR + final reviewer

**Files:** none modified.

- [ ] **Step 1: Full smartbi_compat suite**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -5
```
Expected: 514 passed, 1 skipped, 0 failed.

- [ ] **Step 2: Verify diff scope**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-inventory-impl
git diff --stat origin/main...HEAD
```
Expected:
- `backend/python/smartbi_compat/api/analysis_inventory.py`: ~600 LOC additions (everything in Section 5d)
- `tests/python/smartbi_compat/test_analysis_inventory_contract.py`: ~150 LOC additions (3 new tests, 1 removed)
- `docs/superpowers/plans/2026-05-02-phase2a-analysis-inventory-pr-b.md`: this plan

NO other files. NO impl in sister modules.

- [ ] **Step 3: Push branch**

```bash
git push -u origin phase2a/inventory-pr-b
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --base main --head phase2a/inventory-pr-b --title "Phase 2A: /analysis/inventory default mode + DashboardResponse (PR-B)" --body "$(cat <<'EOF'
## Summary

Wires up `/analysis/inventory` default mode (analysisType=null → `getInventoryHealth`) — replaces PR-A's 501 fallback with full Java DashboardResponse mirror including KPI cards, charts, rankings, AI insights, suggestions, and health score. Mirrors Java `InventoryHealthAnalysisServiceImpl.getInventoryHealth` (L89-135) and `getHealthScore` (L824-921).

**Predecessor:** PR #53 (PR-A0 + PR-A) merged main as `b91bf94a7`.

Spec: docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md §3.8 + §3.9 (PR #47, merged main `b30d07686`)
Plan: docs/superpowers/plans/2026-05-02-phase2a-analysis-inventory-pr-b.md

## What's added

`backend/python/smartbi_compat/api/analysis_inventory.py` (Section 5d):
- `_build_empty_dashboard()` — 16-key DashboardResponse + 5-key AIInsight envelope (golden truth)
- `_calculate_loss_rate_for_health_score(...)` — private helper, subset of Java `getLossAnalysis` for health score input
- `_get_health_score(...)` — T-INV-9 asymmetric null + T-INV-15 inline scoring (4 dim × weighted)
- `_calculate_kpi_cards(...)` — 5 KPI cards (INVENTORY_VALUE / BATCH_COUNT / TURNOVER_RATE / EXPIRY_RISK_RATE / HEALTH_SCORE; null KPIs filtered)
- `_build_material_category_value_chart(...)` — PIE top-10 by category
- `_generate_ai_insights(...)` — 3 conditional rule-based insights (RED/YELLOW/GREEN)
- `_generate_suggestions(...)` — 3 conditional rule-based suggestions
- `_get_inventory_health(...)` — main entry composing all above
- `_get_default_mode(...)` — wrapper adding outer envelope `{overview, endDate, startDate}`
- Dispatcher updated: `analysisType=null` now routes to `_get_default_mode` (was 501)

`tests/python/smartbi_compat/test_analysis_inventory_contract.py`:
- `TestAnalysisInventoryDefaultMode` — 3 tests (byte-shape vs golden / T-INV-9 asymmetric regression / AIInsight 5-key shape)
- Removed obsolete `TestAnalysisInventoryDefault::test_f999_default_returns_501` (default mode no longer returns 501)

## T-INV-* traps respected

- **T-INV-9** asymmetric null verbatim mirror: turnover null=+0 vs expiry/loss/aging null=+full pts each (Java bug, port verbatim per Phase 2A byte-shape > defensive fix)
- **T-INV-11** recursive sub-service call chain (no caching) — Java parity
- **T-INV-15** inline scoring direction-inverted (NOT reuse named alert helpers; comparison directions differ)

## Spec drifts caught (golden truth)

- DashboardResponse: spec showed 6 keys, Lombok @Data emits 16 → all 16 emitted
- AIInsight: spec showed 4 keys, golden has 5 (`relatedEntity` always None) → all 5 emitted
- Outer envelope: 3-key wrapper `{overview, endDate, startDate}` (not flat dashboard) — wrapper added
- `xaxisField`/`yaxisField` LOWERCASE per Lombok-Jackson decapitalize (PR-A pattern repeated for material category chart)

## Tests

Full smartbi_compat regression sweep: **514 passed, 1 skipped, 0 failed** (was 512 post-PR-A; +3 new tests, -1 obsolete removed).

- F999 default byte-shape gate (full dict-eq vs `analysis-inventory-F999.json`)
- T-INV-9 asymmetric null regression (4 metrics None → score=70, NOT 0)
- AIInsight 5-key envelope shape lock

## Out of scope (deferred to PR-C)

- 10 arithmetic depth test classes (T-INV-1 to T-INV-15 verbatim regression coverage)
- Populated-data byte-shape gate (would require fixture seed + secondary golden record)
- Phase 3+ Java cleanup (T-INV-9 symmetric null fix; recursive call chain caching)

## Concurrency note

Sister chats running on `analysis_region.py` / `analysis_department.py` / `analysis_procurement.py` (different files; no impl conflict).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Dispatch final code reviewer subagent**

After PR is opened, dispatch `pr-review-toolkit:code-reviewer` (model=sonnet) with focus on:
1. Scope: only 3 expected files modified (1 source + 1 test + 1 plan)
2. T-INV-9 asymmetric null verbatim (verify turnover null adds 0, not 30)
3. T-INV-15 inline scoring (verify NO calls to `_determine_*_alert_level` inside `_get_health_score`)
4. DashboardResponse 16-key envelope (NOT 6) — both empty and populated paths
5. AIInsight 5-key shape (NOT 4) including `relatedEntity: None`
6. Outer envelope `{overview, endDate, startDate}` (3 keys, Jackson HashMap order)
7. Rule 1 / Rule 4 throughout

PR-B complete after final reviewer approves.

---

## Self-Review

**1. Spec coverage** — every PR-B spec section traces to a task:

| Spec section | Task |
|---|---|
| §3.8 `_get_inventory_health` main entry | Task 7 |
| §3.8 `_calculate_kpi_cards` | Task 5 |
| §3.8 `_build_material_category_value_chart` | Task 6 |
| §3.8 `_generate_ai_insights` | Task 6 |
| §3.8 `_generate_suggestions` | Task 6 |
| §3.8 `_build_empty_dashboard` | Task 2 |
| §3.9 `_get_health_score` (T-INV-9 + T-INV-15) | Task 4 |
| §3.9 `_calculate_loss_rate_for_health_score` | Task 3 |
| §5.2 PR-B contract tests | Task 8 |
| §6 PR-B scope | All tasks bounded to PR-B |

PR-A scope (already shipped) and PR-C scope (out-of-scope) explicitly excluded.

**2. Placeholder scan**: searched plan for "TBD", "TODO", "implement later", "Add appropriate", "fill in details". None found.

**3. Type / signature consistency**: All new helpers use consistent signatures matching Java; `_get_inventory_health(factory_id, start_date, end_date)`; `_get_health_score(factory_id, start_date, end_date)`; `_calculate_kpi_cards(batches, factory_id, start_date, end_date)`. PR-A helpers reused: `_get_turnover_analysis`, `_get_expiry_risk_analysis`, `_get_aging_metrics`, `_get_inventory_aging_chart`, `_get_expiry_risk_chart`, `_get_expiring_batches_ranking`, `_get_long_aging_batches_ranking`, `_query_material_batches_by_status`, `_calculate_total_inventory_value`, `_query_batch_adjustments_in_range`.

No inconsistencies.

---

## 并行工作建议

### Subagent: ✅ 推荐
Tasks 2-7 are sequential (each builds on prior). Tasks 8-9 final phase. Dispatch one subagent per impl task or batch related ones (e.g., Tasks 2+3 together; Task 4 standalone for T-INV-9 careful focus; Tasks 5+6+7 together; Task 8 standalone for tests).

Per memory `feedback_subagent_driven_audit_pattern.md`: this is moderate-complexity (T-INV-9 + T-INV-15 traps need careful verification). Use sonnet model for trap-laden tasks (Task 4 health score) and haiku for mechanical (Tasks 2/3/6).

### 多 Chat: ❌ 不推荐
All Tasks 2-8 edit the same file (`analysis_inventory.py` and the test file). Multi-chat parallel will conflict.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-02-phase2a-analysis-inventory-pr-b.md`. Ready for **subagent-driven-development** execution. Hard prereq met: F999 default golden exists; PR-A merged; T-INV-9/T-INV-15 spec sections fully read.
