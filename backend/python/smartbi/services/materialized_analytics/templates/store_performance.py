"""StorePerformance — 门店业绩排名 Top 20.

Ranks stores by revenue (sum of primary_measure, preferring 实收). Also reports
order count and average-per-order per store. Mirrors StaffPerformance but keyed
on store column (find_store_col) instead of staff role column.
"""
from __future__ import annotations

from typing import Any, ClassVar, Dict, List

import polars as pl

from smartbi.capability.contract import RequiresSpec

from ..compute.base import ComputeBackend
from ..restaurant.action_rec_formatter import format_action_rec
from ..restaurant.schema_helpers import (
    find_store_col,
    measure_annotation,
    preferred_revenue_col,
)
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register

_TOP_N = 20

# Store-column pollution:
#   1. Meta rows ("合计"/"总计" leaked past PolarsBackend filter when store col
#      holds aggregate labels instead of store names)
#   2. Excel export warnings ("您查询的数据已经超过最大导出量..." etc.) — rows
#      where the data pipeline wrote a warning sentinel into the store column
# Filter at template level since classifier only fixes column roles, not cell values.
_STORE_META_LABELS = {"合计", "总计", "小计", "汇总", "总和", "平均", "—", "-", "无", "未知", "暂无"}
_STORE_WARNING_SUBSTRINGS = ("超过最大导出量", "请试着缩小查询范围", "导出数据")


@register
class StorePerformance(AnalysisTemplate):

    sample_queries = [
        "门店业绩排名",
        "哪家店业绩最好",
        "哪家店业绩最差",
        "业绩冠军是哪家店",
        "门店销售排行 Top 10",
        "哪家店卖得最多",
        "哪家店客单价最高",
        "门店营收对比",
    ]

    requires: ClassVar[RequiresSpec | None] = RequiresSpec(
        all=["store_name"],
        any=["net_amount", "gross_amount", "revenue"],
        description="门店业绩对比",
    )

    @property
    def code(self) -> str:
        return "store_performance"

    @property
    def title(self) -> str:
        return "门店业绩排名"

    def applies(self, schema: DataSchema) -> bool:
        field_names = {f.name for f in schema.fields}
        return (
            find_store_col(field_names) is not None
            and schema.primary_measure is not None
        )

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        measure = preferred_revenue_col(backend._df.columns, schema.primary_measure)
        if measure is None:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no revenue column found",
            )

        store_col = find_store_col(backend._df.columns)
        if store_col is None:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no store column found",
            )

        ranking_df = (
            backend._df
            .filter(
                pl.col(store_col).is_not_null()
                & (pl.col(store_col).cast(pl.Utf8) != "")
                & (~pl.col(store_col).cast(pl.Utf8).is_in(list(_STORE_META_LABELS)))
                & (~pl.col(store_col).cast(pl.Utf8).str.contains("|".join(_STORE_WARNING_SUBSTRINGS)))
            )
            .group_by(store_col)
            .agg([
                pl.len().alias("orders"),
                pl.col(measure).cast(pl.Float64, strict=False).sum().alias("revenue"),
            ])
            .sort("revenue", descending=True)
            .head(_TOP_N)
        )

        if ranking_df.is_empty():
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason=f"no non-null rows in {store_col}",
            )

        total_stores = (
            backend._df
            .filter(
                pl.col(store_col).is_not_null()
                & (pl.col(store_col).cast(pl.Utf8) != "")
                & (~pl.col(store_col).cast(pl.Utf8).is_in(list(_STORE_META_LABELS)))
                & (~pl.col(store_col).cast(pl.Utf8).str.contains("|".join(_STORE_WARNING_SUBSTRINGS)))
            )
            .select(pl.col(store_col).n_unique())
            .item()
        )

        ranking: List[Dict[str, Any]] = []
        for row in ranking_df.to_dicts():
            rev = float(row["revenue"] or 0.0)
            cnt = int(row["orders"])
            avg = round(rev / cnt, 2) if cnt > 0 else 0.0
            ranking.append({
                "store": row[store_col],
                "orders": cnt,
                "revenue": rev,
                "avg_per_order": avg,
            })

        top = ranking[0]
        bottom = ranking[-1]
        top_avg = max(ranking, key=lambda r: r["avg_per_order"])

        store_names = [r["store"] for r in ranking]
        revenues = [r["revenue"] for r in ranking]

        chart_config = {
            "type": "bar",
            "title": {"text": f"门店业绩排名 Top {len(ranking)}", "left": "center"},
            "xAxis": {"type": "value", "name": measure},
            "yAxis": {
                "type": "category",
                "data": store_names[::-1],
                "axisLabel": {"rotate": 0},
            },
            "series": [{
                "name": measure,
                "type": "bar",
                "data": revenues[::-1],
                "label": {"show": True, "position": "right"},
            }],
            "tooltip": {"trigger": "axis"},
            "grid": {"left": "3%", "right": "8%", "bottom": "3%", "containLabel": True},
        }

        # K2 / C-rec 8: append spec §4.3 action rec (a对象 b收益区间 c前置 d时间窗)
        # If gap is large, target the bottom store; otherwise replicate top store playbook
        gap_pct = (
            round((top["revenue"] - bottom["revenue"]) / max(top["revenue"], 1) * 100, 0)
            if len(ranking) >= 2 else 0
        )
        if len(ranking) >= 2 and gap_pct >= 50:
            action_rec = format_action_rec(
                object_target=f"末位门店 {bottom['store']} (与 Top 差距 {gap_pct:.0f}%)",
                benefit_range=f"复制 {top['store']} 运营 SOP 可拉高末位营收 20-40%",
                prerequisite=f"对标走访 {top['store']} + 末位店店长培训 + KPI 重设",
                timeline="本季度内",
            )
        else:
            action_rec = format_action_rec(
                object_target=f"客单价标杆 {top_avg['store']} (¥{top_avg['avg_per_order']:,.0f}/单)",
                benefit_range=f"将 {top_avg['store']} 客单价做法推广到其余 {total_stores - 1} 店, 整体客单价拉高 5-10%",
                prerequisite="高客单价菜品/套餐结构梳理 + 推销话术模板",
                timeline="本月内",
            )
        insight_text = (
            f"门店 Top 1:{top['store']} (销售额 {top['revenue']:,.0f} 元,{top['orders']:,} 单);"
            f" Top {len(ranking)} 末位:{bottom['store']} (销售额 {bottom['revenue']:,.0f} 元);"
            f" 客单价最高:{top_avg['store']} ({top_avg['avg_per_order']:,.2f} 元/单);"
            f" 共 {total_stores} 家门店。 "
            f"{action_rec} "
            f"{measure_annotation(measure)}"
        )

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "store_col": store_col,
                "ranking": ranking,
                "total_stores": total_stores,
            },
            chart_config=chart_config,
            kpis={
                "top_store": top["store"],
                "top_revenue": top["revenue"],
                "bottom_store": bottom["store"],
                "top_avg_per_order_store": top_avg["store"],
                "top_avg_per_order": top_avg["avg_per_order"],
                "store_count": total_stores,
            },
            insight_text=insight_text,
        )
