"""DishSlowMovers — 末位菜品 / 滞销品分析.

Parses 商品信息 column (format: name_qty[unit]*price+...) to accumulate
per-dish totals and order appearance counts, then surfaces the bottom-15
by total quantity sold.  Dishes with <3 order appearances are flagged as
near-zero sellers.
"""
from __future__ import annotations

from collections import Counter
from typing import Any, ClassVar, Dict, List

from smartbi.capability.contract import RequiresSpec

from ..compute.base import ComputeBackend
from ..restaurant.action_rec_formatter import (
    format_action_rec,
    format_data_insufficient,
)
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

    requires: ClassVar[RequiresSpec | None] = RequiresSpec(
        all=["combo_string"],
        description="销量末位菜品 (商品信息 列解析)",
    )

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
        # K2 / C-rec 8: append spec §4.3 action rec (a对象 b收益区间 c前置 d时间窗)
        top3 = bottom_15[:3]
        if len(top3) >= 3:
            names_str = "、".join(d["name"] for d in top3)
            qtys_str = "/".join(str(int(d["total_qty"])) for d in top3)
            action_rec = format_action_rec(
                object_target=f"{names_str} 等 {len(top3)} 款慢销菜品",
                benefit_range="试售 3 个月观察, 仍滞销则下架可节约采购 5-8 万/月",
                prerequisite="食材供应链评估 + 厨师工序梳理 + 套餐替代方案",
                timeline="本季度内",
            )
            insight_text = (
                f"最滞销 Top 3：{names_str}"
                f"（仅售 {qtys_str} 份）。"
                f"有 {near_zero_count} 个菜品月售<3 份。 "
                f"{action_rec}"
            )
        elif top3:
            names_str = "、".join(d["name"] for d in top3)
            qtys_str = "/".join(str(int(d["total_qty"])) for d in top3)
            action_rec = format_action_rec(
                object_target=f"{names_str} 慢销菜品",
                benefit_range="下架可减少 SKU 复杂度, 节约采购 2-4 万/月",
                prerequisite="客户偏好回访 + 厨房备料评估",
                timeline="本月内",
            )
            insight_text = (
                f"最滞销菜品：{names_str}（仅售 {qtys_str} 份）。"
                f"有 {near_zero_count} 个菜品月售<3 份。 "
                f"{action_rec}"
            )
        else:
            insight_text = (
                f"共追踪 {total_tracked} 个菜品，暂无滞销数据。 "
                + format_data_insufficient(
                    needed="补充菜单结构和近 30 天销量数据",
                    next_action="完成上传后再触发滞销分析",
                )
            )

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
