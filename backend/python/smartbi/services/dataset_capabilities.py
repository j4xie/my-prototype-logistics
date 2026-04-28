"""Detect what a dataset's field schema can/cannot answer — UX-2 fix.

Background: S4 audit + UX deep-dive showed sparse-data tenants (xmx with only
member-card fields, no sales/review) get LLM "建议补充数据" non-answers when
users ask cross-domain questions. Example: xmx-fu-29-2 "单店 vs 区域同业差距"
got "现有数据未涉及区域同业对比" — 11s wait for nothing actionable.

Fix: classify dataset capabilities once at field-meta load time. Pass a
"本数据集不含 X 字段" hint to the LLM prompt so it stops trying to answer
cross-domain queries — instead, it tells the user "本数据无 X 字段, 可基于
现有 Y 数据做相关分析" upfront.

This is read-only inspection of field_meta. No DB changes. ~50ms work,
massive UX lift on sparse tenants.
"""
from __future__ import annotations

from dataclasses import dataclass


# Capability detection: keyword in field name → capability flag.
# Field names are usually Chinese (e.g. "营业额" / "会员卡号" / "评分") but real
# Excel uploads from finance teams often use English/pinyin names (e.g.
# "net_profit_3", "gross_margin", "actual_revenue", "vip_count"). Apr 27 2026
# QA audit (F1): finance dataset with `net_profit_3` was misclassified as
# "no finance" → all 营收/利润 queries got rejected. Fix: include English +
# pinyin synonyms for each capability.
#
# Each entry's keyword is matched as substring against lowercase field name.
# So "net_profit_3" matches "profit", "actual_revenue" matches "revenue".
_CAPABILITY_KEYWORDS: dict[str, list[str]] = {
    'has_sales':    [
        '销售', '营业额', '销售额', '营收', '收入', '销量', '订单',
        # English / pinyin
        'sales', 'revenue', 'order', 'turnover', 'gmv', 'invoice',
        'xiaoshou', 'yingshou',
    ],
    'has_member':   [
        '会员', '客户', '用户', 'vip', '充值', '储值', '余额', '积分',
        # English / pinyin
        'member', 'customer', 'user', 'recharge', 'balance', 'point',
        'huiyuan',
    ],
    'has_review':   [
        '评价', '评论', '评分', '星级', '差评', '好评',
        # English / pinyin
        'review', 'rating', 'star', 'comment', 'feedback', 'pingjia',
    ],
    'has_dish':     [
        '菜品', '商品', '产品', '菜', '套餐', '主食', '小吃', '饮品', '酒水',
        # English / pinyin
        'dish', 'product', 'item', 'sku', 'menu', 'caipin',
    ],
    'has_store':    [
        '门店', '店铺', '分店', '店名',
        # English / pinyin
        'store', 'shop', 'branch', 'outlet', 'mendian',
    ],
    'has_time':     [
        '日期', '时间', '月份', '年份', '周', '时段', '午市', '晚市',
        '早市', '夜市', '工作日', '周末',
        # English / pinyin
        'time', 'date', 'month', 'year', 'week', 'day', 'period',
        'riqi', 'shijian',
    ],
    'has_payment':  [
        '支付', '付款', '微信', '支付宝', '现金',
        # English / pinyin
        'payment', 'pay', 'cash', 'wechat', 'alipay', 'zhifu',
    ],
    'has_channel':  [
        '渠道', '美团', '饿了么', '抖音', '点评',
        # Apr 28 2026 (P3 backlog): restaurant industry — 堂食 (dine-in) and
        # 外卖 (takeout/delivery) are channel categories. Without these keys,
        # B5-style queries "堂食外卖占比" route to short-circuit "channel
        # 字段不存在" even when the dataset has 堂食_实际收入 + 外卖_实际收入.
        '堂食', '外卖', '到店', '到家', '自提',
        # English / pinyin
        'channel', 'platform', 'meituan', 'eleme', 'douyin', 'dianping',
        'qudao', 'tangshi', 'waimai', 'dinein', 'takeout', 'delivery',
    ],
    'has_staff':    [
        '员工', '服务员', '收银员', '厨师',
        # English / pinyin
        'staff', 'employee', 'waiter', 'cashier', 'chef', 'yuangong',
    ],
    'has_finance':  [
        '利润', '毛利', '成本', '费用', '损益',
        # English / pinyin (finance teams use English heavily — F1 audit)
        'profit', 'margin', 'cost', 'expense', 'loss',
        'net_profit', 'gross_margin', 'gross_profit', 'net_income',
        'lirun', 'maoli', 'chengben',
    ],
    'has_inventory':[
        '库存', '进货', '采购',
        # English / pinyin
        'inventory', 'stock', 'purchase', 'kucun', 'caigou',
    ],
    'has_promotion':[
        '促销', '优惠', '折扣', '满减',
        # English / pinyin
        'promotion', 'discount', 'coupon', 'voucher', 'youhui', 'cuxiao',
    ],
}


# Apr 27 2026 (F1) + Apr 28 2026 (F1.1): strip trailing period suffixes
# from field names before keyword matching. Excel multi-sheet pivot exports
# produce columns like:
#   "net_profit_1" / "net_profit_2" / "net_profit_3" — period index
#   "net_profit_v2" — version tag
#   "revenue_M1" / "revenue_M12" — month tag
#   "revenue_Q1" / "revenue_Y2024" — quarter / year
#   "revenue_2024Q1" — year+quarter combo
#   "revenue (1)" / "revenue (2)" — Excel duplicate column rename
# Without stripping, AI capability check fails to recognize "net_profit_3"
# as a finance field. Strip these tags before keyword match.
import re as _re

# Multiple suffix patterns, applied in order until none match. Each strips
# ONE suffix per pass so layered suffixes (rare but possible) get cleaned:
#   "net_profit_2024Q1_v2" → strip _v2 → strip _2024Q1 → "net_profit"
#
# Apr 28 2026 (post-review P2): tightened period regex to reject invalid
# values (Q5/Q9/M0/M13/W54/etc) which previously matched and got stripped.
# Real-world impact small (base name still matches keywords), but reduces
# noise on diagnostic logs and avoids false-positive period detection.
_SUFFIX_PATTERNS = [
    _re.compile(r'\s*\(\d+\)$'),                              # Excel dedup: " (1)"
    _re.compile(r'_v\d+$'),                                    # Version: _v2 _v10
    _re.compile(r'_\d{4}[Qq][1-4]$'),                          # Year+Q1-4: _2024Q1
    _re.compile(r'_\d{4}[Mm](?:0?[1-9]|1[0-2])$'),             # Year+M01-12: _2024M3
    _re.compile(r'_[Yy]\d{2,4}$'),                             # Year only: _Y2024 _Y24
    _re.compile(r'_[Qq][1-4]$'),                               # Quarter: _Q1-Q4
    _re.compile(r'_[Mm](?:0?[1-9]|1[0-2])$'),                  # Month: _M01-M12 (no _M0/_M13)
    _re.compile(r'_[Ww](?:[1-9]|[1-4]\d|5[0-3])$'),            # Week: _W1-W53 (no _W0/_W54)
    _re.compile(r'_\d+$'),                                     # Plain index: _3 _12
]


def _normalize_field_name(name: str) -> str:
    """Lowercase + strip trailing period/version/index suffix.

    Multi-period pivot artifacts: net_profit_3, revenue_v2, revenue_M1,
    revenue_2024Q1, revenue (1) all normalize to base name.
    """
    n = (name or '').lower().strip()
    for _ in range(3):  # cap iterations to avoid pathological loops
        before = n
        for pat in _SUFFIX_PATTERNS:
            n = pat.sub('', n)
        if n == before:
            break
    return n


# Human-readable labels for prompt hint
_CAPABILITY_LABELS: dict[str, str] = {
    'has_sales':    '销售/营业额',
    'has_member':   '会员/储值',
    'has_review':   '评价/评分',
    'has_dish':     '菜品/商品',
    'has_store':    '门店/店铺',
    'has_time':     '时间/日期',
    'has_payment':  '支付方式',
    'has_channel':  '渠道/平台',
    'has_staff':    '员工/服务员',
    'has_finance':  '利润/成本',
    'has_inventory':'库存/采购',
    'has_promotion':'促销/优惠',
}


@dataclass
class DatasetCapabilities:
    """What a dataset can/cannot analyze."""
    capabilities: dict[str, bool]
    field_count: int

    def has(self, cap: str) -> bool:
        return self.capabilities.get(cap, False)

    def absent_caps(self) -> list[str]:
        """List of (label) capabilities the dataset does NOT have."""
        return [
            _CAPABILITY_LABELS[k]
            for k, v in self.capabilities.items()
            if not v and k in _CAPABILITY_LABELS
        ]

    def present_caps(self) -> list[str]:
        return [
            _CAPABILITY_LABELS[k]
            for k, v in self.capabilities.items()
            if v and k in _CAPABILITY_LABELS
        ]


def detect_capabilities(field_meta: list[dict]) -> DatasetCapabilities:
    """Inspect field_meta to determine what queries this dataset can answer.

    field_meta entries should have 'original_name' (Chinese field name).

    Apr 27 2026 (F1): each name is lowercased + trailing _N suffix stripped,
    then matched against bilingual (Chinese/English/pinyin) keyword lists.
    Catches finance-team uploads with `net_profit_3` / `gross_margin_2` /
    `actual_revenue` style headers that previously fell through.
    """
    if not field_meta:
        return DatasetCapabilities(capabilities={}, field_count=0)
    # Keep BOTH the normalized form (for keyword match) AND the raw lowercase
    # form (so e.g. "vip" still matches "vip" exactly even though it has no
    # _N suffix). Match against either is enough.
    norm_names = [_normalize_field_name(str(f.get('original_name') or ''))
                  for f in field_meta]
    raw_names = [str(f.get('original_name') or '').lower()
                 for f in field_meta]
    caps: dict[str, bool] = {}
    for cap, keywords in _CAPABILITY_KEYWORDS.items():
        caps[cap] = any(
            any(kw in fname for kw in keywords)
            for fname in (norm_names + raw_names)
        )
    return DatasetCapabilities(capabilities=caps, field_count=len(field_meta))


# Apr 26 2026 v7 #2: maps query domain (from cache_intent_classifier) → required
# capability flag. Used by short-circuit logic.
_QUERY_DOMAIN_TO_CAP: dict[str, str] = {
    'dish':       'has_dish',
    'store':      'has_store',
    'channel':    'has_channel',
    'time':       'has_time',
    'payment':    'has_payment',
    'member':     'has_member',
    'review':     'has_review',
    'staff':      'has_staff',
    'finance':    'has_finance',
    'inventory':  'has_inventory',
    'promotion':  'has_promotion',
    # 'category' / 'anomaly' / 'refund' / quality/equipment/production: no
    # 1-1 capability mapping yet → don't short-circuit, let LLM try.
}


def should_short_circuit(query_domain: Optional[str], caps: DatasetCapabilities) -> Optional[str]:
    """If query_domain has a known capability requirement that this dataset
    lacks, return a short-circuit message string. Else return None (proceed
    to LLM normally).

    Returns None when:
    - query_domain unknown / undetectable
    - query_domain has no capability mapping (let LLM try)
    - dataset has the required capability
    - dataset has 0 fields (don't short-circuit on no-data state)

    Returns a markdown message when there's a hard mismatch (saves ~10s LLM
    call for queries the data physically can't answer).
    """
    if not query_domain or caps.field_count == 0:
        return None
    required_cap = _QUERY_DOMAIN_TO_CAP.get(query_domain)
    if not required_cap or caps.has(required_cap):
        return None
    # Hard mismatch — give actionable message instead of LLM round-trip.
    domain_label = _CAPABILITY_LABELS.get(required_cap, required_cap)
    present = caps.present_caps()
    msg_parts = [
        f"## 数据范围说明\n",
        f"本数据集**不含 {domain_label}** 字段，无法回答关于「{query_domain}」的分析。",
    ]
    if present:
        msg_parts.append(
            f"\n\n**当前数据集包含**: {', '.join(present[:5])}"
            + ("，等" if len(present) > 5 else "")
            + "。"
        )
        msg_parts.append(
            f"\n\n**建议**: 换问与上述维度相关的问题，"
            f"或上传含 {domain_label} 字段的数据后重试。"
        )
    return "".join(msg_parts)


def build_capability_prompt_hint(caps: DatasetCapabilities) -> str:
    """Build a one-section prompt hint describing dataset boundaries.

    Returns empty string if field_meta was empty.

    Format:
        ## 数据集能力边界 (回答必须遵守)
        本数据集**包含**: 销售/营业额, 时间/日期, 菜品/商品
        本数据集**不含**: 会员/储值, 评价/评分, 利润/成本, ...

        如用户问的字段不在"包含"列表, 请明确说"本数据集不含 X 字段, 但可
        基于现有 Y 数据回答相关问题..." 不要瞎答, 不要建议"上传 X 数据"
        (用户已知道, 不需要重复提醒).
    """
    if caps.field_count == 0:
        return ""
    present = caps.present_caps()
    absent = caps.absent_caps()
    if not present and not absent:
        return ""
    lines = ["## 数据集能力边界 (回答必须遵守)"]
    if present:
        lines.append(f"本数据集**包含**: {', '.join(present)}")
    if absent:
        lines.append(f"本数据集**不含**: {', '.join(absent)}")
    lines.append(
        "如用户问的内容涉及'不含'类字段, 请说一句"
        "'本数据无 X, 基于现有 Y 数据补充分析:' 然后给基于 Y 的真实回答. "
        "禁止建议'请补充 X 数据'(用户已知, 重复提醒无价值)."
    )
    return "\n".join(lines) + "\n"
