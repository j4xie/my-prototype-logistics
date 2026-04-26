"""InventoryWriter — write fact_inventory_snapshot with thresholds joined.

Current simplifications:
- Ingredient resolution is deterministic-only: SELECT dim_ingredient WHERE name=raw
  (with normalized fallback). No Multi-Agent fuzzy match. Unmatched rows count
  toward admin_queue_count and are skipped (no admin_queue insert — entity_type
  'ingredient' isn't supported by V20260427_01 CHECK constraint).
- safe_stock_qty / reorder_point come from dim_ingredient_threshold via LEFT JOIN
  preferring a store-specific row, then a NULL-store global row.
- snapshot_date defaults to today's date if no row-level date column present.
"""
from __future__ import annotations

import json
import re
import time
from datetime import date, datetime
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple

from smartbi.canonical.aliases import ALIAS_TO_ATTR

from .base import BaseWriter, WriteSummary

if TYPE_CHECKING:
    import asyncpg


_BATCH_SIZE = 5000
_WHITESPACE_RE = re.compile(r"\s+")

_INGREDIENT_KEYS = ("inventory_item",)
_QTY_KEYS = ("stock_qty",)
_UNIT_KEYS = ("unit", "单位", "stock_unit")
_DATE_KEYS = ("snapshot_date", "date", "盘点日期", "库存日期", "日期")


def _canonical_value(row: Dict[str, Any], canonical: str) -> Optional[Any]:
    for raw_key, attr in ALIAS_TO_ATTR.items():
        if attr != canonical:
            continue
        if raw_key in row and row[raw_key] not in (None, ""):
            return row[raw_key]
    if canonical in row and row[canonical] not in (None, ""):
        return row[canonical]
    return None


def _pick(row: Dict[str, Any], keys: tuple[str, ...]) -> Optional[Any]:
    for k in keys:
        if k in row and row[k] not in (None, ""):
            return row[k]
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


def _normalize_name(name: str) -> str:
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

        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT row_data FROM smart_bi_dynamic_data WHERE upload_id = $1",
                upload_id,
            )

            for row_pg in rows:
                row = self._unwrap_row(row_pg["row_data"])
                ingredient_name = _pick(row, _INGREDIENT_KEYS) or _canonical_value(
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
                    admin_queue_count += 1
                    continue

                store_name = _canonical_value(row, "store_name")
                store_result = await self._resolve_store(
                    str(store_name) if store_name is not None else None,
                    factory_id,
                    context={},
                )
                if store_result.is_tentative:
                    tentative_count += 1

                stock_qty = _to_float(_canonical_value(row, "stock_qty"))
                unit_value = _pick(row, _UNIT_KEYS)
                snapshot_date = _to_date(_pick(row, _DATE_KEYS)) or date.today()

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

        return WriteSummary(
            rows_written=len(records),
            rows_skipped=admin_queue_count,
            new_entity_count=0,
            admin_queue_count=admin_queue_count,
            tentative_count=tentative_count,
            elapsed_ms=int((time.time() - t0) * 1000),
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
