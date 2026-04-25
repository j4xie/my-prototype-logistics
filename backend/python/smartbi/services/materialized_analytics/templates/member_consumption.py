"""MemberConsumption — 会员卡消费频次 + 金额分析.

会员卡 is a MEASURE column (payment amount per order). When 会员卡 > 0, the
order used member-card payment. There is no member-ID column, so this template
answers aggregate payment-level questions, not per-person RFM.

Computed metrics:
  - member_orders   : count of orders where 会员卡 > 0
  - member_revenue  : sum of primary_measure (营业额) for those orders
  - total_orders    : total row count
  - total_revenue   : sum of primary_measure across all orders
  - avg_member_spend: member_revenue / member_orders
  - member_share_pct: member_revenue / total_revenue × 100

Optional time series (month) when schema.time_field is present.
"""
from __future__ import annotations

from typing import Any, ClassVar, Dict, List, Optional

import polars as pl

from smartbi.capability.contract import RequiresSpec

from ..compute.base import ComputeBackend
from ..restaurant.action_rec_formatter import format_action_rec
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register


@register
class MemberConsumption(AnalysisTemplate):

    sample_queries = [
        "会员消费分析",
        "会员卡使用情况",
        "会员订单统计",
        "会员频次",
        "会员复购",
    ]

    requires: ClassVar[RequiresSpec | None] = RequiresSpec(
        all=["customer_count"],
        any=["net_amount", "gross_amount"],
        description="人均消费分析 (会员卡列由 applies() 运行时检测)",
    )

    @property
    def code(self) -> str:
        return "member_consumption"

    @property
    def title(self) -> str:
        return "会员卡消费分析"

    _MEMBER_COL_CANDIDATES = ("会员卡", "会员卡支付", "会员卡消费", "会员卡金额")

    def _find_member_col(self, cols) -> Optional[str]:
        col_set = set(cols)
        for c in self._MEMBER_COL_CANDIDATES:
            if c in col_set:
                return c
        return None

    def applies(self, schema: DataSchema) -> bool:
        field_names = {f.name for f in schema.fields}
        return self._find_member_col(field_names) is not None

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        df = backend._df

        member_col = self._find_member_col(df.columns)
        if member_col is None:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no member-card column",
            )

        # Determine primary revenue column (default "营业额" if not set)
        revenue_col = schema.primary_measure or "营业额"

        # Cast member-card and revenue columns to float for safety
        df_work = df.with_columns([
            pl.col(member_col).cast(pl.Float64, strict=False).alias("_member_pay"),
            pl.col(revenue_col).cast(pl.Float64, strict=False).alias("_revenue"),
        ]).filter(pl.col("_revenue").is_not_null())

        total_orders = df_work.height
        total_revenue = float(df_work["_revenue"].sum() or 0.0)

        # Filter to member-card orders
        member_df = df_work.filter(
            pl.col("_member_pay").is_not_null() & (pl.col("_member_pay") > 0)
        )
        member_count = member_df.height
        member_revenue = float(member_df["_revenue"].sum() or 0.0)

        avg_member_spend = (member_revenue / member_count) if member_count > 0 else 0.0
        member_share_pct = round((member_revenue / total_revenue * 100), 2) if total_revenue > 0 else 0.0

        # Optional monthly time series
        monthly: List[Dict[str, Any]] = []
        chart_config: Optional[Dict[str, Any]] = None

        if schema.time_field and schema.time_field in df.columns:
            time_col = schema.time_field
            dt_dtype = df.schema.get(time_col)
            if dt_dtype is not None and "str" in str(dt_dtype).lower():
                t_expr = pl.col(time_col).str.to_datetime(strict=False).alias("_t")
            else:
                t_expr = pl.col(time_col).cast(pl.Datetime, strict=False).alias("_t")

            member_ts = (
                member_df
                .with_columns(t_expr)
                .filter(pl.col("_t").is_not_null())
                .sort("_t")
                .group_by_dynamic("_t", every="1mo")
                .agg([
                    pl.len().alias("count"),
                    pl.col("_revenue").sum().alias("revenue"),
                ])
                .with_columns(pl.col("_t").dt.strftime("%Y-%m").alias("month"))
                .select(["month", "count", "revenue"])
                .to_dicts()
            )
            monthly = [
                {"month": r["month"], "count": int(r["count"]), "revenue": round(float(r["revenue"]), 2)}
                for r in member_ts
            ]

            if monthly:
                chart_config = {
                    "type": "bar",
                    "title": {"text": "每月会员卡营收", "left": "center"},
                    "xAxis": {
                        "type": "category",
                        "data": [r["month"] for r in monthly],
                        "axisLabel": {"rotate": 45, "interval": 0},
                    },
                    "yAxis": [
                        {"type": "value", "name": "营收 (元)", "position": "left"},
                        {"type": "value", "name": "订单数", "position": "right"},
                    ],
                    "series": [
                        {
                            "name": "会员卡营收",
                            "type": "bar",
                            "yAxisIndex": 0,
                            "data": [r["revenue"] for r in monthly],
                        },
                        {
                            "name": "订单数",
                            "type": "line",
                            "yAxisIndex": 1,
                            "data": [r["count"] for r in monthly],
                        },
                    ],
                    "legend": {"top": 30},
                    "tooltip": {"trigger": "axis"},
                    "grid": {"left": "3%", "right": "8%", "bottom": "20%", "containLabel": True},
                }

        # K2 / C-rec 8: append spec §4.3 action rec (a对象 b收益区间 c前置 d时间窗)
        # Member share <10% = 渗透率不足 (推会员); 10-30% = 中等 (拉提客单价);
        # >30% = 高粘性 (维系 + LTV)
        if member_share_pct < 10.0:
            action_rec = format_action_rec(
                object_target=f"会员渗透率 ({member_share_pct:.1f}%)",
                benefit_range="提升至 20% 可拉高复购 8-15% / 月营收增 3-6%",
                prerequisite="入会权益重新设计 + 收银/服务员推会员 SOP",
                timeline="本季度内",
            )
        elif member_share_pct < 30.0:
            action_rec = format_action_rec(
                object_target=f"会员客单价 (¥{avg_member_spend:.0f}/单)",
                benefit_range="差异化套餐 + 储值卡返充可拉高会员客单价 5-10%",
                prerequisite="会员消费分层 + 高消费档位活动设计",
                timeline="本月内",
            )
        else:
            action_rec = format_action_rec(
                object_target=f"高粘性会员 ({member_count} 单)",
                benefit_range="LTV 维系 + 流失预警可保住 90% 高消费会员, 减少损失 5-10%",
                prerequisite="近 90 天未消费会员名单 + 召回活动 (如生日券)",
                timeline="近 30 天",
            )
        insight_text = (
            f"{member_share_pct:.1f}% 营收来自会员卡支付"
            f"({member_count} 单,人均 {avg_member_spend:.0f} 元)。 "
            f"{action_rec}"
        )

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "member_orders": member_count,
                "member_revenue": round(member_revenue, 2),
                "avg_member_spend": round(avg_member_spend, 2),
                "member_share_pct": member_share_pct,
                "total_orders": total_orders,
                "total_revenue": round(total_revenue, 2),
                **({"monthly": monthly} if monthly else {}),
            },
            chart_config=chart_config,
            kpis={
                "member_orders": member_count,
                "member_revenue": round(member_revenue, 2),
                "member_share_pct": member_share_pct,
                "avg_spend": round(avg_member_spend, 2),
            },
            insight_text=insight_text,
        )
