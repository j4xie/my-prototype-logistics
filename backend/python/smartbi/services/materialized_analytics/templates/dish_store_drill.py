"""DishStoreDrill — 菜品 × 门店 Top 5 下钻 (全菜品, 非 query-scoped).

Pre-computes per-(菜品, 门店) 销量+营收, then surfaces Top N dishes by total
quantity AND for each top dish, which stores sold it most. Answers questions
like "招牌青花椒鱼哪家店卖得最多?" indirectly — user sees dish-by-store
matrix and can pick their dish of interest.

Because we can't query-scope (template cache is pre-computed, not per-query),
we output Top 10 dishes × Top 5 stores each = 50 cell matrix.

Applies when schema has 商品信息 + store_col.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any, ClassVar, Dict, List

from smartbi.capability.contract import RequiresSpec

from ..compute.base import ComputeBackend
from ..restaurant.action_rec_formatter import format_action_rec
from ..restaurant.dish_name_normalizer import normalize_dish_name
from ..restaurant.item_parser import parse_items
from ..restaurant.schema_helpers import find_store_col
from ..schema import DataSchema, Domain
from .base import AnalysisTemplate, TemplateResult
from .registry import register

_ITEM_COL = "商品信息"
_SAMPLE_ROWS = 500_000
_TOP_DISHES = 10
_TOP_STORES_PER_DISH = 5


@register
class DishStoreDrill(AnalysisTemplate):

    sample_queries = [
        "菜品在哪家店卖得多",
        "某道菜主销门店",
        "[菜名]哪家卖最好",
        "菜品门店下钻",
        "菜店交叉分析",
    ]

    # applies() requires 商品信息 (combo_string) + store_col (store_name).
    # Revenue/qty are parsed from the combo_string blob via parse_items, so
    # no separate revenue column is needed in the schema gate.
    requires: ClassVar[RequiresSpec | None] = RequiresSpec(
        all=["combo_string", "store_name"],
        description="菜品按店下钻 — 需 combo_string (商品信息 blob 含菜品+数量+金额) + store_name",
    )

    @property
    def code(self) -> str:
        return "dish_store_drill"

    @property
    def title(self) -> str:
        return "菜品 × 门店 下钻 (Top 10 菜品 × Top 5 门店)"

    def applies(self, schema: DataSchema) -> bool:
        if schema.domain not in (Domain.RESTAURANT, Domain.UNKNOWN):
            return False
        field_names = {f.name for f in schema.fields}
        return _ITEM_COL in field_names and find_store_col(field_names) is not None

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        df = backend._df  # type: ignore[attr-defined]
        store_col = find_store_col(df.columns)
        if store_col is None:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no store column",
            )
        if df.height > _SAMPLE_ROWS:
            df = df.head(_SAMPLE_ROWS)

        rows = df.select([_ITEM_COL, store_col]).to_dicts()

        # { dish_name: Counter(store → qty) }
        dish_store_qty: Dict[str, Counter] = defaultdict(Counter)
        dish_store_rev: Dict[str, Counter] = defaultdict(Counter)
        dish_total_qty: Counter = Counter()

        for row in rows:
            store = str(row.get(store_col) or "")
            if not store:
                continue
            raw = row.get(_ITEM_COL)
            if not raw:
                continue
            for item in parse_items(str(raw)):
                # Apr 24 2026: collapse variant suffixes so the dish-level
                # Top-N for the matrix treats 招牌青花椒鱼(一吃)/(二吃) as one.
                name = normalize_dish_name(item["name"])
                qty = item["quantity"]
                rev = item["total"]
                dish_store_qty[name][store] += qty
                dish_store_rev[name][store] += rev
                dish_total_qty[name] += qty

        if not dish_total_qty:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no parseable dishes",
            )

        top_dishes = dish_total_qty.most_common(_TOP_DISHES)
        drill: List[Dict[str, Any]] = []
        for dish_name, total_qty in top_dishes:
            store_rank = dish_store_qty[dish_name].most_common(_TOP_STORES_PER_DISH)
            top_store, top_store_qty = store_rank[0] if store_rank else ("—", 0)
            concentration = round(top_store_qty / total_qty * 100, 1) if total_qty else 0.0
            drill.append({
                "dish": dish_name,
                "total_quantity": round(total_qty, 2),
                "top_store": top_store,
                "top_store_quantity": round(top_store_qty, 2),
                "top_store_concentration_pct": concentration,
                "top_5_stores": [
                    {
                        "store": s,
                        "quantity": round(q, 2),
                        "revenue": round(dish_store_rev[dish_name].get(s, 0.0), 2),
                        "share_pct": round(q / total_qty * 100, 2) if total_qty else 0.0,
                    }
                    for s, q in store_rank
                ],
            })

        # Build insight: highlight top-3 dish × top-store
        parts = [f"分析 Top {len(drill)} 菜品各自的最畅销门店:"]
        for d in drill[:3]:
            parts.append(
                f"「{d['dish']}」头号销售 → {d['top_store']}"
                f"({d['top_store_quantity']:.0f} 份, "
                f"占该菜品 {d['top_store_concentration_pct']:.0f}%);"
            )
        # Spot store-dominance pattern: if same store tops multiple dishes, flag it
        top_stores_across_dishes = Counter(d["top_store"] for d in drill)
        repeater = top_stores_across_dishes.most_common(1)[0] if top_stores_across_dishes else None
        if repeater and repeater[1] >= 3:
            parts.append(
                f"🏆 「{repeater[0]}」拿下 {repeater[1]} 个菜品的头名,综合表现最突出。"
            )
        # Spec §4.3: drive top-dish × top-store concentration into store-level SOP transfer
        if drill and drill[0]["top_store_concentration_pct"] >= 30:
            top_d = drill[0]
            action_rec = format_action_rec(
                object_target=f"非「{top_d['top_store']}」门店的「{top_d['dish']}」",
                benefit_range=f"复制{top_d['top_store']}的备货+推菜 SOP 到其他门店,该菜跨店销量提升 10-20%",
                prerequisite=f"对标走访{top_d['top_store']} + 厨师长培训菜品话术 + 各店首屏推位调整",
                timeline="本月内",
            )
        else:
            action_rec = format_action_rec(
                object_target=f"Top {len(drill)} 菜品的跨店分布",
                benefit_range="头部菜品在末位门店再推一轮可拉高单店该菜销量 8-15%",
                prerequisite="按门店排查首屏推位 + 服务员推菜话术抽检",
                timeline="本月内",
            )
        insight_text = " ".join(parts) + " " + action_rec

        # ECharts: horizontal stacked bar, dishes on Y, stores as series
        store_universe: List[str] = []
        for d in drill:
            for s in d["top_5_stores"]:
                if s["store"] not in store_universe:
                    store_universe.append(s["store"])
                if len(store_universe) >= 8:
                    break

        chart_config = {
            "type": "bar",
            "title": {"text": "Top 菜品 × Top 门店 销量", "left": "center"},
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
            "legend": {"top": 30, "data": store_universe[:8]},
            "xAxis": {"type": "value", "name": "销量 (份)"},
            "yAxis": {
                "type": "category",
                "data": [d["dish"] for d in drill[::-1]],
                "axisLabel": {"fontSize": 10},
            },
            "series": [
                {
                    "name": s,
                    "type": "bar",
                    "stack": "total",
                    "data": [
                        next(
                            (st["quantity"] for st in d["top_5_stores"] if st["store"] == s),
                            0
                        )
                        for d in drill[::-1]
                    ],
                }
                for s in store_universe[:8]
            ],
            "grid": {"left": "3%", "right": "3%", "bottom": "8%", "containLabel": True},
        }

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "drill": drill,
                "dish_count_tracked": len(dish_total_qty),
            },
            chart_config=chart_config,
            kpis={
                "top_dish": drill[0]["dish"] if drill else None,
                "top_dish_top_store": drill[0]["top_store"] if drill else None,
                "top_dish_top_store_pct": drill[0]["top_store_concentration_pct"] if drill else None,
                "dominant_store": repeater[0] if repeater and repeater[1] >= 3 else None,
            },
            insight_text=insight_text,
        )
