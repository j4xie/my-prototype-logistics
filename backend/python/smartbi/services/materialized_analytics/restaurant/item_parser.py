"""Parse 商品信息 field from qhj/restaurant order data.

Format: 菜品名_数量单位*单价+菜品名_数量单位*单价+...
Examples:
  #招牌青花椒味(单人份)#_1份*58+咸蛋黄牛蛙_1份*24+成都冒烤鸭(单人份)_1份*70
  娃娃菜_1份*8+乐山把把串_1份*36+可口可乐_1听*6+超大杯杨梅爆柠茶_1份*18

Output: list of dicts with keys: name, quantity, unit, unit_price, total, is_signature, is_system
"""
from __future__ import annotations

import re
from typing import List, Dict, Any, Optional

# Regex: name_qty[unit]*price
# - name: anything up to `_` (greedy backward from the last `_`)
# - qty: integer or decimal
# - unit: optional Chinese single char (份|听|斤|瓶|个|杯|位)
# - price: integer or decimal
_ITEM_RE = re.compile(
    r'^(?P<name>.+?)_(?P<qty>\d+(?:\.\d+)?)(?P<unit>份|听|斤|瓶|个|杯|位)?\*(?P<price>\d+(?:\.\d+)?)$'
)

# System markers to filter (not real dishes)
_SYSTEM_NAMES = {
    # 餐具/包装 (外卖流水常见)
    "无需餐具", "需要餐具", "不需餐具", "#无需餐具#", "#需要餐具#",
    # 包装盒
    "打包盒", "大打包盒", "中打包盒", "小打包盒", "打包盒大", "打包盒中", "打包盒小",
    "外卖包装费", "包装费", "餐盒费",
    # 费用项 (非菜品)
    "餐位费", "开瓶费", "茶位费", "服务费",
    # 主食 — 餐饮用户问"销量 Top 菜品"时通常不想看到米饭/免费赠品
    # (注:这些会从 Top 榜中过滤,但是 parse_items() 仍返回 is_system=True 保留 audit)
    "米饭", "米饭#", "#米饭#", "米饭(碗)", "米饭(份)",
}

# Signature markers
_SIGNATURE_PREFIX_SUFFIX = "#"


def parse_item(token: str) -> Optional[Dict[str, Any]]:
    """Parse a single item token. Returns None if malformed."""
    token = token.strip()
    if not token:
        return None
    m = _ITEM_RE.match(token)
    if not m:
        return None
    name = m.group('name').strip()
    qty = float(m.group('qty'))
    unit = m.group('unit') or ''
    price = float(m.group('price'))

    # Detect signature (surrounded by `#`)
    is_signature = (
        name.startswith(_SIGNATURE_PREFIX_SUFFIX)
        and name.endswith(_SIGNATURE_PREFIX_SUFFIX)
        and len(name) > 2
    )
    clean_name = name.strip('#') if is_signature else name

    # System/filler items
    is_system = clean_name in _SYSTEM_NAMES or clean_name in {n.strip('#') for n in _SYSTEM_NAMES}

    return {
        "name": clean_name,
        "quantity": qty,
        "unit": unit,
        "unit_price": price,
        "total": qty * price,
        "is_signature": is_signature,
        "is_system": is_system,
    }


def parse_items(s: str, include_system: bool = False) -> List[Dict[str, Any]]:
    """Parse full 商品信息 string. Returns list of item dicts (skipping system items by default)."""
    if not s or not isinstance(s, str):
        return []
    tokens = s.split('+')
    out: List[Dict[str, Any]] = []
    for t in tokens:
        item = parse_item(t)
        if item is None:
            continue
        if not include_system and item.get('is_system'):
            continue
        out.append(item)
    return out
