"""PromotionImpact — 代金券优惠 / 折扣率分析.

Uses two complementary signals:
  - 代金券优惠  (coupon discount amount): aggregate coupon usage metrics
  - 折扣率       (discount rate %):        quintile distribution of discount depth

Key insight: rather than iterating 100+ voucher-specific columns, this template
treats 代金券优惠 as the aggregate coupon signal and 折扣率 for distribution.
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
class PromotionImpact(AnalysisTemplate):

    sample_queries = [
        "代金券使用分析",
        "优惠券效果",
        "折扣占比",
        "促销影响",
        "营销活动复盘",
    ]

    # 代金券优惠 → discount_amount canonical (在 ALIAS_TO_ATTR).
    # 折扣率 无 canonical 等价,作为可选辅助路径,不进 requires.
    requires: ClassVar[RequiresSpec | None] = RequiresSpec(
        any=["discount_amount"],
        description="优惠券效果分析 (折扣率列若存在则增强分析)",
    )

    @property
    def code(self) -> str:
        return "promotion_impact"

    @property
    def title(self) -> str:
        return "优惠券 & 折扣分析"

    def applies(self, schema: DataSchema) -> bool:
        field_names = {f.name for f in schema.fields}
        return "代金券优惠" in field_names or "折扣率" in field_names

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        df = backend._df
        field_names = set(df.columns)

        has_coupon = "代金券优惠" in field_names
        has_discount_rate = "折扣率" in field_names
        has_revenue = "营业额" in field_names
        has_actual = "实收" in field_names

        # ── Coupon metrics ────────────────────────────────────────────────────
        coupon_order_count: int = 0
        total_coupon_amount: float = 0.0
        coupon_share_pct: float = 0.0
        avg_coupon_per_order: float = 0.0
        total_orders: int = df.height

        if has_coupon and total_orders > 0:
            df_work = df.with_columns(
                pl.col("代金券优惠").cast(pl.Float64, strict=False).alias("_coupon")
            )
            coupon_df = df_work.filter(
                pl.col("_coupon").is_not_null() & (pl.col("_coupon") > 0)
            )
            coupon_order_count = coupon_df.height
            total_coupon_amount = float(coupon_df["_coupon"].sum() or 0.0)
            coupon_share_pct = round(coupon_order_count / total_orders * 100, 2)
            avg_coupon_per_order = (
                round(total_coupon_amount / coupon_order_count, 2)
                if coupon_order_count > 0
                else 0.0
            )

        # ── Discount-rate bucket distribution ────────────────────────────────
        discount_buckets: List[Dict[str, Any]] = []
        heavy_discount_pct: float = 0.0
        chart_config: Optional[Dict[str, Any]] = None

        if has_discount_rate and total_orders > 0:
            df_rate = df.with_columns(
                pl.col("折扣率").cast(pl.Float64, strict=False).alias("_rate")
            ).filter(pl.col("_rate").is_not_null())

            rate_total = df_rate.height
            if rate_total > 0:
                buckets_def = [
                    ("0%", 0.0, 0.0),
                    ("0–5%", 0.0, 5.0),
                    ("5–10%", 5.0, 10.0),
                    ("10–20%", 10.0, 20.0),
                    (">20%", 20.0, float("inf")),
                ]
                for label, lo, hi in buckets_def:
                    if lo == 0.0 and hi == 0.0:
                        count = df_rate.filter(pl.col("_rate") == 0).height
                    elif hi == float("inf"):
                        count = df_rate.filter(pl.col("_rate") > lo).height
                    else:
                        count = df_rate.filter(
                            (pl.col("_rate") > lo) & (pl.col("_rate") <= hi)
                        ).height
                    share = round(count / rate_total * 100, 2)
                    discount_buckets.append(
                        {"range": label, "count": count, "share": share}
                    )

                heavy_bucket = next(
                    (b for b in discount_buckets if b["range"] == ">20%"), None
                )
                heavy_discount_pct = heavy_bucket["share"] if heavy_bucket else 0.0

                chart_config = {
                    "type": "bar",
                    "title": {"text": "折扣率分布", "left": "center"},
                    "xAxis": {
                        "type": "category",
                        "data": [b["range"] for b in discount_buckets],
                        "axisLabel": {"interval": 0},
                    },
                    "yAxis": {"type": "value", "name": "订单占比 (%)"},
                    "series": [
                        {
                            "name": "订单占比",
                            "type": "bar",
                            "data": [b["share"] for b in discount_buckets],
                            "label": {"show": True, "position": "top",
                                      "formatter": "{c}%"},
                        }
                    ],
                    "tooltip": {"trigger": "axis",
                                "formatter": "{b}: {c}%"},
                    "grid": {"left": "3%", "right": "4%",
                             "bottom": "3%", "containLabel": True},
                }

        # ── Revenue vs actual compare ─────────────────────────────────────────
        revenue_vs_actual: Optional[Dict[str, float]] = None
        if has_revenue and has_actual:
            total_revenue = float(
                df.with_columns(
                    pl.col("营业额").cast(pl.Float64, strict=False).alias("_rev")
                )["_rev"].sum() or 0.0
            )
            total_actual = float(
                df.with_columns(
                    pl.col("实收").cast(pl.Float64, strict=False).alias("_act")
                )["_act"].sum() or 0.0
            )
            discount_gap = round(total_revenue - total_actual, 2)
            revenue_vs_actual = {
                "total_revenue": round(total_revenue, 2),
                "total_actual": round(total_actual, 2),
                "discount_gap": discount_gap,
            }

        # ── Insight text ─────────────────────────────────────────────────────
        coupon_share = coupon_share_pct
        total_coupon = total_coupon_amount
        avg_coupon = avg_coupon_per_order
        heavy = heavy_discount_pct
        # Spec §4.3: drive heavy discount or low coupon usage into action
        if heavy >= 20:
            action_rec = format_action_rec(
                object_target=f"重度折扣 (>20%) 订单占 {heavy:.1f}%",
                benefit_range="收紧深度折扣阈值 + 改成赠菜 / 储值返券形式可降毛利损失 1-2 个百分点",
                prerequisite="按门店 / 班次 / 服务员分析重度折扣触发场景 + 修订折扣权限",
                timeline="本月内",
            )
        elif coupon_share < 5 and total_orders > 100:
            action_rec = format_action_rec(
                object_target=f"代金券使用率仅 {coupon_share:.1f}%",
                benefit_range="主动推送代金券 + 加入会员体系拉新回头率,客单提升 5-10%",
                prerequisite="代金券与会员积分挂钩 + 收银员推荐话术 + 公众号推送",
                timeline="本月内",
            )
        else:
            action_rec = format_action_rec(
                object_target=f"代金券使用 {coupon_share:.1f}% (累计 {total_coupon:,.0f} 元)",
                benefit_range="按券价值 / 客群分层后,投放 ROI 可提升 10-20%",
                prerequisite="按券类型 / 触发场景 / 客单价分层复盘 + A/B 测试",
                timeline="本月内",
            )
        insight_text = (
            f"{coupon_share:.1f}% 订单使用代金券，"
            f"累计优惠 {total_coupon:,.0f} 元 (人均 {avg_coupon:.0f})；"
            f"重度折扣 (>20%) 订单占 {heavy:.1f}%。 {action_rec}"
        )

        data: Dict[str, Any] = {
            "coupon_order_count": coupon_order_count,
            "total_coupon_amount": round(total_coupon_amount, 2),
            "coupon_share_pct": coupon_share_pct,
            "avg_coupon_per_order": avg_coupon_per_order,
            "discount_buckets": discount_buckets,
        }
        if revenue_vs_actual:
            data["revenue_vs_actual"] = revenue_vs_actual

        return TemplateResult(
            code=self.code,
            title=self.title,
            data=data,
            chart_config=chart_config,
            kpis={
                "coupon_share_pct": coupon_share_pct,
                "total_coupon": round(total_coupon_amount, 2),
                "avg_coupon": avg_coupon_per_order,
                "heavy_discount_pct": heavy_discount_pct,
            },
            insight_text=insight_text,
        )
