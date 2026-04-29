"""Tests for DefectRateTopN manufacturing template (Apr 27 2026)."""
from __future__ import annotations

import polars as pl
import pytest

from smartbi.services.materialized_analytics.templates.defect_rate_top_n import (
    DefectRateTopN,
)
from smartbi.services.materialized_analytics.compute.base import ComputeBackend


class _MockBackend:
    """Minimal ComputeBackend stub holding a polars DataFrame for tests."""
    def __init__(self, df):
        self._df = df


class _MockField:
    def __init__(self, name):
        self.name = name


class _MockSchema:
    def __init__(self, field_names):
        self.fields = [_MockField(n) for n in field_names]


def _make_backend(rows, columns):
    df = pl.DataFrame({c: [r.get(c) for r in rows] for c in columns})
    return _MockBackend(df), _MockSchema(columns)


def test_applies_with_defect_and_total():
    tpl = DefectRateTopN()
    schema = _MockSchema(["工序", "不良数", "总数"])
    assert tpl.applies(schema) is True


def test_applies_with_defect_and_good():
    tpl = DefectRateTopN()
    schema = _MockSchema(["产品", "不良数", "合格数"])
    assert tpl.applies(schema) is True


def test_applies_with_total_and_good():
    tpl = DefectRateTopN()
    schema = _MockSchema(["工序", "总数", "合格数"])
    assert tpl.applies(schema) is True


def test_does_not_apply_without_dim():
    tpl = DefectRateTopN()
    schema = _MockSchema(["不良数", "总数"])  # no dim
    assert tpl.applies(schema) is False


def test_does_not_apply_without_metrics():
    tpl = DefectRateTopN()
    schema = _MockSchema(["工序", "其他列"])  # no defect/good/total
    assert tpl.applies(schema) is False


def test_compute_basic_ranking():
    """3 工序 with defect rates 5%, 10%, 2% → Top 1 should be 10%."""
    rows = [
        {"工序": "A", "不良数": 5, "总数": 100},
        {"工序": "A", "不良数": 5, "总数": 100},   # A total: 10/200 = 5%
        {"工序": "B", "不良数": 10, "总数": 100},
        {"工序": "B", "不良数": 10, "总数": 100},  # B total: 20/200 = 10%
        {"工序": "C", "不良数": 1, "总数": 100},
        {"工序": "C", "不良数": 1, "总数": 100},   # C total: 2/200 = 1%
    ]
    backend, schema = _make_backend(rows, ["工序", "不良数", "总数"])
    tpl = DefectRateTopN()
    result = tpl.compute(backend, schema)
    assert result.applies is True
    assert result.code == "defect_rate_top_n"
    ranking = result.data["ranking"]
    assert len(ranking) == 3
    # Top 1: B at 10%
    assert ranking[0]["dim_value"] == "B"
    assert ranking[0]["defect_rate_pct"] == 10.0
    # Last: C at 1%
    assert ranking[-1]["dim_value"] == "C"
    assert ranking[-1]["defect_rate_pct"] == 1.0
    # Insight contains action recommendation
    assert "B" in result.insight_text
    assert "工艺改善" in result.insight_text or "建议" in result.insight_text


def test_compute_handles_defect_and_good_only():
    """No 总数 column — total derived from defect + good."""
    rows = [
        {"工序": "A", "不良数": 5, "合格数": 95},  # 5%
        {"工序": "B", "不良数": 20, "合格数": 80},  # 20%
    ]
    backend, schema = _make_backend(rows, ["工序", "不良数", "合格数"])
    tpl = DefectRateTopN()
    result = tpl.compute(backend, schema)
    assert result.applies is True
    ranking = result.data["ranking"]
    assert ranking[0]["dim_value"] == "B"
    assert ranking[0]["defect_rate_pct"] == 20.0


def test_sample_queries_present():
    tpl = DefectRateTopN()
    assert len(tpl.sample_queries) >= 10
    assert any("不良率" in q for q in tpl.sample_queries)
    assert any("工序" in q for q in tpl.sample_queries)
