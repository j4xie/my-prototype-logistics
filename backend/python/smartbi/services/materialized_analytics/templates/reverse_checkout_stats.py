"""ReverseCheckoutStats — 反结账统计.

"反结账" = orders that were checked-out then reverted (canceled after close).
POS exports tag these with:
  - 反结账时间 column filled (primary signal)
  - OR 订单状态 = "反结账" / "已反结" (secondary signal)

Reports:
  - total reverse-checkout count + share of total orders
  - top stores by reverse count (operational red-flag)
  - top staff by reverse count
  - top days by reverse count (temporal concentration)

Applies when 反结账时间 OR (订单状态 with reverse values) exists in schema.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import polars as pl

from ..compute.base import ComputeBackend
from ..restaurant.schema_helpers import find_date_col, find_staff_col, find_store_col
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register

_REVERSE_TIME_COL = "反结账时间"
_STATUS_COL = "订单状态"
_REVERSE_STATUS_VALUES = ("反结账", "已反结", "反结")
_TOP_N = 10

# Same noise filter as staff_performance — prevents "收银/点菜" generic role labels
# from dominating the by-staff breakdown when cashier terminal stamped all orders.
_STAFF_NOISE = {
    "收银", "收银员", "服务员", "销售员", "厨师", "店长", "经理",
    "店员", "员工", "点菜", "点单员", "后厨", "前厅", "外卖员",
    "服务生", "主管", "收银台", "大堂", "兼职", "临时工",
    "合计", "总计", "小计", "汇总", "总和", "平均",
    "默认", "系统", "无", "未知", "暂无",
}


@register
class ReverseCheckoutStats(AnalysisTemplate):

    sample_queries = [
        "反结账统计",
        "反结账次数",
        "撤单反结次数",
        "反结账门店分布",
        "哪些订单反结了",
    ]

    @property
    def code(self) -> str:
        return "reverse_checkout_stats"

    @property
    def title(self) -> str:
        return "反结账统计"

    def applies(self, schema: DataSchema) -> bool:
        field_names = {f.name for f in schema.fields}
        return _REVERSE_TIME_COL in field_names or _STATUS_COL in field_names

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        df = backend._df  # type: ignore[attr-defined]
        cols = set(df.columns)
        total_rows = df.height

        # Build reverse-checkout mask — time column is stronger signal than status
        mask: Optional[pl.Expr] = None
        if _REVERSE_TIME_COL in cols:
            time_mask = (
                pl.col(_REVERSE_TIME_COL).cast(pl.Utf8, strict=False).is_not_null()
                & (pl.col(_REVERSE_TIME_COL).cast(pl.Utf8, strict=False).str.strip_chars() != "")
            )
            mask = time_mask
        if _STATUS_COL in cols:
            status_mask = (
                pl.col(_STATUS_COL).cast(pl.Utf8, strict=False)
                .is_in(list(_REVERSE_STATUS_VALUES))
            )
            mask = status_mask if mask is None else (mask | status_mask)

        if mask is None:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no 反结账时间 or 订单状态 column",
            )

        reverse_df = df.filter(mask)
        reverse_count = reverse_df.height

        if reverse_count == 0:
            return TemplateResult(
                code=self.code,
                title=self.title,
                data={
                    "reverse_count": 0,
                    "reverse_share_pct": 0.0,
                    "total_orders": total_rows,
                    "by_store": [],
                    "by_staff": [],
                    "by_date": [],
                },
                kpis={
                    "reverse_count": 0,
                    "reverse_share_pct": 0.0,
                    "total_orders": total_rows,
                },
                insight_text=(
                    f"全部 {total_rows} 笔订单均正常结账，未检出反结账记录。"
                ),
            )

        reverse_share_pct = round(reverse_count / total_rows * 100, 2) if total_rows else 0.0

        store_col = find_store_col(cols)
        staff_col = find_staff_col(cols)
        date_col = find_date_col(cols)
        by_store = self._group_top(reverse_df, store_col) if store_col else []
        # W4-Q9: filter generic role labels (收银/点菜 etc.) from staff stats —
        # they're cashier-terminal stamps, not actual people responsible.
        by_staff = self._group_top(reverse_df, staff_col, filter_noise=_STAFF_NOISE) if staff_col else []
        by_date = self._group_top(reverse_df, date_col) if date_col else []

        # Build insight — lead with headline, then call out worst dim
        parts = [
            f"共检出 {reverse_count} 笔反结账（占总订单 {reverse_share_pct:.2f}%）。"
        ]
        if by_store:
            top_s = by_store[0]
            parts.append(
                f"门店集中度：「{top_s['dim']}」{top_s['count']} 笔（占反结账 "
                f"{round(top_s['count'] / reverse_count * 100, 1):.1f}%）。"
            )
        if by_date:
            top_d = by_date[0]
            parts.append(
                f"高发日：{top_d['dim']}（{top_d['count']} 笔）。"
            )

        # ECharts — stacked bar: reverse count by store
        chart_config = None
        if by_store:
            chart_config = {
                "type": "bar",
                "title": {"text": "反结账门店 Top 10", "left": "center"},
                "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
                "xAxis": {
                    "type": "category",
                    "data": [r["dim"] for r in by_store],
                    "axisLabel": {"rotate": 45, "interval": 0, "fontSize": 10},
                },
                "yAxis": {"type": "value", "name": "反结账笔数"},
                "series": [{
                    "name": "反结账笔数",
                    "type": "bar",
                    "data": [r["count"] for r in by_store],
                    "itemStyle": {"color": "#ef5350"},
                    "label": {"show": True, "position": "top"},
                }],
                "grid": {"left": "3%", "right": "8%", "bottom": "25%", "containLabel": True},
            }

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "reverse_count": reverse_count,
                "reverse_share_pct": reverse_share_pct,
                "total_orders": total_rows,
                "by_store": by_store,
                "by_staff": by_staff,
                "by_date": by_date,
            },
            chart_config=chart_config,
            kpis={
                "reverse_count": reverse_count,
                "reverse_share_pct": reverse_share_pct,
                "total_orders": total_rows,
                "top_store_reverse": by_store[0]["dim"] if by_store else None,
            },
            insight_text="".join(parts),
        )

    def _group_top(
        self, df: "pl.DataFrame", col: str, filter_noise: Optional[set] = None
    ) -> List[Dict[str, Any]]:
        if col not in df.columns or df.height == 0:
            return []
        base = df.filter(pl.col(col).is_not_null())
        if filter_noise:
            base = base.filter(
                ~pl.col(col).cast(pl.Utf8, strict=False).is_in(list(filter_noise))
            )
        grouped = (
            base.group_by(col)
            .agg(pl.len().alias("count"))
            .sort("count", descending=True)
            .head(_TOP_N)
            .to_dicts()
        )
        return [
            {"dim": str(r.get(col) or "<空>"), "count": int(r["count"])}
            for r in grouped
        ]
