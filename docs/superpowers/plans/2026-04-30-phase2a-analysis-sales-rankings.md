# Phase 2A `/analysis/sales` Rankings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 3 ranking stubs (`_get_salesperson_ranking`, `_get_product_ranking`, `_get_customer_ranking`) in `backend/python/smartbi_compat/api/analysis_sales.py` with real impls via a generic `_build_ranking()` helper. Mirrors Java `SalesAnalysisServiceImpl.getSalespersonRanking/getProductRanking/getCustomerRanking` (line 371-400 / 491-533 / 550-593) with composite sort key for stability.

**Architecture:**
- **Generic builder + 3 thin wrappers**: `_build_ranking(name_to_value, *, top_n, with_percentage, target_map)` covers all 3 ranking variants. Each caller is ~10 LOC: aggregate raw rows from `_query_sales_data`, dispatch to helper.
- **In-process aggregation** via `_query_sales_data` (raw rows) per spec §4-§6 — NOT SQL GROUP BY. This is a deliberate choice: one mocking seam, byte-parity with Java's stream-aggregate behavior, simpler null/precision handling.
- **REUSE existing overview helpers**: `_calculate_completion_rate`, `_determine_completion_alert_level`, `TARGET_RED_THRESHOLD`/`TARGET_YELLOW_THRESHOLD`, `SCALE`/`DISPLAY_SCALE` already added by PR #15 overview impl — DO NOT redefine.
- **Composite sort key `(-value, name)`** for tie stability — Python-side fix only (Java keeps HashMap-grouping; spec §7 explains).

**Tech Stack:** Python 3 / `decimal.Decimal` (ROUND_HALF_UP) / SQLAlchemy `text()` (existing) / pytest / `unittest.mock.patch`

**Estimate:** ~3-4h, 12-14 tasks across 5 phases (Phase D deploy + golden re-record DEFERRED to end of rankings + trend batch).

**Branch / Worktree:** `phase2a/sales-rankings` derived from `origin/main` (HEAD `38b545d0c`). Sub-worktree at `.worktrees/phase2a-sales-rankings`. Sibling chats may be running on other Phase 2A worktrees (e.g. trend, finance) — concurrent-edit safety rule 5b applies.

**Critical rules:**
1. **Concurrent-edit safety**: every commit uses `git commit -m "msg" -- <paths>` (`--only` mode) per `.claude/rules/concurrent-edit-safety.md` rule 5b.
2. **NO Java modifications**: Python-side only per spec §7. Java's HashMap-based grouping stays as-is; we sort stably in Python.
3. **REUSE before redefine**: many helpers were added by overview impl (PR #15). Phase A.2 verifies the inventory.
4. **TDD per task**: write failing test → run to fail → impl → run to pass → commit.
5. **No regression**: 199 baseline tests (foundation+gold+overview) must stay green at end of Phase B and Phase C.
6. **Phase D deploy + golden re-record** is in the plan but **DEFERRED execution** per user instruction — run only after rankings + trend both shipped, batched together.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `backend/python/smartbi_compat/api/analysis_sales.py` | MODIFY (additions only, ~150 LOC) | Add `_build_ranking` generic helper + replace 3 ranking stubs with real impls (~10 LOC each) |
| `tests/python/smartbi_compat/test_analysis_sales_contract.py` | MODIFY (append `TestRankings` class) | 4 tests covering tie-stability + 3 ranking variants + Top-10 cap |

**File size after rankings**: analysis_sales.py grows from ~1300 → ~1450 LOC. Test file grows from current ~1230 → ~1430 LOC. Both within acceptable single-file scope per overview-spec precedent.

**No new files**. No module restructure. No conftest fixture changes.

---

## Phase A — Pre-impl checks (~15-30 min, 2 tasks)

### Task A.1: Pre-flight — verify worktree, baseline tests, foundation stubs

**Files:**
- Read-only: `backend/python/smartbi_compat/api/analysis_sales.py`
- Read-only: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

**Goal:** Confirm sub-worktree is on the right branch, 199 baseline tests pass, and the 3 ranking stubs are still in their foundation state (returning `[]`).

- [ ] **Step 1: Verify worktree state**

```bash
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-sales-rankings
pwd                              # ends in -sales-rankings
git rev-parse --abbrev-ref HEAD  # phase2a/sales-rankings
git log --oneline -1             # 38b545d0c (Phase 2B-α merge — origin/main HEAD)
git status --short               # empty
```

If any check fails, STOP and reconcile.

- [ ] **Step 2: Run baseline pytest (must pass 199)**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/ -q --tb=line 2>&1 | tail -5
```

Expected: `199 passed` (foundation 5 + alerts/recommendations + gold 6 + overview 38 + other smartbi_compat = 199)

If any baseline test fails, STOP — investigate before proceeding.

- [ ] **Step 3: Locate the 3 ranking stubs**

```bash
grep -nA5 "async def _get_salesperson_ranking\|async def _get_product_ranking\|async def _get_customer_ranking" backend/python/smartbi_compat/api/analysis_sales.py
```

Expected: 3 stub functions each returning `[]` (foundation state). They were defined in foundation+gold (around line 642-657 of analysis_sales.py).

If any of the 3 returns something other than `[]` (e.g. real impl already exists), STOP — possibly already shipped and we shouldn't redo.

- [ ] **Step 4: No commit — verification only**

---

### Task A.2: Inventory existing helpers — identify reusable from overview

**Files:**
- Read-only: `backend/python/smartbi_compat/api/analysis_sales.py`

**Goal:** Map which helpers/constants from overview impl (PR #15) we REUSE vs which we ADD. Critical for not duplicating code.

- [ ] **Step 1: Verify these helpers already exist (added by overview, REUSE)**

```bash
grep -nE "^def _calculate_completion_rate|^def _determine_completion_alert_level|^def _alert_level_to_status|^TARGET_RED_THRESHOLD|^TARGET_YELLOW_THRESHOLD|^SCALE\b|^DISPLAY_SCALE|^def _to_decimal\b|^def _decimal_to_number\b" backend/python/smartbi_compat/api/analysis_sales.py
```

Expected matches (from overview Section 0):
- `_calculate_completion_rate(actual, target)` — Java line 1166-1171 mirror
- `_determine_completion_alert_level(rate)` — Java line 1176-1184 mirror
- `_alert_level_to_status(alert_level)` — KPICard mapping
- `TARGET_RED_THRESHOLD = Decimal("60")`
- `TARGET_YELLOW_THRESHOLD = Decimal("85")`
- `SCALE = 4`
- `DISPLAY_SCALE = 2`
- `_to_decimal(v)` (foundation helper)
- `_decimal_to_number(v)` (foundation, Decimal → JSON Number for byte parity)

If ANY of these are MISSING, the rankings plan needs adjustment — those helpers were assumed reusable. If something is missing, STOP and report so plan can adjust.

- [ ] **Step 2: Verify `_new_ranking_item_dict` (foundation factory) exists**

```bash
grep -nA15 "^def _new_ranking_item_dict" backend/python/smartbi_compat/api/analysis_sales.py
```

Expected: 6-field factory (rank/name/value/target/completion_rate/alert_level) with sensible defaults (target/completion_rate/alert_level all default to None).

- [ ] **Step 3: Verify `_query_sales_data` exists in `analysis.py` and returns rows with 6 columns**

```bash
grep -nA10 "^def _query_sales_data\|^async def _query_sales_data" backend/python/smartbi_compat/api/analysis.py
```

Or check by reading the import at top of analysis_sales.py:

```bash
grep -n "_query_sales_data" backend/python/smartbi_compat/api/analysis_sales.py | head -3
```

Expected: `from smartbi_compat.api.analysis import _query_sales_data, wrap_response`. The helper returns rows with at least: salesperson_name, amount, monthly_target, product_category, customer_name, order_date (per foundation §6).

If `_query_sales_data` isn't returning all 6 columns we need, STOP — foundation was supposed to extend it.

- [ ] **Step 4: Verify `asyncio` is imported in analysis_sales.py**

```bash
grep -n "^import asyncio" backend/python/smartbi_compat/api/analysis_sales.py
```

Expected: present (overview impl uses `await asyncio.to_thread(...)` for SQL).

- [ ] **Step 5: No commit — verification only. Document findings inline if any unexpected.**

---

## Phase B — Code creation (~60-90 min, 5 tasks)

### Task B.1: Add `_build_ranking` generic helper

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py`
- Test: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

**Goal:** Add generic ranking builder with composite sort key `(-value, name)`. The 3 caller wrappers in B.3-B.5 all delegate here.

- [ ] **Step 1: Append failing test to test_analysis_sales_contract.py**

```python
# ============================================================
# TestRankings — rankings sub-spec contract tests
# ============================================================


class TestRankings:
    """Sibling sub-spec: rankings. Generic _build_ranking + 3 caller wrappers.

    Foundation gates TestEnvelope; gold gates TestGold; overview gates TestOverview;
    rankings (this class) gates the 3 ranking sub-services + tie stability.
    """

    def test_build_ranking_basic_sort_desc(self):
        """Generic builder sorts by value DESC. No target, no percentage."""
        from smartbi_compat.api.analysis_sales import _build_ranking
        from decimal import Decimal

        result = _build_ranking({
            "A": Decimal("100"),
            "B": Decimal("300"),
            "C": Decimal("200"),
        })
        assert len(result) == 3
        assert [r["name"] for r in result] == ["B", "C", "A"]
        assert [r["rank"] for r in result] == [1, 2, 3]
        # value scaled to 0.01
        assert result[0]["value"] == Decimal("300.00")
        # No target/completion → completionRate=0.00, alertLevel="GREEN"
        assert result[0]["target"] is None
        assert result[0]["completionRate"] == Decimal("0.00")
        assert result[0]["alertLevel"] == "GREEN"

    def test_build_ranking_tie_stability_name_asc(self):
        """When values are tied, name ASC breaks tie (composite sort key)."""
        from smartbi_compat.api.analysis_sales import _build_ranking
        from decimal import Decimal

        result = _build_ranking({
            "蛋类": Decimal("100"),
            "蔬菜": Decimal("100"),
            "肉类": Decimal("200"),
        })
        # Rank 1: 肉类 (value=200, top)
        # Rank 2-3: 蛋类 vs 蔬菜 (both value=100); name ASC → 蔬 < 蛋 in Unicode? NO:
        #   "蛋"=U+86CB, "蔬"=U+852C — 蔬(0x852C) < 蛋(0x86CB) so 蔬菜 first
        # Verify by Python: ord("蔬") < ord("蛋")
        assert result[0]["name"] == "肉类"
        assert result[1]["name"] == "蔬菜"  # 蔬(U+852C) < 蛋(U+86CB) → ASC = 蔬菜 first
        assert result[2]["name"] == "蛋类"

    def test_build_ranking_top_n_cap(self):
        """top_n caps result length AFTER sort."""
        from smartbi_compat.api.analysis_sales import _build_ranking
        from decimal import Decimal

        result = _build_ranking(
            {f"P{i}": Decimal(str(100 - i)) for i in range(15)},
            top_n=10,
        )
        assert len(result) == 10
        assert result[0]["name"] == "P0"  # value=100, top
        assert result[9]["name"] == "P9"  # value=91, 10th

    def test_build_ranking_with_percentage(self):
        """with_percentage=True → completionRate = (value/total)*100, alertLevel=GREEN."""
        from smartbi_compat.api.analysis_sales import _build_ranking
        from decimal import Decimal

        result = _build_ranking(
            {"A": Decimal("400"), "B": Decimal("300"), "C": Decimal("300")},
            with_percentage=True,
        )
        # Total = 1000; A=40%, B=30%, C=30%
        assert result[0]["name"] == "A"
        assert result[0]["completionRate"] == Decimal("40.00")
        assert result[0]["alertLevel"] == "GREEN"  # hard-coded GREEN per Java line 528/588
        # Tie-broken: B/C both value=300; name ASC → B first
        assert result[1]["name"] == "B"
        assert result[2]["name"] == "C"

    def test_build_ranking_with_target_map(self):
        """target_map → completionRate = (value/target)*100, alertLevel computed."""
        from smartbi_compat.api.analysis_sales import _build_ranking
        from decimal import Decimal

        result = _build_ranking(
            {"张三": Decimal("100000"), "李四": Decimal("50000")},
            target_map={"张三": Decimal("200000"), "李四": Decimal("100000")},
        )
        # 张三: 100k/200k = 50% < TARGET_RED=60 → RED
        # 李四: 50k/100k = 50% < TARGET_RED=60 → RED
        assert result[0]["name"] == "张三"  # value=100k, top
        assert result[0]["target"] == Decimal("200000.00")
        assert result[0]["completionRate"] == Decimal("50.0000")  # SCALE=4 quantize
        assert result[0]["alertLevel"] == "RED"

    def test_build_ranking_with_target_zero_returns_zero_rate(self):
        """When target=0, completionRate=0 (Java BigDecimal.ZERO line 1167-1169)."""
        from smartbi_compat.api.analysis_sales import _build_ranking
        from decimal import Decimal

        result = _build_ranking(
            {"X": Decimal("100")},
            target_map={"X": Decimal("0")},
        )
        assert result[0]["completionRate"] == Decimal("0")
        assert result[0]["alertLevel"] == "RED"  # 0 < TARGET_RED=60
```

- [ ] **Step 2: Run tests to verify all 6 FAIL**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestRankings -v
```

Expected: 6 FAIL with `AttributeError: ... has no attribute '_build_ranking'`.

- [ ] **Step 3: Add `_build_ranking` to analysis_sales.py**

Find a good insertion point — after the existing Section 1.5 SQL helpers and before Section 1.6 / Section 2 KPI builder. Add a new section header:

```python
# ============================================================
# Section 1.7: Generic ranking builder + 3 caller wrappers (rankings spec)
# ============================================================
# Mirrors Java SalesAnalysisServiceImpl: getSalespersonRanking (371-400) /
# getProductRanking (491-533) / getCustomerRanking (550-593).
#
# Reuses existing helpers from Section 0 (overview impl):
#   - _calculate_completion_rate (Java calculateCompletionRate line 1166-1171)
#   - _determine_completion_alert_level (Java line 1176-1184)
#   - TARGET_RED_THRESHOLD / TARGET_YELLOW_THRESHOLD / SCALE / DISPLAY_SCALE
#   - _new_ranking_item_dict (foundation factory, 6 fields)


def _build_ranking(
    name_to_value: dict,
    *,
    top_n: Optional[int] = None,
    with_percentage: bool = False,
    target_map: Optional[dict] = None,
) -> list[dict]:
    """Generic ranking builder — covers salesperson / product / customer.

    Mirrors Java's three rankings methods (sort + scale + dict construction).

    Args:
        name_to_value: aggregated {name: total_amount} dict
        top_n: if set, slice to top N after sort (customer ranking uses 10)
        with_percentage: if True, completionRate = (value / total) * 100
                         (product + customer rankings)
        target_map: if provided, completionRate = (value / target) * 100
                    AND alertLevel computed from rate (salesperson ranking)

    Returns:
        list of RankingItem-shaped dicts per foundation _new_ranking_item_dict factory.

    Sort stability:
        Composite sort key (-value, name) — value DESC, name ASC for ties.
        Spec §7: Python-side fix only. Java's HashMap grouping has nondeterministic
        tie order; we stabilize on Python side.
    """
    # 1. Sort by value DESC, name ASC (tie stability)
    sorted_items = sorted(
        name_to_value.items(),
        key=lambda kv: (-kv[1], kv[0]),
    )

    # 2. Apply top_n cap if set
    if top_n is not None:
        sorted_items = sorted_items[:top_n]

    # 3. Compute total (only if needed for percentage)
    total = sum(name_to_value.values(), Decimal("0")) if with_percentage else None

    # 4. Build dicts
    rankings: list[dict] = []
    for rank, (name, value) in enumerate(sorted_items, start=1):
        target: Optional[Decimal] = None
        completion_rate: Decimal
        alert_level: str

        if target_map is not None:
            # salesperson: per-person target → completion rate + alert level
            target = target_map.get(name, Decimal("0"))
            completion_rate = _calculate_completion_rate(value, target)
            alert_level = _determine_completion_alert_level(completion_rate)
        elif with_percentage:
            # product/customer: percentage of total, alertLevel hard-coded GREEN
            if total is None or total == Decimal("0"):
                completion_rate = Decimal("0")
            else:
                completion_rate = (value / total * Decimal("100")).quantize(
                    Decimal("0.0001"), rounding=ROUND_HALF_UP,
                )
            alert_level = "GREEN"  # Java line 528 / 588 hard-codes GREEN
        else:
            completion_rate = Decimal("0")
            alert_level = "GREEN"

        rankings.append(_new_ranking_item_dict(
            rank=rank,
            name=name,
            value=value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            target=(target.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                    if target is not None else None),
            completion_rate=completion_rate.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            alert_level=alert_level,
        ))

    return rankings
```

NOTE: The `value` quantize MUST come from the un-quantized input (otherwise we lose precision in the `(value / total * 100)` step for percentage mode). Quantize only at the final dict construction.

NOTE: For `target_map` mode, `_calculate_completion_rate` already returns SCALE=4 quantized value (per overview B.4). The final `.quantize(0.01)` in the dict construction further reduces to DISPLAY_SCALE=2.

- [ ] **Step 4: Run tests to verify all 6 PASS**

```bash
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestRankings -v
```

Expected: 6 PASS.

DEBUG NOTE: If `test_build_ranking_with_target_map` fails with `assert ... == Decimal("50.0000")`, the issue may be that `_calculate_completion_rate` already returns SCALE=4 but our final `.quantize(0.01)` reduces to SCALE=2. In that case, the assertion should be `Decimal("50.00")` not `Decimal("50.0000")`. Read overview's `_calculate_completion_rate` impl to determine which is correct, then update test or impl to match.

- [ ] **Step 5: Commit**

```bash
git status --short
git commit -m "feat(phase2a-rankings): add _build_ranking generic helper (composite sort key + 3 modes: target/percentage/plain)" -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

### Task B.2: Replace `_get_salesperson_ranking` stub with real impl

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py`
- Test: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

**Goal:** Real impl aggregates SUM(amount) and SUM(monthly_target) per salesperson_name from `_query_sales_data` rows, then dispatches to `_build_ranking` with `target_map`. Mirrors Java line 371-400.

- [ ] **Step 1: Append failing test**

```python
    @pytest.mark.asyncio
    async def test_get_salesperson_ranking_full_path(self, monkeypatch):
        """Aggregates per salesperson_name with target_map, computes completion + alert."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date
        from decimal import Decimal
        from collections import namedtuple

        Row = namedtuple("Row", "salesperson_name amount monthly_target product_category customer_name order_date")

        def fake_query(factory_id, range_):
            return [
                Row("张三", Decimal("60000"), Decimal("100000"), "P1", "C1", date(2025, 1, 1)),
                Row("张三", Decimal("40000"), Decimal("100000"), "P2", "C2", date(2025, 1, 2)),
                Row("李四", Decimal("80000"), Decimal("100000"), "P3", "C3", date(2025, 1, 3)),
                Row(None, Decimal("99999"), Decimal("0"), "P4", "C4", date(2025, 1, 4)),  # null name → skip
            ]

        monkeypatch.setattr("smartbi_compat.api.analysis_sales._query_sales_data", fake_query)

        range_ = m.DateRange.custom(date(2025, 1, 1), date(2025, 1, 31))
        result = await m._get_salesperson_ranking("F999", range_)

        assert len(result) == 2  # null name skipped
        # 张三: 60k+40k = 100k sales, 100k+100k = 200k target → 50% completion → RED
        # 李四: 80k sales, 100k target → 80% completion → YELLOW (60 ≤ 80 < 85)
        assert result[0]["name"] == "张三"  # value=100k, top
        assert result[0]["value"] == Decimal("100000.00")
        assert result[0]["target"] == Decimal("200000.00")
        assert result[0]["completionRate"] == Decimal("50.00")
        assert result[0]["alertLevel"] == "RED"
        assert result[1]["name"] == "李四"
        assert result[1]["value"] == Decimal("80000.00")
        assert result[1]["target"] == Decimal("100000.00")
        assert result[1]["completionRate"] == Decimal("80.00")
        assert result[1]["alertLevel"] == "YELLOW"

    @pytest.mark.asyncio
    async def test_get_salesperson_ranking_empty_when_no_rows(self, monkeypatch):
        """No rows → empty list (foundation stub byte shape preserved)."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date

        def fake_query(factory_id, range_):
            return []

        monkeypatch.setattr("smartbi_compat.api.analysis_sales._query_sales_data", fake_query)

        range_ = m.DateRange.custom(date(2025, 1, 1), date(2025, 1, 31))
        result = await m._get_salesperson_ranking("F999", range_)
        assert result == []
```

- [ ] **Step 2: Run tests to verify FAIL**

```bash
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestRankings -v -k "get_salesperson"
```

Expected: 2 FAIL — current foundation stub returns `[]` for both, so the empty-test passes accidentally and the full-path test fails (assertions don't match `[]`).

Actually re-checking: empty test assertion `result == []` — current stub returns `[]` so this PASSES with stub. Full-path test FAILS with stub. So expected: 1 PASS (empty), 1 FAIL (full).

- [ ] **Step 3: Locate and replace `_get_salesperson_ranking` stub**

Find the existing stub:

```bash
grep -nA8 "^async def _get_salesperson_ranking" backend/python/smartbi_compat/api/analysis_sales.py
```

Replace the function body (signature stays):

```python
async def _get_salesperson_ranking(factory_id: str, range_: DateRange) -> list:
    """Real impl. Mirror Java SalesAnalysisServiceImpl.getSalespersonRanking line 371-400.

    Aggregates SUM(amount) + SUM(monthly_target) per salesperson_name from raw rows,
    then dispatches to _build_ranking with target_map for completion/alert.
    Filters null salesperson_name (Java line 379: `if (name == null) continue;`).

    No top_n cap (Java doesn't limit).

    async per foundation §5: sync SQLAlchemy `_query_sales_data` wrapped via
    `await asyncio.to_thread(...)` per foundation Phase B.6 strategy.
    """
    rows = await asyncio.to_thread(_query_sales_data, factory_id, range_)
    sales: dict = {}
    targets: dict = {}
    for row in rows:
        name = row.salesperson_name
        if name is None:
            continue
        amount = _to_decimal(row.amount) if row.amount is not None else Decimal("0")
        target = _to_decimal(row.monthly_target) if row.monthly_target is not None else Decimal("0")
        sales[name] = sales.get(name, Decimal("0")) + amount
        targets[name] = targets.get(name, Decimal("0")) + target
    return _build_ranking(sales, target_map=targets)
```

- [ ] **Step 4: Run tests to verify PASS**

```bash
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestRankings -v -k "get_salesperson"
```

Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git status --short
git commit -m "feat(phase2a-rankings): replace _get_salesperson_ranking stub with real impl (per-salesperson target_map → completion + alert)" -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

### Task B.3: Replace `_get_product_ranking` stub with real impl

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py`
- Test: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

**Goal:** Real impl aggregates SUM(amount) per product_category, dispatches with `with_percentage=True`. Mirrors Java line 491-533. No top_n cap.

- [ ] **Step 1: Append failing test**

```python
    @pytest.mark.asyncio
    async def test_get_product_ranking_with_percentage(self, monkeypatch):
        """Aggregates per product_category, completionRate = % of total, alertLevel=GREEN."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date
        from decimal import Decimal
        from collections import namedtuple

        Row = namedtuple("Row", "salesperson_name amount monthly_target product_category customer_name order_date")

        def fake_query(factory_id, range_):
            return [
                Row("X", Decimal("400"), None, "肉类", "C1", date(2025, 1, 1)),
                Row("X", Decimal("300"), None, "蔬菜", "C2", date(2025, 1, 2)),
                Row("X", Decimal("300"), None, "蛋类", "C3", date(2025, 1, 3)),
                Row("X", Decimal("99"), None, None, "C4", date(2025, 1, 4)),  # null category → skip
            ]

        monkeypatch.setattr("smartbi_compat.api.analysis_sales._query_sales_data", fake_query)

        range_ = m.DateRange.custom(date(2025, 1, 1), date(2025, 1, 31))
        result = await m._get_product_ranking("F999", range_)

        assert len(result) == 3  # null skipped
        # Total = 1000; rank by value DESC, ties name ASC
        # 肉类(400) → 40%; 蔬菜(300) tied 蛋类(300) → name ASC: 蔬<蛋 → 蔬菜 first
        assert result[0]["name"] == "肉类"
        assert result[0]["value"] == Decimal("400.00")
        assert result[0]["completionRate"] == Decimal("40.00")
        assert result[0]["alertLevel"] == "GREEN"
        assert result[0]["target"] is None
        # Tie: 蔬菜 (U+852C) < 蛋类 (U+86CB)
        assert result[1]["name"] == "蔬菜"
        assert result[2]["name"] == "蛋类"

    @pytest.mark.asyncio
    async def test_get_product_ranking_empty(self, monkeypatch):
        from smartbi_compat.api import analysis_sales as m
        from datetime import date
        monkeypatch.setattr("smartbi_compat.api.analysis_sales._query_sales_data",
                            lambda f, r: [])
        range_ = m.DateRange.custom(date(2025, 1, 1), date(2025, 1, 31))
        result = await m._get_product_ranking("F999", range_)
        assert result == []
```

- [ ] **Step 2: pytest → expect 1 FAIL (full path), 1 PASS (empty)**

```bash
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestRankings -v -k "get_product"
```

- [ ] **Step 3: Replace `_get_product_ranking` stub**

```python
async def _get_product_ranking(factory_id: str, range_: DateRange) -> list:
    """Real impl. Mirror Java SalesAnalysisServiceImpl.getProductRanking line 491-533.

    Aggregates SUM(amount) per product_category. completionRate = % of total.
    alertLevel hard-coded GREEN (Java line 528).
    Filters null product_category (Java line 499: `getProductCategory() != null`).
    No top_n cap.
    """
    rows = await asyncio.to_thread(_query_sales_data, factory_id, range_)
    sales: dict = {}
    for row in rows:
        category = row.product_category
        if category is None:
            continue
        amount = _to_decimal(row.amount) if row.amount is not None else Decimal("0")
        sales[category] = sales.get(category, Decimal("0")) + amount
    return _build_ranking(sales, with_percentage=True)
```

- [ ] **Step 4: pytest → 2 PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(phase2a-rankings): replace _get_product_ranking stub with real impl (per-category SUM, percentage of total, GREEN alert)" -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

### Task B.4: Replace `_get_customer_ranking` stub with real impl

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py`
- Test: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

**Goal:** Real impl aggregates per customer_name, dispatches with `with_percentage=True, top_n=10`. Mirrors Java line 550-593.

- [ ] **Step 1: Append failing test**

```python
    @pytest.mark.asyncio
    async def test_get_customer_ranking_top_10_cap(self, monkeypatch):
        """15 customers → only top 10 by value DESC returned."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date
        from decimal import Decimal
        from collections import namedtuple

        Row = namedtuple("Row", "salesperson_name amount monthly_target product_category customer_name order_date")

        def fake_query(factory_id, range_):
            return [
                Row("X", Decimal(str(1000 - i * 10)), None, "P", f"客户{i:02d}", date(2025, 1, 1))
                for i in range(15)
            ]

        monkeypatch.setattr("smartbi_compat.api.analysis_sales._query_sales_data", fake_query)

        range_ = m.DateRange.custom(date(2025, 1, 1), date(2025, 1, 31))
        result = await m._get_customer_ranking("F999", range_)

        assert len(result) == 10  # top_n=10 cap
        # Top: 客户00 (value=1000)
        assert result[0]["name"] == "客户00"
        assert result[0]["value"] == Decimal("1000.00")
        # 10th: 客户09 (value=910)
        assert result[9]["name"] == "客户09"
        assert result[9]["value"] == Decimal("910.00")
        # All have alertLevel=GREEN
        assert all(r["alertLevel"] == "GREEN" for r in result)
        # All have target=None
        assert all(r["target"] is None for r in result)

    @pytest.mark.asyncio
    async def test_get_customer_ranking_filters_null_name(self, monkeypatch):
        from smartbi_compat.api import analysis_sales as m
        from datetime import date
        from decimal import Decimal
        from collections import namedtuple

        Row = namedtuple("Row", "salesperson_name amount monthly_target product_category customer_name order_date")

        def fake_query(factory_id, range_):
            return [
                Row("X", Decimal("100"), None, "P", "客户A", date(2025, 1, 1)),
                Row("X", Decimal("99999"), None, "P", None, date(2025, 1, 2)),  # null → skip
            ]

        monkeypatch.setattr("smartbi_compat.api.analysis_sales._query_sales_data", fake_query)
        range_ = m.DateRange.custom(date(2025, 1, 1), date(2025, 1, 31))
        result = await m._get_customer_ranking("F999", range_)
        assert len(result) == 1
        assert result[0]["name"] == "客户A"
```

- [ ] **Step 2: pytest → expect FAIL (current stub returns `[]`)**

- [ ] **Step 3: Replace `_get_customer_ranking` stub**

```python
async def _get_customer_ranking(factory_id: str, range_: DateRange) -> list:
    """Real impl. Mirror Java SalesAnalysisServiceImpl.getCustomerRanking line 550-593.

    Aggregates SUM(amount) per customer_name. completionRate = % of total.
    alertLevel hard-coded GREEN (Java line 588).
    Filters null customer_name. Top 10 cap (Java line 574 `.limit(10)`).
    """
    rows = await asyncio.to_thread(_query_sales_data, factory_id, range_)
    sales: dict = {}
    for row in rows:
        name = row.customer_name
        if name is None:
            continue
        amount = _to_decimal(row.amount) if row.amount is not None else Decimal("0")
        sales[name] = sales.get(name, Decimal("0")) + amount
    return _build_ranking(sales, with_percentage=True, top_n=10)
```

- [ ] **Step 4: pytest → 2 PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(phase2a-rankings): replace _get_customer_ranking stub with real impl (per-customer SUM, top 10, percentage of total)" -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

### Task B.5: Verify foundation F999 envelope test still passes (no regression)

**Files:**
- Read-only: tests run only

**Goal:** Confirm that replacing the 3 stubs didn't break any baseline test. F999 has empty data, so all 3 sub-services should still return `[]` when called against F999.

- [ ] **Step 1: Run TestEnvelope (foundation envelope tests)**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestEnvelope -v
```

Expected: ALL PASS (5 envelope tests). Critically `test_F999_empty_state_byte_shape` must pass — the composite includes empty `salespersonRanking/customerRanking/productRanking` arrays and our new impls return `[]` when no rows.

- [ ] **Step 2: Run TestGold + TestOverview + TestRankings**

```bash
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py -v
```

Expected: ALL PASS. TestRankings now has 14 tests (B.1=6 + B.2=2 + B.3=2 + B.4=2 + later phases add more).

Wait — recounting: B.1=6, B.2=2, B.3=2, B.4=2 = 12 tests so far. Phase C will add 4-5 more.

- [ ] **Step 3: Run full smartbi_compat suite for regression check**

```bash
python -m pytest ../../tests/python/smartbi_compat/ -q --tb=line 2>&1 | tail -5
```

Expected: 199 baseline + 12 new = 211 PASS, 0 fail.

- [ ] **Step 4: No commit — verification only**

If any test now fails, STOP — investigate before Phase C.

---

## Phase C — Tests (~30-45 min, 3 tasks)

### Task C.1: Add `test_F001_byte_shape_*` tests (3 ranking variants, gates on existing F001 golden)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

**Goal:** Add F001 byte-shape tests that gate the rankings impl against the existing F001 golden. Currently F001 has no sales data → all 3 rankings = `[]` in golden. Tests should pass with empty assertion.

- [ ] **Step 1: Locate F001 golden file**

```bash
find tests/python/smartbi_compat -name "*F001*sales*.json" 2>/dev/null
find . -name "analysis-sales-F001.json" 2>/dev/null | head -5
```

If no F001 golden exists for /analysis/sales, STOP — foundation should have shipped one. Check `tests/python/smartbi_compat/goldens/` or similar dir.

If found, note the path for use in tests.

- [ ] **Step 2: Append F001 byte-shape tests using existing client + token fixtures**

Look at existing TestEnvelope or TestGold tests to see the fixture pattern (e.g. `client`, `f001_token`). Adapt:

```python
    @pytest.mark.asyncio
    async def test_F001_salesperson_ranking_byte_shape(self, client, f001_token):
        """F001 has no sales data → salespersonRanking should be []."""
        response = await client.get(
            "/api/mobile/F001/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f001_token}"},
        )
        assert response.status_code == 200
        body = response.json()
        # F001 has no sales rows → empty
        assert body["data"]["salespersonRanking"] == []

    @pytest.mark.asyncio
    async def test_F001_product_ranking_byte_shape(self, client, f001_token):
        """F001 has no sales data → productRanking should be []."""
        response = await client.get(
            "/api/mobile/F001/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f001_token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["data"]["productRanking"] == []

    @pytest.mark.asyncio
    async def test_F001_customer_ranking_byte_shape(self, client, f001_token):
        """F001 has no sales data → customerRanking should be []."""
        response = await client.get(
            "/api/mobile/F001/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f001_token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["data"]["customerRanking"] == []
```

NOTE: If `client` is sync (TestClient) instead of async (httpx.AsyncClient), drop `async`/`await` and `@pytest.mark.asyncio` decorator. Adapt to existing test pattern.

NOTE: If F001 actually has sales data (foundation shipped non-empty golden), the tests above will fail with `[] != [<actual rankings>]`. In that case, change assertions to compare against the F001 golden directly:

```python
import json
from pathlib import Path
GOLDEN_DIR = Path(__file__).parent / "goldens"  # or wherever F001 golden lives

with open(GOLDEN_DIR / "analysis-sales-F001.json", encoding="utf-8") as f:
    golden = json.load(f)
expected = _strip_volatile(golden["response"])  # or golden directly if no envelope wrap
assert _strip_volatile(body)["data"]["salespersonRanking"] == expected["data"]["salespersonRanking"]
```

If you find the golden has populated rankings AND your new impl matches them, great. If they DIVERGE (impl produces different ordering, precision), that's the spec §7 sort-stability issue — DEFER fix to Phase D golden re-record (out of scope this run).

- [ ] **Step 3: pytest → expect 3 PASS**

```bash
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestRankings -v -k "F001"
```

If FAIL, debug — likely a fixture name mismatch (use `client` vs `async_client` etc). Look at existing TestGold tests for the established pattern.

- [ ] **Step 4: Commit**

```bash
git commit -m "test(phase2a-rankings): F001 byte-shape tests for 3 rankings (asserts empty for F001 with no sales data)" -- tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

### Task C.2: Add F999 envelope regression test for rankings (defensive)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

**Goal:** Explicit regression guard — confirm F999 (empty data) returns `[]` for all 3 rankings via the route. This test was implicitly covered by TestEnvelope's full F999 byte test, but a focused per-ranking assertion is clearer.

- [ ] **Step 1: Append test**

```python
    @pytest.mark.asyncio
    async def test_F999_all_rankings_empty(self, client, f999_token):
        """F999 has cleared data → all 3 rankings should be []."""
        response = await client.get(
            "/api/mobile/F999/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f999_token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["data"]["salespersonRanking"] == []
        assert body["data"]["productRanking"] == []
        assert body["data"]["customerRanking"] == []
```

NOTE: Adapt fixture name (`f999_token` may be `f999_jwt` or similar — check TestEnvelope fixture usage).

- [ ] **Step 2: pytest → expect PASS**

```bash
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestRankings::test_F999_all_rankings_empty -v
```

- [ ] **Step 3: Commit**

```bash
git commit -m "test(phase2a-rankings): F999 explicit regression — all 3 rankings empty for cleared data" -- tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

### Task C.3: Final TestRankings sweep + full pytest 0-regression

**Files:**
- Read-only: tests run only

- [ ] **Step 1: Full TestRankings count**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestRankings -v
```

Expected: ~16 tests PASS. Breakdown: B.1=6 + B.2=2 + B.3=2 + B.4=2 + C.1=3 + C.2=1 = 16.

- [ ] **Step 2: Full smartbi_compat suite**

```bash
python -m pytest ../../tests/python/smartbi_compat/ -q --tb=line 2>&1 | tail -5
```

Expected: 199 baseline + 16 new TestRankings = 215 PASS, 0 fail.

If any baseline test now fails, STOP and reconcile.

- [ ] **Step 3: No commit — verification only**

---

## Phase D — Deploy + golden re-record (DEFERRED)

⚠ **DEFERRED per user instruction.** Do NOT execute Phase D in this rankings impl run. Batch with trend sub-spec at end of A→B sequence.

When ready, the following tasks run:

### Task D.1 (DEFERRED): Deploy Python to test env

```bash
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-sales-rankings
./scripts/deploy/deploy-smartbi-python.sh --env test
```

Expected: rsync (or OSS) `backend/python/` to `47.100.235.168:/www/wwwroot/cretas/code/backend/python/`, restart Python test service on 8084.

Verify health:
```bash
curl -s http://47.100.235.168:8084/health
```

### Task D.2 (DEFERRED): Re-record F001 golden

```bash
./scripts/phase2a/record-analysis-sales-goldens.sh
```

This captures F001's actual response from the deployed Python (port 8084) and writes to `analysis-sales-F001.json`. If F001 has no sales data, the golden's rankings stay `[]` (no change). If data was added (e.g. via separate Phase 2B-α tests that may have seeded F001), the golden updates with non-empty rankings.

### Task D.3 (DEFERRED): Commit re-recorded golden separately

```bash
git status --short  # check only the golden file changed
git commit -m "chore(phase2a): re-record F001 analysis-sales golden after rankings impl" -- tests/python/smartbi_compat/goldens/analysis-sales-F001.json
```

Per Phase 2A convention: golden re-records are separate commits from impl commits. Easier to revert if needed.

---

## Phase E — Verification (~15-30 min, 2 tasks)

### Task E.1: Final 0-regression sweep + commit count

**Files:**
- Read-only

- [ ] **Step 1: Full pytest**

```bash
cd backend/python
python -m pytest ../../tests/python/smartbi_compat/ -q --tb=line 2>&1 | tail -5
```

Expected: 215 PASS, 0 fail.

- [ ] **Step 2: Verify commit count + scope**

```bash
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-sales-rankings
git log --oneline 38b545d0c..HEAD | wc -l
# Expected: 6 (B.1 + B.2 + B.3 + B.4 + C.1 + C.2 = 6 commits)

git log --oneline 38b545d0c..HEAD
# Verify each commit message is concrete (no "fix stuff", no "WIP")
```

- [ ] **Step 3: Verify file growth**

```bash
wc -l backend/python/smartbi_compat/api/analysis_sales.py
# Expected: ~1450 lines (was 1300 after overview, +150 for rankings)
```

- [ ] **Step 4: No commit — verification only**

---

### Task E.2: Self-summary for handoff to trend sub-spec chat (or batch deploy)

**Files:**
- None modified

- [ ] **Step 1: Write 5-line summary**

After all tasks complete, summarize for caller:
1. Tests added: 16 (TestRankings class)
2. Commits: 6 (B.1-B.4 impl + C.1-C.2 tests)
3. analysis_sales.py: ~1300 → ~1450 LOC
4. F001 byte gate: PASS (with empty assertion since F001 data still empty)
5. F999 byte gate: PASS (no regression)
6. **DEFERRED**: Phase D deploy + golden re-record (batch with trend at end)

Caller (controlling chat) can then:
- Continue with trend sub-spec in the same worktree (next plan)
- OR push branch + open PR (without deploy)
- OR batch deploy + re-record at end of A→B sequence

---

## Self-Review Checklist (run before declaring plan complete)

### Spec coverage

- [x] §2 in-scope items 1-5: B.1 (`_build_ranking` + reused helpers), B.2 (salesperson), B.3 (product), B.4 (customer)
- [x] §2 item 6: TestRankings class — C.1 + C.2 + B.1-B.4 tests
- [x] §2 item 7: F001 golden re-record — Phase D (DEFERRED)
- [x] §3 architecture: implemented exactly per pseudo (in-process aggregation + dispatch to generic builder)
- [x] §4-§6 caller impls: B.2 / B.3 / B.4 mirror Java line 371-400 / 491-533 / 550-593
- [x] §7 sort stability: composite sort key `(-value, name)` in B.1 + tie-stability test in B.1
- [x] §8 RankingItem fields: 6 fields per foundation factory (rank/name/value/target/completionRate/alertLevel)
- [x] §9 BigDecimal precision: `value`/`target`/`completionRate` quantized to 0.01 in B.1
- [x] §10 test fixtures: TestRankings class with 6 + 2 + 2 + 2 + 3 + 1 = 16 tests
- [x] §11 risk register R1 (sort), R3 (Decimal serialization — already resolved by overview), R11 (F001 empty data — assertion adjusted), R12 (Java 2-query divergence — escalation deferred), R13 (null filter — included), R14 (top-10 cap)
- [x] §12 open questions Q1 (Decimal serialization — RESOLVED via overview impl), Q2 (F001 seed strategy — Option C deferred), Q3 (salesperson divergence — escalation gated to Phase D byte mismatch), Q4 (null amount — defensive `_to_decimal` cast in B.2-B.4), Q5 (alertLevel always GREEN — confirmed in B.3 + B.4 tests), Q6 (recorder script — verified in Phase D Task D.2)

### Placeholder scan

- [ ] No "TODO" / "TBD" / "fill later" outside Phase D DEFERRED markers
- [ ] All test code shows actual asserts with concrete expected values
- [ ] All commit messages are concrete

### Type consistency

- [x] `_build_ranking` returns `list[dict]` consistently across B.1-B.4 callers
- [x] `target_map` parameter type: `Optional[dict]` (mapping name → Decimal) — same in B.2 caller
- [x] `with_percentage`/`top_n` parameter types match across B.3 + B.4

---

## Parallel Work Analysis (per `.claude/rules/parallel-work-analysis.md`)

### Subagent: ✅ each task is independently dispatchable

- Phase A (A.1, A.2): parallel-OK (read-only verifications, can batch into one subagent)
- Phase B (B.1-B.4): sequential within phase (each builds on previous helper); single subagent batch OK if needed for efficiency
- Phase B.5 (regression check): sequential, after B.4
- Phase C (C.1, C.2): sequential within phase (similar test additions); single subagent batch OK
- Phase C.3 (final sweep): sequential, after C.2
- Phase D (DEFERRED): single subagent for D.1+D.2+D.3 if/when triggered
- Phase E (E.1, E.2): sequential

### Multi-Chat: ❌ — sub-worktree isolates from sibling chats

- This chat owns `.worktrees/phase2a-sales-rankings` exclusively
- Sibling chats (trend, finance, Phase 2B) operate in different worktrees on different branches
- No `analysis_sales.py` conflict because rankings is in its own worktree on its own branch
- Concurrent-edit safety rule 5b: every commit uses `--only` paths

---

End of rankings implementation plan.
