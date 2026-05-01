# Phase 2A `/analysis/finance` 3 sub-endpoints port — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port 3 finance sub-endpoints (`/budget-achievement`, `/yoy-mom`, `/category-comparison`) from Java to Python with byte-shape parity. Adds 13 new functions, 6 goldens, 19 tests in single PR.

**Architecture:** Extend `backend/python/smartbi_compat/api/analysis_finance.py` with 4 helpers + 4 impl funcs + 4 yoy-mom calculate variants + 1 sales aggregator + 3 route handlers. Reuses existing `_query_finance_data` (PR-A) + `_query_finance_sales_fallback` (PR-B + hotfix) + chart factory dicts. F999 byte gate per endpoint + arithmetic depth unit tests.

**Tech Stack:** FastAPI route handlers, asyncpg via existing helpers, pytest + monkeypatch + asyncio.run for direct unit tests.

**Spec:** `docs/superpowers/specs/2026-04-30-phase2a-finance-sub-endpoints-design.md`

**Java reference root:** `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/FinanceAnalysisServiceImpl.java`

**Branch:** `phase2a/finance-sub-endpoints` (worktree: `.worktrees/phase2a-finance-sub-endpoints`)

**Base:** `origin/main` HEAD `fb92f4b01` (PR #25 cost merged)

**Out of scope:** Other analysis endpoints (department / region / etc); T6 nginx cutover; strict-byte gate; F001 CI tests.

---

## Concurrent-edit safety

Sister chats may modify `analysis_finance.py` concurrently. ALWAYS use `./scripts/safe-commit.sh "msg" path1 path2` (per `.claude/rules/concurrent-edit-safety.md` rule 5b).

---

## Phase A — Helpers + module-level imports

### Task A.1: Move `import calendar` to module level

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py:60` (existing inline `import calendar` in `_infer_granularity`)

Currently `import calendar` is buried inline in `_infer_granularity` line 60. We need it at module level for new helpers (`_get_metric_value_for_period` + `_get_metric_value_for_quarter` use `calendar.monthrange`).

- [ ] **Step 1: Locate inline import**

```bash
grep -n "^import calendar\|^    import calendar\|^        import calendar" backend/python/smartbi_compat/api/analysis_finance.py
```

Expected: 1 hit at line 60 (inline).

- [ ] **Step 2: Add to module-level imports + delete inline**

In `backend/python/smartbi_compat/api/analysis_finance.py`, find the import block at the top (lines 27-32):

```python
import logging
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional
```

Add `import calendar` after `import logging`:

```python
import calendar
import logging
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional
```

Delete the inline `import calendar` inside `_infer_granularity` (line ~60).

- [ ] **Step 3: Run pytest baseline**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: 244 passed (baseline).

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "refactor(phase2a/sub-endpoints): move 'import calendar' to module level" \
  backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task A.2: Add 4 budget-achievement helpers

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (add 4 helpers after existing `_format_currency` ~line 332-365)

Helpers: `_get_budget_amount_by_metric` / `_get_actual_amount_by_metric` / `_determine_budget_achievement_alert` / `_get_metric_display_name`.

- [ ] **Step 1: Locate insertion point**

```bash
grep -n "^def _format_currency\|^def _determine_gross_margin_alert" backend/python/smartbi_compat/api/analysis_finance.py
```

Expected: `_format_currency` line ~332. Insert helpers AFTER the closing `}` of `_format_currency` (before `_determine_gross_margin_alert`).

- [ ] **Step 2: Insert helpers**

```python
def _get_budget_amount_by_metric(record: dict, metric: str) -> Decimal:
    """Mirror Java FinanceAnalysisServiceImpl.getBudgetAmountByMetric (line 1716-1749).

    Java fall-through: switch case has inner `if category contains keyword: return; break;`
    but `break` exits switch and falls through to outer `return data.getBudgetAmount()` at
    line 1748. So function ALWAYS returns budget_amount regardless of category match —
    keyword filter is dead code in Java. Mirror this literally.

    `metric` parameter accepted but unused (Java parity, future-proof).
    """
    if record.get("budget_amount") is None:
        return Decimal("0")
    return _to_decimal(record["budget_amount"])


def _get_actual_amount_by_metric(record: dict, metric: str) -> Decimal:
    """Mirror Java FinanceAnalysisServiceImpl.getActualAmountByMetric (line 1754-1786).

    Same Java fall-through behavior as _get_budget_amount_by_metric — always returns
    actual_amount regardless of category match.
    """
    if record.get("actual_amount") is None:
        return Decimal("0")
    return _to_decimal(record["actual_amount"])


def _determine_budget_achievement_alert(achievement_rate: Decimal) -> str:
    """Mirror Java FinanceAnalysisServiceImpl.determineBudgetAchievementAlertLevel
    (line 1794-1799).

      v > 120  → RED   (超支严重)
      v > 100  → YELLOW (略有超支)
      v <= 100 → GREEN  (正常)

    Boundary: exactly 100 → GREEN; exactly 120 → YELLOW.
    """
    v = float(achievement_rate)
    if v > 120:
        return "RED"
    if v > 100:
        return "YELLOW"
    return "GREEN"


def _get_metric_display_name(metric: Optional[str]) -> str:
    """Mirror Java FinanceAnalysisServiceImpl.getMetricDisplayName (line 1804-1820)."""
    if metric is None:
        return "综合"
    return {
        "revenue": "收入",
        "cost": "成本",
        "expense": "费用",
        "profit": "利润",
        "gross_margin": "毛利率",
    }.get(metric.lower(), "综合")
```

- [ ] **Step 3: Run pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: 244 passed.

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/sub-endpoints): add 4 budget-achievement helpers" \
  backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task A.3: Add `_safe_growth_rate` + `_calculate_metric_from_sales`

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (add after A.2 helpers)

- [ ] **Step 1: Insert after `_get_metric_display_name`**

```python
def _safe_growth_rate(current: Decimal, base: Decimal) -> Decimal:
    """Mirror Java growth rate formula at FinanceAnalysisServiceImpl.calculateMonthYoYMoM
    line 1839-1850 etc. Returns scale=4 Decimal.

    (current - base) / base * 100 with ROUND_HALF_UP, or Decimal("0") when base <= 0.
    """
    if base > Decimal("0"):
        return ((current - base) / base * Decimal("100")).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
    return Decimal("0")


def _calculate_metric_from_sales(sales_rows: list[dict], metric: str) -> Decimal:
    """Mirror Java FinanceAnalysisServiceImpl.calculateMetricFromSales (line 2040-2065).

    Pre-aggregates total_revenue + total_cost from sales_rows, then dispatches:
      revenue       → total_revenue
      profit        → total_revenue - total_cost
      gross_margin  → (rev - cost) / rev * 100, scale=4 (or 0 if rev=0)
      default       → total_revenue
    """
    metric_lower = (metric or "").lower()

    total_revenue = sum(
        (
            _to_decimal(r["amount"])
            for r in sales_rows
            if r.get("amount") is not None
        ),
        Decimal("0"),
    )
    # Java line 2046-2049: NO .abs() (unlike profit metrics path)
    total_cost = sum(
        (
            _to_decimal(r["cost"])
            for r in sales_rows
            if r.get("cost") is not None
        ),
        Decimal("0"),
    )

    if metric_lower == "revenue":
        return total_revenue
    if metric_lower == "profit":
        return total_revenue - total_cost
    if metric_lower == "gross_margin":
        if total_revenue > Decimal("0"):
            return (
                (total_revenue - total_cost) / total_revenue * Decimal("100")
            ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        return Decimal("0")
    # default
    return total_revenue
```

- [ ] **Step 2: Run pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: 244 passed.

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/sub-endpoints): add _safe_growth_rate + _calculate_metric_from_sales" \
  backend/python/smartbi_compat/api/analysis_finance.py
```

---

## Phase B — Budget achievement (impl + golden + 4 tests)

### Task B.1: Implement `_get_budget_achievement_chart` + route handler

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (add impl after A.3 helpers; add route in route handler section ~line 820)

- [ ] **Step 1: Add impl function**

Insert after `_calculate_metric_from_sales` (from A.3):

```python
async def _get_budget_achievement_chart(
    factory_id: str, year: int, metric: str = "revenue"
) -> dict:
    """Mirror Java FinanceAnalysisServiceImpl.getBudgetAchievementChart (line 1121-1195).

    Always emits 12 month entries (Java line 1132-1135 pre-fills with zeros).
    """
    start_date = date(year, 1, 1)
    end_date = date(year, 12, 31)

    budget_data = await _query_finance_data(
        factory_id, "BUDGET", start_date, end_date
    )

    # Java line 1131-1135: TreeMap of 12 months pre-filled [budget=0, actual=0]
    monthly_data: dict[int, list[Decimal]] = {
        m: [Decimal("0"), Decimal("0")] for m in range(1, 13)
    }

    for record in budget_data:
        if record.get("record_date") is None:
            continue
        month = record["record_date"].month
        monthly_data[month][0] += _get_budget_amount_by_metric(record, metric)
        monthly_data[month][1] += _get_actual_amount_by_metric(record, metric)

    chart_data: list[dict] = []
    for month in range(1, 13):
        budget = monthly_data[month][0]
        actual = monthly_data[month][1]
        if budget > Decimal("0"):
            achievement_rate = (
                actual / budget * Decimal("100")
            ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        else:
            achievement_rate = Decimal("0")
        # Note: alert uses scale=4 value (precision matters at boundary)
        alert_level = _determine_budget_achievement_alert(achievement_rate)

        chart_data.append({
            "month": f"{month}月",
            "budget": _decimal_to_number(budget.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "actual": _decimal_to_number(actual.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "achievementRate": _decimal_to_number(achievement_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "variance": _decimal_to_number((actual - budget).quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "alertLevel": alert_level,
        })

    metric_name = _get_metric_display_name(metric)

    # Map.of(4) Jackson hash order: golden recording verifies (Phase B.2)
    options = {
        "yAxis": [
            _new_yaxis_entry(name="金额", position="left"),
            {"name": "达成率(%)", "position": "right", "min": 0, "max": 150},
        ],
        "series": [
            {"color": "#5470c6", "name": "预算", "type": "bar", "yAxisIndex": 0},
            {"color": "#91cc75", "name": "实际", "type": "bar", "yAxisIndex": 0},
            {"color": "#ee6666", "name": "达成率", "type": "line", "yAxisIndex": 1},
        ],
        "referenceLine": {"value": 100, "label": "目标线"},
    }

    return _new_chart_config_dict(
        chart_type="LINE_BAR",
        title=f"{year}年{metric_name}预算达成分析",
        series_field="metric",
        data=chart_data,
        options=options,
        xaxis_field="month",
        yaxis_field="budget",
    )
```

- [ ] **Step 2: Add route handler**

Find the existing `@router.get("/api/mobile/{factory_id}/smart-bi/analysis/finance")` route (~line 820) and add IMMEDIATELY after it (before any `else`/closing):

```python
@router.get("/api/mobile/{factory_id}/smart-bi/analysis/finance/budget-achievement")
async def get_budget_achievement(
    factory_id: str,
    year: int = Query(...),
    metric: str = Query("revenue"),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Java reference: SmartBIAnalysisController.getBudgetAchievementChart line 276-292."""
    result = await _get_budget_achievement_chart(auth.factory_id, year, metric)
    return wrap_response(result)
```

- [ ] **Step 3: Run pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: 244 passed (no test exercises new route yet).

- [ ] **Step 4: Smoke via TestClient (mock DB)**

```bash
cd backend/python && python -c "
import os
os.environ['JWT_SECRET'] = 'test-secret-for-phase2a-do-not-use-in-prod'
import sys
sys.path.insert(0, '.')
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location('m', 'main.py')
m = module_from_spec(spec); spec.loader.exec_module(m)

from fastapi.testclient import TestClient
import jwt, time
tok = jwt.encode({'userId':1,'username':'t','factoryId':'F999','role':'factory_super_admin','exp':int(time.time())+3600}, 'test-secret-for-phase2a-do-not-use-in-prod', algorithm='HS256')

import smartbi_compat.api.analysis_finance as af
async def fake(*a, **k): return []
af._query_finance_data = fake

c = TestClient(m.app)
r = c.get('/api/mobile/F999/smart-bi/analysis/finance/budget-achievement?year=2025&metric=revenue', headers={'Authorization': f'Bearer {tok}'})
print('status:', r.status_code)
body = r.json()
print('success:', body.get('success'))
print('chartType:', body.get('data', {}).get('chartType'))
print('data length:', len(body.get('data', {}).get('data', [])))
print('1st month:', body.get('data', {}).get('data', [{}])[0])
"
```

Expected:
```
status: 200
success: True
chartType: LINE_BAR
data length: 12
1st month: {'month': '1月', 'budget': 0, 'actual': 0, 'achievementRate': 0, 'variance': 0, 'alertLevel': 'GREEN'}
```

- [ ] **Step 5: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/sub-endpoints): _get_budget_achievement_chart impl + route" \
  backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task B.2: Record F999 + F001 budget-achievement goldens

**Files:**
- Create: `tests/fixtures/java-smartbi-golden/analysis-finance-F999-budget-achievement.json`
- Create: `tests/fixtures/java-smartbi-golden/analysis-finance-F001-budget-achievement.json`

Requires SSH tunnel `127.0.0.1:10011` open (PR-A used same setup). Verify first:

- [ ] **Step 1: Verify tunnel**

```bash
curl -sS --max-time 3 http://127.0.0.1:10011/api/mobile/health 2>&1 | head -3
```

Expected: `{"status":"UP",...}`. If timeout → escalate BLOCKED.

- [ ] **Step 2: Record F999**

```bash
JWT_SECRET="$(ssh root@47.100.235.168 'grep ^JWT_SECRET= /www/wwwroot/cretas/.env.test | cut -d= -f2-')" \
  BASE_URL_OVERRIDE="http://127.0.0.1:10011" \
  ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/analysis/finance/budget-achievement?year=2025&metric=revenue' \
    analysis-finance-F999-budget-achievement.json
```

- [ ] **Step 3: Verify F999 shape**

```bash
python3 -c "
import json
with open('tests/fixtures/java-smartbi-golden/analysis-finance-F999-budget-achievement.json') as f:
    g = json.load(f)
data = g['data']
print('chartType:', data.get('chartType'))
print('data length:', len(data.get('data', [])))
print('1st point keys:', list(data.get('data', [{}])[0].keys()))
print('options keys:', list(data.get('options', {}).keys()))
print('yAxis[0] keys:', list(data.get('options', {}).get('yAxis', [{}])[0].keys()))
print('yAxis[1] keys:', list(data.get('options', {}).get('yAxis', [{}, {}])[1].keys()))
print('series[0] keys:', list(data.get('options', {}).get('series', [{}])[0].keys()))
print('referenceLine keys:', list(data.get('options', {}).get('referenceLine', {}).keys()))
"
```

Expected: `chartType: LINE_BAR`, `data length: 12`, `1st point keys: [month, budget, actual, achievementRate, variance, alertLevel]`, options keys = `[yAxis, series, referenceLine]`, yAxis[1] keys 4 entries (Map.of(4) hash order), series[0] keys 4 entries.

**CRITICAL**: Note the actual key order shown for `yAxis[1]` and `series[0]` — if it differs from B.1's spec dict literal, fix the impl in B.1 to match.

- [ ] **Step 4: Record F001**

```bash
JWT_SECRET="$(ssh root@47.100.235.168 'grep ^JWT_SECRET= /www/wwwroot/cretas/.env.test | cut -d= -f2-')" \
  BASE_URL_OVERRIDE="http://127.0.0.1:10011" \
  ./scripts/record-java-golden.sh F001 \
    '/api/mobile/{factoryId}/smart-bi/analysis/finance/budget-achievement?year=2025&metric=revenue' \
    analysis-finance-F001-budget-achievement.json
```

- [ ] **Step 5: If B.2 step 3 found Map.of(4) order divergence, fix B.1 impl**

Read the actual golden order:

```bash
python3 -c "
import json
g = json.load(open('tests/fixtures/java-smartbi-golden/analysis-finance-F999-budget-achievement.json'))
print('yAxis[1]:', list(g['data']['options']['yAxis'][1].keys()))
print('series[0]:', list(g['data']['options']['series'][0].keys()))
"
```

If order differs from spec (e.g., golden shows `[name, position, min, max]` but spec wrote `[name, position, min, max]` — match!), use Edit tool to update `_get_budget_achievement_chart` in `backend/python/smartbi_compat/api/analysis_finance.py` to match golden order. Then re-run pytest 244.

- [ ] **Step 6: Commit goldens**

```bash
git add tests/fixtures/java-smartbi-golden/analysis-finance-F999-budget-achievement.json \
        tests/fixtures/java-smartbi-golden/analysis-finance-F001-budget-achievement.json
./scripts/safe-commit.sh "test(phase2a/sub-endpoints): record F999+F001 budget-achievement goldens" \
  tests/fixtures/java-smartbi-golden/analysis-finance-F999-budget-achievement.json \
  tests/fixtures/java-smartbi-golden/analysis-finance-F001-budget-achievement.json
```

If B.5 above modified `analysis_finance.py`, include it in the same commit.

---

### Task B.3: Add `TestBudgetAchievementChart` (2 byte gate + 4 unit tests)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py` (append at end of file)

- [ ] **Step 1: Append test class**

```python


class TestBudgetAchievementChart:
    """F999 byte-shape gate + arithmetic depth tests for /budget-achievement."""

    def test_f999_budget_achievement_data_keys_match_golden(self, client, monkeypatch):
        """Sanity: data keys order matches Java golden."""
        async def fake_finance_empty(_factory_id, _record_type, _start, _end):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_data",
            fake_finance_empty,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance/budget-achievement"
            "?year=2025&metric=revenue",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        py_data_keys = list(resp.json()["data"].keys())

        with io.open(GOLDEN_DIR / "analysis-finance-F999-budget-achievement.json", encoding="utf-8") as f:
            golden_data_keys = list(json.load(f)["data"].keys())

        assert py_data_keys == golden_data_keys, (
            f"data key order mismatch:\n  python: {py_data_keys}\n  golden: {golden_data_keys}"
        )

    def test_f999_budget_achievement_byte_shape(self, client, monkeypatch):
        """Full byte-shape compare on data block for empty F999."""
        async def fake_finance_empty(_factory_id, _record_type, _start, _end):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_data",
            fake_finance_empty,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance/budget-achievement"
            "?year=2025&metric=revenue",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200

        py_data = _strip_volatile(resp.json()["data"])
        with io.open(GOLDEN_DIR / "analysis-finance-F999-budget-achievement.json", encoding="utf-8") as f:
            golden_data = _strip_volatile(json.load(f)["data"])

        if py_data != golden_data:
            diffs = {}
            for k in set(py_data.keys()) | set(golden_data.keys()):
                if py_data.get(k) != golden_data.get(k):
                    diffs[k] = {"python": py_data.get(k), "golden": golden_data.get(k)}
            pytest.fail(
                f"BYTE SHAPE MISMATCH (budget-achievement) on {list(diffs.keys())}\n"
                f"{json.dumps(diffs, indent=2, ensure_ascii=False)[:2000]}"
            )

    def _run_chart(self, fake_finance):
        """Call _get_budget_achievement_chart directly via asyncio."""
        import asyncio
        from smartbi_compat.api import analysis_finance as af
        original = af._query_finance_data
        try:
            af._query_finance_data = fake_finance
            return asyncio.run(af._get_budget_achievement_chart("F", 2025, "revenue"))
        finally:
            af._query_finance_data = original

    def test_budget_amount_always_returned_regardless_of_category(self):
        """audit I-5 fix: Java fall-through returns budget_amount regardless of category match."""
        from datetime import date as d
        from decimal import Decimal
        async def fake(_fid, rt, _s, _e):
            return [
                {"record_date": d(2025, 6, 1), "category": "其他类",
                 "budget_amount": Decimal("100"), "actual_amount": Decimal("80")},
            ]
        chart = self._run_chart(fake)
        # June (idx 5) should have budget=100, actual=80 even though category is non-matching
        june = chart["data"][5]
        assert june["month"] == "6月"
        assert june["budget"] == 100
        assert june["actual"] == 80

    def test_alert_level_thresholds(self):
        """Verify >120 RED, >100 YELLOW, else GREEN."""
        from datetime import date as d
        from decimal import Decimal

        # Rate = 130 (>120) → RED
        async def fake_red(_fid, _rt, _s, _e):
            return [{"record_date": d(2025, 1, 1), "category": "x",
                     "budget_amount": Decimal("100"), "actual_amount": Decimal("130")}]
        chart = self._run_chart(fake_red)
        assert chart["data"][0]["alertLevel"] == "RED"

        # Rate = 110 (>100, <=120) → YELLOW
        async def fake_yellow(_fid, _rt, _s, _e):
            return [{"record_date": d(2025, 1, 1), "category": "x",
                     "budget_amount": Decimal("100"), "actual_amount": Decimal("110")}]
        chart = self._run_chart(fake_yellow)
        assert chart["data"][0]["alertLevel"] == "YELLOW"

        # Rate = 100 (=100) → GREEN
        async def fake_green(_fid, _rt, _s, _e):
            return [{"record_date": d(2025, 1, 1), "category": "x",
                     "budget_amount": Decimal("100"), "actual_amount": Decimal("100")}]
        chart = self._run_chart(fake_green)
        assert chart["data"][0]["alertLevel"] == "GREEN"

    def test_zero_budget_zero_achievement_rate(self):
        """budget=0 → rate=0 (avoid div0) per Java line 1158-1160."""
        from datetime import date as d
        from decimal import Decimal
        async def fake(_fid, _rt, _s, _e):
            return [{"record_date": d(2025, 6, 1), "category": "x",
                     "budget_amount": Decimal("0"), "actual_amount": Decimal("50")}]
        chart = self._run_chart(fake)
        june = chart["data"][5]
        assert june["budget"] == 0
        assert june["actual"] == 50
        assert june["achievementRate"] == 0

    def test_always_emits_12_months(self):
        """Per Java line 1132-1135: pre-fill all 12 months even with 0 records."""
        async def fake_empty(*_): return []
        chart = self._run_chart(fake_empty)
        assert len(chart["data"]) == 12
        for i, point in enumerate(chart["data"], start=1):
            assert point["month"] == f"{i}月"
            assert point["budget"] == 0
            assert point["actual"] == 0
            assert point["alertLevel"] == "GREEN"
```

- [ ] **Step 2: Run new tests**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_contract.py::TestBudgetAchievementChart -v
```

Expected: 6/6 pass.

If `test_f999_budget_achievement_byte_shape` fails, paste the diff output. Most likely cause: Map.of(4) order divergence in yAxis[1] or series. Fix `_get_budget_achievement_chart` to match golden order.

- [ ] **Step 3: Run full pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: 250 passed (244 + 6 new).

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "test(phase2a/sub-endpoints): TestBudgetAchievementChart 2 byte gate + 4 unit tests" \
  tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

## Phase C — Yoy-mom (impl + golden + 6 tests)

### Task C.1: Add `_get_metric_value_for_period` + `_get_metric_value_for_quarter`

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (add after Phase A helpers)

- [ ] **Step 1: Add helpers**

Insert after `_calculate_metric_from_sales` (from A.3):

```python
async def _get_metric_value_for_period(
    factory_id: str, year_month: tuple[int, int], metric: str
) -> Decimal:
    """Mirror Java FinanceAnalysisServiceImpl.getMetricValueForPeriod (line 1970-2000).

    3 distinct branches by data source (audit C-1 fix):
      revenue / profit / gross_margin → smart_bi_sales_data via _query_finance_sales_fallback
      cost / expense                  → smart_bi_finance_data RecordType.COST, sum total_cost
      default                         → smart_bi_sales_data, sum amount
    """
    year, month = year_month
    last_day = calendar.monthrange(year, month)[1]
    start_date = date(year, month, 1)
    end_date = date(year, month, last_day)

    metric_lower = (metric or "").lower()

    if metric_lower in ("revenue", "profit", "gross_margin"):
        sales_rows = await _query_finance_sales_fallback(factory_id, start_date, end_date)
        return _calculate_metric_from_sales(sales_rows, metric_lower)

    if metric_lower in ("cost", "expense"):
        cost_records = await _query_finance_data(factory_id, "COST", start_date, end_date)
        # Java line 1987-1990: sum total_cost (NOT actual_amount)
        return sum(
            (
                _to_decimal(r["total_cost"])
                for r in cost_records
                if r.get("total_cost") is not None
            ),
            Decimal("0"),
        )

    # Default: sum amount from sales (Java line 1991-1998)
    sales_rows = await _query_finance_sales_fallback(factory_id, start_date, end_date)
    return sum(
        (
            _to_decimal(r["amount"])
            for r in sales_rows
            if r.get("amount") is not None
        ),
        Decimal("0"),
    )


async def _get_metric_value_for_quarter(
    factory_id: str, year: int, quarter: int, metric: str
) -> Decimal:
    """Mirror Java FinanceAnalysisServiceImpl.getMetricValueForQuarter (line 2005-2035).

    Same 3-branch structure as _get_metric_value_for_period, with quarter date math.
    """
    start_month = (quarter - 1) * 3 + 1
    end_month = quarter * 3
    last_day = calendar.monthrange(year, end_month)[1]
    start_date = date(year, start_month, 1)
    end_date = date(year, end_month, last_day)

    metric_lower = (metric or "").lower()

    if metric_lower in ("revenue", "profit", "gross_margin"):
        sales_rows = await _query_finance_sales_fallback(factory_id, start_date, end_date)
        return _calculate_metric_from_sales(sales_rows, metric_lower)

    if metric_lower in ("cost", "expense"):
        cost_records = await _query_finance_data(factory_id, "COST", start_date, end_date)
        return sum(
            (
                _to_decimal(r["total_cost"])
                for r in cost_records
                if r.get("total_cost") is not None
            ),
            Decimal("0"),
        )

    sales_rows = await _query_finance_sales_fallback(factory_id, start_date, end_date)
    return sum(
        (
            _to_decimal(r["amount"])
            for r in sales_rows
            if r.get("amount") is not None
        ),
        Decimal("0"),
    )
```

- [ ] **Step 2: Run pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: 250 passed (no caller yet).

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/sub-endpoints): _get_metric_value_for_period + _quarter (3-branch data source)" \
  backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task C.2: Add 4 yoy-mom calculate functions

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (add after C.1)

- [ ] **Step 1: Add MONTH variant**

```python
async def _calculate_month_yoy_mom(
    factory_id: str, period: str, metric: str
) -> list[dict]:
    """Mirror Java calculateMonthYoYMoM (line 1825-1864).

    period format: 'YYYY-MM'. Returns single chart point.
    """
    year, month = map(int, period.split("-"))
    current_ym = (year, month)
    last_year_ym = (year - 1, month)
    last_month_y, last_month_m = (year, month - 1) if month > 1 else (year - 1, 12)
    last_period_ym = (last_month_y, last_month_m)

    current_value = await _get_metric_value_for_period(factory_id, current_ym, metric)
    last_year_value = await _get_metric_value_for_period(factory_id, last_year_ym, metric)
    last_period_value = await _get_metric_value_for_period(factory_id, last_period_ym, metric)

    yoy_growth_rate = _safe_growth_rate(current_value, last_year_value)
    mom_growth_rate = _safe_growth_rate(current_value, last_period_value)

    return [{
        "period": period,
        "currentValue": _decimal_to_number(current_value.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "lastYearValue": _decimal_to_number(last_year_value.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "lastPeriodValue": _decimal_to_number(last_period_value.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "yoyGrowthRate": _decimal_to_number(yoy_growth_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "momGrowthRate": _decimal_to_number(mom_growth_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "yoyChange": _decimal_to_number((current_value - last_year_value).quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "momChange": _decimal_to_number((current_value - last_period_value).quantize(Decimal("0.01"), ROUND_HALF_UP)),
    }]


async def _calculate_quarter_yoy_mom(
    factory_id: str, period: str, metric: str
) -> list[dict]:
    """Mirror Java calculateQuarterYoYMoM (line 1869-1913).

    period format: 'YYYY-Qn' (e.g. '2026-Q1'). Returns single chart point.
    Note: yoy field name is `momGrowthRate` even though it's QoQ — Java reuses field name.
    """
    parts = period.split("-Q")
    year = int(parts[0])
    quarter = int(parts[1])

    last_year_q = quarter
    last_year_y = year - 1
    last_quarter_q = 4 if quarter == 1 else quarter - 1
    last_quarter_y = year - 1 if quarter == 1 else year

    current_value = await _get_metric_value_for_quarter(factory_id, year, quarter, metric)
    last_year_value = await _get_metric_value_for_quarter(factory_id, last_year_y, last_year_q, metric)
    last_quarter_value = await _get_metric_value_for_quarter(factory_id, last_quarter_y, last_quarter_q, metric)

    yoy_growth_rate = _safe_growth_rate(current_value, last_year_value)
    qoq_growth_rate = _safe_growth_rate(current_value, last_quarter_value)

    return [{
        "period": period,
        "currentValue": _decimal_to_number(current_value.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "lastYearValue": _decimal_to_number(last_year_value.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "lastPeriodValue": _decimal_to_number(last_quarter_value.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "yoyGrowthRate": _decimal_to_number(yoy_growth_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "momGrowthRate": _decimal_to_number(qoq_growth_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "yoyChange": _decimal_to_number((current_value - last_year_value).quantize(Decimal("0.01"), ROUND_HALF_UP)),
        "momChange": _decimal_to_number((current_value - last_quarter_value).quantize(Decimal("0.01"), ROUND_HALF_UP)),
    }]


async def _calculate_month_range_yoy_mom(
    factory_id: str, start_period: str, end_period: str, metric: str
) -> list[dict]:
    """Mirror Java calculateMonthRangeYoYMoM (line 1918-1932).

    Iterates from start_period to end_period (inclusive), calling _calculate_month_yoy_mom
    per month. Each iteration emits 1 chart point.
    """
    start_year, start_month = map(int, start_period.split("-"))
    end_year, end_month = map(int, end_period.split("-"))

    result: list[dict] = []
    current_year, current_month = start_year, start_month
    while (current_year, current_month) <= (end_year, end_month):
        period = f"{current_year}-{current_month:02d}"
        month_data = await _calculate_month_yoy_mom(factory_id, period, metric)
        result.extend(month_data)
        # Advance one month
        if current_month == 12:
            current_year += 1
            current_month = 1
        else:
            current_month += 1
    return result


async def _calculate_quarter_range_yoy_mom(
    factory_id: str, start_period: str, end_period: str, metric: str
) -> list[dict]:
    """Mirror Java calculateQuarterRangeYoYMoM (line 1937-1965).

    Iterates from start_period (YYYY-Qn) to end_period inclusive, calling
    _calculate_quarter_yoy_mom per quarter.
    """
    start_year, start_q = start_period.split("-Q")
    end_year, end_q = end_period.split("-Q")
    start_year, start_q = int(start_year), int(start_q)
    end_year, end_q = int(end_year), int(end_q)

    result: list[dict] = []
    current_year, current_quarter = start_year, start_q
    # Java line 1951: while (currentYear < endYear || (currentYear == endYear && currentQuarter <= endQuarter))
    while current_year < end_year or (current_year == end_year and current_quarter <= end_q):
        period = f"{current_year}-Q{current_quarter}"
        quarter_data = await _calculate_quarter_yoy_mom(factory_id, period, metric)
        result.extend(quarter_data)
        current_quarter += 1
        if current_quarter > 4:
            current_quarter = 1
            current_year += 1
    return result
```

- [ ] **Step 2: Run pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: 250 passed.

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/sub-endpoints): 4 yoy-mom calculate variants (MONTH/QUARTER + ranges)" \
  backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task C.3: Implement `_get_yoy_mom_chart` dispatcher + route

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (add after C.2 + add route)

- [ ] **Step 1: Verify HTTPException import**

```bash
grep -n "from fastapi import\|^import fastapi\|HTTPException" backend/python/smartbi_compat/api/analysis_finance.py | head -5
```

If `HTTPException` not in import, add it. The existing import is likely:
```python
from fastapi import APIRouter, Depends, Query
```
Change to:
```python
from fastapi import APIRouter, Depends, HTTPException, Query
```

- [ ] **Step 2: Add dispatcher impl**

Insert after `_calculate_quarter_range_yoy_mom`:

```python
async def _get_yoy_mom_chart(
    factory_id: str,
    period_type: str,
    start_period: str,
    end_period: Optional[str],
    metric: str = "revenue",
) -> dict:
    """Mirror Java FinanceAnalysisServiceImpl.getYoYMoMComparisonChart (line 1200-1254).

    Dispatches to 4 sub-impl based on period_type. MONTH_RANGE/QUARTER_RANGE require
    end_period — raises HTTP 400 if missing (audit I-8 fix).
    """
    if period_type == "MONTH":
        chart_data = await _calculate_month_yoy_mom(factory_id, start_period, metric)
    elif period_type == "QUARTER":
        chart_data = await _calculate_quarter_yoy_mom(factory_id, start_period, metric)
    elif period_type == "MONTH_RANGE":
        if end_period is None:
            raise HTTPException(status_code=400, detail="endPeriod required for MONTH_RANGE")
        chart_data = await _calculate_month_range_yoy_mom(factory_id, start_period, end_period, metric)
    elif period_type == "QUARTER_RANGE":
        if end_period is None:
            raise HTTPException(status_code=400, detail="endPeriod required for QUARTER_RANGE")
        chart_data = await _calculate_quarter_range_yoy_mom(factory_id, start_period, end_period, metric)
    else:
        # Java line 1224-1226: default fallback to MONTH with warning
        logger.warning("Unknown periodType=%s, using MONTH default", period_type)
        chart_data = await _calculate_month_yoy_mom(factory_id, start_period, metric)

    metric_name = _get_metric_display_name(metric)

    # Map.of(4) Jackson hash order: golden recording verifies (Phase C.4)
    options = {
        "yAxis": [
            _new_yaxis_entry(name="金额", position="left"),
            _new_yaxis_entry(name="增长率(%)", position="right"),
        ],
        "series": [
            {"color": "#5470c6", "name": "本期", "type": "bar", "yAxisIndex": 0},
            {"color": "#91cc75", "name": "同期", "type": "bar", "yAxisIndex": 0},
            {"color": "#ee6666", "name": "同比增长率", "type": "line", "yAxisIndex": 1},
            {"color": "#fac858", "name": "环比增长率", "type": "line", "yAxisIndex": 1},
        ],
        "tooltip": {"trigger": "axis"},
    }

    return _new_chart_config_dict(
        chart_type="LINE_BAR",
        title=f"{metric_name}同比环比分析",
        series_field="metric",
        data=chart_data,
        options=options,
        xaxis_field="period",
        yaxis_field="currentValue",
    )
```

- [ ] **Step 3: Add route handler**

After Task B.1's `get_budget_achievement` route, add:

```python
@router.get("/api/mobile/{factory_id}/smart-bi/analysis/finance/yoy-mom")
async def get_yoy_mom(
    factory_id: str,
    periodType: str = Query(...),
    startPeriod: str = Query(...),
    endPeriod: Optional[str] = Query(None),
    metric: str = Query("revenue"),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Java reference: SmartBIAnalysisController.getYoYMoMComparisonChart line 294-312."""
    result = await _get_yoy_mom_chart(
        auth.factory_id, periodType, startPeriod, endPeriod, metric
    )
    return wrap_response(result)
```

- [ ] **Step 4: Run pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: 250 passed.

- [ ] **Step 5: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/sub-endpoints): _get_yoy_mom_chart dispatcher + route" \
  backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task C.4: Record F999 + F001 yoy-mom goldens

- [ ] **Step 1: Verify tunnel** (same as B.2 step 1)

- [ ] **Step 2: Record F999**

```bash
JWT_SECRET="$(ssh root@47.100.235.168 'grep ^JWT_SECRET= /www/wwwroot/cretas/.env.test | cut -d= -f2-')" \
  BASE_URL_OVERRIDE="http://127.0.0.1:10011" \
  ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/analysis/finance/yoy-mom?periodType=MONTH&startPeriod=2026-01&metric=revenue' \
    analysis-finance-F999-yoy-mom.json
```

- [ ] **Step 3: Verify F999 shape + capture key orders**

```bash
python3 -c "
import json
g = json.load(open('tests/fixtures/java-smartbi-golden/analysis-finance-F999-yoy-mom.json'))
data = g['data']
print('chartType:', data['chartType'])
print('data length:', len(data['data']))
print('data[0] keys:', list(data['data'][0].keys()))
print('options keys:', list(data['options'].keys()))
print('series[0] keys:', list(data['options']['series'][0].keys()))
"
```

If `series[0] keys` differs from impl's `[color, name, type, yAxisIndex]`, fix `_get_yoy_mom_chart` impl to match golden.

- [ ] **Step 4: Record F001**

```bash
JWT_SECRET="$(ssh root@47.100.235.168 'grep ^JWT_SECRET= /www/wwwroot/cretas/.env.test | cut -d= -f2-')" \
  BASE_URL_OVERRIDE="http://127.0.0.1:10011" \
  ./scripts/record-java-golden.sh F001 \
    '/api/mobile/{factoryId}/smart-bi/analysis/finance/yoy-mom?periodType=MONTH&startPeriod=2026-01&metric=revenue' \
    analysis-finance-F001-yoy-mom.json
```

- [ ] **Step 5: Commit goldens (+ impl fix if needed)**

```bash
git add tests/fixtures/java-smartbi-golden/analysis-finance-F999-yoy-mom.json \
        tests/fixtures/java-smartbi-golden/analysis-finance-F001-yoy-mom.json
./scripts/safe-commit.sh "test(phase2a/sub-endpoints): record F999+F001 yoy-mom goldens" \
  tests/fixtures/java-smartbi-golden/analysis-finance-F999-yoy-mom.json \
  tests/fixtures/java-smartbi-golden/analysis-finance-F001-yoy-mom.json
```

---

### Task C.5: Add `TestYoYMoMComparisonChart` (2 byte gate + 6 unit tests)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py`

- [ ] **Step 1: Append test class**

```python


class TestYoYMoMComparisonChart:
    """F999 byte-shape gate + arithmetic tests for /yoy-mom."""

    def test_f999_yoy_mom_data_keys_match_golden(self, client, monkeypatch):
        async def fake_finance(*_): return []
        async def fake_sales(*_): return []
        monkeypatch.setattr("smartbi_compat.api.analysis_finance._query_finance_data", fake_finance)
        monkeypatch.setattr("smartbi_compat.api.analysis_finance._query_finance_sales_fallback", fake_sales)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance/yoy-mom"
            "?periodType=MONTH&startPeriod=2026-01&metric=revenue",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        py_data_keys = list(resp.json()["data"].keys())
        with io.open(GOLDEN_DIR / "analysis-finance-F999-yoy-mom.json", encoding="utf-8") as f:
            golden_data_keys = list(json.load(f)["data"].keys())
        assert py_data_keys == golden_data_keys

    def test_f999_yoy_mom_byte_shape(self, client, monkeypatch):
        async def fake_finance(*_): return []
        async def fake_sales(*_): return []
        monkeypatch.setattr("smartbi_compat.api.analysis_finance._query_finance_data", fake_finance)
        monkeypatch.setattr("smartbi_compat.api.analysis_finance._query_finance_sales_fallback", fake_sales)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance/yoy-mom"
            "?periodType=MONTH&startPeriod=2026-01&metric=revenue",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200
        py_data = _strip_volatile(resp.json()["data"])
        with io.open(GOLDEN_DIR / "analysis-finance-F999-yoy-mom.json", encoding="utf-8") as f:
            golden_data = _strip_volatile(json.load(f)["data"])
        if py_data != golden_data:
            diffs = {k: {"py": py_data.get(k), "g": golden_data.get(k)}
                     for k in set(py_data) | set(golden_data)
                     if py_data.get(k) != golden_data.get(k)}
            pytest.fail(f"BYTE MISMATCH: {json.dumps(diffs, indent=2, ensure_ascii=False)[:2000]}")

    def _run_chart(self, fake_sales=None, fake_finance=None, period_type="MONTH",
                    start_period="2026-01", end_period=None, metric="revenue"):
        import asyncio
        from smartbi_compat.api import analysis_finance as af
        orig_sales = af._query_finance_sales_fallback
        orig_finance = af._query_finance_data
        try:
            if fake_sales is not None:
                af._query_finance_sales_fallback = fake_sales
            if fake_finance is not None:
                af._query_finance_data = fake_finance
            return asyncio.run(af._get_yoy_mom_chart(
                "F", period_type, start_period, end_period, metric
            ))
        finally:
            af._query_finance_sales_fallback = orig_sales
            af._query_finance_data = orig_finance

    def test_month_periodtype_yoy_mom_calc(self):
        """yoy = (cur-lastYear)/lastYear*100; mom = (cur-lastMonth)/lastMonth*100."""
        from datetime import date as d
        from decimal import Decimal
        async def fake_sales(_fid, start, _end):
            # Inject different revenue for current/lastYear/lastMonth months
            if start == d(2026, 1, 1): return [{"amount": Decimal("100"), "cost": Decimal("0")}]
            if start == d(2025, 1, 1): return [{"amount": Decimal("80"), "cost": Decimal("0")}]
            if start == d(2025, 12, 1): return [{"amount": Decimal("90"), "cost": Decimal("0")}]
            return []
        chart = self._run_chart(fake_sales=fake_sales)
        point = chart["data"][0]
        assert point["currentValue"] == 100
        assert point["lastYearValue"] == 80
        assert point["lastPeriodValue"] == 90
        # yoy = (100-80)/80*100 = 25
        assert point["yoyGrowthRate"] == 25
        # mom = (100-90)/90*100 = 11.11 (rounded HALF_UP)
        assert point["momGrowthRate"] == 11.11

    def test_quarter_periodtype_dispatches_to_quarter_calc(self):
        async def fake_sales(*_): return []
        chart = self._run_chart(fake_sales=fake_sales, period_type="QUARTER", start_period="2026-Q1")
        assert chart["data"][0]["period"] == "2026-Q1"

    def test_month_range_requires_end_period(self):
        """audit I-8: MONTH_RANGE without endPeriod → HTTP 400."""
        from fastapi import HTTPException
        import asyncio
        from smartbi_compat.api import analysis_finance as af
        async def fake_sales(*_): return []
        af._query_finance_sales_fallback = fake_sales
        try:
            with pytest.raises(HTTPException) as exc_info:
                asyncio.run(af._get_yoy_mom_chart("F", "MONTH_RANGE", "2026-01", None, "revenue"))
            assert exc_info.value.status_code == 400
            assert "endPeriod required" in str(exc_info.value.detail)
        finally:
            pass  # restore not strict here since we're calling impl directly

    def test_unknown_periodtype_falls_back_to_month(self):
        """Unknown periodType → MONTH default + warning log."""
        async def fake_sales(*_): return []
        chart = self._run_chart(fake_sales=fake_sales, period_type="WEIRD", start_period="2026-01")
        # Falls back to MONTH → emits 1 point
        assert len(chart["data"]) == 1
        assert chart["data"][0]["period"] == "2026-01"

    def test_zero_base_growth_rate_zero(self):
        """lastYearValue=0 → yoyGrowthRate=0 (avoid div0 per Java line 1839-1843)."""
        async def fake_sales(*_): return []  # all periods return empty → all values are 0
        chart = self._run_chart(fake_sales=fake_sales)
        point = chart["data"][0]
        assert point["currentValue"] == 0
        assert point["lastYearValue"] == 0
        assert point["yoyGrowthRate"] == 0
        assert point["momGrowthRate"] == 0

    def test_cost_metric_uses_finance_data_not_sales(self):
        """audit I-6: metric=cost should query _query_finance_data (COST), not sales."""
        finance_calls = []
        sales_calls = []
        async def fake_finance(_fid, rt, _s, _e):
            finance_calls.append(rt)
            return [{"total_cost": __import__("decimal").Decimal("500")}]
        async def fake_sales(*_):
            sales_calls.append(1)
            return []
        chart = self._run_chart(fake_sales=fake_sales, fake_finance=fake_finance, metric="cost")
        # Cost branch should call _query_finance_data with "COST" 3 times (current + lastYear + lastPeriod)
        assert finance_calls == ["COST", "COST", "COST"]
        # Sales should NOT be called for cost metric
        assert sales_calls == []
        # currentValue = 500 (from total_cost sum)
        assert chart["data"][0]["currentValue"] == 500
```

- [ ] **Step 2: Run new tests**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_contract.py::TestYoYMoMComparisonChart -v
```

Expected: 8/8 pass.

- [ ] **Step 3: Run full pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: 258 passed (250 + 8 new).

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "test(phase2a/sub-endpoints): TestYoYMoMComparisonChart 2 byte gate + 6 unit tests" \
  tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

## Phase D — Category comparison (impl + golden + 5 tests)

### Task D.1: Add `_aggregate_sales_by_category` + `_get_category_comparison_chart` + route

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`

- [ ] **Step 1: Add aggregator helper**

Insert after `_calculate_quarter_range_yoy_mom` (from C.2):

```python
def _aggregate_sales_by_category(sales_rows: list[dict]) -> dict[str, Decimal]:
    """Mirror Java FinanceAnalysisServiceImpl.aggregateSalesByCategory (line 2070-2087).

    Java line 2074: `getProductCategory() != null ? getProductCategory() : "其他"` — uses
    NULL check, NOT falsy. Empty string "" is bucketed under "" (not "其他").

    audit C-2 fix: use explicit `is not None` to match Java exactly. Avoid Python `or` falsy
    which would collapse "" to "其他" (divergence).

    Amount handling per Rule 1 (audit M-6 fix): explicit `is not None` check.
    """
    result: dict[str, Decimal] = {}
    for row in sales_rows:
        raw_cat = row.get("product_category")
        cat = raw_cat if raw_cat is not None else "其他"
        raw_amt = row.get("amount")
        amount = _to_decimal(raw_amt) if raw_amt is not None else Decimal("0")
        result[cat] = result.get(cat, Decimal("0")) + amount
    return result
```

- [ ] **Step 2: Add chart impl**

Insert after `_aggregate_sales_by_category`:

```python
async def _get_category_comparison_chart(
    factory_id: str, year: int, compare_year: int
) -> dict:
    """Mirror Java FinanceAnalysisServiceImpl.getCategoryStructureComparisonChart (line 1259-1365).

    Queries smart_bi_sales_data for both years via _query_finance_sales_fallback.
    Aggregates by product_category, computes ratio/yoy growth, sorts by currentAmount desc.
    """
    current_sales = await _query_finance_sales_fallback(
        factory_id, date(year, 1, 1), date(year, 12, 31)
    )
    compare_sales = await _query_finance_sales_fallback(
        factory_id, date(compare_year, 1, 1), date(compare_year, 12, 31)
    )

    current_category_amount = _aggregate_sales_by_category(current_sales)
    compare_category_amount = _aggregate_sales_by_category(compare_sales)

    current_total = sum(current_category_amount.values(), Decimal("0"))
    compare_total = sum(compare_category_amount.values(), Decimal("0"))

    # Java LinkedHashSet preserves first-encounter order
    all_categories: list[str] = []
    seen: set[str] = set()
    for cat in list(current_category_amount.keys()) + list(compare_category_amount.keys()):
        if cat not in seen:
            seen.add(cat)
            all_categories.append(cat)

    chart_data: list[dict] = []
    for category in all_categories:
        current_amount = current_category_amount.get(category, Decimal("0"))
        compare_amount = compare_category_amount.get(category, Decimal("0"))

        if current_total > Decimal("0"):
            current_ratio = (current_amount / current_total * Decimal("100")).quantize(
                Decimal("0.0001"), rounding=ROUND_HALF_UP
            )
        else:
            current_ratio = Decimal("0")
        if compare_total > Decimal("0"):
            compare_ratio = (compare_amount / compare_total * Decimal("100")).quantize(
                Decimal("0.0001"), rounding=ROUND_HALF_UP
            )
        else:
            compare_ratio = Decimal("0")

        # Java line 1304-1308: yoyGrowthRate with new-category fallback
        if compare_amount > Decimal("0"):
            yoy_growth_rate = (
                (current_amount - compare_amount) / compare_amount * Decimal("100")
            ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        elif current_amount > Decimal("0"):
            yoy_growth_rate = Decimal("100")
        else:
            yoy_growth_rate = Decimal("0")

        ratio_change = current_ratio - compare_ratio

        chart_data.append({
            "category": category,
            "currentAmount": _decimal_to_number(current_amount.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "compareAmount": _decimal_to_number(compare_amount.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "currentRatio": _decimal_to_number(current_ratio.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "compareRatio": _decimal_to_number(compare_ratio.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "yoyGrowthRate": _decimal_to_number(yoy_growth_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "ratioChange": _decimal_to_number(ratio_change.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "currentYear": year,
            "compareYear": compare_year,
        })

    # Java line 1327-1331: sort by currentAmount DESC
    chart_data.sort(key=lambda x: x["currentAmount"], reverse=True)

    if compare_total > Decimal("0"):
        total_yoy_growth_rate = (
            (current_total - compare_total) / compare_total * Decimal("100")
        ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    else:
        total_yoy_growth_rate = Decimal("0")

    options = {
        "groupedBar": True,
        "yAxis": [
            _new_yaxis_entry(name="金额", position="left"),
            _new_yaxis_entry(name="同比增长率(%)", position="right"),
        ],
        "series": [
            {"color": "#5470c6", "name": f"{year}年", "type": "bar", "yAxisIndex": 0},
            {"color": "#91cc75", "name": f"{compare_year}年", "type": "bar", "yAxisIndex": 0},
            {"color": "#ee6666", "name": "同比增长率", "type": "line", "yAxisIndex": 1},
        ],
        "summary": {
            "currentTotal": _decimal_to_number(current_total.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "compareTotal": _decimal_to_number(compare_total.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "totalYoyGrowthRate": _decimal_to_number(total_yoy_growth_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)),
        },
    }

    return _new_chart_config_dict(
        chart_type="BAR",
        title=f"{year}年 vs {compare_year}年 品类结构对比",
        series_field="year",
        data=chart_data,
        options=options,
        xaxis_field="category",
        yaxis_field="currentAmount",
    )
```

- [ ] **Step 3: Add route**

After `get_yoy_mom`:

```python
@router.get("/api/mobile/{factory_id}/smart-bi/analysis/finance/category-comparison")
async def get_category_comparison(
    factory_id: str,
    year: int = Query(...),
    compareYear: int = Query(...),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Java reference: SmartBIAnalysisController.getCategoryStructureComparisonChart line 314-330."""
    result = await _get_category_comparison_chart(auth.factory_id, year, compareYear)
    return wrap_response(result)
```

- [ ] **Step 4: Run pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: 258 passed.

- [ ] **Step 5: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/sub-endpoints): _get_category_comparison_chart impl + route + aggregator" \
  backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task D.2: Record F999 + F001 category-comparison goldens

- [ ] **Step 1: Verify tunnel** (same as B.2)

- [ ] **Step 2: Record F999**

```bash
JWT_SECRET="$(ssh root@47.100.235.168 'grep ^JWT_SECRET= /www/wwwroot/cretas/.env.test | cut -d= -f2-')" \
  BASE_URL_OVERRIDE="http://127.0.0.1:10011" \
  ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/analysis/finance/category-comparison?year=2025&compareYear=2024' \
    analysis-finance-F999-category-comparison.json
```

- [ ] **Step 3: Verify F999 + capture key orders for `summary` (Map.of(3)) and `series` (Map.of(4))**

```bash
python3 -c "
import json
g = json.load(open('tests/fixtures/java-smartbi-golden/analysis-finance-F999-category-comparison.json'))
data = g['data']
print('chartType:', data['chartType'])
print('data length:', len(data['data']))
print('options keys:', list(data['options'].keys()))
print('summary keys:', list(data['options']['summary'].keys()))
print('series[0] keys:', list(data['options']['series'][0].keys()))
"
```

If `summary` keys differ from `[currentTotal, compareTotal, totalYoyGrowthRate]`, fix impl in D.1. If `series[0]` keys differ from `[color, name, type, yAxisIndex]`, fix impl.

- [ ] **Step 4: Record F001**

```bash
JWT_SECRET="$(ssh root@47.100.235.168 'grep ^JWT_SECRET= /www/wwwroot/cretas/.env.test | cut -d= -f2-')" \
  BASE_URL_OVERRIDE="http://127.0.0.1:10011" \
  ./scripts/record-java-golden.sh F001 \
    '/api/mobile/{factoryId}/smart-bi/analysis/finance/category-comparison?year=2025&compareYear=2024' \
    analysis-finance-F001-category-comparison.json
```

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/java-smartbi-golden/analysis-finance-F999-category-comparison.json \
        tests/fixtures/java-smartbi-golden/analysis-finance-F001-category-comparison.json
./scripts/safe-commit.sh "test(phase2a/sub-endpoints): record F999+F001 category-comparison goldens" \
  tests/fixtures/java-smartbi-golden/analysis-finance-F999-category-comparison.json \
  tests/fixtures/java-smartbi-golden/analysis-finance-F001-category-comparison.json
```

---

### Task D.3: Add `TestCategoryComparisonChart` (2 byte gate + 3 unit tests)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py`

- [ ] **Step 1: Append test class**

```python


class TestCategoryComparisonChart:
    """F999 byte-shape gate + arithmetic tests for /category-comparison."""

    def test_f999_category_comparison_data_keys_match_golden(self, client, monkeypatch):
        async def fake_sales(*_): return []
        monkeypatch.setattr("smartbi_compat.api.analysis_finance._query_finance_sales_fallback", fake_sales)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance/category-comparison"
            "?year=2025&compareYear=2024",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        py_data_keys = list(resp.json()["data"].keys())
        with io.open(GOLDEN_DIR / "analysis-finance-F999-category-comparison.json", encoding="utf-8") as f:
            golden_data_keys = list(json.load(f)["data"].keys())
        assert py_data_keys == golden_data_keys

    def test_f999_category_comparison_byte_shape(self, client, monkeypatch):
        async def fake_sales(*_): return []
        monkeypatch.setattr("smartbi_compat.api.analysis_finance._query_finance_sales_fallback", fake_sales)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance/category-comparison"
            "?year=2025&compareYear=2024",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200
        py_data = _strip_volatile(resp.json()["data"])
        with io.open(GOLDEN_DIR / "analysis-finance-F999-category-comparison.json", encoding="utf-8") as f:
            golden_data = _strip_volatile(json.load(f)["data"])
        if py_data != golden_data:
            diffs = {k: {"py": py_data.get(k), "g": golden_data.get(k)}
                     for k in set(py_data) | set(golden_data)
                     if py_data.get(k) != golden_data.get(k)}
            pytest.fail(f"BYTE MISMATCH (category-comparison): {json.dumps(diffs, indent=2, ensure_ascii=False)[:2000]}")

    def _run_chart(self, fake_sales, year=2025, compare_year=2024):
        import asyncio
        from smartbi_compat.api import analysis_finance as af
        original = af._query_finance_sales_fallback
        try:
            af._query_finance_sales_fallback = fake_sales
            return asyncio.run(af._get_category_comparison_chart("F", year, compare_year))
        finally:
            af._query_finance_sales_fallback = original

    def test_category_aggregation_by_product_category(self):
        """Groups by product_category, sums amount."""
        from datetime import date as d
        from decimal import Decimal
        async def fake_sales(_fid, start, _end):
            if start == d(2025, 1, 1):
                return [
                    {"product_category": "A", "amount": Decimal("100")},
                    {"product_category": "A", "amount": Decimal("50")},
                    {"product_category": "B", "amount": Decimal("80")},
                ]
            return []
        chart = self._run_chart(fake_sales)
        # A=150, B=80 → sorted DESC by currentAmount
        assert len(chart["data"]) == 2
        assert chart["data"][0]["category"] == "A"
        assert chart["data"][0]["currentAmount"] == 150
        assert chart["data"][1]["category"] == "B"
        assert chart["data"][1]["currentAmount"] == 80

    def test_sort_by_current_amount_desc(self):
        """data sorted by currentAmount descending (Java line 1327-1331)."""
        from datetime import date as d
        from decimal import Decimal
        async def fake_sales(_fid, start, _end):
            if start == d(2025, 1, 1):
                return [
                    {"product_category": "low", "amount": Decimal("10")},
                    {"product_category": "high", "amount": Decimal("100")},
                    {"product_category": "mid", "amount": Decimal("50")},
                ]
            return []
        chart = self._run_chart(fake_sales)
        amounts = [p["currentAmount"] for p in chart["data"]]
        assert amounts == sorted(amounts, reverse=True)

    def test_new_category_yoy_growth_100(self):
        """compare=0, current>0 → yoyGrowth=100 (Java line 1304-1308)."""
        from datetime import date as d
        from decimal import Decimal
        async def fake_sales(_fid, start, _end):
            if start == d(2025, 1, 1):
                return [{"product_category": "new", "amount": Decimal("50")}]
            return []  # 2024 has no data
        chart = self._run_chart(fake_sales)
        new_cat = chart["data"][0]
        assert new_cat["category"] == "new"
        assert new_cat["currentAmount"] == 50
        assert new_cat["compareAmount"] == 0
        assert new_cat["yoyGrowthRate"] == 100
```

- [ ] **Step 2: Run new tests**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_contract.py::TestCategoryComparisonChart -v
```

Expected: 5/5 pass.

- [ ] **Step 3: Run full pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -3
```

Expected: 263 passed (258 + 5 new).

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "test(phase2a/sub-endpoints): TestCategoryComparisonChart 2 byte gate + 3 unit tests" \
  tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

## Phase E — Final verify + push + PR

### Task E.1: Final verify + push branch + create PR

- [ ] **Step 1: Verify total scope**

```bash
git diff --stat origin/main..HEAD -- 'backend/python/smartbi_compat/api/analysis_finance.py' \
  'tests/python/smartbi_compat/test_analysis_finance_contract.py' \
  'tests/fixtures/java-smartbi-golden/' | tail -10
```

Expected: ~700 LOC insertions across ~3 files (impl + tests + 6 goldens).

- [ ] **Step 2: Run full pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -5
```

Expected: 263 passed.

- [ ] **Step 3: Verify clean status**

```bash
git status --short
```

Expected: empty.

- [ ] **Step 4: Verify commits**

```bash
git log --oneline origin/main..HEAD
```

Expected: ~14 commits (3 spec + 1 plan + ~10 impl/test).

- [ ] **Step 5: Push**

```bash
git push -u origin phase2a/finance-sub-endpoints 2>&1 | tail -5
```

- [ ] **Step 6: Create PR**

```bash
gh pr create --base main --head phase2a/finance-sub-endpoints --title "Phase 2A: /analysis/finance 3 sub-endpoints port (budget-achievement + yoy-mom + category-comparison)" --body "$(cat <<'EOF'
## Summary

Ports 3 finance sub-endpoints from Java to Python with byte-shape parity:
- `GET /analysis/finance/budget-achievement?year=N&metric=X` — 12-month budget vs actual + achievement rate + alert
- `GET /analysis/finance/yoy-mom?periodType=X&startPeriod=Y&endPeriod=Z&metric=W` — YoY/MoM growth (4 periodTypes: MONTH/QUARTER/MONTH_RANGE/QUARTER_RANGE)
- `GET /analysis/finance/category-comparison?year=N&compareYear=M` — sales by product_category for 2 years + ratio + yoy growth

Adds 13 new functions, 6 goldens (F999+F001 each), 19 tests across 3 test classes.

## Architectural decisions

- **3 audit rounds** caught: Critical algorithm bug (`_get_metric_value_for_period` 3-branch data source), empty-string handling in `_aggregate_sales_by_category`, missing range endPeriod guard, dead-branch confusion in budget metric helpers.
- Reuses `_query_finance_data` + `_query_finance_sales_fallback` (cretas_pool after PR #23 hotfix).
- `_get_metric_value_for_period`/`_quarter`: 3 branches (revenue/profit/gross_margin → sales | cost/expense → finance | default → sales).
- `_aggregate_sales_by_category`: explicit `is not None` check (NOT `or "其他"`) to match Java's null-handling exactly.
- MONTH_RANGE/QUARTER_RANGE: explicit endPeriod None-guard → HTTP 400 (avoid silent fallback to MONTH).

Spec: `docs/superpowers/specs/2026-04-30-phase2a-finance-sub-endpoints-design.md` (864 lines, 4 commits)
Plan: `docs/superpowers/plans/2026-04-30-phase2a-finance-sub-endpoints.md`
Predecessors: PR #21/#22/#23/#25 (profit + hotfix + cost)

## Test plan

- [x] pytest 244 → 263 (+19 new tests, 0 regressions)
- [x] F999 byte gates: 6/6 (3 endpoints × 2 tests)
- [x] Arithmetic depth: 13 unit tests covering algebra, dispatch, edge cases
- [ ] **Post-merge**: deploy test (8084) + smoke 3 endpoints
- [ ] **Post-merge**: deploy prod (8083)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -3
```

- [ ] **Step 7: Report PR URL + ready for merge**

---

## Self-Review

**1. Spec coverage:**
- ✅ §3.2 budget-achievement helpers + impl: A.2, B.1
- ✅ §3.3 yoy-mom dispatcher + 4 calculate variants + period helpers + safe_growth_rate + calculate_metric_from_sales: A.3, C.1, C.2, C.3
- ✅ §3.4 category-comparison aggregator + impl: D.1
- ✅ §3.5 3 route handlers: B.1, C.3, D.1
- ✅ §4 6 goldens: B.2, C.4, D.2
- ✅ §5.1 6 byte gate tests (2 per endpoint): B.3, C.5, D.3
- ✅ §5.2 13 unit tests: B.3 (4) + C.5 (6) + D.3 (3)
- ✅ §2.2 decision 7: import calendar to module level: A.1

**2. Placeholder scan:** No "TBD" / "TODO" / "implement later". All steps have full code or commands.

**3. Type consistency:**
- `_query_finance_data(factory, record_type: str, start, end)` — used by C.1 cost branch ✓
- `_query_finance_sales_fallback(factory, start, end)` — used by C.1 sales branch + D.1 ✓
- `_calculate_month_yoy_mom(factory, period: str, metric)` — used by C.3 dispatcher + C.2 range loop ✓
- `_get_metric_value_for_period(factory, year_month: tuple[int, int], metric)` — caller passes tuple ✓
- All test class names: `TestBudgetAchievementChart` (B.3) / `TestYoYMoMComparisonChart` (C.5) / `TestCategoryComparisonChart` (D.3) ✓

**4. Concurrent-edit safety:** Every commit step uses `safe-commit.sh`.
