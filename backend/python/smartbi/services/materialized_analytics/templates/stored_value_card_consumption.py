"""StoredValueCardConsumption — 储值卡消费流水.

qhj row_data has a 储值卡 column (currency amount paid via stored-value
card per order). This is DIFFERENT from member_consumption which covers
会员卡 (loyalty membership card — typically points-based or discount-tier).

Reports:
  - number of orders where 储值卡 > 0 (usage count)
  - total spend via storage card + share of total revenue
  - concentration by 门店 (where storage-card users cluster)
  - trend over time (if 营业日期 available)

Separately counts 储值卡(不计) / 储值卡赠送金(不计) when present — tag as
"non-revenue storage-card flow" in data payload (but don't add to revenue
since "不计" means excluded from normal revenue accounting).

Applies when 储值卡 column exists.
"""
from __future__ import annotations

from typing import Any, ClassVar, Dict, List, Optional

import polars as pl

from smartbi.capability.contract import RequiresSpec

from ..compute.base import ComputeBackend
from ..restaurant.action_rec_formatter import format_action_rec
from ..restaurant.schema_helpers import find_date_col, find_store_col
from ..schema import DataSchema, Domain
from .base import AnalysisTemplate, TemplateResult
from .registry import register

_CARD_COL = "储值卡"
_CARD_NONREV_COLS = ("储值卡(不计)", "储值卡赠送金(不计)")
_GROSS_REVENUE_CANDIDATES = ("实收额", "实收", "营业额")
_TOP_N_STORES = 10


@register
class StoredValueCardConsumption(AnalysisTemplate):

    sample_queries = [
        # original 5
        "储值卡消费情况",
        "预付卡使用流水",
        "储值卡金额统计",
        "会员储值消费",
        "储值卡核销",
        # v7 #6 (Apr 26 2026): extended for xmx-style stored-value queries.
        "储值卡使用率",
        "充值卡使用频次",
        "充值最多的客户",
        "充值排行",
        "充值总金额多少",
        "充值赠送比例",
        "充值赠送金额",
        "卡内余额总额",
        "余额未使用比例",
        "押金总额",
        "卡类型分布",
        "卡类型 Top",
        "本金 vs 赠送占比",
        "储值卡 Top 5 客户",
        "储值卡净留存",
        # v8 #39 prod log analysis: real prod queries not matched yet
        "储值卡余额总额",
        "储值卡余额合计",
        "储值卡余额总额多少",
        "全店余额总和",
        "储值卡使用情况怎么样",
        "卡余额还剩多少",
    ]

    # spec §6.1: B 阶段引入 SVC fields 字段后再填
    requires: ClassVar[RequiresSpec | None] = None

    @property
    def code(self) -> str:
        return "stored_value_card_consumption"

    @property
    def title(self) -> str:
        return "储值卡消费流水"

    def applies(self, schema: DataSchema) -> bool:
        if schema.domain not in (Domain.RESTAURANT, Domain.UNKNOWN):
            return False
        return _CARD_COL in {f.name for f in schema.fields}

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        df = backend._df  # type: ignore[attr-defined]
        cols = set(df.columns)

        card_expr = pl.col(_CARD_COL).cast(pl.Float64, strict=False).fill_null(0.0)

        total_orders = df.height
        card_df = df.filter(card_expr > 0)
        card_orders = card_df.height

        # Total amount paid via storage card
        card_total = float(
            df.select(card_expr.sum()).item() or 0.0
        )

        usage_rate_pct = round(card_orders / total_orders * 100, 2) if total_orders else 0.0

        # Non-revenue storage flows (e.g., 储值卡赠送金(不计))
        nonrev: List[Dict[str, Any]] = []
        for col in _CARD_NONREV_COLS:
            if col in cols:
                amt = float(
                    df.select(
                        pl.col(col).cast(pl.Float64, strict=False).fill_null(0.0).sum()
                    ).item() or 0.0
                )
                if abs(amt) > 0.01:
                    nonrev.append({"label": col, "amount": round(amt, 2)})

        # Share of gross revenue
        share_of_revenue_pct: Optional[float] = None
        gross_col = next((c for c in _GROSS_REVENUE_CANDIDATES if c in cols), None)
        if gross_col and card_total > 0:
            gross = float(
                df.select(
                    pl.col(gross_col).cast(pl.Float64, strict=False).fill_null(0.0).sum()
                ).item() or 0.0
            )
            if gross > 0:
                share_of_revenue_pct = round(card_total / gross * 100, 2)

        if card_orders == 0:
            # Apr 25 2026 C-2 audit: tenants with no card data previously saw raw
            # ¥0/0 KPI tiles (misleading — looked like a metric reading zero).
            # When BOTH usage and non-revenue flows are absent, suppress KPIs +
            # chart entirely (TemplateCard hides KPI grid when kpiValues={} and
            # chart when chart_config=None) and surface an actionable subtitle
            # via insight_text. is_empty flag in data allows future FE-side
            # special rendering if needed.
            has_nonrev = bool(nonrev)
            if not has_nonrev:
                return TemplateResult(
                    code=self.code,
                    title=self.title,
                    data={
                        "is_empty": True,
                        "empty_reason": "no_card_data",
                        "card_orders": 0,
                        "card_total": 0.0,
                        "usage_rate_pct": 0.0,
                        "share_of_revenue_pct": 0.0,
                        "nonrev_flows": [],
                        "by_store": [],
                        "by_date": [],
                        "total_orders": total_orders,
                    },
                    kpis={},
                    insight_text="暂无储值卡数据，请在设置中开启储值卡功能。",
                )
            # Has 不计 storage flows (gift money etc.) — show those even
            # when usage_count == 0, since data exists.
            return TemplateResult(
                code=self.code,
                title=self.title,
                data={
                    "is_empty": False,
                    "card_orders": 0,
                    "card_total": 0.0,
                    "usage_rate_pct": 0.0,
                    "share_of_revenue_pct": 0.0,
                    "nonrev_flows": nonrev,
                    "by_store": [],
                    "by_date": [],
                    "total_orders": total_orders,
                },
                kpis={
                    "card_orders": 0,
                    "card_total": 0.0,
                    "card_usage_rate_pct": 0.0,
                },
                insight_text=(
                    f"全部 {total_orders} 笔订单均未使用储值卡正常消费，"
                    f"另有 {sum(n['amount'] for n in nonrev):,.0f} 元'不计营收'流水"
                    f"（赠送金/不计科目）。"
                ),
            )

        # Per-store breakdown (Top N)
        by_store: List[Dict[str, Any]] = []
        store_col = find_store_col(cols)
        if store_col:
            rows = (
                card_df.filter(pl.col(store_col).is_not_null())
                .group_by(store_col)
                .agg([
                    pl.len().alias("orders"),
                    card_expr.sum().alias("total"),
                ])
                .sort("total", descending=True)
                .head(_TOP_N_STORES)
                .to_dicts()
            )
            by_store = [
                {
                    "store": str(r.get(store_col) or "<空>"),
                    "orders": int(r["orders"]),
                    "amount": round(float(r["total"] or 0.0), 2),
                }
                for r in rows
            ]

        # Trend over time (if date present)
        by_date: List[Dict[str, Any]] = []
        date_col = find_date_col(cols)
        if date_col:
            rows = (
                card_df.filter(pl.col(date_col).is_not_null())
                .group_by(date_col)
                .agg([
                    pl.len().alias("orders"),
                    card_expr.sum().alias("total"),
                ])
                .sort(date_col)
                .to_dicts()
            )
            by_date = [
                {
                    "date": str(r.get(date_col) or ""),
                    "orders": int(r["orders"]),
                    "amount": round(float(r["total"] or 0.0), 2),
                }
                for r in rows
            ]

        # Insight
        parts = [
            f"共 {card_orders} 笔订单用储值卡结账 (占总订单 {usage_rate_pct:.1f}%)，"
            f"累计储值卡收款 {card_total:,.0f} 元。"
        ]
        if share_of_revenue_pct is not None:
            parts.append(f"占总营收 {share_of_revenue_pct:.1f}%。")
        if by_store:
            top_s = by_store[0]
            parts.append(
                f"Top 门店:{top_s['store']} {top_s['orders']} 单、{top_s['amount']:,.0f} 元。"
            )
        if nonrev:
            nonrev_total = sum(n["amount"] for n in nonrev)
            parts.append(
                f"另有 {nonrev_total:,.0f} 元储值卡流水记为'不计营收' (赠送金/不计科目)。"
            )
        # Spec §4.3: drive low usage rate or top-store concentration into action
        if usage_rate_pct < 5:
            action_rec = format_action_rec(
                object_target=f"储值卡使用率仅 {usage_rate_pct:.1f}%",
                benefit_range="储值卡充值返券 + 会员等级激励可拉高储值锁客率 5-15%",
                prerequisite="储值返券方案设计 + 收银员推荐话术 + 会员体系打通",
                timeline="本月内",
            )
        elif by_store and len(by_store) >= 2 and by_store[0]["amount"] > sum(s["amount"] for s in by_store[1:]) * 2:
            action_rec = format_action_rec(
                object_target=f"储值卡集中在「{by_store[0]['store']}」 ({by_store[0]['amount']:,.0f} 元)",
                benefit_range=f"复制 Top 门店储值推广 SOP 到其他门店,跨店储值率提升 8-15%",
                prerequisite=f"对标走访{by_store[0]['store']} + 全店储值推广培训",
                timeline="本月内",
            )
        else:
            action_rec = format_action_rec(
                object_target=f"储值卡 {card_orders} 笔 / {card_total:,.0f} 元",
                benefit_range="储值卡老客户复购率高 (锁定流量),持续推广可拉营收 3-7%",
                prerequisite="储值卡到期提醒 + 新档活动套餐 + 余额唤回 SMS",
                timeline="本月内",
            )
        insight_text = " ".join(parts) + " " + action_rec

        # ECharts bar — top stores by card amount
        chart_config = None
        if by_store:
            chart_config = {
                "type": "bar",
                "title": {"text": "储值卡消费 Top 门店", "left": "center"},
                "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
                "xAxis": {
                    "type": "category",
                    "data": [r["store"] for r in by_store],
                    "axisLabel": {"rotate": 45, "interval": 0, "fontSize": 10},
                },
                "yAxis": [
                    {"type": "value", "name": "储值卡收款 (元)", "position": "left"},
                    {"type": "value", "name": "订单数", "position": "right"},
                ],
                "series": [
                    {
                        "name": "储值卡收款",
                        "type": "bar",
                        "yAxisIndex": 0,
                        "data": [r["amount"] for r in by_store],
                        "itemStyle": {"color": "#ab47bc"},
                    },
                    {
                        "name": "订单数",
                        "type": "bar",
                        "yAxisIndex": 1,
                        "data": [r["orders"] for r in by_store],
                        "itemStyle": {"color": "#8e24aa"},
                    },
                ],
                "legend": {"top": 30},
                "grid": {"left": "3%", "right": "8%", "bottom": "25%", "containLabel": True},
            }

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "card_orders": card_orders,
                "card_total": round(card_total, 2),
                "usage_rate_pct": usage_rate_pct,
                "share_of_revenue_pct": share_of_revenue_pct,
                "nonrev_flows": nonrev,
                "by_store": by_store,
                "by_date": by_date,
                "total_orders": total_orders,
            },
            chart_config=chart_config,
            kpis={
                "card_orders": card_orders,
                "card_total": round(card_total, 2),
                "card_usage_rate_pct": usage_rate_pct,
                "share_of_revenue_pct": share_of_revenue_pct,
                "top_store": by_store[0]["store"] if by_store else None,
            },
            insight_text=insight_text,
        )
