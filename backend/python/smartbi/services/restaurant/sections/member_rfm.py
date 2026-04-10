"""Member RFM analysis section — wraps MemberRfmAnalyzer.

Mirrors analyzer.py:426-442. Requires a list of pre-aggregated member dicts
with fields ``member_id``, ``last_order_days_ago``, ``order_count``,
``total_amount`` (see MemberRfmAnalyzer.analyze for the expected schema).

The handler does not parse raw POS orders — for that the caller should call
``MemberRfmAnalyzer.analyze_from_orders()`` upstream and pass the resulting
member list in via ``params['members']``.
"""
from __future__ import annotations

import time
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


class MemberRfmHandler(AbstractSectionHandler):
    """Wraps :class:`MemberRfmAnalyzer` for the section pipeline.

    Inputs:
      - ``request.params['members']`` (preferred) — list of member dicts
      - ``context['members']`` — fallback for batch mode where the upstream
        loader stages the member list once and reuses across sections
      - ``request.params['as_of_date']`` — optional, defaults to ``request.period``

    Skipped if no members are supplied.
    """
    section_name = "member_rfm"

    def __init__(self) -> None:
        self._analyzer = None

    def _get_analyzer(self):
        if self._analyzer is None:
            from smartbi.services.restaurant.member_rfm import MemberRfmAnalyzer
            self._analyzer = MemberRfmAnalyzer()
        return self._analyzer

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()

        members = request.params.get("members")
        if members is None:
            members = context.get("members")
        if not members:
            return self.skipped(request, "未提供 members 列表", started)

        as_of_date = request.params.get("as_of_date") or request.period

        try:
            report = self._get_analyzer().analyze(
                members=members,
                as_of_date=as_of_date,
            )
        except Exception as e:
            return self.skipped(request, f"member_rfm 运行失败: {e}", started)

        if hasattr(report, "to_dict"):
            data = report.to_dict()
        elif isinstance(report, dict):
            data = dict(report)
        else:
            return self.skipped(
                request,
                f"member_rfm 返回非 dict 类型: {type(report).__name__}",
                started,
            )

        return self.ok(request, data=data, started=started)
