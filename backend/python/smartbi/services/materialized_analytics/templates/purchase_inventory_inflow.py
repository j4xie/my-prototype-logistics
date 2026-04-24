"""PurchaseInventoryInflow — 采购入库分析 (进销存-采购侧).

Triggered by uploads that look like a 采购入库明细报表 — rows tracking
raw material purchases: 供应商 / 原料 / 入库数量 / 金额 / 单据业务日期.

Answers Q-A #13 "商品进销存报表" partially — gives the 采购入库 side of
进销存. TRUE end-to-end 进销存 (期初 + 采购 - 销售 - 期末) requires:
  - ingredient-level sales consumption (POS 销量报表 has 菜品 sales not 原料)
  - opening/closing inventory snapshots
Neither is typically in the uploaded spreadsheet; we state this clearly
in the insight and deliver the 采购 view that IS available.

Outputs:
  - total 采购金额 / 采购笔数 / 原料种类数
  - top 供应商 by amount
  - top 原料 by amount + by quantity
  - trend by 单据业务日期
  - 店铺 concentration (if >1 store)

Applies when schema has both a 供应商 OR 入库仓库 column AND an amount-like
column (金额(元) / 金额 / 不含税金额(元)). Specifically designed not to
false-trigger on POS sales exports.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import polars as pl

from ..compute.base import ComputeBackend
from ..restaurant.pos_placeholders import POS_PRODUCT_PLACEHOLDERS, filter_placeholder_rows
from ..restaurant.schema_helpers import find_date_col, find_store_col
from ..schema import DataSchema, Domain
from .base import AnalysisTemplate, TemplateResult
from .registry import register

# Column candidates — purchase reports from different POS brands
_SUPPLIER_CANDIDATES = ("供应商", "来源供应商", "物料供应商")
_WAREHOUSE_CANDIDATES = ("入库仓库", "仓库", "入库仓")
_MATERIAL_NAME_CANDIDATES = ("原料名称", "物料", "商品名称", "物料名称", "原料")
_MATERIAL_CATEGORY_CANDIDATES = ("原料分类", "物料分类", "商品分类")
_QTY_CANDIDATES = ("入库数量", "原数量", "数量", "实际数量")
_AMOUNT_CANDIDATES = ("金额(元)", "金额", "不含税金额(元)", "原金额", "成本金额", "总额")
_STATUS_CANDIDATES = ("状态", "单据状态")
_TOP_N = 10


@register
class PurchaseInventoryInflow(AnalysisTemplate):

    sample_queries = [
        "采购入库分析",
        "进销存",
        "供应商分析",
        "原料采购金额",
        "入库汇总",
    ]

    @property
    def code(self) -> str:
        return "purchase_inventory_inflow"

    @property
    def title(self) -> str:
        return "采购入库分析 (进销存-采购侧)"

    def applies(self, schema: DataSchema) -> bool:
        names = {f.name for f in schema.fields}
        has_supplier = any(c in names for c in _SUPPLIER_CANDIDATES)
        has_warehouse = any(c in names for c in _WAREHOUSE_CANDIDATES)
        has_amount = any(c in names for c in _AMOUNT_CANDIDATES)
        has_material = any(c in names for c in _MATERIAL_NAME_CANDIDATES)
        # Require supplier/warehouse signal (rules out POS sales data) + amount + material
        return (has_supplier or has_warehouse) and has_amount and has_material

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        df = backend._df  # type: ignore[attr-defined]
        cols = set(df.columns)

        supplier_col = next((c for c in _SUPPLIER_CANDIDATES if c in cols), None)
        material_col = next((c for c in _MATERIAL_NAME_CANDIDATES if c in cols), None)
        material_cat_col = next((c for c in _MATERIAL_CATEGORY_CANDIDATES if c in cols), None)
        qty_col = next((c for c in _QTY_CANDIDATES if c in cols), None)
        amount_col = next((c for c in _AMOUNT_CANDIDATES if c in cols), None)
        status_col = next((c for c in _STATUS_CANDIDATES if c in cols), None)
        date_col = find_date_col(cols)  # 单据业务日期 / 日期 / ...
        store_col = find_store_col(cols)

        if amount_col is None or material_col is None:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="missing amount or material column",
            )

        amount_expr = pl.col(amount_col).cast(pl.Float64, strict=False).fill_null(0.0)
        qty_expr = pl.col(qty_col).cast(pl.Float64, strict=False).fill_null(0.0) if qty_col else None

        # Filter to 已收货 rows when status present (exclude cancelled/rejected)
        base = df
        if status_col:
            base = base.filter(
                pl.col(status_col).cast(pl.Utf8, strict=False).is_in(
                    ["已收货", "已入库", "已确认", "已完成"]
                )
                | pl.col(status_col).is_null()
            )

        total_rows = base.height
        total_amount = float(base.select(amount_expr.sum()).item() or 0.0)
        total_qty = float(base.select(qty_expr.sum()).item() or 0.0) if qty_expr is not None else None
        distinct_materials = base.select(pl.col(material_col).n_unique()).item() if material_col else None

        # Top suppliers
        top_suppliers: List[Dict[str, Any]] = []
        if supplier_col:
            rows = (
                base.filter(pl.col(supplier_col).is_not_null())
                .group_by(supplier_col)
                .agg([
                    amount_expr.sum().alias("amount"),
                    pl.len().alias("orders"),
                ])
                .sort("amount", descending=True)
                .head(_TOP_N)
                .to_dicts()
            )
            top_suppliers = [
                {
                    "supplier": str(r.get(supplier_col) or "<空>"),
                    "amount": round(float(r["amount"] or 0.0), 2),
                    "orders": int(r["orders"]),
                    "share_pct": round(float(r["amount"] or 0.0) / total_amount * 100, 2)
                        if total_amount > 0 else 0.0,
                }
                for r in rows
            ]

        # Top materials (by amount)
        top_materials_by_amount: List[Dict[str, Any]] = []
        agg_exprs = [amount_expr.sum().alias("amount"), pl.len().alias("orders")]
        if qty_expr is not None:
            agg_exprs.append(qty_expr.sum().alias("qty"))
        rows = (
            base.filter(pl.col(material_col).is_not_null())
            .group_by(material_col)
            .agg(agg_exprs)
            .sort("amount", descending=True)
            .head(_TOP_N)
            .to_dicts()
        )
        top_materials_by_amount = [
            {
                "material": str(r.get(material_col) or "<空>"),
                "amount": round(float(r["amount"] or 0.0), 2),
                "quantity": round(float(r.get("qty") or 0.0), 2) if qty_expr is not None else None,
                "orders": int(r["orders"]),
            }
            for r in rows
        ]
        # Apr 25 2026 D1.C4: drop POS-placeholder material names (打包盒/餐位费 etc.)
        top_materials_by_amount = filter_placeholder_rows(
            top_materials_by_amount, name_key="material",
            placeholders=POS_PRODUCT_PLACEHOLDERS,
        )

        # Top categories if present
        top_categories: List[Dict[str, Any]] = []
        if material_cat_col:
            rows = (
                base.filter(pl.col(material_cat_col).is_not_null())
                .group_by(material_cat_col)
                .agg([amount_expr.sum().alias("amount"), pl.len().alias("orders")])
                .sort("amount", descending=True)
                .head(_TOP_N)
                .to_dicts()
            )
            top_categories = [
                {
                    "category": str(r.get(material_cat_col) or "<空>"),
                    "amount": round(float(r["amount"] or 0.0), 2),
                    "orders": int(r["orders"]),
                    "share_pct": round(float(r["amount"] or 0.0) / total_amount * 100, 2)
                        if total_amount > 0 else 0.0,
                }
                for r in rows
            ]

        # Trend by date
        by_date: List[Dict[str, Any]] = []
        if date_col:
            # Slice to yyyy-mm-dd if the column has longer timestamp strings
            rows = (
                base.filter(pl.col(date_col).is_not_null())
                .with_columns(
                    pl.col(date_col).cast(pl.Utf8, strict=False).str.slice(0, 10).alias("_day")
                )
                .group_by("_day")
                .agg([amount_expr.sum().alias("amount"), pl.len().alias("orders")])
                .sort("_day")
                .to_dicts()
            )
            by_date = [
                {
                    "date": str(r.get("_day") or ""),
                    "amount": round(float(r["amount"] or 0.0), 2),
                    "orders": int(r["orders"]),
                }
                for r in rows
            ]

        # Per-store breakdown
        by_store: List[Dict[str, Any]] = []
        if store_col:
            rows = (
                base.filter(pl.col(store_col).is_not_null())
                .group_by(store_col)
                .agg([amount_expr.sum().alias("amount"), pl.len().alias("orders")])
                .sort("amount", descending=True)
                .head(_TOP_N)
                .to_dicts()
            )
            by_store = [
                {
                    "store": str(r.get(store_col) or "<空>"),
                    "amount": round(float(r["amount"] or 0.0), 2),
                    "orders": int(r["orders"]),
                }
                for r in rows
            ]

        # Build insight
        parts = [
            f"共 {total_rows} 笔采购入库，合计 {total_amount:,.0f} 元，"
            f"涵盖 {distinct_materials or 0} 种原料。"
        ]
        if top_suppliers:
            top_s = top_suppliers[0]
            parts.append(
                f"最大供应商:{top_s['supplier']} {top_s['amount']:,.0f} 元"
                f"(占 {top_s['share_pct']:.1f}%)。"
            )
        if top_materials_by_amount:
            top_m = top_materials_by_amount[0]
            qty_str = f"共 {top_m['quantity']:.0f} 件" if top_m['quantity'] is not None else ""
            parts.append(
                f"最大采购品类:{top_m['material']} {top_m['amount']:,.0f} 元{qty_str}。"
            )
        parts.append(
            "⚠ 真正 '商品进销存' 需要同步上传期末库存盘点或原料层销售消耗 — "
            "当前仅展示采购入库侧。"
        )
        insight_text = " ".join(parts)

        # ECharts — bar chart of top suppliers by amount
        chart_config = None
        if top_suppliers:
            chart_config = {
                "type": "bar",
                "title": {"text": "采购金额 × 供应商 Top", "left": "center"},
                "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
                "xAxis": {
                    "type": "category",
                    "data": [s["supplier"] for s in top_suppliers],
                    "axisLabel": {"rotate": 45, "interval": 0, "fontSize": 10},
                },
                "yAxis": {"type": "value", "name": "采购金额 (元)"},
                "series": [{
                    "name": "采购金额",
                    "type": "bar",
                    "data": [s["amount"] for s in top_suppliers],
                    "itemStyle": {"color": "#26a69a"},
                    "label": {"show": True, "position": "top"},
                }],
                "grid": {"left": "3%", "right": "8%", "bottom": "25%", "containLabel": True},
            }
        elif top_materials_by_amount:
            chart_config = {
                "type": "bar",
                "title": {"text": "采购金额 × 原料 Top", "left": "center"},
                "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
                "xAxis": {
                    "type": "category",
                    "data": [m["material"] for m in top_materials_by_amount],
                    "axisLabel": {"rotate": 45, "interval": 0, "fontSize": 10},
                },
                "yAxis": {"type": "value", "name": "采购金额 (元)"},
                "series": [{
                    "name": "采购金额",
                    "type": "bar",
                    "data": [m["amount"] for m in top_materials_by_amount],
                    "itemStyle": {"color": "#26a69a"},
                    "label": {"show": True, "position": "top"},
                }],
                "grid": {"left": "3%", "right": "8%", "bottom": "25%", "containLabel": True},
            }

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "total_amount": round(total_amount, 2),
                "total_rows": total_rows,
                "total_quantity": round(total_qty, 2) if total_qty is not None else None,
                "distinct_materials": distinct_materials,
                "top_suppliers": top_suppliers,
                "top_materials_by_amount": top_materials_by_amount,
                "top_categories": top_categories,
                "by_date": by_date,
                "by_store": by_store,
                "note": "仅采购入库侧分析。真正进销存需要期末库存盘点 + 原料销售消耗数据。",
            },
            chart_config=chart_config,
            kpis={
                "total_amount": round(total_amount, 2),
                "total_rows": total_rows,
                "distinct_materials": distinct_materials,
                "top_supplier": top_suppliers[0]["supplier"] if top_suppliers else None,
                "top_material": top_materials_by_amount[0]["material"] if top_materials_by_amount else None,
            },
            insight_text=insight_text,
        )
