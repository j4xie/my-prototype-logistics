"""营业时段热力图 — Week 4.2

设计依据 (来自 Researcher C "漏项 #2"):
  - 邓总会直接问"我该几点开门、几点关、中午是不是亏的?"
  - 客单分布 (改进 5) 不能替代时段分布, 两个维度正交
  - 需要 7 天 × 24 小时 或 7 天 × 餐段 (早/午/晚/夜) 的热力图

输入: POS DataFrame 含订单时间列 + 营收列
输出: 热力图数据 + 高峰/低峰识别 + 建议

使用示例:
    >>> heatmap = DiningPeriodHeatmap()
    >>> result = heatmap.build(
    ...     df=pos_df,
    ...     datetime_col='开单时间',
    ...     revenue_col='实收额',
    ... )
    >>> print(result.peak_hours)  # [{day: 'Fri', hour: 19, revenue: 12340}, ...]
    >>> print(result.off_peak_suggestion)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ── Result types ────────────────────────────────────────────


@dataclass
class HeatmapCell:
    """热力图单元格 (day_of_week × hour)"""
    day_of_week: int                     # 0=周一 ~ 6=周日
    day_label: str                       # "周一" ~ "周日"
    hour: int                            # 0-23
    revenue: float
    order_count: int
    avg_ticket: float                    # 平均客单

    def to_dict(self) -> dict:
        return {
            "dayOfWeek": self.day_of_week,
            "dayLabel": self.day_label,
            "hour": self.hour,
            "revenue": round(self.revenue, 2),
            "orderCount": self.order_count,
            "avgTicket": round(self.avg_ticket, 2),
        }


@dataclass
class MealPeriodStats:
    """餐段统计: 早/午/晚/夜"""
    period: str                          # '早餐' / '午餐' / '晚餐' / '夜宵' / '下午茶'
    hour_range: tuple[int, int]          # (start, end) exclusive
    revenue: float
    order_count: int
    revenue_pct: float                   # 占日营收比例
    avg_ticket: float

    def to_dict(self) -> dict:
        return {
            "period": self.period,
            "hourRange": list(self.hour_range),
            "revenue": round(self.revenue, 2),
            "orderCount": self.order_count,
            "revenuePct": round(self.revenue_pct, 4),
            "avgTicket": round(self.avg_ticket, 2),
        }


@dataclass
class PeakPeriod:
    """识别出的高峰时段 (top N)"""
    day_label: str
    hour: int
    revenue: float
    order_count: int
    emoji: str                           # 🔥 高峰 / 💤 低峰

    def to_dict(self) -> dict:
        return {
            "dayLabel": self.day_label,
            "hour": self.hour,
            "revenue": round(self.revenue, 2),
            "orderCount": self.order_count,
            "emoji": self.emoji,
        }


@dataclass
class DiningHeatmapReport:
    """热力图完整报告"""
    cells: list[HeatmapCell]             # 7*24 cells (有数据的才返回)
    meal_periods: list[MealPeriodStats]  # 4-5 个餐段
    top_peak_hours: list[PeakPeriod]     # TOP 5 高峰
    bottom_off_peak_hours: list[PeakPeriod]  # BOTTOM 5 低谷 (仍有订单的)

    total_revenue: float
    total_orders: int
    avg_hourly_revenue: float
    peak_off_peak_ratio: float           # 高峰 / 低峰 营收比

    insights: list[str]                  # 给客户看的洞察
    recommendations: list[str]

    def to_dict(self) -> dict:
        return {
            "cells": [c.to_dict() for c in self.cells],
            "mealPeriods": [m.to_dict() for m in self.meal_periods],
            "topPeakHours": [p.to_dict() for p in self.top_peak_hours],
            "bottomOffPeakHours": [p.to_dict() for p in self.bottom_off_peak_hours],
            "totalRevenue": round(self.total_revenue, 2),
            "totalOrders": self.total_orders,
            "avgHourlyRevenue": round(self.avg_hourly_revenue, 2),
            "peakOffPeakRatio": round(self.peak_off_peak_ratio, 2),
            "insights": self.insights,
            "recommendations": self.recommendations,
        }


# ── Main builder ────────────────────────────────────────────


class DiningPeriodHeatmap:
    """营业时段热力图构建器"""

    _DAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]

    _MEAL_PERIODS = [
        ("早餐", (6, 10)),
        ("午餐", (10, 14)),
        ("下午茶", (14, 17)),
        ("晚餐", (17, 21)),
        ("夜宵", (21, 26)),  # 21-02 AM (用 26 表示次日 2 点)
    ]

    def build(
        self,
        df,
        datetime_col: str,
        revenue_col: str,
    ) -> DiningHeatmapReport:
        """构建热力图

        Args:
            df: pandas DataFrame
            datetime_col: 日期时间列 (必须)
            revenue_col: 营收列

        Returns:
            DiningHeatmapReport
        """
        import pandas as pd

        if datetime_col not in df.columns or revenue_col not in df.columns:
            return self._empty_report(f"缺少列 {datetime_col!r} 或 {revenue_col!r}")

        # 解析时间
        df = df.copy()
        df["_dt"] = pd.to_datetime(df[datetime_col], errors="coerce")
        df = df[df["_dt"].notna()]
        if len(df) == 0:
            return self._empty_report(f"{datetime_col} 全部无法解析为日期时间")

        df[revenue_col] = pd.to_numeric(df[revenue_col], errors="coerce").fillna(0)
        df = df[df[revenue_col] > 0]
        if len(df) == 0:
            return self._empty_report(f"{revenue_col} 全部为 0 或空")

        # 提取 day_of_week (0=周一) 和 hour
        df["_dow"] = df["_dt"].dt.dayofweek
        df["_hour"] = df["_dt"].dt.hour

        # ─── 1. 7×24 热力图 cells ───
        cells: list[HeatmapCell] = []
        grouped = df.groupby(["_dow", "_hour"]).agg(
            revenue=(revenue_col, "sum"),
            order_count=(revenue_col, "count"),
        ).reset_index()

        for _, row in grouped.iterrows():
            dow = int(row["_dow"])
            hour = int(row["_hour"])
            revenue = float(row["revenue"])
            order_count = int(row["order_count"])
            cells.append(
                HeatmapCell(
                    day_of_week=dow,
                    day_label=self._DAY_LABELS[dow],
                    hour=hour,
                    revenue=revenue,
                    order_count=order_count,
                    avg_ticket=revenue / order_count if order_count > 0 else 0,
                )
            )

        # ─── 2. 餐段统计 ───
        meal_periods = self._compute_meal_periods(df, revenue_col)

        # ─── 3. 高峰 / 低峰 ───
        sorted_cells = sorted(cells, key=lambda c: -c.revenue)
        top_peaks = [
            PeakPeriod(
                day_label=c.day_label,
                hour=c.hour,
                revenue=c.revenue,
                order_count=c.order_count,
                emoji="🔥",
            )
            for c in sorted_cells[:5]
        ]

        # 低峰: 有订单但最少的 5 个
        bottom_cells = [c for c in sorted_cells if c.order_count > 0][-5:]
        bottom_off_peaks = [
            PeakPeriod(
                day_label=c.day_label,
                hour=c.hour,
                revenue=c.revenue,
                order_count=c.order_count,
                emoji="💤",
            )
            for c in reversed(bottom_cells)
        ]

        # ─── 4. 统计指标 ───
        total_revenue = sum(c.revenue for c in cells)
        total_orders = sum(c.order_count for c in cells)
        avg_hourly_revenue = total_revenue / len(cells) if cells else 0

        peak_revenue = sum(c.revenue for c in sorted_cells[:5]) / 5 if len(sorted_cells) >= 5 else 0
        off_peak_revenue = sum(c.revenue for c in bottom_cells) / len(bottom_cells) if bottom_cells else 1
        peak_off_peak_ratio = peak_revenue / off_peak_revenue if off_peak_revenue > 0 else 0

        # ─── 5. 洞察 + 建议 ───
        insights = self._build_insights(
            cells, meal_periods, peak_off_peak_ratio, total_revenue
        )
        recommendations = self._build_recommendations(
            meal_periods, top_peaks, bottom_off_peaks, peak_off_peak_ratio
        )

        return DiningHeatmapReport(
            cells=cells,
            meal_periods=meal_periods,
            top_peak_hours=top_peaks,
            bottom_off_peak_hours=bottom_off_peaks,
            total_revenue=total_revenue,
            total_orders=total_orders,
            avg_hourly_revenue=avg_hourly_revenue,
            peak_off_peak_ratio=peak_off_peak_ratio,
            insights=insights,
            recommendations=recommendations,
        )

    # ── 餐段统计 ────────────────────────────────────────

    def _compute_meal_periods(self, df, revenue_col: str) -> list[MealPeriodStats]:
        """按餐段 (早/午/晚/夜) 聚合"""
        total_revenue = float(df[revenue_col].sum())
        if total_revenue <= 0:
            return []

        stats: list[MealPeriodStats] = []
        for period_name, (start, end) in self._MEAL_PERIODS:
            # 处理跨日 (夜宵 21-26 → 21-23 + 0-2)
            if end <= 24:
                mask = (df["_hour"] >= start) & (df["_hour"] < end)
            else:
                end_wrap = end - 24
                mask = (df["_hour"] >= start) | (df["_hour"] < end_wrap)

            period_df = df[mask]
            if len(period_df) == 0:
                continue

            revenue = float(period_df[revenue_col].sum())
            order_count = int(len(period_df))
            stats.append(
                MealPeriodStats(
                    period=period_name,
                    hour_range=(start, end),
                    revenue=revenue,
                    order_count=order_count,
                    revenue_pct=revenue / total_revenue,
                    avg_ticket=revenue / order_count if order_count > 0 else 0,
                )
            )
        return stats

    # ── 洞察生成 ────────────────────────────────────────

    def _build_insights(
        self,
        cells: list[HeatmapCell],
        meal_periods: list[MealPeriodStats],
        peak_off_peak_ratio: float,
        total_revenue: float,
    ) -> list[str]:
        insights: list[str] = []

        # 1. 识别最强餐段
        if meal_periods:
            top_period = max(meal_periods, key=lambda m: m.revenue)
            insights.append(
                f"🔥 最强餐段: {top_period.period} "
                f"({top_period.hour_range[0]}:00-{top_period.hour_range[1] % 24}:00), "
                f"营收占比 {top_period.revenue_pct * 100:.1f}%, "
                f"客单 ¥{top_period.avg_ticket:.0f}"
            )

        # 2. 高峰/低峰差异
        if peak_off_peak_ratio > 5:
            insights.append(
                f"⚠️ 高峰低峰营收差异 {peak_off_peak_ratio:.1f}x, 运营压力集中, "
                f"低峰时段产能浪费严重"
            )
        elif peak_off_peak_ratio < 2:
            insights.append(
                f"✅ 营收分布较均匀 (高峰低峰 {peak_off_peak_ratio:.1f}x), 运营平稳"
            )

        # 3. 餐段空缺检测
        active_periods = {m.period for m in meal_periods}
        expected = {"早餐", "午餐", "晚餐"}
        missing = expected - active_periods
        if missing:
            insights.append(
                f"💡 {' / '.join(missing)} 时段几乎无订单, 可能未开业或业务机会"
            )

        # 4. 下午茶/夜宵机会
        afternoon = next((m for m in meal_periods if m.period == "下午茶"), None)
        if afternoon and afternoon.revenue_pct < 0.05:
            insights.append(
                f"💡 下午茶时段营收占比 {afternoon.revenue_pct * 100:.1f}%, "
                f"是低利用时段, 可考虑增加下午茶套餐"
            )

        return insights

    def _build_recommendations(
        self,
        meal_periods: list[MealPeriodStats],
        top_peaks: list[PeakPeriod],
        bottom_off_peaks: list[PeakPeriod],
        peak_off_peak_ratio: float,
    ) -> list[str]:
        recs: list[str] = []

        if peak_off_peak_ratio > 5:
            recs.append(
                f"📋 高峰时段 (如 {top_peaks[0].day_label} {top_peaks[0].hour}:00) 排班全职, "
                f"低峰时段用兼职 — 排班弹性化可降本 5-10%"
            )

        # 主餐段营收占比 > 70% → 推荐扩展非主餐段
        if meal_periods:
            sorted_periods = sorted(meal_periods, key=lambda m: -m.revenue_pct)
            top_pct = sorted_periods[0].revenue_pct
            if top_pct > 0.70:
                recs.append(
                    f"📋 营收 {top_pct * 100:.0f}% 集中在 {sorted_periods[0].period}, "
                    f"风险过大. 考虑增加其他餐段产品, 分散风险"
                )

        # 低峰时段建议
        if bottom_off_peaks:
            recs.append(
                f"📋 低峰时段 (如 {bottom_off_peaks[0].day_label} {bottom_off_peaks[0].hour}:00) "
                f"考虑: 限时折扣 / 外卖平台重点投放 / 暂停营业降本"
            )

        return recs

    # ── 空报告 ──────────────────────────────────────────

    @staticmethod
    def _empty_report(reason: str) -> DiningHeatmapReport:
        return DiningHeatmapReport(
            cells=[],
            meal_periods=[],
            top_peak_hours=[],
            bottom_off_peak_hours=[],
            total_revenue=0,
            total_orders=0,
            avg_hourly_revenue=0,
            peak_off_peak_ratio=0,
            insights=[f"数据不足: {reason}"],
            recommendations=[],
        )
