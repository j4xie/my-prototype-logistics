"""Classify 桌位 values into table types.

Real data from qhj upload 4169:
  - 无桌位(美团外卖) / 无桌位(饿了么外卖) / 无桌位(京东外卖) → 外卖
  - 纯数字 1/2/17/23 → 大厅
  - 带包厢/VIP/贵宾 → 包厢
  - null/空 → 未知
"""
from __future__ import annotations

import re

_TAKEAWAY_RE = re.compile(r'^无桌位\(.*外卖.*\)$')
_VIP_KEYWORDS = ["包厢", "VIP", "贵宾", "雅间", "包间"]
_NUMERIC_RE = re.compile(r'^[A-Za-z]?\d+[A-Za-z]?$')  # 1, 23, 12A, A1, C30, B11 — dine-in tables with section-letter prefix  # noqa: E501


def classify_table(value: str | None) -> str:
    """Returns one of: 外卖/包厢/大厅/散客/未知"""
    if not value or not isinstance(value, str):
        return "未知"
    v = value.strip()
    if not v:
        return "未知"
    if _TAKEAWAY_RE.match(v):
        return "外卖"
    for kw in _VIP_KEYWORDS:
        if kw in v:
            return "包厢"
    if _NUMERIC_RE.match(v):
        return "大厅"
    return "散客"  # fallback for other formats
