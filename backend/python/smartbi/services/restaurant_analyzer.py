"""
Restaurant Analytics Service

Extracts structured analytics from restaurant POS data:
- Menu engineering quadrant (Star/Plow/Puzzle/Dog)
- Store comparison with outlier detection
- Category breakdown
- Combo/order method efficiency
- Discount alerts
- Dianping listing gap analysis

Extracted from InsightGenerator._compute_restaurant_context() into a standalone
service that returns structured JSON (not text) for dedicated restaurant dashboards.
"""
from __future__ import annotations

import logging
import math
import re
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from services.food_industry_detector import detect_food_sub_sector, detect_available_dimensions
from smartbi.api.benchmark import RESTAURANT_DINING_BENCHMARKS

logger = logging.getLogger(__name__)


def _sanitize_for_json(obj: Any) -> Any:
    """Recursively replace NaN/Infinity with None (invalid in JSON).
    Handles nested dicts, lists, and bare float values.
    """
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_for_json(v) for v in obj]
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    return obj


# Pre-compiled patterns (avoid re-compilation per call)
_SUMMARY_PATTERN = re.compile(r"^(合\s*计|小\s*计|总\s*计|汇\s*总)$")
_CJK_RE = re.compile(r"[\u4e00-\u9fff]")
_PRODUCT_COL_RE = re.compile(r"^product_\d+$", re.IGNORECASE)


# ── Semantic column role definitions ─────────────────────────
# Each role has multiple keyword variants (Chinese + English + abbreviations).
# _find_col tries substring match; order = priority (first match wins).

_COL_ROLE_KEYWORDS: Dict[str, List[str]] = {
    "store": [
        "门店名称", "门店", "店铺", "分店", "店名", "连锁店", "网点", "营业点",
        "outlet", "store", "branch", "shop", "location",
    ],
    "product": [
        "商品名称", "商品名", "菜品名称", "菜品", "菜名", "商品", "品名", "品项",
        "产品名称", "产品名", "产品", "品目", "SKU名称", "单品",
        "product", "item", "dish", "menu_item", "sku",
    ],
    "category": [
        "商品分类", "商品大类", "品类", "分类", "类别", "菜品分类", "大类",
        "小类", "二级分类", "一级分类", "品类名称",
        "category", "type", "class", "group",
    ],
    "order_method": [
        "点单方式", "下单方式", "渠道", "订单来源", "下单渠道", "销售渠道",
        "order_type", "channel", "source",
    ],
    "qty_single": [
        "单卖数量", "销售数量", "出售数量", "销售量",
        "件数", "份数", "杯数",
        "quantity", "qty", "sold",
    ],
    "qty_combo": [
        "套餐内销量", "套餐数量", "套餐销量", "combo_qty",
    ],
    "amount": [
        "销售金额", "销售额", "总金额", "金额", "营收", "总额", "收入",
        "应收", "原价金额", "含税金额",
        "amount", "sales", "revenue", "total",
    ],
    "actual": [
        "实收", "实收金额", "实际收入", "实际金额", "净收入", "到账",
        "折后金额", "结算金额", "实际营收",
        "net_amount", "actual", "settled",
    ],
    "return_qty": [
        "退货数量", "退款数量", "退菜数量", "退单量",
        "refund", "return",
    ],
    "date": [
        "日期", "交易日期", "订单日期", "销售日期", "消费日期", "业务日期",
        "营业日期", "账单日期", "记录日期",
        "时间", "订单时间", "交易时间", "消费时间", "下单时间", "创建时间",
        "date", "time", "datetime", "order_date", "created_at",
    ],
    "supplier": [
        "供应商", "供应商名称", "供货商", "进货商", "采购来源", "vendor",
        "supplier", "provider",
    ],
    "ingredient": [
        "原料名称", "原料", "食材", "物料", "原材料", "配料",
        "ingredient", "material", "raw_material",
    ],
    "inbound_qty": [
        "入库数量", "进货数量", "采购数量", "到货数量", "收货数量",
        "inbound_qty", "purchase_qty",
    ],
    "inbound_cost": [
        "入库金额", "采购金额", "进货金额", "采购成本", "进货成本",
        "purchase_amount", "cost",
    ],
}

# Java upload renames Chinese columns to product_N, category, revenue, etc.
_RENAMED_COL_SEMANTICS = {
    "product_2": "product",
    "product_3": "category",
    "category": "category",
}

# Columns that Java auto-creates as placeholders (often empty or misused).
# Skip these during keyword matching; only use via _detect_renamed_col.
_JAVA_PLACEHOLDER_COLS = {"product", "revenue", "category"}


def _find_col(cols: Dict[str, str], *candidates: str) -> Optional[str]:
    """Find a column by partial name match against candidate keywords."""
    for cand in candidates:
        for raw in cols:
            if cand in raw:
                return cols[raw]
    return None


def _find_col_by_role(cols: Dict[str, str], role: str, df: Optional[pd.DataFrame] = None) -> Optional[str]:
    """Find a column matching a semantic role using expanded keyword list.
    Skips Java placeholder columns and validates data is non-empty.
    """
    keywords = _COL_ROLE_KEYWORDS.get(role, [])
    if not keywords:
        return None

    def _is_valid(col_name: str) -> bool:
        """Check that column is not a Java placeholder or all-null."""
        if col_name in _JAVA_PLACEHOLDER_COLS:
            return False
        if df is not None and col_name in df.columns:
            # Skip columns that are >90% null/empty
            non_null = df[col_name].dropna()
            if len(non_null) == 0:
                return False
            non_empty = non_null[non_null.astype(str).str.strip() != ""]
            if len(non_empty) / len(df) < 0.1:
                return False
        return True

    # Exact match first (higher confidence)
    cols_lower = {raw.strip().lower(): raw for raw in cols}
    for kw in keywords:
        kw_lower = kw.lower()
        if kw_lower in cols_lower:
            raw = cols_lower[kw_lower]
            actual_col = cols[raw]
            if _is_valid(raw):
                return actual_col

    # Substring match (broader)
    for kw in keywords:
        for raw in cols:
            if kw in raw and _is_valid(raw):
                return cols[raw]

    return None


def _detect_renamed_col(df: pd.DataFrame, role: str) -> Optional[str]:
    """Detect a column by its Java-renamed alias."""
    for col_name, sem_role in _RENAMED_COL_SEMANTICS.items():
        if sem_role == role and col_name in df.columns:
            return col_name
    return None


def _detect_qty_col(df: pd.DataFrame, exclude_cols: set) -> Optional[str]:
    """Find a numeric integer column that looks like quantity (product_N pattern)."""
    candidates = [c for c in df.columns if _PRODUCT_COL_RE.match(c.strip()) and c not in exclude_cols]
    for c in candidates:
        try:
            vals = pd.to_numeric(df[c], errors="coerce").dropna()
            if len(vals) > 10 and 0 < vals.median() < 10000:
                if (vals == vals.astype(int)).mean() > 0.8:
                    return c
        except Exception:
            pass
    return None


def _detect_col_by_data_type(df: pd.DataFrame, role: str, exclude_cols: set) -> Optional[str]:
    """
    Last-resort detection: infer column role from data characteristics.
    Works when column names are opaque (product_1, col_A, etc.).
    """
    remaining = [c for c in df.columns if c not in exclude_cols]

    if role == "date":
        # Find columns that parse as datetime
        for c in remaining:
            if c in _JAVA_PLACEHOLDER_COLS:
                continue
            non_null = df[c].dropna()
            if len(non_null) < 5:
                continue
            sample = non_null.head(30)
            try:
                parsed = pd.to_datetime(sample, errors="coerce")
                if parsed.notna().mean() > 0.7:
                    return c
            except Exception:
                pass

    elif role == "product":
        # Find text columns with high cardinality and Chinese characters
        for c in remaining:
            sample = df[c].dropna().head(50)
            if len(sample) < 5:
                continue
            str_vals = sample.astype(str)
            has_cjk = str_vals.str.contains(_CJK_RE).mean() > 0.3
            cardinality = sample.nunique() / len(sample) if len(sample) > 0 else 0
            if has_cjk and cardinality > 0.1:
                return c

    elif role == "category":
        # Find text columns with LOW cardinality (few categories)
        for c in remaining:
            sample = df[c].dropna().head(100)
            if len(sample) < 5:
                continue
            str_vals = sample.astype(str)
            has_cjk = str_vals.str.contains(_CJK_RE).mean() > 0.3
            cardinality = sample.nunique()
            if has_cjk and 2 <= cardinality <= 30:
                return c

    elif role in ("amount", "actual"):
        # Find numeric columns with large values (monetary)
        for c in remaining:
            try:
                vals = pd.to_numeric(df[c], errors="coerce").dropna()
                if len(vals) < 10:
                    continue
                # Monetary: typically > 1, mean > 10, has decimals
                if vals.mean() > 10 and vals.max() > 50:
                    decimal_pct = (vals != vals.astype(int)).mean()
                    if decimal_pct > 0.05:  # Has decimal values → likely money
                        return c
            except Exception:
                pass

    elif role == "store":
        # Find text columns with moderate cardinality (store names)
        for c in remaining:
            sample = df[c].dropna().head(100)
            if len(sample) < 5:
                continue
            str_vals = sample.astype(str)
            has_cjk = str_vals.str.contains(_CJK_RE).mean() > 0.3
            cardinality = sample.nunique()
            # Store: between category (few) and product (many)
            if has_cjk and 2 <= cardinality <= 200:
                # Check if values look like store names (contain 店/分/号/路)
                store_like = str_vals.str.contains(r"店|分店|号店|路|广场|商场|中心", na=False).mean()
                if store_like > 0.1:
                    return c

    return None


class RestaurantAnalyzer:
    """Compute structured restaurant analytics from a DataFrame."""

    def analyze(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Main entry point. Returns structured analytics result dict.
        Keys: menuQuadrant, storeComparison, categoryBreakdown,
              comboEfficiency, discountAlerts, dianpingGaps, benchmarksUsed

        Column detection uses 3 layers:
        1. Expanded keyword matching (100+ Chinese/English variants per role)
        2. Java-renamed column aliases (product_N → semantic role)
        3. Data-type inference (datetime detection, cardinality-based text role, etc.)
        """
        cols = {c.strip(): c for c in df.columns}

        # Layer 1: keyword-based detection (broadest keyword list, skips Java placeholders)
        store_col = _find_col_by_role(cols, "store", df)
        product_col = _find_col_by_role(cols, "product", df)
        category_col = _find_col_by_role(cols, "category", df)
        order_method_col = _find_col_by_role(cols, "order_method", df)
        qty_combo_col = _find_col_by_role(cols, "qty_combo", df)  # Detect combo first (more specific)
        qty_single_col = _find_col_by_role(cols, "qty_single", df)
        amount_col = _find_col_by_role(cols, "amount", df)
        actual_col = _find_col_by_role(cols, "actual", df)
        return_col = _find_col_by_role(cols, "return_qty", df)
        date_col = _find_col_by_role(cols, "date", df)
        supplier_col = _find_col_by_role(cols, "supplier", df)
        ingredient_col = _find_col_by_role(cols, "ingredient", df)
        inbound_qty_col = _find_col_by_role(cols, "inbound_qty", df)
        inbound_cost_col = _find_col_by_role(cols, "inbound_cost", df)

        # Layer 2: Java-renamed column aliases
        if not product_col:
            product_col = _detect_renamed_col(df, "product")
        if not category_col:
            category_col = _detect_renamed_col(df, "category")

        # Layer 3: data-type inference (last resort for opaque column names)
        assigned = {c for c in (store_col, product_col, category_col, order_method_col,
                                qty_single_col, qty_combo_col, amount_col, actual_col,
                                return_col, date_col, supplier_col, ingredient_col,
                                inbound_qty_col, inbound_cost_col) if c}

        if not date_col:
            date_col = _detect_col_by_data_type(df, "date", assigned)
            if date_col:
                assigned.add(date_col)
        if not product_col:
            product_col = _detect_col_by_data_type(df, "product", assigned)
            if product_col:
                assigned.add(product_col)
        if not product_col:
            product_col = self._fallback_product_col(df, cols)
            if product_col:
                assigned.add(product_col)
        if not category_col:
            category_col = _detect_col_by_data_type(df, "category", assigned)
            if category_col:
                assigned.add(category_col)
        if not store_col:
            store_col = _detect_col_by_data_type(df, "store", assigned)
            if store_col:
                assigned.add(store_col)
        if not actual_col and not amount_col:
            detected_money = _detect_col_by_data_type(df, "amount", assigned)
            if detected_money:
                actual_col = detected_money
                assigned.add(detected_money)
        if not qty_single_col:
            exclude = {c for c in (product_col, category_col) if c} | assigned
            qty_single_col = _detect_qty_col(df, exclude)

        # If actual_col is still missing, fall back to amount_col
        if not actual_col and amount_col:
            actual_col = amount_col

        logger.info(f"Restaurant columns detected: store={store_col}, product={product_col}, "
                     f"category={category_col}, qty={qty_single_col}, "
                     f"amount={amount_col}, actual={actual_col}, date={date_col}")

        # Work on a copy to avoid mutating caller's DataFrame
        df = df.copy()

        # Coerce numeric columns — track fillna(0) conversions for data quality
        data_quality_warnings: list[str] = []
        for nc in [actual_col, amount_col, qty_single_col, qty_combo_col, return_col]:
            if nc and nc in df.columns:
                before_na = df[nc].isna().sum() + (pd.to_numeric(df[nc], errors="coerce").isna().sum() - df[nc].isna().sum())
                df[nc] = pd.to_numeric(df[nc], errors="coerce").fillna(0)
                if before_na > 0:
                    pct = before_na / len(df) * 100
                    if pct >= 5:
                        data_quality_warnings.append(
                            f"列「{nc}」有 {before_na} 行({pct:.1f}%)非数值数据已填充为0"
                        )

        # Filter out summary/total rows (合计, 小计, 总计, etc.)
        # Combine masks from all columns, then filter once (avoids intermediate DataFrames)
        summary_mask = pd.Series(False, index=df.index)
        for col in [store_col, product_col, category_col]:
            if col and col in df.columns:
                summary_mask |= df[col].astype(str).str.strip().str.match(_SUMMARY_PATTERN)
        if summary_mask.any():
            logger.info(f"Filtered {summary_mask.sum()} summary rows")
            df = df[~summary_mask]

        # Detect sub-sector for benchmark selection
        sample_data = df.head(20).to_dict("records") if len(df) > 0 else None
        sub_sector = detect_food_sub_sector(df.columns.tolist(), sample_data) or "餐饮连锁"

        # Detect store count for adaptive analysis
        store_count = 0
        if store_col and store_col in df.columns:
            store_count = df[store_col].nunique()
        analysis_mode = "chain" if store_count >= 3 else "single"

        quadrant = self._menu_quadrant(df, product_col, actual_col, qty_single_col)
        # profitMedian is actually unit_price median (no cost data → not true profit)
        price_median = quadrant.get("profitMedian", 0)

        # Pre-compute store discount rates (shared by _store_comparison and _discount_alerts)
        store_disc_df = None
        if store_col and amount_col and actual_col and amount_col in df.columns:
            store_disc_df = df.groupby(store_col).agg(
                gross=pd.NamedAgg(column=amount_col, aggfunc="sum"),
                net=pd.NamedAgg(column=actual_col, aggfunc="sum"),
            ).reset_index()
            store_disc_df["discountPct"] = ((1 - store_disc_df["net"] / store_disc_df["gross"].replace(0, 1)) * 100).clip(0, 100)

        ops_metrics = self._operations_metrics(df, product_col, actual_col, return_col, price_median, sub_sector)
        platform_readiness = self._platform_readiness(ops_metrics, sub_sector)

        # Add store count + analysis mode metadata
        ops_metrics["storeCount"] = store_count
        ops_metrics["analysisMode"] = analysis_mode

        result: Dict[str, Any] = {
            "menuQuadrant": quadrant,
            "storeComparison": self._store_comparison(df, store_col, actual_col, store_disc_df, store_count),
            "categoryBreakdown": self._category_breakdown(df, category_col, actual_col),
            "comboEfficiency": self._combo_efficiency(df, order_method_col, actual_col),
            "discountAlerts": self._discount_alerts(store_col, store_disc_df),
            # Legacy key preserved for backward compatibility
            "dianpingGaps": ops_metrics,
            # New split structure
            "operationsMetrics": ops_metrics,
            "platformReadiness": platform_readiness,
            "benchmarksUsed": sub_sector,
        }

        # Data quality warnings
        if data_quality_warnings:
            result["dataQualityWarnings"] = data_quality_warnings

        # Phase C: additional analysis dimensions (optional — only when data supports it)
        price_band = self._price_band_analysis(df, product_col, actual_col, qty_single_col, sub_sector)
        if price_band:
            result["priceBandAnalysis"] = price_band

        cat_conc = self._category_concentration(df, category_col, actual_col)
        if cat_conc:
            result["categoryConcentration"] = cat_conc

        store_eff = self._store_efficiency_matrix(df, store_col, product_col, actual_col)
        if store_eff:
            result["storeEfficiencyMatrix"] = store_eff

        # Supply chain / traceability linkage (when procurement data present)
        supply_chain = self._supply_chain_analysis(
            df, supplier_col, ingredient_col, inbound_qty_col, inbound_cost_col,
            product_col, actual_col, category_col,
        )
        if supply_chain:
            result["supplyChainAnalysis"] = supply_chain

        # Trend analysis (when date column present)
        trend = self._trend_analysis(df, date_col, actual_col, store_col)
        if trend:
            result["trendAnalysis"] = trend

        # Time period analysis (hourly heatmap + meal periods — needs time component in date column)
        time_period = self._time_period_analysis(df, date_col, actual_col, store_col)
        if time_period:
            result["timePeriodAnalysis"] = time_period

        # Dimension hints — tell frontend which conditional dimensions are available/missing
        result["dimensionHints"] = detect_available_dimensions(
            df.columns.tolist(),
            has_date=date_col is not None,
            has_store=store_col is not None,
            has_category=category_col is not None,
            has_procurement=supplier_col is not None and (inbound_qty_col is not None or inbound_cost_col is not None),
        )

        # Sanitize NaN/Infinity → None (prevents invalid JSON responses)
        return _sanitize_for_json(result)

    # ── Menu Engineering Quadrant ──────────────────────────────────

    def _menu_quadrant(
        self, df: pd.DataFrame,
        product_col: Optional[str], actual_col: Optional[str],
        qty_single_col: Optional[str],
    ) -> Dict[str, Any]:
        empty = {"items": [], "qtyMedian": 0, "profitMedian": 0,
                 "summary": {"starCount": 0, "plowCount": 0, "puzzleCount": 0, "dogCount": 0}}
        if not product_col or not actual_col:
            return empty

        qty_col = qty_single_col
        if qty_col:
            item_df = df.groupby(product_col).agg(
                total_revenue=pd.NamedAgg(column=actual_col, aggfunc="sum"),
                total_qty=pd.NamedAgg(column=qty_col, aggfunc="sum"),
            ).reset_index()
        else:
            item_df = df.groupby(product_col).agg(
                total_revenue=pd.NamedAgg(column=actual_col, aggfunc="sum"),
                total_qty=pd.NamedAgg(column=actual_col, aggfunc="count"),
            ).reset_index()

        item_df = item_df[item_df["total_qty"] > 0].copy()
        if len(item_df) == 0:
            return empty

        # unit_price per SKU (revenue / qty) — NOT profit (no cost data available)
        # API key kept as "unitProfit" / "profitMedian" for backward compatibility
        item_df["unit_price"] = item_df["total_revenue"] / item_df["total_qty"]
        qty_median = float(item_df["total_qty"].median())
        price_median = float(item_df["unit_price"].median())

        # Vectorized quadrant assignment (no row-by-row apply)
        high_qty = item_df["total_qty"] >= qty_median
        high_profit = item_df["unit_price"] >= price_median
        item_df["quadrant"] = np.select(
            [high_qty & high_profit, high_qty, high_profit],
            ["Star", "Plow", "Puzzle"],
            default="Dog",
        )

        # Vectorized dict construction (no iterrows)
        items = [
            {
                "name": str(name),
                "quadrant": quad,
                "revenue": round(float(rev), 2),
                "quantity": round(float(qty), 0),
                "unitProfit": round(float(up), 2),
            }
            for name, quad, rev, qty, up in zip(
                item_df[product_col],
                item_df["quadrant"],
                item_df["total_revenue"],
                item_df["total_qty"],
                item_df["unit_price"],
            )
        ]

        quad_counts = item_df["quadrant"].value_counts()
        summary = {
            "starCount": int(quad_counts.get("Star", 0)),
            "plowCount": int(quad_counts.get("Plow", 0)),
            "puzzleCount": int(quad_counts.get("Puzzle", 0)),
            "dogCount": int(quad_counts.get("Dog", 0)),
        }

        return {
            "items": items,
            "qtyMedian": round(qty_median, 1),
            "profitMedian": round(price_median, 2),
            "summary": summary,
        }

    # ── Store Comparison ───────────────────────────────────────────

    def _store_comparison(
        self, df: pd.DataFrame,
        store_col: Optional[str], actual_col: Optional[str],
        store_disc_df: Optional[pd.DataFrame] = None,
        store_count: int = 0,
    ) -> Dict[str, Any]:
        empty = {"stores": [], "weakStores": [], "medianRevenue": 0}
        if not store_col or not actual_col:
            return empty

        store_df = df.groupby(store_col).agg(
            revenue=pd.NamedAgg(column=actual_col, aggfunc="sum"),
            orderCount=pd.NamedAgg(column=actual_col, aggfunc="count"),
        ).reset_index().sort_values("revenue", ascending=False)

        # Compute avg ticket
        store_df["avgTicket"] = store_df["revenue"] / store_df["orderCount"].replace(0, 1)

        # Merge pre-computed discount rates
        if store_disc_df is not None:
            store_df = store_df.merge(store_disc_df[[store_col, "discountPct"]], on=store_col, how="left")
        else:
            store_df["discountPct"] = 0.0

        median_rev = float(store_df["revenue"].median())
        # Adaptive weak store threshold: stricter for larger chains
        if store_count >= 10:
            weak_threshold = 0.4  # Large chains: flag stores below 40% of median
        elif store_count >= 3:
            weak_threshold = 0.5  # Small chains: standard 50%
        else:
            weak_threshold = 0.3  # Single/duo stores: more lenient
        weak_stores = store_df[store_df["revenue"] < median_rev * weak_threshold][store_col].tolist()[:10]

        stores = [
            {
                "name": str(name),
                "revenue": round(float(rev), 2),
                "orderCount": int(oc),
                "avgTicket": round(float(at), 2),
                "discountPct": round(float(dp), 1),
            }
            for name, rev, oc, at, dp in zip(
                store_df[store_col],
                store_df["revenue"],
                store_df["orderCount"],
                store_df["avgTicket"],
                store_df["discountPct"],
            )
        ]

        return {
            "stores": stores,
            "weakStores": weak_stores,
            "medianRevenue": round(median_rev, 2),
        }

    # ── Category Breakdown ─────────────────────────────────────────

    def _category_breakdown(
        self, df: pd.DataFrame,
        category_col: Optional[str], actual_col: Optional[str],
    ) -> List[Dict[str, Any]]:
        if not category_col or not actual_col:
            return []

        cat_df = df.groupby(category_col).agg(
            revenue=pd.NamedAgg(column=actual_col, aggfunc="sum"),
        ).reset_index().sort_values("revenue", ascending=False)

        total_rev = cat_df["revenue"].sum()
        if total_rev <= 0:
            return []

        return [
            {
                "category": str(cat),
                "revenue": round(float(rev), 2),
                "pct": round(float(rev) / total_rev * 100, 1),
            }
            for cat, rev in zip(cat_df[category_col], cat_df["revenue"])
        ]

    # ── Combo / Order Method Efficiency ────────────────────────────

    def _combo_efficiency(
        self, df: pd.DataFrame,
        order_method_col: Optional[str], actual_col: Optional[str],
    ) -> Dict[str, Any]:
        if not order_method_col or not actual_col:
            return {"methods": []}

        combo_df = df.groupby(order_method_col).agg(
            revenue=pd.NamedAgg(column=actual_col, aggfunc="sum"),
            count=pd.NamedAgg(column=actual_col, aggfunc="count"),
        ).reset_index()

        total_rev = combo_df["revenue"].sum()
        if total_rev <= 0:
            return {"methods": []}

        methods = [
            {
                "method": str(m),
                "revenue": round(float(rev), 2),
                "pct": round(float(rev) / total_rev * 100, 1),
                "count": int(cnt),
            }
            for m, rev, cnt in zip(
                combo_df[order_method_col], combo_df["revenue"], combo_df["count"]
            )
        ]
        return {"methods": methods}

    # ── Discount Alerts ────────────────────────────────────────────

    def _discount_alerts(
        self,
        store_col: Optional[str],
        store_disc_df: Optional[pd.DataFrame] = None,
    ) -> List[Dict[str, Any]]:
        if not store_col or store_disc_df is None:
            return []

        alerts = store_disc_df[store_disc_df["discountPct"] > 20].sort_values("discountPct", ascending=False).head(10)
        return [
            {"store": str(s), "discountPct": round(float(d), 1)}
            for s, d in zip(alerts[store_col], alerts["discountPct"])
        ]

    # ── Operations Metrics (经营数据分析) ──────────────────────────

    def _operations_metrics(
        self, df: pd.DataFrame,
        product_col: Optional[str], actual_col: Optional[str],
        return_col: Optional[str],
        price_median: float = 0,
        sub_sector: str = "餐饮连锁",
    ) -> Dict[str, Any]:
        avg_ticket_cfg = RESTAURANT_DINING_BENCHMARKS.get("metrics", {}).get("average_ticket", {})
        sub_sectors = avg_ticket_cfg.get("sub_sectors", {})
        if sub_sector in sub_sectors:
            benchmark_median = sub_sectors[sub_sector]["median"]
        else:
            benchmark_median = avg_ticket_cfg.get("median", 75)

        metrics: Dict[str, Any] = {
            "signatureConcentration": 0,
            "returnRate": 0,
            "priceVsBenchmark": {"actual": 0, "benchmarkMedian": benchmark_median},
            "consistencyScore": 0,
        }
        if not product_col or not actual_col:
            return metrics

        item_rev = df.groupby(product_col)[actual_col].sum().sort_values(ascending=False)
        total_rev = item_rev.sum()
        if total_rev > 0:
            top3_pct = float(item_rev.head(3).sum() / total_rev * 100)
            metrics["signatureConcentration"] = round(top3_pct, 1)

        if return_col and return_col in df.columns:
            total_returns = df[return_col].sum()
            total_qty = df[actual_col].count()
            if total_qty > 0:
                metrics["returnRate"] = round(float(total_returns / total_qty * 100), 2)

        if price_median > 0:
            metrics["priceVsBenchmark"]["actual"] = round(float(price_median), 2)

        if len(item_rev) > 5:
            cv = float(item_rev.std() / max(item_rev.mean(), 1))
            consistency = max(0, min(100, 100 - cv * 10))
            metrics["consistencyScore"] = round(consistency, 1)

        return metrics

    # ── Platform Readiness (平台运营分析) ─────────────────────────

    def _platform_readiness(
        self, ops: Dict[str, Any], sub_sector: str = "餐饮连锁",
    ) -> Dict[str, Any]:
        """Evaluate readiness for Dianping/Meituan platform listing.
        Based on operations metrics, produce pass/fail checklist items.
        """
        benchmark_median = ops.get("priceVsBenchmark", {}).get("benchmarkMedian", 75)
        actual_price = ops.get("priceVsBenchmark", {}).get("actual", 0)
        sig_conc = ops.get("signatureConcentration", 0)
        return_rate = ops.get("returnRate", 0)
        consistency = ops.get("consistencyScore", 0)

        checks: List[Dict[str, Any]] = [
            {
                "key": "taste_quality",
                "label": "口味优中选优",
                "pass": consistency > 50,
                "detail": "稳定性评分 %d/100，出品稳定" % int(consistency) if consistency > 50
                    else "出品稳定性不足，需加强品控",
                "source": "data",
            },
            {
                "key": "long_term_operation",
                "label": "长期稳定经营 (365天+)",
                "pass": None,
                "detail": "需人工确认：营业时间是否满365天、182天以上正常营业",
                "source": "manual",
            },
            {
                "key": "daily_consumption",
                "label": "日常消费水平",
                "pass": actual_price <= benchmark_median * 0.3 if actual_price > 0 else None,
                "detail": "品均价 ¥%d（客单价约 ¥%d 参考）" % (int(actual_price), int(benchmark_median)),
                "source": "data",
            },
            {
                "key": "review_authentic",
                "label": "评价真实 (无刷单)",
                "pass": None,
                "detail": "需人工确认：点评平台无刷评记录",
                "source": "manual",
            },
            {
                "key": "food_safety",
                "label": "食品安全合规",
                "pass": None,
                "detail": "需人工确认：证照齐全、无食安投诉",
                "source": "manual",
            },
            {
                "key": "signature_dish",
                "label": "招牌菜鲜明",
                "pass": sig_conc > 25,
                "detail": "Top 3 集中度 %.1f%%，%s" % (sig_conc, "有明确招牌菜" if sig_conc > 25 else "缺乏明确招牌菜"),
                "source": "data",
            },
            {
                "key": "return_rate_ok",
                "label": "退货率可控",
                "pass": return_rate < 3,
                "detail": "退货率 %.2f%%%s" % (return_rate, "" if return_rate < 3 else "，需降低退货"),
                "source": "data",
            },
            {
                "key": "menu_diversity",
                "label": "菜品丰富度",
                "pass": sig_conc < 60,
                "detail": "Top 3 集中度 %.1f%%，%s" % (sig_conc, "品类分布合理" if sig_conc < 60 else "过度依赖少数单品"),
                "source": "data",
            },
            {
                "key": "price_competitiveness",
                "label": "价格竞争力",
                "pass": actual_price <= benchmark_median * 0.3 if actual_price > 0 else None,
                "detail": "品均价 ¥%d，客单价参考 ¥%d，%s" % (
                    int(actual_price), int(benchmark_median),
                    "定价合理" if actual_price <= benchmark_median * 0.3 else "品均价偏高",
                ) if actual_price > 0 else "暂无价格数据",
                "source": "data" if actual_price > 0 else "manual",
            },
            {
                "key": "repeat_customer",
                "label": "回头客潜力 (复购率)",
                "pass": None,
                "detail": "需人工确认：30天内二次消费比例（回头客榜门槛：总评>=50）",
                "source": "manual",
            },
        ]

        data_checks = [c for c in checks if c["source"] == "data" and c["pass"] is not None]
        pass_count = sum(1 for c in data_checks if c["pass"])
        total_data = len(data_checks)

        # Weighted scoring — critical checks worth more
        weight_map = {
            "taste_quality": 20, "signature_dish": 15, "return_rate_ok": 15,
            "food_safety": 10, "menu_diversity": 10, "price_competitiveness": 10,
            "daily_consumption": 10, "long_term_operation": 5, "review_authentic": 5,
            "repeat_customer": 0,
        }
        weighted_total = 0
        weighted_pass = 0
        for c in checks:
            w = weight_map.get(c["key"], 5)
            if c["pass"] is not None:
                weighted_total += w
                if c["pass"]:
                    weighted_pass += w
        weighted_score = round(weighted_pass / max(weighted_total, 1) * 100)

        # 榜单匹配推荐
        recommended_lists = []
        if weighted_score >= 80 and sig_conc > 25 and consistency > 60:
            recommended_lists.append({"list": "必吃榜", "readiness": "高", "action": "完成人工确认项后可提交申请"})
        if weighted_score >= 60:
            recommended_lists.append({"list": "好评榜", "readiness": "中", "action": "优化不达标项后申请"})
        recommended_lists.append({"list": "热门榜", "readiness": "高" if weighted_score >= 50 else "低",
                                   "action": "提升客流量和真实评价数即可"})
        if sig_conc > 30:
            recommended_lists.append({"list": "口味榜", "readiness": "高", "action": "招牌菜突出，口味榜有优势"})

        # Improvement roadmap for failed checks
        roadmap = []
        priority_map = {
            "taste_quality": ("high", "1-2周", "标准化制作流程 + 品控巡检"),
            "signature_dish": ("high", "2-4周", "打造1-2道招牌菜，通过菜单设计+服务员推荐提升销量占比"),
            "return_rate_ok": ("high", "1-2周", "排查高退货菜品，优化出品流程和备料标准"),
            "menu_diversity": ("medium", "2-4周", "引入新品类或季节菜品，降低对少数单品的依赖"),
            "price_competitiveness": ("medium", "1-2周", "推出引流套餐或调整主力价格带"),
            "daily_consumption": ("low", "持续优化", "通过套餐组合和时段优惠优化性价比感知"),
        }
        for c in checks:
            if c["source"] == "data" and c["pass"] is False:
                p, timeline, action = priority_map.get(c["key"], ("low", "按需", "请参考具体检查项改进"))
                roadmap.append({
                    "checkKey": c["key"],
                    "label": c["label"],
                    "priority": p,
                    "timeline": timeline,
                    "action": action,
                })

        return {
            "checks": checks,
            "score": weighted_score,
            "passCount": pass_count,
            "totalChecks": len(checks),
            "dataChecks": total_data,
            "subSector": sub_sector,
            "recommendedLists": recommended_lists,
            "improvementRoadmap": roadmap,
        }

    # ── Price Band Analysis ──────────────────────────────────────

    def _price_band_analysis(
        self, df: pd.DataFrame,
        product_col: Optional[str], actual_col: Optional[str],
        qty_col: Optional[str], sub_sector: str = "餐饮连锁",
    ) -> Optional[Dict[str, Any]]:
        if not product_col or not actual_col:
            return None

        if qty_col and qty_col in df.columns:
            item_df = df.groupby(product_col).agg(
                revenue=pd.NamedAgg(column=actual_col, aggfunc="sum"),
                qty=pd.NamedAgg(column=qty_col, aggfunc="sum"),
            ).reset_index()
        else:
            item_df = df.groupby(product_col).agg(
                revenue=pd.NamedAgg(column=actual_col, aggfunc="sum"),
                qty=pd.NamedAgg(column=actual_col, aggfunc="count"),
            ).reset_index()

        item_df = item_df[item_df["qty"] > 0].copy()
        if len(item_df) < 3:
            return None

        item_df["unit_price"] = item_df["revenue"] / item_df["qty"]
        item_df = item_df[item_df["unit_price"] > 0]  # filter refund rows
        if len(item_df) < 3:
            return None
        total_rev = item_df["revenue"].sum()
        if total_rev <= 0:
            return None

        band_edges = [(0, 20, "<20元"), (20, 50, "20-50元"), (50, 100, "50-100元"),
                      (100, 200, "100-200元"), (200, float("inf"), ">200元")]
        bands = []
        main_band = ""
        max_pct = 0.0
        for lo, hi, label in band_edges:
            mask = (item_df["unit_price"] >= lo) & (item_df["unit_price"] < hi)
            band_df = item_df[mask]
            rev = float(band_df["revenue"].sum())
            pct = round(rev / total_rev * 100, 1)
            bands.append({"band": label, "skuCount": int(len(band_df)), "revenue": round(rev, 2), "pct": pct})
            if pct > max_pct:
                max_pct = pct
                main_band = label

        # Weighted average item price (total revenue / total quantity sold)
        total_qty = float(item_df["qty"].sum())
        avg_item_price = float(total_rev / total_qty) if total_qty > 0 else 0

        # Positioning derived from main band tier (not customer ticket benchmark)
        # Customer ticket (average_ticket) is per-visit spend, avg_item_price is per-dish —
        # comparing them directly would be a dimension mismatch.
        high_bands = {">200元", "100-200元"}
        low_bands = {"<20元"}
        if main_band in high_bands:
            positioning = "偏高"
        elif main_band in low_bands:
            positioning = "偏低"
        else:
            positioning = "适中"

        # Keep customer ticket benchmark as reference (clearly labeled in frontend)
        ticket_cfg = RESTAURANT_DINING_BENCHMARKS.get("metrics", {}).get("average_ticket", {})
        sub_sectors_cfg = ticket_cfg.get("sub_sectors", {})
        bench_median = sub_sectors_cfg.get(sub_sector, {}).get("median", ticket_cfg.get("median", 75))

        return {
            "bands": bands,
            "mainBand": main_band,
            "avgUnitPrice": round(avg_item_price, 2),
            "benchmarkMedian": bench_median,
            "pricePositioning": positioning,
        }

    # ── Category Concentration (HHI / Long-tail) ─────────────────

    def _category_concentration(
        self, df: pd.DataFrame,
        category_col: Optional[str], actual_col: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        if not category_col or not actual_col:
            return None

        cat_rev = df.groupby(category_col)[actual_col].sum().sort_values(ascending=False)
        total_rev = cat_rev.sum()
        if total_rev <= 0 or len(cat_rev) < 2:
            return None

        shares = (cat_rev / total_rev * 100).values
        hhi = float(sum(s ** 2 for s in shares))

        if hhi > 2500:
            level = "高度集中"
        elif hhi > 1500:
            level = "中度集中"
        else:
            level = "分散"

        cum_pct = 0.0
        categories = []
        for cat, rev in cat_rev.items():
            pct = round(float(rev) / total_rev * 100, 1)
            cum_pct += pct
            categories.append({"name": str(cat), "pct": pct, "cumPct": round(cum_pct, 1)})

        top3_pct = round(float(cat_rev.head(3).sum() / total_rev * 100), 1)
        long_tail = [c for c in categories if c["pct"] < 1]

        return {
            "hhi": round(hhi, 1),
            "top3Pct": top3_pct,
            "concentrationLevel": level,
            "categories": categories,
            "longTailCount": len(long_tail),
            "longTailPct": round(sum(c["pct"] for c in long_tail), 1),
        }

    # ── Store Efficiency Matrix ──────────────────────────────────

    def _store_efficiency_matrix(
        self, df: pd.DataFrame,
        store_col: Optional[str], product_col: Optional[str],
        actual_col: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        if not store_col or not product_col or not actual_col:
            return None

        store_stats = df.groupby(store_col).agg(
            revenue=pd.NamedAgg(column=actual_col, aggfunc="sum"),
            skuCount=pd.NamedAgg(column=product_col, aggfunc="nunique"),
        ).reset_index()

        if len(store_stats) < 2:
            return None

        med_rev = float(store_stats["revenue"].median())
        med_sku = float(store_stats["skuCount"].median())

        def classify(row):
            high_rev = row["revenue"] >= med_rev
            high_sku = row["skuCount"] >= med_sku
            if high_rev and not high_sku:
                return "高效精简"
            elif high_rev and high_sku:
                return "规模领先"
            elif not high_rev and high_sku:
                return "低效臃肿"
            else:
                return "潜力不足"

        store_stats["quadrant"] = store_stats.apply(classify, axis=1)

        stores = [
            {
                "name": str(name),
                "revenue": round(float(rev), 2),
                "skuCount": int(sku),
                "quadrant": quad,
            }
            for name, rev, sku, quad in zip(
                store_stats[store_col],
                store_stats["revenue"],
                store_stats["skuCount"],
                store_stats["quadrant"],
            )
        ]

        counts = store_stats["quadrant"].value_counts()
        return {
            "stores": stores,
            "medianRevenue": round(med_rev, 2),
            "medianSkuCount": round(med_sku, 0),
            "summary": {
                "highEfficiency": int(counts.get("高效精简", 0)),
                "scaleLeader": int(counts.get("规模领先", 0)),
                "bloated": int(counts.get("低效臃肿", 0)),
                "underperforming": int(counts.get("潜力不足", 0)),
            },
        }

    # ── Supply Chain / Traceability Linkage ─────────────────────────

    def _supply_chain_analysis(
        self, df: pd.DataFrame,
        supplier_col: Optional[str], ingredient_col: Optional[str],
        inbound_qty_col: Optional[str], inbound_cost_col: Optional[str],
        product_col: Optional[str], actual_col: Optional[str],
        category_col: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        """
        Analyze supply chain health when procurement data is present.
        Returns supplier concentration, ingredient cost structure, and risk indicators.
        This is the unique moat — linking POS sales data with supply chain/traceability.
        """
        if not supplier_col or supplier_col not in df.columns:
            return None

        cost_col = inbound_cost_col if (inbound_cost_col and inbound_cost_col in df.columns) else None
        qty_col = inbound_qty_col if (inbound_qty_col and inbound_qty_col in df.columns) else None

        if not cost_col and not qty_col:
            return None

        # Coerce numeric
        for nc in [cost_col, qty_col]:
            if nc:
                df[nc] = pd.to_numeric(df[nc], errors="coerce").fillna(0)

        result: Dict[str, Any] = {}

        # 1. Supplier concentration (HHI)
        if cost_col:
            supplier_spend = df.groupby(supplier_col)[cost_col].sum().sort_values(ascending=False)
        elif qty_col:
            supplier_spend = df.groupby(supplier_col)[qty_col].sum().sort_values(ascending=False)
        else:
            return None

        total_spend = supplier_spend.sum()
        if total_spend <= 0 or len(supplier_spend) < 1:
            return None

        shares = (supplier_spend / total_spend * 100).values
        hhi = float(sum(s ** 2 for s in shares))

        if hhi > 2500:
            risk_level = "高风险"
        elif hhi > 1500:
            risk_level = "中风险"
        else:
            risk_level = "低风险"

        suppliers = []
        cum_pct = 0.0
        for name, spend in supplier_spend.items():
            pct = round(float(spend) / total_spend * 100, 1)
            cum_pct += pct
            suppliers.append({
                "name": str(name),
                "spend": round(float(spend), 2),
                "pct": pct,
                "cumPct": round(cum_pct, 1),
            })

        top1_pct = suppliers[0]["pct"] if suppliers else 0
        single_source_risk = top1_pct > 50

        result["supplierConcentration"] = {
            "hhi": round(hhi, 1),
            "riskLevel": risk_level,
            "supplierCount": len(suppliers),
            "top1Pct": top1_pct,
            "singleSourceRisk": single_source_risk,
            "suppliers": suppliers[:20],  # Cap display
        }

        # 2. Ingredient cost breakdown (when ingredient column present)
        if ingredient_col and ingredient_col in df.columns and cost_col:
            ingr_cost = df.groupby(ingredient_col)[cost_col].sum().sort_values(ascending=False)
            total_ingr = ingr_cost.sum()
            if total_ingr > 0:
                ingredients = []
                cum = 0.0
                for name, cost in ingr_cost.items():
                    pct = round(float(cost) / total_ingr * 100, 1)
                    cum += pct
                    ingredients.append({
                        "name": str(name),
                        "cost": round(float(cost), 2),
                        "pct": pct,
                        "cumPct": round(cum, 1),
                    })

                # Top 5 ingredients cost ratio (Pareto)
                top5_pct = round(sum(i["pct"] for i in ingredients[:5]), 1)

                result["ingredientCostBreakdown"] = {
                    "ingredients": ingredients[:30],
                    "top5CostPct": top5_pct,
                    "totalIngredientCount": len(ingredients),
                }

        # 3. Supply chain risk summary
        risks = []
        if single_source_risk:
            risks.append({
                "type": "single_source",
                "severity": "high",
                "description": f"最大供应商占比 {top1_pct}%，存在单一来源风险",
                "action": "引入备选供应商，降低对单一供应商的依赖",
            })
        if hhi > 2500:
            risks.append({
                "type": "high_concentration",
                "severity": "high",
                "description": f"供应商集中度 HHI={round(hhi)}，高度集中",
                "action": "分散采购渠道，至少覆盖3-5家核心供应商",
            })
        if len(suppliers) < 3:
            risks.append({
                "type": "few_suppliers",
                "severity": "medium",
                "description": f"仅有 {len(suppliers)} 家供应商，议价能力弱",
                "action": "拓展供应商池，增强议价筹码",
            })

        # Ingredient-menu linkage hint (when both sales + procurement columns exist)
        if product_col and actual_col and ingredient_col and cost_col:
            # Check if same products appear in both sales and procurement data
            if product_col in df.columns and ingredient_col in df.columns:
                sales_products = set(df[product_col].dropna().unique()) if actual_col in df.columns else set()
                procure_items = set(df[ingredient_col].dropna().unique())
                overlap = sales_products & procure_items
                if overlap:
                    result["menuIngredientLinkage"] = {
                        "linkedItems": len(overlap),
                        "totalMenuItems": len(sales_products),
                        "totalIngredients": len(procure_items),
                        "coverage": round(len(overlap) / max(len(sales_products), 1) * 100, 1),
                        "linkedNames": sorted(list(overlap))[:10],
                    }

        result["risks"] = risks
        result["overallRiskScore"] = (
            "高" if any(r["severity"] == "high" for r in risks)
            else "中" if risks
            else "低"
        )

        return result

    # ── Trend Analysis ─────────────────────────────────────────────

    def _trend_analysis(
        self, df: pd.DataFrame,
        date_col: Optional[str], actual_col: Optional[str],
        store_col: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Compute daily revenue trend and period-over-period stats when date column exists."""
        if not date_col or date_col not in df.columns or not actual_col:
            return None

        try:
            dates = pd.to_datetime(df[date_col], errors="coerce")
            valid_mask = dates.notna()
            if valid_mask.sum() < 3:
                return None

            tdf = df[valid_mask].copy()
            tdf["_date"] = dates[valid_mask].dt.date

            # Daily revenue
            daily = tdf.groupby("_date")[actual_col].sum().sort_index()
            if len(daily) < 2:
                return None

            daily_trend = [
                {"date": str(d), "revenue": round(float(v), 2)}
                for d, v in daily.items()
            ]

            # Period stats
            total_days = len(daily)
            total_revenue = float(daily.sum())
            avg_daily = total_revenue / total_days if total_days > 0 else 0

            # Split into two halves for period-over-period comparison
            mid = total_days // 2
            first_half = float(daily.iloc[:mid].sum())
            second_half = float(daily.iloc[mid:].sum())
            pop_growth = ((second_half - first_half) / first_half * 100) if first_half > 0 else None

            # Weekly aggregation (if enough data)
            weekly_trend = None
            if total_days >= 7:
                tdf["_week"] = dates[valid_mask].dt.isocalendar().week.astype(int)
                tdf["_year"] = dates[valid_mask].dt.year
                weekly = tdf.groupby(["_year", "_week"])[actual_col].sum().reset_index()
                weekly_trend = [
                    {"week": f"W{int(row['_week'])}", "revenue": round(float(row[actual_col]), 2)}
                    for _, row in weekly.iterrows()
                ]

            # Peak/trough days
            peak_day = str(daily.idxmax())
            trough_day = str(daily.idxmin())

            result: Dict[str, Any] = {
                "dailyTrend": daily_trend[-60:],  # Cap at 60 days
                "totalDays": total_days,
                "avgDailyRevenue": round(avg_daily, 2),
                "popGrowth": round(pop_growth, 1) if pop_growth is not None else None,
                "peakDay": {"date": peak_day, "revenue": round(float(daily.max()), 2)},
                "troughDay": {"date": trough_day, "revenue": round(float(daily.min()), 2)},
            }
            if weekly_trend:
                result["weeklyTrend"] = weekly_trend

            # Per-store trends (top 5 stores only, for chart)
            if store_col and store_col in tdf.columns:
                top_stores = tdf.groupby(store_col)[actual_col].sum().nlargest(5).index.tolist()
                store_daily = {}
                for store in top_stores:
                    s_daily = tdf[tdf[store_col] == store].groupby("_date")[actual_col].sum()
                    store_daily[str(store)] = [
                        {"date": str(d), "revenue": round(float(v), 2)}
                        for d, v in s_daily.items()
                    ]
                if store_daily:
                    result["storeTrends"] = store_daily

            return result
        except Exception as e:
            logger.warning(f"Trend analysis failed: {e}")
            return None

    def _time_period_analysis(
        self, df: pd.DataFrame,
        date_col: Optional[str], actual_col: Optional[str],
        store_col: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Hourly revenue heatmap + meal-period breakdown when datetime has time component."""
        if not date_col or date_col not in df.columns or not actual_col:
            return None

        try:
            timestamps = pd.to_datetime(df[date_col], errors="coerce")
            valid_mask = timestamps.notna()
            if valid_mask.sum() < 10:
                return None

            tdf = df[valid_mask].copy()
            tdf["_hour"] = timestamps[valid_mask].dt.hour

            # Check if time component exists (not all midnight)
            if tdf["_hour"].nunique() < 3:
                return None  # All same hour = date-only column, skip

            # Hourly distribution (0-23)
            hourly = tdf.groupby("_hour")[actual_col].agg(["sum", "count"]).reset_index()
            hourly_dist = []
            for _, row in hourly.iterrows():
                hourly_dist.append({
                    "hour": int(row["_hour"]),
                    "revenue": round(float(row["sum"]), 2),
                    "orderCount": int(row["count"]),
                })

            total_rev = float(tdf[actual_col].sum())
            if total_rev <= 0:
                return None

            # Meal period breakdown
            meal_periods = {
                "早餐": (6, 10),
                "午市": (10, 14),
                "下午茶": (14, 17),
                "晚市": (17, 21),
                "夜宵": (21, 24),  # 21-23 + 0-5
            }

            periods = []
            for name, (start, end) in meal_periods.items():
                if name == "夜宵":
                    mask = (tdf["_hour"] >= 21) | (tdf["_hour"] < 6)
                else:
                    mask = (tdf["_hour"] >= start) & (tdf["_hour"] < end)
                rev = float(tdf.loc[mask, actual_col].sum())
                cnt = int(mask.sum())
                periods.append({
                    "period": name,
                    "revenue": round(rev, 2),
                    "pct": round(rev / total_rev * 100, 1) if total_rev > 0 else 0,
                    "orderCount": cnt,
                })

            # Peak hour
            peak_hour_row = hourly.loc[hourly["sum"].idxmax()]
            peak_hour = int(peak_hour_row["_hour"])

            # Weekday vs weekend (if date component exists)
            tdf["_weekday"] = timestamps[valid_mask].dt.dayofweek  # 0=Mon, 6=Sun
            weekday_rev = float(tdf.loc[tdf["_weekday"] < 5, actual_col].sum())
            weekend_rev = float(tdf.loc[tdf["_weekday"] >= 5, actual_col].sum())
            weekday_days = tdf.loc[tdf["_weekday"] < 5, "_weekday"].nunique() or 1
            weekend_days = tdf.loc[tdf["_weekday"] >= 5, "_weekday"].nunique() or 1

            result: Dict[str, Any] = {
                "hourlyDistribution": hourly_dist,
                "mealPeriods": periods,
                "peakHour": peak_hour,
                "peakHourLabel": f"{peak_hour}:00-{peak_hour+1}:00",
                "weekdayAvg": round(weekday_rev / weekday_days, 2) if weekday_days else 0,
                "weekendAvg": round(weekend_rev / weekend_days, 2) if weekend_days else 0,
            }

            # Main meal period (highest revenue)
            main_period = max(periods, key=lambda p: p["revenue"])
            result["mainMealPeriod"] = main_period["period"]
            result["mainMealPct"] = main_period["pct"]

            return result
        except Exception as e:
            logger.warning(f"Time period analysis failed: {e}")
            return None

    # ── Fallback column detection helpers ──────────────────────────

    @staticmethod
    def _fallback_product_col(df: pd.DataFrame, cols: Dict[str, str]) -> Optional[str]:
        # Filter columns matching product_N pattern via pre-compiled regex
        candidates = [c for c in df.columns if _PRODUCT_COL_RE.match(c.strip())]
        for c in candidates:
            sample = df[c].dropna().head(20)
            if len(sample) > 0 and sample.astype(str).str.contains(_CJK_RE).mean() > 0.3:
                return c
        return None

