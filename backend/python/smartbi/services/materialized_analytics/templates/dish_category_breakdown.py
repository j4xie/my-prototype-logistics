"""DishCategoryBreakdown — 菜品分类销售占比 (饮品/主菜/配菜/小吃/啤酒/...).

Parses 商品信息 text column row-by-row using item_parser, classifies each
dish into a category via classify_dish (KEYWORD/NAME-PREFIX inference, NOT
authoritative POS category data). Aggregates revenue and quantity per
inferred category and returns a pie chart.

⚠ Apr 25 2026 D1.C5: insight_text + KPIs explicitly label the breakdown
as 推断 (inferred). Original implementation presented "招牌菜贡献 34.9%" as
authoritative — but the upload had no real category dimension. Customer
deserves to know this is a heuristic so they can ask for a proper category
mapping if they need authoritative numbers.

Applies only when schema contains a 商品信息 field (restaurant-style data).
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Set

from ..compute.base import ComputeBackend
from ..restaurant.dish_classifier import classify_dish
from ..restaurant.dish_name_normalizer import normalize_dish_name
from ..restaurant.item_parser import parse_items
from ..schema import DataSchema, Domain
from .base import AnalysisTemplate, TemplateResult
from .registry import register

_SAMPLE_ROWS = 500_000


@register
class DishCategoryBreakdown(AnalysisTemplate):

    sample_queries = [
        "菜品品类分布",
        "各类别销售占比",
        "饮品主食比例",
        "小吃啤酒销量",
        "菜单品类结构",
        "哪个菜品类别卖得多",
        "哪类菜销量最高",
        "菜品类型对比",
        "品类销量排名",
        "主食饮品哪个更好卖",
    ]

    @property
    def code(self) -> str:
        return "dish_category_breakdown"

    @property
    def title(self) -> str:
        # Apr 25 2026 D1.C5: surface "推断分类" so user/AI know this is
        # name-prefix inference, not POS-supplied authoritative categories.
        return "菜品分类销售占比 (推断)"

    def applies(self, schema: DataSchema) -> bool:
        field_names = {f.name for f in schema.fields}
        return "商品信息" in field_names

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        series = backend._df.get_column("商品信息").head(_SAMPLE_ROWS)

        # category → {quantity: float, revenue: float, items: set of dish names}
        agg: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {"quantity": 0.0, "revenue": 0.0, "items": set()}
        )

        for raw_value in series.to_list():
            if not raw_value:
                continue
            items = parse_items(str(raw_value))
            for item in items:
                # Apr 24 2026: normalize variant suffixes so the
                # per-category 'items' set counts (一吃)/(二吃)/(大份)
                # variants as one distinct dish. Classification is run
                # against the normalized name (which still keeps the
                # discriminating prefix that classify_dish uses).
                name = normalize_dish_name(item["name"])
                category = classify_dish(name, item.get("is_signature", False))
                agg[category]["quantity"] += item["quantity"]
                agg[category]["revenue"] += item["total"]
                agg[category]["items"].add(name)

        if not agg:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False,
                skip_reason="no parseable dish items found in 商品信息",
            )

        total_revenue = sum(v["revenue"] for v in agg.values())

        # Build breakdown list, sorted by revenue descending
        breakdown: List[Dict[str, Any]] = sorted(
            [
                {
                    "category": cat,
                    "quantity": round(vals["quantity"], 2),
                    "revenue": round(vals["revenue"], 2),
                    "share_pct": round(vals["revenue"] / total_revenue * 100, 2)
                    if total_revenue > 0 else 0.0,
                    "item_count": len(vals["items"]),
                }
                for cat, vals in agg.items()
            ],
            key=lambda x: x["revenue"],
            reverse=True,
        )

        top_category = breakdown[0]["category"]
        top_share = breakdown[0]["share_pct"]

        top3_pct = sum(row["share_pct"] for row in breakdown[:3])
        total_item_count = sum(row["item_count"] for row in breakdown)

        # ECharts pie chart — category revenue share (inferred)
        chart_config = {
            "type": "pie",
            "title": {
                "text": "菜品分类收入占比 (推断分类)",
                "subtext": "基于菜品名前缀关键词,无原始类别字段",
                "left": "center",
            },
            "tooltip": {"trigger": "item", "formatter": "{b}: {c} 元 ({d}%)"},
            "legend": {"orient": "vertical", "left": "left"},
            "series": [
                {
                    "name": "营业额",
                    "type": "pie",
                    "radius": "60%",
                    "data": [
                        {"name": row["category"], "value": row["revenue"]}
                        for row in breakdown
                    ],
                    "label": {"formatter": "{b}: {d}%"},
                }
            ],
        }

        # Apr 25 2026 D1.C5: clearly label as inferred so the AI / FE can't
        # present this as authoritative. Real categories require a proper
        # POS export with a category column or a customer-supplied mapping.
        insight_text = (
            f"⚠ 推断分类 (基于菜品名前缀,无原始类别字段)。"
            f"{top_category} 贡献 {top_share:.1f}% 营收 (最大推断类目);"
            f"前 3 类合计 {top3_pct:.1f}%,"
            f"覆盖 {total_item_count} 个菜品。"
            f"如需精确分类,请上传含「商品类别」字段的明细表。"
        )

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "breakdown": breakdown,
                "total_revenue": round(total_revenue, 2),
                # Apr 25 2026 D1.C5: explicit flag for downstream (AI prompt /
                # FE label) to know these categories are inferred.
                "inferred": True,
                "inference_method": "name_prefix_keyword_match",
                "category_source": "推断 (菜品名前缀)",
            },
            chart_config=chart_config,
            kpis={
                "top_category": top_category,
                "top_category_share": top_share,
                "category_count": len(breakdown),
                "total_item_count": total_item_count,
                "inferred": True,
            },
            insight_text=insight_text,
        )
