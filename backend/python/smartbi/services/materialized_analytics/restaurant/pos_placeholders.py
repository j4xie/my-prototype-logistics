"""POS-system placeholder name denylist (Apr 25 2026 D1.C4).

Some POS exports record system pseudo-entries in person/product columns:
  - 服务员/销售员 cells contain "收银" / "点菜" / "系统" (role-label noise
    or auto-generated user names from the POS terminal)
  - 商品名 cells contain "打包盒" / "餐位费" / "外卖费" (system fee items
    that aren't real dishes)

When templates aggregate "Top N staff" / "Top N products" without filtering
these out, customers see things like "Top 1 服务员: 收银" which destroys
trust ("the system is making things up").

Apr 25 audit C-quality.md Q8 confirmed: staff_performance reported "共 3 位
服务员" when only 1 was a real human (the other 2 were 收银 / 点菜
placeholder rows). Q9 / Q4 had similar issues for product surfaces.

This module owns the canonical denylist. Templates should import via
  from ..restaurant.pos_placeholders import (
      POS_STAFF_PLACEHOLDERS, POS_PRODUCT_PLACEHOLDERS,
      filter_placeholder_rows,
  )
"""
from __future__ import annotations

from typing import Any, Dict, Iterable, List, Set


# Person-role placeholders. Cell value = role label or generic system name,
# not a real human. Already mostly covered by staff_performance._ROLE_NAME_NOISE
# but extracted here so other surfaces (kitchen_dispatch, monthly_anomaly when
# breaking down by 服务员, member_consumption staff column) can reuse.
POS_STAFF_PLACEHOLDERS: Set[str] = {
    # Role labels used as cell values (data-entry error / merged cells)
    "收银", "收银员", "服务员", "销售员", "厨师", "店长", "经理",
    "店员", "员工", "点菜", "点单员", "后厨", "前厅", "外卖员",
    "服务生", "主管", "收银台", "大堂", "兼职", "临时工",
    # Meta-rows
    "合计", "总计", "小计", "汇总", "总和", "平均",
    # Common generic placeholders
    "默认", "系统", "无", "未知", "暂无", "test", "Test", "TEST",
    "default", "Default", "DEFAULT", "服务员系统", "收银员系统",
}

# Product/dish placeholders. Cell value = packaging fee / utility item,
# not a real menu item. Already mostly covered by item_parser._SYSTEM_NAMES
# (filtered when parsing 商品信息) but needed for templates that read
# 商品名称/菜品名称 columns directly (combo_usage_rate strategy B,
# kitchen_dispatch_heatmap, purchase_inventory_inflow).
POS_PRODUCT_PLACEHOLDERS: Set[str] = {
    # 餐具/包装 (外卖流水常见)
    "无需餐具", "需要餐具", "不需餐具", "餐具",
    # 包装盒
    "打包盒", "大打包盒", "中打包盒", "小打包盒",
    "打包盒大", "打包盒中", "打包盒小",
    "外卖包装费", "包装费", "餐盒费",
    # 费用项 (非菜品)
    "餐位费", "开瓶费", "茶位费", "服务费", "外卖费", "配送费",
    # Generic placeholders
    "默认商品", "测试商品", "系统商品", "未命名",
    # Meta-rows
    "合计", "总计", "小计", "汇总",
}


def filter_placeholder_rows(
    rows: List[Dict[str, Any]],
    name_key: str = "name",
    placeholders: Set[str] = POS_PRODUCT_PLACEHOLDERS,
) -> List[Dict[str, Any]]:
    """Strip rows whose name_key value matches a known placeholder.

    Trims whitespace + strips '#' (signature marker) before comparison.
    Keeps original list order.
    """
    out = []
    for r in rows:
        v = r.get(name_key)
        if v is None:
            out.append(r)
            continue
        norm = str(v).strip().strip("#").strip()
        if norm in placeholders:
            continue
        out.append(r)
    return out


def is_placeholder_value(value: Any, placeholders: Set[str]) -> bool:
    """Return True if a single cell value matches a placeholder."""
    if value is None:
        return False
    norm = str(value).strip().strip("#").strip()
    return norm in placeholders


def filter_placeholder_names(
    names: Iterable[str],
    placeholders: Set[str] = POS_PRODUCT_PLACEHOLDERS,
) -> List[str]:
    """Return list of names with placeholders removed."""
    return [n for n in names if not is_placeholder_value(n, placeholders)]
