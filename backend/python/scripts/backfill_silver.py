"""Backfill an existing upload from smart_bi_dynamic_data → Silver+Gold.

Week 4 Day 2 of Unified Data Layer v1 spec (Phase A.5).

Usage (CLI, admin-triggered):
    python -m scripts.backfill_silver --upload-id 4169 --factory F001 [--limit 500]

Or as a library:
    from scripts.backfill_silver import backfill_upload
    stats = await backfill_upload(pool, upload_id=4169, factory_id="F001")

What it does
------------
1. Reads the upload's field_mappings from smart_bi_pg_excel_uploads.
2. Streams rows from smart_bi_dynamic_data for the given upload_id.
3. For each row, applies field_mappings to extract canonical fields and
   constructs a CanonicalRow. Rows missing required fields (store_name,
   source_bill_no, date) are skipped + counted in the stats.
4. Delegates to gold.pipeline.ingest_and_materialize which writes Silver
   + materializes Gold.

This is Phase A.5 tooling — meant for backfilling the qhj 4169 upload
(per spec) so Phase B shadow-read can compare old vs. new paths. Safe
to re-run on the same upload_id; Silver's ON CONFLICT DO NOTHING makes
each row idempotent.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Iterable, List, Optional, Tuple

import asyncpg

from smartbi.canonical import CanonicalRow
from smartbi.gold import PipelineStats, ingest_and_materialize

logger = logging.getLogger(__name__)


# Canonical field aliases → CanonicalRow attribute. Covers both English
# canonical names (from semantic_mapper standard output) and common
# Chinese column names from qhj-style exports. Unknown aliases are
# silently ignored — rows missing required fields are reported in stats.
_ALIAS_TO_ATTR: Dict[str, str] = {
    # store
    "store_name": "store_name",
    "门店": "store_name",
    "门店名称": "store_name",
    "店铺": "store_name",
    "shop_name": "store_name",

    # bill no — qhj uses 账单号; other customers use 订单号 / 单号
    "source_bill_no": "source_bill_no",
    "bill_no": "source_bill_no",
    "order_no": "source_bill_no",
    "订单号": "source_bill_no",
    "单号": "source_bill_no",
    "账单号": "source_bill_no",
    "结账号": "source_bill_no",
    "外部单号": "source_bill_no",

    # date — 营业日期 is the qhj canonical; 开单时间 is an adjacent datetime
    # we don't need (date is derivable). Keep 营业日期 as the primary.
    "date": "date",
    "日期": "date",
    "营业日期": "date",
    "transaction_date": "date",
    "交易日期": "date",
    "order_date": "date",

    # staff — qhj has 3 roles; all map to staff_name with role inferred elsewhere
    "staff_name": "staff_name",
    "收银员": "staff_name",
    "服务员": "staff_name",
    "销售员": "staff_name",

    # bill-level amounts
    "gross_amount": "gross_amount",
    "应收金额": "gross_amount",
    "营业额": "gross_amount",
    "原价": "gross_amount",
    "商品折前金额": "gross_amount",

    "discount_amount": "discount_amount",
    "优惠金额": "discount_amount",
    "折扣金额": "discount_amount",
    "折扣额": "discount_amount",
    "代金券优惠": "discount_amount",

    "net_amount": "net_amount",
    "实收金额": "net_amount",
    "实收额": "net_amount",
    "商品折后金额": "net_amount",
    "净额": "net_amount",

    "actual_receive": "actual_receive",
    "收款金额": "actual_receive",
    "实收": "actual_receive",

    # counts — qhj uses 客流量 for customer head count
    "customer_count": "customer_count",
    "人数": "customer_count",
    "就餐人数": "customer_count",
    "客流量": "customer_count",

    # metadata
    "table_no": "table_no",
    "桌号": "table_no",
    "桌位": "table_no",

    "order_type": "order_type",
    "订单类型": "order_type",

    "channel_origin": "channel_origin",
    "来源": "channel_origin",
    "订单来源": "channel_origin",

    # combo string — qhj's 商品信息 is the full product list blob;
    # combo_parser splits it into fact_pos_item rows.
    "combo_string": "combo_string",
    "菜品明细": "combo_string",
    "商品": "combo_string",
    "商品信息": "combo_string",
    "订单明细": "combo_string",
}


_REQUIRED_ATTRS = ("store_name", "source_bill_no", "date")


@dataclass
class BackfillStats:
    upload_id: int
    factory_id: str
    rows_read: int = 0
    rows_skipped_missing_required: int = 0
    rows_queued: int = 0
    unknown_canonical_names: List[str] = field(default_factory=list)
    pipeline: Optional[PipelineStats] = None


def _parse_date(raw: Any) -> Optional[date]:
    """Best-effort date parse. Accepts 'YYYY-MM-DD', 'YYYY/MM/DD', or
    already-parsed date/datetime objects. Returns None on failure."""
    if raw is None or raw == "":
        return None
    if isinstance(raw, date) and not isinstance(raw, datetime):
        return raw
    if isinstance(raw, datetime):
        return raw.date()
    s = str(raw).strip()
    # Common shapes: "2026-04-21", "2026/4/21", "2026-04-21 12:34:56"
    m = re.match(r"^(\d{4})[-/](\d{1,2})[-/](\d{1,2})", s)
    if not m:
        return None
    try:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def _parse_decimal(raw: Any) -> Optional[Decimal]:
    if raw is None or raw == "":
        return None
    if isinstance(raw, Decimal):
        return raw
    try:
        # Strip currency symbols / commas common in Excel exports.
        s = str(raw).replace("¥", "").replace(",", "").strip()
        if not s:
            return None
        return Decimal(s)
    except (InvalidOperation, ValueError):
        return None


def _parse_int(raw: Any) -> Optional[int]:
    if raw is None or raw == "":
        return None
    try:
        return int(float(str(raw).strip()))
    except (ValueError, TypeError):
        return None


def _normalize_field_mappings(raw: Any) -> Dict[str, str]:
    """Normalize field_mappings JSONB into a {original_col: standard_field} dict.

    Legacy storage has two shapes in the wild:
      1. Dict format: {"门店名称": "store_name", ...}
      2. Array-of-objects format: [{"originalColumn": "门店名称",
         "standardField": "category_name", "dataType": "TEXT", ...}]

    Both come back from asyncpg as parsed Python objects (dict / list) when
    the JSONB codec is active, or as strings when not — handle both.
    """
    if raw is None:
        return {}
    if isinstance(raw, str):
        import json
        raw = json.loads(raw) if raw else None
        if raw is None:
            return {}
    if isinstance(raw, dict):
        return {str(k): str(v) for k, v in raw.items() if v is not None}
    if isinstance(raw, list):
        out: Dict[str, str] = {}
        for item in raw:
            if not isinstance(item, dict):
                continue
            orig = item.get("originalColumn") or item.get("original")
            std = item.get("standardField") or item.get("standard")
            if orig:
                out[str(orig)] = str(std) if std else ""
        return out
    return {}


def _lookup_attr(original_col: str, canonical_name: Optional[str]) -> Optional[str]:
    """Two-path lookup for mapping a column to a CanonicalRow attr:

    1. Preferred: canonical_name (from semantic_mapper's standardField).
    2. Fallback: original_col (the raw Chinese/English column name).

    The fallback matters because semantic_mapper sometimes emits generic
    type tags like 'category_name' / 'time_period' instead of specific
    business fields. In that case the Chinese original column name is the
    only reliable signal — so we look it up too.
    """
    if canonical_name:
        attr = _ALIAS_TO_ATTR.get(canonical_name)
        if attr is not None:
            return attr
    return _ALIAS_TO_ATTR.get(original_col)


def _build_canonical_row(
    row_data: Dict[str, Any],
    field_mappings: Dict[str, str],
    factory_id: str,
    source_type: str,
    upload_id: int,
    unknown_out: List[str],
) -> Optional[CanonicalRow]:
    """Convert one legacy row_data dict + field_mappings → CanonicalRow.

    Returns None if a required canonical field (store_name / source_bill_no
    / date) is missing or malformed.
    """
    attrs: Dict[str, Any] = {}

    for original_col, value in row_data.items():
        canonical_name = field_mappings.get(original_col)
        attr = _lookup_attr(original_col, canonical_name)
        if attr is None:
            # Track both paths' failures so admin can see what's dropped.
            unmapped_key = canonical_name or f"<raw>{original_col}"
            if unmapped_key not in unknown_out:
                unknown_out.append(unmapped_key)
            continue
        attrs[attr] = value

    # Required field typing + validation
    store_name = attrs.get("store_name")
    bill_no = attrs.get("source_bill_no")
    parsed_date = _parse_date(attrs.get("date"))

    if not store_name or not bill_no or parsed_date is None:
        return None

    return CanonicalRow(
        factory_id=factory_id,
        source_type=source_type,
        store_name=str(store_name).strip(),
        source_bill_no=str(bill_no).strip(),
        date=parsed_date,
        staff_name=(str(attrs["staff_name"]).strip() if attrs.get("staff_name") else None),
        upload_id=upload_id,
        table_no=(str(attrs["table_no"]) if attrs.get("table_no") else None),
        order_type=(str(attrs["order_type"]) if attrs.get("order_type") else None),
        channel_origin=(str(attrs["channel_origin"]) if attrs.get("channel_origin") else None),
        customer_count=_parse_int(attrs.get("customer_count")),
        gross_amount=_parse_decimal(attrs.get("gross_amount")),
        discount_amount=_parse_decimal(attrs.get("discount_amount")),
        net_amount=_parse_decimal(attrs.get("net_amount")),
        actual_receive=_parse_decimal(attrs.get("actual_receive")),
        combo_string=(str(attrs["combo_string"]) if attrs.get("combo_string") else None),
    )


async def backfill_upload(
    pool: asyncpg.Pool,
    upload_id: int,
    factory_id: str,
    *,
    source_type: str = "excel",
    limit: Optional[int] = None,
) -> BackfillStats:
    """Backfill one upload's rows through the Silver+Gold pipeline.

    `limit` caps rows processed — useful for dry-run / testing on a big
    historical upload before committing to the full run.
    """
    stats = BackfillStats(upload_id=upload_id, factory_id=factory_id)

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT field_mappings FROM smart_bi_pg_excel_uploads WHERE id = $1",
            upload_id,
        )
        if row is None:
            raise ValueError(f"upload {upload_id} not found in smart_bi_pg_excel_uploads")
        field_mappings = _normalize_field_mappings(row["field_mappings"])

    # Stream rows — don't pull all ~200K into memory. Use server-side cursor.
    rows_to_send: List[CanonicalRow] = []
    unknown: List[str] = []

    async with pool.acquire() as conn:
        query = "SELECT row_data FROM smart_bi_dynamic_data WHERE upload_id = $1"
        if limit is not None:
            query += f" LIMIT {int(limit)}"
        async for pg_row in _stream_rows(conn, query, upload_id):
            stats.rows_read += 1
            row_data = pg_row["row_data"]
            if isinstance(row_data, str):
                import json
                row_data = json.loads(row_data)
            canonical = _build_canonical_row(
                row_data, field_mappings, factory_id, source_type, upload_id, unknown,
            )
            if canonical is None:
                stats.rows_skipped_missing_required += 1
                continue
            rows_to_send.append(canonical)

    stats.rows_queued = len(rows_to_send)
    stats.unknown_canonical_names = unknown

    if rows_to_send:
        stats.pipeline = await ingest_and_materialize(pool, factory_id, rows_to_send)

    logger.info(
        "backfill upload=%d factory=%s read=%d skipped=%d queued=%d pipeline=%s",
        upload_id, factory_id,
        stats.rows_read, stats.rows_skipped_missing_required, stats.rows_queued,
        "yes" if stats.pipeline else "no-rows",
    )
    return stats


async def _stream_rows(
    conn: asyncpg.Connection, query: str, *args
) -> Iterable:
    """Yield rows one at a time from a query. Uses asyncpg cursor under
    a transaction (asyncpg requires the cursor to live inside tx)."""
    async with conn.transaction():
        async for row in conn.cursor(query, *args):
            yield row


async def _main_cli():
    import sys
    parser = argparse.ArgumentParser(description="Backfill one upload to Silver+Gold")
    parser.add_argument("--upload-id", type=int, required=True)
    parser.add_argument("--factory", required=True, help="factory_id for tenant_ctx")
    parser.add_argument("--limit", type=int, default=None, help="cap rows processed")
    parser.add_argument("--source-type", default="excel")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    from smartbi.config import get_settings
    from smartbi.tenant_ctx import set_factory_id, set_pg_connection_tenant

    settings = get_settings()
    if not settings.postgres_url:
        print("No Postgres configured", file=sys.stderr)
        return 1

    pool = await asyncpg.create_pool(
        settings.postgres_url, min_size=1, max_size=3,
        setup=set_pg_connection_tenant,
    )
    set_factory_id(args.factory)
    try:
        stats = await backfill_upload(
            pool, upload_id=args.upload_id, factory_id=args.factory,
            source_type=args.source_type, limit=args.limit,
        )
    finally:
        await pool.close()

    print(f"upload_id:       {stats.upload_id}")
    print(f"factory_id:      {stats.factory_id}")
    print(f"rows_read:       {stats.rows_read}")
    print(f"rows_skipped:    {stats.rows_skipped_missing_required}")
    print(f"rows_queued:     {stats.rows_queued}")
    if stats.unknown_canonical_names:
        print(f"unknown fields:  {stats.unknown_canonical_names}")
    if stats.pipeline:
        n = stats.pipeline.normalize
        print(f"silver written:  txn={n.transactions_written} items={n.items_written} "
              f"dup={n.duplicates_skipped}")
        print(f"gold upserts:    {stats.pipeline.trigger.total_rows_upserted}")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(_main_cli()))
