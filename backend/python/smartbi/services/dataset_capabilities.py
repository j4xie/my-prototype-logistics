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
# Field names are Chinese (e.g. "营业额" / "会员卡号" / "评分"). We check each
# field's lowercased name for capability keywords.
_CAPABILITY_KEYWORDS: dict[str, list[str]] = {
    'has_sales':    ['销售', '营业额', '销售额', '营收', '收入', '销量', '订单'],
    'has_member':   ['会员', '客户', '用户', 'vip', '充值', '储值', '余额', '积分'],
    'has_review':   ['评价', '评论', '评分', '星级', '差评', '好评'],
    'has_dish':     ['菜品', '商品', '产品', '菜', '套餐'],
    'has_store':    ['门店', '店铺', '分店', '店名'],
    'has_time':     ['日期', '时间', '月份', '年份', '周', 'time', 'date'],
    'has_payment':  ['支付', '付款', '微信', '支付宝', '现金'],
    'has_channel':  ['渠道', '美团', '饿了么', '抖音', '点评'],
    'has_staff':    ['员工', '服务员', '收银员', '厨师'],
    'has_finance':  ['利润', '毛利', '成本', '费用', '损益'],
    'has_inventory':['库存', '进货', '采购'],
    'has_promotion':['促销', '优惠', '折扣', '满减'],
}


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
    """
    if not field_meta:
        return DatasetCapabilities(capabilities={}, field_count=0)
    field_names_lower = [
        str(f.get('original_name') or '').lower()
        for f in field_meta
    ]
    caps: dict[str, bool] = {}
    for cap, keywords in _CAPABILITY_KEYWORDS.items():
        caps[cap] = any(
            any(kw in fname for kw in keywords)
            for fname in field_names_lower
        )
    return DatasetCapabilities(capabilities=caps, field_count=len(field_meta))


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
