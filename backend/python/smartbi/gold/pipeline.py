"""One-shot pipeline: ingest CanonicalRows and materialize Gold after.

Week 4 Day 1 of Unified Data Layer v1 spec (Phase A dual-write plumbing).

Purpose
-------
Downstream callers (excel_async worker, backfill scripts, API adapters)
shouldn't have to wire up Silver normalizer + Gold materializer + trigger
separately. This module exposes one function:

    ingest_and_materialize(pool, factory_id, rows) → PipelineStats

which does the whole "got canonical rows → make them queryable" flow.
One call, one place to log, one place to trap failures.

Behavior
--------
- Silver writes are per-row atomic (SilverNormalizer handles transactions).
  Partial failures log but don't abort the batch.
- Gold materialization fires AFTER all Silver rows land — this way even
  if the ingest had some per-row failures, agg_* sees the committed
  subset consistently.
- date_range defaults to MIN/MAX over the input rows' `date` field. Pass
  an explicit `(start, end)` tuple to widen it (e.g. after a backfill
  that covers all historical months).
- Empty `rows` is valid — the trigger still fires with a degenerate
  range (today..today) and agg_* row counts will be 0. Caller decides
  whether to skip early.

This is Phase A infrastructure. Wire-in to live excel_async.py is gated
by a separate feature flag decision (user-gated) and doesn't happen in
this module.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from typing import List, Optional, Tuple

import asyncpg

from smartbi.canonical import CanonicalRow, NormalizeStats, SilverNormalizer
from smartbi.gold.materializer import GoldMaterializer
from smartbi.gold.triggers import TriggerResult, UploadCompleteTrigger

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PipelineStats:
    """Combined stats from both Silver ingest + Gold trigger."""
    normalize: NormalizeStats
    trigger: TriggerResult


async def ingest_and_materialize(
    pool: asyncpg.Pool,
    factory_id: str,
    rows: List[CanonicalRow],
    *,
    date_range: Optional[Tuple[date, date]] = None,
) -> PipelineStats:
    """Ingest rows to Silver then fire UploadCompleteTrigger for Gold.

    Tenant context must be set upstream (via tenant_ctx.set_factory_id)
    because the pool's setup callback applies it to each acquired conn
    for RLS. Passing a mismatched factory_id arg raises InsufficientPrivilege
    from PG.
    """
    if not factory_id:
        raise ValueError("factory_id required")

    # Silver phase — write all rows.
    silver = SilverNormalizer(pool, factory_id=factory_id)
    normalize_stats = await silver.ingest_rows(rows)

    # Gold phase — compute the date range for the trigger.
    if date_range is None:
        scope = _derive_range(rows)
    else:
        if date_range[0] > date_range[1]:
            raise ValueError(f"date_range start > end: {date_range}")
        scope = date_range

    materializer = GoldMaterializer(pool, factory_id=factory_id)
    trigger = UploadCompleteTrigger(scope[0], scope[1])
    trigger_stats = await trigger.fire(materializer)

    logger.info(
        "pipeline factory=%s rows=%d silver_txn=%d silver_items=%d "
        "silver_dup=%d gold_upserts=%d range=%s..%s",
        factory_id, len(rows),
        normalize_stats.transactions_written,
        normalize_stats.items_written,
        normalize_stats.duplicates_skipped,
        trigger_stats.total_rows_upserted,
        scope[0], scope[1],
    )
    return PipelineStats(normalize=normalize_stats, trigger=trigger_stats)


def _derive_range(rows: List[CanonicalRow]) -> Tuple[date, date]:
    """MIN/MAX over input rows' dates. Empty input falls back to
    today..today so the trigger has a valid (but inert) scope."""
    if not rows:
        today = date.today()
        return (today, today)
    dates = [r.date for r in rows]
    return (min(dates), max(dates))
