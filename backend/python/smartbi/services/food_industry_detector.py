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
    "预制菜", "料理包", "半成品菜",
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

_RESTAURANT_KEYWORDS = {
    # POS / sales columns
    "门店名称", "商品分类", "商品名称", "商品编码", "点单方式",
    "单卖数量", "套餐子商品", "套餐内销量", "退货数量",
    "销售金额", "折后金额", "实收", "分摊优惠", "收入分组",
    "餐饮商品", "餐饮",
    # Procurement columns
    "入库仓库", "供应商", "原料分类", "入库数量", "原料名称",
    # Dining-specific
    "翻台率", "客单价", "堂食", "外卖", "锅底", "小料", "涮品",
    "桌均", "上座率", "出餐",
    # Extended sub-sector signals
    "牛排", "意面", "寿司", "刺身", "海鲜", "面馆",
    # Milk tea / coffee signals
    "奶茶", "茶饮", "咖啡", "拿铁", "果茶", "出杯",
}

# Category → keywords mapping
_CATEGORY_KEYWORDS: Dict[str, set] = {
    "financial": _FINANCIAL_KEYWORDS,
    "food_specific": _FOOD_SPECIFIC_KEYWORDS,
    "production": _PRODUCTION_KEYWORDS,
    "traceability": _TRACEABILITY_KEYWORDS,
    "restaurant": _RESTAURANT_KEYWORDS,
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
    "restaurant": [
        "food_cost_ratio", "labor_cost_ratio", "average_ticket",
        "combo_attachment_rate", "discount_rate", "restaurant_net_margin",
    ],
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
    "restaurant": [
        "GB 31654-2021 餐饮服务通用卫生规范",
        "大众点评必吃榜评选标准",
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
    Two-pass: specific restaurant types first, then food-processing, then generic restaurant fallback.
    """
    # Specific restaurant sub-sectors (checked first for specificity)
    # Order matters: more-specific sectors checked before broader ones
    _restaurant_sub_sectors = {
        "火锅": ["火锅", "锅底", "涮品", "鸳鸯锅", "毛肚", "鸭血"],
        "鱼类餐饮": ["砂锅鱼", "烤鱼", "酸菜鱼", "花椒鱼", "青花椒"],
        "烧烤": ["烧烤", "烤肉", "烤串", "撸串"],
        "快餐": ["快餐", "简餐", "盖饭", "便当", "豆浆", "餐点", "粥", "早餐"],
        "奶茶": ["奶茶", "新茶饮", "茶饮", "果茶", "珍珠", "波霸", "冰沙", "奶盖", "蜜雪", "茶百道", "古茗", "喜茶", "奈雪", "沪上阿姨", "杯"],
        "咖啡": ["咖啡", "拿铁", "美式", "卡布奇诺", "espresso", "手冲", "冷萃", "瑞幸", "星巴克", "库迪", "咖啡豆", "coffee"],
        "西餐": ["西餐", "牛排", "意面", "披萨", "沙拉", "西式", "Pasta", "Pizza", "Antipasti"],
        "牛肉面": ["牛肉面", "牛肉拉面", "牛大", "汤面", "拌面", "面馆", "面食", "招牌主食"],
        "中式海鲜": ["海鲜", "龙虾", "螃蟹", "鲍鱼", "生蚝", "海鲜大排档", "中华海鲜", "海鲜制造"],
        "日料": ["日料", "寿司", "刺身", "天妇罗", "居酒屋", "御", "日式料理", "和食"],
    }

    # Food processing sub-sectors
    _processing_sub_sectors = {
        "肉制品": ["肉制品", "猪肉", "牛肉", "鸡肉", "火腿", "香肠", "腊肉"],
        "乳制品": ["乳制品", "牛奶", "酸奶", "奶粉", "乳清", "干酪"],
        "调味品": ["调味品", "酱油", "醋", "味精", "鸡精", "蚝油", "调味"],
        "速冻食品": ["速冻", "冷冻", "水饺", "汤圆", "冻品"],
        "烘焙食品": ["烘焙", "面包", "蛋糕", "饼干", "糕点"],
        "饮料": ["饮料", "果汁", "茶饮", "碳酸", "矿泉水"],
        "预制菜": ["预制菜", "预制", "即热", "即烹", "即配", "即食", "料理包", "半成品菜", "复热", "中央厨房", "净菜"],
    }

    combined = " ".join(str(c) for c in column_names)
    if sample_values:
        for row in sample_values:
            for val in row.values():
                if isinstance(val, str):
                    combined += " " + val

    # Pass 1: specific restaurant sub-sectors (require >=2 keyword matches for confidence)
    best_sector = None
    best_count = 0
    second_count = 0
    for sector, keywords in _restaurant_sub_sectors.items():
        count = sum(1 for kw in keywords if kw in combined)
        if count > best_count:
            second_count = best_count
            best_count = count
            best_sector = sector
        elif count > second_count:
            second_count = count
    # Require >=2 matches, or >=1 with clear dominance (no second candidate)
    if best_count >= 2 or (best_count >= 1 and second_count == 0):
        return best_sector

    # Pass 2: food processing sub-sectors
    best_sector = None
    best_count = 0
    for sector, keywords in _processing_sub_sectors.items():
        count = sum(1 for kw in keywords if kw in combined)
        if count > best_count:
            best_count = count
            best_sector = sector
    if best_count >= 1:
        return best_sector

    # Pass 3: generic restaurant fallback
    restaurant_signals = ["门店名称", "餐饮商品", "点单方式", "堂食", "外卖"]
    if sum(1 for kw in restaurant_signals if kw in combined) >= 1:
        return "餐饮连锁"

    return None


def detect_available_dimensions(
    column_names: List[str],
    has_date: bool = False,
    has_store: bool = False,
    has_category: bool = False,
    has_procurement: bool = False,
) -> List[Dict[str, Any]]:
    """
    Report which analysis dimensions are available vs missing based on detected columns.
    Returns a list of dimension hints for frontend display.
    """
    dimensions = [
        {
            "key": "menuQuadrant",
            "label": "菜品四象限",
            "available": True,  # Always available if product+amount cols exist
            "requiredCols": "商品名称, 实收/销售金额",
        },
        {
            "key": "storeComparison",
            "label": "门店对比",
            "available": has_store,
            "requiredCols": "门店名称",
            "hint": "上传数据需包含「门店名称」列" if not has_store else None,
        },
        {
            "key": "categoryConcentration",
            "label": "品类集中度",
            "available": has_category,
            "requiredCols": "商品分类",
            "hint": "上传数据需包含「商品分类」列" if not has_category else None,
        },
        {
            "key": "trendAnalysis",
            "label": "趋势分析",
            "available": has_date,
            "requiredCols": "日期/交易日期/订单时间",
            "hint": "上传数据需包含日期列（如「日期」「交易日期」「订单时间」）以启用趋势分析" if not has_date else None,
        },
        {
            "key": "timePeriodAnalysis",
            "label": "时段分析",
            "available": has_date,  # needs datetime with time component; actual availability checked at runtime
            "requiredCols": "含时间的日期列（如「订单时间 2024-01-15 12:30:00」）",
            "hint": "上传数据的日期列需包含时间信息（时:分）以启用午市/晚市等时段分析" if not has_date else None,
        },
        {
            "key": "storeEfficiencyMatrix",
            "label": "门店效率矩阵",
            "available": has_store and has_category,
            "requiredCols": "门店名称, 商品名称",
            "hint": "需同时包含「门店名称」和「商品名称」列" if not (has_store and has_category) else None,
        },
        {
            "key": "supplyChainAnalysis",
            "label": "供应链分析",
            "available": has_procurement,
            "requiredCols": "供应商, 入库数量/入库金额",
            "hint": "上传采购数据（含「供应商」「入库数量」列）可启用供应链分析" if not has_procurement else None,
        },
    ]
    # Filter out None hints
    for d in dimensions:
        if "hint" in d and d["hint"] is None:
            del d["hint"]
    return dimensions


def detect_restaurant_chain(
    column_names: List[str],
    sample_values: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Detect if data represents restaurant chain POS/procurement data.

    Returns:
        {
            "is_restaurant_chain": bool,
            "chain_type": str,       # sub-sector name
            "store_count": int,      # unique store count if detectable
            "has_procurement": bool,  # procurement data present
            "data_type": "sales"|"procurement"|"mixed"
        }
    """
    col_set = set(str(c).strip() for c in column_names)
    combined = " ".join(col_set)

    # Sales signal: 门店名称 + 商品名称 + (销售金额 or 实收)
    sales_signals = {"门店名称", "商品名称"}
    sales_amount_signals = {"销售金额", "实收", "折后金额"}
    has_sales = sales_signals.issubset(col_set) and bool(sales_amount_signals & col_set)

    # Procurement signal: 供应商 + (原料名称 or 商品名称) + (入库数量 or 入库金额)
    proc_col_signals = {"供应商"}
    proc_amount_signals = {"入库数量", "入库金额", "采购金额"}
    has_procurement = bool(proc_col_signals & col_set) and bool(proc_amount_signals & col_set)

    if not has_sales and not has_procurement:
        # Fallback: check broad restaurant keywords
        restaurant_kw = ["餐饮商品", "点单方式", "堂食", "外卖", "套餐子商品"]
        if sum(1 for kw in restaurant_kw if kw in combined) < 2:
            return {
                "is_restaurant_chain": False,
                "chain_type": "",
                "store_count": 0,
                "has_procurement": False,
                "data_type": "",
            }

    # Detect store count from sample data
    store_count = 0
    if sample_values and has_sales:
        stores = set()
        store_col = "门店名称"
        for row in sample_values:
            val = row.get(store_col, "")
            if isinstance(val, str) and val.strip():
                stores.add(val.strip())
        store_count = len(stores)

    # Determine data type
    if has_sales and has_procurement:
        data_type = "mixed"
    elif has_procurement:
        data_type = "procurement"
    else:
        data_type = "sales"

    chain_type = detect_food_sub_sector(column_names, sample_values) or "餐饮连锁"

    return {
        "is_restaurant_chain": True,
        "chain_type": chain_type,
        "store_count": store_count,
        "has_procurement": has_procurement,
        "data_type": data_type,
    }
