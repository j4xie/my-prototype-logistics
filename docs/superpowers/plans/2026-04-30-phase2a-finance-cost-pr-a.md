# Phase 2A `/analysis/finance` cost per-type PR-A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement cost per-type real impl on Python `/api/mobile/{factory}/smart-bi/analysis/finance?analysisType=cost`，achieve byte-shape parity with Java，replace existing 501 stub。Composite path 的 `_get_cost_structure_chart` 同时升级到 real impl（共享 sub-service swap）。

**Architecture:** Edit `backend/python/smartbi_compat/api/analysis_finance.py` add 4 new helpers + 4 constants + new sub-service `_get_cost_trend_chart` + per-type assembler `_get_cost_analysis` + route branch；upgrade existing stub `_get_cost_structure_chart` 签名 + 内容；refactor `_get_comprehensive_finance_analysis` 一处 call site。Add F999 byte-shape contract test class + drop "cost" from existing 501 test iter list。

**Tech Stack:** FastAPI route handler, asyncpg via `_query_finance_data` (already on main from profit PR #21), Decimal arithmetic + `_decimal_to_number` helper, pytest + monkeypatch for test mocks。

**Spec:** `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-cost-design.md`

**Java reference root:** `backend/java/cretas-api/src/main/java/com/cretas/aims/`

**Branch:** `phase2a/t-finance-cost` (worktree: `.worktrees/phase2a-finance-cost`)

**Base:** origin/main `8602e8374` (含 PR #21 profit PR-A + PR #22 profit PR-B) + spec + rules commits

**Out of scope (PR-B):** 11 个算术分支单元测试 (`TestCostStructureArithmetic` + `TestCostTrendArithmetic`)

---

## Concurrent-edit safety reminder

Every commit MUST use `git commit -- path1 path2` (per `.claude/rules/concurrent-edit-safety.md` rule 5b). Sister chats may have files staged in this worktree's index — `--only` mode prevents scope creep.

---

## File Structure

| File | Action | Why |
|---|---|---|
| `backend/python/smartbi_compat/api/analysis_finance.py` | Edit | All cost real impl + composite caller signature update |
| `tests/python/smartbi_compat/test_analysis_finance_contract.py` | Edit | New `TestAnalysisFinanceCost` class + drop "cost" from existing 501 test iter list |
| `tests/fixtures/java-smartbi-golden/analysis-finance-F999-cost.json` | Create | Flat-shape golden converted from existing envelope-shape `analysis-finance-type-cost-F999.json` |
| `tests/fixtures/java-smartbi-golden/analysis-finance-type-cost-F999.json` | Delete (rename) | Old envelope-shape replaced |

---

## Phase A — Pre-flight verify + golden conversion

### Task A.1: Verify shared dependencies on rebased main

**Files:** None (read-only verification)

- [ ] **Step 1: Verify `_query_finance_data` exists with correct signature**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-cost
grep -A 3 "^async def _query_finance_data" backend/python/smartbi_compat/api/analysis_finance.py
```

Expected output:
```python
async def _query_finance_data(
    factory_id: str, record_type: str, start_date: date, end_date: date
) -> list[dict]:
```

- [ ] **Step 2: Verify `_decimal_to_number` and `_get_period_key` exist**

```bash
grep -E "^def _(decimal_to_number|get_period_key|format_currency|to_decimal|filter_to_latest_upload)" backend/python/smartbi_compat/api/analysis_finance.py
```

Expected output: 5 lines (one per helper).

- [ ] **Step 3: Verify rules file ships in this branch**

```bash
ls .claude/rules/python-java-port.md
```

Expected: file exists.

- [ ] **Step 4: Run pytest baseline**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-cost
python -m pytest tests/python/smartbi_compat/ --tb=line -q 2>&1 | tail -3
```

Expected: `244 passed` (baseline post profit PR-A + PR-B merge)。If different count, record actual baseline in PR description.

- [ ] **Step 5: Verify existing 501 test iter list state**

```bash
grep -A 3 "test_f999_unimplemented_analysisType_returns_501" tests/python/smartbi_compat/test_analysis_finance_contract.py | head -5
```

Expected: `for at in ["cost", "receivable", "budget"]:` (profit already dropped)。If different, this plan's 501 test update step must be adjusted。

### Task A.2: Convert envelope-shape golden → flat-shape via extraction

**Files:**
- Read: `tests/fixtures/java-smartbi-golden/analysis-finance-type-cost-F999.json` (envelope shape)
- Create: `tests/fixtures/java-smartbi-golden/analysis-finance-F999-cost.json` (flat shape)
- Delete: `tests/fixtures/java-smartbi-golden/analysis-finance-type-cost-F999.json`

- [ ] **Step 1: Read existing envelope-shape golden**

```bash
python -c "
import json, io
with io.open('tests/fixtures/java-smartbi-golden/analysis-finance-type-cost-F999.json', encoding='utf-8') as f:
    envelope = json.load(f)
print('Top-level keys:', list(envelope.keys()))
print('response keys:', list(envelope.get('response', {}).keys()))
print('response.data keys:', list(envelope.get('response', {}).get('data', {}).keys()))
"
```

Expected:
- Top-level keys: `['verb', 'path', 'factory', 'response', '_meta']`
- response keys include: `httpStatus, code, success, message, timestamp, data`
- response.data keys include: `endDate, trendChart, startDate, structureChart`

- [ ] **Step 2: Extract response block, write flat-shape golden**

```bash
python -c "
import json, io
with io.open('tests/fixtures/java-smartbi-golden/analysis-finance-type-cost-F999.json', encoding='utf-8') as f:
    envelope = json.load(f)
flat = envelope['response']
# Strip httpStatus (not in payable golden)
flat.pop('httpStatus', None)
with io.open('tests/fixtures/java-smartbi-golden/analysis-finance-F999-cost.json', 'w', encoding='utf-8') as f:
    json.dump(flat, f, ensure_ascii=False, indent=2)
print('Wrote analysis-finance-F999-cost.json')
"
```

- [ ] **Step 3: Verify flat-shape matches payable precedent**

```bash
python -c "
import json, io
with io.open('tests/fixtures/java-smartbi-golden/analysis-finance-F999-cost.json', encoding='utf-8') as f:
    cost = json.load(f)
with io.open('tests/fixtures/java-smartbi-golden/analysis-finance-F999-payable.json', encoding='utf-8') as f:
    payable = json.load(f)
print('Cost top keys:', sorted(cost.keys()))
print('Payable top keys:', sorted(payable.keys()))
print('Cost data keys:', list(cost['data'].keys()))
"
```

Expected:
- Cost top keys: `['code', 'data', 'message', 'success', 'timestamp']` (and possibly `actionHint, severity, hintTarget` if Java emits them)
- Payable top keys: same set (subset comparison OK)
- Cost data keys: `['endDate', 'trendChart', 'startDate', 'structureChart']` (Jackson hash order — DO NOT reorder, this is the contract)

- [ ] **Step 4: Delete old envelope-shape golden**

```bash
git rm tests/fixtures/java-smartbi-golden/analysis-finance-type-cost-F999.json
```

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
test: convert cost F999 golden envelope→flat shape (PR-A prep)

Existing analysis-finance-type-cost-F999.json had envelope shape
{verb, path, factory, response, _meta} which is incompatible with
payable test loader pattern (loads response.data directly via
golden["data"]). Extract response block to root, drop _meta + httpStatus,
rename to analysis-finance-F999-cost.json matching payable precedent.

Source content preserved exactly (Java live recording from Apr 29).
EOF
)" -- tests/fixtures/java-smartbi-golden/analysis-finance-F999-cost.json tests/fixtures/java-smartbi-golden/analysis-finance-type-cost-F999.json
```

---

## Phase B — Pure helpers (TDD each)

### Task B.1: Add `_new_cost_series_entry` factory

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (add helper)
- Test: `tests/python/smartbi_compat/test_analysis_finance_contract.py` (add unit tests inline; PR-B will move to dedicated class)

- [ ] **Step 1: Write the failing test**

Find a stable insertion point in `test_analysis_finance_contract.py` (end of file, after existing payable tests). Add:

```python
class TestCostHelpers:
    """Cost helper unit tests (PR-A; will be supplanted by PR-B arithmetic class)."""

    def test_new_cost_series_entry_key_order(self):
        from smartbi_compat.api.analysis_finance import _new_cost_series_entry
        entry = _new_cost_series_entry(name="原材料", stack="cost")
        assert list(entry.keys()) == ["name", "stack"]
        assert entry == {"name": "原材料", "stack": "cost"}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestCostHelpers::test_new_cost_series_entry_key_order -v 2>&1 | tail -5
```

Expected: `ImportError` or `AttributeError` for `_new_cost_series_entry`.

- [ ] **Step 3: Add helper to analysis_finance.py**

Find the existing `_new_chart_config_dict` function (around line 178) and add this BELOW it (before `_new_ai_insight_dict`):

```python
def _new_cost_series_entry(name: str, stack: str) -> dict:
    """Mirror Java Map.of("name", X, "stack", Y) — Map.of(2) iteration order observed
    in F999 golden = [name, stack] (matches put-order for n=2)."""
    return {"name": name, "stack": stack}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestCostHelpers::test_new_cost_series_entry_key_order -v 2>&1 | tail -3
```

Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: _new_cost_series_entry Map.of(2) factory (cost PR-A B.1)" -- backend/python/smartbi_compat/api/analysis_finance.py tests/python/smartbi_compat/test_analysis_finance_contract.py
```

### Task B.2: Add COST_CATEGORY_* constants

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (add module-level constants)

- [ ] **Step 1: Write failing test**

Add to `TestCostHelpers` class:

```python
    def test_cost_category_constants(self):
        from smartbi_compat.api.analysis_finance import (
            COST_CATEGORY_MATERIAL,
            COST_CATEGORY_LABOR,
            COST_CATEGORY_OVERHEAD,
        )
        assert COST_CATEGORY_MATERIAL == "原材料"
        assert COST_CATEGORY_LABOR == "人工"
        assert COST_CATEGORY_OVERHEAD == "制造费用"
```

- [ ] **Step 2: Run test (expect fail)**

```bash
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestCostHelpers::test_cost_category_constants -v 2>&1 | tail -3
```

Expected: `ImportError`.

- [ ] **Step 3: Add constants near top of analysis_finance.py**

Find the existing `VOLATILE_KEYS` constant (around line 349) and add ABOVE it:

```python
# Cost category constants (Java FinanceAnalysisServiceImpl COST_CATEGORY_* literal values)
COST_CATEGORY_MATERIAL = "原材料"
COST_CATEGORY_LABOR    = "人工"
COST_CATEGORY_OVERHEAD = "制造费用"
```

- [ ] **Step 4: Run test (expect pass)**

```bash
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestCostHelpers::test_cost_category_constants -v 2>&1 | tail -3
```

Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: COST_CATEGORY_* constants (cost PR-A B.2)" -- backend/python/smartbi_compat/api/analysis_finance.py tests/python/smartbi_compat/test_analysis_finance_contract.py
```

### Task B.3: Add `_create_pie_data_item` helper

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`
- Test: `tests/python/smartbi_compat/test_analysis_finance_contract.py`

- [ ] **Step 1: Write 3 failing tests covering total>0 / total=0 / negative-row**

Add to `TestCostHelpers`:

```python
    def test_create_pie_data_item_total_positive(self):
        from smartbi_compat.api.analysis_finance import _create_pie_data_item
        from decimal import Decimal
        item = _create_pie_data_item("原材料", Decimal("60000"), Decimal("100000"))
        assert list(item.keys()) == ["category", "value", "percentage"]
        assert item["category"] == "原材料"
        assert item["value"] == 60000  # int via _decimal_to_number
        assert item["percentage"] == 60.00 or item["percentage"] == 60.0  # Java setScale(2)

    def test_create_pie_data_item_total_zero_returns_zero_percentage(self):
        from smartbi_compat.api.analysis_finance import _create_pie_data_item
        from decimal import Decimal
        item = _create_pie_data_item("原材料", Decimal("0"), Decimal("0"))
        assert item["percentage"] == 0  # Java line 1572 returns BigDecimal.ZERO

    def test_create_pie_data_item_percentage_rounding(self):
        from smartbi_compat.api.analysis_finance import _create_pie_data_item
        from decimal import Decimal
        # 1/3 * 100 = 33.3333... → Java 2-stage: divide(SCALE=4 HALF_UP)=0.3333,
        # multiply(100)=33.3300, setScale(2 HALF_UP)=33.33
        item = _create_pie_data_item("X", Decimal("1"), Decimal("3"))
        assert item["percentage"] == 33.33
```

- [ ] **Step 2: Run tests (expect 3 fail)**

```bash
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestCostHelpers -v 2>&1 | tail -10
```

Expected: 3 new tests fail with `ImportError`.

- [ ] **Step 3: Add `_create_pie_data_item` to analysis_finance.py**

Insert AFTER `_new_cost_series_entry` (added in B.1):

```python
def _create_pie_data_item(category: str, value: Decimal, total: Decimal) -> dict:
    """Java FinanceAnalysisServiceImpl.createPieDataItem line 1566-1573 1:1 mirror.

    LinkedHashMap key 顺序: [category, value, percentage]
    percentage = (value/total * 100).setScale(DISPLAY_SCALE=2, HALF_UP) if total > 0 else BigDecimal.ZERO
    Java 2-stage divide: divide(total, SCALE=4, HALF_UP).multiply(100).setScale(2, HALF_UP)
    """
    if total > Decimal("0"):
        # Java line 1571: divide(total, SCALE=4, HALF_UP) → multiply(100) → setScale(2, HALF_UP)
        percentage = (
            (value / total).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            * Decimal("100")
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    else:
        percentage = Decimal("0")

    return {
        "category":   category,
        "value":      _decimal_to_number(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        "percentage": _decimal_to_number(percentage),
    }
```

- [ ] **Step 4: Run tests (expect 3 pass)**

```bash
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestCostHelpers -v 2>&1 | tail -10
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: _create_pie_data_item LinkedHashMap factory (cost PR-A B.3)" -- backend/python/smartbi_compat/api/analysis_finance.py tests/python/smartbi_compat/test_analysis_finance_contract.py
```

### Task B.4: Add `_aggregate_cost_by_period` helper

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`
- Test: `tests/python/smartbi_compat/test_analysis_finance_contract.py`

- [ ] **Step 1: Write 2 failing tests (single-month + multi-month with .abs())**

Add to `TestCostHelpers`:

```python
    def test_aggregate_cost_by_period_single_month(self):
        from smartbi_compat.api.analysis_finance import _aggregate_cost_by_period
        from decimal import Decimal
        from datetime import date
        rows = [{
            "material_cost": Decimal("60000"),
            "labor_cost": Decimal("30000"),
            "overhead_cost": Decimal("10000"),
            "total_cost": Decimal("100000"),
            "record_date": date(2025, 6, 15),
        }]
        result = _aggregate_cost_by_period(rows, "MONTH")
        assert "2025-06" in result
        slot = result["2025-06"]
        assert slot[0] == Decimal("60000")  # material
        assert slot[1] == Decimal("30000")  # labor
        assert slot[2] == Decimal("10000")  # overhead
        assert slot[3] == Decimal("100000")  # total

    def test_aggregate_cost_by_period_negative_abs_defensive(self):
        from smartbi_compat.api.analysis_finance import _aggregate_cost_by_period
        from decimal import Decimal
        from datetime import date
        # Java P0-1 Bug B: Excel 历史数据可能存负值 cost，所有成本项 .abs() 强制取正
        rows = [{
            "material_cost": Decimal("-50000"),  # negative
            "labor_cost": None,  # None → skip per Rule 1
            "overhead_cost": Decimal("0"),  # zero is valid (not None)
            "total_cost": Decimal("-50000"),
            "record_date": date(2025, 6, 1),
        }]
        result = _aggregate_cost_by_period(rows, "MONTH")
        slot = result["2025-06"]
        assert slot[0] == Decimal("50000")  # abs(-50000)
        assert slot[1] == Decimal("0")  # None skipped, slot remains 0
        assert slot[2] == Decimal("0")  # 0 valid contribution
        assert slot[3] == Decimal("50000")  # abs(-50000)
```

- [ ] **Step 2: Run tests (expect fail)**

```bash
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestCostHelpers -v 2>&1 | tail -10
```

Expected: 2 new tests fail.

- [ ] **Step 3: Add `_aggregate_cost_by_period` to analysis_finance.py**

Insert AFTER `_create_pie_data_item`:

```python
def _aggregate_cost_by_period(
    cost_records: list[dict], period: str
) -> dict[str, list[Decimal]]:
    """Java FinanceAnalysisServiceImpl.aggregateCostByPeriod line 1452-1467 1:1 mirror.

    TreeMap → Python dict (后续 sorted() 排序)。每 period 4 个 BigDecimal:
    [material, labor, overhead, total]，全部 .abs() defensive (Java P0-1 Bug B).
    Rule 1: is not None 三元，禁 truthy fallback (skip None entirely; preserve Decimal("0"))。
    """
    result: dict[str, list[Decimal]] = {}
    for c in cost_records:
        key = _get_period_key(c["record_date"], period)
        slot = result.setdefault(key, [Decimal("0")] * 4)
        if c.get("material_cost") is not None:
            slot[0] += abs(_to_decimal(c["material_cost"]))
        if c.get("labor_cost") is not None:
            slot[1] += abs(_to_decimal(c["labor_cost"]))
        if c.get("overhead_cost") is not None:
            slot[2] += abs(_to_decimal(c["overhead_cost"]))
        if c.get("total_cost") is not None:
            slot[3] += abs(_to_decimal(c["total_cost"]))
    return result
```

- [ ] **Step 4: Run tests (expect pass)**

```bash
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestCostHelpers -v 2>&1 | tail -10
```

Expected: all `TestCostHelpers` tests pass (B.1+B.2+B.3+B.4 = 7 tests).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: _aggregate_cost_by_period TreeMap mirror (cost PR-A B.4)" -- backend/python/smartbi_compat/api/analysis_finance.py tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

## Phase C — Sub-services real impl

### Task C.1: Upgrade `_get_cost_structure_chart` stub → real impl

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (replace stub function body + change signature)

- [ ] **Step 1: Find current stub**

```bash
grep -n "async def _get_cost_structure_chart" backend/python/smartbi_compat/api/analysis_finance.py
```

Expected: one line with current signature `async def _get_cost_structure_chart(factory_id: str, range_: DateRange) -> dict:`。Note line number for replace.

- [ ] **Step 2: Replace stub body with real impl (incl. signature change)**

Use Edit tool to replace the entire current stub block (from `async def _get_cost_structure_chart(factory_id: str, range_: DateRange) -> dict:` through the closing `)` of `return _new_chart_config_dict(...)` of stub) with:

```python
async def _get_cost_structure_chart(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Java FinanceAnalysisServiceImpl.getCostStructureChart line 499-540 1:1 mirror.

    Composite + per-type 共享。Signature changed from (factory_id, range_: DateRange)
    to (factory_id, start_date, end_date) per Rule 3 (Java getCostStructureChart 签名)。
    Composite caller (_get_comprehensive_finance_analysis) updated in Phase E.

    F999 empty case: cost_records=[] → totalCost=0 → empty data list with full options。
    """
    cost_records = await _query_finance_data(factory_id, "COST", start_date, end_date)

    # Java line 507-516: aggregate three cost categories with .abs() defensive (Rule 1)
    material_cost = sum(
        (abs(_to_decimal(r["material_cost"])) for r in cost_records
         if r.get("material_cost") is not None),
        Decimal("0"),
    )
    labor_cost = sum(
        (abs(_to_decimal(r["labor_cost"])) for r in cost_records
         if r.get("labor_cost") is not None),
        Decimal("0"),
    )
    overhead_cost = sum(
        (abs(_to_decimal(r["overhead_cost"])) for r in cost_records
         if r.get("overhead_cost") is not None),
        Decimal("0"),
    )

    total_cost = material_cost + labor_cost + overhead_cost

    # Java line 521-526: data items only if total > 0; empty list otherwise
    chart_data: list[dict] = []
    if total_cost > Decimal("0"):
        chart_data.append(_create_pie_data_item(COST_CATEGORY_MATERIAL, material_cost, total_cost))
        chart_data.append(_create_pie_data_item(COST_CATEGORY_LABOR,    labor_cost,    total_cost))
        chart_data.append(_create_pie_data_item(COST_CATEGORY_OVERHEAD, overhead_cost, total_cost))

    # Java line 528-530 LinkedHashMap → Python insertion order
    options = {
        "showPercentage": True,
        "colors": ["#5470c6", "#91cc75", "#fac858"],
    }

    return _new_chart_config_dict(
        chart_type="PIE",
        title="成本结构分析",
        series_field=None,
        data=chart_data,
        options=options,
        xaxis_field="category",
        yaxis_field="value",
    )
```

- [ ] **Step 3: Verify pytest still imports analysis_finance.py without ImportError**

```bash
python -c "from smartbi_compat.api.analysis_finance import _get_cost_structure_chart; print('OK')"
```

Expected: `OK`. If `ImportError` or `SyntaxError`, fix typo before proceeding.

- [ ] **Step 4: Composite test will fail because caller mismatch — acknowledge, defer to Phase E**

Run only TestCostHelpers to confirm B.* still pass (and didn't break by accident):

```bash
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestCostHelpers -v 2>&1 | tail -10
```

Expected: all 7 helper tests still pass。Composite test failures (if any) are expected and addressed in Phase E.

- [ ] **Step 5: Commit (intermediate, composite still broken)**

```bash
git commit -m "WIP: _get_cost_structure_chart real impl + signature change (cost PR-A C.1)" -- backend/python/smartbi_compat/api/analysis_finance.py
```

### Task C.2: Add `_get_cost_trend_chart` (new sub-service)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`

- [ ] **Step 1: Insert new function AFTER `_get_cost_structure_chart`**

Add this code block:

```python
async def _get_cost_trend_chart(
    factory_id: str, start_date: date, end_date: date, period: str = "MONTH"
) -> dict:
    """Java FinanceAnalysisServiceImpl.getCostTrendChart line 542-581 1:1 mirror.

    Per-type 唯一调用方（composite 路径不调）。空数据 → empty chart_data，
    options 完整保留。Period default "MONTH" matches Java line 246 controller call。
    """
    cost_records = await _query_finance_data(factory_id, "COST", start_date, end_date)

    aggregated = _aggregate_cost_by_period(cost_records, period)

    # Java line 553-562 LinkedHashMap chart point: [period, materialCost, laborCost, overheadCost, totalCost]
    chart_data = []
    for period_key in sorted(aggregated.keys()):  # TreeMap → sorted Python
        values = aggregated[period_key]  # [material, labor, overhead, total]
        chart_data.append({
            "period":       period_key,
            "materialCost": _decimal_to_number(values[0].quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "laborCost":    _decimal_to_number(values[1].quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "overheadCost": _decimal_to_number(values[2].quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "totalCost":    _decimal_to_number(values[3].quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        })

    # Java line 564-570: LinkedHashMap[stack, series] outer; series items Map.of(2) {name, stack}
    options = {
        "stack": True,
        "series": [
            _new_cost_series_entry(name=COST_CATEGORY_MATERIAL, stack="cost"),
            _new_cost_series_entry(name=COST_CATEGORY_LABOR,    stack="cost"),
            _new_cost_series_entry(name=COST_CATEGORY_OVERHEAD, stack="cost"),
        ],
    }

    return _new_chart_config_dict(
        chart_type="BAR",
        title="成本趋势分析",
        series_field="costType",
        data=chart_data,
        options=options,
        xaxis_field="period",
        yaxis_field="totalCost",
    )
```

- [ ] **Step 2: Write empty-data test for `_get_cost_trend_chart`**

Add to `TestCostHelpers`:

```python
    @pytest.mark.asyncio
    async def test_get_cost_trend_chart_empty_returns_full_options(self, monkeypatch):
        from smartbi_compat.api.analysis_finance import _get_cost_trend_chart
        from datetime import date

        async def fake_query(factory_id, record_type, start, end):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_data",
            fake_query,
        )

        result = await _get_cost_trend_chart("F999", date(2025, 1, 1), date(2025, 12, 31))
        assert result["chartType"] == "BAR"
        assert result["title"] == "成本趋势分析"
        assert result["data"] == []
        assert result["options"]["stack"] is True
        assert len(result["options"]["series"]) == 3
        assert result["options"]["series"][0] == {"name": "原材料", "stack": "cost"}
        assert result["options"]["series"][1] == {"name": "人工", "stack": "cost"}
        assert result["options"]["series"][2] == {"name": "制造费用", "stack": "cost"}
```

- [ ] **Step 3: Verify import + run test**

```bash
python -c "from smartbi_compat.api.analysis_finance import _get_cost_trend_chart; print('OK')"
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestCostHelpers::test_get_cost_trend_chart_empty_returns_full_options -v 2>&1 | tail -3
```

Expected: import OK + test passes (1 passed).

If `pytest.mark.asyncio` not recognized, ensure pytest-asyncio is installed (already in requirements).

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: _get_cost_trend_chart sub-service real impl (cost PR-A C.2)" -- backend/python/smartbi_compat/api/analysis_finance.py tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

## Phase D — Per-type assembler + route handler

### Task D.1: Add `_get_cost_analysis` per-type assembler

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`

- [ ] **Step 1: Insert assembler AFTER `_get_cost_trend_chart`**

```python
async def _get_cost_analysis(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Java SmartBIAnalysisController.getFinanceAnalysis cost branch line 247-249.

    Java HashMap put order: startDate / endDate / structureChart / trendChart
    Recorded F999 Jackson order (HashMap hash, NOT put-order):
      [endDate, trendChart, startDate, structureChart]
    Source: tests/fixtures/java-smartbi-golden/analysis-finance-F999-cost.json
    """
    structure_chart = await _get_cost_structure_chart(factory_id, start_date, end_date)
    trend_chart     = await _get_cost_trend_chart(factory_id, start_date, end_date, "MONTH")

    return {
        "endDate":        end_date.isoformat(),
        "trendChart":     trend_chart,
        "startDate":      start_date.isoformat(),
        "structureChart": structure_chart,
    }
```

- [ ] **Step 2: Verify import**

```bash
python -c "from smartbi_compat.api.analysis_finance import _get_cost_analysis; print('OK')"
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: _get_cost_analysis per-type assembler (cost PR-A D.1)" -- backend/python/smartbi_compat/api/analysis_finance.py
```

### Task D.2: Wire route handler `analysisType=cost` branch + drop "cost" from 501 test

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (route handler)
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py` (501 test loop)

- [ ] **Step 1: Find route handler**

```bash
grep -n "if analysisType ==" backend/python/smartbi_compat/api/analysis_finance.py | head -5
```

Expected: lines for `if not analysisType:` (composite), `if analysisType == "payable":`, `if analysisType == "profit":`.

- [ ] **Step 2: Add cost branch BEFORE the `wrap_response(data=None, success=False, code=501, ...)` fallback**

Insert this block immediately before the 501 fallback:

```python
    if analysisType == "cost":
        result = await _get_cost_analysis(auth.factory_id, startDate, endDate)
        return wrap_response(result)
```

The exact placement: after the existing `if analysisType == "profit":` branch, before the 501 fallback.

- [ ] **Step 3: Update 501 test loop — C3 robust pattern**

Find the existing test method:

```python
def test_f999_unimplemented_analysisType_returns_501(self, client):
    """Verify 501 path for un-ported analysisTypes (payable + profit now real impl, excluded)."""
    for at in ["cost", "receivable", "budget"]:
```

Replace with:

```python
def test_f999_unimplemented_analysisType_returns_501(self, client):
    """Verify 501 path for un-ported analysisTypes.

    C3 robust pattern: list reflects current main state at time of this PR.
    profit/payable/cost are real impl; receivable + budget remain 501 until their PR-As merge.
    Sister chats merging concurrently must rebase + regenerate this list (drop their endpoint).
    """
    for at in ["receivable", "budget"]:
        resp = client.get(
            f"/api/mobile/F999/smart-bi/analysis/finance"
            f"?startDate=2025-01-01&endDate=2025-12-31&analysisType={at}",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code} for analysisType={at}"
        body = resp.json()
        assert body["success"] is False, f"expected success=false for analysisType={at}"
        assert body["code"] == 501, f"expected code=501 for analysisType={at}, got {body['code']}"
        assert at in body["message"], f"expected '{at}' in message, got: {body['message'][:100]}"
```

(The body of the for-loop is unchanged — only the iter list and docstring change.)

- [ ] **Step 4: Run only the 501 test to verify it still passes after list change**

```bash
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceComposite::test_f999_unimplemented_analysisType_returns_501 -v 2>&1 | tail -5
```

Expected: `1 passed`. (Cost endpoint now returns 200, not 501; loop excludes it. Receivable + budget still return 501.)

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: route handler analysisType=cost + drop cost from 501 test (cost PR-A D.2)" -- backend/python/smartbi_compat/api/analysis_finance.py tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

## Phase E — Composite caller refactor + verify

### Task E.1: Update `_get_comprehensive_finance_analysis` cost call site

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py`

- [ ] **Step 1: Find composite caller**

```bash
grep -n "_get_cost_structure_chart(factory_id, range_)" backend/python/smartbi_compat/api/analysis_finance.py
```

Expected: one line inside `_get_comprehensive_finance_analysis`.

- [ ] **Step 2: Update the call site signature**

Use Edit to change:

```python
    cost_structure   = await _get_cost_structure_chart(factory_id, range_)
```

to:

```python
    cost_structure   = await _get_cost_structure_chart(factory_id, range_.start_date, range_.end_date)
```

- [ ] **Step 3: Verify import (no signature mismatch)**

```bash
python -c "from smartbi_compat.api.analysis_finance import _get_comprehensive_finance_analysis; print('OK')"
```

Expected: `OK`.

- [ ] **Step 4: Run composite byte gate test (must pass after caller fix)**

```bash
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceComposite::test_f999_composite_byte_shape -v 2>&1 | tail -5
```

Expected: `1 passed`. Real-impl `_get_cost_structure_chart` on F999 empty case (cost_records=[]) produces same byte-shape as the previous stub: `chartType=PIE`, `data=[]`, `options={showPercentage: true, colors: [...]}`, `seriesField=null`, `xaxisField=category`, `yaxisField=value`.

If it fails: investigate. dict-eq tolerates `0 == 0.0` etc, so likely a missing key or wrong type.

- [ ] **Step 5: Run composite key-order test (must pass)**

```bash
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceComposite::test_f999_composite_data_keys_match_golden -v 2>&1 | tail -3
```

Expected: `1 passed`. Top-level data keys order unchanged (`[overview, costStructure, dateRange, generatedAt, profitMetrics, receivableAging]`).

- [ ] **Step 6: Commit**

```bash
git commit -m "fix: composite caller cost_structure signature (cost PR-A E.1)" -- backend/python/smartbi_compat/api/analysis_finance.py
```

---

## Phase F — Contract test class for cost per-type

### Task F.1: Add `TestAnalysisFinanceCost` class with 2 byte-gate tests

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py`

- [ ] **Step 1: Find the existing `TestAnalysisFinancePayable` class**

```bash
grep -n "^class TestAnalysisFinance" tests/python/smartbi_compat/test_analysis_finance_contract.py
```

Expected: `TestAnalysisFinanceComposite`, `TestAnalysisFinancePayable`, `TestCostHelpers` (added in B.1).

- [ ] **Step 2: Insert new `TestAnalysisFinanceCost` class AFTER `TestAnalysisFinancePayable`**

Add this code:

```python
class TestAnalysisFinanceCost:
    """F999 byte-shape gate for cost per-type path (analysisType=cost, real impl).

    Mocks _query_finance_data to return [] (matches F999 empty state).
    Compares response['data'] against recorded golden (flat shape via golden conversion in A.2).
    """

    def test_f999_cost_data_keys_match_golden(self, client, monkeypatch):
        """Sanity: top-level data keys order matches Jackson HashMap order in golden.

        Golden order (Apr 29 recorded): [endDate, trendChart, startDate, structureChart]
        """
        async def fake_query(_factory_id, _record_type, _start, _end):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_data",
            fake_query,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance"
            "?startDate=2025-01-01&endDate=2025-12-31&analysisType=cost",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        py_data_keys = list(resp.json()["data"].keys())

        with io.open(GOLDEN_DIR / "analysis-finance-F999-cost.json", encoding="utf-8") as f:
            golden_data_keys = list(json.load(f)["data"].keys())

        assert py_data_keys == golden_data_keys, (
            f"data key order mismatch:\n"
            f"  python: {py_data_keys}\n"
            f"  golden: {golden_data_keys}"
        )

    def test_f999_cost_byte_shape(self, client, monkeypatch):
        """Full byte-shape compare on data block (envelope skipped via _strip_volatile).

        Mocks _query_finance_data to return [] (F999 empty state).
        Compares response['data'] against recorded golden after stripping volatile keys.
        """
        async def fake_query(_factory_id, _record_type, _start, _end):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_data",
            fake_query,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance"
            "?startDate=2025-01-01&endDate=2025-12-31&analysisType=cost",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200

        py_data = _strip_volatile(resp.json()["data"])

        with io.open(GOLDEN_DIR / "analysis-finance-F999-cost.json", encoding="utf-8") as f:
            golden_data = _strip_volatile(json.load(f)["data"])

        if py_data != golden_data:
            diffs = {}
            for k in set(py_data.keys()) | set(golden_data.keys()):
                if py_data.get(k) != golden_data.get(k):
                    diffs[k] = {
                        "python": py_data.get(k),
                        "golden": golden_data.get(k),
                    }
            pytest.fail(
                f"BYTE SHAPE MISMATCH (cost) on {list(diffs.keys())}\n"
                f"{json.dumps(diffs, indent=2, ensure_ascii=False)[:2000]}"
            )
```

- [ ] **Step 3: Run the two new tests**

```bash
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceCost -v 2>&1 | tail -10
```

Expected: 2 passed.

If `test_f999_cost_data_keys_match_golden` fails:
- Inspect diff: `diff <(python -c "import json; print(list(json.load(open('tests/fixtures/java-smartbi-golden/analysis-finance-F999-cost.json'))['data'].keys()))") <(...assembler output...)`
- Likely fix: re-order assembler dict literal in `_get_cost_analysis` to match golden's actual key order.

If `test_f999_cost_byte_shape` fails:
- Pytest will dump the diff dict — investigate which key differs.
- Common causes: `value: 0.0` vs `0.00` (dict-eq tolerates), `seriesField: null` missing, `options.colors` array missing.

- [ ] **Step 4: Commit**

```bash
git commit -m "test: TestAnalysisFinanceCost F999 byte-gate (cost PR-A F.1)" -- tests/python/smartbi_compat/test_analysis_finance_contract.py
```

### Task F.2: Run full pytest baseline + verify

**Files:** None (verification only)

- [ ] **Step 1: Run full smartbi_compat pytest suite**

```bash
cd C:/Users/Steve/my-prototype-logistics/.worktrees/phase2a-finance-cost
python -m pytest tests/python/smartbi_compat/ --tb=line -q 2>&1 | tail -3
```

Expected: `253 passed` (244 baseline + 7 TestCostHelpers + 1 cost trend chart helper test + 2 TestAnalysisFinanceCost = 254 — verify exact count and adjust expectation if intermediate task added more tests).

If failure count > 0:
- Read failures, identify which test
- Fix and re-run

- [ ] **Step 2: Verify no regressions in TestAnalysisFinanceComposite + TestAnalysisFinancePayable**

```bash
python -m pytest tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceComposite tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinancePayable -v 2>&1 | tail -10
```

Expected: all pass.

---

## Phase G — Push + PR

### Task G.1: Pre-push diff scope review

**Files:** None (review only)

- [ ] **Step 1: Review accumulated commits**

```bash
git log --oneline origin/main..HEAD
```

Expected ~10 commits: A.2 golden conversion + B.1-B.4 helpers/constants + C.1-C.2 sub-services + D.1-D.2 assembler/route + E.1 composite caller fix + F.1 contract tests。

- [ ] **Step 2: Review full diff scope**

```bash
git diff --stat origin/main..HEAD
```

Expected: 3 files changed
- `backend/python/smartbi_compat/api/analysis_finance.py` (+~150 lines)
- `tests/python/smartbi_compat/test_analysis_finance_contract.py` (+~120 lines)
- `tests/fixtures/java-smartbi-golden/analysis-finance-F999-cost.json` (+~60, golden converted from envelope)
- `tests/fixtures/java-smartbi-golden/analysis-finance-type-cost-F999.json` (-67, deleted)

If unexpected files appear (especially `.claude/rules/python-java-port.md` if rules already on main from a sister merge), investigate before pushing.

- [ ] **Step 3: Confirm no concurrent-edit pollution**

```bash
git status --short
```

Expected: empty (clean working tree).

### Task G.2: Push branch + create PR

**Files:** None (git operations)

- [ ] **Step 1: Force-push rebased branch**

```bash
git push --force-with-lease origin phase2a/t-finance-cost
```

(Rebase rewrote spec commits with new SHAs. `--force-with-lease` is safer than `--force`: rejects push if remote moved unexpectedly.)

- [ ] **Step 2: Create PR via gh**

```bash
gh pr create --title "Phase 2A: /analysis/finance cost per-type real impl + composite shared upgrade" --body "$(cat <<'EOF'
## Summary

Implements cost per-type real impl on `/api/mobile/{factory}/smart-bi/analysis/finance?analysisType=cost`，with byte-shape parity to Java。Spec audit-passed in 3 reviewer rounds + cross-spec audit。

## Changes

### Real impl (composite + per-type 共享 sub-service swap)
- `_get_cost_structure_chart`: stub → real impl，signature change `(range_: DateRange) → (start_date, end_date)` per Rule 3
- `_get_cost_trend_chart`: NEW per-type only sub-service
- `_get_cost_analysis`: NEW per-type assembler, 4-key dict `[endDate, trendChart, startDate, structureChart]`

### New helpers (Java 1:1 mirror)
- `_create_pie_data_item(category, value, total)` — LinkedHashMap [category, value, percentage]
- `_aggregate_cost_by_period(rows, period)` — TreeMap → sorted dict[str, list[Decimal][4]]
- `_new_cost_series_entry(name, stack)` — Map.of(2) factory

### Constants
- `COST_CATEGORY_MATERIAL/LABOR/OVERHEAD = "原材料"/"人工"/"制造费用"`

### Composite caller refactor
- `_get_comprehensive_finance_analysis` updates `_get_cost_structure_chart(factory_id, range_)` → `(factory_id, range_.start_date, range_.end_date)`
- Composite F999 byte gate verified to still pass (real impl on empty data produces same shape as stub)

### Test
- New `TestAnalysisFinanceCost` (2 tests F999 byte gate)
- Existing `test_f999_unimplemented_analysisType_returns_501` updated: drop "cost" from iter list (now `["receivable", "budget"]`); C3 robust pattern documented inline

### Golden file
- Convert envelope-shape `analysis-finance-type-cost-F999.json` → flat-shape `analysis-finance-F999-cost.json`
- Source content preserved exactly (Java live recording from Apr 29)

## Test plan

- [ ] Full smartbi_compat pytest passes (244 baseline + new tests = 254+)
- [ ] No regressions in `TestAnalysisFinanceComposite` or `TestAnalysisFinancePayable`
- [ ] `TestAnalysisFinanceCost` 2 tests pass (F999 byte-gate)
- [ ] `TestCostHelpers` 8 tests pass (PR-A helper unit tests; will be supplanted by PR-B `TestCostStructureArithmetic` + `TestCostTrendArithmetic` ~11 tests)
- [ ] Manual smoke (post-deploy): test env Java vs Python `/analysis/finance?analysisType=cost` dict-eq diff (record-java-golden.sh positional CLI per C2 known bug; manual two-step diff)

## Spec + sister chats

- Spec: `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-cost-design.md`
- Rules file: `.claude/rules/python-java-port.md` (ships with this PR; sister receivable/budget cherry-pick when they merge)
- Sister specs ready: receivable (`phase2a/t-finance-receivable`), budget (`phase2a/t-finance-budget`)
- INDEX cross-link: `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-INDEX.md` (on receivable branch; updated when receivable merges)

## Out of scope (PR-B)

- 11 algorithm depth unit tests in `TestCostStructureArithmetic` + `TestCostTrendArithmetic` — separate follow-up PR

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Verify PR URL returned**

Expected: GitHub PR URL printed。Open in browser to verify CI runs。

---

## Self-Review (post-write checklist)

**Spec coverage:** All §3 algorithms (3.2 structureChart / 3.3 trendChart / 3.4 query reuse / 3.5 assembler / 3.6 route) covered by tasks B + C + D。Composite caller refactor (cost spec §2.1 ~ line) covered by E。Audit constraints (rules file) inherited via this branch already shipping rules in earlier commit。F999 byte gate (§4) covered by F.1。Out-of-scope PR-B (§5.2) explicitly excluded。

**Placeholder scan:** No TODO/TBD/placeholder text in any task。All code blocks complete and copy-pasteable。

**Type consistency:** `_get_cost_structure_chart` signature consistent across all callers (assembler in D.1, composite in E.1)。`_aggregate_cost_by_period` returns `dict[str, list[Decimal]]` with exactly 4 elements per slot (verified in B.4 test)。

---

## Next steps after PR-A merged

1. Pull main → rebase remaining sister branches (`phase2a/t-finance-receivable`, `phase2a/t-finance-budget`)
2. Sister chats run their own PR-A plans
3. Cost PR-B (~11 arithmetic depth tests) — separate plan, ~2 hr work
