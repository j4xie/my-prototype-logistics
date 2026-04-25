"""ComboUsageRate — 套餐使用率分析.

Two adaptive strategies depending on the upload shape:

Strategy A (order-level data with 商品信息 column — e.g., qhj 订单明细):
  - Each row = one order; 商品信息 lists the dishes in that order.
  - Scan dish names for 套餐 keyword.
  - combo_order_count = orders whose 商品信息 mentions 套餐
  - total_order_count = total non-null rows
  - usage_rate = combo_order_count / total_order_count
  - Top combos = Counter of 套餐 dish names across all orders.

Strategy B (dish-level data with 商品类型 column — e.g., qhj 销量报表):
  - Each row = one dish line.
  - Rows where 商品类型 contains 套餐 count as combo sales.
  - usage_rate = combo_rows / total_rows (sales-count share, not order share)
  - Top combos = aggregate by 商品名称.

If neither column is present → skip.
"""
from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List

import polars as pl

from ..compute.base import ComputeBackend
from ..restaurant.action_rec_formatter import format_action_rec, format_data_insufficient
from ..restaurant.dish_name_normalizer import normalize_dish_name
from ..restaurant.item_parser import parse_items
from ..restaurant.pos_placeholders import POS_PRODUCT_PLACEHOLDERS, filter_placeholder_rows
from ..schema import DataSchema, Domain
from .base import AnalysisTemplate, TemplateResult
from .registry import register

_ITEM_COL = "商品信息"
_DISH_TYPE_COL = "商品类型"
_DISH_NAME_COL = "商品名称"
_SAMPLE_ROWS = 500_000
_TOP_N = 10
_COMBO_KEYWORDS = ("套餐",)


@register
class ComboUsageRate(AnalysisTemplate):

    sample_queries = [
        "套餐使用率",
        "套餐销量",
        "多少客人点套餐",
        "套餐占比",
        "套餐数据",
    ]

    @property
    def code(self) -> str:
        return "combo_usage_rate"

    @property
    def title(self) -> str:
        return "套餐使用率"

    def applies(self, schema: DataSchema) -> bool:
        field_names = {f.name for f in schema.fields}
        if schema.domain not in (Domain.RESTAURANT, Domain.UNKNOWN):
            return False
        return _ITEM_COL in field_names or _DISH_TYPE_COL in field_names

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        df = backend._df  # type: ignore[attr-defined]
        cols = set(df.columns)

        # Prefer Strategy A (order-level) when 商品信息 is available
        if _ITEM_COL in cols:
            return self._strategy_order_level(df)
        if _DISH_TYPE_COL in cols:
            return self._strategy_dish_level(df)

        return TemplateResult(
            code=self.code, title=self.title, data={},
            applies=False, skip_reason="neither 商品信息 nor 商品类型 in schema",
        )

    # ── Strategy A: order-level (商品信息) ──────────────────────────────────────

    def _strategy_order_level(self, df: "pl.DataFrame") -> TemplateResult:
        series = df.get_column(_ITEM_COL).head(_SAMPLE_ROWS)
        total_orders = 0
        combo_orders = 0
        combo_name_counter: Counter = Counter()
        combo_revenue: Counter = Counter()

        for raw in series.to_list():
            if raw is None:
                continue
            total_orders += 1
            text = str(raw)
            # Quick-reject if no combo keyword anywhere
            if not any(kw in text for kw in _COMBO_KEYWORDS):
                continue
            # Parse and inspect each item
            items = parse_items(text)
            order_has_combo = False
            for item in items:
                # Apr 24 2026: collapse SKU variants so combos differing
                # only by (大份)/(小份)/(单人份) merge in the Top-N combo
                # ranking. Keyword check uses raw name so we still detect
                # 套餐 inside the suffix should it ever appear there.
                raw_name = item["name"]
                if any(kw in raw_name for kw in _COMBO_KEYWORDS):
                    name = normalize_dish_name(raw_name)
                    combo_name_counter[name] += item["quantity"]
                    combo_revenue[name] += item["total"]
                    order_has_combo = True
            if order_has_combo:
                combo_orders += 1

        if total_orders == 0:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no rows with 商品信息 data",
            )

        usage_rate_pct = round(combo_orders / total_orders * 100, 2)
        top_combos: List[Dict[str, Any]] = [
            {
                "name": name,
                "quantity": round(qty, 2),
                "revenue": round(combo_revenue.get(name, 0.0), 2),
            }
            for name, qty in combo_name_counter.most_common(_TOP_N)
        ]

        if not top_combos:
            action_rec = format_action_rec(
                object_target=f"全 {total_orders} 笔订单 (套餐使用率 0%)",
                benefit_range="新设 2-3 款主打套餐可拉高客单价 5-12% + 加快出餐速度",
                prerequisite="梳理高频菜品组合 + 厨师长测算成本 + POS 上架套餐 SKU",
                timeline="本月内",
            )
            insight_text = (
                f"共 {total_orders} 笔订单，未检出含套餐的消费（使用率 0%）。 {action_rec}"
            )
        else:
            top = top_combos[0]
            # Spec §4.3: tune action depending on usage rate band
            if usage_rate_pct < 10:
                action_rec = format_action_rec(
                    object_target=f"套餐使用率仅 {usage_rate_pct:.1f}% (Top 1「{top['name']}」)",
                    benefit_range="主推位 + 服务员话术 + 限时优惠后,套餐渗透率提升至 15-25%,客单提升 3-7%",
                    prerequisite="POS 推荐位置顶 + 服务员推菜培训 + 套餐内容定期复盘",
                    timeline="本月内",
                )
            else:
                action_rec = format_action_rec(
                    object_target=f"Top 套餐「{top['name']}」 (已贡献 {top['revenue']:,.0f} 元)",
                    benefit_range="围绕 Top 1 套餐设计升级款 + 节假日限定可再拉销量 5-10%",
                    prerequisite="复盘 Top 1 套餐毛利 + 厨师长测试升级版本 + 上线 A/B 测试",
                    timeline="本月内",
                )
            insight_text = (
                f"共 {total_orders} 笔订单，{combo_orders} 笔含套餐消费，"
                f"套餐使用率 {usage_rate_pct:.1f}%。"
                f"Top 1 套餐：「{top['name']}」售出 {top['quantity']:.0f} 份，"
                f"贡献 {top['revenue']:,.0f} 元。 {action_rec}"
            )

        chart_config = {
            "type": "bar",
            "title": {"text": f"套餐 Top {len(top_combos)} 销量", "left": "center"},
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
            "xAxis": {
                "type": "category",
                "data": [c["name"] for c in top_combos],
                "axisLabel": {"rotate": 45, "interval": 0, "fontSize": 10},
            },
            "yAxis": [
                {"type": "value", "name": "销售数量", "position": "left"},
                {"type": "value", "name": "营业额 (元)", "position": "right"},
            ],
            "series": [
                {
                    "name": "销售数量",
                    "type": "bar",
                    "yAxisIndex": 0,
                    "data": [c["quantity"] for c in top_combos],
                },
                {
                    "name": "营业额",
                    "type": "bar",
                    "yAxisIndex": 1,
                    "data": [c["revenue"] for c in top_combos],
                },
            ],
            "legend": {"top": 30},
            "grid": {"left": "3%", "right": "8%", "bottom": "25%", "containLabel": True},
        }

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "strategy": "order_level",
                "total_orders": total_orders,
                "combo_orders": combo_orders,
                "usage_rate_pct": usage_rate_pct,
                "top_combos": top_combos,
            },
            chart_config=chart_config,
            kpis={
                "combo_orders": combo_orders,
                "total_orders": total_orders,
                "usage_rate_pct": usage_rate_pct,
                "top_combo_name": top_combos[0]["name"] if top_combos else None,
            },
            insight_text=insight_text,
        )

    # ── Strategy B: dish-level (商品类型) ───────────────────────────────────────

    def _strategy_dish_level(self, df: "pl.DataFrame") -> TemplateResult:
        sample = df.head(_SAMPLE_ROWS)
        total_rows = sample.height

        mask = (
            pl.col(_DISH_TYPE_COL)
            .cast(pl.Utf8, strict=False)
            .fill_null("")
            .str.contains("套餐")
        )
        combo_rows = sample.filter(mask)
        combo_count = combo_rows.height

        usage_rate_pct = round(combo_count / total_rows * 100, 2) if total_rows else 0.0

        top_combos: List[Dict[str, Any]] = []
        if _DISH_NAME_COL in combo_rows.columns and combo_count > 0:
            qty_col = None
            for c in ("数量(含套餐子商品)", "单卖数量(不含套餐子商品)", "销量", "数量"):
                if c in combo_rows.columns:
                    qty_col = c
                    break
            rev_col = None
            for c in ("销售金额", "折后金额", "实收"):
                if c in combo_rows.columns:
                    rev_col = c
                    break

            agg_exprs = [pl.len().alias("row_count")]
            if qty_col:
                agg_exprs.append(
                    pl.col(qty_col).cast(pl.Float64, strict=False).sum().alias("quantity")
                )
            if rev_col:
                agg_exprs.append(
                    pl.col(rev_col).cast(pl.Float64, strict=False).sum().alias("revenue")
                )

            # Apr 24 2026: collapse SKU variants (大份/小份/单人份) onto
            # a normalized name before group-by so the Top-N combo
            # ranking treats 招牌套餐(大份)/(小份) as one combo.
            _norm_col = "__dish_name_norm"
            combo_rows_norm = combo_rows.with_columns(
                pl.col(_DISH_NAME_COL)
                .cast(pl.Utf8, strict=False)
                .map_elements(normalize_dish_name, return_dtype=pl.Utf8)
                .alias(_norm_col)
            )
            grouped = (
                combo_rows_norm
                .group_by(_norm_col)
                .agg(agg_exprs)
                .sort(
                    "quantity" if qty_col else "row_count",
                    descending=True,
                )
                .head(_TOP_N)
                .to_dicts()
            )
            top_combos = [
                {
                    "name": str(r.get(_norm_col) or "<空>"),
                    "quantity": round(float(r.get("quantity") or 0.0), 2),
                    "revenue": round(float(r.get("revenue") or 0.0), 2),
                }
                for r in grouped
            ]
            # Apr 25 2026 D1.C4: filter POS-placeholder dish names that
            # sometimes appear in the 套餐 type column (defensive).
            top_combos = filter_placeholder_rows(
                top_combos, name_key="name",
                placeholders=POS_PRODUCT_PLACEHOLDERS,
            )

        insight_text = (
            f"共 {total_rows} 条商品销售记录，其中 {combo_count} 条为套餐（占 {usage_rate_pct:.1f}%）。"
        )
        if top_combos:
            top = top_combos[0]
            insight_text += (
                f" Top 1：「{top['name']}」售出 {top['quantity']:.0f} 份，"
                f"贡献 {top['revenue']:,.0f} 元。"
            )
            action_rec = format_action_rec(
                object_target=f"Top 套餐「{top['name']}」 ({top['revenue']:,.0f} 元)",
                benefit_range="主推位 + 限时优惠组合后,套餐销量 / 客单可提升 5-12%",
                prerequisite="POS 推荐位置顶 + 服务员推菜话术培训 + 节假日限定升级款",
                timeline="本月内",
            )
            insight_text += f" {action_rec}"
        else:
            action_rec = format_action_rec(
                object_target=f"商品记录 {total_rows} 条 (套餐占 {usage_rate_pct:.1f}%)",
                benefit_range="新设 2-3 款主打套餐可拉高套餐渗透率 5-15% + 客单提升 3-7%",
                prerequisite="高频菜品组合分析 + 厨师长成本测算 + POS 上架",
                timeline="本月内",
            )
            insight_text += f" {action_rec}"

        chart_config = {
            "type": "bar",
            "title": {"text": f"套餐 Top {len(top_combos)} 销量", "left": "center"},
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
            "xAxis": {
                "type": "category",
                "data": [c["name"] for c in top_combos],
                "axisLabel": {"rotate": 45, "interval": 0, "fontSize": 10},
            },
            "yAxis": {"type": "value", "name": "销售数量"},
            "series": [
                {
                    "name": "销售数量",
                    "type": "bar",
                    "data": [c["quantity"] for c in top_combos],
                    "label": {"show": True, "position": "top"},
                },
            ],
            "grid": {"left": "3%", "right": "8%", "bottom": "25%", "containLabel": True},
        } if top_combos else None

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "strategy": "dish_level",
                "total_rows": total_rows,
                "combo_rows": combo_count,
                "usage_rate_pct": usage_rate_pct,
                "top_combos": top_combos,
            },
            chart_config=chart_config,
            kpis={
                "combo_rows": combo_count,
                "total_rows": total_rows,
                "usage_rate_pct": usage_rate_pct,
                "top_combo_name": top_combos[0]["name"] if top_combos else None,
            },
            insight_text=insight_text,
        )
