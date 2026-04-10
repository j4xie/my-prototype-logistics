"""Temporal comparison — YoY/QoQ/MoM analysis based on POS time series.

Wraps :class:`TemporalComparator` from :mod:`smartbi.shared.temporal_comparator`.
The comparator auto-degrades the comparison mode based on data availability:
  - ≥13 months → YoY (year-over-year)
  - 6-12 months → QoQ (quarter-over-quarter)
  - 3-5 months → MoM (month-over-month)
  - <3 months → mode="insufficient" (still returned, not raised)

Requires both a date column AND a group column (default "门店名称") in the
DataFrame.

Supported params:
  - ``pos_df``: pandas DataFrame
  - ``datetime_col`` (default "开单时间")
  - ``revenue_col`` (default "实收额")
  - ``group_col`` (default "门店名称")
"""
from __future__ import annotations

import time
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


class TemporalComparisonHandler(AbstractSectionHandler):
    """Wraps :class:`TemporalComparator` for the section pipeline."""
    section_name = "temporal_comparison"

    DEFAULT_GROUP_COL = "门店名称"

    def __init__(self) -> None:
        # Comparators are stateless apart from group_col, so we cache one per
        # group_col value to avoid reinit overhead in the common case.
        self._comparators_by_group: dict[str, Any] = {}

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()

        # NOTE: explicit `is None` checks — pandas DataFrames raise ValueError
        # on `or` / truthiness.
        pos_df = context.get("pos_df")
        if pos_df is None:
            pos_df = request.params.get("pos_df")
        if pos_df is None:
            return self.skipped(request, "未提供 POS DataFrame", started)

        datetime_col = request.params.get("datetime_col", "开单时间")
        revenue_col = request.params.get("revenue_col", "实收额")
        group_col = request.params.get("group_col", self.DEFAULT_GROUP_COL)

        if not hasattr(pos_df, "columns"):
            return self.skipped(request, "pos_df 不是 DataFrame (缺 columns 属性)", started)
        if datetime_col not in pos_df.columns:
            return self.skipped(request, f"POS 缺列 {datetime_col!r}", started)
        if revenue_col not in pos_df.columns:
            return self.skipped(request, f"POS 缺列 {revenue_col!r}", started)
        if group_col not in pos_df.columns:
            return self.skipped(request, f"POS 缺分组列 {group_col!r}", started)

        try:
            comparator = self._get_comparator(group_col)
        except Exception as e:
            return self.skipped(request, f"无法构建 TemporalComparator: {e}", started)

        try:
            report = comparator.compare(
                df=pos_df,
                date_col=datetime_col,
                metric_cols=[revenue_col],
            )
        except Exception as e:
            return self.skipped(request, f"temporal comparison 失败: {e}", started)

        if hasattr(report, "to_dict"):
            data = report.to_dict()
        elif isinstance(report, dict):
            data = report
        else:
            return self.skipped(
                request,
                f"temporal comparison 返回非 dict 类型: {type(report).__name__}",
                started,
            )

        return self.ok(request, data=data, started=started)

    def _get_comparator(self, group_col: str):
        """Lazy-build + cache TemporalComparator per group_col."""
        comparator = self._comparators_by_group.get(group_col)
        if comparator is None:
            from smartbi.shared.temporal_comparator import TemporalComparator
            comparator = TemporalComparator(group_col=group_col)
            self._comparators_by_group[group_col] = comparator
        return comparator
