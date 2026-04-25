"""Template status + unlock suggestions for capability layer.

Per 数据织网/02-A-能力驱动渲染.md §4.2.
"""
from __future__ import annotations
from collections import defaultdict
from typing import Any

from smartbi.capability.contract import RequiresSpec


def get_registry():
    """Lazy import to avoid eager pandas/numpy load at module import time.

    Tests mock this symbol via patch('smartbi.capability.template_status.get_registry').
    """
    from smartbi.services.materialized_analytics.templates.registry import (
        get_registry as _get_registry,
    )
    return _get_registry()


def compute_template_status(available: set[str]) -> dict[str, dict]:
    """对每个已注册 template 算 (satisfied, missing) 状态.

    Templates without a `requires` ClassVar (or with requires=None) are
    treated as DEFERRED — Phase 2/B-stage work pending. Output:
      {satisfied: null, missing: [], deferred: true}
    """
    status: dict[str, dict] = {}
    for tpl in get_registry().all():
        requires = getattr(tpl, "requires", None)
        if requires is None:
            status[tpl.code] = {"satisfied": None, "missing": [], "deferred": True}
            continue
        sat = requires.is_satisfied_by(available)
        missing = requires.missing_fields(available)
        status[tpl.code] = {"satisfied": sat, "missing": missing}
    return status


def suggest_unlocks(
    available: set[str],
    template_status: dict[str, dict],
) -> list[dict]:
    """对每个未满足的 template, 按缺失字段聚合, 返回 top 5 建议.

    Algorithm:
    1. Collect all missing-field → unlocked-template mappings (skip deferred + satisfied)
    2. Group by missing field, list templates that would unlock when field becomes available
    3. Sort by unlocks_count desc
    4. Return top 5 with CTA strings
    """
    field_to_templates: dict[str, list[str]] = defaultdict(list)
    for code, st in template_status.items():
        if st.get("deferred") or st.get("satisfied"):
            continue
        for missing_field in st["missing"]:
            field_to_templates[missing_field].append(code)

    suggestions: list[dict] = []
    for missing_field, template_codes in field_to_templates.items():
        if not template_codes:
            continue
        examples = template_codes[:3]
        cta = _generate_cta(missing_field, len(template_codes))
        suggestions.append({
            "missing_field": missing_field,
            "unlocks_count": len(template_codes),
            "unlocks_examples": examples,
            "cta": cta,
        })

    suggestions.sort(key=lambda x: -x["unlocks_count"])
    return suggestions[:5]


# v1.5 spec §4.2: covers 13 bill_flow + 13 product_summary canonical fields (26 total).
# B-stage adds: review_text, rating, payment_channel, voucher_code, etc.
_FIELD_TO_HINT = {
    # bill_flow 13
    "date": "上传账单流水或交易日报",
    "source_bill_no": "上传账单流水",
    "store_name": "上传带'门店名称'列的数据",
    "staff_name": "上传带'收银员/服务员'列的数据",
    "gross_amount": "上传含'应收金额/营业额'的订单数据",
    "discount_amount": "上传带'优惠金额'列的订单数据",
    "net_amount": "上传含'实收金额'的订单数据",
    "actual_receive": "上传带'收款金额'列的数据",
    "customer_count": "上传含'就餐人数'的数据",
    "table_no": "上传带'桌号'列的订单数据",
    "order_type": "上传带'订单类型'列的数据",
    "channel_origin": "上传带'订单来源'列的数据",
    "combo_string": "上传含'商品信息/订单明细'的订单数据",
    # product_summary 13 (v1.5 Day 0 audit)
    "product_name": "上传含'商品名称/菜品名称'列的数据",
    "product_code": "上传带'商品编码'列的数据",
    "category": "上传带'商品分类'列的数据",
    "revenue": "上传含'销售金额/营业收入'的数据",
    "qty_sold": "上传含'数量/销量'列的数据",
    "unit_price": "上传带'销售单价'列的数据",
    "product_unit": "上传带'单位'列的数据",
    "refund_qty": "上传带'退货数量'列的数据",
    "refund_amount": "上传带'退款金额'列的数据",
    "service_fee": "上传带'服务费'列的数据",
    "tax": "上传带'税费'列的数据",
    "tip": "上传带'小费'列的数据",
    "invoice_amount": "上传带'开发票额'列的数据",
}


def _generate_cta(missing_field: str, count: int) -> str:
    """生成人类可读 CTA. spec L-4 + S-v3-5: 26 canonical 字段全覆盖.

    B-stage 引入新字段时同步扩展此字典 (spec §13 S-v3-5 implementer 责任).
    Unknown field falls back to localized message (not raw English).
    """
    hint = _FIELD_TO_HINT.get(missing_field)
    if hint is None:
        hint = f"上传含 '{missing_field}' 字段的数据 (待补充字段中文别名)"
    return f"{hint} 即可解锁 {count} 个分析"
