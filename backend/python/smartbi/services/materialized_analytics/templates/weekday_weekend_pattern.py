"""WeekdayWeekendPattern — 工作日 vs 周末差异分析.

Tags each row by weekday/weekend using the time_field, then compares
order count, revenue, and avg order value between the two groups.
Requires >= 14 rows to span a meaningful sample of both types.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

import polars as pl

from ..compute.base import ComputeBackend
from ..restaurant.action_rec_formatter import format_action_rec
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register


@register
class WeekdayWeekendPattern(AnalysisTemplate):

    sample_queries = [
        "周末工作日差异",
        "周一到周日营收",
        "平日周末对比",
        "周末销售情况",
        "工作日营业额",
        "周末周中对比",
        "周末周内哪天营业额最高",
        "周末生意好还是平日",
        "周末和平时差异",
        "礼拜几卖得最好",
    ]

    @property
    def code(self) -> str:
        return "weekday_weekend_pattern"

    @property
    def title(self) -> str:
        return "工作日/周末差异"

    def applies(self, schema: DataSchema) -> bool:
        return (
            schema.time_field is not None
            and schema.primary_measure is not None
            and schema.row_count >= 14
        )

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        time_field = schema.time_field
        measure = schema.primary_measure

        df: pl.DataFrame = backend._df  # type: ignore[attr-defined]

        # Detect customer count column if present
        customer_col: Optional[str] = None
        for candidate in ("客流量", "就餐人数", "用餐人数"):
            if candidate in df.columns:
                customer_col = candidate
                break

        # Parse datetime, derive weekday number (1=Mon … 7=Sun in Polars)
        dt_col = df.schema.get(time_field)
        if dt_col is not None and "str" in str(dt_col).lower():
            t_expr = pl.col(time_field).str.to_datetime(strict=False).alias("_dt")
        else:
            t_expr = pl.col(time_field).cast(pl.Datetime, strict=False).alias("_dt")

        tagged = (
            df
            .with_columns([t_expr])
            .filter(pl.col("_dt").is_not_null())
            .with_columns([
                pl.col("_dt").dt.weekday().alias("_wd"),  # 1=Mon … 7=Sun
            ])
            .with_columns([
                pl.when(pl.col("_wd") >= 6)
                .then(pl.lit("weekend"))
                .otherwise(pl.lit("weekday"))
                .alias("_type"),
            ])
        )

        if tagged.height == 0:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no valid datetime values in time_field",
            )

        # Aggregate by type
        agg_exprs = [
            pl.len().alias("orders"),
            pl.col(measure).cast(pl.Float64, strict=False).sum().alias("revenue"),
        ]
        if customer_col:
            agg_exprs.append(
                pl.col(customer_col).cast(pl.Float64, strict=False).sum().alias("customer_sum")
            )

        agg = tagged.group_by("_type").agg(agg_exprs)

        # Convert to dict keyed by type
        stats: Dict[str, Any] = {}
        for row in agg.to_dicts():
            t = row["_type"]
            orders = int(row["orders"])
            revenue = float(row["revenue"] or 0.0)
            avg_order = round(revenue / orders, 2) if orders > 0 else 0.0
            entry: Dict[str, Any] = {
                "orders": orders,
                "revenue": round(revenue, 2),
                "avg_order": avg_order,
            }
            if customer_col:
                csum = float(row.get("customer_sum") or 0.0)
                entry["avg_customer_count"] = round(csum / orders, 2) if orders > 0 else 0.0
            stats[t] = entry

        # Count distinct days per type for context
        day_counts = (
            tagged
            .with_columns(pl.col("_dt").dt.strftime("%Y-%m-%d").alias("_day"))
            .group_by("_type")
            .agg(pl.col("_day").n_unique().alias("days"))
            .to_dicts()
        )
        day_map: Dict[str, int] = {r["_type"]: int(r["days"]) for r in day_counts}

        weekday_data = stats.get("weekday", {"orders": 0, "revenue": 0.0, "avg_order": 0.0})
        weekend_data = stats.get("weekend", {"orders": 0, "revenue": 0.0, "avg_order": 0.0})

        total_revenue = weekday_data["revenue"] + weekend_data["revenue"]
        total_orders = weekday_data["orders"] + weekend_data["orders"]

        weekend_rev_share = (
            round(weekend_data["revenue"] / total_revenue * 100, 2)
            if total_revenue > 0 else 0.0
        )
        weekend_order_share = (
            round(weekend_data["orders"] / total_orders * 100, 2)
            if total_orders > 0 else 0.0
        )

        weekend_avg = weekend_data["avg_order"]
        weekday_avg = weekday_data["avg_order"]
        delta_pct = (
            round((weekend_avg - weekday_avg) / weekday_avg * 100, 2)
            if weekday_avg > 0 else 0.0
        )

        # ECharts grouped bar: weekday vs weekend on key metrics
        chart_config = {
            "type": "bar",
            "title": {"text": "工作日/周末差异对比", "left": "center"},
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
            "legend": {"top": 30},
            "grid": {"left": "3%", "right": "8%", "bottom": "10%", "containLabel": True},
            "xAxis": {
                "type": "category",
                "data": ["订单数", "营业额", "人均消费"],
            },
            "yAxis": {"type": "value"},
            "series": [
                {
                    "name": "工作日",
                    "type": "bar",
                    "data": [
                        weekday_data["orders"],
                        weekday_data["revenue"],
                        weekday_avg,
                    ],
                    "label": {"show": True, "position": "top"},
                },
                {
                    "name": "周末",
                    "type": "bar",
                    "data": [
                        weekend_data["orders"],
                        weekend_data["revenue"],
                        weekend_avg,
                    ],
                    "label": {"show": True, "position": "top"},
                },
            ],
        }

        # Spec §4.3: drive weekday lift opportunity OR weekend over-reliance
        if delta_pct >= 30:
            action_rec = format_action_rec(
                object_target=f"工作日客单 (低于周末 {delta_pct:.0f}%)",
                benefit_range="工作日午市套餐 + 商务套餐 + 会员唤回可拉高工作日客单 8-15%",
                prerequisite="工作日时段套餐组合测试 + 周边写字楼会员推广",
                timeline="本月内",
            )
        elif weekend_rev_share >= 60:
            action_rec = format_action_rec(
                object_target=f"周末过度集中 ({weekend_rev_share:.1f}% 营收)",
                benefit_range="工作日营销 + 排班再平衡可缓解周末压力,提升周中坪效 5-10%",
                prerequisite="工作日午餐 / 晚餐促销 + 排班优化 + 商家联盟会员引导",
                timeline="本月内",
            )
        else:
            action_rec = format_action_rec(
                object_target=f"周末-工作日均衡发展 (差 {delta_pct:+.1f}%)",
                benefit_range="保持当前节奏,持续监控周末 / 工作日波动",
                prerequisite="周报对比 + 节假日特别活动测算",
                timeline="本月内",
            )
        insight_text = (
            f"周末占 {weekend_rev_share:.1f}% 营收，"
            f"人均 {weekend_avg:.0f} vs 工作日 {weekday_avg:.0f} (差 {delta_pct:+.1f}%)。 {action_rec}"
        )

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "weekday": weekday_data,
                "weekend": weekend_data,
                "weekday_days": day_map.get("weekday", 0),
                "weekend_days": day_map.get("weekend", 0),
            },
            chart_config=chart_config,
            kpis={
                "weekend_order_share": weekend_order_share,
                "weekend_revenue_share": weekend_rev_share,
                "weekend_avg_order": weekend_avg,
                "weekday_avg_order": weekday_avg,
                "delta_pct": delta_pct,
            },
            insight_text=insight_text,
        )
