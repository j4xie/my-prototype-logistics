"""ReviewWriter — write fact_review_event rows + roll up dim_review_summary.

Current simplifications:
- Keyword extraction is a placeholder — top_keywords always written as []. May
  swap in an LLM call to extract 5-10 keywords per period later.
- Period inference deferred (None / None) until Sheet Merger upload-level
  fields land.
- Sentiment classification: rating >= 4 → positive, rating <= 2 → negative,
  rating == 3 → neutral (counted in total only).
"""
from __future__ import annotations

import hashlib
import json
import time
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from smartbi.canonical.aliases import ALIAS_TO_ATTR

from .base import BaseWriter, WriteSummary


_FACT_BATCH_SIZE = 5000


def _canonical_value(row: Dict[str, Any], canonical: str) -> Optional[Any]:
    for raw_key, attr in ALIAS_TO_ATTR.items():
        if attr != canonical:
            continue
        if raw_key in row and row[raw_key] not in (None, ""):
            return row[raw_key]
    if canonical in row and row[canonical] not in (None, ""):
        return row[canonical]
    return None


def _to_float(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_date(value: Any) -> Optional[date]:
    if value is None or value == "":
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S"):
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
    return None


def _compute_review_row_hash(
    row: Dict[str, Any], factory_id: str, upload_id: int
) -> str:
    """Deterministic hash for idempotent fact_review_event re-run."""
    parts = [
        str(factory_id),
        str(upload_id),
        str(_canonical_value(row, "review_text") or ""),
        str(_canonical_value(row, "rating") or ""),
        str(_canonical_value(row, "review_date") or ""),
        str(_canonical_value(row, "store_name") or ""),
        str(_canonical_value(row, "product_name") or ""),
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
            rows = await conn.fetch(
                "SELECT row_data FROM smart_bi_dynamic_data WHERE upload_id = $1",
                upload_id,
            )

            for row_pg in rows:
                row = self._unwrap_row(row_pg["row_data"])
                store_name = _canonical_value(row, "store_name")
                product_name = _canonical_value(row, "product_name")
                review_text = _canonical_value(row, "review_text")
                rating = _to_float(_canonical_value(row, "rating"))
                review_dt = _to_date(_canonical_value(row, "review_date"))

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
                VALUES ($1, $2, $3, $4, NULL, NULL, $5, $6, $7, $8,
                        $9::jsonb, $10::jsonb)
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

    @staticmethod
    def _unwrap_row(raw: Any) -> Dict[str, Any]:
        if isinstance(raw, dict):
            return raw
        if isinstance(raw, str):
            try:
                parsed = json.loads(raw)
                return parsed if isinstance(parsed, dict) else {}
            except (ValueError, TypeError):
                return {}
        return {}
