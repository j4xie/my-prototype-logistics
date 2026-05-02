"""Arithmetic depth tests for /analysis/department sub-services (PR-B).

Spec: docs/superpowers/specs/2026-05-01-phase2a-analysis-department-design.md §5.2
Sister precedent: tests/python/smartbi_compat/test_analysis_finance_factories.py

Covers 21 tests across 4 sub-service test classes:
  - TestDepartmentRankingArithmetic         (5 tests, headcount-MAX C1 + alert boundaries)
  - TestDepartmentCompletionRatesArithmetic (5 tests, thousands separator + arithmetic order C5)
  - TestDepartmentEfficiencyMatrixArithmetic (6 tests, quadrant C3 + Map.of canonical order)
  - TestDepartmentTrendComparisonArithmetic (5 tests, WEEK Rule 2 + I4 dept order)

PR-A (PR #52) already covers HTTP/JWT/byte-shape contract via test_analysis_department_contract.py.
This file targets internal helpers directly — pure arithmetic + per-sub-service shape.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

import smartbi_compat.api.analysis_department as analysis_department
from smartbi_compat.api.analysis_department import (
    _aggregate_department_data,
    _calculate_completion_rate,
    _create_empty_chart,
    _determine_quadrant,
    _determine_target_completion_alert,
    _get_department_completion_rates,
    _get_department_efficiency_matrix,
    _get_department_ranking,
    _get_department_trend_comparison,
)


# ============================================================
# Mock builders (mirror spec §5.3)
# ============================================================


def _make_dept_row(
    *,
    dept: str,
    record_date: date,
    sales_amount: str | None = "100000",
    sales_target: str | None = "80000",
    cost_amount: str | None = "60000",
    headcount: int | None = 10,
    row_id: int = 1,
    factory_id: str = "F001",
) -> dict:
    """Build a synthetic smart_bi_department_data row.

    Includes I3-trap precomputed columns (`per_capita_sales`/`per_capita_cost`)
    set to bogus 9999 — aggregator MUST IGNORE these and recompute.
    """
    return {
        "id": row_id,
        "factory_id": factory_id,
        "department": dept,
        "record_date": record_date,
        "sales_amount": Decimal(sales_amount) if sales_amount is not None else None,
        "sales_target": Decimal(sales_target) if sales_target is not None else None,
        "cost_amount": Decimal(cost_amount) if cost_amount is not None else None,
        "headcount": headcount,
        "per_capita_sales": Decimal("9999"),
        "per_capita_cost": Decimal("9999"),
    }


def _make_trend_row(
    *,
    order_date: date,
    dept: str,
    total_amount: str | None = "50000",
) -> dict:
    """Build a synthetic findDepartmentDailyTrend GROUP BY result row."""
    return {
        "order_date": order_date,
        "department": dept,
        "total_amount": Decimal(total_amount) if total_amount is not None else None,
    }


def _patch_full(monkeypatch, rows: list[dict]) -> None:
    async def _fake(factory_id, start_date, end_date):
        return rows

    monkeypatch.setattr(analysis_department, "_query_department_full", _fake)


def _patch_trend(monkeypatch, rows: list[dict]) -> None:
    async def _fake(factory_id, start_date, end_date):
        return rows

    monkeypatch.setattr(analysis_department, "_query_department_daily_trend", _fake)


# ============================================================
# 1. TestDepartmentRankingArithmetic (5 tests)
# ============================================================


class TestDepartmentRankingArithmetic:
    """Ranking: sort by salesAmount desc, alert via TARGET_COMPLETION (60/85),
    headcount MAX (C1)."""

    @pytest.mark.asyncio
    async def test_empty_rows_returns_empty_list(self, monkeypatch):
        _patch_full(monkeypatch, [])
        result = await _get_department_ranking(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        assert result == []

    @pytest.mark.asyncio
    async def test_sort_stability_tie_break(self, monkeypatch):
        # Two depts with identical salesAmount → Python stable sort preserves
        # dict insertion order from _aggregate_department_data (LinkedHashMap parity).
        rows = [
            _make_dept_row(
                dept="销售部",
                record_date=date(2025, 6, 1),
                sales_amount="50000",
                sales_target="60000",
                row_id=1,
            ),
            _make_dept_row(
                dept="运营部",
                record_date=date(2025, 6, 1),
                sales_amount="50000",
                sales_target="60000",
                row_id=2,
            ),
        ]
        _patch_full(monkeypatch, rows)
        result = await _get_department_ranking(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        assert [r["name"] for r in result] == ["销售部", "运营部"]
        assert result[0]["rank"] == 1
        assert result[1]["rank"] == 2

    @pytest.mark.asyncio
    async def test_completion_rate_zero_emits_alert_red(self, monkeypatch):
        # cr=0 (salesAmount=0 / target=10000) → alertLevel=RED (0 < 60)
        rows = [
            _make_dept_row(
                dept="销售部",
                record_date=date(2025, 6, 1),
                sales_amount="0",
                sales_target="10000",
            )
        ]
        _patch_full(monkeypatch, rows)
        result = await _get_department_ranking(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        assert result[0]["completionRate"] == 0
        assert result[0]["alertLevel"] == "RED"

    @pytest.mark.asyncio
    async def test_completion_rate_85_boundary_emits_green(self, monkeypatch):
        # cr=85.00 → GREEN (boundary `< 85` strict, so == 85 falls through to GREEN)
        rows = [
            _make_dept_row(
                dept="销售部",
                record_date=date(2025, 6, 1),
                sales_amount="8500",
                sales_target="10000",
            )
        ]
        _patch_full(monkeypatch, rows)
        result = await _get_department_ranking(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        assert result[0]["completionRate"] == 85
        assert result[0]["alertLevel"] == "GREEN"

    @pytest.mark.asyncio
    async def test_headcount_max_not_latest_by_date(self, monkeypatch):
        # C1 anti-regression: 3 rows with headcount [15, 8, 12] in record_date ASC.
        # Aggregated headcount must be MAX (15), NOT latest-by-date (12).
        # Java code line 561-562 is `if (data.getHeadcount() > agg.headcount) ...` —
        # the misleading comment "人员数取最新记录" is WRONG.
        rows = [
            _make_dept_row(
                dept="销售部",
                record_date=date(2025, 6, 1),
                sales_amount="100000",
                cost_amount="60000",
                headcount=15,
                row_id=1,
            ),
            _make_dept_row(
                dept="销售部",
                record_date=date(2025, 7, 1),
                sales_amount="100000",
                cost_amount="60000",
                headcount=8,
                row_id=2,
            ),
            _make_dept_row(
                dept="销售部",
                record_date=date(2025, 8, 1),
                sales_amount="100000",
                cost_amount="60000",
                headcount=12,
                row_id=3,
            ),
        ]
        agg = _aggregate_department_data(rows)
        assert agg["销售部"]["headcount"] == 15  # MAX, not latest 12

        # Verify efficiencyMatrix uses headcount=15 in per-capita calc
        # Total salesAmount = 300000, headcount(MAX)=15 → per_capita_sales = 20000
        _patch_full(monkeypatch, rows)
        em = await _get_department_efficiency_matrix(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        assert em["data"][0]["headcount"] == 15
        assert em["data"][0]["perCapitaSales"] == 20000


# ============================================================
# 2. TestDepartmentCompletionRatesArithmetic (5 tests)
# ============================================================


class TestDepartmentCompletionRatesArithmetic:
    """CompletionRates: sort by cr desc, formattedValue with thousands separator
    (Java DecimalFormat #,##0.00), arithmetic order locked at SCALE=4."""

    @pytest.mark.asyncio
    async def test_sort_by_completion_rate_desc(self, monkeypatch):
        rows = [
            _make_dept_row(
                dept="A",
                record_date=date(2025, 6, 1),
                sales_amount="5000",
                sales_target="10000",
                row_id=1,
            ),
            _make_dept_row(
                dept="B",
                record_date=date(2025, 6, 1),
                sales_amount="9000",
                sales_target="10000",
                row_id=2,
            ),
            _make_dept_row(
                dept="C",
                record_date=date(2025, 6, 1),
                sales_amount="7500",
                sales_target="10000",
                row_id=3,
            ),
        ]
        _patch_full(monkeypatch, rows)
        result = await _get_department_completion_rates(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        assert [r["dimensionValue"] for r in result] == ["B", "C", "A"]

    def test_target_zero_returns_completion_zero(self):
        # C4 verify: target=0 → cr=0 (NOT div-by-zero exception)
        assert _calculate_completion_rate(Decimal("100"), Decimal("0")) == Decimal("0")
        # target=None also → 0
        assert _calculate_completion_rate(Decimal("100"), None) == Decimal("0")

    @pytest.mark.asyncio
    async def test_formatted_value_percent_format(self, monkeypatch):
        # cr=85.00 → "85.00%" (no thousands separator branch)
        rows = [
            _make_dept_row(
                dept="销售部",
                record_date=date(2025, 6, 1),
                sales_amount="8500",
                sales_target="10000",
            )
        ]
        _patch_full(monkeypatch, rows)
        result = await _get_department_completion_rates(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        assert result[0]["formattedValue"] == "85.00%"

    @pytest.mark.asyncio
    async def test_formatted_value_thousands_separator(self, monkeypatch):
        # cr ≥ 1000 → thousands comma. actual=12345, target=1000 → cr=1234.50
        rows = [
            _make_dept_row(
                dept="销售部",
                record_date=date(2025, 6, 1),
                sales_amount="12345",
                sales_target="1000",
            )
        ]
        _patch_full(monkeypatch, rows)
        result = await _get_department_completion_rates(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        assert result[0]["formattedValue"] == "1,234.50%"

    def test_completion_rate_arithmetic_order_byte_equal(self):
        # Spec §3.5 lock: ((actual * 100) / target).quantize(SCALE=4)
        # NOT (actual*100).quantize(SCALE=4) / target  ← buggy alt order
        # actual=33.333, target=9.7 → cr=343.6392 (locked exact at SCALE=4)
        cr = _calculate_completion_rate(Decimal("33.333"), Decimal("9.7"))
        assert cr == Decimal("343.6392")


# ============================================================
# 3. TestDepartmentEfficiencyMatrixArithmetic (6 tests)
# ============================================================


class TestDepartmentEfficiencyMatrixArithmetic:
    """EfficiencyMatrix: scatter chart with per-point quadrant recompute (C3)
    + canonical Map.of(2)/(4) options key order."""

    @pytest.mark.asyncio
    async def test_empty_rows_returns_empty_scatter_chart(self, monkeypatch):
        # I5 verify: empty → _create_empty_chart("SCATTER", "部门效率矩阵")
        _patch_full(monkeypatch, [])
        result = await _get_department_efficiency_matrix(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        assert result == _create_empty_chart("SCATTER", "部门效率矩阵")

    @pytest.mark.asyncio
    async def test_single_department_quadrant_q4(self, monkeypatch):
        # Spec §5.2 names this "q4" but with single dept self == avg, both `>=` are True
        # → Q1. The boundary (`>=`) makes Q4 require strict inequality on cost which a
        # single-dept dataset cannot achieve. Asserting actual code-behavior (Q1).
        rows = [
            _make_dept_row(
                dept="销售部",
                record_date=date(2025, 6, 1),
                sales_amount="100000",
                cost_amount="60000",
                headcount=10,
            )
        ]
        _patch_full(monkeypatch, rows)
        result = await _get_department_efficiency_matrix(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        assert result["data"][0]["quadrant"] == "Q1_HIGH_OUTPUT_HIGH_COST"

    @pytest.mark.asyncio
    async def test_four_departments_full_quadrant_matrix(self, monkeypatch):
        # 4 depts placed to land each in a distinct quadrant.
        # Per-capita sales: A=15000, B=5000, C=5000, D=15000 → avg_sales = 10000
        # Per-capita cost:  A=8000,  B=4000, C=8000, D=4000  → avg_cost  = 6000
        #   A: sales>=avg && cost>=avg → Q1
        #   B: sales<avg  && cost<avg  → Q2
        #   C: sales<avg  && cost>=avg → Q3
        #   D: sales>=avg && cost<avg  → Q4
        rows = [
            _make_dept_row(
                dept="A",
                record_date=date(2025, 6, 1),
                sales_amount="150000",
                cost_amount="80000",
                headcount=10,
                row_id=1,
            ),
            _make_dept_row(
                dept="B",
                record_date=date(2025, 6, 1),
                sales_amount="50000",
                cost_amount="40000",
                headcount=10,
                row_id=2,
            ),
            _make_dept_row(
                dept="C",
                record_date=date(2025, 6, 1),
                sales_amount="50000",
                cost_amount="80000",
                headcount=10,
                row_id=3,
            ),
            _make_dept_row(
                dept="D",
                record_date=date(2025, 6, 1),
                sales_amount="150000",
                cost_amount="40000",
                headcount=10,
                row_id=4,
            ),
        ]
        _patch_full(monkeypatch, rows)
        result = await _get_department_efficiency_matrix(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        quadrants = {p["department"]: p["quadrant"] for p in result["data"]}
        assert quadrants["A"] == "Q1_HIGH_OUTPUT_HIGH_COST"
        assert quadrants["B"] == "Q2_LOW_OUTPUT_LOW_COST"
        assert quadrants["C"] == "Q3_LOW_OUTPUT_HIGH_COST"
        assert quadrants["D"] == "Q4_HIGH_OUTPUT_LOW_COST"

    def test_quadrant_per_point_recompute_byte_equal(self):
        # C3 lock — _determine_quadrant re-iterates aggregated_data per call to compute
        # avg, applies SCALE=4 quantize at each step. This test verifies that the
        # quantize-at-each-step pipeline produces the documented quadrant for a
        # specific aggregated dataset, locking against future "lift avg out of loop"
        # optimization which would change byte-shape due to rounding accumulation.
        aggregated = {
            "A": {
                "salesAmount": Decimal("100000"),
                "costAmount": Decimal("60000"),
                "headcount": 10,
                "salesTarget": Decimal("0"),
            },
            "B": {
                "salesAmount": Decimal("33333"),
                "costAmount": Decimal("19999"),
                "headcount": 7,
                "salesTarget": Decimal("0"),
            },
        }
        # A's per_capita inputs (quantized at SCALE=4 by caller before passing in)
        a_pcs = (Decimal("100000") / Decimal("10")).quantize(Decimal("0.0001"))
        a_pcc = (Decimal("60000") / Decimal("10")).quantize(Decimal("0.0001"))
        result = _determine_quadrant(a_pcs, a_pcc, aggregated)
        # avg_sales ≈ (10000.0000 + 4761.8571) / 2 ≈ 7380.9286 (3-stage quantize)
        # avg_cost  ≈ (6000.0000 + 2857.0000) / 2 ≈ 4428.5000
        # A: 10000 >= 7380.93 (high_output), 6000 >= 4428.50 (high_cost) → Q1
        assert result == "Q1_HIGH_OUTPUT_HIGH_COST"

    @pytest.mark.asyncio
    async def test_map_of_2_quadrant_lines_order_canonical(self, monkeypatch):
        # Rule 8 / I1 — options.quadrantLines key order locked at [xAxis, yAxis]
        # per spec §3.6 Python emit; F999 empty case doesn't trigger options dict
        # so non-empty assertion goes here.
        rows = [
            _make_dept_row(
                dept="A",
                record_date=date(2025, 6, 1),
                sales_amount="100000",
                cost_amount="60000",
                headcount=10,
            )
        ]
        _patch_full(monkeypatch, rows)
        result = await _get_department_efficiency_matrix(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        assert list(result["options"]["quadrantLines"].keys()) == ["xAxis", "yAxis"]

    @pytest.mark.asyncio
    async def test_map_of_4_quadrant_labels_order_canonical(self, monkeypatch):
        # Rule 8 / I1 — options.quadrantLabels key order locked at [q1, q2, q3, q4]
        # per spec §3.6 Python emit.
        rows = [
            _make_dept_row(
                dept="A",
                record_date=date(2025, 6, 1),
                sales_amount="100000",
                cost_amount="60000",
                headcount=10,
            )
        ]
        _patch_full(monkeypatch, rows)
        result = await _get_department_efficiency_matrix(
            "F001", date(2025, 1, 1), date(2025, 12, 31)
        )
        assert list(result["options"]["quadrantLabels"].keys()) == [
            "q1",
            "q2",
            "q3",
            "q4",
        ]


# ============================================================
# 4. TestDepartmentTrendComparisonArithmetic (5 tests)
# ============================================================


class TestDepartmentTrendComparisonArithmetic:
    """TrendComparison: WEEK period bucketing (Rule 2 calendar-year), multi-dept
    merge, sorted period axis, same-date dept order unspecified (I4)."""

    @pytest.mark.asyncio
    async def test_empty_rows_returns_empty_line_chart(self, monkeypatch):
        # I5 verify: empty → _create_empty_chart("LINE", "部门销售趋势对比")
        _patch_trend(monkeypatch, [])
        result = await _get_department_trend_comparison(
            "F001", date(2025, 1, 1), date(2025, 12, 31), "WEEK"
        )
        assert result == _create_empty_chart("LINE", "部门销售趋势对比")

    @pytest.mark.asyncio
    async def test_multi_dept_multi_period_merge(self, monkeypatch):
        # 2 depts × 2 distinct weeks → 2 chart points, each with both dept values.
        rows = [
            _make_trend_row(order_date=date(2025, 6, 2), dept="A", total_amount="100"),
            _make_trend_row(order_date=date(2025, 6, 2), dept="B", total_amount="200"),
            _make_trend_row(order_date=date(2025, 6, 9), dept="A", total_amount="150"),
            _make_trend_row(order_date=date(2025, 6, 9), dept="B", total_amount="250"),
        ]
        _patch_trend(monkeypatch, rows)
        result = await _get_department_trend_comparison(
            "F001", date(2025, 1, 1), date(2025, 12, 31), "WEEK"
        )
        assert len(result["data"]) == 2
        for point in result["data"]:
            assert "A" in point and "B" in point
            assert "period" in point

    @pytest.mark.asyncio
    async def test_sorted_period_axis(self, monkeypatch):
        # Insert out-of-order rows; period axis must come back sorted ascending
        # (Java TreeSet → Python sorted()).
        rows = [
            _make_trend_row(order_date=date(2025, 8, 4), dept="A", total_amount="300"),
            _make_trend_row(order_date=date(2025, 6, 2), dept="A", total_amount="100"),
            _make_trend_row(order_date=date(2025, 7, 7), dept="A", total_amount="200"),
        ]
        _patch_trend(monkeypatch, rows)
        result = await _get_department_trend_comparison(
            "F001", date(2025, 1, 1), date(2025, 12, 31), "WEEK"
        )
        periods = [p["period"] for p in result["data"]]
        assert periods == sorted(periods)

    @pytest.mark.asyncio
    async def test_week_period_key_calendar_year_post_pr30(self, monkeypatch):
        # Rule 2 regression test: 2024-12-30 is ISO week 1 of ISO year 2025,
        # but calendar year is 2024 → period_key must be "2024-W01"
        # (post-PR #30 commit 8031f2644 calendar-year fix). Imports
        # _get_period_key from analysis_finance.py.
        rows = [
            _make_trend_row(
                order_date=date(2024, 12, 30), dept="A", total_amount="100"
            )
        ]
        _patch_trend(monkeypatch, rows)
        result = await _get_department_trend_comparison(
            "F001", date(2024, 12, 1), date(2024, 12, 31), "WEEK"
        )
        assert result["data"][0]["period"] == "2024-W01"

    @pytest.mark.asyncio
    async def test_same_date_dept_order_unspecified(self, monkeypatch):
        # I4 verify: same order_date with multi-dept rows. Python helper does
        # NOT add ORDER BY department (mirror Java JPQL which orders by
        # order_date only). Insertion order through dict drives `series` list.
        rows = [
            _make_trend_row(order_date=date(2025, 6, 2), dept="Z", total_amount="1"),
            _make_trend_row(order_date=date(2025, 6, 2), dept="A", total_amount="2"),
            _make_trend_row(order_date=date(2025, 6, 2), dept="M", total_amount="3"),
        ]
        _patch_trend(monkeypatch, rows)
        result = await _get_department_trend_comparison(
            "F001", date(2025, 1, 1), date(2025, 12, 31), "WEEK"
        )
        # all_departments built in row insertion order, NOT sorted alphabetically.
        # If Python ever started sorting, [A, M, Z] would result instead of [Z, A, M].
        assert result["options"]["series"] == ["Z", "A", "M"]
