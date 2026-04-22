"""Materialization triggers — strategies for "when to recompute Gold".

Week 3 Day 3 of Unified Data Layer v1 spec (§4.1).

Three concrete triggers, differing only in how they compute the
(date_min, date_max) scope:

- UploadCompleteTrigger: caller passes exact upload's covered range.
  Fired immediately after Bronze→Silver ingest finishes so agg_* reflects
  the new data before any user asks.

- FieldRegistryReviewedTrigger: caller passes the range that needs
  reprocessing after an admin correction. Typically admin picks "all
  time" via the UI, but scope is explicit so small factories don't pay
  for a full scan every correction.

- ApiAppendIncrementalTrigger: caller passes a `days_back` window; the
  trigger computes (today-N, today). For hourly webhook poll — cheap
  incremental recompute that covers late-arriving bills too.

All three delegate to `GoldMaterializer` via a shared `_materialize_all`
helper so future trigger types don't repeat the "call all 3 materialize_*
for every month in range" boilerplate.

Result
------
Each `fire()` returns a `TriggerResult` with the reason label and the
list of `MaterializeStats` from each materializer call — useful for
logging + dashboards + debugging which trigger caused what churn.
"""
from __future__ import annotations

import abc
import logging
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import List

from smartbi.gold.materializer import GoldMaterializer, MaterializeStats

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class TriggerResult:
    reason: str
    results: List[MaterializeStats] = field(default_factory=list)

    @property
    def total_rows_upserted(self) -> int:
        return sum(r.rows_upserted for r in self.results)


async def _materialize_all(
    materializer: GoldMaterializer,
    date_min: date,
    date_max: date,
    reason: str,
) -> TriggerResult:
    """Run all 3 materialize_* functions for the given range. agg_product
    fires once per month within the range because its grain is monthly."""
    if date_min > date_max:
        raise ValueError(f"date_min {date_min} > date_max {date_max}")

    stats: List[MaterializeStats] = []
    # agg_daily + agg_channel share the same (date_min, date_max) range.
    stats.append(await materializer.materialize_daily((date_min, date_max)))
    stats.append(await materializer.materialize_channel((date_min, date_max)))

    # agg_product needs one call per month.
    for month_first in _months_in_range(date_min, date_max):
        stats.append(await materializer.materialize_product(month_first))

    result = TriggerResult(reason=reason, results=stats)
    logger.info(
        "trigger=%s factory=%s range=%s..%s total_upserted=%d",
        reason, materializer.factory_id, date_min, date_max,
        result.total_rows_upserted,
    )
    return result


def _months_in_range(start: date, end: date) -> List[date]:
    """First-of-month dates covered by [start, end]. E.g. (3/15, 5/10)
    → [3/1, 4/1, 5/1]."""
    months: List[date] = []
    cursor = start.replace(day=1)
    end_marker = end.replace(day=1)
    while cursor <= end_marker:
        months.append(cursor)
        # Advance one month — careful across year boundary.
        if cursor.month == 12:
            cursor = cursor.replace(year=cursor.year + 1, month=1)
        else:
            cursor = cursor.replace(month=cursor.month + 1)
    return months


class MaterializationTrigger(abc.ABC):
    """Strategy base class. Each subclass encodes a policy for WHICH scope
    to recompute; the actual SQL is delegated to GoldMaterializer.
    """

    reason: str = ""

    @abc.abstractmethod
    async def fire(self, materializer: GoldMaterializer) -> TriggerResult:
        raise NotImplementedError


class UploadCompleteTrigger(MaterializationTrigger):
    """Fires after Bronze→Silver ingest finishes for an upload. Caller
    supplies the exact date range the upload's bills cover (pulled from
    MIN/MAX(date) over the upload's rows)."""

    reason = "upload_complete"

    def __init__(self, date_min: date, date_max: date):
        if not isinstance(date_min, date) or not isinstance(date_max, date):
            raise TypeError("date_min and date_max must be datetime.date")
        self.date_min = date_min
        self.date_max = date_max

    async def fire(self, materializer: GoldMaterializer) -> TriggerResult:
        return await _materialize_all(
            materializer, self.date_min, self.date_max, self.reason
        )


class FieldRegistryReviewedTrigger(MaterializationTrigger):
    """Fires when an admin changes a canonical_field mapping. Admin picks
    the scope through the UI; defaults are decided by the caller, not by
    this class — e.g. "everything since 2024" or "just this month"."""

    reason = "field_registry_reviewed"

    def __init__(self, date_min: date, date_max: date):
        if not isinstance(date_min, date) or not isinstance(date_max, date):
            raise TypeError("date_min and date_max must be datetime.date")
        self.date_min = date_min
        self.date_max = date_max

    async def fire(self, materializer: GoldMaterializer) -> TriggerResult:
        return await _materialize_all(
            materializer, self.date_min, self.date_max, self.reason
        )


class ApiAppendIncrementalTrigger(MaterializationTrigger):
    """Fires after webhook/poll adapters append new rows. Scope is the
    last `days_back` days so late-arriving bills (API latency, retry)
    get rolled up too."""

    reason = "api_append_incremental"

    def __init__(self, days_back: int = 7, today: date = None):
        if days_back < 1:
            raise ValueError(f"days_back must be >= 1, got {days_back}")
        self.days_back = days_back
        self._today = today  # injectable for deterministic tests

    @property
    def today(self) -> date:
        return self._today if self._today is not None else date.today()

    async def fire(self, materializer: GoldMaterializer) -> TriggerResult:
        end = self.today
        start = end - timedelta(days=self.days_back)
        return await _materialize_all(
            materializer, start, end, self.reason
        )
