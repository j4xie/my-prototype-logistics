"""StoreCustomerStratification — 门店客单人数分层.

For each 门店名称, bin orders by customer-count per order (1/2/3-4/5+),
compute per bin:
  - 订单数 (count)
  - 实际人均 (revenue / customers)
  - 实际点菜数量 (avg dishes per order)
  - 营业额占比 (this bin's revenue / store total)

Needs 门店名称 AND 客流量 (per-order customer count). 实际点菜数量 is derived
from 商品信息 parse when available, else 商品结账总数.

Applies when 门店名称 + 客流量 both exist.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import polars as pl

from ..compute.base import ComputeBackend
from ..restaurant.item_parser import parse_items
from ..restaurant.schema_helpers import find_customer_col, find_store_col
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register

_REVENUE_COL_CANDIDATES = ("实收额", "营业额", "应收金额", "实收金额", "收款金额")
_DISH_COUNT_COL_CANDIDATES = ("商品结账总数", "数量(含套餐子商品)")
_ITEM_COL = "商品信息"

# Bin definition: label → (min_inclusive, max_inclusive)
_BINS: List[tuple] = [
    ("1 人", 1, 1),
    ("2 人", 2, 2),
    ("3-4 人", 3, 4),
    ("5 人+", 5, 10**9),
]

_TOP_N_STORES = 10


@register
class StoreCustomerStratification(AnalysisTemplate):

    @property
    def code(self) -> str:
        return "store_customer_stratification"

    @property
    def title(self) -> str:
        return "门店客单人数分层"

    def applies(self, schema: DataSchema) -> bool:
        names = {f.name for f in schema.fields}
        return find_store_col(names) is not None and find_customer_col(names) is not None

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        df = backend._df  # type: ignore[attr-defined]
        cols = set(df.columns)

        store_col = find_store_col(cols)
        cust_col = find_customer_col(cols)
        if store_col is None or cust_col is None:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no store or customer column",
            )

        revenue_col = next(
            (c for c in _REVENUE_COL_CANDIDATES if c in cols), None
        )
        dish_count_col = next(
            (c for c in _DISH_COUNT_COL_CANDIDATES if c in cols), None
        )

        # Filter non-null cust + store
        base = df.filter(
            pl.col(store_col).is_not_null()
            & pl.col(cust_col).cast(pl.Float64, strict=False).is_not_null()
            & (pl.col(cust_col).cast(pl.Float64, strict=False) >= 1.0)
        )
        total_orders = base.height

        if total_orders == 0:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no rows with valid 门店/客流量",
            )

        # Assign bin label per row
        cust_expr = pl.col(cust_col).cast(pl.Float64, strict=False)
        bin_expr = (
            pl.when((cust_expr >= 1) & (cust_expr <= 1)).then(pl.lit("1 人"))
            .when((cust_expr >= 2) & (cust_expr <= 2)).then(pl.lit("2 人"))
            .when((cust_expr >= 3) & (cust_expr <= 4)).then(pl.lit("3-4 人"))
            .when(cust_expr >= 5).then(pl.lit("5 人+"))
            .otherwise(pl.lit("其他"))
        )
        base = base.with_columns(bin_expr.alias("_bin"))

        agg_exprs = [
            pl.len().alias("orders"),
            cust_expr.sum().alias("customers_sum"),
        ]
        if revenue_col:
            agg_exprs.append(
                pl.col(revenue_col).cast(pl.Float64, strict=False).sum().alias("revenue")
            )
        if dish_count_col:
            agg_exprs.append(
                pl.col(dish_count_col).cast(pl.Float64, strict=False).sum().alias("dishes")
            )

        # Aggregate per (store, bin)
        grouped = (
            base.group_by([store_col, "_bin"]).agg(agg_exprs).to_dicts()
        )

        # Reshape: { store: { bin_label: row } }
        per_store: Dict[str, Dict[str, Dict[str, Any]]] = {}
        for r in grouped:
            store = str(r.get(store_col) or "<空>")
            bin_label = str(r.get("_bin") or "其他")
            if bin_label == "其他":
                continue
            per_store.setdefault(store, {})[bin_label] = r

        # Build per-store breakdown, limited to Top N stores by total orders
        store_totals = (
            base.group_by(store_col)
            .agg(pl.len().alias("orders"),
                 *([pl.col(revenue_col).cast(pl.Float64, strict=False).sum().alias("revenue")]
                   if revenue_col else []))
            .sort("orders", descending=True)
            .head(_TOP_N_STORES)
            .to_dicts()
        )

        stores: List[Dict[str, Any]] = []
        for st in store_totals:
            store_name = str(st.get(store_col) or "<空>")
            store_orders = int(st["orders"])
            store_revenue = float(st.get("revenue") or 0.0) if revenue_col else 0.0
            bins_out: List[Dict[str, Any]] = []
            for label, _lo, _hi in _BINS:
                row = per_store.get(store_name, {}).get(label)
                if not row:
                    bins_out.append({
                        "bin": label, "orders": 0, "customers": 0,
                        "avg_spend_per_customer": None, "avg_dishes_per_order": None,
                        "revenue": 0.0, "revenue_share_pct": 0.0,
                    })
                    continue
                orders = int(row["orders"])
                customers = float(row.get("customers_sum") or 0.0)
                revenue = float(row.get("revenue") or 0.0) if revenue_col else 0.0
                dishes = float(row.get("dishes") or 0.0) if dish_count_col else 0.0
                avg_spend = round(revenue / customers, 2) if customers > 0 else None
                avg_dishes = round(dishes / orders, 2) if orders > 0 and dish_count_col else None
                share = round(revenue / store_revenue * 100, 2) if store_revenue > 0 else 0.0
                bins_out.append({
                    "bin": label,
                    "orders": orders,
                    "customers": int(customers),
                    "avg_spend_per_customer": avg_spend,
                    "avg_dishes_per_order": avg_dishes,
                    "revenue": round(revenue, 2),
                    "revenue_share_pct": share,
                })

            dominant_bin = max(bins_out, key=lambda b: b["orders"])["bin"]
            stores.append({
                "store": store_name,
                "total_orders": store_orders,
                "total_revenue": round(store_revenue, 2),
                "dominant_bin": dominant_bin,
                "bins": bins_out,
            })

        # Aggregate bin totals across all shown stores for the summary chart
        overall_bins = {label: 0 for label, _, _ in _BINS}
        for s in stores:
            for b in s["bins"]:
                overall_bins[b["bin"]] += b["orders"]
        total_shown_orders = sum(overall_bins.values())
        bin_summary = [
            {
                "bin": label,
                "orders": overall_bins[label],
                "share_pct": round(overall_bins[label] / total_shown_orders * 100, 2)
                    if total_shown_orders > 0 else 0.0,
            }
            for label, _, _ in _BINS
        ]

        top_store = stores[0] if stores else None
        dominant_label = max(bin_summary, key=lambda b: b["orders"])["bin"] if bin_summary else "-"
        dominant_share = max(bin_summary, key=lambda b: b["orders"])["share_pct"] if bin_summary else 0.0

        insight_text = (
            f"分析 {len(stores)} 家门店、{total_shown_orders} 笔订单，"
            f"人数分布以「{dominant_label}」为主（占 {dominant_share:.1f}%）。"
        )
        if top_store:
            insight_text += (
                f" Top 门店：{top_store['store']}（{top_store['total_orders']} 单，"
                f"主力人数 {top_store['dominant_bin']}）。"
            )

        # ECharts stacked bar: x=store, each bin = a series
        if stores:
            chart_config = {
                "type": "bar",
                "title": {"text": "门店 × 客单人数分层 (订单数)", "left": "center"},
                "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
                "legend": {"top": 30, "data": [b[0] for b in _BINS]},
                "xAxis": {
                    "type": "category",
                    "data": [s["store"] for s in stores],
                    "axisLabel": {"rotate": 45, "interval": 0, "fontSize": 10},
                },
                "yAxis": {"type": "value", "name": "订单数"},
                "series": [
                    {
                        "name": label,
                        "type": "bar",
                        "stack": "total",
                        "data": [
                            next(
                                (b["orders"] for b in s["bins"] if b["bin"] == label), 0
                            )
                            for s in stores
                        ],
                    }
                    for label, _, _ in _BINS
                ],
                "grid": {"left": "3%", "right": "8%", "bottom": "25%", "containLabel": True},
            }
        else:
            chart_config = None

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "stores": stores,
                "bin_summary": bin_summary,
                "store_count": len(stores),
                "total_orders_analyzed": total_shown_orders,
            },
            chart_config=chart_config,
            kpis={
                "store_count": len(stores),
                "total_orders_analyzed": total_shown_orders,
                "dominant_bin": dominant_label,
                "top_store": top_store["store"] if top_store else None,
            },
            insight_text=insight_text,
        )
