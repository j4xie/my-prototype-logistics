"""ProductSummaryWriter — batch INSERT into agg_product_period.

Period inference deferred until Sheet Merger writes merge_inferred_period_*
upload-level fields; until then period_start / period_end are NULL.
Row-by-row store + product resolution (forced ordering: store first), then
batched executemany for the actual INSERT.
"""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Tuple

from smartbi.canonical.aliases import ALIAS_TO_ATTR

from .base import BaseWriter, WriteSummary


_BATCH_SIZE = 5000


def _canonical_value(row: Dict[str, Any], canonical: str) -> Optional[Any]:
    for raw_key, attr in ALIAS_TO_ATTR.items():
        if attr != canonical:
            continue
        if raw_key in row and row[raw_key] not in (None, ""):
            return row[raw_key]
    if canonical in row and row[canonical] not in (None, ""):
        return row[canonical]
    return None


def _to_float(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


class ProductSummaryWriter(BaseWriter):
    """Aggregate product-period rows; one upload → many (product, store, period) tuples."""

    BATCH_SIZE = _BATCH_SIZE

    async def write(self, upload_id: int, factory_id: str) -> WriteSummary:
        t0 = time.time()
        records: List[Tuple[Any, ...]] = []
        tentative_count = 0
        admin_queue_count = 0

        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT row_data FROM smart_bi_dynamic_data WHERE upload_id = $1",
                upload_id,
            )
            # TODO: Sheet Merger integration — replace with upload-level
            # merge_inferred_period_* lookup once available.
            period_start, period_end = None, None

            for row_pg in rows:
                row = self._unwrap_row(row_pg["row_data"])
                store_name = _canonical_value(row, "store_name")
                product_name = _canonical_value(row, "product_name")

                store_result = await self._resolve_store(
                    str(store_name) if store_name is not None else None,
                    factory_id,
                    context={},
                )
                if store_result.entity_id is None:
                    admin_queue_count += 1
                    continue

                product_result = await self._resolve_product(
                    str(product_name) if product_name is not None else None,
                    factory_id,
                    context={
                        "store_id": store_result.entity_id,
                        "store_name": store_name,
                    },
                )
                if product_result.entity_id is None:
                    admin_queue_count += 1
                    continue

                if store_result.is_tentative or product_result.is_tentative:
                    tentative_count += 1

                qty = _to_float(_canonical_value(row, "qty_sold"))
                revenue = _to_float(_canonical_value(row, "revenue"))
                avg_price = (revenue / qty) if qty else 0.0
                records.append(
                    (
                        factory_id,
                        upload_id,
                        product_result.entity_id,
                        store_result.entity_id,
                        period_start,
                        period_end,
                        qty,
                        revenue,
                        avg_price,
                    )
                )

            for i in range(0, len(records), self.BATCH_SIZE):
                batch = records[i : i + self.BATCH_SIZE]
                # ON CONFLICT expression must EXACTLY match the unique index
                # `uq_app_natkey` (V20260427_02). PG 13 does not support NULLS
                # NOT DISTINCT, so we COALESCE NULL period_start to a sentinel
                # date to make the index treat NULL == NULL for upsert.
                await conn.executemany(
                    """
                    INSERT INTO agg_product_period
                      (factory_id, upload_id, product_id, store_id,
                       period_start, period_end, qty_sold, revenue, avg_unit_price)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (factory_id, upload_id, product_id, store_id,
                                 COALESCE(period_start, DATE '0001-01-01'))
                    DO UPDATE SET
                      qty_sold = EXCLUDED.qty_sold,
                      revenue = EXCLUDED.revenue,
                      avg_unit_price = EXCLUDED.avg_unit_price
                    """,
                    batch,
                )

        return WriteSummary(
            rows_written=len(records),
            rows_skipped=admin_queue_count,
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
                import json

                parsed = json.loads(raw)
                return parsed if isinstance(parsed, dict) else {}
            except (ValueError, TypeError):
                return {}
        return {}
