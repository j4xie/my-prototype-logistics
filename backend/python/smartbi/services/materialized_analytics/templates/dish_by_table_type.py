"""DishByTableType — 包厢/大厅/外卖 × 菜品 Top N 下钻.

Parses 商品信息 per row, classifies the row's 桌位 via table_classifier,
then for each (table_type, dish) accumulates quantity and revenue. Reports
Top N dishes per table type.

Answers questions like:
  - "包厢客人喜欢点什么菜?"
  - "大厅和外卖菜品偏好差多少?"

Applies when schema contains both 商品信息 AND 桌位 (restaurant POS export).
"""
from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any, Dict, List

from ..compute.base import ComputeBackend
from ..restaurant.dish_name_normalizer import normalize_dish_name
from ..restaurant.item_parser import parse_items
from ..restaurant.schema_helpers import find_table_col
from ..restaurant.table_classifier import classify_table
from ..schema import DataSchema, Domain
from .base import AnalysisTemplate, TemplateResult
from .registry import register

_TOP_N_PER_TYPE = 10
_SAMPLE_ROWS = 500_000
_ITEM_COL = "商品信息"


@register
class DishByTableType(AnalysisTemplate):

    sample_queries = [
        "包厢大厅菜品差异",
        "堂食外卖点单偏好",
        "不同桌位点什么菜",
        "散客包房菜品对比",
        "包厢客人点什么",
        "大厅客人爱点什么",
    ]

    @property
    def code(self) -> str:
        return "dish_by_table_type"

    @property
    def title(self) -> str:
        return "包厢/大厅/外卖 × 菜品 Top 10"

    def applies(self, schema: DataSchema) -> bool:
        field_names = {f.name for f in schema.fields}
        if _ITEM_COL not in field_names or find_table_col(field_names) is None:
            return False
        return schema.domain in (Domain.RESTAURANT, Domain.UNKNOWN)

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        df = backend._df  # type: ignore[attr-defined]
        table_col = find_table_col(df.columns)
        if table_col is None:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no table/source column",
            )
        if df.height > _SAMPLE_ROWS:
            df = df.head(_SAMPLE_ROWS)

        rows = df.select([_ITEM_COL, table_col]).to_dicts()

        # { table_type: { dish_name: qty } }, same for revenue
        qty_by_type: Dict[str, Counter] = defaultdict(Counter)
        rev_by_type: Dict[str, Counter] = defaultdict(Counter)
        orders_by_type: Dict[str, int] = defaultdict(int)

        for row in rows:
            t_type = classify_table(row.get(table_col))
            orders_by_type[t_type] += 1
            raw = row.get(_ITEM_COL)
            if not raw:
                continue
            items = parse_items(str(raw))
            for item in items:
                # Apr 24 2026: collapse variant suffixes so the per-table-type
                # Top-N treats 招牌青花椒鱼(一吃)/(二吃) as one dish.
                name = normalize_dish_name(item["name"])
                qty_by_type[t_type][name] += item["quantity"]
                rev_by_type[t_type][name] += item["total"]

        # Drop "未知" / empty — not useful to display
        type_order_preference = ["大厅", "包厢", "外卖", "散客"]
        observed_types = [
            t for t in type_order_preference
            if t in qty_by_type and qty_by_type[t]
        ]
        # Include any other observed types after preferred ones
        for t in qty_by_type:
            if t not in observed_types and qty_by_type[t] and t != "未知":
                observed_types.append(t)

        if not observed_types:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no dishes parseable per table type",
            )

        # Build per-type Top N
        by_type: List[Dict[str, Any]] = []
        for t in observed_types:
            qc = qty_by_type[t]
            rc = rev_by_type[t]
            top = [
                {
                    "name": name,
                    "quantity": round(qty, 2),
                    "revenue": round(rc.get(name, 0.0), 2),
                }
                for name, qty in qc.most_common(_TOP_N_PER_TYPE)
            ]
            by_type.append({
                "table_type": t,
                "orders": orders_by_type[t],
                "distinct_dishes": len(qc),
                "top_dishes": top,
            })

        # Headline insight: compare top dish across types
        top_names_per_type = {t["table_type"]: t["top_dishes"][0]["name"] for t in by_type}
        sample_compare = ", ".join(
            f"{t}最爱「{n}」" for t, n in list(top_names_per_type.items())[:3]
        )
        insight_text = (
            f"共 {len(observed_types)} 种桌型参与分析："
            f"{sample_compare}。"
        )

        # ECharts horizontal grouped bar — each series = one table type,
        # x categories = union of top dishes (limited to 15 total labels)
        label_pool: List[str] = []
        for t in by_type:
            for d in t["top_dishes"]:
                if d["name"] not in label_pool:
                    label_pool.append(d["name"])
                if len(label_pool) >= 15:
                    break
            if len(label_pool) >= 15:
                break

        series = [
            {
                "name": t["table_type"],
                "type": "bar",
                "data": [
                    next((d["quantity"] for d in t["top_dishes"] if d["name"] == lbl), 0)
                    for lbl in label_pool
                ],
                "label": {"show": False},
            }
            for t in by_type
        ]

        chart_config = {
            "type": "bar",
            "title": {"text": "包厢/大厅/外卖 × 菜品销量", "left": "center"},
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
            "legend": {"top": 30, "data": [t["table_type"] for t in by_type]},
            "xAxis": {
                "type": "category",
                "data": label_pool,
                "axisLabel": {"rotate": 45, "interval": 0, "fontSize": 10},
            },
            "yAxis": {"type": "value", "name": "销售数量"},
            "series": series,
            "grid": {"left": "3%", "right": "8%", "bottom": "25%", "containLabel": True},
        }

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "by_type": by_type,
                "table_type_count": len(observed_types),
            },
            chart_config=chart_config,
            kpis={
                "table_type_count": len(observed_types),
                "top_table_type": by_type[0]["table_type"],
                "top_dish_in_top_type": by_type[0]["top_dishes"][0]["name"]
                    if by_type[0]["top_dishes"] else None,
            },
            insight_text=insight_text,
        )
