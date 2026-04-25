"""Spec §4.3 compliant action recommendation formatter (K2 / C-rec 8).

Background
----------
C-quality.md C-rec 8 found 9/14 audited template insight_text strings
ended with vague "建议优化经营策略" or no recommendation at all.
I2 (commit e2ac5ee2c) added ACTION_REC_GUARD_CLAUSE for LLM-routed surfaces
but deterministic templates' hardcoded Chinese strings were untouched.

Standardized format ensures all template insights end with concrete next
steps that satisfy spec §4.3:
  对象  : <specific store/staff/dish/segment>
  收益  : <pct or yuan range>
  前置  : <prerequisite action>
  时间  : <implementation window>

If data insufficient for any field, use placeholder per spec
('数据待补' / '需先 X').
"""
from __future__ import annotations


def format_action_rec(
    object_target: str,
    benefit_range: str,
    prerequisite: str,
    timeline: str,
) -> str:
    """Build a spec §4.3 compliant action recommendation string.

    Example
    -------
    >>> format_action_rec(
    ...     object_target="青花椒徐汇日月光店",
    ...     benefit_range="客单价提升 3-5%",
    ...     prerequisite="服务员推销话术培训",
    ...     timeline="本月内",
    ... )
    '建议: 针对【青花椒徐汇日月光店】客单价提升 3-5% (前置: 服务员推销话术培训, 本月内完成)'
    """
    return (
        f"建议: 针对【{object_target}】{benefit_range} "
        f"(前置: {prerequisite}, {timeline}完成)"
    )


def format_data_insufficient(
    needed: str,
    next_action: str = "补充数据来源",
) -> str:
    """When data is insufficient for a concrete recommendation, fall back to honest signal.

    Example
    -------
    >>> format_data_insufficient(
    ...     needed="补充门店客单价对标数据",
    ...     next_action="联系产品组对接行业基准",
    ... )
    '建议: 数据不足以推荐具体行动,需先补充门店客单价对标数据 (后续动作: 联系产品组对接行业基准)'
    """
    return (
        f"建议: 数据不足以推荐具体行动,需先{needed} "
        f"(后续动作: {next_action})"
    )
