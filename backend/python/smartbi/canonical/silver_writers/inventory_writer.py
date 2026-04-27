"""InventoryWriter — write fact_inventory_snapshot with thresholds joined.

Current simplifications:
- Ingredient resolution is deterministic-only: SELECT dim_ingredient WHERE name=raw
  (with normalized fallback). No Multi-Agent fuzzy match. Unmatched ingredient
  names are queued to entity_resolution_admin_queue (entity_type='ingredient',
  enabled by V20260428_02) so admins can resolve them; rows are skipped.
- safe_stock_qty / reorder_point come from dim_ingredient_threshold via LEFT JOIN
  preferring a store-specific row, then a NULL-store global row.
- snapshot_date precedence (Phase 3): row-level date column → upload-level
  merge_inferred_period_end (set by SheetMergeAnalyzer) → today's date.

Day 10-12 (Sub-Project C): if SMARTBI_ENABLE_PROVENANCE env flag is ON, each
inserted snapshot row also records cell-level provenance for stock_qty / unit
anchored to the ingredient. valid_from = snapshot_date (open-ended valid_to).
Default OFF.
"""
from __future__ import annotations

import re
import time
from datetime import date
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple

from smartbi.canonical.provenance._writer_hook import (
    is_provenance_enabled,
    write_provenance_for_fields,
)

from ._helpers import canonical_value, pick, to_date, to_float, unwrap_row
from .base import BaseWriter, WriteSummary

if TYPE_CHECKING:
    import asyncpg


_BATCH_SIZE = 5000
_WHITESPACE_RE = re.compile(r"\s+")

_INGREDIENT_KEYS = ("inventory_item",)
_QTY_KEYS = ("stock_qty",)
_UNIT_KEYS = ("unit", "单位", "stock_unit")
_DATE_KEYS = ("snapshot_date", "date", "盘点日期", "库存日期", "日期")


def _normalize_name(name: str) -> str:
    """Ingredient-specific normalize — kept local; matches dim_ingredient.normalized_name."""
    return _WHITESPACE_RE.sub("", str(name)).lower()


class InventoryWriter(BaseWriter):
    """Snapshot-style writer; UNIQUE(factory, ingredient, store, date) prevents duplicates."""

    BATCH_SIZE = _BATCH_SIZE

    async def write(self, upload_id: int, factory_id: str) -> WriteSummary:
        t0 = time.time()
        records: List[Tuple[Any, ...]] = []
        admin_queue_count = 0
        tentative_count = 0
        ingredient_cache: Dict[str, Optional[int]] = {}
        queued_unresolved_names: set = set()

        async with self._pool.acquire() as conn:
            _period_start, period_end = await self._fetch_period(upload_id, conn)
            rows = await conn.fetch(
                "SELECT row_data FROM smart_bi_dynamic_data WHERE upload_id = $1",
                upload_id,
            )

            for row_pg in rows:
                row = unwrap_row(row_pg["row_data"])
                ingredient_name = pick(row, _INGREDIENT_KEYS) or canonical_value(
                    row, "inventory_item"
                )
                if not ingredient_name:
                    admin_queue_count += 1
                    continue

                norm = _normalize_name(str(ingredient_name))
                if norm in ingredient_cache:
                    ingredient_id = ingredient_cache[norm]
                else:
                    ingredient_id = await self._resolve_ingredient(
                        conn, factory_id, str(ingredient_name), norm
                    )
                    ingredient_cache[norm] = ingredient_id
                if ingredient_id is None:
                    if norm not in queued_unresolved_names:
                        await self._queue_unresolved_ingredient(
                            conn, factory_id, str(ingredient_name), upload_id
                        )
                        queued_unresolved_names.add(norm)
                    admin_queue_count += 1
                    continue

                store_name = canonical_value(row, "store_name")
                store_result = await self._resolve_store(
                    str(store_name) if store_name is not None else None,
                    factory_id,
                    context={},
                )
                if store_result.is_tentative:
                    tentative_count += 1

                stock_qty = to_float(canonical_value(row, "stock_qty"), default=None)
                unit_value = pick(row, _UNIT_KEYS)
                snapshot_date = (
                    to_date(pick(row, _DATE_KEYS)) or period_end or date.today()
                )

                threshold = await self._fetch_threshold(
                    conn, factory_id, ingredient_id, store_result.entity_id
                )
                safe_stock_qty = threshold.get("safe_stock_qty") if threshold else None
                reorder_point = threshold.get("reorder_point") if threshold else None

                records.append(
                    (
                        factory_id,
                        upload_id,
                        ingredient_id,
                        store_result.entity_id,
                        snapshot_date,
                        stock_qty,
                        str(unit_value) if unit_value is not None else None,
                        safe_stock_qty,
                        reorder_point,
                    )
                )

            for i in range(0, len(records), self.BATCH_SIZE):
                batch = records[i : i + self.BATCH_SIZE]
                await conn.executemany(
                    """
                    INSERT INTO fact_inventory_snapshot
                      (factory_id, upload_id, ingredient_id, store_id,
                       snapshot_date, stock_qty, unit, safe_stock_qty, reorder_point)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (factory_id, ingredient_id, store_id, snapshot_date)
                    DO UPDATE SET
                      stock_qty = EXCLUDED.stock_qty,
                      unit = EXCLUDED.unit,
                      safe_stock_qty = EXCLUDED.safe_stock_qty,
                      reorder_point = EXCLUDED.reorder_point
                    """,
                    batch,
                )

            # Day 10-12: opt-in cell-level provenance dual-write. records tuple
            # order is fixed above — index 2=ingredient_id, 4=snapshot_date,
            # 5=stock_qty, 6=unit. Anchor to ingredient (the canonical entity).
            # safe_stock_qty / reorder_point come from dim_ingredient_threshold,
            # not from this upload, so we deliberately don't record provenance
            # for them — that's the threshold table's responsibility, not the
            # inventory writer's. Wrapped in its own transaction so a hook
            # failure is isolated from the main INSERT.
            if is_provenance_enabled() and records:
                async with conn.transaction():
                    for rec in records:
                        ingredient_id = rec[2]
                        snapshot_date = rec[4]
                        stock_qty = rec[5]
                        unit = rec[6]
                        await write_provenance_for_fields(
                            conn,
                            factory_id=factory_id,
                            entity_type="ingredient",
                            entity_id=ingredient_id,
                            fields={
                                "stock_qty": stock_qty,
                                "unit": unit,
                            },
                            source_type="inventory",
                            mapper_method="rule",
                            confidence=0.80,
                            source_upload_id=upload_id,
                            valid_from=snapshot_date,
                        )

        return WriteSummary(
            rows_written=len(records),
            rows_skipped=admin_queue_count,
            new_entity_count=0,
            admin_queue_count=admin_queue_count,
            tentative_count=tentative_count,
            elapsed_ms=int((time.time() - t0) * 1000),
        )

    async def _fetch_period(
        self, upload_id: int, conn: "asyncpg.Connection"
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

    async def _queue_unresolved_ingredient(
        self,
        conn: "asyncpg.Connection",
        factory_id: str,
        raw_name: str,
        upload_id: int,
    ) -> None:
        """Insert pending ingredient row into entity_resolution_admin_queue."""
        await conn.execute(
            """
            INSERT INTO entity_resolution_admin_queue
              (factory_id, entity_type, raw_name, confidence,
               decided_by_agent, source_upload_id, priority)
            VALUES ($1, 'ingredient', $2, 0.0,
                    'inventory_writer:no_match', $3, 'medium')
            """,
            factory_id,
            raw_name,
            upload_id,
        )

    async def _resolve_ingredient(
        self,
        conn: "asyncpg.Connection",
        factory_id: str,
        raw_name: str,
        normalized: str,
    ) -> Optional[int]:
        row = await conn.fetchrow(
            """
            SELECT ingredient_id FROM dim_ingredient
            WHERE factory_id = $1
              AND (name = $2 OR normalized_name = $3)
            LIMIT 1
            """,
            factory_id,
            raw_name,
            normalized,
        )
        return int(row["ingredient_id"]) if row is not None else None

    async def _fetch_threshold(
        self,
        conn: "asyncpg.Connection",
        factory_id: str,
        ingredient_id: int,
        store_id: Optional[int],
    ) -> Optional[Dict[str, Any]]:
        if store_id is not None:
            row = await conn.fetchrow(
                """
                SELECT safe_stock_qty, reorder_point FROM dim_ingredient_threshold
                WHERE factory_id = $1 AND ingredient_id = $2 AND store_id = $3
                LIMIT 1
                """,
                factory_id,
                ingredient_id,
                store_id,
            )
            if row is not None:
                return dict(row)
        row = await conn.fetchrow(
            """
            SELECT safe_stock_qty, reorder_point FROM dim_ingredient_threshold
            WHERE factory_id = $1 AND ingredient_id = $2 AND store_id IS NULL
            LIMIT 1
            """,
            factory_id,
            ingredient_id,
        )
        return dict(row) if row is not None else None
