"""
Apr 20 2026 prod migration: re-run semantic mapper for qhj customer's 8
uploads in smartbi_prod_db using Layer A fixes.

Targets uploads: 3959, 3960, 3961, 3962, 3963, 3964, 3965, 4031
(factory F001, dongmenkou / qinghuajiao / shangma restaurant files).

Same logic as migrate_upload_3953.py but loops over multiple uploads
and points at smartbi_prod_db. Preserves rows where new mapper returns
None (LLM fallback skipped) to avoid regression.
"""
import asyncio
import importlib.util
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)


def _load(mod_name, rel_path):
    spec = importlib.util.spec_from_file_location(
        mod_name, os.path.join(BACKEND_DIR, rel_path)
    )
    mod = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = mod
    spec.loader.exec_module(mod)
    return mod


sm_mod = _load("sm_prod", "smartbi/services/semantic_mapper.py")
SemanticMapper = sm_mod.SemanticMapper

import psycopg2

DRY_RUN = "--dry-run" in sys.argv

DB_CONF = dict(
    host="localhost",
    user="smartbi_user",
    password="smartbi_secure_password_2025",
    dbname="smartbi_prod_db",
    port=5432,
)

UPLOAD_IDS = [3959, 3960, 3961, 3962, 3963, 3964, 3965, 4031]


def fetch_fields_and_samples(conn, upload_id):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT original_name FROM smart_bi_pg_field_definitions "
            "WHERE upload_id=%s ORDER BY display_order",
            (upload_id,),
        )
        headers = [r[0] for r in cur.fetchall()]

        cur.execute(
            "SELECT row_data FROM smart_bi_dynamic_data "
            "WHERE upload_id=%s ORDER BY row_index LIMIT 5",
            (upload_id,),
        )
        samples = []
        for (row_data,) in cur.fetchall():
            samples.append([row_data.get(h) for h in headers])

    return headers, samples


def compute_flags(category):
    is_measure = category in ("amount", "rate")
    is_dimension = category == "category"
    is_time = category == "time"
    return is_measure, is_dimension, is_time


def infer_semantic_type(standard, category):
    if not standard:
        return None
    s = standard.lower()
    base = s.rstrip("_0123456789").rstrip("_")
    if category == "time":
        return "date"
    if "revenue" in base or "amount" in base or base.endswith("金额") or "金额" in base:
        return "amount"
    if "rate" in base:
        return "rate"
    if "store" in base or "门店" in base:
        return "store"
    if "product" in base or "商品" in base:
        return "product"
    if "category" in base:
        return "category"
    if "id" in base:
        return "id"
    return None


async def migrate_one(conn, mapper, upload_id):
    headers, samples = fetch_fields_and_samples(conn, upload_id)
    if not headers:
        print(f"  upload {upload_id}: no headers, skipping")
        return 0, 0

    result = await mapper.map_fields(
        columns=headers, sample_data=samples, factory_id="F001"
    )

    updates = []
    skipped = []
    for m in result.field_mappings:
        if not m.standard:
            skipped.append(m.original)
            continue
        is_m, is_d, is_t = compute_flags(m.category)
        st = infer_semantic_type(m.standard, m.category)
        updates.append((
            m.standard, m.data_type, st, is_m, is_d, is_t, upload_id, m.original,
        ))

    if DRY_RUN:
        print(f"  upload {upload_id}: would update {len(updates)} rows "
              f"(skip unmapped: {len(skipped)})")
        for u in updates[:4]:
            print(f"    {u[7]:25} → std={u[0]:22} ftype={u[1]}")
        return 0, len(skipped)

    with conn.cursor() as cur:
        for u in updates:
            cur.execute(
                """
                UPDATE smart_bi_pg_field_definitions
                SET standard_name=%s, field_type=%s, semantic_type=%s,
                    is_measure=%s, is_dimension=%s, is_time=%s
                WHERE upload_id=%s AND original_name=%s
                """,
                u,
            )
    conn.commit()
    return len(updates), len(skipped)


async def main():
    mapper = SemanticMapper()
    conn = psycopg2.connect(**DB_CONF)
    try:
        print(f"{'DRY-RUN' if DRY_RUN else 'APPLY'} · smartbi_prod_db · "
              f"{len(UPLOAD_IDS)} uploads")
        total_updated = 0
        total_skipped = 0
        for uid in UPLOAD_IDS:
            updated, skipped = await migrate_one(conn, mapper, uid)
            total_updated += updated
            total_skipped += skipped
        print(f"\n{'DRY-RUN' if DRY_RUN else 'APPLIED'}: "
              f"updated={total_updated} skipped={total_skipped} uploads={len(UPLOAD_IDS)}")
    finally:
        conn.close()


asyncio.run(main())
