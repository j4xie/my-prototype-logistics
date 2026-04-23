"""LLM hallucination guard — detects numeric claims in an answer that
exceed the maximum value present in the provided aggregate context.

Primary mode observed in prod (Apr 24 2026, qhj_prod RES_3101_009):
  "Top 5 门店合计 3.4 亿元" on a dataset where real 总营收 ≈ 36M.
  ~9× inflation, pure hallucination from LLM extrapolating the 200-row
  sample rather than citing the authoritative agg block.

Two layers of defense:

  1. NUMERIC_GUARD_CLAUSE — appended to analyst system_role in chat.py.
     Instructs the model not to multiply/extrapolate beyond the aggregate
     context, and bans the "亿" unit unless the context actually contains
     a ≥100M value.

  2. detect_numeric_hallucination() — post-check on the completed answer.
     Extracts the max numeric value from the agg block, scans the answer
     for `\\d+亿` / `\\d+千万` patterns, flags if the claimed value
     exceeds max_agg × overshoot_factor (default 2×).

Callers decide what to do with a violation — log, attach a warning to the
response payload, strip the offending passage, etc. This module only
detects; it never rewrites the answer.
"""
from __future__ import annotations

import re
from typing import Iterable, List, Optional


NUMERIC_GUARD_CLAUSE = (
    "\n\n数字引用强制规则（违反将被视为错误答案）：\n"
    "1. 答案中每一个具体数字都必须能从提供的'全量数据聚合'或'数据概览'中直接读到，"
    "严禁乘法、外推、估算或'大约'式的推算。\n"
    "2. 不得在答案中提及超过上下文中最大'总计/合计/总营收'的数字。\n"
    "3. 禁止将万元/千元换算成'亿'，除非聚合段中明确出现 ≥100,000,000（1亿）的数字。\n"
    "4. 若用户问的指标未在上下文中出现，直接回答'此数据未提供'，不要自行估算。"
)


_HALLUC_PATTERN = re.compile(r"([-+]?\d+(?:\.\d+)?)\s*(亿|千万)")
_NUMBER_PATTERN = re.compile(r"([-+]?\d+(?:,\d{3})*(?:\.\d+)?)")

_OVERSHOOT_FACTOR = 2.0
_MIN_AGG_BASELINE = 10_000.0


def _unit_multiplier(unit: str) -> float:
    if unit == "亿":
        return 100_000_000.0
    if unit == "千万":
        return 10_000_000.0
    return 1.0


def extract_max_agg_value(agg_lines: Optional[Iterable[str]]) -> float:
    """Return the largest numeric value present in any of the agg lines.

    Commas are treated as thousands separators. Lines are formatted by the
    chat.py stream path like:
        "- 实收金额 总计: 29,498,641.23 (行数=140541)"
        "- Top by 门店: 青花椒=9,500,000.00, 大丸=2,000,000.00"
    Taking the max over every number on every line approximates the
    largest figure the LLM has been given — a safe upper bound for the
    "the answer should not exceed this" sanity check.
    """
    if not agg_lines:
        return 0.0
    max_v = 0.0
    for line in agg_lines:
        if not line:
            continue
        for m in _NUMBER_PATTERN.finditer(line):
            raw = m.group(1).replace(",", "")
            try:
                v = abs(float(raw))
            except ValueError:
                continue
            if v > max_v:
                max_v = v
    return max_v


def detect_numeric_hallucination(
    answer: str,
    agg_lines: Optional[Iterable[str]],
    *,
    overshoot: float = _OVERSHOOT_FACTOR,
) -> Optional[str]:
    """Scan `answer` for 亿/千万 claims that exceed max(agg_lines) × overshoot.

    Returns a human-readable Chinese violation string, or None if the
    answer is clean / the aggregates are too small to judge against.

    Overshoot default 2× catches the observed 9× inflation comfortably
    while staying clear of honest rounding (e.g. 9,500万 stated as 近1亿
    is 1.05× — within tolerance).
    """
    if not answer:
        return None

    max_agg = extract_max_agg_value(agg_lines)
    if max_agg < _MIN_AGG_BASELINE:
        return None

    violations: List[str] = []
    for m in _HALLUC_PATTERN.finditer(answer):
        value_raw, unit = m.group(1), m.group(2)
        try:
            claimed = float(value_raw) * _unit_multiplier(unit)
        except ValueError:
            continue
        if claimed > max_agg * overshoot:
            violations.append(
                f"{m.group(0)}（≈{claimed:,.0f} 元，聚合中最大值仅 {max_agg:,.0f} 元）"
            )

    if not violations:
        return None
    return "疑似数字幻觉（LLM 输出的金额超出聚合上下文范围）：" + "；".join(violations)
