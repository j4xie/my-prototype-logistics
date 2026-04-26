"""Sheet Merger — period inference + merge decision matrix for multi-sheet uploads."""
from __future__ import annotations

import calendar
import logging
import os
import re
from dataclasses import dataclass
from datetime import date
from enum import Enum
from typing import TYPE_CHECKING, Optional, Tuple

from smartbi.canonical.aliases import to_canonical

if TYPE_CHECKING:
    import asyncpg

logger = logging.getLogger(__name__)


_ENABLED_VALUES = frozenset({"1", "true", "yes", "on"})


def sheet_merger_enabled() -> bool:
    """Env flag SMARTBI_ENABLE_SHEET_MERGER (default ON; opt-out via 0/false)."""
    val = os.environ.get("SMARTBI_ENABLE_SHEET_MERGER", "1").strip().lower()
    return val in _ENABLED_VALUES


class PeriodRelation(Enum):
    """Relationship between two date ranges for merge decision."""
    EQUAL = "equal"
    SUBSET = "subset"
    SUPERSET = "superset"
    DISJOINT = "disjoint"
    OVERLAP = "overlap"
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class MergeSummary:
    """Counters returned from SheetMergeAnalyzer.analyze()."""
    superseded_count: int = 0
    merged_count: int = 0
    nested_count: int = 0
    queued_count: int = 0
    skipped_count: int = 0


def compare_periods(
    a: Tuple[Optional[date], Optional[date]],
    b: Tuple[Optional[date], Optional[date]],
) -> PeriodRelation:
    """Spec §5.4.1 v1.1 — any None → UNKNOWN; equal/subset/superset/disjoint/overlap."""
    a_start, a_end = a
    b_start, b_end = b
    if any(x is None for x in (a_start, a_end, b_start, b_end)):
        return PeriodRelation.UNKNOWN
    if a_start == b_start and a_end == b_end:
        return PeriodRelation.EQUAL
    if a_end < b_start or b_end < a_start:
        return PeriodRelation.DISJOINT
    if a_start <= b_start and a_end >= b_end:
        return PeriodRelation.SUPERSET
    if b_start <= a_start and b_end >= a_end:
        return PeriodRelation.SUBSET
    return PeriodRelation.OVERLAP


# Sheet name patterns: 2024年12月 / 2024_12 / 2024-12 / 2024/12.
_SHEET_NAME_PATTERNS = [
    re.compile(r"(\d{4})[年_\-/](\d{1,2})"),
]


async def infer_sheet_time_window(
    upload_id: int,
    conn: "asyncpg.Connection",
) -> Tuple[Optional[Tuple[date, date]], Optional[str]]:
    """Spec §11.2 v1.3 — returns ((period_start, period_end), method) or (None, None)."""
    # Priority 1: row_date_column — find canonical 'date' column.
    field_rows = await conn.fetch(
        "SELECT original_name FROM smart_bi_pg_field_definitions WHERE upload_id = $1",
        upload_id,
    )
    date_col = None
    for r in field_rows:
        if to_canonical(r["original_name"]) == "date":
            date_col = r["original_name"]
            break

    if date_col:
        try:
            result = await conn.fetchrow(
                """
                SELECT
                  MIN((row_data->>$1)::date) AS min_date,
                  MAX((row_data->>$1)::date) AS max_date
                FROM smart_bi_dynamic_data
                WHERE upload_id = $2
                """,
                date_col, upload_id,
            )
            if result and result["min_date"]:
                return (result["min_date"], result["max_date"]), "row_date_column"
        except Exception as exc:
            logger.warning(
                "infer_sheet_time_window: row_date_column failed upload=%d: %s",
                upload_id, exc,
            )

    # Priority 2: sheet_name_regex — parse YYYY-MM from sheet/file name.
    upload = await conn.fetchrow(
        "SELECT sheet_name, file_name FROM smart_bi_pg_excel_uploads WHERE id = $1",
        upload_id,
    )
    if upload:
        for name in (upload["sheet_name"], upload["file_name"]):
            if not name:
                continue
            for pat in _SHEET_NAME_PATTERNS:
                m = pat.search(str(name))
                if m:
                    year, month = int(m.group(1)), int(m.group(2))
                    if 1 <= month <= 12 and 2000 <= year <= 2099:
                        first = date(year, month, 1)
                        last = date(year, month, calendar.monthrange(year, month)[1])
                        return (first, last), "sheet_name_regex"

    # Priority 3 (admin_set) is post-hoc human override, not auto-inference.
    return None, None


async def decide_merge(
    new_upload_id: int,
    factory_id: str,
    conn: "asyncpg.Connection",
) -> MergeSummary:
    """Spec §5.4.2 — apply merge decision matrix vs same-factory same-shape uploads."""
    new_upload = await conn.fetchrow(
        """
        SELECT id, merge_inferred_period_start AS p_start,
               merge_inferred_period_end AS p_end, detected_table_type
        FROM smart_bi_pg_excel_uploads
        WHERE id = $1
        """,
        new_upload_id,
    )
    if not new_upload or new_upload["p_start"] is None or new_upload["p_end"] is None:
        await conn.execute(
            "UPDATE smart_bi_pg_excel_uploads SET merge_status = 'PERIOD_UNKNOWN' WHERE id = $1",
            new_upload_id,
        )
        return MergeSummary(skipped_count=1)

    new_period = (new_upload["p_start"], new_upload["p_end"])
    detected_table_type = new_upload["detected_table_type"]

    others = await conn.fetch(
        """
        SELECT id, merge_inferred_period_start AS p_start,
               merge_inferred_period_end AS p_end,
               (merge_inferred_period_end - merge_inferred_period_start) AS p_size
        FROM smart_bi_pg_excel_uploads
        WHERE factory_id = $1
          AND id != $2
          AND merge_status IS NULL
          AND detected_table_type = $3
          AND merge_inferred_period_start IS NOT NULL
        ORDER BY p_size ASC NULLS LAST
        """,
        factory_id, new_upload_id, detected_table_type,
    )

    superseded = merged = nested = queued = 0
    new_already_nested = False

    for other in others:
        if new_already_nested:
            break

        relation = compare_periods(new_period, (other["p_start"], other["p_end"]))
        if relation == PeriodRelation.UNKNOWN:
            continue

        if relation in (PeriodRelation.EQUAL, PeriodRelation.SUPERSET):
            await conn.execute(
                "UPDATE smart_bi_pg_excel_uploads SET merge_status = 'SUPERSEDED' WHERE id = $1",
                other["id"],
            )
            superseded += 1
        elif relation == PeriodRelation.SUBSET:
            await conn.execute(
                """
                UPDATE smart_bi_pg_excel_uploads
                SET merge_status = $1, merge_target_id = $2
                WHERE id = $3
                """,
                f"NESTED_IN_{other['id']}", other["id"], new_upload_id,
            )
            await _queue_admin(conn, factory_id, new_upload_id, other["id"], "PERIOD_NESTED")
            nested += 1
            queued += 1
            new_already_nested = True
        elif relation == PeriodRelation.OVERLAP:
            await conn.execute(
                """
                UPDATE smart_bi_pg_excel_uploads
                SET merge_status = $1, merge_target_id = $2
                WHERE id = $3
                """,
                f"MERGED_INTO_{new_upload_id}", new_upload_id, other["id"],
            )
            await _queue_admin(conn, factory_id, other["id"], new_upload_id, "PERIOD_OVERLAP")
            merged += 1
            queued += 1
        # DISJOINT: independent — no action.

    return MergeSummary(
        superseded_count=superseded,
        merged_count=merged,
        nested_count=nested,
        queued_count=queued,
    )


async def _queue_admin(
    conn: "asyncpg.Connection",
    factory_id: str,
    source_upload_id: int,
    target_upload_id: int,
    reason: str,
) -> None:
    """Insert sheet_merge admin queue row (entity_type='sheet_merge' allowed by V20260427_01)."""
    await conn.execute(
        """
        INSERT INTO entity_resolution_admin_queue
          (factory_id, entity_type, raw_name, candidate_entity_id,
           confidence, decided_by_agent, reasoning, priority, source_upload_id)
        VALUES ($1, 'sheet_merge', $2, $3, 0.0, 'sheet_merger', $4, 'medium', $5)
        """,
        factory_id,
        f"upload:{source_upload_id}-vs-{target_upload_id}",
        target_upload_id,
        f"sheet merge {reason}: source={source_upload_id} target={target_upload_id}",
        source_upload_id,
    )


class SheetMergeAnalyzer:
    """Run period inference + merge decision for a freshly-uploaded sheet."""

    async def analyze(
        self,
        upload_id: int,
        factory_id: str,
        conn: "asyncpg.Connection",
    ) -> MergeSummary:
        """Inference → persist → decide_merge. Caller must set app.factory_id."""
        period, method = await infer_sheet_time_window(upload_id, conn)
        if period is None:
            await conn.execute(
                """
                UPDATE smart_bi_pg_excel_uploads
                SET merge_status = 'PERIOD_UNKNOWN',
                    merge_period_inference_method = NULL
                WHERE id = $1
                """,
                upload_id,
            )
            return MergeSummary(skipped_count=1)

        await conn.execute(
            """
            UPDATE smart_bi_pg_excel_uploads
            SET merge_inferred_period_start = $1,
                merge_inferred_period_end = $2,
                merge_period_inference_method = $3
            WHERE id = $4
            """,
            period[0], period[1], method, upload_id,
        )
        return await decide_merge(upload_id, factory_id, conn)


async def run_sheet_merge(
    factory_id: str,
    upload_id: int,
) -> Optional[MergeSummary]:
    """Top-level wrapper — owns asyncpg pool lifecycle. Never raises; logs on failure."""
    if not sheet_merger_enabled():
        return None

    try:
        import asyncpg
        from smartbi.config import get_settings
        from smartbi.tenant_ctx import (
            reset_factory_id,
            set_factory_id,
            set_pg_connection_tenant,
        )

        settings = get_settings()
        if not settings.postgres_url:
            logger.warning(
                "[sheet-merger] no postgres_url configured; skipping upload=%d",
                upload_id,
            )
            return None

        pool = await asyncpg.create_pool(
            settings.postgres_url,
            min_size=1, max_size=2,
            setup=set_pg_connection_tenant,
        )
        token = set_factory_id(factory_id)
        try:
            async with pool.acquire() as conn:
                analyzer = SheetMergeAnalyzer()
                summary = await analyzer.analyze(upload_id, factory_id, conn)
                logger.info(
                    "[sheet-merger] upload=%d factory=%s "
                    "superseded=%d merged=%d nested=%d queued=%d skipped=%d",
                    upload_id, factory_id,
                    summary.superseded_count, summary.merged_count,
                    summary.nested_count, summary.queued_count,
                    summary.skipped_count,
                )
                return summary
        finally:
            reset_factory_id(token)
            await pool.close()
    except Exception as e:
        logger.warning(
            "[sheet-merger] upload=%d factory=%s failed: %s",
            upload_id, factory_id, e,
            exc_info=True,
        )
        return None
