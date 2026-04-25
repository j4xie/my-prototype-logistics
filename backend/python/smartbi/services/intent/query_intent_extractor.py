"""Extract N / frequency / role signals from natural-language queries.

Apr 24 2026 — C-quality.md C-rec 12 + Direction 1 backlog.

Background
----------
AIQuery historically routed queries to materialized templates without
parsing structured intent — every "Top N" returned the template's hard
default (usually 10), 按月/按周 was ignored, and "Top 5 服务员" vs "Top 5
收银员" returned identical results because the staff_performance template
materializes a single role column at upload time.

This module deterministically extracts three orthogonal signals so the
chat router and downstream renderers can honor user intent without an
LLM round-trip:

    "Top 5 服务员"        → {n: 5, role: 'staff:waiter'}
    "前 3 名厨师"          → {n: 3, role: 'staff:chef'}
    "按月销售趋势"         → {frequency: 'monthly'}
    "Top 5 服务员按月业绩" → {n: 5, role: 'staff:waiter', frequency: 'monthly'}
    "畅销品 Top 5"         → {n: 5}                  (no role/freq)
    "一般查询"             → {}                       (no signals)

Design notes
------------
* Pure regex/keyword — no LLM, <1ms typical. Safe to call on every query.
* `n` clamped to [1, 100]: 999 / -1 / 0 are rejected so a typo can't
  blow up downstream slicing.
* Role taxonomy mirrors `_ROLE_COLS` in templates/staff_performance.py
  so callers can map back: 'staff:waiter' → '服务员', 'staff:cashier' →
  '收银员', 'staff:chef' → '厨师', 'staff:manager' → '店长'.
* Frequency vocabulary covers both "按X" and "每X" / "X度" Chinese forms
  plus daily/weekly/monthly/yearly English equivalents.
* `extract_intent` always returns a `QueryIntent` (TypedDict). Empty
  dict is the no-signal sentinel — callers should default-fallback.
"""
from __future__ import annotations

import re
from typing import Optional, TypedDict


class QueryIntent(TypedDict, total=False):
    """Structured intent signals extracted from a natural-language query.

    All keys are optional. Use ``.get(key, default)`` when consuming.
    """

    n: int
    """Top-N count requested (1..100). Use template default when absent."""

    frequency: str
    """Time granularity: 'daily' | 'weekly' | 'monthly' | 'yearly'."""

    role: str
    """Staff role identifier (templates/staff_performance.py taxonomy):
       'staff:waiter' | 'staff:cashier' | 'staff:chef' | 'staff:manager'.
    """


# ── N extraction ────────────────────────────────────────────────────
# Order matters: first match wins. Most specific patterns first.
_N_PATTERNS = [
    # Chinese: 前 5 / 前5 / 前5名 / 前5个 / 首5
    re.compile(r'(?:前|首)\s*(\d+)\s*(?:名|个|位|项|款|家|条)?'),
    # English: Top 10 / top-5 / TOP_3
    re.compile(r'[Tt][Oo][Pp]\s*[-_]?\s*(\d+)'),
    # 排前5 / 排名 5
    re.compile(r'排\s*(?:前|名)?\s*(\d+)'),
]

# ── Frequency extraction ────────────────────────────────────────────
# Map from Chinese keyword (or English literal) → canonical bucket.
# Lookup is substring-based so longer keywords don't shadow each other
# (ordering by length ensures '按月份' matches before '月').
_FREQ_MAP = {
    # daily
    '按日': 'daily', '每日': 'daily', '日均': 'daily',
    '日维度': 'daily', '日粒度': 'daily', 'daily': 'daily',
    # weekly
    '按周': 'weekly', '每周': 'weekly', '周维度': 'weekly',
    '周粒度': 'weekly', 'weekly': 'weekly',
    # monthly
    '按月': 'monthly', '每月': 'monthly', '月度': 'monthly',
    '月维度': 'monthly', '月粒度': 'monthly', '按月份': 'monthly',
    'monthly': 'monthly',
    # yearly
    '按年': 'yearly', '每年': 'yearly', '年度': 'yearly',
    '年维度': 'yearly', 'yearly': 'yearly', 'annual': 'yearly',
}

# Pre-sort by descending length so longer keywords match first
# ('按月份' before '按月', '日维度' before '按日').
_FREQ_KEYWORDS_SORTED = sorted(_FREQ_MAP.keys(), key=len, reverse=True)


# ── Role extraction ─────────────────────────────────────────────────
# Each entry: (pattern, canonical_role_id). Pattern uses alternation so
# any synonym triggers the role. Longer/more specific patterns first.
_ROLE_PATTERNS = [
    # Cashier (收银员/收银) — more specific than 服务员
    (re.compile(r'收银员|收银'), 'staff:cashier'),
    # Chef (厨师/后厨/烹饪/主厨)
    (re.compile(r'厨师|主厨|后厨|烹饪'), 'staff:chef'),
    # Manager (店长/经理/管理者) — must precede 服务员 since 经理 is unrelated
    (re.compile(r'店长|店经理|经理|管理者'), 'staff:manager'),
    # Waiter / front-of-house (服务员/餐厅服务/前厅/迎宾)
    (re.compile(r'服务员|餐厅服务|前厅|迎宾'), 'staff:waiter'),
]


def extract_intent(query: Optional[str]) -> QueryIntent:
    """Parse N / frequency / role signals from a natural-language query.

    Args:
        query: User-typed query string. ``None`` / empty ⇒ ``{}``.

    Returns:
        ``QueryIntent`` with whichever of ``n``, ``frequency``, ``role``
        keys were detected. Empty dict means no signals — caller should
        use template defaults.

    Examples:
        >>> extract_intent("Top 5 服务员")
        {'n': 5, 'role': 'staff:waiter'}
        >>> extract_intent("按月营业额")
        {'frequency': 'monthly'}
        >>> extract_intent("")
        {}
    """
    intent: QueryIntent = {}
    if not query:
        return intent

    q = query.strip()
    if not q:
        return intent

    # ── N ──────────────────────────────────────────────────────────
    for pat in _N_PATTERNS:
        m = pat.search(q)
        if m:
            try:
                n_val = int(m.group(1))
            except (ValueError, IndexError):
                continue
            # Sanity bound: 0/negative/>100 are nonsensical for top-N.
            if 1 <= n_val <= 100:
                intent['n'] = n_val
                break

    # ── Frequency ──────────────────────────────────────────────────
    q_lower = q.lower()
    for keyword in _FREQ_KEYWORDS_SORTED:
        # Chinese keywords match raw; English keywords match case-folded.
        if keyword.isascii():
            if keyword in q_lower:
                intent['frequency'] = _FREQ_MAP[keyword]
                break
        else:
            if keyword in q:
                intent['frequency'] = _FREQ_MAP[keyword]
                break

    # ── Role ───────────────────────────────────────────────────────
    for pat, role in _ROLE_PATTERNS:
        if pat.search(q):
            intent['role'] = role
            break

    return intent


# ── Helper: map role id back to Chinese column name ─────────────────
# Mirrors templates/staff_performance.py _ROLE_COLS preference order.
ROLE_TO_COLUMN = {
    'staff:waiter': '服务员',
    'staff:cashier': '收银员',
    'staff:chef': '厨师',
    'staff:manager': '店长',
}


def role_to_column(role: Optional[str]) -> Optional[str]:
    """Translate canonical role id ('staff:waiter') back to the Chinese
    column name ('服务员') used by template materialization.

    Returns ``None`` if role is unknown / not provided.
    """
    if not role:
        return None
    return ROLE_TO_COLUMN.get(role)
