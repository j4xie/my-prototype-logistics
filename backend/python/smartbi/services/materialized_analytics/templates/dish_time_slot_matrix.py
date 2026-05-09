"""DishTimeSlotMatrix — 菜品 × 时段销量矩阵.

For each row: parse 商品信息 to get dishes + quantities, assign the order
timestamp to a meal-slot bucket, then accumulate (dish, slot) → total qty.

Top 15 dishes (by overall qty) form the matrix y-axis; the 5 standard
meal-slot buckets form the x-axis.

Slot definitions (Chinese restaurant standard):
  早餐   6–10   Breakfast
  午餐   10–14  Lunch
  下午茶  14–17  Afternoon tea
  晚餐   17–21  Dinner
  宵夜   21–6   Late night / breakfast wrap-around
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, ClassVar, Dict, List, Optional, Tuple

from smartbi.capability.contract import RequiresSpec

from ..compute.base import ComputeBackend
from ..restaurant.action_rec_formatter import format_action_rec
from ..restaurant.dish_name_normalizer import normalize_dish_name
from ..restaurant.item_parser import parse_items
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register

_SLOTS: List[str] = ["早餐", "午餐", "下午茶", "晚餐", "宵夜"]
_TOP_DISHES = 15
_SAMPLE_ROWS = 500_000


def _get_time_slot(hour: int) -> str:
    """Map integer hour (0-23) to Chinese meal-slot name."""
    if 6 <= hour < 10:
        return "早餐"
    if 10 <= hour < 14:
        return "午餐"
    if 14 <= hour < 17:
        return "下午茶"
    if 17 <= hour < 21:
        return "晚餐"
    return "宵夜"  # 21-23 and 0-5


def _parse_hour(value: Any) -> Optional[int]:
    """Extract hour integer from various timestamp representations."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.hour
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        # Try common ISO-like formats: "2025-03-01 19:00:00" / "2025-03-01T19:00:00"
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S",
                    "%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M"):
            try:
                return datetime.strptime(s[:len(fmt)], fmt).hour
            except ValueError:
                continue
        # Last resort: try splitting on space/T and parsing the time part
        parts = s.replace("T", " ").split(" ")
        if len(parts) >= 2:
            time_part = parts[1]
            try:
                return int(time_part.split(":")[0])
            except (ValueError, IndexError):
                pass
        return None
    # Polars may pass numeric epoch millis / seconds — not handled here;
    # callers should ensure string or datetime values.
    return None


@register
class DishTimeSlotMatrix(AnalysisTemplate):

    sample_queries = [
        "各时段菜品分布",
        "午餐晚餐菜品差异",
        "不同时段热卖菜",
        "时段菜品矩阵",
        "早晚菜品偏好",
    ]

    requires: ClassVar[RequiresSpec | None] = RequiresSpec(
        all=["date", "combo_string"],
        description="时段菜品热力 (订单时间 × 菜品销量矩阵)",
    )

    @property
    def code(self) -> str:
        return "dish_time_slot_matrix"

    @property
    def title(self) -> str:
        return "菜品 × 时段销量"

    def applies(self, schema: DataSchema) -> bool:
        field_names = {f.name for f in schema.fields}
        has_item = "商品信息" in field_names
        has_time = (
            schema.time_field is not None
            or any(f.name in ("开单时间", "下单时间", "点单时间", "时间") for f in schema.fields)
        )
        return has_item and has_time

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        # Determine time column
        time_col = schema.time_field
        if time_col is None:
            # Fall back to first time-field-like column name found in fields
            for candidate in ("开单时间", "下单时间", "点单时间", "时间"):
                if any(f.name == candidate for f in schema.fields):
                    time_col = candidate
                    break

        # Access raw DataFrame
        df = backend._df.head(_SAMPLE_ROWS)

        item_col = "商品信息"
        if item_col not in df.columns or time_col not in df.columns:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False,
                skip_reason=f"required columns missing: {item_col!r} or {time_col!r}",
            )

        # Accumulate (dish, slot) → total quantity
        combo_counter: Dict[Tuple[str, str], float] = defaultdict(float)
        dish_total: Counter = Counter()

        rows_list = df.select([item_col, time_col]).to_dicts()
        for row in rows_list:
            raw_time = row.get(time_col)
            raw_items = row.get(item_col)
            hour = _parse_hour(raw_time)
            if hour is None or not raw_items:
                continue
            slot = _get_time_slot(hour)
            items = parse_items(str(raw_items))
            for item in items:
                # Apr 24 2026: collapse variant suffixes so the heatmap's
                # Top-15 dish y-axis treats 招牌青花椒鱼(一吃)/(二吃) as one.
                name = normalize_dish_name(item["name"])
                qty = item["quantity"]
                combo_counter[(name, slot)] += qty
                dish_total[name] += qty

        if not dish_total:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False,
                skip_reason="no parseable dish items found",
            )

        # Top 15 dishes by overall quantity
        top_dishes: List[str] = [name for name, _ in dish_total.most_common(_TOP_DISHES)]

        # Determine which slots actually appear in data
        present_slots = [s for s in _SLOTS if any(
            combo_counter.get((d, s), 0) > 0 for d in top_dishes
        )]
        if not present_slots:
            present_slots = list(_SLOTS)

        # Build flat matrix rows and find peak combination
        matrix: List[List[Any]] = []
        peak_qty = 0.0
        peak_dish = top_dishes[0] if top_dishes else ""
        peak_slot = present_slots[0] if present_slots else _SLOTS[0]

        for dish in top_dishes:
            for slot in present_slots:
                qty = combo_counter.get((dish, slot), 0.0)
                matrix.append([dish, slot, qty])
                if qty > peak_qty:
                    peak_qty = qty
                    peak_dish = dish
                    peak_slot = slot

        # Top combinations sorted by qty
        top_combinations: List[Dict[str, Any]] = sorted(
            [{"dish": d, "slot": s, "qty": q} for (d, s), q in combo_counter.items()
             if d in set(top_dishes)],
            key=lambda x: x["qty"],
            reverse=True,
        )[:20]

        # ECharts heatmap config — y = dishes (top-to-bottom), x = slots
        # ECharts heatmap data format: [x_idx, y_idx, value]
        slot_index = {s: i for i, s in enumerate(present_slots)}
        dish_index = {d: i for i, d in enumerate(top_dishes)}

        heatmap_data = [
            [slot_index[slot], dish_index[dish], qty]
            for dish, slot, qty in
            ((row[0], row[1], row[2]) for row in matrix)
            if slot in slot_index and dish in dish_index
        ]

        max_qty = max((row[2] for row in matrix), default=1)

        chart_config = {
            "type": "heatmap",
            "title": {"text": "菜品 × 时段 销量热力图", "left": "center"},
            "tooltip": {
                "position": "top",
                "formatter": (
                    "function(p){return p.data[2]+' 份'}"
                ),
            },
            "grid": {"height": "70%", "top": "10%"},
            "xAxis": {
                "type": "category",
                "data": present_slots,
                "splitArea": {"show": True},
            },
            "yAxis": {
                "type": "category",
                "data": top_dishes,
                "splitArea": {"show": True},
            },
            "visualMap": {
                "min": 0,
                "max": max_qty,
                "calculable": True,
                "orient": "horizontal",
                "left": "center",
                "bottom": "5%",
            },
            "series": [
                {
                    "type": "heatmap",
                    "data": heatmap_data,
                    "label": {"show": True},
                    "emphasis": {
                        "itemStyle": {"shadowBlur": 10, "shadowColor": "rgba(0,0,0,0.5)"},
                    },
                }
            ],
        }

        dish_count = len(dish_total)
        slot_count = len(present_slots)
        # Spec §4.3: drive peak combination into time-slot-targeted promotion
        action_rec = format_action_rec(
            object_target=f"「{peak_dish}」在{peak_slot}时段",
            benefit_range=f"该时段加大{peak_dish}主推位 + 备货充足可拉高时段销量 8-15%",
            prerequisite=f"{peak_slot}排班配置专人推菜 + 备货量按峰值×1.2 储备",
            timeline="本周内",
        )
        insight_text = (
            f"最热组合:{peak_dish} × {peak_slot}时段 (销量 {peak_qty:.0f} 份);"
            f"{dish_count} 个菜品跨 {slot_count} 个时段分布。 {action_rec}"
        )

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "dishes": top_dishes,
                "slots": present_slots,
                "matrix": matrix,
                "top_combinations": top_combinations,
            },
            chart_config=chart_config,
            kpis={
                "peak_dish": peak_dish,
                "peak_slot": peak_slot,
                "peak_qty": peak_qty,
                "slot_count": slot_count,
            },
            insight_text=insight_text,
        )
