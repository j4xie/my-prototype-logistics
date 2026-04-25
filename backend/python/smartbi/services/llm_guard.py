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


# Apr 25 2026 quality audit C-rec 7: Customers misinterpret numbers because the
# AI doesn't label them. Two specific bugs caught:
#   Q14: AI said "monthly anomaly peak ¥3.19M" but DB net was ¥2.29M (gross
#        vs net = 39% off). Customer made wrong cost decisions.
#   Q12: AI said "65.0%" but the basis was amount; bills% was 55.8%. Customer
#        thought it was bill share and miscalibrated channel investment.
# Fix: force every numeric mention to carry a basis label.
LABELING_GUARD_CLAUSE = (
    "\n\n数字标注强制规则（违反将被视为错误答案）：\n"
    "1. **金额数字必须标注口径**：写到 ¥/元 时必须紧跟 [毛] 或 [净]（毛=折扣前/含税"
    "/应收，净=折后/到账/实收），除非数据上下文已注明该数字是'营业额'/'应收'/'实收'/"
    "'到账'等明确口径词。\n"
    "   反面：'营业额 3,190,000 元'  正面：'营业额 3,190,000 元（毛/应收口径）'\n"
    "2. **百分比必须标注分母基准**：写到 % 时必须紧跟 [按营业额]/[按订单数]/[按笔数]/"
    "[按客流] 等基准说明，除非上下文已经显式说明该比例的分母。\n"
    "   反面：'堂食占 65.0%'  正面：'堂食占 65.0%（按营业额）'\n"
    "3. 当数据 dict 中有 _label / _basis / share_amount_pct / share_bills_pct 等字段时，"
    "必须采用其中文标注，不要省略；当 has_cost_data=false 或 inferred=true 时，必须在"
    "答案中明确说明'未含成本'或'推断分类'。\n"
    "4. 同一个比例如果同时有按金额和按笔数两种基准（例如 channel_analysis.share_pct 是按营业额，"
    "share_bills_pct 是按笔数），请同时陈述两个数字并标注，避免读者误读。"
)


# Apr 25 2026 quality audit C-rec 8+9: 9/14 audited template insights had no
# actionable recommendation. Customer reads "Top 5 dishes" but doesn't know
# what to do next. The Apr 23 Week 5 agent layer (Dashboard) scored 5/5 on
# action_rec by following spec §4.3 — concrete店名+数字+收益区间+前置条件.
# Port that pattern to chat-stream / drill-down / general-analysis prompts.
ACTION_REC_GUARD_CLAUSE = (
    "\n\n可执行建议强制规则（违反将被视为不合格回答）：\n"
    "1. 回答必须以可执行的建议结尾，不能仅描述数据。每条建议必须同时满足：\n"
    "   (a) 具体对象 — 指明 [具体店名/品类/菜品/员工/客群/渠道]，禁止笼统的'重点关注'/'加强管理';\n"
    "   (b) 数字化收益 — 含 [收益区间]，例如 '预计提升营业额 3-5%' / '节约成本 5-10万/月' /"
    " '降低退单率 2 个百分点';\n"
    "   (c) 前置条件 — 写明 [需先做什么]，例如 '先完成服务员推销话术培训' /"
    " '需要区域经理确认营销预算上限' / '上传当月折扣明细';\n"
    "   (d) 时间窗口 — 写明 [实施时长]，例如 '本月内' / '下季度' / '14 天试点'。\n"
    "2. 禁止输出空泛建议，下列措辞会被视为无效：\n"
    "   '建议优化经营策略' / '加强营销' / '提高服务质量' / '提升运营效率' /"
    " '扩大客源' / '密切关注' / '建立长效机制'。\n"
    "3. 若数据不足以支撑明确建议，则坦诚说明 '当前数据无法推荐具体行动，建议先 [补充 X 数据来源]'，\n"
    "   并指出补充什么样的字段或维度后即可给出建议。"
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
