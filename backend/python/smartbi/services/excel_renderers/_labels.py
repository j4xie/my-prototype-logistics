"""i18n label dict for revenue report renderer.

Externalized per spec §7.1 — labels passed as parameter, NOT hardcoded in
Python source. Adding a new language = adding a new top-level dict key.
Renderer is i18n-agnostic; it only reads keys.
"""

LABELS = {
    "zh-CN": {
        "title":             "收入管理报表",
        "block1_title":      "可比同比",
        "block2_title":      "环比",
        "block3_title":      "堂食外卖占比",
        "block4_title":      "客单人数分析",
        "store_name":        "门店名称",
        "total_summary":     "汇总实际收入",
        "dine_in":           "堂食",
        "takeout":           "外卖",
        "current":           "本期",
        "prev_yoy":          "去年同期",
        "prev_mom":          "环比",
        "ratio_yoy":         "同比率",
        "ratio_mom":         "环比率",
        "actual_revenue":    "实际收入",
        "no_data":           "—",
        "no_yoy_data":       "需要 2024 数据",
        # Block 3 specific (label aligned to reference xlsx: 收入比例)
        "revenue_ratio":     "收入比例",
        "bill_ratio_label":  "客单比例",
        "bill_count_label":  "客单量",
        # Block 4 columns
        "diner_count":       "客单人数",
        "bill_count":        "客单量",
        "bill_ratio":        "客单占比",
        "total_items":       "点单份数",
        "avg_items":         "人均点单数量",
        "revenue":           "实收额",
        "revenue_per_diner": "实际人均",
        "revenue_per_item":  "份均消费",
        "block4_revenue_ratio": "营业额占比",
        "total_row":         "总计",
    },
}
