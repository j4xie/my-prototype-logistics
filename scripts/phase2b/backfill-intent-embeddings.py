#!/usr/bin/env python3
"""Backfill ai_intent_configs.embedding for Phase 2B Stage 5 SEMANTIC matcher.

Computes embeddings via the cretas-embedding gRPC service (port 9090) using
intent_name + description as the source text, and writes vector(768) into the
new `embedding` column. Safe to re-run — only updates rows where embedding
IS NULL by default.

Usage (run on server 47.100.235.168, where the embedding service is reachable):
    cd /www/wwwroot/cretas/code/backend/python
    source venv38/bin/activate
    python /path/to/backfill-intent-embeddings.py --db cretas_prod_db
    python /path/to/backfill-intent-embeddings.py --db cretas_db  # also test
    python /path/to/backfill-intent-embeddings.py --db cretas_prod_db --refresh  # force re-embed all rows

Args:
    --db    target database (cretas_prod_db | cretas_db)
    --refresh   re-embed all rows (default: only rows with NULL embedding)
    --batch-size    rows per UPDATE batch (default 50)
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
import time
from typing import List, Optional, Tuple

# Make ai.embedding importable when run from anywhere
sys.path.insert(0, "/www/wwwroot/cretas/code/backend/python")

import asyncpg  # noqa: E402

from ai.embedding import get_embedding, vec_to_pgvector_text  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("backfill")


SELECT_ROWS_NEED_EMBED = """
SELECT id, intent_code, intent_name, intent_category, description,
       keywords, example_queries
FROM ai_intent_configs
WHERE deleted_at IS NULL
  AND is_active = true
  AND ({where_embedding})
ORDER BY priority DESC, intent_code ASC
"""

MIN_TEXT_LEN = 30  # rows shorter than this collapse in gte-base-zh — leave NULL

UPDATE_EMBEDDING = """
UPDATE ai_intent_configs
SET embedding = $1::vector,
    updated_at = NOW()
WHERE id = $2
"""


async def fetch_rows(pool: asyncpg.Pool, refresh: bool) -> List[asyncpg.Record]:
    where = "true" if refresh else "embedding IS NULL"
    sql = SELECT_ROWS_NEED_EMBED.format(where_embedding=where)
    async with pool.acquire() as conn:
        return await conn.fetch(sql)


def build_text(row) -> Optional[str]:
    """Source text for embedding: name + category + description + keywords + examples.

    Reason: gte-base-zh collapses on short Chinese (4-8 chars) — cos_sim ≈ 0.9999
    between unrelated phrases. Concatenating name + category + description +
    keywords + example_queries breaks the collapse for most rows.

    Returns None if total text length < MIN_TEXT_LEN — caller leaves embedding
    NULL so Stage 5 SEMANTIC filters those rows out (`WHERE embedding IS NOT NULL`)
    and the matcher falls through to keyword/classifier/LLM stages, which work
    well for short-text intents anyway.
    """
    import json
    name = (row["intent_name"] or "").strip()
    desc = (row["description"] or "").strip()
    category = (row["intent_category"] or "").strip()

    def _list_from_jsonb(v):
        if v is None:
            return []
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return [str(x).strip() for x in parsed if str(x).strip()]
            except json.JSONDecodeError:
                pass
        return []

    keywords = _list_from_jsonb(row.get("keywords"))
    examples = _list_from_jsonb(row.get("example_queries"))

    parts = []
    if name:
        parts.append(name)
    if category:
        parts.append(category)
    if desc and desc != name:  # avoid duplicate signal when desc==name
        parts.append(desc)
    parts.extend(keywords)
    parts.extend(examples)

    text = " ".join(parts)
    if len(text) < MIN_TEXT_LEN:
        return None
    return text


async def backfill_one(pool: asyncpg.Pool, row, attempt_idx: int, total: int) -> Tuple[bool, str]:
    """Returns (success, status) where status is 'ok' / 'skip_short' / 'fail_embed'."""
    text = build_text(row)
    if text is None:
        # Source text too short → leave NULL, will be skipped at Stage 5
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE ai_intent_configs SET embedding = NULL WHERE id = $1", row["id"]
            )
        return True, "skip_short"
    vec = await get_embedding(text)
    if vec is None:
        logger.warning("[%d/%d] %s: embedding service returned None, skip",
                       attempt_idx, total, row["intent_code"])
        return False, "fail_embed"
    if len(vec) != 768:
        logger.error("[%d/%d] %s: unexpected dim=%d (want 768)",
                     attempt_idx, total, row["intent_code"], len(vec))
        return False, "fail_dim"
    vec_text = vec_to_pgvector_text(vec)
    async with pool.acquire() as conn:
        await conn.execute(UPDATE_EMBEDDING, vec_text, row["id"])
    return True, "ok"


async def main(args):
    db_name = args.db
    pg_url = (
        f"postgresql://cretas_user:{os.environ.get('FOOD_KB_POSTGRES_PASSWORD', 'cretas123')}"
        f"@localhost:5432/{db_name}"
    )
    pool = await asyncpg.create_pool(pg_url, min_size=1, max_size=3)
    try:
        rows = await fetch_rows(pool, refresh=args.refresh)
        total = len(rows)
        if total == 0:
            logger.info("Nothing to backfill (db=%s refresh=%s).", db_name, args.refresh)
            return
        logger.info("Backfilling %d rows in db=%s (refresh=%s)", total, db_name, args.refresh)

        ok, skipped, fail = 0, 0, 0
        t0 = time.time()
        for i, row in enumerate(rows, 1):
            success, status = await backfill_one(pool, row, i, total)
            if status == "ok":
                ok += 1
            elif status == "skip_short":
                skipped += 1
            else:
                fail += 1
            if i % 50 == 0:
                elapsed = time.time() - t0
                rate = i / elapsed if elapsed > 0 else 0
                logger.info("Progress %d/%d (%.1f rows/s, ok=%d skip=%d fail=%d)",
                            i, total, rate, ok, skipped, fail)

        elapsed = time.time() - t0
        logger.info("Done. ok=%d skip=%d fail=%d total=%d elapsed=%.1fs",
                    ok, skipped, fail, total, elapsed)
    finally:
        await pool.close()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--db", required=True, choices=["cretas_prod_db", "cretas_db"])
    p.add_argument("--refresh", action="store_true",
                   help="re-embed all rows (default: only rows with NULL embedding)")
    p.add_argument("--batch-size", type=int, default=50)
    args = p.parse_args()
    asyncio.run(main(args))
