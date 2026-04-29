"""Query-scoped filters for AI chat aggregation.

Per-query filters that can't be cached at upload-level:
  - Time filter: extract YYYY-MM / 月份 mentions from user query and derive
    a SQL WHERE fragment on the upload's time column.
  - Mentioned dims: detect exact dimension names (商品信息, 订单类型 ...) in
    the user query so they can be promoted ahead of the default dims[:4] cap.
  - 商品信息 subcategory: keyword-based classifier that groups combo strings
    like "#招牌青花椒味_1份*58+#米饭_1份*3" into 主食/饮品/小食/套餐 so the
    LLM can answer "饮品销量" questions even though 商品信息 has no explicit
    category column.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple


# ── C1: Time filter ─────────────────────────────────────────────

# Matches 2025-03, 2025/3/15, 2025年3月, 2025 年 3, 3月, 本月, 上月, Q1 ...
_YEAR_PAT = re.compile(r"(20\d{2})\s*(?:年|-|/|\.|)")
_MONTH_PAT = re.compile(r"(?<![0-9])([1-9]|1[0-2])\s*月")
_QUARTER_PAT = re.compile(r"(?:Q|第)\s*([1-4])\s*季?度?", re.IGNORECASE)
_YYYY_MM_PAT = re.compile(r"(20\d{2})[-/年.](0?[1-9]|1[0-2])")


def extract_time_filter(user_query: str) -> Optional[Dict[str, Any]]:
    """Parse year/month/quarter hints from a Chinese user query.

    Returns None when no time hint found; otherwise a dict:
      {
        "year":  "2025" | None,
        "month": "03"   | None,
        "quarter": "Q1" | None,  # only when explicit季度 / Q
        "label": "2025年3月" (for prompt readability),
      }
    """
    if not user_query:
        return None
    q = user_query.strip()

    ym = _YYYY_MM_PAT.search(q)
    if ym:
        year = ym.group(1)
        month = ym.group(2).zfill(2)
        return {"year": year, "month": month, "quarter": None,
                "label": f"{year}年{int(month)}月"}

    year_m = _YEAR_PAT.search(q)
    month_m = _MONTH_PAT.search(q)
    quarter_m = _QUARTER_PAT.search(q)

    year = year_m.group(1) if year_m else None
    month = month_m.group(1).zfill(2) if month_m else None
    quarter = f"Q{quarter_m.group(1)}" if quarter_m else None

    if not (year or month or quarter):
        return None

    parts = []
    if year:
        parts.append(f"{year}年")
    if month:
        parts.append(f"{int(month)}月")
    elif quarter:
        parts.append(quarter)
    return {"year": year, "month": month, "quarter": quarter,
            "label": "".join(parts) or "指定时间段"}


def pick_time_column(field_meta: List[Dict[str, Any]]) -> Optional[str]:
    """Pick the best time column from field_meta.

    Preference order:
      1. is_time=True column whose name contains 营业/交易/订单 (most business-meaningful)
      2. Any is_time=True column (typically the first/primary date column)
    """
    time_cols = [f for f in field_meta if f.get("is_time")]
    if not time_cols:
        return None
    prio_kw = ("营业", "交易", "订单日", "结账日", "经营日", "开单")
    for f in time_cols:
        name = str(f.get("original_name") or "")
        if any(kw in name for kw in prio_kw):
            return name
    return time_cols[0].get("original_name")


def time_where_clause(tf: Dict[str, Any], time_col_param: str,
                      existing_args_count: int) -> Tuple[str, List[Any]]:
    """Build a SQL fragment filtering row_data->>time_col by the time hints.

    Returns (sql_fragment, extra_args). The fragment uses PostgreSQL's regexp
    and substring extraction rather than date casts because row_data->>col is
    text and qhj uses free-form dates like "2025-03-15 12:34:56".

    Note on $N numbering: caller passes `existing_args_count`. We emit params
    starting at $(existing_args_count+1).
    """
    if not tf:
        return "", []
    fragments: List[str] = []
    args: List[Any] = []
    n = existing_args_count
    col_expr = f"row_data->>{time_col_param}"

    if tf.get("year") and tf.get("month"):
        # "2025-03-%" prefix match (covers 2025-03-01, 2025-3-1, 2025/03/01)
        n += 1
        fragments.append(
            f"({col_expr} LIKE ${n} OR {col_expr} LIKE ${n + 1})"
        )
        args.append(f"{tf['year']}-{tf['month']}%")
        n += 1
        args.append(f"{tf['year']}/{tf['month']}%")
    elif tf.get("year"):
        n += 1
        fragments.append(f"{col_expr} LIKE ${n}")
        args.append(f"{tf['year']}%")
    elif tf.get("month"):
        # No year — match any -MM- / /MM/ pattern
        mm = tf["month"]
        n += 1
        fragments.append(
            f"(substring({col_expr} from '[-/](\\d{{1,2}})[-/]') = '{int(mm)}' "
            f"OR substring({col_expr} from '[-/](\\d{{1,2}})[-/]') = '{mm}')"
        )
    if tf.get("quarter"):
        qmap = {"Q1": ("01", "02", "03"), "Q2": ("04", "05", "06"),
                "Q3": ("07", "08", "09"), "Q4": ("10", "11", "12")}
        mons = qmap.get(tf["quarter"])
        if mons:
            ms = ",".join(f"'{m}'" for m in mons)
            fragments.append(
                f"substring({col_expr} from '[-/](\\d{{1,2}})[-/]') IN ({ms})"
            )
    if not fragments:
        return "", []
    return " AND " + " AND ".join(fragments), args


# ── C2: Mentioned dim hoist ─────────────────────────────────────

def hoist_mentioned_dims(user_query: str, dims: List[str]) -> List[str]:
    """Return dims reordered so any dim name mentioned in the user query
    moves to the front. Non-mentioned dims preserve their original order
    after the hoisted ones.

    Example: query="5月大丸百货店的饮品销量" with dims=[门店名称, 省份,
    城市, 品牌, ..., 商品信息] → 商品信息 hoisted to front if mentioned.
    """
    if not user_query or not dims:
        return list(dims)
    q = user_query
    hoisted: List[str] = []
    rest: List[str] = []
    for d in dims:
        if d and d in q:
            hoisted.append(d)
        else:
            rest.append(d)
    if hoisted:
        return hoisted + rest
    return list(dims)


# ── C3: 商品信息 subcategory classifier ──────────────────────────

# Order matters: specific categories before generic (饮品 before 主食).
# Keywords target typical qhj POS composite strings:
#   "#招牌青花椒味(单人份)#_1份*58+#米饭#_1份*3+打包盒_1份*4.5"
_CATEGORY_RULES: List[Tuple[str, List[str]]] = [
    ("饮品", [
        "冰粉", "奶茶", "咖啡", "可乐", "雪碧", "果汁", "椰汁", "豆浆", "柠檬茶",
        "酸梅汤", "茶饮", "奶昔", "乳酸菌", "啤酒", "红酒", "白酒", "鸡尾酒",
        "酒水", "饮料", "饮品", "汽水",
    ]),
    ("甜品", ["糍粑", "红糖", "布丁", "蛋糕", "冰淇淋", "甜品", "甜点"]),
    ("小食", [
        "小酥肉", "鸡翅", "咸蛋黄", "小食", "花生", "毛豆", "凉菜", "泡菜", "酥肉",
    ]),
    ("主食", [
        "米饭", "米粉", "面条", "面粉", "馒头", "饺子", "饼", "主食", "米线", "粉",
    ]),
    ("套餐", ["套餐", "双人套餐", "单人份", "组合", "豪华", "家庭", "优享"]),
    ("锅底/主菜", [
        "鱼锅", "火锅", "青花椒", "水煮", "牛蛙", "牛肉", "羊肉", "鸡肉",
        "排骨", "鱼", "虾", "蟹", "猪", "烤鸭", "烤肉", "红烧",
    ]),
    ("配料/打包", [
        "餐具", "打包盒", "餐包", "小料", "加料", "外送费", "服务费",
        "娃娃菜", "豆腐", "豆腐皮", "粉丝", "笋", "脆笋",
    ]),
]


def classify_product_info(label: str) -> str:
    """Return the highest-priority category matched by keyword search.

    Fallback: "其他" when no category keyword hits.
    """
    if not label:
        return "其他"
    text = str(label)
    for category, kws in _CATEGORY_RULES:
        for kw in kws:
            if kw in text:
                return category
    return "其他"


def user_wants_subcategory(user_query: str) -> Optional[List[str]]:
    """Scan query for explicit subcategory mentions.

    Returns the list of categories the user asked about, or None when none
    found. Callers can use this to decide whether to emit a subcategory
    rollup block into the LLM prompt.
    """
    if not user_query:
        return None
    hits: List[str] = []
    for cat, kws in _CATEGORY_RULES:
        # Top-level category names themselves first (e.g. "饮品")
        if cat in user_query:
            hits.append(cat)
            continue
        # Any keyword inside the category
        for kw in kws[:6]:  # first few keywords = most generic
            if kw in user_query:
                hits.append(cat)
                break
    # Dedupe preserve order
    seen = set()
    uniq = []
    for h in hits:
        if h not in seen:
            seen.add(h)
            uniq.append(h)
    return uniq or None
