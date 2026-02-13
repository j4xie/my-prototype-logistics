"""
Food Industry Data Auto-Detector

Scans uploaded data column names and values to determine if data is
food-industry related, and suggests relevant benchmarks and standards.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ============================================================
# Keyword Dictionaries
# ============================================================

_FINANCIAL_KEYWORDS = {
    "毛利率", "净利率", "营业收入", "主营业务收入", "营业成本", "主营业务成本",
    "销售费用", "管理费用", "财务费用", "研发费用", "毛利润", "净利润",
    "利润总额", "利润表", "资产负债", "收入", "成本", "费用率",
    "应收账款", "存货", "库存", "周转", "营业利润",
}

_FOOD_SPECIFIC_KEYWORDS = {
    # Raw materials & ingredients
    "原料", "添加剂", "食品添加剂", "防腐剂", "调味料", "配料",
    "面粉", "食用油", "白砂糖", "淀粉", "大豆", "玉米",
    # Safety & quality
    "微生物", "菌落总数", "大肠菌群", "致病菌", "重金属", "农残",
    "保质期", "货架期", "感官评价", "水分活度",
    # Standards & compliance
    "HACCP", "GB 2760", "GB 14881", "GB 7718", "ISO 22000",
    "SC认证", "QS认证", "有机认证", "绿色食品",
    # Production
    "批次号", "生产批次", "车间", "工序", "灭菌", "杀菌",
    "包装", "灌装", "发酵", "冷冻", "速冻", "冷链",
    "良品率", "损耗率", "出品率", "产能利用率",
    # Products
    "肉制品", "乳制品", "调味品", "速冻食品", "烘焙", "饮料",
    "罐头", "方便面", "休闲食品", "酱油", "醋", "味精",
}

_PRODUCTION_KEYWORDS = {
    "产量", "产能", "班次", "工位", "设备利用率", "OEE",
    "投料", "出料", "在制品", "半成品", "成品", "废品",
    "返工", "报废", "不良品", "合格率", "一次通过率",
}

_TRACEABILITY_KEYWORDS = {
    "溯源", "追溯", "批次追踪", "供应链", "进货台账",
    "出货台账", "检验报告", "合格证", "产地", "原产地",
}

# Category → keywords mapping
_CATEGORY_KEYWORDS: Dict[str, set] = {
    "financial": _FINANCIAL_KEYWORDS,
    "food_specific": _FOOD_SPECIFIC_KEYWORDS,
    "production": _PRODUCTION_KEYWORDS,
    "traceability": _TRACEABILITY_KEYWORDS,
}

# Suggested benchmarks per detected category
_CATEGORY_BENCHMARKS: Dict[str, List[str]] = {
    "financial": [
        "gross_margin", "net_margin", "selling_expense_ratio",
        "admin_expense_ratio", "total_expense_ratio",
    ],
    "food_specific": [
        "yield_rate", "raw_material_cost_ratio",
    ],
    "production": [
        "yield_rate", "raw_material_cost_ratio",
        "inventory_turnover_days",
    ],
    "traceability": [],
}

# Suggested food safety standards per detected category
_CATEGORY_STANDARDS: Dict[str, List[str]] = {
    "financial": [],
    "food_specific": [
        "GB 2760-2014 食品添加剂使用标准",
        "GB 14881-2013 食品生产通用卫生规范",
        "GB 29921-2021 预包装食品中致病菌限量",
    ],
    "production": [
        "HACCP 危害分析与关键控制点",
        "GB 14881-2013 食品生产通用卫生规范",
    ],
    "traceability": [
        "GB 7718-2011 预包装食品标签通则",
        "ISO 22000 食品安全管理体系",
    ],
}


# ============================================================
# Detection Functions
# ============================================================

def detect_food_industry(
    column_names: List[str],
    sample_values: Optional[List[Dict[str, Any]]] = None,
    threshold: float = 0.15,
) -> Dict[str, Any]:
    """
    Scan column names and sample values to determine if data is food-industry related.

    Args:
        column_names: List of column header names from uploaded data
        sample_values: Optional list of row dicts (first 5-10 rows) for deeper detection
        threshold: Minimum keyword hit ratio to flag as food industry

    Returns:
        {
            "is_food_industry": bool,
            "confidence": float (0-1),
            "detected_categories": ["financial", "food_specific", ...],
            "matched_keywords": ["毛利率", "原料", ...],
            "suggested_benchmarks": ["gross_margin", ...],
            "suggested_standards": ["GB 2760-2014 ...", ...],
        }
    """
    all_text_tokens: List[str] = []

    # Collect tokens from column names
    for col in column_names:
        all_text_tokens.append(str(col).strip())

    # Collect tokens from sample values
    if sample_values:
        for row in sample_values[:10]:
            for val in row.values():
                if isinstance(val, str) and val.strip():
                    all_text_tokens.append(val.strip())

    # Build combined text for matching
    combined = " ".join(all_text_tokens)
    combined_lower = combined.lower()

    # Match against each category
    matched_categories: Dict[str, List[str]] = {}
    all_matched: List[str] = []

    for category, keywords in _CATEGORY_KEYWORDS.items():
        cat_matches = []
        for kw in keywords:
            if kw.lower() in combined_lower or kw in combined:
                cat_matches.append(kw)
        if cat_matches:
            matched_categories[category] = cat_matches
            all_matched.extend(cat_matches)

    # Also check for GB standard patterns in text
    gb_pattern = re.compile(r'GB\s*\d{4,5}', re.IGNORECASE)
    gb_matches = gb_pattern.findall(combined)
    if gb_matches:
        matched_categories.setdefault("food_specific", []).extend(gb_matches)
        all_matched.extend(gb_matches)

    # De-duplicate
    all_matched = list(dict.fromkeys(all_matched))

    # Calculate confidence
    total_possible = len(column_names) + (len(sample_values) if sample_values else 0)
    if total_possible == 0:
        total_possible = 1

    # Weighted scoring: food_specific keywords count 2x
    score = 0
    for cat, matches in matched_categories.items():
        weight = 2.0 if cat == "food_specific" else 1.0
        score += len(matches) * weight

    # Normalize confidence
    confidence = min(1.0, score / max(total_possible * 0.3, 1))

    # Boost confidence if multiple categories detected
    if len(matched_categories) >= 2:
        confidence = min(1.0, confidence * 1.3)

    is_food = confidence >= threshold or "food_specific" in matched_categories

    # Collect suggested benchmarks and standards
    suggested_benchmarks: List[str] = []
    suggested_standards: List[str] = []
    for cat in matched_categories:
        for b in _CATEGORY_BENCHMARKS.get(cat, []):
            if b not in suggested_benchmarks:
                suggested_benchmarks.append(b)
        for s in _CATEGORY_STANDARDS.get(cat, []):
            if s not in suggested_standards:
                suggested_standards.append(s)

    return {
        "is_food_industry": is_food,
        "confidence": round(confidence, 3),
        "detected_categories": list(matched_categories.keys()),
        "matched_keywords": all_matched[:20],  # Cap at 20
        "suggested_benchmarks": suggested_benchmarks,
        "suggested_standards": suggested_standards,
    }


def detect_food_sub_sector(
    column_names: List[str],
    sample_values: Optional[List[Dict[str, Any]]] = None,
) -> Optional[str]:
    """
    Try to determine the specific food sub-sector from data context.
    Returns one of: "肉制品", "乳制品", "调味品", "速冻食品", "烘焙食品", "饮料", or None.
    """
    sub_sector_keywords = {
        "肉制品": ["肉制品", "猪肉", "牛肉", "鸡肉", "火腿", "香肠", "腊肉"],
        "乳制品": ["乳制品", "牛奶", "酸奶", "奶粉", "乳清", "干酪"],
        "调味品": ["调味品", "酱油", "醋", "味精", "鸡精", "蚝油", "调味"],
        "速冻食品": ["速冻", "冷冻", "水饺", "汤圆", "冻品"],
        "烘焙食品": ["烘焙", "面包", "蛋糕", "饼干", "糕点"],
        "饮料": ["饮料", "果汁", "茶饮", "碳酸", "矿泉水"],
    }

    combined = " ".join(str(c) for c in column_names)
    if sample_values:
        for row in sample_values[:5]:
            for val in row.values():
                if isinstance(val, str):
                    combined += " " + val

    best_sector = None
    best_count = 0
    for sector, keywords in sub_sector_keywords.items():
        count = sum(1 for kw in keywords if kw in combined)
        if count > best_count:
            best_count = count
            best_sector = sector

    return best_sector if best_count >= 1 else None
