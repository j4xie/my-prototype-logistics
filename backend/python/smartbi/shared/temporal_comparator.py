"""同期对比自动降级器

数据可用性自适应 (per Week 2 report 建议 4):
  - ≥13 月 → 同期对比 YoY (year-over-year)
  - 6-12 月 → 季度环比 QoQ (quarter-over-quarter)
  - 3-5 月 → 月度环比 MoM (month-over-month)
  - <3 月 → 友好提示 + 单期统计

餐饮: 同店对比 (group by store_id)
工厂: 同班次对比 (group by shift_code) — Phase 2

使用示例:
    >>> from shared.temporal_comparator import TemporalComparator
    >>> comp = TemporalComparator(group_col="门店名称")
    >>> result = comp.compare(df, date_col="营业日期", metric_cols=["营业额", "客流量"])
    >>> print(result.mode)  # yoy / qoq / mom / insufficient
    >>> for d in result.deltas:
    ...     print(d["groupName"], d["metric"], d["deltaPct"])
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Optional

logger = logging.getLogger(__name__)


# ── Type definitions ────────────────────────────────────────

ComparisonMode = Literal["yoy", "qoq", "mom", "insufficient"]


@dataclass
class TemporalDelta:
    """单个 (group, metric) 的对比 delta"""
    group_name: str
    metric: str
    current_value: float
    compare_value: float
    delta_abs: float                     # current - compare
    delta_pct: float                     # (current - compare) / compare
    trend: Literal["up", "down", "flat"] # 方向

    def to_dict(self) -> dict:
        return {
            "groupName": self.group_name,
            "metric": self.metric,
            "currentValue": round(self.current_value, 2),
            "compareValue": round(self.compare_value, 2),
            "deltaAbs": round(self.delta_abs, 2),
            "deltaPct": round(self.delta_pct, 4),
            "trend": self.trend,
        }


@dataclass
class TemporalComparison:
    """同期对比完整结果"""
    mode: ComparisonMode
    months_available: int
    current_period: str                  # 当期标签 (例 "2026-02" / "2026-Q1")
    compare_period: str                  # 对比期标签 (例 "2025-02" / "2025-Q1")
    deltas: list[TemporalDelta]
    message_zh: str                      # 给客户的友好说明
    insufficient_reason: Optional[str] = None
    group_count: int = 0                 # 对比的 group 数

    def to_dict(self) -> dict:
        return {
            "mode": self.mode,
            "monthsAvailable": self.months_available,
            "currentPeriod": self.current_period,
            "comparePeriod": self.compare_period,
            "deltas": [d.to_dict() for d in self.deltas],
            "messageZh": self.message_zh,
            "insufficientReason": self.insufficient_reason,
            "groupCount": self.group_count,
        }


# ── Main comparator ────────────────────────────────────────


class TemporalComparator:
    """同期对比器 — 自动降级数据可用性不足时的模式"""

    def __init__(self, group_col: str = "store_name"):
        """
        Args:
            group_col: 分组列 (餐饮通常是 '门店名称', 工厂是 '班次')
        """
        self.group_col = group_col

    # ── Public API ──────────────────────────────────────

    def compare(
        self,
        df,
        date_col: str,
        metric_cols: list[str],
    ) -> TemporalComparison:
        """主对比入口 — 自动选择模式

        Args:
            df: pandas DataFrame
            date_col: 日期列名 (必须)
            metric_cols: 要对比的数值列 (至少 1 个)

        Returns:
            TemporalComparison 结构
        """
        import pandas as pd

        if df is None or len(df) == 0:
            return self._insufficient("DataFrame 为空")

        if date_col not in df.columns:
            return self._insufficient(f"缺少日期列 {date_col!r}")

        if self.group_col not in df.columns:
            return self._insufficient(f"缺少分组列 {self.group_col!r}")

        # 1. 解析日期
        df = df.copy()
        df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
        df = df[df[date_col].notna()]
        if len(df) == 0:
            return self._insufficient(f"{date_col} 列全部无法解析为日期")

        # 2. 只保留 metric 列 numeric
        for m in metric_cols:
            if m not in df.columns:
                return self._insufficient(f"缺少指标列 {m!r}")
            df[m] = pd.to_numeric(df[m], errors="coerce").fillna(0)

        # 3. 算 months_available
        df["_year_month"] = df[date_col].dt.to_period("M")
        months_available = df["_year_month"].nunique()

        # 4. 自动选模式
        if months_available >= 13:
            return self._compare_yoy(df, date_col, metric_cols, months_available)
        elif months_available >= 6:
            return self._compare_qoq(df, date_col, metric_cols, months_available)
        elif months_available >= 3:
            return self._compare_mom(df, date_col, metric_cols, months_available)
        else:
            return self._insufficient(
                f"仅 {months_available} 个月数据, 需至少 3 个月才能对比趋势. "
                f"建议上传更多历史数据."
            )

    # ── 模式 1: YoY 同比 (≥13 月数据) ──────────────────

    def _compare_yoy(
        self, df, date_col: str, metric_cols: list[str], months_available: int,
    ) -> TemporalComparison:
        """同期对比: 当前月 vs 去年同月"""
        import pandas as pd

        max_month = df["_year_month"].max()
        prev_year_month = max_month - 12

        current_df = df[df["_year_month"] == max_month]
        compare_df = df[df["_year_month"] == prev_year_month]

        if len(compare_df) == 0:
            # 去年同月无数据, 降级 QoQ
            logger.info("YoY fallback: 去年同月无数据, 降级到 QoQ")
            return self._compare_qoq(df, date_col, metric_cols, months_available)

        deltas = self._compute_group_deltas(
            current_df, compare_df, metric_cols, self.group_col
        )
        group_count = len(set(d.group_name for d in deltas))

        current_period_str = str(max_month)
        compare_period_str = str(prev_year_month)

        message = (
            f"同店同比分析 ({current_period_str} vs {compare_period_str}): "
            f"共 {group_count} 家门店, {months_available} 个月历史数据."
        )

        return TemporalComparison(
            mode="yoy",
            months_available=months_available,
            current_period=current_period_str,
            compare_period=compare_period_str,
            deltas=deltas,
            message_zh=message,
            group_count=group_count,
        )

    # ── 模式 2: QoQ 季度环比 (6-12 月) ──────────────────

    def _compare_qoq(
        self, df, date_col: str, metric_cols: list[str], months_available: int,
    ) -> TemporalComparison:
        """季度环比: 当前季度 vs 上季度"""
        import pandas as pd

        df = df.copy()
        df["_quarter"] = df[date_col].dt.to_period("Q")

        quarters_available = df["_quarter"].nunique()
        if quarters_available < 2:
            # 没有前一个季度, 降级 MoM
            logger.info("QoQ fallback: 季度不足 2, 降级到 MoM")
            return self._compare_mom(df, date_col, metric_cols, months_available)

        sorted_quarters = sorted(df["_quarter"].unique())
        current_q = sorted_quarters[-1]
        prev_q = sorted_quarters[-2]

        current_df = df[df["_quarter"] == current_q]
        compare_df = df[df["_quarter"] == prev_q]

        deltas = self._compute_group_deltas(
            current_df, compare_df, metric_cols, self.group_col
        )
        group_count = len(set(d.group_name for d in deltas))

        message = (
            f"季度环比分析 ({current_q} vs {prev_q}): "
            f"共 {group_count} 家门店, {months_available} 个月数据. "
            f"历史数据不足 13 个月, 暂用 QoQ 替代 YoY."
        )

        return TemporalComparison(
            mode="qoq",
            months_available=months_available,
            current_period=str(current_q),
            compare_period=str(prev_q),
            deltas=deltas,
            message_zh=message,
            group_count=group_count,
        )

    # ── 模式 3: MoM 月度环比 (3-5 月) ──────────────────

    def _compare_mom(
        self, df, date_col: str, metric_cols: list[str], months_available: int,
    ) -> TemporalComparison:
        """月度环比: 当前月 vs 上个月"""
        import pandas as pd

        sorted_months = sorted(df["_year_month"].unique())
        if len(sorted_months) < 2:
            return self._insufficient(
                f"只有 1 个月数据, 无法计算环比"
            )

        current_month = sorted_months[-1]
        prev_month = sorted_months[-2]

        current_df = df[df["_year_month"] == current_month]
        compare_df = df[df["_year_month"] == prev_month]

        deltas = self._compute_group_deltas(
            current_df, compare_df, metric_cols, self.group_col
        )
        group_count = len(set(d.group_name for d in deltas))

        message = (
            f"月度环比分析 ({current_month} vs {prev_month}): "
            f"共 {group_count} 家门店, {months_available} 个月数据. "
            f"历史数据不足 6 个月, 暂用 MoM 替代更长期对比. "
            f"建议上传至少 13 个月数据获得 YoY 同比分析."
        )

        return TemporalComparison(
            mode="mom",
            months_available=months_available,
            current_period=str(current_month),
            compare_period=str(prev_month),
            deltas=deltas,
            message_zh=message,
            group_count=group_count,
        )

    # ── 辅助: 算 (group × metric) 的 delta ─────────────

    @staticmethod
    def _compute_group_deltas(
        current_df, compare_df, metric_cols: list[str], group_col: str,
    ) -> list[TemporalDelta]:
        """按 group 聚合 current + compare, 生成 delta 列表"""
        deltas: list[TemporalDelta] = []

        # 聚合
        current_agg = current_df.groupby(group_col)[metric_cols].sum()
        compare_agg = compare_df.groupby(group_col)[metric_cols].sum()

        all_groups = set(current_agg.index) | set(compare_agg.index)
        for group in sorted(all_groups):
            for metric in metric_cols:
                current_val = (
                    float(current_agg.loc[group, metric]) if group in current_agg.index else 0.0
                )
                compare_val = (
                    float(compare_agg.loc[group, metric]) if group in compare_agg.index else 0.0
                )

                delta_abs = current_val - compare_val
                if compare_val != 0:
                    delta_pct = delta_abs / compare_val
                else:
                    delta_pct = 0.0 if current_val == 0 else 1.0  # 从 0 到正数 = 100%

                if abs(delta_pct) < 0.01:
                    trend = "flat"
                elif delta_pct > 0:
                    trend = "up"
                else:
                    trend = "down"

                deltas.append(
                    TemporalDelta(
                        group_name=str(group),
                        metric=metric,
                        current_value=current_val,
                        compare_value=compare_val,
                        delta_abs=delta_abs,
                        delta_pct=delta_pct,
                        trend=trend,
                    )
                )

        return deltas

    # ── 辅助: 数据不足返回 ──────────────────────────────

    @staticmethod
    def _insufficient(reason: str) -> TemporalComparison:
        return TemporalComparison(
            mode="insufficient",
            months_available=0,
            current_period="",
            compare_period="",
            deltas=[],
            message_zh=f"数据不足无法对比: {reason}",
            insufficient_reason=reason,
            group_count=0,
        )
