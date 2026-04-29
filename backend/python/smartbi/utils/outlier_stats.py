"""共享 outlier 检测算法库 (Phase B-1).

Reviewer R3: 第一版同时 export iqr() + zscore() + OutlierAlgorithm dataclass,
让 chat AnomalyDetection (Phase B-N backlog item) 切迁源头消除数字打架问题.

Note: Python statistics.quantiles(method='exclusive') 跟 PG PERCENTILE_CONT
都是 continuous percentile, 数值差异 < 1%. 单测用 pytest.approx(rel=0.05)
容差对比 (interpolation 算法略不同). 对单一 outlier, 本地 N>=10 路径 100% Python,
fallback 路径 100% PG, 不会跨算法混用.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Literal, List, Optional
import statistics


@dataclass(frozen=True)
class IQRFence:
    q1: float
    q3: float
    iqr: float
    lower: float       # q1 - multiplier*iqr
    upper: float       # q3 + multiplier*iqr
    multiplier: float


@dataclass(frozen=True)
class Outlier:
    index: int
    value: float
    deviation_x: float       # 偏离倍数 (>= 1.0 表示越界 1×fence)
    direction: Literal['above', 'below']


def iqr_fence(values: List[float], multiplier: float = 1.5) -> Optional[IQRFence]:
    """计算 IQR fence. 返回 None if N < 4 (无法算 Q1/Q3)."""
    n = len(values)
    if n < 4:
        return None
    sorted_vals = sorted(values)
    q1, _, q3 = statistics.quantiles(sorted_vals, n=4, method='exclusive')
    iqr = q3 - q1
    return IQRFence(
        q1=q1, q3=q3, iqr=iqr,
        lower=q1 - multiplier * iqr,
        upper=q3 + multiplier * iqr,
        multiplier=multiplier,
    )


def find_outliers_iqr(values: List[float], fence: IQRFence) -> List[Outlier]:
    """返回所有越界的 outlier."""
    outliers: List[Outlier] = []
    for i, v in enumerate(values):
        if v > fence.upper:
            dev = (v - fence.upper) / fence.iqr if fence.iqr > 0 else 0
            outliers.append(Outlier(i, v, deviation_x=dev, direction='above'))
        elif v < fence.lower:
            dev = (fence.lower - v) / fence.iqr if fence.iqr > 0 else 0
            outliers.append(Outlier(i, v, deviation_x=dev, direction='below'))
    return outliers


def zscore_outliers(values: List[float], sigma: float = 2.0) -> List[Outlier]:
    """Z-score outlier 检测. 第一版未被 OutlierService 调用,
    留给 AnomalyDetection 后续切迁."""
    n = len(values)
    if n < 2:
        return []
    mean = statistics.mean(values)
    std = statistics.stdev(values)
    if std == 0:
        return []
    outliers: List[Outlier] = []
    for i, v in enumerate(values):
        z = (v - mean) / std
        if abs(z) >= sigma:
            outliers.append(Outlier(
                i, v, deviation_x=abs(z),
                direction='above' if z > 0 else 'below',
            ))
    return outliers


@dataclass
class OutlierAlgorithm:
    """统一接口让 OutlierService / AnomalyDetection 共用算法."""
    name: Literal['iqr', 'zscore']
    threshold: float    # IQR multiplier or sigma

    def detect(self, values: List[float]) -> List[Outlier]:
        if self.name == 'iqr':
            fence = iqr_fence(values, multiplier=self.threshold)
            if fence is None:
                return []
            return find_outliers_iqr(values, fence)
        else:  # zscore
            return zscore_outliers(values, sigma=self.threshold)
