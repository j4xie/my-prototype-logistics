"""ReviewWriter — write fact_review_event rows + roll up dim_review_summary.

Current simplifications:
- Keyword extraction is a placeholder — top_keywords always written as []. May
  swap in an LLM call to extract 5-10 keywords per period later.
- Phase 3: `_fetch_period` reads merge_inferred_period_* set by SheetMergeAnalyzer.
  Pre-Phase-3 uploads (analyzer not yet run) still get NULL via graceful degrade.
- Sentiment classification: rating >= 4 → positive, rating <= 2 → negative,
  rating == 3 → neutral (counted in total only).
"""
from __future__ import annotations

import hashlib
import json
import time
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from ._helpers import canonical_value, to_date, to_float, unwrap_row
from .base import BaseWriter, WriteSummary


_FACT_BATCH_SIZE = 5000


def _compute_review_row_hash(
    row: Dict[str, Any], factory_id: str, upload_id: int
) -> str:
    """Deterministic hash for idempotent fact_review_event re-run."""
    parts = [
        str(factory_id),
        str(upload_id),
        str(canonical_value(row, "review_text") or ""),
        str(canonical_value(row, "rating") or ""),
        str(canonical_value(row, "review_date") or ""),
        str(canonical_value(row, "store_name") or ""),
        str(canonical_value(row, "product_name") or ""),
    ]
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class ReviewWriter(BaseWriter):
    """Insert review events + roll up summary by store/product."""

    FACT_BATCH_SIZE = _FACT_BATCH_SIZE

    async def write(self, upload_id: int, factory_id: str) -> WriteSummary:
        t0 = time.time()
        fact_rows: List[Tuple[Any, ...]] = []
        unmatched_product_names: List[str] = []
        ratings: List[float] = []
        positive = 0
        negative = 0
        admin_queue_count = 0
        tentative_count = 0
        product_id_for_summary: Optional[int] = None
        store_id_for_summary: Optional[int] = None

        async with self._pool.acquire() as conn:
            period_start, period_end = await self._fetch_period(upload_id, conn)
            rows = await conn.fetch(
                "SELECT row_data FROM smart_bi_dynamic_data WHERE upload_id = $1",
                upload_id,
            )

            for row_pg in rows:
                row = unwrap_row(row_pg["row_data"])
                store_name = canonical_value(row, "store_name")
                product_name = canonical_value(row, "product_name")
                review_text = canonical_value(row, "review_text")
                rating = to_float(canonical_value(row, "rating"), default=None)
                review_dt = to_date(canonical_value(row, "review_date"))

                store_result = await self._resolve_store(
                    str(store_name) if store_name is not None else None,
                    factory_id,
                    context={},
                )
                if store_result.is_tentative:
                    tentative_count += 1
                if store_id_for_summary is None and store_result.entity_id is not None:
                    store_id_for_summary = store_result.entity_id

                product_id_resolved: Optional[int] = None
                if product_name:
                    product_result = await self._resolve_product(
                        str(product_name),
                        factory_id,
                        context={
                            "store_id": store_result.entity_id,
                            "store_name": store_name,
                        },
                    )
                    if product_result.entity_id is None:
                        unmatched_product_names.append(str(product_name))
                        admin_queue_count += 1
                    else:
                        product_id_resolved = product_result.entity_id
                        if product_result.is_tentative:
                            tentative_count += 1
                        if product_id_for_summary is None:
                            product_id_for_summary = product_id_resolved

                row_hash = _compute_review_row_hash(row, factory_id, upload_id)

                fact_rows.append(
                    (
                        factory_id,
                        upload_id,
                        product_id_resolved,
                        store_result.entity_id,
                        rating,
                        str(review_text) if review_text is not None else None,
                        review_dt,
                        row_hash,
                    )
                )

                if rating is not None:
                    ratings.append(rating)
                    if rating >= 4:
                        positive += 1
                    elif rating <= 2:
                        negative += 1

            for i in range(0, len(fact_rows), self.FACT_BATCH_SIZE):
                batch = fact_rows[i : i + self.FACT_BATCH_SIZE]
                # ON CONFLICT expression must EXACTLY match `uq_fre_natkey`
                # (V20260428_01). PG 13 lacks NULLS NOT DISTINCT so COALESCE
                # the nullable hash to '' as a sentinel.
                await conn.executemany(
                    """
                    INSERT INTO fact_review_event
                      (factory_id, upload_id, product_id, store_id,
                       rating, review_text, review_date, source_row_hash)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (factory_id, upload_id,
                                 COALESCE(source_row_hash, ''))
                    DO NOTHING
                    """,
                    batch,
                )

            avg_rating = (sum(ratings) / len(ratings)) if ratings else None
            total_count = len(fact_rows)
            unmatched_dedup = sorted(set(unmatched_product_names))
            await conn.execute(
                """
                INSERT INTO dim_review_summary
                  (factory_id, upload_id, product_id, store_id,
                   period_start, period_end, avg_rating, total_count,
                   positive_count, negative_count, top_keywords,
                   unmatched_product_names)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                        $11::jsonb, $12::jsonb)
                ON CONFLICT (factory_id,
                             COALESCE(upload_id, 0),
                             COALESCE(product_id, 0),
                             COALESCE(store_id, 0),
                             COALESCE(period_start, DATE '0001-01-01'))
                DO UPDATE SET
                  avg_rating = EXCLUDED.avg_rating,
                  total_count = EXCLUDED.total_count,
                  positive_count = EXCLUDED.positive_count,
                  negative_count = EXCLUDED.negative_count,
                  top_keywords = EXCLUDED.top_keywords,
                  unmatched_product_names = EXCLUDED.unmatched_product_names
                """,
                factory_id,
                upload_id,
                product_id_for_summary,
                store_id_for_summary,
                period_start,
                period_end,
                avg_rating,
                total_count,
                positive,
                negative,
                json.dumps([]),
                json.dumps(unmatched_dedup),
            )

        return WriteSummary(
            rows_written=len(fact_rows),
            rows_skipped=0,
            new_entity_count=0,
            admin_queue_count=admin_queue_count,
            tentative_count=tentative_count,
            elapsed_ms=int((time.time() - t0) * 1000),
        )

    async def _fetch_period(
        self, upload_id: int, conn: Any
    ) -> Tuple[Optional[date], Optional[date]]:
        """Read merge_inferred_period_* set by SheetMergeAnalyzer; (None, None) if not yet inferred."""
        try:
            row = await conn.fetchrow(
                """
                SELECT merge_inferred_period_start AS p_start,
                       merge_inferred_period_end AS p_end
                FROM smart_bi_pg_excel_uploads
                WHERE id = $1
                """,
                upload_id,
            )
        except Exception:
            return None, None
        if row is None:
            return None, None
        try:
            return row["p_start"], row["p_end"]
        except (KeyError, IndexError):
            return None, None
