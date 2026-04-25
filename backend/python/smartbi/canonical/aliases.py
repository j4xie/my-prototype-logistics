"""Canonical 字段别名表. 单一 source of truth.

数据织网 A v1.4 §3.0 Day 1 任务: 把 _ALIAS_TO_ATTR 从 scripts/backfill_silver.py
搬到这里, 让 capability/* 模块不依赖 scripts/.

v1.0 (2026-04-25): 初始搬家 + Day 0 audit 决策 (option 2) 加 product_summary 字段:
- product_name / product_code / category / revenue / qty_sold / unit_price
- product_unit / refund_qty / refund_amount / service_fee / tax
"""
from __future__ import annotations
from typing import Dict


# 中文/英文别名 → canonical 字段 (snake_case English)
ALIAS_TO_ATTR: Dict[str, str] = {
    # ====== 现有 (来自 backfill_silver.py 原 _ALIAS_TO_ATTR) ======

    # store
    "store_name": "store_name",
    "门店": "store_name",
    "门店名称": "store_name",
    "店铺": "store_name",
    "shop_name": "store_name",

    # bill no — qhj uses 账单号; other customers use 订单号 / 单号
    "source_bill_no": "source_bill_no",
    "bill_no": "source_bill_no",
    "order_no": "source_bill_no",
    "订单号": "source_bill_no",
    "单号": "source_bill_no",
    "账单号": "source_bill_no",
    "结账号": "source_bill_no",
    "外部单号": "source_bill_no",

    # date
    "date": "date",
    "日期": "date",
    "营业日期": "date",
    "transaction_date": "date",
    "交易日期": "date",
    "order_date": "date",

    # staff
    "staff_name": "staff_name",
    "收银员": "staff_name",
    "服务员": "staff_name",
    "销售员": "staff_name",

    # bill-level amounts
    "gross_amount": "gross_amount",
    "应收金额": "gross_amount",
    "营业额": "gross_amount",
    "原价": "gross_amount",
    "商品折前金额": "gross_amount",
    "折前金额": "gross_amount",  # v1.0 加 (RES_GML_001)

    "discount_amount": "discount_amount",
    "优惠金额": "discount_amount",
    "折扣金额": "discount_amount",
    "折扣额": "discount_amount",
    "代金券优惠": "discount_amount",
    "分摊优惠": "discount_amount",  # v1.0 加 (xmx)

    "net_amount": "net_amount",
    "实收金额": "net_amount",
    "实收额": "net_amount",
    "商品折后金额": "net_amount",
    "净额": "net_amount",
    "折后金额": "net_amount",  # v1.0 加 (RES_GML_001 / xmx)

    "actual_receive": "actual_receive",
    "收款金额": "actual_receive",
    "实收": "actual_receive",

    # counts
    "customer_count": "customer_count",
    "人数": "customer_count",
    "就餐人数": "customer_count",
    "客流量": "customer_count",

    # metadata
    "table_no": "table_no",
    "桌号": "table_no",
    "桌位": "table_no",

    "order_type": "order_type",
    "订单类型": "order_type",

    "channel_origin": "channel_origin",
    "来源": "channel_origin",
    "订单来源": "channel_origin",

    # combo string (qhj 商品信息 是 bill-level blob)
    "combo_string": "combo_string",
    "菜品明细": "combo_string",
    "商品": "combo_string",
    "商品信息": "combo_string",
    "订单明细": "combo_string",

    # ====== v1.0 新增 product_summary 维度 (Day 0 audit option 2) ======

    # 产品名 / 编码 / 分类 (单行 = 单产品 = product_summary shape)
    "product_name": "product_name",
    "商品名称": "product_name",
    "菜品名称": "product_name",
    "菜品名": "product_name",
    "商品名": "product_name",

    "product_code": "product_code",
    "商品编码": "product_code",
    "菜品编号": "product_code",
    "sku_code": "product_code",

    "category": "category",
    "商品分类": "category",
    "菜品分类": "category",
    "分类": "category",
    "商品类型": "category",  # 可能是更细的 "餐饮商品"/"打包类", 但归 category

    # 销售额 (product_summary shape 的金额, 行级 NOT 账单级)
    "revenue": "revenue",
    "销售金额": "revenue",
    "营业收入": "revenue",
    "对应收入": "revenue",

    # 销量 / 单价 / 单位
    "qty_sold": "qty_sold",
    "数量": "qty_sold",
    "销量": "qty_sold",
    "单卖数量": "qty_sold",
    "单卖数量(不含套餐子商品)": "qty_sold",  # xmx 真实列名

    "unit_price": "unit_price",
    "销售单价": "unit_price",
    "单价": "unit_price",
    "销售价": "unit_price",

    "product_unit": "product_unit",
    "单位": "product_unit",
    "unit": "product_unit",

    # 退货 (product_summary 含)
    "refund_qty": "refund_qty",
    "退货数量": "refund_qty",
    "退货数量(不含套餐子商品)": "refund_qty",  # xmx 真实
    "退货量": "refund_qty",

    "refund_amount": "refund_amount",
    "实退金额": "refund_amount",
    "退款金额": "refund_amount",

    # POS bill 扩展 (RES_GML_001 实际有这些)
    "service_fee": "service_fee",
    "服务费": "service_fee",

    "tax": "tax",
    "税费": "tax",

    "tip": "tip",
    "小费": "tip",

    "invoice_amount": "invoice_amount",
    "开发票额": "invoice_amount",
}


def to_canonical(raw_column: str) -> str | None:
    """中文/英文列名 → canonical. 无映射返 None."""
    return ALIAS_TO_ATTR.get(raw_column)
