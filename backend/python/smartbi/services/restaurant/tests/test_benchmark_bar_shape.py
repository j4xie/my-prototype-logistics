"""Unit tests for BenchmarkAlert.barShape output (P3 Task 3.8)."""
import pytest


def test_bar_shape_basic_fields():
    """BenchmarkAlert.to_dict() must expose a barShape dict with scale + fill."""
    from smartbi.shared.benchmark_alert_engine import BenchmarkAlert

    # Real dataclass signature (verified):
    #   metric_key, metric_name_zh, store_name, actual_value, median,
    #   range_low, range_high, delta_pp_from_median, delta_pp_from_high,
    #   severity, higher_is_worse, estimated_yearly_impact=None,
    #   message_zh="", action_hint="", source=""
    alert = BenchmarkAlert(
        metric_key="labor_cost_ratio",
        metric_name_zh="人工成本率",
        store_name=None,
        actual_value=0.38,
        median=0.22,
        range_low=0.15,
        range_high=0.30,
        delta_pp_from_median=16.0,
        delta_pp_from_high=8.0,
        severity="red",
        higher_is_worse=True,
        estimated_yearly_impact=0,
        message_zh="人工成本率 38% 远超火锅行业 22% 中位数",
        action_hint="",
    )
    out = alert.to_dict()
    assert "barShape" in out
    bar = out["barShape"]
    assert bar["actual"] == pytest.approx(0.38, abs=1e-6)
    assert bar["median"] == pytest.approx(0.22, abs=1e-6)
    assert bar["rangeLow"] == pytest.approx(0.15, abs=1e-6)
    assert bar["rangeHigh"] == pytest.approx(0.30, abs=1e-6)
    # Scale must extend beyond actual so bar has headroom
    assert bar["scaleMin"] == 0
    assert bar["scaleMax"] > bar["actual"]
    # Scale max = max(actual=0.38, range_high=0.30) * 1.1 = 0.38 * 1.1 = 0.418
    expected_scale_max = max(0.38, 0.30) * 1.1
    assert bar["scaleMax"] == pytest.approx(expected_scale_max, abs=0.001)
    # Fill ratio = actual / scale_max (since scale_min=0)
    expected_fill = 0.38 / expected_scale_max
    assert bar["fillRatio"] == pytest.approx(expected_fill, abs=0.01)
    # Marker position for median
    expected_marker = 0.22 / expected_scale_max
    assert bar["markerPosition"] == pytest.approx(expected_marker, abs=0.01)


def test_bar_shape_handles_none_median():
    """When median is None, markerPosition must be None (not crash)."""
    from smartbi.shared.benchmark_alert_engine import BenchmarkAlert

    alert = BenchmarkAlert(
        metric_key="test_metric",
        metric_name_zh="测试指标",
        store_name=None,
        actual_value=100,
        median=None,
        range_low=None,
        range_high=None,
        delta_pp_from_median=0,
        delta_pp_from_high=0,
        severity="green",
        higher_is_worse=False,
        estimated_yearly_impact=0,
        message_zh="",
        action_hint="",
    )
    out = alert.to_dict()
    assert "barShape" in out
    bar = out["barShape"]
    assert bar["median"] is None
    assert bar["markerPosition"] is None
    # scale_max = actual * 1.1 = 110.0
    assert bar["fillRatio"] == pytest.approx(1.0 / 1.1, abs=0.01)
