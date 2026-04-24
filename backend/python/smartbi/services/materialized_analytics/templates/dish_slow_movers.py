"""DishSlowMovers — 末位菜品 / 滞销品分析.

Parses 商品信息 column (format: name_qty[unit]*price+...) to accumulate
per-dish totals and order appearance counts, then surfaces the bottom-15
by total quantity sold.  Dishes with <3 order appearances are flagged as
near-zero sellers.
"""
from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List

from ..compute.base import ComputeBackend
from ..restaurant.dish_name_normalizer import normalize_dish_name
from ..restaurant.item_parser import parse_items
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register

_ITEM_COL = "商品信息"
_SAMPLE_CAP = 500_000  # max rows to parse (performance guard)


@register
class DishSlowMovers(AnalysisTemplate):

    sample_queries = [
        "菜品滞销榜",
        "哪些菜卖不出去",
        "末位菜品",
        "销量最差的菜",
        "不好卖的菜",
        "冷门菜品",
        "慢销菜品",
        "滞销菜品",
        "销量垫底",
        "哪些菜要下架",
        "菜品销量倒数",
        "底部菜品",
    ]

    @property
    def code(self) -> str:
        return "dish_slow_movers"

    @property
    def title(self) -> str:
        return "滞销菜品 (末位 15)"

    def applies(self, schema: DataSchema) -> bool:
        return _ITEM_COL in {f.name for f in schema.fields}

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        # Pull raw strings from the DataFrame (polars or pandas compatible via to_dicts)
        df = backend._df  # type: ignore[attr-defined]

        # Take a row-cap sample if the dataset is large
        if df.height > _SAMPLE_CAP:
            df = df.head(_SAMPLE_CAP)

        rows_raw: List[Dict[str, Any]] = df.select([_ITEM_COL]).to_dicts()

        qty_counter: Counter = Counter()
        order_counter: Counter = Counter()

        for row in rows_raw:
            cell = row.get(_ITEM_COL)
            if not cell:
                continue
            items = parse_items(str(cell), include_system=False)
            seen_in_order: set = set()
            for item in items:
                # Apr 24 2026: collapse variant suffixes so 招牌青花椒鱼(一吃)
                # and 招牌青花椒鱼(二吃) are treated as one dish before
                # ranking the bottom-15 slow movers.
                name = normalize_dish_name(item["name"])
                qty_counter[name] += item["quantity"]
                seen_in_order.add(name)
            for name in seen_in_order:
                order_counter[name] += 1

        if not qty_counter:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no parseable 商品信息 rows",
            )

        # Sort ascending by total quantity → slow movers first
        sorted_dishes = sorted(qty_counter.items(), key=lambda x: x[1])

        bottom_15: List[Dict[str, Any]] = [
            {
                "name": name,
                "total_qty": qty,
                "order_appearances": order_counter.get(name, 0),
            }
            for name, qty in sorted_dishes[:15]
        ]

        near_zero: List[Dict[str, Any]] = [
            {
                "name": name,
                "total_qty": qty_counter[name],
                "order_appearances": order_counter.get(name, 0),
            }
            for name in qty_counter
            if order_counter.get(name, 0) < 3
        ]
        # Sort near_zero by order appearances asc, then qty asc for stable output
        near_zero.sort(key=lambda x: (x["order_appearances"], x["total_qty"]))

        total_tracked = len(qty_counter)

        # Build horizontal bar chart config (echarts)
        bar_names = [r["name"] for r in bottom_15]
        bar_qtys = [r["total_qty"] for r in bottom_15]

        chart_config = {
            "type": "bar",
            "title": {"text": "末位 15 菜品 (按总份数)", "left": "center"},
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
            "grid": {"left": "25%", "right": "5%", "containLabel": True},
            "xAxis": {"type": "value", "name": "总份数"},
            "yAxis": {
                "type": "category",
                "data": bar_names,
                "inverse": True,
                "axisLabel": {"overflow": "truncate", "width": 120},
            },
            "series": [
                {
                    "name": "总份数",
                    "type": "bar",
                    "data": bar_qtys,
                    "itemStyle": {"color": "#e57373"},
                    "label": {"show": True, "position": "right"},
                }
            ],
        }

        # Build KPIs
        bottom_dish = bottom_15[0]["name"] if bottom_15 else ""
        bottom_qty = bottom_15[0]["total_qty"] if bottom_15 else 0
        near_zero_count = len(near_zero)

        kpis = {
            "bottom_dish": bottom_dish,
            "bottom_qty": bottom_qty,
            "near_zero_count": near_zero_count,
            "total_tracked": total_tracked,
        }

        # Build insight text
        top3 = bottom_15[:3]
        if len(top3) >= 3:
            names_str = "、".join(d["name"] for d in top3)
            qtys_str = "/".join(str(int(d["total_qty"])) for d in top3)
            insight_text = (
                f"最滞销 Top 3：{names_str}"
                f"（仅售 {qtys_str} 份）。"
                f"有 {near_zero_count} 个菜品月售<3 份，建议下架或优惠促销。"
            )
        elif top3:
            names_str = "、".join(d["name"] for d in top3)
            qtys_str = "/".join(str(int(d["total_qty"])) for d in top3)
            insight_text = (
                f"最滞销菜品：{names_str}（仅售 {qtys_str} 份）。"
                f"有 {near_zero_count} 个菜品月售<3 份，建议关注。"
            )
        else:
            insight_text = f"共追踪 {total_tracked} 个菜品，暂无滞销数据。"

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "bottom_15": bottom_15,
                "near_zero": near_zero,
                "total_tracked": total_tracked,
            },
            chart_config=chart_config,
            kpis=kpis,
            insight_text=insight_text,
        )
