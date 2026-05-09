"""Unified field classifier — single source of truth for is_measure / is_dimension / is_time.

Consolidates rules previously split across:
  - Java DynamicDataPersistenceServiceImpl.saveFieldDefinitions (sync upload path)
  - Python excel_async.py inline category→role mapping (async >50MB path)
  - Per-domain restaurant overrides (W2)

After γ migration: this module is the ONLY place that decides a column's role.

Usage:
    from smartbi.services.field_classifier import classify_column, dedupe_column_names,
        find_time_column, find_category_column

    classifications = [
        classify_column(name, inferred_dtype=probe_type(col))
        for name, col in zip(headers, sample_columns)
    ]
    # classifications: list of {original_name, is_measure, is_dimension, is_time, semantic_type, reason}
"""
from __future__ import annotations

import logging
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ─── Explicit overrides for known-problematic columns ────────────────────────
# These take precedence over all keyword/dtype rules. Add known misclassifications
# here as discovered. Prevents regressions.
_EXPLICIT_OVERRIDES: Dict[str, str] = {
    # qhj-style explicit fixes (found during W2 audit)
    "商品结账总数": "measure",          # was wrongly dim in upload 4169
    "账单号": "dimension",              # was wrongly measure
    "外部单号": "dimension",            # id, not measure
    "关联单号": "dimension",
    "发票号": "dimension",
    # Semantic clarifiers
    "商品信息": "dimension",            # parsed by restaurant/item_parser.py
    "整单备注": "dimension",
}


# ─── Keyword sets ────────────────────────────────────────────────────────────
# Order of precedence inside classify_column:
#   1. Explicit override (exact name match)
#   2. Time keyword (most specific)
#   3. Measure keyword
#   4. Dimension keyword
#   5. Dtype fallback (NUMERIC→measure, DATE→time, TEXT→dimension)

# Time keywords — only multi-char forms to avoid false positives
# (单字 "月"/"日" 会误命中 "本月销售额"、"日销",不要放进来)
_TIME_KEYWORDS: Tuple[str, ...] = (
    "时间", "日期", "周期", "时段", "时刻",
    "year", "month", "period", "date", "time", "timestamp", "datetime",
    "年度", "月度", "季度",
    # POS-specific time event columns (qhj data)
    "开单时间", "结单时间", "反结账时间", "分单时间", "并单时间",
    "转桌时间", "撤单时间", "营业日期",
)

# Identifier-like keywords that should be dimensions even if numeric-looking
_ID_LIKE_KEYWORDS: Tuple[str, ...] = (
    "账单号", "单号", "编号", "流水号", "发票号", "会员号", "员工号", "房号",
    "id", "uuid", "code",
)

# Strong measure keywords (money/count/percent)
_MEASURE_KEYWORDS: Tuple[str, ...] = (
    "营业额", "实收额", "实收", "应收金额", "应收", "销售额", "收款金额", "实收金额",
    "营收", "利润", "毛利", "成本",
    "单价", "原价", "总价", "均价",
    "客流量", "客流", "人数", "份数", "销量", "数量", "产量",
    "总额", "合计额", "折扣额", "优惠额", "折扣率",
    "外送费", "服务费", "小费", "税费", "开发票额",
    "损益额", "损耗",
    # Apr 24 2026: review rating fields (大众点评 / 美团 Q3/Q4 exports).
    # These were previously masked because semantic_mapper renamed them to
    # "amount_score"; preserving Chinese now requires explicit measure rules.
    "星级", "口味分", "环境分", "服务分",
    # Apr 28 2026 (Phase B quick-win): budget/actual columns from Chinese
    # management Excel exports. W0.2 normalizer hit-rate report found these
    # 6 patterns drove ~62.6% of all dim-no-semantic mis-classifications
    # (2675 / 4273 rows). Adding to keyword list is zero-LLM-cost.
    "预算", "实际", "净利", "本月实际", "本年实际", "本季实际",
    # English suffixes
    "amount", "count", "revenue", "profit", "sum", "total", "rate",
)

# Dimension keywords
_DIMENSION_KEYWORDS: Tuple[str, ...] = (
    "门店", "店铺", "区域", "省份", "城市", "大区", "品牌", "类别", "分类",
    "状态", "类型", "来源", "部门",
    "服务员", "销售员", "收银员", "厨师", "店员", "班次",
    "桌位", "桌号", "座位",
    "订单类型", "订单来源", "订单状态", "订单",
    "商品", "菜品", "产品", "SKU", "品类",
    "名称", "标签",
    "折扣名称", "折扣类型",
    # English
    "store", "region", "category", "type", "status", "product", "dept", "department",
)


# ─── Classifier ──────────────────────────────────────────────────────────────


def _matches_any(text: str, keywords: Tuple[str, ...]) -> bool:
    """Case-insensitive substring match."""
    if not text:
        return False
    lower = text.lower()
    return any(kw.lower() in lower for kw in keywords)


def classify_column(
    original_name: str,
    inferred_dtype: Optional[str] = None,
    category_hint: Optional[str] = None,
) -> Dict[str, object]:
    """Classify a single column into measure/dimension/time.

    Args:
        original_name: column header text (e.g., "营业额", "门店名称")
        inferred_dtype: one of "NUMERIC" / "DATE" / "TEXT" / None. Inferred by caller from sample values.
        category_hint: upstream semantic_mapper's category (amount|rate|category|time|None)

    Returns:
        {original_name, is_measure, is_dimension, is_time, semantic_type, reason}
    """
    name = (original_name or "").strip()
    dt = (inferred_dtype or "").upper()
    cat = (category_hint or "").lower()

    # Default: non-assigned
    is_measure = is_dimension = is_time = False
    reason = "default"
    semantic_type: Optional[str] = None

    # 1. Explicit override wins above all
    if name in _EXPLICIT_OVERRIDES:
        role = _EXPLICIT_OVERRIDES[name]
        is_measure = role == "measure"
        is_dimension = role == "dimension"
        is_time = role == "time"
        return {
            "original_name": name,
            "is_measure": is_measure,
            "is_dimension": is_dimension,
            "is_time": is_time,
            "semantic_type": _infer_semantic_type(name, role),
            "reason": f"explicit_override:{role}",
        }

    # 2. Time — most specific keyword class
    if _matches_any(name, _TIME_KEYWORDS) or dt == "DATE":
        is_time = True
        reason = "time_keyword_or_date_dtype"
        semantic_type = "date"
        return {
            "original_name": name,
            "is_measure": False, "is_dimension": False, "is_time": True,
            "semantic_type": semantic_type, "reason": reason,
        }

    # 3. Identifier-like names → dimension (even if numeric)
    # e.g. "账单号" "发票号" — Java was wrongly marking them measure
    if _matches_any(name, _ID_LIKE_KEYWORDS):
        is_dimension = True
        reason = "id_like_keyword"
        semantic_type = "id"
        return {
            "original_name": name,
            "is_measure": False, "is_dimension": True, "is_time": False,
            "semantic_type": semantic_type, "reason": reason,
        }

    # 4. Measure keyword
    if _matches_any(name, _MEASURE_KEYWORDS):
        is_measure = True
        reason = "measure_keyword"
        semantic_type = _infer_semantic_type(name, "measure")
        return {
            "original_name": name,
            "is_measure": True, "is_dimension": False, "is_time": False,
            "semantic_type": semantic_type, "reason": reason,
        }

    # 5. Dimension keyword
    if _matches_any(name, _DIMENSION_KEYWORDS):
        is_dimension = True
        reason = "dimension_keyword"
        semantic_type = _infer_semantic_type(name, "dimension")
        return {
            "original_name": name,
            "is_measure": False, "is_dimension": True, "is_time": False,
            "semantic_type": semantic_type, "reason": reason,
        }

    # 6. Upstream category hint
    if cat == "time":
        return {
            "original_name": name,
            "is_measure": False, "is_dimension": False, "is_time": True,
            "semantic_type": "date", "reason": "category_hint_time",
        }
    if cat in ("amount", "rate"):
        return {
            "original_name": name,
            "is_measure": True, "is_dimension": False, "is_time": False,
            "semantic_type": cat, "reason": f"category_hint_{cat}",
        }
    if cat == "category":
        return {
            "original_name": name,
            "is_measure": False, "is_dimension": True, "is_time": False,
            "semantic_type": None, "reason": "category_hint_dimension",
        }

    # 7. Dtype-only fallback
    if dt == "NUMERIC":
        return {
            "original_name": name,
            "is_measure": True, "is_dimension": False, "is_time": False,
            "semantic_type": None, "reason": "dtype_fallback_numeric",
        }
    if dt == "TEXT":
        return {
            "original_name": name,
            "is_measure": False, "is_dimension": True, "is_time": False,
            "semantic_type": None, "reason": "dtype_fallback_text",
        }

    # 8. Truly unclassifiable — safest default is dimension so we can at least group on it
    return {
        "original_name": name,
        "is_measure": False, "is_dimension": True, "is_time": False,
        "semantic_type": None, "reason": "default_to_dimension",
    }


def _infer_semantic_type(name: str, role: str) -> Optional[str]:
    """Derive a semantic_type hint (revenue/cost/profit/region/id/etc) for richer metadata."""
    if not name:
        return None
    lower = name.lower()
    # ID-like names (checked first so 账单号 → id, not 账单(dimension))
    for kw in ("账单号", "发票号", "会员号", "员工号", "房号", "单号", "编号", "流水号",
               "id", "uuid", "code"):
        if kw.lower() in lower:
            return "id"
    pairs = [
        (("营业额", "营收", "revenue", "income"), "revenue"),
        (("成本", "cost", "expense", "费用"), "cost"),
        (("利润", "毛利", "profit"), "profit"),
        (("实收", "应收"), "payment"),
        (("折扣", "优惠", "discount"), "discount"),
        (("门店", "store"), "store"),
        (("区域", "region", "大区"), "region"),
        (("商品", "product", "菜品", "sku"), "product"),
        (("服务员", "销售员", "staff"), "staff"),
        (("客流", "人数", "客户"), "customer"),
    ]
    for keys, semantic in pairs:
        for kw in keys:
            if kw.lower() in lower:
                return semantic
    if role == "time":
        return "date"
    return None


# ─── Aggregation-strategy decision ────────────────────────────────────────────
# Used by /reclassify endpoint to populate smart_bi_pg_field_definitions.agg_strategy.
# Centralized here so FE getSmartKPIs and Python quick_summary can both read the
# same persisted value rather than re-deriving via heuristics.

# Suffixes that indicate a 1-5 rating column (大众点评 / 美团 评价 exports).
# Public — also consumed by insight.py quick_summary live fallback.
RATING_NAME_SUFFIXES: Tuple[str, ...] = ("分", "评分", "星级")

# Valid bounds for a "rating" mean. Outside [1, 5] strongly suggests the column
# is a loyalty score (积分) or unrelated metric — fall back to sum default.
_RATING_MEAN_MIN: float = 1.0
_RATING_MEAN_MAX: float = 5.0


def infer_agg_strategy(
    name: str,
    semantic_type: Optional[str],
    is_measure: bool,
    statistics: Optional[Dict[str, object]] = None,
) -> str:
    """Decide how a column should be aggregated for KPI cards.

    Returns one of:
      "sum"  — display SUM(col) (default for measures: amounts, counts, etc.)
      "mean" — display AVG(col) (1-5 ratings: 平均星级 = 4.83)
      "none" — exclude from KPI cards entirely (IDs, dimensions, time fields)

    Decision order (first match wins):
      1. semantic_type == 'id' → 'none' (NUMERIC IDs would otherwise sum to 亿)
      2. is_measure == False   → 'none' (only measures can be KPI cards)
      3. Name endswith 分/评分/星级 AND statistics.mean ∈ [1, 5] → 'mean'
      4. Else                   → 'sum'

    The [1, 5] guard prevents columns like "服务积分" (loyalty points,
    mean ~2300) from being mis-rendered as a 4.83 rating, while still
    catching legitimate 大众点评 ratings whose names match the suffix list.

    Args:
      name: column header text (e.g. "星级分", "营业额")
      semantic_type: from classify_column(...)["semantic_type"] (id/revenue/...)
      is_measure: from classify_column(...)["is_measure"]
      statistics: optional {"mean": float, "min": float, "max": float, ...}
                  from smart_bi_pg_field_definitions.statistics JSONB column.
                  When None (no stats yet), the rating guard is skipped and
                  the function falls back to the conservative 'sum' default.

    Returns:
      String ∈ {"sum", "mean", "none"}.
    """
    # Rule 1: IDs never aggregate
    if (semantic_type or "").lower() == "id":
        return "none"

    # Rule 2: only measures can be KPI cards
    if not is_measure:
        return "none"

    # Rule 3: rating detection (name + stats both required)
    if statistics:
        mean = statistics.get("mean")
        if mean is not None and name:
            for suffix in RATING_NAME_SUFFIXES:
                if name.endswith(suffix):
                    try:
                        m = float(mean)
                    except (TypeError, ValueError):
                        break
                    if _RATING_MEAN_MIN <= m <= _RATING_MEAN_MAX:
                        return "mean"
                    # Name suggests rating but mean out of [1, 5] →
                    # likely loyalty points / 积分 / unrelated. Fall through
                    # to default 'sum'. NOT 'none' because the column may
                    # still be a meaningful sum-able measure.
                    break

    # Rule 4: default
    return "sum"


# ─── Duplicate-header dedup ──────────────────────────────────────────────────


def dedupe_column_names(columns: List[str]) -> List[str]:
    """Add _2, _3 suffixes to duplicate column names.

    Preserves order; first occurrence keeps original name.
    Mirrors Java DynamicDataPersistenceServiceImpl.saveFieldDefinitions:246-249 behavior.

    Example:
      ["金额", "数量", "金额", "金额"] → ["金额", "数量", "金额_2", "金额_3"]
    """
    seen: Dict[str, int] = {}
    result: List[str] = []
    for col in columns:
        key = col or ""
        if key not in seen:
            seen[key] = 1
            result.append(col)
        else:
            seen[key] += 1
            result.append(f"{col}_{seen[key]}")
    return result


# ─── Post-hoc helpers (replace Java findTimeField / findCategoryField) ──────


def find_time_column(classifications: List[Dict[str, object]]) -> Optional[str]:
    """Return the first classified time column's original_name, or None."""
    for c in classifications:
        if c.get("is_time"):
            return c.get("original_name")  # type: ignore[return-value]
    return None


def find_category_column(classifications: List[Dict[str, object]]) -> Optional[str]:
    """Return the first dimension column (non-time) as the default 'category' key.

    Used by denormalized `smart_bi_dynamic_data.category` column for fast filtering.
    """
    for c in classifications:
        if c.get("is_dimension") and not c.get("is_time"):
            return c.get("original_name")  # type: ignore[return-value]
    return None
