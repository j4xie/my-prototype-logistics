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

from typing import Any, ClassVar, Dict, List, Optional

import polars as pl

from smartbi.capability.contract import RequiresSpec

from ..compute.base import ComputeBackend
from ..restaurant.action_rec_formatter import format_action_rec
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

    # Deferred: applies() prefix-matches 点评*/美团*/抖音* voucher columns
    # which are POS-specific schemas, not yet folded into ALIAS_TO_ATTR.
    # channel_origin canonical exists but applies() doesn't gate on it.
    requires: ClassVar[RequiresSpec | None] = None

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

        # C-rec 7 (Apr 25 2026): expose BOTH amount-share and bills-share so
        # AI doesn't conflate them. Q12 bug: AI said "65.0%" was bills-basis,
        # actual was amount-basis (real bills basis was 55.8%). Now every
        # platform carries share_amount_pct + share_bills_pct + legacy share_pct
        # (= share_amount_pct, kept for FE backward compatibility).
        for p in platforms:
            share_amount = (p["amount"] / grand_amount * 100) if grand_amount > 0 else 0.0
            share_bills = (p["orders"] / grand_orders * 100) if grand_orders > 0 else 0.0
            p["share_amount_pct"] = round(share_amount, 2)  # 按金额(扣减额)
            p["share_bills_pct"] = round(share_bills, 2)    # 按笔数(订单数)
            p["share_pct"] = p["share_amount_pct"]  # legacy alias = amount-basis
            p["share_basis"] = "amount"  # explicit basis marker for legacy field

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
            f"团购券合计扣减 {grand_amount:,.0f} 元[毛扣减额]，覆盖 {grand_orders} 笔订单使用。"
        ]
        top3 = platforms_active[:3]
        insight_parts.append(
            "三端占比[按金额]: " + "、".join(
                f"{p['platform']} {p['share_amount_pct']:.1f}%" for p in top3
            ) + "。"
        )
        insight_parts.append(
            "三端占比[按笔数]: " + "、".join(
                f"{p['platform']} {p['share_bills_pct']:.1f}%" for p in top3
            ) + "。"
        )
        insight_parts.append(
            f"最大渠道:{top['platform']} {top['amount']:,.0f} 元 / {top['orders']} 单"
            f"（按金额 {top['share_amount_pct']:.1f}% / 按笔数 {top['share_bills_pct']:.1f}%）。"
        )
        # Spec §4.3: drive top-platform concentration / dependency into action
        if top["share_amount_pct"] >= 60:
            action_rec = format_action_rec(
                object_target=f"过度依赖「{top['platform']}」 ({top['share_amount_pct']:.1f}% 团购扣减)",
                benefit_range="拓展 2 端 + 自营券 + 直营会员体系,降单平台依赖,毛利提升 1-3 个百分点",
                prerequisite="多端 BD 谈判 + 自有小程序团购上线 + 会员体系打通",
                timeline="本季度内",
            )
        elif len(platforms_active) >= 3:
            # Identify weakest active platform for activation lever
            weakest = platforms_active[-1]
            action_rec = format_action_rec(
                object_target=f"最弱团购端「{weakest['platform']}」 (仅 {weakest['share_amount_pct']:.1f}%)",
                benefit_range=f"活动套餐重点投放 + 平台联运可拉高{weakest['platform']}订单 15-30%",
                prerequisite=f"与{weakest['platform']}BD 谈判 + 设计平台专属套餐 + 推广预算倾斜",
                timeline="本月内",
            )
        else:
            action_rec = format_action_rec(
                object_target=f"团购整体 ({grand_orders} 单 / {grand_amount:,.0f} 元扣减)",
                benefit_range="平台间 ROI 横评后,把预算调到边际效益最高 1-2 端可提扣减率回报 10-20%",
                prerequisite="按平台拉新成本 + 客单价 + 复购率分层评估 + 调整预算",
                timeline="本月内",
            )
        insight_text = " ".join(insight_parts) + " " + action_rec

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
                # C-rec 7: explicit basis labels so AI/FE never conflate
                # amount-share and bills-share.
                "share_basis_note": "share_amount_pct=按金额(扣减额)占比，share_bills_pct=按笔数(订单数)占比",
                "amount_basis": "毛/扣减额",  # voucher 扣减 is gross-side
            },
            chart_config=chart_config,
            kpis={
                "top_platform": top["platform"],
                "top_platform_amount": top["amount"],
                "top_platform_share_pct": top["share_pct"],            # legacy = amount
                "top_platform_share_amount_pct": top["share_amount_pct"],
                "top_platform_share_bills_pct": top["share_bills_pct"],
                "grand_amount": round(grand_amount, 2),
                "platform_count": len(platforms_active),
                "share_basis_default": "amount",
            },
            insight_text=insight_text,
        )
