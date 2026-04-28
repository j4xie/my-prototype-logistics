"""Tests for outlier_stats — shared IQR/zscore algorithm utils (Phase B-1)."""
from __future__ import annotations
import pytest

from smartbi.utils.outlier_stats import (
    iqr_fence, find_outliers_iqr, zscore_outliers,
    OutlierAlgorithm, IQRFence, Outlier,
)


class TestIQRFence:
    def test_normal_distribution(self):
        # 50 samples roughly N(100, 10)
        values = [80, 85, 90, 92, 95, 95, 98, 100, 100, 100,
                  100, 100, 100, 102, 105, 105, 108, 110, 115, 120,
                  82, 87, 91, 93, 96, 96, 99, 100, 101, 101,
                  101, 101, 101, 103, 106, 106, 109, 111, 116, 121,
                  84, 88, 92, 94, 97, 97, 100, 102, 105, 119]
        fence = iqr_fence(values, multiplier=1.5)
        assert fence is not None
        # Q1 ≈ 95, Q3 ≈ 106, IQR ≈ 11, lower ≈ 78, upper ≈ 123
        assert fence.lower == pytest.approx(78, rel=0.05)
        assert fence.upper == pytest.approx(123, rel=0.05)

    def test_right_skewed_restaurant_cost(self):
        # 模拟餐饮 wastage cost: 大部分 200-800, 5 个节假日 5000+
        # NOTE: 增加 normal 样本数到 ~30 让 outliers 真的占少数 (spec 原 13+5
        # 比例下 Q3 落在 outlier 区, 与"不被极值拉跑"的测试意图相反).
        values = [200, 220, 240, 260, 280, 300, 320, 340, 360, 380,
                  400, 420, 440, 460, 480, 500, 520, 540, 560, 580,
                  600, 620, 640, 660, 680, 700, 720, 740, 760, 800,
                  5000, 5500, 6000, 6500, 7000]
        fence = iqr_fence(values, multiplier=1.5)
        assert fence is not None
        # IQR fence 不被节假日单点拉跑 — Q3 应在合理范围 (~1000-2000), upper 不会 > 10000
        assert fence.upper < 10000, "IQR upper fence 被极值拉跑了"

    def test_returns_none_for_small_sample(self):
        assert iqr_fence([1.0, 2.0, 3.0]) is None  # N=3 < 4
        assert iqr_fence([]) is None
        assert iqr_fence([1.0]) is None


class TestFindOutliersIQR:
    def test_finds_outliers_above_and_below(self):
        # 30 个正常值 100-110 + 1 个高异常 + 1 个低异常
        values = list(range(100, 130)) + [200.0, 50.0]
        fence = iqr_fence(values, multiplier=1.5)
        outliers = find_outliers_iqr(values, fence)
        # 应该找到 200 (above) + 50 (below)
        outlier_values = {o.value for o in outliers}
        assert 200.0 in outlier_values
        assert 50.0 in outlier_values
        directions = {o.direction for o in outliers}
        assert 'above' in directions
        assert 'below' in directions

    def test_no_outliers_in_uniform_data(self):
        values = [100.0] * 30
        fence = iqr_fence(values, multiplier=1.5)
        # 全相同值, IQR=0, 任何值都不会越界 (== upper, 不 > upper)
        outliers = find_outliers_iqr(values, fence)
        assert len(outliers) == 0


class TestZscoreOutliers:
    def test_zscore_finds_extreme_value(self):
        # 30 个 N(100, 5) 样本 + 1 个 5σ 异常 = 125
        values = [100.0] * 30 + [125.0]
        outliers = zscore_outliers(values, sigma=2.0)
        assert any(o.value == 125.0 for o in outliers)

    def test_zscore_returns_empty_for_zero_std(self):
        values = [100.0] * 10
        outliers = zscore_outliers(values, sigma=2.0)
        assert outliers == []


class TestOutlierAlgorithm:
    def test_iqr_algorithm_dataclass(self):
        values = list(range(100, 130)) + [200.0]
        algo = OutlierAlgorithm(name='iqr', threshold=1.5)
        outliers = algo.detect(values)
        assert any(o.value == 200.0 for o in outliers)

    def test_zscore_algorithm_dataclass(self):
        values = [100.0] * 30 + [125.0]
        algo = OutlierAlgorithm(name='zscore', threshold=2.0)
        outliers = algo.detect(values)
        assert any(o.value == 125.0 for o in outliers)
