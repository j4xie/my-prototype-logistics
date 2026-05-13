"""二维火 POS upload → smart_bi_pg_excel_uploads + smart_bi_dynamic_data → BillFlowWriter.

Phase II of Phase I MVP: bridges the gap between /upload endpoint (which used
to be a stub that only identified report types) and the existing
`backfill_silver.backfill_upload` pipeline that writes Silver tables.

Pipeline per file:
  1. Parse CSV bytes (二维火: utf-8-sig BOM + \\r-only line endings)
  2. INSERT smart_bi_pg_excel_uploads with content_hash + empty field_mappings
     (ALIAS_TO_ATTR resolves Chinese column names directly)
  3. INSERT each row into smart_bi_dynamic_data with row_data JSONB
  4. For bill_flow_writer routes: call backfill_upload() → writes
     fact_pos_transaction + fact_pos_item

Per-file errors are isolated — one bad CSV doesn't fail the whole batch.

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §5.1 step ③
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from io import BytesIO
from typing import Optional

import asyncpg
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class IngestResult:
    upload_id: int
    rows_inserted_dynamic: int
    rows_inserted_silver: int
    min_date: Optional[str]  # ISO date for Gold materialize range
    max_date: Optional[str]


_2DFIRE_HEADER_MARKERS = ("门店名称", "门店", "店铺", "账单号", "订单号")


def _detect_header_row(csv_bytes: bytes, max_scan: int = 30) -> int:
    """Find the 0-indexed row where the actual data header lives.

    二维火 exports prepend 1-3 metadata rows (title / brand / query-filter)
    before the real header. We scan up to max_scan rows looking for the
    first row whose first non-empty cell is a known canonical column name
    (门店名称 / 账单号 / 订单号 / etc.).

    Returns 0 (no skip) if no marker is found — pandas will then use row 0
    as header (current behavior, identity preserved for non-二维火 files).
    """
    text = csv_bytes.decode("utf-8-sig", errors="replace").replace("\r\n", "\n").replace("\r", "\n")
    for i, line in enumerate(text.split("\n")[:max_scan]):
        # Strip outer quotes + take first cell
        cells = line.split(",", 5)
        if not cells:
            continue
        first = cells[0].strip().strip('"').strip()
        if first in _2DFIRE_HEADER_MARKERS:
            return i
    return 0


async def ingest_one_csv(
    pool: asyncpg.Pool,
    factory_id: str,
    inner_filename: str,
    csv_bytes: bytes,
    writer_name: str,
    content_hash: str,
    uploaded_by_id: Optional[int] = None,
) -> IngestResult:
    """Persist one inner CSV → Silver (if writer is real).

    Args:
        pool: smartbi_db async pool.
        factory_id: caller factory (already validated by /upload _enforce_factory_match).
        inner_filename: CSV name inside the zip (e.g. "20260422...订单付款方式汇总.csv")
        csv_bytes: raw CSV bytes from extract_inner_files.
        writer_name: e.g. "bill_flow_writer" / "daily_summary_writer".
        content_hash: outer-zip hash (so dedup matches on zip-level identity).
        uploaded_by_id: user id from JWT for audit trail.

    Returns:
        IngestResult with row counts + date range (for downstream Gold materialize).
    """
    # ─── 1. Parse CSV (skip 二维火 metadata rows before real header) ──
    header_row = _detect_header_row(csv_bytes)
    df = pd.read_csv(
        BytesIO(csv_bytes), encoding="utf-8-sig", engine="python",
        skipinitialspace=True, dtype=str,
        skiprows=header_row,  # ← skip title/brand/filter metadata
    )
    # NaN → None so asyncpg accepts
    df = df.where(pd.notnull(df), None)
    rows = df.to_dict(orient="records")
    sheet_name = inner_filename[:100]  # smart_bi_pg_excel_uploads.sheet_name VARCHAR(100)

    logger.info(
        "[pos-ingest] %s: header_row=%d, parsed %d rows × %d cols (first col=%r)",
        inner_filename, header_row, len(rows), len(df.columns),
        df.columns[0] if len(df.columns) else None,
    )

    # ─── 2. INSERT upload + dynamic_data rows ─────────────────────────
    async with pool.acquire() as conn:
        await conn.execute(
            "SELECT set_config('app.factory_id', $1, false)", factory_id
        )
        upload_id = await conn.fetchval(
            """
            INSERT INTO smart_bi_pg_excel_uploads
                (factory_id, file_name, sheet_name, content_hash,
                 row_count, column_count, field_mappings, upload_status,
                 uploaded_by, detected_table_type)
            VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb, 'COMPLETED', $7, 'POS')
            RETURNING id
            """,
            factory_id, inner_filename[:255], sheet_name, content_hash,
            len(rows), len(df.columns), uploaded_by_id,
        )

        # Bulk INSERT dynamic_data — use executemany. For very large CSVs
        # this could be optimized with COPY but 二维火 single files are
        # typically <100k rows.
        if rows:
            payload = [
                (factory_id, upload_id, sheet_name, i + 1, json.dumps(r, default=str))
                for i, r in enumerate(rows)
            ]
            await conn.executemany(
                """
                INSERT INTO smart_bi_dynamic_data
                    (factory_id, upload_id, sheet_name, row_index, row_data)
                VALUES ($1, $2, $3, $4, $5::jsonb)
                """,
                payload,
            )

    # ─── 3. Call writer (only bill_flow_writer is real) ───────────────
    rows_silver = 0
    min_d = max_d = None
    if writer_name == "bill_flow_writer":
        # Load backfill_silver via explicit file-path (sys.path approach failed
        # in uvicorn worker — `scripts/` isn't recognized as a package despite
        # __init__.py existing. importlib.util.spec_from_file_location bypasses
        # sys.path entirely.)
        import importlib.util as _importlib_util
        import os as _os
        _bf_path = _os.path.abspath(_os.path.join(
            _os.path.dirname(__file__), "..", "..", "scripts", "backfill_silver.py"
        ))
        _spec = _importlib_util.spec_from_file_location("scripts.backfill_silver", _bf_path)
        if _spec is None or _spec.loader is None:
            raise ImportError(f"could not load backfill_silver from {_bf_path}")
        _bf_mod = _importlib_util.module_from_spec(_spec)
        import sys as _sys
        _sys.modules["scripts.backfill_silver"] = _bf_mod
        _spec.loader.exec_module(_bf_mod)
        backfill_upload = _bf_mod.backfill_upload
        logger.info("[pos-ingest] loaded backfill_upload from %s", _bf_path)

        try:
            stats = await backfill_upload(
                pool, upload_id=upload_id, factory_id=factory_id
            )
            rows_silver = getattr(stats, "rows_queued", 0)
            logger.info(
                "[pos-ingest] %s: BillFlowWriter wrote %d Silver rows",
                inner_filename, rows_silver,
            )
        except Exception:
            logger.exception(
                "[pos-ingest] backfill_upload failed for upload %s", upload_id
            )
            # Don't re-raise — upload row + dynamic_data are intact for retry

        # Query date range from this upload's Silver rows for Gold materialize
        async with pool.acquire() as conn:
            await conn.execute(
                "SELECT set_config('app.factory_id', $1, false)", factory_id
            )
            row = await conn.fetchrow(
                """
                SELECT MIN(date)::text AS d1, MAX(date)::text AS d2
                FROM fact_pos_transaction
                WHERE factory_id = $1 AND upload_id = $2
                """,
                factory_id, upload_id,
            )
            if row:
                min_d, max_d = row["d1"], row["d2"]

    return IngestResult(
        upload_id=upload_id,
        rows_inserted_dynamic=len(rows),
        rows_inserted_silver=rows_silver,
        min_date=min_d,
        max_date=max_d,
    )
