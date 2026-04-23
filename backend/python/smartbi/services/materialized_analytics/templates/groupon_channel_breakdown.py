"""GrouponChannelBreakdown — 团购券三端占比 (点评/美团/抖音).

qhj row_data has many voucher columns keyed by platform prefix. This
template prefix-matches all columns and aggregates by platform into three
canonical buckets: 点评 / 美团 / 抖音 (+ "其他" for other platforms).

For each platform bucket:
  - sum of voucher amount deducted (monetary impact)
  - count of orders that used the platform's voucher (non-zero rows)
  - share of total voucher usage

Columns matched (prefix patterns):
  点评 → 点评* (点评98代100, 点评218代300, 点评买单折扣, ...)
  美团 → 美团* / 新美大* / [美团*] (美团代金券, 新美大折扣, 美团套餐券, ...)
  抖音 → 抖音* / [抖音*] (抖音138代201, [抖音代金券], ...)
  饿了么 → 饿了么* / [饿了么*] (not typically groupon but included for completeness)
  其他 → 闪购 / 享库 / 笔记红书 / 地推 / 探探糖 / 霸王餐 / 鱼羊鲜 / etc.

Applies when schema contains at least one prefix-matching column.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import polars as pl

from ..compute.base import ComputeBackend
from ..schema import DataSchema, Domain
from .base import AnalysisTemplate, TemplateResult
from .registry import register

# Platform prefix rules, ordered for lookup specificity
_PLATFORM_RULES = [
    ("点评", ["点评"]),
    ("美团", ["美团", "新美大", "[美团"]),
    ("抖音", ["抖音", "[抖音"]),
    ("饿了么", ["饿了么", "[饿了么"]),
]
_KNOWN_OTHER_PREFIXES = [
    "闪购", "享库", "笔记红书", "地推", "探探糖", "霸王餐",
    "鱼羊鲜", "晚市微醺", "消费券", "无刺套餐",
]

# Exclude columns that look like metadata/classification rather than amount
# e.g., 点评买单折扣(不计) is a "不计营收" flag, not a voucher amount.
# Keep explicitly-amount columns (prefix + "金额" suffix or pure value columns).
# Rule: include if column is numeric-like and doesn't clearly look like a label.
_EXCLUDE_SUFFIXES = ("折扣名称", "折扣类型")


def _platform_for(col: str) -> Optional[str]:
    """Return canonical platform bucket for a column, or None if no match."""
    name = col.lstrip("[")
    for platform, prefixes in _PLATFORM_RULES:
        for p in prefixes:
            if col.startswith(p) or name.startswith(p.lstrip("[")):
                return platform
    for p in _KNOWN_OTHER_PREFIXES:
        if col.startswith(p):
            return "其他"
    return None


@register
class GrouponChannelBreakdown(AnalysisTemplate):

    sample_queries = [
        "团购渠道分析",
        "点评美团抖音对比",
        "三端销售占比",
        "团购券使用情况",
        "平台券销量",
        "哪个平台订单最多",
        "哪个平台卖得最多",
        "美团抖音哪个更好",
        "外卖平台对比",
        "各平台销售额",
        "美团订单",
        "抖音订单",
    ]

    @property
    def code(self) -> str:
        return "groupon_channel_breakdown"

    @property
    def title(self) -> str:
        return "团购三端占比 (点评/美团/抖音)"

    def applies(self, schema: DataSchema) -> bool:
        if schema.domain not in (Domain.RESTAURANT, Domain.UNKNOWN):
            return False
        names = {f.name for f in schema.fields}
        for col in names:
            if col.endswith(_EXCLUDE_SUFFIXES):
                continue
            if _platform_for(col):
                return True
        return False

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        df = backend._df  # type: ignore[attr-defined]
        cols = df.columns

        # { platform: [col1, col2, ...] }
        platform_cols: Dict[str, List[str]] = {}
        for c in cols:
            if c.endswith(_EXCLUDE_SUFFIXES):
                continue
            platform = _platform_for(c)
            if platform:
                platform_cols.setdefault(platform, []).append(c)

        if not platform_cols:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no platform-prefixed voucher columns found",
            )

        # For each platform, sum all matched columns (amounts) + count orders
        # where ANY of the platform's columns > 0.
        platforms: List[Dict[str, Any]] = []
        grand_amount = 0.0
        grand_orders = 0

        for platform, pcols in platform_cols.items():
            # Sum amount across all columns (cast to float, null-safe)
            amount_exprs = [
                pl.col(c).cast(pl.Float64, strict=False).fill_null(0.0).sum()
                for c in pcols
            ]
            if amount_exprs:
                totals = df.select(amount_exprs).row(0)
                amount = float(sum(totals))
            else:
                amount = 0.0

            # Count orders where any column > 0
            any_gt_zero = pl.lit(False)
            for c in pcols:
                any_gt_zero = any_gt_zero | (
                    pl.col(c).cast(pl.Float64, strict=False).fill_null(0.0) > 0
                )
            order_count = df.filter(any_gt_zero).height

            if amount <= 0 and order_count == 0:
                # Platform has columns but zero usage — include in data
                # but skip from chart/insight
                platforms.append({
                    "platform": platform,
                    "amount": 0.0,
                    "orders": 0,
                    "column_count": len(pcols),
                    "columns": pcols,
                    "active": False,
                })
                continue

            platforms.append({
                "platform": platform,
                "amount": round(amount, 2),
                "orders": order_count,
                "column_count": len(pcols),
                "columns": pcols,
                "active": True,
            })
            grand_amount += amount
            grand_orders += order_count

        # Compute shares (of total voucher amount)
        for p in platforms:
            p["share_pct"] = round(p["amount"] / grand_amount * 100, 2) \
                if grand_amount > 0 else 0.0

        # Sort by amount desc for display
        platforms_active = sorted(
            [p for p in platforms if p["active"]],
            key=lambda p: p["amount"], reverse=True,
        )

        if not platforms_active:
            return TemplateResult(
                code=self.code,
                title=self.title,
                data={"platforms": platforms, "grand_amount": 0.0, "grand_orders": 0},
                applies=False,
                skip_reason="no platform voucher had non-zero usage",
            )

        top = platforms_active[0]
        insight_parts = [
            f"团购券合计扣减 {grand_amount:,.0f} 元，覆盖 {grand_orders} 笔订单使用。"
        ]
        top3 = platforms_active[:3]
        insight_parts.append(
            "三端占比: " + "、".join(
                f"{p['platform']} {p['share_pct']:.1f}%" for p in top3
            ) + "。"
        )
        insight_parts.append(
            f"最大渠道:{top['platform']} {top['amount']:,.0f} 元 / {top['orders']} 单。"
        )
        insight_text = " ".join(insight_parts)

        chart_config = {
            "type": "pie",
            "title": {"text": "团购券三端扣减占比", "left": "center"},
            "tooltip": {"trigger": "item", "formatter": "{b}: {c} 元 ({d}%)"},
            "legend": {"top": 30, "data": [p["platform"] for p in platforms_active]},
            "series": [{
                "name": "团购券扣减",
                "type": "pie",
                "radius": ["30%", "65%"],
                "data": [
                    {"name": p["platform"], "value": p["amount"]}
                    for p in platforms_active
                ],
                "label": {"formatter": "{b}: {d}%"},
            }],
        }

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "platforms": platforms,
                "grand_amount": round(grand_amount, 2),
                "grand_orders": grand_orders,
            },
            chart_config=chart_config,
            kpis={
                "top_platform": top["platform"],
                "top_platform_amount": top["amount"],
                "top_platform_share_pct": top["share_pct"],
                "grand_amount": round(grand_amount, 2),
                "platform_count": len(platforms_active),
            },
            insight_text=insight_text,
        )
