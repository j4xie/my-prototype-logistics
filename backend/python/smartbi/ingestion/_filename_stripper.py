"""Strip 二维火 POS export filename prefix.

Real 二维火 exports are named like::

    20260422101444628_8e07f831c81_营业概况报表（兼容月报表）.csv
    └──── 17-digit ───┘└── hex ──┘└──── Chinese name ──────┘

The timestamp+hash prefix is opaque metadata from the POS portal and gets in
the way of filename-based router dispatch (smartbi.ingestion.pos_router).
This helper strips it so routing can match against the Chinese keyword alone.

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §5.1 step ①
Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task B1
"""
import re

# 17 digits + underscore + hex hash + underscore.
# Anchored at start; non-greedy; count=1 so only the leading prefix is stripped
# even if the filename happens to contain a similarly-shaped substring later.
_PREFIX_RE = re.compile(r"^\d{17}_[a-f0-9]+_")


def strip_pos_prefix(filename: str) -> str:
    """Remove the 17-digit_hash_ POS prefix; pass through unchanged if absent."""
    return _PREFIX_RE.sub("", filename, count=1)
