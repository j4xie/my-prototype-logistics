r"""Combo string parser — splits a POS line blob into per-item tuples.

Week 2 Day 3 of Unified Data Layer v1 spec (§2.2 fact_pos_item note).

Input examples (from qhj 2025 data):
    "#招牌青花椒味(单人份)#_1份*58+#米饭#_1份*3+#可乐#_1份*8"
    "招牌青花椒_1份*58+米饭_1份*3"      # no # delimiters
    "青花椒味(单人份)_1.5份*58.5"       # decimals
    "招牌_1份*58+盘子坏了_空盘*0"       # partial unparseable

Output: a list of `ComboItem` — one per successfully parsed piece, plus
unparsed pieces kept as placeholders with `parse_ok=False` and the raw
text in `source_raw` so Silver can write them to fact_pos_item with
product_id=NULL (see migration 2026_04_29_silver_facts.sql).

Design decisions:
- Split on `+` first (qhj combos are `+`-separated), then regex-match each
  piece. This loses edge cases where a product name contains `+` (rare in
  practice — none in qhj 2025) but keeps the parser simple and auditable.
- Regex is per the spec §2.2: `#?([^#]+)#?_(\d+(?:\.\d+)?)份?\*(\d+(?:\.\d+)?)`
- amount = qty * unit_price derived; not trusted from the string.
- Empty/whitespace combo → empty list (not an error).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional


_ITEM_RE = re.compile(
    r"^\s*"
    r"#?(?P<name>[^#]+?)#?"          # name, non-greedy so trailing `#` is optional
    r"_"                             # underscore separator
    r"(?P<qty>\d+(?:\.\d+)?)"        # quantity (int or decimal)
    r"份?"                            # optional 份 qualifier
    r"\*"                            # asterisk separator
    r"(?P<price>\d+(?:\.\d+)?)"      # unit price (int or decimal)
    r"\s*$"
)


@dataclass(frozen=True)
class ComboItem:
    """One parsed (or unparsed) piece of a combo string."""
    name: Optional[str]
    qty: Optional[float]
    unit_price: Optional[float]
    amount: Optional[float]
    source_raw: str     # original piece (with surrounding whitespace stripped)
    parse_ok: bool


def parse_combo(combo: Optional[str]) -> List[ComboItem]:
    """Split + regex-match a combo string. Returns [] for empty input.

    Callers should treat parse_ok=False items by writing them to
    fact_pos_item with product_id=NULL + source_item_raw=<source_raw>.
    """
    if combo is None:
        return []
    s = combo.strip()
    if not s:
        return []

    pieces = [p.strip() for p in s.split("+") if p.strip()]
    items: List[ComboItem] = []
    for piece in pieces:
        m = _ITEM_RE.match(piece)
        if m is None:
            items.append(ComboItem(
                name=None, qty=None, unit_price=None, amount=None,
                source_raw=piece, parse_ok=False,
            ))
            continue
        name = m.group("name").strip()
        try:
            qty = float(m.group("qty"))
            unit_price = float(m.group("price"))
        except ValueError:
            # Regex matched but float parse somehow failed — shouldn't happen
            # given the \d+ anchor, but be safe.
            items.append(ComboItem(
                name=None, qty=None, unit_price=None, amount=None,
                source_raw=piece, parse_ok=False,
            ))
            continue
        items.append(ComboItem(
            name=name,
            qty=qty,
            unit_price=unit_price,
            amount=round(qty * unit_price, 2),
            source_raw=piece,
            parse_ok=True,
        ))
    return items
