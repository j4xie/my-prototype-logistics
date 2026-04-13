"""Regression tests for state-forwarding bugs found in Task 1.7 code review.

Handlers that lazy-construct their own RestaurantAnalyzerV2 previously
dropped sku_form_manager / db_session / monthly_calibrator, silently
downgrading production features. These tests lock in the fix (orchestrator
bypasses the broken handlers for menu_normalization, channel_margin,
bom_layer_status) and would catch any regression if the bypass is
accidentally reverted.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pandas as pd
import pytest

from smartbi.services.restaurant.analyzer import RestaurantAnalyzerV2


class _MockSkuFormManager:
    def __init__(self, count_value: int):
        self._count = count_value

    def count(self, factory_id: str) -> int:
        return self._count


class _MockMonthlyCalibrator:
    def __init__(self, period_count: int):
        self._count = period_count

    def count(self, factory_id: str) -> int:
        return self._count


def test_bom_layer_status_reports_layer_2_when_sku_form_manager_has_data():
    """Regression: Task 1.7 handler bridge dropped sku_form_manager, forcing Layer 1.

    Fix bypasses the handler for bom_layer_status and calls
    self._build_bom_layer_status() directly.
    """
    analyzer = RestaurantAnalyzerV2(
        factory_id="F-TEST",
        sub_sector="火锅",
        sku_form_manager=_MockSkuFormManager(count_value=5),
    )

    report = analyzer.analyze(
        financial_data={
            "current": {"revenue": 731048, "food_cost": 307040, "labor_cost": 237660, "rent": 85000},
        },
    )

    bom = report["sections"]["bomLayerStatus"]
    assert bom["currentLayer"] == "Layer 2", (
        f"Expected Layer 2 from sku_form_manager with 5 SKUs, got {bom['currentLayer']} "
        f"(handler bridge regression — outer state being dropped)"
    )
    assert bom["layer2SkuCount"] == 5
    assert bom["currentAccuracyPp"] == 8.0


def test_bom_layer_status_reports_layer_3_when_monthly_calibrator_has_data():
    """Layer 3 variant — 3+ periods upgrades to Layer 3 (±5pp)."""
    analyzer = RestaurantAnalyzerV2(
        factory_id="F-TEST",
        sub_sector="火锅",
        sku_form_manager=_MockSkuFormManager(count_value=5),
        monthly_calibrator=_MockMonthlyCalibrator(period_count=3),
    )

    report = analyzer.analyze(
        financial_data={"current": {"revenue": 731048, "labor_cost": 237660, "rent": 85000}},
    )

    bom = report["sections"]["bomLayerStatus"]
    assert bom["currentLayer"] == "Layer 3"
    assert bom["layer3PeriodCount"] == 3
    assert bom["currentAccuracyPp"] == 5.0
