from __future__ import annotations

"""Dining time heatmap section — aggregates POS revenue by day-of-week × hour.


Wraps ``DiningPeriodHeatmap.build(df, datetime_col, revenue_col)``. Requires
a POS DataFrame supplied via ``context["pos_df"]`` (batch mode) or
``request.params["pos_df"]`` (standalone mode).

Supported params (all optional, with sensible Chinese-POS defaults):
  - ``pos_df``: pandas DataFrame
  - ``datetime_col`` (default "开单时间")
  - ``revenue_col`` (default "实收额")
"""

import time
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


class DiningHeatmapHandler(AbstractSectionHandler):
    """Wraps :class:`DiningPeriodHeatmap` for the section pipeline."""
    section_name = "dining_heatmap"

    def __init__(self) -> None:
        # Lazy-import to avoid pulling the full restaurant analyzer dependency
        # graph at module load time.
        from smartbi.services.restaurant.dining_period_heatmap import DiningPeriodHeatmap
        self._engine = DiningPeriodHeatmap()

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

        if not hasattr(pos_df, "columns"):
            return self.skipped(request, "pos_df 不是 DataFrame (缺 columns 属性)", started)
        if datetime_col not in pos_df.columns:
            return self.skipped(request, f"POS 缺列 {datetime_col!r}", started)
        if revenue_col not in pos_df.columns:
            return self.skipped(request, f"POS 缺列 {revenue_col!r}", started)

        try:
            report = self._engine.build(
                df=pos_df,
                datetime_col=datetime_col,
                revenue_col=revenue_col,
            )
        except Exception as e:
            return self.skipped(request, f"dining_heatmap 生成失败: {e}", started)

        # Engine always returns a DiningHeatmapReport with .to_dict()
        if hasattr(report, "to_dict"):
            data = report.to_dict()
        elif isinstance(report, dict):
            data = report
        else:
            return self.skipped(
                request,
                f"dining_heatmap 返回非 dict 类型: {type(report).__name__}",
                started,
            )

        return self.ok(request, data=data, started=started)
