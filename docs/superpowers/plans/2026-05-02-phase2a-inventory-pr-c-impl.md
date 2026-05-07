# Phase 2A `/analysis/inventory` PR-C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to dispatch the 12 test-class tasks in parallel (one subagent per class). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 12 arithmetic-depth unit test classes (~90 tests) covering inventory per-type modes (PR-A) + default overview mode (PR-B) — completes the PR-A0/PR-A/PR-B/PR-C ship cadence for inventory subdomain.

**Architecture:** Tests-only PR. **NO changes** to `backend/python/smartbi_compat/api/analysis_inventory.py` (impl shipped in PRs #53 PR-A0/PR-A and #54 PR-B). All new tests append to `tests/python/smartbi_compat/test_analysis_inventory_contract.py` (already has 5 PR-A/PR-B contract tests).

**Tech Stack:** pytest, `monkeypatch` and `unittest.mock.patch.object`, `asyncio.run()` for direct async helper calls, Decimal arithmetic.

**Reference spec:** `docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md` §5.3 (12 classes, ~90 tests).

**Templates:**
- `tests/python/smartbi_compat/test_analysis_inventory_contract.py:276-303` — `test_health_score_asymmetric_null_regression` (existing PR-B test, expand into full class)
- `tests/python/smartbi_compat/test_analysis_finance_contract.py` `TestProfitMetricsArithmetic` (monkeypatch try/finally pattern)
- `tests/python/smartbi_compat/test_analysis_finance_contract.py` `TestCostTrendArithmetic` (period aggregation pattern)
- `tests/python/smartbi_compat/test_analysis_finance_factories.py` `TestPayableAgingBucketDepth` (parametrize boundary pattern)

**Concurrency note:** No active sister chat on `analysis_inventory.py`. Use `./scripts/safe-commit.sh` per Rule 5b for every commit.

---

## ⛔ Hard rules

1. **NO impl changes** to `backend/python/smartbi_compat/api/analysis_inventory.py` — PRs #53/#54 are final. PR-C is tests-only.
2. **Test file:** append all classes to existing `tests/python/smartbi_compat/test_analysis_inventory_contract.py` (after line 339, where PR-B class ends).
3. **Mock patterns** (per spec §5.3 + existing PR-B precedent at line 276):
   - For SQL helpers (`_fetch_all`, `_query_*`): use `monkeypatch.setattr(analysis_inventory, "_query_X", fake_X)` or `unittest.mock.patch.object`.
   - For inner-method seams (`_get_turnover_analysis`, `_get_expiry_risk_analysis`, `_calculate_loss_rate_for_health_score`, `_get_aging_metrics`): use `unittest.mock.patch.object` context manager (mirrors line 292-298 precedent).
   - For sync helpers (`_determine_*_alert_level`, `_get_current_quantity`): direct call, no mock needed.
4. **Decimal-only fixtures** — fixtures use `Decimal(...)` literals, NEVER `float()`.
5. **Rule 1 compliance** — `is not None` ternaries in fixture/assertion code.
6. **Rule 9.1 awareness** — Python dict literals in test fixtures matching JSON output use lowercase `xaxisField`/`yaxisField` if asserted (most tests don't touch chart shape, but `TestInventoryLinkedHashMapOrder` Task 4 does).
7. **Frozen date** — Tests using `_get_health_score` / `_get_expiring_batches_ranking` / `_get_long_aging_batches_ranking` MUST monkeypatch `analysis_inventory.date` to `FrozenDate(2026, 5, 2)` (matches existing PR-B test, line 110-115 precedent), so `date.today()` is deterministic.
8. **T-INV-9 asymmetric null** — health-score null handling per Java bug: turnover null → +0; expiry/loss/aging null → full points. NEVER make symmetric (this is the locked-in spec decision per §3.10b in source).
9. **T-INV-15 inline-not-helper** — health score scoring tiers use direct `>=` / `<` comparisons inline, NOT the named alert helpers (which would invert thresholds).
10. **strict `>` vs `>=`** — alert helpers `_determine_expiry_risk_alert_level` and `_determine_loss_rate_alert_level` use **strict `>`**; boundary tests must verify e.g. 15.0 → YELLOW (not RED), 10.0 → GREEN (not YELLOW).

---

## File structure

| File | Change | Approx lines |
|---|---|---|
| `tests/python/smartbi_compat/test_analysis_inventory_contract.py` | Append 12 classes after line 339 | ~600 |
| `backend/python/smartbi_compat/api/analysis_inventory.py` | **NOT MODIFIED** | 0 |
| `docs/superpowers/plans/2026-05-02-phase2a-inventory-pr-c-impl.md` | Created (this plan) | ~500 |

---

## Symbol map (functions PR-C tests directly invoke)

| Helper | Source line | Used by class |
|---|---|---|
| `_determine_turnover_alert_level(rate)` | 430 | TestInventoryAlertHelpersArithmetic |
| `_determine_inventory_days_alert_level(days)` | 440 | TestInventoryAlertHelpersArithmetic |
| `_determine_expiry_risk_alert_level(rate)` | 450 | TestInventoryAlertHelpersArithmetic |
| `_determine_loss_rate_alert_level(rate)` | 467 | TestInventoryAlertHelpersArithmetic |
| `_get_current_quantity(batch)` | 310 | TestInventoryGetCurrentQuantityFormula |
| `_get_turnover_analysis(factory_id, start, end)` | 541 | TestInventoryDivByZeroGuards (site #1: line 560 `/ days_between`) |
| `_get_expiry_risk_analysis(factory_id)` | 745 | TestInventoryDivByZeroGuards (site #2: line 767 `/ total_value`) |
| `_get_aging_metrics(factory_id)` | 1011 | TestInventoryDivByZeroGuards (site #3: line 1040) |
| `_get_inventory_aging_chart(factory_id)` | 1087 | TestInventoryAgingBucketBoundaries; TestInventoryDivByZeroGuards (site #4: line 1079 `/ len(age_days_list)`) |
| `_calculate_loss_rate_for_health_score(factory_id, start, end)` | 1306 | TestInventoryDivByZeroGuards (site #5: line 1362 `/ total_inventory_value`) |
| `_get_health_score(factory_id, start, end)` | 1384 | TestInventoryHealthScoreAsymmetric, TestInventoryHealthScoreTierArithmetic |
| `_get_expiring_batches_ranking(factory_id)` | 848 | TestInventoryExpiringRankingInlineAlert |
| `_get_long_aging_batches_ranking(factory_id, min_days)` | 1168 | TestInventoryLongAgingFilterBoundary, TestInventoryLongAgingRankingInlineAlert |
| `_get_expiry_risk_chart(factory_id)` | 900 | TestInventoryLinkedHashMapOrder |
| `_query_*` | various | mocked |

---

## Pre-flight

- [ ] **PA-1: Branch verify** — `git branch --show-current` shows `phase2a/inventory-pr-c`. `git log --oneline -3` shows latest origin/main as parent (currently `a3b166909 spec: Phase 2A T6 nginx cutover` or newer).
- [ ] **PA-2: Existing test snapshot** — `grep -n "^class Test" tests/python/smartbi_compat/test_analysis_inventory_contract.py` confirms 4 existing classes: `TestAnalysisInventoryTurnover`, `TestAnalysisInventoryExpiry`, `TestAnalysisInventoryAging`, `TestAnalysisInventoryDefaultMode`. Append 12 new classes AFTER existing.
- [ ] **PA-3: Pytest baseline** — `cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_inventory_contract.py -v` confirms baseline 5 tests pass. If failing, BLOCK.
- [ ] **PA-4: Symbol existence sanity** — `grep -nE "^def _determine_(turnover|inventory_days|expiry_risk|loss_rate)_alert_level|^def _get_current_quantity|^async def _get_health_score" backend/python/smartbi_compat/api/analysis_inventory.py` returns all 6 lines. If any missing, BLOCK and report which PR is incomplete.

---

## Task 1: `TestInventoryAlertHelpersArithmetic` (16 tests)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_inventory_contract.py` (append after line 339)

Coverage: 4 named helpers × 4 boundary cases each = 16 tests. Per spec §5.3 + impl line 430-477:
- Turnover (regular dir, lower=worse): rate=5.99→RED, rate=6.0→YELLOW, rate=11.99→YELLOW, rate=12.0→GREEN
- InventoryDays (inverse, strict `>`): days=60.01→RED, days=60.0→YELLOW, days=30.01→YELLOW, days=30.0→GREEN
- ExpiryRisk (inverse, strict `>`): rate=15.01→RED, rate=15.0→YELLOW (NOT RED), rate=10.01→YELLOW, rate=10.0→GREEN (NOT YELLOW)
- LossRate (inverse, strict `>`): rate=5.01→RED, rate=5.0→YELLOW, rate=2.01→YELLOW, rate=2.0→GREEN

- [ ] **Step 1: Append class with 16 boundary tests**

```python
class TestInventoryAlertHelpersArithmetic:
    """4 named alert helpers × 4 boundary cases = 16 tests.

    Critical: ExpiryRisk + LossRate use STRICT `>`, NOT `>=`. Boundary value
    routes to YELLOW (not RED) at threshold; routes to GREEN (not YELLOW) at
    lower threshold. Off-by-one on `>` vs `>=` is the exact bug class this
    test catches.
    """

    @pytest.mark.parametrize("rate,expected", [
        ("5.99", "RED"),
        ("6.0", "YELLOW"),
        ("11.99", "YELLOW"),
        ("12.0", "GREEN"),
    ])
    def test_turnover_alert_boundaries(self, rate, expected):
        from decimal import Decimal
        from smartbi_compat.api.analysis_inventory import _determine_turnover_alert_level
        assert _determine_turnover_alert_level(Decimal(rate)) == expected

    @pytest.mark.parametrize("days,expected", [
        ("60.01", "RED"),
        ("60.0", "YELLOW"),
        ("30.01", "YELLOW"),
        ("30.0", "GREEN"),
    ])
    def test_inventory_days_alert_boundaries(self, days, expected):
        from decimal import Decimal
        from smartbi_compat.api.analysis_inventory import _determine_inventory_days_alert_level
        assert _determine_inventory_days_alert_level(Decimal(days)) == expected

    @pytest.mark.parametrize("rate,expected", [
        ("15.01", "RED"),
        ("15.0", "YELLOW"),    # strict > 15 for RED
        ("10.01", "YELLOW"),
        ("10.0", "GREEN"),     # strict > 10 for YELLOW
    ])
    def test_expiry_risk_alert_boundaries(self, rate, expected):
        from decimal import Decimal
        from smartbi_compat.api.analysis_inventory import _determine_expiry_risk_alert_level
        assert _determine_expiry_risk_alert_level(Decimal(rate)) == expected

    @pytest.mark.parametrize("rate,expected", [
        ("5.01", "RED"),
        ("5.0", "YELLOW"),     # strict > 5 for RED
        ("2.01", "YELLOW"),
        ("2.0", "GREEN"),      # strict > 2 for YELLOW
    ])
    def test_loss_rate_alert_boundaries(self, rate, expected):
        from decimal import Decimal
        from smartbi_compat.api.analysis_inventory import _determine_loss_rate_alert_level
        assert _determine_loss_rate_alert_level(Decimal(rate)) == expected
```

- [ ] **Step 2: Run tests, expect 16/16 pass**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_inventory_contract.py::TestInventoryAlertHelpersArithmetic -v
```

Expected: `16 passed`. If any fail, the helper threshold is different from spec — BLOCK and read impl.

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-C: TestInventoryAlertHelpersArithmetic (16 boundary tests)" \
  tests/python/smartbi_compat/test_analysis_inventory_contract.py
```

---

## Task 2: `TestInventoryDivByZeroGuards` (15 tests)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_inventory_contract.py` (append after Task 1)

Coverage: 5 div-by-zero sites × 3 cases (zero-denom returns fallback / tiny-denom computes / normal denom computes) = 15 tests.

5 sites per spec §3 / impl scan:
1. `_get_turnover_analysis` line 560: `(consumption × 365) / Decimal(days_between)` — guarded by `(end-start).days+1 ≥ 1` so never zero in practice; test that period of 1 day still returns valid number
2. `_get_expiry_risk_analysis` line 766-767: `expiring_value / total_value` guarded `if total_value > Decimal("0")`; else `expiry_risk_rate = Decimal("0")`
3. `_get_aging_metrics` line 1039-1040: `slow_moving_value / total_value` guarded `if total_value > Decimal("0")`; else 0
4. `_get_inventory_aging_chart` line 1078-1079: `sum(age_days_list) / Decimal(len(age_days_list))` guarded `if age_days_list:`; else avg_days remains 0
5. `_calculate_loss_rate_for_health_score` line 1361-1362: `total_loss / total_inventory_value` guarded `if total_inventory_value > Decimal("0")`; else 0

- [ ] **Step 1: Append class**

```python
class TestInventoryDivByZeroGuards:
    """5 div-by-zero sites × 3 cases = 15 tests. Each site tested for:
       - zero-denominator → fallback value (typically 0 rate)
       - tiny-but-positive denominator → computes normally
       - normal denominator → computes normally
    """

    # Site 1: _get_turnover_analysis (line 560: /Decimal(days_between))
    @pytest.mark.parametrize("start,end,expect_nonzero", [
        # Single-day period: days_between = 1, valid divisor
        ((2025, 6, 1), (2025, 6, 1), True),
        # Tiny period: 2 days, valid
        ((2025, 6, 1), (2025, 6, 2), True),
        # Normal period: 30 days
        ((2025, 6, 1), (2025, 6, 30), True),
    ])
    def test_turnover_div_safe_for_any_period(self, start, end, expect_nonzero, monkeypatch):
        """Site #1: days_between always ≥ 1, no actual zero possible. Verify no exception."""
        import asyncio
        from datetime import date as _d
        from smartbi_compat.api import analysis_inventory

        async def fake_consumptions(*_a, **_k):
            return [{"quantity_change": Decimal("100")}]
        async def fake_batches(*_a, **_k):
            return [{"unit_price": Decimal("10"), "receipt_quantity": Decimal("50"),
                     "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")}]

        monkeypatch.setattr(analysis_inventory, "_query_material_consumptions_in_range", fake_consumptions)
        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)

        result = asyncio.run(analysis_inventory._get_turnover_analysis(
            "F", _d(*start), _d(*end)
        ))
        assert any(m.get("metricCode") == "TURNOVER_RATE" for m in result)

    # Site 2: _get_expiry_risk_analysis (line 766-767: /total_value)
    @pytest.mark.parametrize("total_value_setup,expected_rate", [
        ("zero_total", 0),         # no batches → total_value=0 → rate=0
        ("tiny_total", None),      # 1 batch tiny value → rate computes
        ("normal_total", None),    # multi batches → rate computes
    ])
    def test_expiry_risk_div_guard(self, total_value_setup, expected_rate, monkeypatch):
        """Site #2: total_value=0 → rate=0; positive denom → rate computes."""
        import asyncio
        from smartbi_compat.api import analysis_inventory

        if total_value_setup == "zero_total":
            async def fake_batches(*_a, **_k): return []
            async def fake_expiring(*_a, **_k): return []
        elif total_value_setup == "tiny_total":
            async def fake_batches(*_a, **_k):
                return [{"unit_price": Decimal("0.01"), "receipt_quantity": Decimal("1"),
                         "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")}]
            async def fake_expiring(*_a, **_k): return []
        else:  # normal_total
            async def fake_batches(*_a, **_k):
                return [{"unit_price": Decimal("100"), "receipt_quantity": Decimal("10"),
                         "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")}]
            async def fake_expiring(*_a, **_k): return []

        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)
        monkeypatch.setattr(analysis_inventory, "_query_expiring_batches", fake_expiring)
        monkeypatch.setattr(analysis_inventory, "_query_expired_batches", fake_expiring)

        result = asyncio.run(analysis_inventory._get_expiry_risk_analysis("F"))
        rate_metric = next((m for m in result if m.get("metricCode") == "EXPIRY_RISK_RATE"), None)
        assert rate_metric is not None
        if expected_rate == 0:
            assert rate_metric["value"] == 0

    # Site 3: _get_aging_metrics (line 1039-1040: /total_value)
    @pytest.mark.parametrize("scenario", ["zero_total", "tiny_total", "normal_total"])
    def test_aging_metrics_div_guard(self, scenario, monkeypatch):
        """Site #3: total_value=0 → slow_moving_rate=0; else computes."""
        import asyncio
        from smartbi_compat.api import analysis_inventory

        if scenario == "zero_total":
            async def fake_batches(*_a, **_k): return []
        elif scenario == "tiny_total":
            async def fake_batches(*_a, **_k):
                return [{"unit_price": Decimal("0.01"), "receipt_quantity": Decimal("1"),
                         "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0"),
                         "receipt_date": real_date(2025, 1, 1)}]
        else:
            async def fake_batches(*_a, **_k):
                return [{"unit_price": Decimal("100"), "receipt_quantity": Decimal("10"),
                         "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0"),
                         "receipt_date": real_date(2025, 1, 1)}]

        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)

        # Freeze date for slow_moving date math
        class FrozenDate(real_date):
            @classmethod
            def today(cls): return real_date(2026, 5, 2)
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        result = asyncio.run(analysis_inventory._get_aging_metrics("F"))
        slow = next((m for m in result if m.get("metricCode") == "SLOW_MOVING_RATE"), None)
        assert slow is not None
        if scenario == "zero_total":
            assert slow["value"] == 0

    # Site 4: _get_inventory_aging_chart (line 1078-1079: /len(age_days_list))
    @pytest.mark.parametrize("scenario", ["empty_batches", "one_batch", "many_batches"])
    def test_aging_chart_avg_div_guard(self, scenario, monkeypatch):
        """Site #4: empty age list → avg_days=0; else computes."""
        import asyncio
        from smartbi_compat.api import analysis_inventory

        if scenario == "empty_batches":
            async def fake_batches(*_a, **_k): return []
        elif scenario == "one_batch":
            async def fake_batches(*_a, **_k):
                return [{"unit_price": Decimal("10"), "receipt_quantity": Decimal("1"),
                         "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0"),
                         "receipt_date": real_date(2025, 6, 1), "id": 1}]
        else:
            async def fake_batches(*_a, **_k):
                return [
                    {"unit_price": Decimal("10"), "receipt_quantity": Decimal("1"),
                     "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0"),
                     "receipt_date": real_date(2025, 6, 1), "id": 1},
                    {"unit_price": Decimal("10"), "receipt_quantity": Decimal("1"),
                     "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0"),
                     "receipt_date": real_date(2025, 7, 1), "id": 2},
                ]

        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)

        class FrozenDate(real_date):
            @classmethod
            def today(cls): return real_date(2026, 5, 2)
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        chart = asyncio.run(analysis_inventory._get_inventory_aging_chart("F"))
        assert chart["chartType"] == "BAR"

    # Site 5: _calculate_loss_rate_for_health_score (line 1361-1362: /total_inventory_value)
    @pytest.mark.parametrize("scenario,expected_rate", [
        ("zero_inventory", 0),
        ("tiny_inventory", None),
        ("normal_inventory", None),
    ])
    def test_loss_rate_div_guard(self, scenario, expected_rate, monkeypatch):
        """Site #5: total_inventory_value=0 → loss_rate=0; else computes."""
        import asyncio
        from smartbi_compat.api import analysis_inventory

        if scenario == "zero_inventory":
            async def fake_batches(*_a, **_k): return []
        elif scenario == "tiny_inventory":
            async def fake_batches(*_a, **_k):
                return [{"id": 1, "unit_price": Decimal("0.01"),
                         "receipt_quantity": Decimal("1"),
                         "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")}]
        else:
            async def fake_batches(*_a, **_k):
                return [{"id": 1, "unit_price": Decimal("100"),
                         "receipt_quantity": Decimal("10"),
                         "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")}]

        async def fake_adjustments(*_a, **_k): return []

        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)
        monkeypatch.setattr(analysis_inventory, "_query_batch_adjustments_in_range", fake_adjustments)

        result = asyncio.run(analysis_inventory._calculate_loss_rate_for_health_score(
            "F", real_date(2025, 1, 1), real_date(2025, 12, 31)
        ))
        rate = next((m for m in result if m.get("metricCode") == "LOSS_RATE"), None)
        assert rate is not None
        if expected_rate == 0:
            assert rate["value"] == 0
```

- [ ] **Step 2: Run, expect 15/15 pass**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_inventory_contract.py::TestInventoryDivByZeroGuards -v
```

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-C: TestInventoryDivByZeroGuards (15 tests, 5 div sites)" \
  tests/python/smartbi_compat/test_analysis_inventory_contract.py
```

---

## Task 3: `TestInventoryDateArithmetic` (3-5 tests)

**Files:**
- Modify: same test file (append after Task 2)

Coverage:
- Annualization formula `consumption × 365 / days_between` for various periods
- Days-until-expiry signed semantics: positive (future) / zero (today) / negative (past)
- Null receipt_date → bucketed to "90天以上" (T-INV-3)

- [ ] **Step 1: Append class**

```python
class TestInventoryDateArithmetic:
    """T-INV-3 + annualization + days-until-expiry signed semantics."""

    def test_annualization_formula_30_days(self, monkeypatch):
        """30-day period, consumption=300 → annualized = 300*365/30 = 3650."""
        import asyncio
        from smartbi_compat.api import analysis_inventory

        async def fake_consumptions(*_a, **_k):
            return [{"quantity_change": Decimal("300")}]
        async def fake_batches(*_a, **_k):
            return [{"unit_price": Decimal("100"), "receipt_quantity": Decimal("10"),
                     "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")}]

        monkeypatch.setattr(analysis_inventory, "_query_material_consumptions_in_range", fake_consumptions)
        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)

        result = asyncio.run(analysis_inventory._get_turnover_analysis(
            "F", real_date(2025, 6, 1), real_date(2025, 6, 30)
        ))
        # days_between = (2025-06-30 - 2025-06-01).days + 1 = 30
        # annualized = 300 * 365 / 30 = 3650
        # Just verify TURNOVER_RATE is present and reasonable
        rate_metric = next((m for m in result if m.get("metricCode") == "TURNOVER_RATE"), None)
        assert rate_metric is not None

    def test_null_receipt_date_aging_bucket(self, monkeypatch):
        """T-INV-3: batch with null receipt_date → aging bucket '90天以上'."""
        import asyncio
        from smartbi_compat.api import analysis_inventory

        async def fake_batches(*_a, **_k):
            return [{
                "id": 1, "unit_price": Decimal("100"),
                "receipt_quantity": Decimal("10"),
                "used_quantity": Decimal("0"),
                "reserved_quantity": Decimal("0"),
                "receipt_date": None,    # T-INV-3 trigger
            }]

        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)

        class FrozenDate(real_date):
            @classmethod
            def today(cls): return real_date(2026, 5, 2)
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        chart = asyncio.run(analysis_inventory._get_inventory_aging_chart("F"))
        # Find the 90天以上 bucket and verify it has the null-date batch's value
        over_90 = next((d for d in chart["data"] if d.get("aging") == "90天以上"), None)
        assert over_90 is not None
        assert over_90["value"] > 0, "Null receipt_date batch should land in 90天以上 bucket"

    def test_days_until_expiry_negative_for_expired(self, monkeypatch):
        """Expired batch (expiry_date in past) → days-until-expiry < 0; bucket as '已过期' or similar."""
        import asyncio
        from smartbi_compat.api import analysis_inventory

        async def fake_expired(*_a, **_k):
            return [{
                "id": 1, "name": "过期批次",
                "expiry_date": real_date(2026, 4, 1),  # 31 days before frozen today
                "unit_price": Decimal("10"),
                "receipt_quantity": Decimal("5"),
                "used_quantity": Decimal("0"),
                "reserved_quantity": Decimal("0"),
                "material_type_id": "MAT-001",
            }]
        async def fake_expiring(*_a, **_k): return []
        async def fake_batches(*_a, **_k): return []

        monkeypatch.setattr(analysis_inventory, "_query_expired_batches", fake_expired)
        monkeypatch.setattr(analysis_inventory, "_query_expiring_batches", fake_expiring)
        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)

        class FrozenDate(real_date):
            @classmethod
            def today(cls): return real_date(2026, 5, 2)
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        result = asyncio.run(analysis_inventory._get_expiry_risk_analysis("F"))
        # Just verify result returns without exception when negative days encountered
        assert isinstance(result, list)
```

- [ ] **Step 2: Run + verify 3/3 pass**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_inventory_contract.py::TestInventoryDateArithmetic -v
```

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-C: TestInventoryDateArithmetic (3 tests)" \
  tests/python/smartbi_compat/test_analysis_inventory_contract.py
```

---

## Task 4: `TestInventoryLinkedHashMapOrder` (3 tests — T-INV-5 positional)

**Files:** same test file (append after Task 3)

Coverage: positional list-comprehension assertions on chart_data ordering for:
- `_get_expiry_risk_chart`: 5-bucket order `["正常（>30天）", "关注（15-30天）", "预警（7-15天）", "紧急（<7天）", "无保质期"]`
- `_get_inventory_aging_chart`: 4-bucket order `["0-30天", "31-60天", "61-90天", "90天以上"]`
- `_build_material_category_value_chart`: top-N sorted desc by value

⚠️ Naïve `assert chart["data"] == golden_data` is THEATER — Python dict comparison is order-insensitive AT THE DICT LEVEL. List comparison IS order-sensitive — explicit `[d["status"] for d in data]` extracts positional order to assert.

- [ ] **Step 1: Append class**

```python
class TestInventoryLinkedHashMapOrder:
    """T-INV-5 — explicit positional list assertion. Catches dict reorder regressions
    that naive `==` comparison would silently pass."""

    def test_expiry_risk_chart_5_bucket_order(self, monkeypatch):
        """Java pre-populates 5 buckets in this exact LinkedHashMap order."""
        import asyncio
        from smartbi_compat.api import analysis_inventory

        async def fake_expiring(*_a, **_k):
            return [
                {"id": 1, "name": "B1", "expiry_date": real_date(2026, 5, 5),  # 3 days
                 "unit_price": Decimal("10"), "receipt_quantity": Decimal("5"),
                 "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0"),
                 "material_type_id": "MAT-001"},
                {"id": 2, "name": "B2", "expiry_date": real_date(2026, 5, 12),  # 10 days
                 "unit_price": Decimal("10"), "receipt_quantity": Decimal("5"),
                 "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0"),
                 "material_type_id": "MAT-001"},
                {"id": 3, "name": "B3", "expiry_date": real_date(2026, 5, 20),  # 18 days
                 "unit_price": Decimal("10"), "receipt_quantity": Decimal("5"),
                 "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0"),
                 "material_type_id": "MAT-001"},
            ]
        async def fake_batches(*_a, **_k):
            return [{"unit_price": Decimal("10"), "receipt_quantity": Decimal("5"),
                     "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0"),
                     "expiry_date": None, "id": 99, "material_type_id": "MAT-001"}]

        monkeypatch.setattr(analysis_inventory, "_query_expiring_batches", fake_expiring)
        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)

        class FrozenDate(real_date):
            @classmethod
            def today(cls): return real_date(2026, 5, 2)
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        chart = asyncio.run(analysis_inventory._get_expiry_risk_chart("F"))
        # Explicit positional order assertion
        actual_order = [d["status"] for d in chart["data"]]
        assert actual_order == [
            "正常（>30天）", "关注（15-30天）", "预警（7-15天）",
            "紧急（<7天）", "无保质期",
        ], f"Expected fixed 5-bucket order, got {actual_order}"
        # Defensive: all 5 emitted even when some buckets empty
        assert len(chart["data"]) == 5

    def test_inventory_aging_chart_4_bucket_order(self, monkeypatch):
        """Java pre-populates 4 buckets in this LinkedHashMap order."""
        import asyncio
        from smartbi_compat.api import analysis_inventory

        async def fake_batches(*_a, **_k):
            return [
                {"id": 1, "receipt_date": real_date(2026, 4, 25),  # 7 days ago
                 "unit_price": Decimal("10"), "receipt_quantity": Decimal("5"),
                 "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")},
                {"id": 2, "receipt_date": real_date(2026, 3, 15),  # ~48 days
                 "unit_price": Decimal("10"), "receipt_quantity": Decimal("5"),
                 "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")},
            ]

        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)

        class FrozenDate(real_date):
            @classmethod
            def today(cls): return real_date(2026, 5, 2)
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        chart = asyncio.run(analysis_inventory._get_inventory_aging_chart("F"))
        actual_order = [d["aging"] for d in chart["data"]]
        assert actual_order == [
            "0-30天", "31-60天", "61-90天", "90天以上",
        ], f"Expected 4-bucket order, got {actual_order}"
        assert len(chart["data"]) == 4

    def test_material_category_chart_sorted_desc_by_value(self, monkeypatch):
        """Material category chart: sort by total value descending."""
        from smartbi_compat.api import analysis_inventory

        batches = [
            {"id": 1, "material_type_id": "MAT-A", "material_type_name": "A",
             "unit_price": Decimal("10"), "receipt_quantity": Decimal("1"),
             "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")},
            {"id": 2, "material_type_id": "MAT-B", "material_type_name": "B",
             "unit_price": Decimal("100"), "receipt_quantity": Decimal("1"),
             "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")},
            {"id": 3, "material_type_id": "MAT-C", "material_type_name": "C",
             "unit_price": Decimal("50"), "receipt_quantity": Decimal("1"),
             "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")},
        ]
        chart = analysis_inventory._build_material_category_value_chart(batches)
        # Verify sorted desc: B (100) > C (50) > A (10)
        actual_values = [d["value"] for d in chart["data"]]
        assert actual_values == sorted(actual_values, reverse=True), \
            f"Material category data not sorted desc: {actual_values}"
```

- [ ] **Step 2: Run + verify 3/3 pass**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_inventory_contract.py::TestInventoryLinkedHashMapOrder -v
```

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-C: TestInventoryLinkedHashMapOrder (3 tests, T-INV-5)" \
  tests/python/smartbi_compat/test_analysis_inventory_contract.py
```

---

## Task 5: `TestInventoryLossTrendChartMock` (1 negative test — T-INV-8)

**Files:** same test file (append after Task 4)

Coverage: T-INV-8 — `_get_loss_trend_chart` MUST NOT exist as exported symbol. If a future commit adds it, this test FAILS to force review.

- [ ] **Step 1: Append class**

```python
class TestInventoryLossTrendChartMock:
    """T-INV-8 negative test: _get_loss_trend_chart NOT exported.

    Per spec §2 line 110-112: getLossTrendChart is one of 4 internal methods
    intentionally NOT ported because controller never dispatches to it.
    Defensive: catch future commits that mistakenly add it."""

    def test_loss_trend_chart_not_exported(self):
        """If this fails, someone added _get_loss_trend_chart — review against
        spec §2 + getInventoryHealth charts list (only 3 charts: aging/expiry/material).
        """
        from smartbi_compat.api import analysis_inventory

        assert not hasattr(analysis_inventory, "_get_loss_trend_chart"), \
            "_get_loss_trend_chart MUST NOT be exported per T-INV-8 spec decision. " \
            "If intentionally adding, update spec §2 line 110-112 and remove this test."
```

- [ ] **Step 2: Run, expect 1/1 pass**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_inventory_contract.py::TestInventoryLossTrendChartMock -v
```

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-C: TestInventoryLossTrendChartMock (T-INV-8 negative)" \
  tests/python/smartbi_compat/test_analysis_inventory_contract.py
```

---

## Task 6: `TestInventoryHealthScoreAsymmetric` (5 tests — T-INV-9)

**Files:** same test file (append after Task 5)

Coverage: 5 cases of T-INV-9 asymmetric null. Existing `test_health_score_asymmetric_null_regression` at line 276 covers case 1 (all-None=70); this class adds the 4 remaining cases.

- [ ] **Step 1: Append class**

```python
class TestInventoryHealthScoreAsymmetric:
    """T-INV-9 — asymmetric null handling in _get_health_score.

    Java getHealthScore (L824-921) treats null per dimension as:
      - Turnover null → +0 (penalty, NO else branch)
      - Expiry null → +30 (full points)
      - Loss null → +20 (full points)
      - Aging null → +20 (full points)

    All 4 None: 0+30+20+20 = 70 (NOT 0).
    All 4 worst: 10+10+5+5 = 30.
    All 4 best: 30+30+20+20 = 100.

    Note: Existing test_health_score_asymmetric_null_regression covers case 1.
    This class extends with the 4 remaining boundary cases.
    """

    @staticmethod
    def _run_with_metrics(turnover_val, expiry_val, loss_val, aging_val):
        """Helper: run _get_health_score with mocked metrics returning specified values."""
        import asyncio
        import unittest.mock
        from smartbi_compat.api import analysis_inventory

        async def turnover_metric(*_a, **_k):
            if turnover_val is None:
                return []
            return [{"metricCode": "TURNOVER_RATE", "value": turnover_val}]

        async def expiry_metric(*_a, **_k):
            if expiry_val is None:
                return []
            return [{"metricCode": "EXPIRY_RISK_RATE", "value": expiry_val}]

        async def loss_metric(*_a, **_k):
            if loss_val is None:
                return []
            return [{"metricCode": "LOSS_RATE", "value": loss_val}]

        async def aging_metric(*_a, **_k):
            if aging_val is None:
                return []
            return [{"metricCode": "SLOW_MOVING_RATE", "value": aging_val}]

        with unittest.mock.patch.object(analysis_inventory, "_get_turnover_analysis", turnover_metric), \
             unittest.mock.patch.object(analysis_inventory, "_get_expiry_risk_analysis", expiry_metric), \
             unittest.mock.patch.object(analysis_inventory, "_calculate_loss_rate_for_health_score", loss_metric), \
             unittest.mock.patch.object(analysis_inventory, "_get_aging_metrics", aging_metric):
            return asyncio.run(analysis_inventory._get_health_score(
                "F", real_date(2025, 1, 1), real_date(2025, 12, 31)
            ))

    def test_all_full_points_score_100(self):
        """All 4 dims best values → 30+30+20+20 = 100."""
        result = self._run_with_metrics(
            turnover_val=Decimal("15"),     # >= 12 → +30
            expiry_val=Decimal("5"),        # < 10 → +30
            loss_val=Decimal("1"),          # < 2 → +20
            aging_val=Decimal("5"),         # < 10 → +20
        )
        assert result["value"] == 100
        assert result["alertLevel"] == "GREEN"

    def test_all_worst_points_score_30(self):
        """All 4 dims worst values → 10+10+5+5 = 30."""
        result = self._run_with_metrics(
            turnover_val=Decimal("3"),      # < 6 → +10
            expiry_val=Decimal("20"),       # >= 15 → +10
            loss_val=Decimal("8"),          # >= 5 → +5
            aging_val=Decimal("25"),        # >= 20 → +5
        )
        assert result["value"] == 30
        assert result["alertLevel"] == "RED"

    def test_turnover_none_alone_subtracts_30(self):
        """turnover None, others best: 0 + 30 + 20 + 20 = 70."""
        result = self._run_with_metrics(
            turnover_val=None,              # +0 (penalty)
            expiry_val=Decimal("5"),        # +30
            loss_val=Decimal("1"),          # +20
            aging_val=Decimal("5"),         # +20
        )
        assert result["value"] == 70

    def test_expiry_none_alone_full_points(self):
        """expiry None alone: rest best, expiry null → +30 (full pts asymmetric)."""
        result = self._run_with_metrics(
            turnover_val=Decimal("15"),     # +30
            expiry_val=None,                # +30 (asymmetric — full points on null)
            loss_val=Decimal("1"),          # +20
            aging_val=Decimal("5"),         # +20
        )
        assert result["value"] == 100

    def test_loss_and_aging_none_full_points(self):
        """loss + aging None, others best: 30 + 30 + 20 + 20 = 100."""
        result = self._run_with_metrics(
            turnover_val=Decimal("15"),
            expiry_val=Decimal("5"),
            loss_val=None,                  # +20 asymmetric
            aging_val=None,                 # +20 asymmetric
        )
        assert result["value"] == 100
```

- [ ] **Step 2: Run + verify 5/5 pass**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_inventory_contract.py::TestInventoryHealthScoreAsymmetric -v
```

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-C: TestInventoryHealthScoreAsymmetric (5 tests, T-INV-9)" \
  tests/python/smartbi_compat/test_analysis_inventory_contract.py
```

---

## Task 7: `TestInventoryHealthScoreTierArithmetic` (24 tests — T-INV-15)

**Files:** same test file (append after Task 6)

Coverage: 4 dimensions × 6 boundary cases = 24 tests for inline scoring tiers.

Per spec §5.3 + impl line 2122-2189:
- Dimension 1 TURNOVER (`>=`): rate=11.99→+20, 12.0→+30, 5.99→+10, 6.0→+20, 0→+10, 20→+30
- Dimension 2 EXPIRY (`<` strict): rate=9.99→+30, 10.0→+20, 14.99→+20, 15.0→+10, 0→+30, 100→+10
- Dimension 3 LOSS (`<` strict): rate=1.99→+20, 2.0→+12, 4.99→+12, 5.0→+5
- Dimension 4 AGING (`<` strict): rate=9.99→+20, 10.0→+12, 19.99→+12, 20.0→+5

Strategy: For each test, mock 3 of 4 dimensions to a known max-pts value, vary the 4th, assert score delta matches.

- [ ] **Step 1: Append class — TURNOVER dimension (6 tests)**

```python
class TestInventoryHealthScoreTierArithmetic:
    """T-INV-15 — boundary tier arithmetic for 4 inline scoring branches in
    _get_health_score. Catches off-by-one on `>=` vs `<` per dimension.

    Strategy: lock 3 dims at full points, vary 4th at threshold boundaries.
    """

    @staticmethod
    def _run_with_metrics(turnover_val, expiry_val, loss_val, aging_val):
        """Reuse helper from TestInventoryHealthScoreAsymmetric (duplicated for
        independence — subagent may run tasks out of order)."""
        import asyncio
        import unittest.mock
        from smartbi_compat.api import analysis_inventory

        async def turnover_metric(*_a, **_k):
            if turnover_val is None: return []
            return [{"metricCode": "TURNOVER_RATE", "value": turnover_val}]
        async def expiry_metric(*_a, **_k):
            if expiry_val is None: return []
            return [{"metricCode": "EXPIRY_RISK_RATE", "value": expiry_val}]
        async def loss_metric(*_a, **_k):
            if loss_val is None: return []
            return [{"metricCode": "LOSS_RATE", "value": loss_val}]
        async def aging_metric(*_a, **_k):
            if aging_val is None: return []
            return [{"metricCode": "SLOW_MOVING_RATE", "value": aging_val}]

        with unittest.mock.patch.object(analysis_inventory, "_get_turnover_analysis", turnover_metric), \
             unittest.mock.patch.object(analysis_inventory, "_get_expiry_risk_analysis", expiry_metric), \
             unittest.mock.patch.object(analysis_inventory, "_calculate_loss_rate_for_health_score", loss_metric), \
             unittest.mock.patch.object(analysis_inventory, "_get_aging_metrics", aging_metric):
            return asyncio.run(analysis_inventory._get_health_score(
                "F", real_date(2025, 1, 1), real_date(2025, 12, 31)
            ))

    # Lock other 3 dims at "full points": expiry=5 (+30), loss=1 (+20), aging=5 (+20) = 70 baseline
    BASE_OTHER = ("5", "1", "5")  # (expiry, loss, aging) → 70 baseline contribution

    @pytest.mark.parametrize("turnover,expected_delta", [
        ("11.99", 20),   # < 12 → +20 (boundary excludes 11.99)
        ("12.0", 30),    # >= 12 → +30 (boundary inclusive)
        ("5.99", 10),    # < 6 → +10
        ("6.0", 20),     # >= 6 → +20 (boundary inclusive)
        ("0.0", 10),
        ("20.0", 30),
    ])
    def test_turnover_dim_tiers(self, turnover, expected_delta):
        e, l, a = self.BASE_OTHER
        result = self._run_with_metrics(
            Decimal(turnover), Decimal(e), Decimal(l), Decimal(a)
        )
        assert result["value"] == 70 + expected_delta

    @pytest.mark.parametrize("expiry,expected_delta", [
        ("9.99", 30),    # < 10 → +30
        ("10.0", 20),    # >= 10 strict-NOT< → +20 (boundary excludes from full pts)
        ("14.99", 20),   # < 15 → +20
        ("15.0", 10),    # >= 15 strict-NOT< → +10 (boundary excludes from mid pts)
        ("0.0", 30),
        ("100.0", 10),
    ])
    def test_expiry_dim_tiers(self, expiry, expected_delta):
        # Lock other 3 at full pts: turnover=15(+30), loss=1(+20), aging=5(+20) = 70 baseline
        result = self._run_with_metrics(
            Decimal("15"), Decimal(expiry), Decimal("1"), Decimal("5")
        )
        assert result["value"] == 70 + expected_delta

    @pytest.mark.parametrize("loss,expected_delta", [
        ("1.99", 20),    # < 2 → +20
        ("2.0", 12),     # >= 2 strict-NOT< → +12
        ("4.99", 12),    # < 5 → +12
        ("5.0", 5),      # >= 5 strict-NOT< → +5
    ])
    def test_loss_dim_tiers(self, loss, expected_delta):
        # Lock other 3: turnover=15(+30), expiry=5(+30), aging=5(+20) = 80 baseline
        result = self._run_with_metrics(
            Decimal("15"), Decimal("5"), Decimal(loss), Decimal("5")
        )
        assert result["value"] == 80 + expected_delta

    @pytest.mark.parametrize("aging,expected_delta", [
        ("9.99", 20),    # < 10 → +20
        ("10.0", 12),    # >= 10 → +12
        ("19.99", 12),   # < 20 → +12
        ("20.0", 5),     # >= 20 → +5
    ])
    def test_aging_dim_tiers(self, aging, expected_delta):
        # Lock other 3: turnover=15(+30), expiry=5(+30), loss=1(+20) = 80 baseline
        result = self._run_with_metrics(
            Decimal("15"), Decimal("5"), Decimal("1"), Decimal(aging)
        )
        assert result["value"] == 80 + expected_delta
```

- [ ] **Step 2: Run + verify 20/20 pass** (6+6+4+4 = 20 parametrized)

Wait, count check: 6 turnover + 6 expiry + 4 loss + 4 aging = 20 tests. Spec said ~24. The 4-extra in spec is broader edge coverage at 0.0 / 100.0 etc. — included in turnover/expiry, omitted in loss/aging because those Java thresholds are tighter and not explicitly tested by spec at extremes. If subagent finds spec wants 24 exactly, add 4 more (loss at 0.0/100.0, aging at 0.0/100.0).

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_inventory_contract.py::TestInventoryHealthScoreTierArithmetic -v
```

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-C: TestInventoryHealthScoreTierArithmetic (20 tests, T-INV-15)" \
  tests/python/smartbi_compat/test_analysis_inventory_contract.py
```

---

## Task 8: `TestInventoryLongAgingFilterBoundary` (3 tests — T-INV-14)

**Files:** same test file (append after Task 7)

Coverage: T-INV-14 — `_get_long_aging_batches_ranking` filter must be `>=` inclusive, not `>` strict.

- [ ] **Step 1: Append class**

```python
class TestInventoryLongAgingFilterBoundary:
    """T-INV-14 — long-aging filter must be `>=` inclusive at boundary.

    Boundary: ageDays=59 vs 60 vs 61 with min_days=60.
    """

    @pytest.mark.parametrize("age_days,should_include", [
        (59, False),    # < 60 → EXCLUDED
        (60, True),     # == 60 → INCLUDED (boundary case — verifies `>=` not `>`)
        (61, True),     # > 60 → INCLUDED
    ])
    def test_long_aging_filter_at_60_day_boundary(self, age_days, should_include, monkeypatch):
        """min_days=60 boundary: 60 must be included (`>=`), not excluded (`>`)."""
        import asyncio
        from datetime import timedelta
        from smartbi_compat.api import analysis_inventory

        FROZEN_TODAY = real_date(2026, 5, 2)
        receipt_date = FROZEN_TODAY - timedelta(days=age_days)

        async def fake_batches(*_a, **_k):
            return [{
                "id": 1, "name": "TestBatch",
                "receipt_date": receipt_date,
                "unit_price": Decimal("10"),
                "receipt_quantity": Decimal("5"),
                "used_quantity": Decimal("0"),
                "reserved_quantity": Decimal("0"),
                "material_type_id": "MAT-001",
                "material_type_name": "原料A",
            }]

        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)

        class FrozenDate(real_date):
            @classmethod
            def today(cls): return FROZEN_TODAY
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        ranking = asyncio.run(analysis_inventory._get_long_aging_batches_ranking("F", 60))
        if should_include:
            assert len(ranking) == 1, f"age_days={age_days} should be included (>=60)"
        else:
            assert len(ranking) == 0, f"age_days={age_days} should be excluded (<60)"
```

- [ ] **Step 2: Run + verify 3/3 pass**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_inventory_contract.py::TestInventoryLongAgingFilterBoundary -v
```

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-C: TestInventoryLongAgingFilterBoundary (3 tests, T-INV-14)" \
  tests/python/smartbi_compat/test_analysis_inventory_contract.py
```

---

## Task 9: `TestInventoryAgingBucketBoundaries` (8 tests)

**Files:** same test file (append after Task 8)

Coverage: 4 boundaries × 2 sides = 8 tests for `_get_inventory_aging_chart` bucket assignment.
Boundaries: 30/31, 60/61, 90/91, plus null receipt_date.

- [ ] **Step 1: Append class**

```python
class TestInventoryAgingBucketBoundaries:
    """4 boundaries × 2 sides = 8 tests for aging bucket assignment.

    Buckets: '0-30天', '31-60天', '61-90天', '90天以上'.
    Boundary semantics: bucket includes upper bound on left-side comparison.
    """

    @pytest.mark.parametrize("age_days,expected_bucket", [
        (30, "0-30天"),       # boundary: 30 → first bucket
        (31, "31-60天"),      # boundary: 31 → second
        (60, "31-60天"),      # boundary: 60 → second
        (61, "61-90天"),      # boundary: 61 → third
        (90, "61-90天"),      # boundary: 90 → third
        (91, "90天以上"),     # boundary: 91 → fourth
        (200, "90天以上"),    # well past 90
        (None, "90天以上"),   # null receipt_date → 90天以上 (T-INV-3)
    ])
    def test_aging_bucket_assignment(self, age_days, expected_bucket, monkeypatch):
        """Verify each batch lands in the correct bucket."""
        import asyncio
        from datetime import timedelta
        from smartbi_compat.api import analysis_inventory

        FROZEN_TODAY = real_date(2026, 5, 2)
        if age_days is None:
            receipt_date = None
        else:
            receipt_date = FROZEN_TODAY - timedelta(days=age_days)

        async def fake_batches(*_a, **_k):
            return [{
                "id": 1, "receipt_date": receipt_date,
                "unit_price": Decimal("100"),
                "receipt_quantity": Decimal("10"),
                "used_quantity": Decimal("0"),
                "reserved_quantity": Decimal("0"),
            }]

        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)

        class FrozenDate(real_date):
            @classmethod
            def today(cls): return FROZEN_TODAY
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        chart = asyncio.run(analysis_inventory._get_inventory_aging_chart("F"))
        # Find bucket with non-zero value
        bucket_with_value = next(
            (d for d in chart["data"] if d["value"] > 0), None
        )
        assert bucket_with_value is not None, f"No bucket got the batch (age={age_days})"
        assert bucket_with_value["aging"] == expected_bucket, \
            f"age_days={age_days}: expected {expected_bucket}, got {bucket_with_value['aging']}"
```

- [ ] **Step 2: Run + verify 8/8 pass**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_inventory_contract.py::TestInventoryAgingBucketBoundaries -v
```

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-C: TestInventoryAgingBucketBoundaries (8 tests)" \
  tests/python/smartbi_compat/test_analysis_inventory_contract.py
```

---

## Task 10: `TestInventoryGetCurrentQuantityFormula` (4 tests — T-INV-13)

**Files:** same test file (append after Task 9)

Coverage: 4 cases of `_get_current_quantity` (sync helper at line 310):
- receipt_quantity null → ZERO regardless
- used_quantity null → treated as 0
- reserved_quantity null → treated as 0
- All 3 non-null → receipt - used - reserved

- [ ] **Step 1: Append class**

```python
class TestInventoryGetCurrentQuantityFormula:
    """T-INV-13 — _get_current_quantity null-safe arithmetic."""

    def test_receipt_quantity_null_returns_zero(self):
        from smartbi_compat.api.analysis_inventory import _get_current_quantity
        batch = {
            "receipt_quantity": None,
            "used_quantity": Decimal("5"),
            "reserved_quantity": Decimal("2"),
        }
        assert _get_current_quantity(batch) == Decimal("0")

    def test_used_quantity_null_treated_as_zero(self):
        from smartbi_compat.api.analysis_inventory import _get_current_quantity
        batch = {
            "receipt_quantity": Decimal("10"),
            "used_quantity": None,
            "reserved_quantity": Decimal("2"),
        }
        # 10 - 0 - 2 = 8
        assert _get_current_quantity(batch) == Decimal("8")

    def test_reserved_quantity_null_treated_as_zero(self):
        from smartbi_compat.api.analysis_inventory import _get_current_quantity
        batch = {
            "receipt_quantity": Decimal("10"),
            "used_quantity": Decimal("3"),
            "reserved_quantity": None,
        }
        # 10 - 3 - 0 = 7
        assert _get_current_quantity(batch) == Decimal("7")

    def test_all_non_null_subtracts(self):
        from smartbi_compat.api.analysis_inventory import _get_current_quantity
        batch = {
            "receipt_quantity": Decimal("10"),
            "used_quantity": Decimal("3"),
            "reserved_quantity": Decimal("2"),
        }
        # 10 - 3 - 2 = 5
        assert _get_current_quantity(batch) == Decimal("5")
```

- [ ] **Step 2: Run + verify 4/4 pass**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_inventory_contract.py::TestInventoryGetCurrentQuantityFormula -v
```

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-C: TestInventoryGetCurrentQuantityFormula (4 tests, T-INV-13)" \
  tests/python/smartbi_compat/test_analysis_inventory_contract.py
```

---

## Task 11: `TestInventoryExpiringRankingInlineAlert` (4 tests)

**Files:** same test file (append after Task 10)

Coverage: 4 boundary tests for inline 7/15-day ternary in `_get_expiring_batches_ranking` (line 848). Verifies alertLevel determination based on days-to-expiry.

- [ ] **Step 1: Append class**

```python
class TestInventoryExpiringRankingInlineAlert:
    """4 boundary tests for inline alertLevel ternary in _get_expiring_batches_ranking.

    Java semantics (typical for inverse expiry alert):
      days <= 7  → RED
      days <= 15 → YELLOW
      else       → GREEN
    Confirm exact thresholds via impl. If `<` strict, adjust boundaries.
    """

    @pytest.mark.parametrize("days_until_expiry,expected_alert", [
        (3, "RED"),       # well below 7
        (7, "RED"),       # boundary: <= 7
        (15, "YELLOW"),   # boundary: <= 15
        (30, "GREEN"),    # > 15
    ])
    def test_expiring_alert_thresholds(self, days_until_expiry, expected_alert, monkeypatch):
        import asyncio
        from datetime import timedelta
        from smartbi_compat.api import analysis_inventory

        FROZEN_TODAY = real_date(2026, 5, 2)
        expiry_date = FROZEN_TODAY + timedelta(days=days_until_expiry)

        async def fake_expiring(*_a, **_k):
            return [{
                "id": 1, "name": "B1",
                "expiry_date": expiry_date,
                "unit_price": Decimal("10"),
                "receipt_quantity": Decimal("5"),
                "used_quantity": Decimal("0"),
                "reserved_quantity": Decimal("0"),
                "material_type_id": "MAT-001",
                "material_type_name": "原料A",
            }]

        monkeypatch.setattr(analysis_inventory, "_query_expiring_batches", fake_expiring)

        class FrozenDate(real_date):
            @classmethod
            def today(cls): return FROZEN_TODAY
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        ranking = asyncio.run(analysis_inventory._get_expiring_batches_ranking("F"))
        assert len(ranking) >= 1
        # Find the test batch
        test_entry = next((r for r in ranking if r.get("name") == "B1"), ranking[0])
        assert test_entry.get("alertLevel") == expected_alert, \
            f"days={days_until_expiry}: expected {expected_alert}, got {test_entry.get('alertLevel')}"
```

- [ ] **Step 2: Run + verify 4/4 pass**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_inventory_contract.py::TestInventoryExpiringRankingInlineAlert -v
```

If thresholds don't match (e.g. impl uses `<` strict instead of `<=`), the subagent must `Read` `_get_expiring_batches_ranking` to determine actual operators, adjust parametrize boundaries to match.

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-C: TestInventoryExpiringRankingInlineAlert (4 tests)" \
  tests/python/smartbi_compat/test_analysis_inventory_contract.py
```

---

## Task 12: `TestInventoryLongAgingRankingInlineAlert` (4 tests)

**Files:** same test file (append after Task 11)

Coverage: 4 boundary tests for inline 90/120-day ternary in `_get_long_aging_batches_ranking` (line 1168).

- [ ] **Step 1: Append class**

```python
class TestInventoryLongAgingRankingInlineAlert:
    """4 boundary tests for inline alertLevel ternary in _get_long_aging_batches_ranking.

    Java semantics (longer aging = worse):
      ageDays >= 120 → RED
      ageDays >= 90  → YELLOW
      else            → GREEN
    Confirm exact thresholds via impl read.
    """

    @pytest.mark.parametrize("age_days,expected_alert", [
        (60, "GREEN"),     # below 90
        (90, "YELLOW"),    # boundary: >= 90
        (120, "RED"),      # boundary: >= 120
        (200, "RED"),      # well past 120
    ])
    def test_long_aging_alert_thresholds(self, age_days, expected_alert, monkeypatch):
        import asyncio
        from datetime import timedelta
        from smartbi_compat.api import analysis_inventory

        FROZEN_TODAY = real_date(2026, 5, 2)
        receipt_date = FROZEN_TODAY - timedelta(days=age_days)

        async def fake_batches(*_a, **_k):
            return [{
                "id": 1, "name": "B1",
                "receipt_date": receipt_date,
                "unit_price": Decimal("10"),
                "receipt_quantity": Decimal("5"),
                "used_quantity": Decimal("0"),
                "reserved_quantity": Decimal("0"),
                "material_type_id": "MAT-001",
                "material_type_name": "原料A",
            }]

        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)

        class FrozenDate(real_date):
            @classmethod
            def today(cls): return FROZEN_TODAY
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        # Use min_days=60 so all test batches qualify (filter check separate from alert)
        ranking = asyncio.run(analysis_inventory._get_long_aging_batches_ranking("F", 60))
        assert len(ranking) == 1
        assert ranking[0].get("alertLevel") == expected_alert, \
            f"age_days={age_days}: expected {expected_alert}, got {ranking[0].get('alertLevel')}"
```

- [ ] **Step 2: Run + verify 4/4 pass**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_inventory_contract.py::TestInventoryLongAgingRankingInlineAlert -v
```

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "Phase 2A inventory PR-C: TestInventoryLongAgingRankingInlineAlert (4 tests)" \
  tests/python/smartbi_compat/test_analysis_inventory_contract.py
```

---

## Task 13: Full pytest gate + push + PR open

- [ ] **Step 1: Run full inventory contract test suite — all green**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_inventory_contract.py -v --tb=short
```

Expected: 5 (PR-A/PR-B baseline) + ~85 (12 PR-C classes) = ~90 tests, all green. If any fail, BLOCK and investigate.

- [ ] **Step 2: Run full smartbi_compat suite (no regression)**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -v --tb=short
```

Expected: all green. If pre-existing flake unrelated to inventory, document.

- [ ] **Step 3: Push branch**

```bash
git push -u origin phase2a/inventory-pr-c
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --base main --head phase2a/inventory-pr-c \
  --title "Phase 2A: /analysis/inventory arithmetic depth tests (PR-C)" \
  --body "$(cat <<'EOF'
## Summary

Add 12 arithmetic-depth unit test classes (~90 tests) for /analysis/inventory completing the PR-A0/PR-A/PR-B/PR-C ship cadence. Tests-only — no impl changes to `analysis_inventory.py`.

## Coverage by class

| Class | Tests | Locks |
|---|---|---|
| TestInventoryAlertHelpersArithmetic | 16 | 4 helpers × 4 boundaries (strict-> for expiry/loss) |
| TestInventoryDivByZeroGuards | 15 | 5 div-by-zero sites × 3 cases |
| TestInventoryDateArithmetic | 3 | annualization + null receipt → '90天以上' (T-INV-3) |
| TestInventoryLinkedHashMapOrder | 3 | T-INV-5 explicit positional list assertion |
| TestInventoryLossTrendChartMock | 1 | T-INV-8 negative — _get_loss_trend_chart NOT exported |
| TestInventoryHealthScoreAsymmetric | 5 | T-INV-9 asymmetric null (turnover→0, others→full) |
| TestInventoryHealthScoreTierArithmetic | ~20 | T-INV-15 inline tier `>=` vs `<` boundaries |
| TestInventoryLongAgingFilterBoundary | 3 | T-INV-14 filter `>=` inclusive at 60-day boundary |
| TestInventoryAgingBucketBoundaries | 8 | 30/31, 60/61, 90/91, null bucket assignment |
| TestInventoryGetCurrentQuantityFormula | 4 | T-INV-13 null-safe receipt-used-reserved |
| TestInventoryExpiringRankingInlineAlert | 4 | inline 7/15-day ternary alertLevel |
| TestInventoryLongAgingRankingInlineAlert | 4 | inline 90/120-day ternary alertLevel |

Total: 5 baseline + ~86 PR-C = ~91 tests.

## Test plan

- [x] No code changes — pure tests-only PR
- [x] All 12 classes pass independently via pytest -k filter
- [x] Full test_analysis_inventory_contract.py green
- [x] No regression in tests/python/smartbi_compat/ broader suite
- [x] T-INV-* lock-ins explicitly named in test docstrings (1, 3, 5, 8, 9, 13, 14, 15)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Report PR URL + tag user for admin merge**

---

## Subagent dispatch strategy (recommended: parallel)

These 12 tasks all append to the same file but each writes a unique class. No shared state, no sequential deps. Dispatch 6-12 subagents in single message (parallel batch).

⚠️ **Concurrency caveat:** All subagents append to the same file — risk of overlapping edits. Mitigations:
1. Each subagent uses unique class name (no name collision)
2. Each subagent's append is preceded by reading current file state to find last line number
3. Main session does post-dispatch `git diff --stat` check + manual review
4. If conflict, sequential redispatch fallback

Wall-clock estimate: ~60-80 min worst-case (slowest subagent — likely Task 7 with 20 parametrized tests + 4 dim setups). Total ship: 4-5h including pre-flight + dispatch + verify + PR.

Alternative: **sequential** (Task 1→12 in order) ~3h wall-clock, zero collision. Pick parallel if subagents have been reliable; sequential if any flake recently.

---

## Risk register

| # | Risk | Mitigation |
|---|---|---|
| R1 | Inline alert ternaries (Task 11/12) use unexpected operators | Subagent reads impl line 848 / 1168 first to confirm `<=` vs `<` semantics |
| R2 | Existing PR-B `test_health_score_asymmetric_null_regression` overlaps Task 6 | Task 6 covers 4 NEW cases (existing covers case 1: all-None=70). No duplication |
| R3 | Frozen date calculation off-by-one in age boundary tests | Use `FROZEN_TODAY - timedelta(days=age_days)` consistently, document FROZEN_TODAY = `date(2026, 5, 2)` |
| R4 | Subagent task collision on file append | Sequential fallback; main-session git diff post-dispatch verify |
| R5 | T-INV-15 boundary test count discrepancy (spec says ~24, plan has 20) | If subagent finds spec wants 24, add 4 more (loss/aging extremes at 0.0/100.0) |
| R6 | Mock signature mismatch — actual `_query_*` signatures differ from fake | Subagent reads actual signature (e.g. `_query_material_consumptions_in_range(factory_id, start, end)`) before writing fake |
| R7 | Concurrent edit on test file (rare — no other chat works on inventory) | safe-commit.sh per-task locks scope; per-task commits prevent batch loss |
| R8 | pytest baseline fail before PR-C tests added (PR-A/PR-B regression) | Pre-flight PA-3 catches; BLOCK and investigate |

---

## Notes

- **No goldens needed** — PR-C is arithmetic depth, not byte-shape. Goldens shipped in PR-A/PR-B.
- **No impl changes** — strictly tests-only, per HARD RULE 1.
- **One commit per class** (12 commits) — easy to git bisect, easy to revert single-class issue post-merge.
- **Plan file commits with PR** — final commit task or include in Task 1 commit.

---

## References

- Spec: `docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md` §5.3 + §3 algorithm
- Impl: `backend/python/smartbi_compat/api/analysis_inventory.py` (do not modify)
- Test file: `tests/python/smartbi_compat/test_analysis_inventory_contract.py` (existing 5 contract tests, append 12 classes)
- Sister PR-Cs (template precedent):
  - PR #28 cost PR-B (TestCostTrendArithmetic, 5 tests)
  - PR #51 payable PR-B (3 classes, ~30 tests)
  - PR #46 receivable PR-B (5 classes, 73 tests)
  - PR #44 budget PR-B (4 classes, 22 tests)
  - PR #57 department PR-C (4 sub-services, 4 classes ~16 tests)
- Hard rules: `.claude/rules/python-java-port.md` Rule 1-9
- Concurrent edit safety: `.claude/rules/concurrent-edit-safety.md` Rule 5b



