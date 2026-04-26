"""Shared row-parsing helpers for Silver writers.

Extracted from product_summary / review / finance / inventory writers to remove
copy-paste drift. Behavior preserved: ``unwrap_row`` returns ``{}`` (NOT
``{"_raw": raw}``) on JSON decode failure to match every original writer's
local helper. ``to_float`` accepts an explicit ``default`` so callers preserve
their original 0.0-vs-None semantics — see writer-by-writer notes:

- product_summary_writer: ``to_float(v, default=0.0)``  (qty/revenue default 0)
- finance_writer:         ``to_float(v, default=0.0)``  (debit/credit default 0)
- review_writer:          ``to_float(v, default=None)`` (rating None means 'no rating')
- inventory_writer:       ``to_float(v, default=None)`` (stock_qty None means 'unknown')
"""
from __future__ import annotations

import json
import re
from datetime import date, datetime
from typing import Any, Dict, Optional, Tuple

from smartbi.canonical.aliases import ALIAS_TO_ATTR


_DATE_FORMATS = (
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%Y-%m-%d %H:%M:%S",
    "%Y/%m/%d %H:%M:%S",
)

_WHITESPACE_RE = re.compile(r"\s+")


def unwrap_row(raw: Any) -> Dict[str, Any]:
    """Unwrap smart_bi_dynamic_data.row_data (JSON str / dict / other) to dict."""
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except (ValueError, TypeError):
            return {}
    return {}


def canonical_value(row: Dict[str, Any], canonical: str) -> Optional[Any]:
    """Look up canonical-attr value, walking ALIAS_TO_ATTR raw-key aliases first."""
    for raw_key, attr in ALIAS_TO_ATTR.items():
        if attr != canonical:
            continue
        if raw_key in row and row[raw_key] not in (None, ""):
            return row[raw_key]
    if canonical in row and row[canonical] not in (None, ""):
        return row[canonical]
    return None


def to_float(value: Any, default: Optional[float] = None) -> Optional[float]:
    """Coerce to float; return ``default`` on None/empty/non-numeric."""
    if value is None or value == "":
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def to_date(value: Any) -> Optional[date]:
    """Coerce date / datetime / str (Y-m-d / Y/m/d / + H:M:S) to date."""
    if value is None or value == "":
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        for fmt in _DATE_FORMATS:
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
    return None


def pick(row: Dict[str, Any], keys: Tuple[str, ...]) -> Optional[Any]:
    """Return the first non-None / non-empty value from ``row`` across ``keys``."""
    for k in keys:
        if k in row and row[k] not in (None, ""):
            return row[k]
    return None


def normalize_text(text: str) -> str:
    """Strip all whitespace + lowercase — used for case-insensitive equality."""
    if text is None:
        return ""
    return _WHITESPACE_RE.sub("", str(text)).lower()
