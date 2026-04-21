"""TableTypeComparison — 堂食/包厢/外卖对比.

Classifies each row by 桌位 value (外卖/包厢/大厅/散客/未知),
then groups by type to compare order count, revenue, and avg spend.
Applies whenever 桌位 exists in the schema.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Optional

from ..compute.base import ComputeBackend
from ..restaurant.table_classifier import classify_table
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register

_TABLE_COL = "桌位"
_SAMPLE_CAP = 100_000


@register
class TableTypeComparison(AnalysisTemplate):

    @property
    def code(self) -> str:
        return "table_type_comparison"

    @property
    def title(self) -> str:
        return "堂食/包厢/外卖对比"

    def applies(self, schema: DataSchema) -> bool:
        return _TABLE_COL in {f.name for f in schema.fields}

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        df = backend._df  # type: ignore[attr-defined]
        if df.height > _SAMPLE_CAP:
            df = df.head(_SAMPLE_CAP)

        # Identify revenue column (primary_measure or first available measure)
        revenue_col: Optional[str] = schema.primary_measure
        if revenue_col and revenue_col not in df.columns:
            revenue_col = None
        if revenue_col is None:
            measure_fields = [f.name for f in schema.fields
                              if f.role.value == "measure" and f.name in df.columns]
            revenue_col = measure_fields[0] if measure_fields else None

        # Identify customer count column if present
        customer_col: Optional[str] = None
        for candidate in ("客流量", "就餐人数", "用餐人数"):
            if candidate in df.columns:
                customer_col = candidate
                break

        # Columns to pull
        select_cols = [_TABLE_COL]
        if revenue_col:
            select_cols.append(revenue_col)
        if customer_col:
            select_cols.append(customer_col)

        rows_raw = df.select(select_cols).to_dicts()

        # Accumulate per-type stats
        orders: Dict[str, int] = defaultdict(int)
        revenue: Dict[str, float] = defaultdict(float)
        customers: Dict[str, float] = defaultdict(float)

        for row in rows_raw:
            raw_table = row.get(_TABLE_COL)
            t_type = classify_table(raw_table)
            orders[t_type] += 1
            if revenue_col:
                try:
                    revenue[t_type] += float(row.get(revenue_col) or 0)
                except (TypeError, ValueError):
                    pass
            if customer_col:
                try:
                    customers[t_type] += float(row.get(customer_col) or 0)
                except (TypeError, ValueError):
                    pass

        if not orders:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no rows with 桌位 data",
            )

        total_orders = sum(orders.values())

        # Build sorted type list (descending by orders)
        types: List[Dict[str, Any]] = []
        for t_type, cnt in sorted(orders.items(), key=lambda x: -x[1]):
            rev = revenue.get(t_type, 0.0)
            avg = rev / cnt if cnt > 0 else 0.0
            cust = customers.get(t_type, 0.0) if customer_col else 0.0
            types.append({
                "type": t_type,
                "orders": cnt,
                "revenue": round(rev, 2),
                "avg_per_order": round(avg, 2),
                "customers": round(cust, 2),
            })

        dominant = types[0]
        dominant_type = dominant["type"]
        dominant_share = round(dominant["orders"] / total_orders * 100, 1) if total_orders else 0.0

        takeaway_orders = orders.get("外卖", 0)
        takeaway_share = round(takeaway_orders / total_orders * 100, 1) if total_orders else 0.0

        hall_avg = next(
            (t["avg_per_order"] for t in types if t["type"] == "大厅"), None
        )
        vip_avg = next(
            (t["avg_per_order"] for t in types if t["type"] == "包厢"), None
        )

        # Build ECharts grouped bar chart
        type_labels = [t["type"] for t in types]
        order_series = [t["orders"] for t in types]
        revenue_series = [t["revenue"] for t in types]

        chart_config = {
            "type": "bar",
            "title": {"text": "堂食/包厢/外卖对比", "left": "center"},
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
            "legend": {"top": 30},
            "grid": {"left": "3%", "right": "8%", "bottom": "10%", "containLabel": True},
            "xAxis": {
                "type": "category",
                "data": type_labels,
            },
            "yAxis": [
                {"type": "value", "name": "订单数", "position": "left"},
                {"type": "value", "name": "营业额 (元)", "position": "right"},
            ],
            "series": [
                {
                    "name": "订单数",
                    "type": "bar",
                    "yAxisIndex": 0,
                    "data": order_series,
                    "label": {"show": True, "position": "top"},
                },
                {
                    "name": "营业额",
                    "type": "bar",
                    "yAxisIndex": 1,
                    "data": revenue_series,
                    "label": {"show": False},
                },
            ],
        }

        # Build insight
        insight_text = _build_insight(
            dominant_type=dominant_type,
            dominant_share=dominant_share,
            takeaway_share=takeaway_share,
            hall_avg=hall_avg,
            vip_avg=vip_avg,
            takeaway_avg=next(
                (t["avg_per_order"] for t in types if t["type"] == "外卖"), None
            ),
        )

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "types": types,
                "dominant_type": dominant_type,
            },
            chart_config=chart_config,
            kpis={
                "dominant_type": dominant_type,
                "dominant_share_pct": dominant_share,
                "takeaway_share": takeaway_share,
                "avg_hall_spend": hall_avg,
                "avg_vip_spend": vip_avg,
            },
            insight_text=insight_text,
        )


def _build_insight(
    dominant_type: str,
    dominant_share: float,
    takeaway_share: float,
    hall_avg: Optional[float],
    vip_avg: Optional[float],
    takeaway_avg: Optional[float],
) -> str:
    parts: List[str] = []

    if takeaway_share >= 60:
        avg_str = f"，人均 {takeaway_avg:.0f} 元" if takeaway_avg else ""
        parts.append(
            f"外卖占 {takeaway_share:.1f}% 订单{avg_str}，显著依赖外卖渠道。"
        )
    elif dominant_type == "外卖":
        avg_str = f"，人均 {takeaway_avg:.0f} 元" if takeaway_avg else ""
        parts.append(
            f"外卖为主要渠道，占 {takeaway_share:.1f}% 订单{avg_str}。"
        )

    if vip_avg is not None and hall_avg is not None and hall_avg > 0:
        delta_pct = (vip_avg - hall_avg) / hall_avg * 100
        parts.append(
            f"包厢人均 {vip_avg:.0f} 元 vs 大厅 {hall_avg:.0f} 元，"
            f"差距 {delta_pct:.1f}%。"
        )

    if not parts:
        parts.append(
            f"{dominant_type}占主导，订单占比 {dominant_share:.1f}%。"
        )

    return "".join(parts)
