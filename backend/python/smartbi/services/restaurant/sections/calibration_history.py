from __future__ import annotations

"""BOM monthly calibration history section.


Wraps ``MonthlyCalibrationReporter.generate()`` for Layer A self-learning
reports — analyzes the trend of food-cost-rate over the last N months and
flags categories with high volatility / single-month anomalies.

Requires DB access (``context["db_session"]`` in batch mode, or
``request.params["db_session"]`` standalone) because the reporter reads from
the ``restaurant_monthly_purchases`` table. Without a session, returns
SKIPPED gracefully — this is the legitimate state for factories that haven't
uploaded any monthly purchase data yet.

Supported params (all optional):
  - ``db_session``: SQLAlchemy session
  - ``months_back`` (int, default 6)
  - ``sub_sector_base_ratio`` (float, default 0.43)
"""

import time
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


class CalibrationHistoryHandler(AbstractSectionHandler):
    """Wraps :class:`MonthlyCalibrationReporter` for the section pipeline.

    Reporter caches keyed on ``id(db_session)`` since each request typically
    gets a fresh session. The cache prevents re-instantiating the reporter
    if the same session is reused for multiple section calls in a batch.
    """
    section_name = "calibration_history"

    def __init__(self) -> None:
        # Cache reporter per db_session id (one per request, usually)
        self._reporter_cache: dict[int, Any] = {}

    def _get_reporter(self, db_session, sub_sector_base_ratio: float):
        key = id(db_session)
        reporter = self._reporter_cache.get(key)
        if reporter is None:
            from smartbi.services.restaurant.monthly_calibration_report import (
                MonthlyCalibrationReporter,
            )
            reporter = MonthlyCalibrationReporter(
                db_session=db_session,
                sub_sector_base_ratio=sub_sector_base_ratio,
            )
            self._reporter_cache[key] = reporter
        return reporter

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()

        db_session = context.get("db_session") or request.params.get("db_session")
        if db_session is None:
            return self.skipped(
                request,
                "未提供 db_session (calibration history 需要 DB 访问)",
                started,
            )

        try:
            months_back = int(request.params.get("months_back", 6))
        except (TypeError, ValueError):
            return self.skipped(request, "months_back 不是有效整数", started)

        try:
            sub_sector_base_ratio = float(
                request.params.get("sub_sector_base_ratio", 0.43)
            )
        except (TypeError, ValueError):
            sub_sector_base_ratio = 0.43

        try:
            reporter = self._get_reporter(db_session, sub_sector_base_ratio)
            report = reporter.generate(
                factory_id=request.factory_id,
                store_id=request.store_id,
                months_back=months_back,
            )
        except Exception as e:
            return self.skipped(request, f"calibration history 生成失败: {e}", started)

        # Graceful skip if no historical data — matches analyzer.py legacy
        # behavior of only adding the section when total_periods > 0.
        if getattr(report, "total_periods", 0) == 0:
            reason = getattr(report, "summary", None) or "无历史校准数据 (total_periods = 0)"
            return self.skipped(request, reason, started)

        if hasattr(report, "to_dict"):
            data = report.to_dict()
        elif isinstance(report, dict):
            data = report
        else:
            return self.skipped(
                request,
                f"calibration history 返回非 dict 类型: {type(report).__name__}",
                started,
            )

        return self.ok(request, data=data, started=started)
