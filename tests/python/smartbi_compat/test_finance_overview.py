"""Pattern B PR-C tests for _get_finance_overview 3-state branching.

Companion to PR #131 (initial PR-B State C only) + PR #135 (PR-B v2 full
3-state branching). Verifies:
  - State A (Gold populated): KPIs from Gold + top_stores ranking
  - State B (Gold null/empty): empty DashboardResponse
  - State C (flag=false OR Gold throws): legacy populated

Goldens recorded from Java test env :10011 with config-flip
SMARTBI_GOLD_READ_PRIMARY_ENABLED toggled per state. F001 has real Gold
POS data (revenue + bills > 0) so State A is real-data, NOT mock-only
as initially assumed.

Uses direct function call (not TestClient) with mocks for Gold service
+ primitives to reliably emit each state without local DB. Byte-shape
parity verified via dict-eq against golden["data"]["overview"] per
Phase 2A dict-eq gate (per .claude/rules/python-java-port.md Rule 4).
"""
from __future__ import annotations

import io
import json
import os
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

# JWT_SECRET must be set BEFORE importing production code
JWT_SECRET = "test-secret-for-phase2a-do-not-use-in-prod"
os.environ["JWT_SECRET"] = JWT_SECRET

REPO_ROOT = Path(__file__).resolve().parents[3]
GOLDEN_DIR = REPO_ROOT / "tests" / "fixtures" / "java-smartbi-golden"
sys.path.insert(0, str(REPO_ROOT / "backend" / "python"))

from smartbi_compat.api.analysis_finance import (  # noqa: E402
    _convert_metrics_to_kpi_cards,
    _generate_finance_insights,
    _generate_finance_suggestions,
    _get_finance_overview,
)
from smartbi_compat.date_range import DateRange  # noqa: E402


VOLATILE = frozenset({"generatedAt", "lastUpdated", "cacheExpireAt", "timestamp"})


def _strip_volatile(obj):
    """Recursively strip timing keys before byte compare."""
    if isinstance(obj, dict):
        return {k: _strip_volatile(v) for k, v in obj.items() if k not in VOLATILE}
    if isinstance(obj, list):
        return [_strip_volatile(item) for item in obj]
    return obj


def _load_golden_overview(filename: str) -> dict:
    """Load golden file and return data.overview dict (volatile stripped)."""
    with io.open(GOLDEN_DIR / filename, encoding="utf-8") as f:
        golden = json.load(f)
    return _strip_volatile(golden["data"]["overview"])


def _build_gold_payload_from_golden(state_a_golden: dict) -> dict:
    """Reverse-engineer Gold service finance_summary output from a State A
    golden's overview dict. Used by State A mock to feed
    _build_finance_overview_from_gold the same Gold response Java consumed.
    """
    overview = state_a_golden
    kpi_by_key = {c["key"]: c for c in overview["kpiCards"]}
    top_stores = [
        {
            "store_id": idx,
            "store_name": item["name"],
            "revenue": Decimal(str(item["value"])) if item["value"] is not None else Decimal("0"),
            "bill_count": 0,
        }
        for idx, item in enumerate(overview["rankings"].get("top_stores", []), start=1)
    ]
    return {
        "total_revenue": Decimal(str(kpi_by_key["total_revenue"]["rawValue"])),
        "bill_count": Decimal(str(kpi_by_key["bill_count"]["rawValue"])),
        "avg_bill_value": Decimal(str(kpi_by_key["avg_bill_value"]["rawValue"])),
        "store_count": Decimal(str(kpi_by_key["store_count"]["rawValue"])),
        "top_stores": top_stores,
    }


@pytest.fixture
def date_range():
    return DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))


# ============================================================
# Section 1: 4 byte-shape parity tests (one per state branch)
# ============================================================


class TestFinanceOverviewByteShapeParity:
    """Dict-eq parity against goldens recorded from Java test env :10011."""

    @pytest.mark.asyncio
    async def test_state_b_f999_flag_true_gold_empty(self, date_range, monkeypatch):
        """State B: flag=true, Gold returns revenue=0+bills=0 → empty DashboardResponse.

        Golden source: F999 in test env (no Gold data) with flag=true → Java
        line 124-142 empty-skip path fires.
        """
        monkeypatch.setenv("SMARTBI_GOLD_READ_PRIMARY_ENABLED", "true")
        empty_gold = {
            "total_revenue": Decimal("0"),
            "bill_count": 0,
            "avg_bill_value": None,
            "store_count": 0,
            "top_stores": [],
        }
        with patch("smartbi.config.get_pg_pool", new=AsyncMock(return_value=None)), \
             patch("smartbi.gold.queries.finance_summary",
                   new=AsyncMock(return_value=empty_gold)):
            actual = await _get_finance_overview("F999", date_range)

        expected = _load_golden_overview("analysis-finance-overview-F999-state-b.json")
        assert _strip_volatile(actual) == expected, "State B byte-shape divergence"

    @pytest.mark.asyncio
    async def test_state_a_f001_flag_true_gold_populated(self, date_range, monkeypatch):
        """State A: flag=true, Gold returns populated → KPIs + top_stores ranking.

        Golden source: F001 in test env (HAS Gold POS data) with flag=true →
        Java GoldDashboardBuilder.buildFromFinanceSummary line 74-117 path fires.
        """
        monkeypatch.setenv("SMARTBI_GOLD_READ_PRIMARY_ENABLED", "true")
        expected = _load_golden_overview("analysis-finance-overview-F001-state-a.json")
        gold_payload = _build_gold_payload_from_golden(expected)

        with patch("smartbi.config.get_pg_pool", new=AsyncMock(return_value=None)), \
             patch("smartbi.gold.queries.finance_summary",
                   new=AsyncMock(return_value=gold_payload)):
            actual = await _get_finance_overview("F001", date_range)

        assert _strip_volatile(actual) == expected, "State A byte-shape divergence"

    @pytest.mark.asyncio
    async def test_state_c_f999_flag_false_legacy(self, date_range, monkeypatch):
        """State C: flag=false → legacy populated (no Gold call attempted).

        Golden source: F999 in test env with flag=false → Java line 149+ legacy.
        F999 has no SmartBI data → 10 zero metrics + 3 empty chart skeletons.
        """
        monkeypatch.setenv("SMARTBI_GOLD_READ_PRIMARY_ENABLED", "false")
        expected = _load_golden_overview("analysis-finance-overview-F999-state-c.json")

        # Mock primitives to return empty (matches F999 no-data state).
        with patch(
            "smartbi_compat.api.analysis_finance._get_profit_metrics",
            new=AsyncMock(return_value=expected_legacy_profit_metrics(expected)),
        ), patch(
            "smartbi_compat.api.analysis_finance._get_receivable_metrics",
            new=AsyncMock(return_value=expected_legacy_receivable_metrics(expected)),
        ), patch(
            "smartbi_compat.api.analysis_finance._get_profit_trend_chart",
            new=AsyncMock(return_value=expected["charts"]["利润趋势分析"]),
        ), patch(
            "smartbi_compat.api.analysis_finance._get_cost_structure_chart",
            new=AsyncMock(return_value=expected["charts"]["成本结构分析"]),
        ), patch(
            "smartbi_compat.api.analysis_finance._get_receivable_aging_chart",
            new=AsyncMock(return_value=expected["charts"]["应收账款账龄分布"]),
        ), patch(
            "smartbi_compat.api.analysis_finance._get_overdue_customer_ranking",
            new=AsyncMock(return_value=expected["rankings"]["overdue_customers"]),
        ):
            actual = await _get_finance_overview("F999", date_range)

        assert _strip_volatile(actual) == expected, "State C (F999 flag=false) byte-shape divergence"

    @pytest.mark.asyncio
    async def test_state_c_f001_flag_false_legacy(self, date_range, monkeypatch):
        """State C: flag=false for F001 → same shape as F999 (test env F001 has
        Gold data but no legacy SmartBI finance_data; legacy path emits zero metrics).

        Golden source: F001 in test env with flag=false → Java line 149+ legacy.
        """
        monkeypatch.setenv("SMARTBI_GOLD_READ_PRIMARY_ENABLED", "false")
        expected = _load_golden_overview("analysis-finance-overview-F001-state-c.json")

        with patch(
            "smartbi_compat.api.analysis_finance._get_profit_metrics",
            new=AsyncMock(return_value=expected_legacy_profit_metrics(expected)),
        ), patch(
            "smartbi_compat.api.analysis_finance._get_receivable_metrics",
            new=AsyncMock(return_value=expected_legacy_receivable_metrics(expected)),
        ), patch(
            "smartbi_compat.api.analysis_finance._get_profit_trend_chart",
            new=AsyncMock(return_value=expected["charts"]["利润趋势分析"]),
        ), patch(
            "smartbi_compat.api.analysis_finance._get_cost_structure_chart",
            new=AsyncMock(return_value=expected["charts"]["成本结构分析"]),
        ), patch(
            "smartbi_compat.api.analysis_finance._get_receivable_aging_chart",
            new=AsyncMock(return_value=expected["charts"]["应收账款账龄分布"]),
        ), patch(
            "smartbi_compat.api.analysis_finance._get_overdue_customer_ranking",
            new=AsyncMock(return_value=expected["rankings"]["overdue_customers"]),
        ):
            actual = await _get_finance_overview("F001", date_range)

        assert _strip_volatile(actual) == expected, "State C (F001 flag=false) byte-shape divergence"


def expected_legacy_profit_metrics(overview: dict) -> list:
    """Extract first 5 KPI cards as MetricResult-shaped dicts (profit metrics)."""
    return [_kpi_card_to_metric_result(c) for c in overview["kpiCards"][:5]]


def expected_legacy_receivable_metrics(overview: dict) -> list:
    """Extract last 5 KPI cards as MetricResult-shaped dicts (receivable metrics)."""
    return [_kpi_card_to_metric_result(c) for c in overview["kpiCards"][5:10]]


def _kpi_card_to_metric_result(card: dict) -> dict:
    """Reverse-map KPICard back to MetricResult for primitive mock returns.

    The composer `_convert_metrics_to_kpi_cards` does the forward mapping
    metric → card; here we go card → metric so primitives return what the
    composer expects.
    """
    trend_to_dir = {"up": "UP", "down": "DOWN", "flat": None}
    status_to_alert = {"red": "RED", "yellow": "YELLOW", "green": "GREEN"}
    return {
        "metricCode": card.get("key"),
        "metricName": card.get("title"),
        "value": card.get("rawValue"),
        "formattedValue": card.get("value") if card.get("value") != "-" else None,
        "unit": card.get("unit"),
        "changePercent": card.get("changeRate"),
        "changeDirection": trend_to_dir.get(card.get("trend")),
        "changeValue": card.get("change"),
        "alertLevel": status_to_alert.get(card.get("status"), "GREEN"),
        "dimensionValue": None,
        "description": card.get("description"),
    }


# ============================================================
# Section 2: 7 edge case tests (composer logic, mock-driven)
# ============================================================


class TestFinanceOverviewEdgeCases:
    """Composer logic via direct unit tests on _convert / _generate helpers."""

    def test_empty_metrics_yields_healthy_suggestion(self):
        """Empty metrics + empty rankings → 0 insights, 1 healthy fallback suggestion.

        Java line 2109-2111: if (suggestions.isEmpty()) → 财务指标整体健康...
        """
        insights = _generate_finance_insights([], [])
        suggestions = _generate_finance_suggestions([], [])
        assert insights == []
        assert suggestions == ["财务指标整体健康，建议继续保持良好的成本控制和收款管理"]

    def test_red_gross_margin_yields_one_insight_one_suggestion(self):
        """GROSS_MARGIN RED → 1 RED insight + 1 specific suggestion (Java line 1666-1675).
        """
        gross_margin_red = {
            "metricCode": "GROSS_MARGIN", "metricName": "毛利率",
            "alertLevel": "RED", "formattedValue": "12.50%",
            "value": Decimal("12.5"),
        }
        insights = _generate_finance_insights([gross_margin_red], [])
        suggestions = _generate_finance_suggestions([gross_margin_red], [])
        assert len(insights) == 1
        assert insights[0]["level"] == "RED"
        assert insights[0]["category"] == "毛利率偏低"
        assert "12.50%" in insights[0]["message"]
        assert insights[0]["relatedEntity"] == "GROSS_MARGIN"
        assert suggestions == ["建议审视产品定价策略，优化采购成本以提升毛利率"]

    def test_red_aging_90_yields_one_insight_one_suggestion(self):
        """AGING_90_RATIO RED → 1 RED insight + 1 specific suggestion (Java line 1679-1691).
        """
        aging_red = {
            "metricCode": "AGING_90_RATIO", "metricName": "90天以上账龄占比",
            "alertLevel": "RED", "formattedValue": "25.30%",
            "value": Decimal("25.3"),
        }
        insights = _generate_finance_insights([aging_red], [])
        suggestions = _generate_finance_suggestions([aging_red], [])
        assert len(insights) == 1
        assert insights[0]["category"] == "应收账款风险预警"
        assert "25.30%" in insights[0]["message"]
        assert insights[0]["relatedEntity"] == "AGING_90_RATIO"
        assert suggestions == ["建议对90天以上逾期客户启动专项催收，必要时考虑法律手段"]

    def test_red_collection_rate_yields_only_suggestion_no_insight(self):
        """COLLECTION_RATE RED → 0 insights (no insight branch) + 1 suggestion.

        Insight branches only fire for GROSS_MARGIN / AGING_90_RATIO / rankings.
        Suggestion branch fires for COLLECTION_RATE per Java line 2098-2100.
        """
        collection_red = {
            "metricCode": "COLLECTION_RATE", "metricName": "回款率",
            "alertLevel": "RED", "formattedValue": "65.00%",
        }
        insights = _generate_finance_insights([collection_red], [])
        suggestions = _generate_finance_suggestions([collection_red], [])
        assert insights == []  # no matching insight branch
        assert suggestions == ["建议加强应收账款管理，缩短回款周期"]

    def test_red_budget_execution_yields_only_suggestion_no_insight(self):
        """BUDGET_EXECUTION RED → 0 insights + 1 suggestion (Java line 2101-2103).
        """
        budget_red = {
            "metricCode": "BUDGET_EXECUTION", "metricName": "预算执行率",
            "alertLevel": "RED", "formattedValue": "125.00%",
        }
        insights = _generate_finance_insights([budget_red], [])
        suggestions = _generate_finance_suggestions([budget_red], [])
        assert insights == []
        assert suggestions == ["预算超支严重，建议立即审核支出合理性并控制后续开支"]

    def test_multi_red_yields_multi_insight_multi_suggestion(self):
        """GROSS_MARGIN + AGING_90_RATIO both RED → 2 insights + 2 suggestions.
        """
        gross_red = {"metricCode": "GROSS_MARGIN", "metricName": "毛利率",
                     "alertLevel": "RED", "formattedValue": "10.00%"}
        aging_red = {"metricCode": "AGING_90_RATIO", "metricName": "90天以上账龄占比",
                     "alertLevel": "RED", "formattedValue": "30.00%"}
        insights = _generate_finance_insights([gross_red, aging_red], [])
        suggestions = _generate_finance_suggestions([gross_red, aging_red], [])
        assert len(insights) == 2
        assert {i["category"] for i in insights} == {"毛利率偏低", "应收账款风险预警"}
        assert len(suggestions) == 2

    def test_overdue_red_rankings_yields_yellow_insight(self):
        """rankings non-empty + ≥1 RED ranking → 1 YELLOW '高风险客户' insight
        with redCount in message (Java line 1695-1707).
        """
        rankings = [
            {"name": "客户A", "alertLevel": "RED"},
            {"name": "客户B", "alertLevel": "RED"},
            {"name": "客户C", "alertLevel": "GREEN"},
        ]
        insights = _generate_finance_insights([], rankings)
        assert len(insights) == 1
        assert insights[0]["level"] == "YELLOW"
        assert insights[0]["category"] == "高风险客户"
        assert "2" in insights[0]["message"]  # redCount=2
        assert insights[0]["relatedEntity"] == "OVERDUE_CUSTOMERS"


# ============================================================
# Section 3: convert_metrics_to_kpi_cards mapping tests
# ============================================================


class TestConvertMetricsToKpiCards:
    """Verify alertLevel → status, changeDirection → trend, value fallback."""

    def test_red_alert_maps_to_red_status(self):
        cards = _convert_metrics_to_kpi_cards([
            {"metricCode": "X", "metricName": "x",
             "alertLevel": "RED", "formattedValue": "10%"}
        ])
        assert cards[0]["status"] == "red"

    def test_yellow_alert_maps_to_yellow_status(self):
        cards = _convert_metrics_to_kpi_cards([
            {"metricCode": "X", "metricName": "x",
             "alertLevel": "YELLOW", "formattedValue": "10%"}
        ])
        assert cards[0]["status"] == "yellow"

    def test_no_alert_defaults_to_green_status(self):
        cards = _convert_metrics_to_kpi_cards([
            {"metricCode": "X", "metricName": "x", "formattedValue": "10%"}
        ])
        assert cards[0]["status"] == "green"

    def test_change_direction_maps_to_trend(self):
        for direction, trend in [("UP", "up"), ("DOWN", "down"), ("FLAT", "flat"), (None, "flat")]:
            cards = _convert_metrics_to_kpi_cards([
                {"metricCode": "X", "metricName": "x",
                 "changeDirection": direction, "formattedValue": "10%"}
            ])
            assert cards[0]["trend"] == trend, f"direction={direction!r}"

    def test_value_falls_back_to_dash_when_all_none(self):
        cards = _convert_metrics_to_kpi_cards([
            {"metricCode": "X", "metricName": "x"}
        ])
        assert cards[0]["value"] == "-"
