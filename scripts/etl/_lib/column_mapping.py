"""Sub-ETL-1a — Chinese→English canonical column maps + 14-chain catalog + report-type detection.

Spec: docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md §3.1 + §6 (row 3).
Q1 §4.3: 14 real restaurant chains catalog.

Maps live here (not in main script) so adding new report types (profit / purchase_inbound)
doesn't bloat the orchestrator. `detect_report_type()` is co-located because it consumes
all maps and picks the best fit — adding a new map requires only adding it to REPORT_MAPS.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional


# ────────────────────────────────────────────────────────────────────
# Report type identifiers (closed set)
# ────────────────────────────────────────────────────────────────────

REPORT_PRODUCT_SALES = "product_sales"
REPORT_PROFIT = "profit"
REPORT_PURCHASE_INBOUND = "purchase_inbound"
REPORT_UNSUPPORTED = "_unsupported"


# ────────────────────────────────────────────────────────────────────
# 商品销量报表 (product_sales) — 19 columns
# ────────────────────────────────────────────────────────────────────

# Spec §1.5 fact_pos_item natural key is (factory_id, source_type, store_id, source_bill_no, line_no);
# at the canonical-CSV layer we keep the wider product-aggregate shape that Sub-ETL-2 will
# fold into Silver dims + fact_pos_item.
PRODUCT_SALES_HEADER_MAP: dict[str, str] = {
    "门店名称": "store_name",
    "商品分类": "product_category",
    "收入分组": "revenue_group",
    "商品编码": "product_code",
    "商品名称": "product_name",
    "规格": "spec",
    "商品类型": "product_type",
    "点单方式": "order_method",
    "单卖数量(不含套餐子商品)": "qty_single",
    "数量(含套餐子商品)": "qty_total",
    "退货数量(不含套餐子商品)": "qty_refund",
    "套餐内销量": "qty_combo_child",
    "单位": "unit",
    "销售单价": "unit_price",
    "销售金额": "gross_amount",
    "折后金额": "net_after_discount",
    "分摊优惠": "discount_allocated",
    "实退金额": "refund_amount",
    "实收": "actual_receive",
}

PRODUCT_SALES_CANONICAL_HEADER: list[str] = list(PRODUCT_SALES_HEADER_MAP.values())

PRODUCT_SALES_NUMERIC_COLS: frozenset[str] = frozenset({
    "qty_single", "qty_total", "qty_refund", "qty_combo_child",
    "unit_price", "gross_amount", "net_after_discount",
    "discount_allocated", "refund_amount", "actual_receive",
})

PRODUCT_SALES_REQUIRED_COLS: frozenset[str] = frozenset({
    "store_name", "product_name",
})


# ────────────────────────────────────────────────────────────────────
# 利润表 (profit) — accounting line items (P&L statement shape)
# ────────────────────────────────────────────────────────────────────
# Source: 大众点评 利润表 export. Columns: 科目 / 本期金额 / 同期金额 / 增减 / 增减率 (+
# variants per chain). Pilot canonical shape preserves the 5 financial columns + meta.

PROFIT_HEADER_MAP: dict[str, str] = {
    "科目": "account_subject",
    "本期金额": "amount_current",
    "去年同期": "amount_prior_year",
    "同期金额": "amount_prior_year",
    "增减": "amount_delta",
    "增减率": "change_rate",
}

PROFIT_CANONICAL_HEADER: list[str] = [
    "account_subject", "amount_current", "amount_prior_year",
    "amount_delta", "change_rate",
]

PROFIT_NUMERIC_COLS: frozenset[str] = frozenset({
    "amount_current", "amount_prior_year", "amount_delta", "change_rate",
})

PROFIT_REQUIRED_COLS: frozenset[str] = frozenset({"account_subject"})


# ────────────────────────────────────────────────────────────────────
# 采购入库明细 (purchase_inbound) — supplier × batch × SKU inbound receipts
# ────────────────────────────────────────────────────────────────────
# Source: 大众点评 采购入库明细报表. Shape varies slightly per chain — pilot canonical
# covers the dominant 9-column shape. Header detection threshold = 5 of 9 known.

PURCHASE_INBOUND_HEADER_MAP: dict[str, str] = {
    "入库日期": "inbound_date",
    "单据编号": "doc_no",
    "供应商": "supplier_name",
    "供应商名称": "supplier_name",
    "商品编码": "product_code",
    "商品名称": "product_name",
    "规格": "spec",
    "单位": "unit",
    "入库数量": "inbound_qty",
    "数量": "inbound_qty",
    "采购单价": "unit_price",
    "单价": "unit_price",
    "采购金额": "total_amount",
    "金额": "total_amount",
    "仓库": "warehouse",
    "仓库名称": "warehouse",
}

PURCHASE_INBOUND_CANONICAL_HEADER: list[str] = [
    "inbound_date", "doc_no", "supplier_name", "product_code", "product_name",
    "spec", "unit", "inbound_qty", "unit_price", "total_amount", "warehouse",
]

PURCHASE_INBOUND_NUMERIC_COLS: frozenset[str] = frozenset({
    "inbound_qty", "unit_price", "total_amount",
})

PURCHASE_INBOUND_REQUIRED_COLS: frozenset[str] = frozenset({
    "product_name",
})


# ────────────────────────────────────────────────────────────────────
# Report-type registry (single source of truth for detect_report_type)
# ────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class ReportTypeSpec:
    """Per-report-type metadata used by orchestrator + tests."""
    report_type: str
    header_map: dict[str, str]
    canonical_header: list[str]
    numeric_cols: frozenset[str]
    required_cols: frozenset[str]
    detect_threshold: int  # min matched columns to claim this report type


REPORT_SPECS: dict[str, ReportTypeSpec] = {
    REPORT_PRODUCT_SALES: ReportTypeSpec(
        report_type=REPORT_PRODUCT_SALES,
        header_map=PRODUCT_SALES_HEADER_MAP,
        canonical_header=PRODUCT_SALES_CANONICAL_HEADER,
        numeric_cols=PRODUCT_SALES_NUMERIC_COLS,
        required_cols=PRODUCT_SALES_REQUIRED_COLS,
        detect_threshold=10,  # 10 of 19
    ),
    REPORT_PROFIT: ReportTypeSpec(
        report_type=REPORT_PROFIT,
        header_map=PROFIT_HEADER_MAP,
        canonical_header=PROFIT_CANONICAL_HEADER,
        numeric_cols=PROFIT_NUMERIC_COLS,
        required_cols=PROFIT_REQUIRED_COLS,
        detect_threshold=3,  # 3 of 5 distinct canonical cols (科目 + 本期金额 + at least 1 of 同期/增减/增减率)
    ),
    REPORT_PURCHASE_INBOUND: ReportTypeSpec(
        report_type=REPORT_PURCHASE_INBOUND,
        header_map=PURCHASE_INBOUND_HEADER_MAP,
        canonical_header=PURCHASE_INBOUND_CANONICAL_HEADER,
        numeric_cols=PURCHASE_INBOUND_NUMERIC_COLS,
        required_cols=PURCHASE_INBOUND_REQUIRED_COLS,
        detect_threshold=5,  # 5 distinct canonical cols (header has many aliases collapsing to same canonical)
    ),
}


def detect_report_type(header_row: list[str]) -> str:
    """Identify report type from header row contents.

    Scores against all known report-type maps; returns the highest-scoring type
    whose match count meets its detect_threshold. Ties broken by registry order
    (product_sales > profit > purchase_inbound) which matches data-frequency order.

    Returns:
        One of REPORT_PRODUCT_SALES / REPORT_PROFIT / REPORT_PURCHASE_INBOUND,
        or REPORT_UNSUPPORTED if no type meets its threshold.
    """
    if header_row is None:
        raise ValueError("detect_report_type: header_row required")
    cleaned = {h.strip() for h in header_row if h is not None and h.strip()}

    # Score each report type by counting distinct canonical columns matched
    # (multiple Chinese aliases mapping to same canonical col count once).
    best_type = REPORT_UNSUPPORTED
    best_score = 0
    for rtype, spec in REPORT_SPECS.items():
        matched_canonical: set[str] = set()
        for zh_header in cleaned:
            canonical = spec.header_map.get(zh_header)
            if canonical is not None:
                matched_canonical.add(canonical)
        score = len(matched_canonical)
        if score >= spec.detect_threshold and score > best_score:
            best_type = rtype
            best_score = score
    return best_type


# ────────────────────────────────────────────────────────────────────
# 14-chain catalog (Q1 §4.3 / spec §1.4 verbatim)
# ────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class ChainEntry:
    """One row of the 14-chain catalog (Q1 §4.3 / spec §1.4)."""
    factory_id: str
    chain_name_zh: str
    chain_name_roman: str
    cuisine: Optional[str]
    source_path_hints: tuple[str, ...]


CHAIN_CATALOG: tuple[ChainEntry, ...] = (
    ChainEntry("R_ILTEATRO_REAL",       "IL TEATRO 西餐",   "ILTEATRO",      "Western",  ("IL TEATRO",)),
    ChainEntry("R_SHANGMA_HG_REAL",     "上马火锅",         "SHANGMA_HG",    "HotPot",   ("上马火锅",)),
    ChainEntry("R_JINCHUAN_HG_REAL",    "锦川火锅",         "JINCHUAN_HG",   "HotPot",   ("锦川火锅",)),
    ChainEntry("R_XIMAXIANG_REAL",      "唏嘛香 牛肉面",    "XIMAXIANG",     "Noodles",  ("唏嘛香",)),
    ChainEntry("R_YUJIUJING_REAL",      "御九井 日料",      "YUJIUJING",     "Japanese", ("御九井",)),
    ChainEntry("R_YONGHE_REAL",         "永和豆浆",         "YONGHE",        "FastFood", ("永和豆浆",)),
    ChainEntry("R_XINBASHU_REAL",       "鑫巴蜀",           "XINBASHU",      "Sichuan",  ("鑫巴蜀",)),
    ChainEntry("R_QINGHUAJIAO_REAL",    "青花椒",           "QINGHUAJIAO",   "Sichuan",  ("青花椒",)),
    ChainEntry("R_DONGMENKOU_REAL",     "东门口",           "DONGMENKOU",    "Local",    ("东门口", "東門口")),
    ChainEntry("R_HONGDEJI_REAL",       "鸿德记",           "HONGDEJI",      None,       ("鸿德记",)),
    ChainEntry("R_JINRINIUSHI_REAL",    "今日牛事",         "JINRINIUSHI",   "Beef",     ("今日牛事",)),
    ChainEntry("R_YOUZIYOUWEI_REAL",    "有滋有味",         "YOUZIYOUWEI",   None,       ("有滋有味",)),
    ChainEntry("R_LINJIAYAN_REAL",      "邻家宴",           "LINJIAYAN",     None,       ("邻家宴",)),
    ChainEntry("R_HUOGUO_GENERIC_REAL", "火锅 (generic)",   "HUOGUO_GENERIC","HotPot",   ("火锅2月利润表",)),
)

CHAIN_BY_FACTORY_ID: dict[str, ChainEntry] = {c.factory_id: c for c in CHAIN_CATALOG}


def match_chain_for_path(path: Path, catalog: Iterable[ChainEntry] = CHAIN_CATALOG) -> Optional[ChainEntry]:
    """Match a source file path to its ChainEntry by substring hint.

    First match wins; iteration order is the 14-chain catalog declaration order.
    Caller treats `None` as quarantine reason `UNKNOWN_CHAIN`.
    """
    if path is None:
        raise ValueError("match_chain_for_path: path required")
    haystack = str(path).replace("\\", "/")
    for entry in catalog:
        for hint in entry.source_path_hints:
            if hint and hint in haystack:
                return entry
    return None
