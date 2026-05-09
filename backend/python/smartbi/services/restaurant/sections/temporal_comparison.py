from __future__ import annotations

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
  - ``revenue_col`` (default "实收")
  - ``group_col`` (default "门店名称")
"""

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

        # FIX (Apr 15 2026): try multiple column candidates instead of single default,
        # so handler works across 大众点评/美团/客如云 export formats which use different
        # column names for the same business concept.
        def _resolve_col(df, explicit, candidates):
            if explicit and explicit in df.columns:
                return explicit
            for c in candidates:
                if c in df.columns:
                    return c
            return explicit or candidates[0]

        if not hasattr(pos_df, "columns"):
            return self.skipped(request, "pos_df 不是 DataFrame (缺 columns 属性)", started)

        datetime_col = _resolve_col(pos_df, request.params.get("datetime_col"),
                                    ["开单时间", "结单时间", "营业日期", "下单时间", "订单时间", "交易时间"])
        revenue_col = _resolve_col(pos_df, request.params.get("revenue_col"),
                                   ["实收", "实收额", "营业额", "应收金额", "实收金额", "总金额"])
        group_col = _resolve_col(pos_df, request.params.get("group_col"),
                                 [self.DEFAULT_GROUP_COL, "门店名称", "店铺名称", "门店", "店铺", "store_name"])

        if datetime_col not in pos_df.columns:
            return self.skipped(request, "POS 缺时间列 (尝试: 开单时间/营业日期/订单时间)", started)
        if revenue_col not in pos_df.columns:
            return self.skipped(request, "POS 缺收入列 (尝试: 实收/营业额/应收金额)", started)
        if group_col not in pos_df.columns:
            return self.skipped(request, "POS 缺分组列 (尝试: 门店名称/store_name)", started)

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
