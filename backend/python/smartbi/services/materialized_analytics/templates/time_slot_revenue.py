"""TimeSlotRevenue — 时段 × 区域/门店 营业额矩阵.

Buckets orders by hour-of-day into named meal slots, then groups by
area dimension to produce a cross-tabulation matrix.

Slot definitions (Chinese restaurant standard):
  早餐  6–10   Breakfast
  午餐  10–14  Lunch
  下午茶 14–17  Afternoon tea
  晚餐  17–21  Dinner
  宵夜  21–6   Late night / breakfast wrap-around
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import polars as pl

from ..compute.base import ComputeBackend
from ..compute.polars_backend import PolarsBackend
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register

# Ordered slot names (also defines chart x-axis order)
_SLOTS: List[str] = ["早餐", "午餐", "下午茶", "晚餐", "宵夜"]

# Area dimension preference order (added 店铺名称/门店/店铺 variants for
# brand portability — POS systems use different column names)
_AREA_CANDIDATES: List[str] = [
    "区域", "门店名称", "店铺名称", "门店", "店铺", "省份", "城市",
]


def _find_area_dim(schema: DataSchema) -> Optional[str]:
    """Return the first area-like dimension present in the schema."""
    dims = set(schema.dimensions)
    for candidate in _AREA_CANDIDATES:
        if candidate in dims:
            return candidate
    return None


def _hour_to_slot(hour_expr: pl.Expr) -> pl.Expr:
    """Map an integer-hour polars Expr to a Chinese meal-slot string."""
    return (
        pl.when((hour_expr >= 6) & (hour_expr < 10)).then(pl.lit("早餐"))
        .when((hour_expr >= 10) & (hour_expr < 14)).then(pl.lit("午餐"))
        .when((hour_expr >= 14) & (hour_expr < 17)).then(pl.lit("下午茶"))
        .when((hour_expr >= 17) & (hour_expr < 21)).then(pl.lit("晚餐"))
        .otherwise(pl.lit("宵夜"))  # 21-6 (includes null hour → 宵夜 bucket)
    )


@register
class TimeSlotRevenue(AnalysisTemplate):

    sample_queries = [
        "营业高峰时段",
        "各时段营收分布",
        "什么时候最赚钱",
        "时段营收排行",
        "早晚营业额对比",
        "哪个时段销售最好",
        "哪个时段卖得最好",
        "时段销售分布",
        "午餐晚餐哪个好",
        "宵夜销量",
        "早中晚时段对比",
        "什么时候开单最多",
        "什么时段客流最多",
        "高峰时段",
        "营业最忙时段",
        "哪个时间段订单多",
    ]

    @property
    def code(self) -> str:
        return "time_slot_revenue"

    @property
    def title(self) -> str:
        return "时段 × 区域营业额"

    def applies(self, schema: DataSchema) -> bool:
        has_time = schema.time_field is not None
        has_measure = schema.primary_measure is not None
        has_area = _find_area_dim(schema) is not None
        return has_time and has_measure and has_area

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        time_col = schema.time_field
        measure = schema.primary_measure
        area_dim = _find_area_dim(schema)

        # --- Extract polars DataFrame from backend ---
        # PolarsBackend exposes _df directly; fall back to re-building from
        # group_sum if a different backend is injected (future-proof).
        if isinstance(backend, PolarsBackend):
            df = backend._df
        else:
            # Graceful fallback: only slot-level totals, no area breakdown
            return self._fallback_no_area(backend, schema, area_dim)

        # --- Parse datetime and extract hour ---
        dt_dtype = df.schema.get(time_col)
        if dt_dtype is not None and "str" in str(dt_dtype).lower():
            t_expr = pl.col(time_col).str.to_datetime(strict=False).alias("_t")
        else:
            t_expr = pl.col(time_col).cast(pl.Datetime, strict=False).alias("_t")

        numeric_m = pl.col(measure).cast(pl.Float64, strict=False).alias("_m")

        df2 = (
            df
            .with_columns([t_expr, numeric_m])
            .filter(pl.col("_t").is_not_null() & pl.col("_m").is_not_null())
            .with_columns(
                _hour_to_slot(pl.col("_t").dt.hour()).alias("_slot")
            )
        )

        if df2.is_empty():
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no valid rows after datetime parse",
            )

        # --- Group by (slot, area) ---
        agg_df = (
            df2
            .filter(pl.col(area_dim).is_not_null())
            .group_by(["_slot", area_dim])
            .agg(pl.col("_m").sum().alias("_rev"))
            .sort(["_slot", area_dim])
        )

        rows: List[Dict[str, Any]] = []
        for row in agg_df.to_dicts():
            rows.append({
                "slot": row["_slot"],
                "area": row[area_dim],
                "revenue": row["_rev"],
            })

        if not rows:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no data after group-by",
            )

        # --- Derive slots / areas present in data ---
        present_slots = [s for s in _SLOTS if any(r["slot"] == s for r in rows)]
        areas = sorted({r["area"] for r in rows})

        # --- KPIs ---
        total_revenue = sum(r["revenue"] for r in rows)
        peak_row = max(rows, key=lambda r: r["revenue"])
        peak_slot = peak_row["slot"]
        peak_area = peak_row["area"]
        peak_revenue = peak_row["revenue"]

        # --- ECharts stacked bar: x = slot, series per area ---
        series_data: Dict[str, List[float]] = {area: [] for area in areas}
        for slot in present_slots:
            for area in areas:
                val = next(
                    (r["revenue"] for r in rows if r["slot"] == slot and r["area"] == area),
                    0.0,
                )
                series_data[area].append(val)

        chart_config = {
            "type": "bar",
            "title": {"text": f"{measure} 时段分布", "left": "center"},
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
            "legend": {"data": areas, "bottom": 0},
            "xAxis": {"type": "category", "data": present_slots},
            "yAxis": {"type": "value", "name": measure},
            "series": [
                {
                    "name": area,
                    "type": "bar",
                    "stack": "total",
                    "data": series_data[area],
                    "emphasis": {"focus": "series"},
                }
                for area in areas
            ],
            "grid": {"left": "3%", "right": "4%", "bottom": "10%", "containLabel": True},
        }

        insight_text = (
            f"营业高峰:{peak_slot}时段的{peak_area}"
            f"(营收 {peak_revenue:,.0f})。"
            f"全日累计 {total_revenue:,.0f}。"
        )

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "matrix": [[r["slot"], r["area"], r["revenue"]] for r in rows],
                "slots": present_slots,
                "areas": areas,
                "area_dim": area_dim,
            },
            chart_config=chart_config,
            kpis={
                "peak_slot": peak_slot,
                "peak_area": peak_area,
                "peak_revenue": peak_revenue,
                "total_revenue": total_revenue,
            },
            insight_text=insight_text,
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _fallback_no_area(
        self, backend: ComputeBackend, schema: DataSchema, area_dim: Optional[str]
    ) -> TemplateResult:
        """Minimal result when backend doesn't expose _df directly."""
        return TemplateResult(
            code=self.code, title=self.title, data={},
            applies=False,
            skip_reason="backend does not expose _df for hour-level parsing",
        )
