"""RevenueManagementReport — 收入管理复合报表 (渠道 × 时段).

Qhj-style "收入管理报表" cross-tabs revenue by:
  - 渠道 = 堂食 / 外卖 (derived from 桌位 via table_classifier)
  - 时段 = 午市 / 晚市 / 下午茶 / 宵夜 (derived from 班次 or 开单时间 hour)

Output is a 2D matrix (rows=channel, cols=time_slot) with per-cell
orders/revenue/avg_per_order + row totals + column totals + grand total.

Answers Q-A #14 — users want ONE composite view, not to cross-reference
channel_analysis + time_slot_revenue side by side.

Applies when 桌位 exists (for channel) AND (班次 OR 开单时间 — for time slot).
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Optional

import polars as pl

from ..compute.base import ComputeBackend
from ..restaurant.schema_helpers import find_customer_col, find_table_col
from ..restaurant.table_classifier import classify_table
from ..schema import DataSchema, Domain
from .base import AnalysisTemplate, TemplateResult
from .registry import register

_SHIFT_COL = "班次"
_OPEN_TIME_CANDIDATES = ("开单时间", "下单时间", "点单时间", "结单时间")
_REVENUE_CANDIDATES = ("实收额", "实收", "营业额", "应收金额")
_SAMPLE_CAP = 200_000

# Expected channel order (for stable display)
_CHANNEL_ORDER = ["堂食", "外卖", "包厢", "散客"]
# Expected time_slot order
_SLOT_ORDER = ["早市", "午市", "下午茶", "晚市", "宵夜"]


def _derive_channel(table_type: str) -> str:
    """Collapse table_classifier output into the report's channel axis.

    堂食 = 大厅 + 包厢 (all in-store dining)
    外卖 = 外卖
    Other (散客/未知) → '其他'
    """
    if table_type in ("大厅", "包厢"):
        return "堂食"
    if table_type == "外卖":
        return "外卖"
    return "其他"


def _derive_time_slot(shift_value: Any, open_time_value: Any) -> Optional[str]:
    """Prefer explicit 班次 when present; else parse hour from 开单时间.

    班次 values seen in qhj: '午市', '晚市', '下午茶', '宵夜'.
    Hour mapping:
      6-10 → 早市
      11-14 → 午市
      14-17 → 下午茶
      17-21 → 晚市
      21-6  → 宵夜
    """
    if shift_value:
        s = str(shift_value).strip()
        if s in _SLOT_ORDER or s in ("午餐", "晚餐"):
            return {"午餐": "午市", "晚餐": "晚市"}.get(s, s)
    if open_time_value:
        s = str(open_time_value).strip()
        # Format: "2025-03-01 17:57:07"
        if len(s) >= 13 and s[10] == " ":
            try:
                hour = int(s[11:13])
            except ValueError:
                return None
            if 6 <= hour < 11:
                return "早市"
            if 11 <= hour < 14:
                return "午市"
            if 14 <= hour < 17:
                return "下午茶"
            if 17 <= hour < 21:
                return "晚市"
            return "宵夜"
    return None


@register
class RevenueManagementReport(AnalysisTemplate):

    @property
    def code(self) -> str:
        return "revenue_management_report"

    @property
    def title(self) -> str:
        return "收入管理复合报表 (渠道 × 时段)"

    def applies(self, schema: DataSchema) -> bool:
        if schema.domain not in (Domain.RESTAURANT, Domain.UNKNOWN):
            return False
        names = {f.name for f in schema.fields}
        if find_table_col(names) is None:
            return False
        has_time_signal = (_SHIFT_COL in names) or any(c in names for c in _OPEN_TIME_CANDIDATES)
        return has_time_signal

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        df = backend._df  # type: ignore[attr-defined]
        cols = set(df.columns)

        revenue_col = next((c for c in _REVENUE_CANDIDATES if c in cols), None)
        if revenue_col is None:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no revenue column found",
            )
        table_col = find_table_col(cols)
        if table_col is None:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no table/source column",
            )
        open_time_col = next((c for c in _OPEN_TIME_CANDIDATES if c in cols), None)
        customer_col = find_customer_col(cols)

        use_cols = [table_col, revenue_col]
        if _SHIFT_COL in cols: use_cols.append(_SHIFT_COL)
        if open_time_col: use_cols.append(open_time_col)
        if customer_col: use_cols.append(customer_col)

        sample = df.head(_SAMPLE_CAP) if df.height > _SAMPLE_CAP else df
        rows = sample.select(use_cols).to_dicts()

        # Cells keyed by (channel, slot)
        orders: Dict[tuple, int] = defaultdict(int)
        revenue: Dict[tuple, float] = defaultdict(float)
        customers: Dict[tuple, float] = defaultdict(float)

        for row in rows:
            channel = _derive_channel(classify_table(row.get(table_col)))
            slot = _derive_time_slot(
                row.get(_SHIFT_COL),
                row.get(open_time_col) if open_time_col else None,
            )
            if slot is None:
                slot = "未知"
            key = (channel, slot)
            orders[key] += 1
            try:
                revenue[key] += float(row.get(revenue_col) or 0.0)
            except (TypeError, ValueError):
                pass
            if customer_col:
                try:
                    customers[key] += float(row.get(customer_col) or 0.0)
                except (TypeError, ValueError):
                    pass

        if not orders:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no rows with 桌位 + 时段 signal",
            )

        # Determine which channels / slots actually appear
        channels_present = sorted(
            {k[0] for k in orders.keys()},
            key=lambda c: _CHANNEL_ORDER.index(c) if c in _CHANNEL_ORDER else 99,
        )
        slots_present = sorted(
            {k[1] for k in orders.keys() if k[1] != "未知"},
            key=lambda s: _SLOT_ORDER.index(s) if s in _SLOT_ORDER else 99,
        )
        if "未知" in {k[1] for k in orders.keys()}:
            slots_present.append("未知")

        # Build matrix (row-oriented — each row is a channel)
        matrix: List[Dict[str, Any]] = []
        for ch in channels_present:
            cells: List[Dict[str, Any]] = []
            row_orders = 0
            row_revenue = 0.0
            row_customers = 0.0
            for sl in slots_present:
                key = (ch, sl)
                o = orders.get(key, 0)
                r = revenue.get(key, 0.0)
                c = customers.get(key, 0.0) if customer_col else 0.0
                avg = round(r / o, 2) if o > 0 else 0.0
                per_customer = round(r / c, 2) if c > 0 else None
                cells.append({
                    "slot": sl,
                    "orders": o,
                    "revenue": round(r, 2),
                    "avg_per_order": avg,
                    "avg_per_customer": per_customer,
                })
                row_orders += o
                row_revenue += r
                row_customers += c
            matrix.append({
                "channel": ch,
                "cells": cells,
                "row_orders": row_orders,
                "row_revenue": round(row_revenue, 2),
                "row_avg_per_order": round(row_revenue / row_orders, 2) if row_orders else 0.0,
            })

        # Column totals
        col_totals: List[Dict[str, Any]] = []
        grand_orders = 0
        grand_revenue = 0.0
        for sl in slots_present:
            co = sum(orders.get((ch, sl), 0) for ch in channels_present)
            cr = sum(revenue.get((ch, sl), 0.0) for ch in channels_present)
            col_totals.append({
                "slot": sl,
                "orders": co,
                "revenue": round(cr, 2),
                "avg_per_order": round(cr / co, 2) if co > 0 else 0.0,
            })
            grand_orders += co
            grand_revenue += cr

        # Insight — call out dominant (channel, slot) cell
        all_cells = [
            (ch, sl, orders.get((ch, sl), 0), revenue.get((ch, sl), 0.0))
            for ch in channels_present for sl in slots_present
        ]
        top_cell = max(all_cells, key=lambda c: c[3])  # by revenue
        top_ch, top_sl, top_orders, top_rev = top_cell
        top_share = round(top_rev / grand_revenue * 100, 1) if grand_revenue > 0 else 0.0

        insight_text = (
            f"营收高峰：{top_ch}×{top_sl} 贡献 {top_rev:,.0f} 元（占 {top_share:.1f}%）, {top_orders} 单。"
            f" 全渠道全时段 {grand_orders} 单、{grand_revenue:,.0f} 元。"
        )

        # ECharts — stacked bar: x=time_slot, each channel is a series
        chart_config = {
            "type": "bar",
            "title": {"text": "渠道 × 时段 营收矩阵", "left": "center"},
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
            "legend": {"top": 30, "data": channels_present},
            "xAxis": {
                "type": "category",
                "data": slots_present,
            },
            "yAxis": {"type": "value", "name": "营收 (元)"},
            "series": [
                {
                    "name": ch,
                    "type": "bar",
                    "stack": "total",
                    "data": [round(revenue.get((ch, sl), 0.0), 2) for sl in slots_present],
                    "label": {"show": False},
                }
                for ch in channels_present
            ],
            "grid": {"left": "3%", "right": "8%", "bottom": "12%", "containLabel": True},
        }

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "channels": channels_present,
                "slots": slots_present,
                "matrix": matrix,
                "col_totals": col_totals,
                "grand_orders": grand_orders,
                "grand_revenue": round(grand_revenue, 2),
            },
            chart_config=chart_config,
            kpis={
                "grand_orders": grand_orders,
                "grand_revenue": round(grand_revenue, 2),
                "top_channel": top_ch,
                "top_slot": top_sl,
                "top_cell_share_pct": top_share,
            },
            insight_text=insight_text,
        )
