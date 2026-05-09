"""KPI Bug B fix: backfill smart_bi_pg_field_definitions classification.

# 背景

Customer 5-7 截图发现 SmartBI 智能数据分析 KPI 卡片把 ID 字段 (团购ID /
评价ID / 门店美团ID) 当数值 SUM, 显示为 "31,184亿" / "383,816亿" 等荒谬值.

直接验证 (.tmp-transcripts/test-classify-v2.py): 当前 classify_column +
infer_agg_strategy 在这些列名上 **返回正确** semantic_type='id' /
agg_strategy='none'. 即代码逻辑没 bug.

根因: 历史 upload (4-23 ID detection 修复前) 的 smart_bi_pg_field_definitions
行被分类为 is_measure=true, agg_strategy='sum'. 修复部署后这些行 NOT
auto-reclassify → 旧 enrichment_cache 仍按旧 agg_strategy 跑 → KPI 卡片
显示错误 SUM.

# 修法

扫描所有 smart_bi_pg_field_definitions 行, 重跑 classify_column +
infer_agg_strategy, UPDATE 不一致的行 + 失效相应 upload 的
enrichment_cache. Idempotent (重跑产生 0 新 diff).

# Usage

    # Dry-run: print 哪些行会改, 不实际 UPDATE
    python -m smartbi.scripts.backfill_kpi_classification

    # Apply changes
    python -m smartbi.scripts.backfill_kpi_classification --apply

    # Filter to specific upload
    python -m smartbi.scripts.backfill_kpi_classification --upload-id 12345

    # Verbose per-row diffs
    python -m smartbi.scripts.backfill_kpi_classification --verbose

# Convention

- 默认 dry-run, 必须显式 --apply 才动 DB
- 改 agg_strategy / semantic_type / is_measure / is_dimension / is_time
- DELETE enrichment_cache rows of affected uploads (强制下次 page load 重算 KPI)
- 跑过的 upload 列表打印, 便于通知客户
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
from collections import defaultdict
from typing import Optional

import asyncpg

# Direct module load (bypass smartbi package __init__ which has unrelated import errors)
import importlib.util
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_FC_PATH = os.path.join(os.path.dirname(_THIS_DIR), "services", "field_classifier.py")
_spec = importlib.util.spec_from_file_location("field_classifier", _FC_PATH)
_fc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_fc)
classify_column = _fc.classify_column
infer_agg_strategy = _fc.infer_agg_strategy

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


def _db_url() -> str:
    """Read SMARTBI DB URL from env (parallel to smartbi.config)."""
    url = os.environ.get("SMARTBI_DB_URL") or os.environ.get("DATABASE_URL")
    if url:
        return url
    # Fallback assembly from POSTGRES_* vars
    user = os.environ.get("POSTGRES_USER", "smartbi")
    pwd = os.environ.get("POSTGRES_SMARTBI_PASSWORD", os.environ.get("POSTGRES_PASSWORD", ""))
    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = os.environ.get("POSTGRES_PORT", "5432")
    db = os.environ.get("POSTGRES_DB", "smartbi_db")
    return f"postgresql://{user}:{pwd}@{host}:{port}/{db}"


async def fetch_rows(conn: asyncpg.Connection, upload_id_filter: Optional[int]):
    """Fetch all field definition rows (optionally scoped to one upload)."""
    base_sql = """
        SELECT id, upload_id, original_name, field_type, semantic_type,
               is_measure, is_dimension, is_time, statistics, agg_strategy
        FROM smart_bi_pg_field_definitions
    """
    if upload_id_filter is not None:
        return await conn.fetch(base_sql + " WHERE upload_id = $1 ORDER BY upload_id, id", upload_id_filter)
    return await conn.fetch(base_sql + " ORDER BY upload_id, id")


def reclassify_row(row) -> dict:
    """Run current classify_column + infer_agg_strategy. Return new {fields}."""
    name = row["original_name"]
    field_type = row["field_type"]
    cls = classify_column(name, inferred_dtype=field_type)
    new_agg = infer_agg_strategy(
        name=name,
        semantic_type=cls.get("semantic_type"),
        is_measure=bool(cls.get("is_measure")),
        statistics=row["statistics"],  # JSONB → asyncpg gives dict
    )
    return {
        "semantic_type": cls.get("semantic_type"),
        "is_measure": bool(cls.get("is_measure")),
        "is_dimension": bool(cls.get("is_dimension")),
        "is_time": bool(cls.get("is_time")),
        "agg_strategy": new_agg,
    }


def row_diff(old, new) -> Optional[dict]:
    """Return dict of changed fields, or None if identical."""
    diffs = {}
    for k in ("semantic_type", "is_measure", "is_dimension", "is_time", "agg_strategy"):
        old_v = old[k]
        new_v = new[k]
        if (old_v or None) != (new_v or None):
            diffs[k] = (old_v, new_v)
    return diffs or None


async def apply_row_update(conn: asyncpg.Connection, row_id: int, new: dict):
    await conn.execute(
        """UPDATE smart_bi_pg_field_definitions
           SET semantic_type = $1, is_measure = $2, is_dimension = $3,
               is_time = $4, agg_strategy = $5
           WHERE id = $6""",
        new["semantic_type"], new["is_measure"], new["is_dimension"],
        new["is_time"], new["agg_strategy"], row_id,
    )


async def invalidate_enrichment_cache(conn: asyncpg.Connection, upload_ids: set):
    """Delete enrichment_cache rows so next page load recomputes KPI summary."""
    if not upload_ids:
        return 0
    deleted = await conn.fetchval(
        """WITH del AS (
             DELETE FROM smart_bi_pg_analysis_results
             WHERE upload_id = ANY($1::bigint[]) AND analysis_type = 'enrichment_cache'
             RETURNING 1
           )
           SELECT COUNT(*) FROM del""",
        list(upload_ids),
    )
    return deleted or 0


async def main(apply: bool, upload_id: Optional[int], verbose: bool):
    conn = await asyncpg.connect(_db_url())
    try:
        rows = await fetch_rows(conn, upload_id)
        logger.info(f"scanned {len(rows)} field definition rows{f' for upload {upload_id}' if upload_id else ''}")

        # Group changes
        changed = []
        change_by_upload: dict[int, int] = defaultdict(int)
        change_by_field: dict[str, int] = defaultdict(int)  # diff field name → count

        for row in rows:
            new = reclassify_row(row)
            d = row_diff(row, new)
            if d:
                changed.append((row, new, d))
                change_by_upload[row["upload_id"]] += 1
                for k in d:
                    change_by_field[k] += 1

        # Print summary
        logger.info(f"would-change rows: {len(changed)} / {len(rows)}")
        if change_by_field:
            logger.info("changes by field:")
            for k, n in sorted(change_by_field.items()):
                logger.info(f"  {k}: {n}")
        if change_by_upload:
            logger.info(f"affects {len(change_by_upload)} uploads (top 10):")
            for uid, n in sorted(change_by_upload.items(), key=lambda x: -x[1])[:10]:
                logger.info(f"  upload_id={uid}: {n} field rows")

        if verbose and changed:
            logger.info("---per-row diffs (first 20)---")
            for row, _new, d in changed[:20]:
                diff_str = ", ".join(f"{k}: {v[0]!r} → {v[1]!r}" for k, v in d.items())
                logger.info(f"  upload={row['upload_id']} '{row['original_name']}' [{row['field_type']}] {diff_str}")

        # ID-as-SUM-bug specifically: count rows where old.agg_strategy='sum' + new.semantic_type='id'
        id_bug_rows = [
            (row, new, d) for row, new, d in changed
            if d.get("semantic_type", (None, None))[1] == "id"
            and (row["agg_strategy"] or "sum") == "sum"
        ]
        logger.info(f"\n🎯 ID-as-SUM bug rows (Bug B target): {len(id_bug_rows)}")
        for row, _new, _d in id_bug_rows[:10]:
            logger.info(f"  upload={row['upload_id']} '{row['original_name']}' was sum → now id/none")

        # Apply or dry-run
        if not apply:
            logger.info("\n⚠️ DRY-RUN — no DB writes. Re-run with --apply to commit.")
            return

        async with conn.transaction():
            for row, new, _d in changed:
                await apply_row_update(conn, row["id"], new)
            cache_deleted = await invalidate_enrichment_cache(conn, set(change_by_upload.keys()))
        logger.info(f"\n✅ APPLIED: {len(changed)} field rows updated, "
                    f"{cache_deleted} enrichment_cache rows invalidated.")
        logger.info(f"affected uploads: {sorted(change_by_upload.keys())}")
        logger.info("Customer next page load will recompute KPI summary with corrected agg_strategy.")
    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill smart_bi_pg_field_definitions classification (Bug B fix)")
    parser.add_argument("--apply", action="store_true",
                        help="Actually UPDATE DB (default: dry-run)")
    parser.add_argument("--upload-id", type=int, default=None,
                        help="Limit to a single upload_id (default: scan all)")
    parser.add_argument("--verbose", action="store_true",
                        help="Print per-row diffs (first 20)")
    args = parser.parse_args()
    asyncio.run(main(apply=args.apply, upload_id=args.upload_id, verbose=args.verbose))
