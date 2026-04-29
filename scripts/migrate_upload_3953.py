"""
Layer A migration: re-run semantic mapper for upload_id=3953 with Layer A
fixes applied (A1 dedupe + A2 revenue_group + A3 data_type).

Runs on server. Targets smart_bi_pg_field_definitions of a single upload,
UPDATE in place (no row rewrite). Java is_measure/is_dimension/is_time
are recomputed from mapping.category to stay consistent.

Usage: python migrate_upload_3953.py [--dry-run]
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


sm_mod = _load("sm_layer_a", "smartbi/services/semantic_mapper.py")
SemanticMapper = sm_mod.SemanticMapper

import psycopg2

DRY_RUN = "--dry-run" in sys.argv

DB_CONF = dict(
    host="localhost",
    user="smartbi_user",
    password="smartbi_secure_password_2025",
    dbname="smartbi_db",
    port=5432,
)

UPLOAD_ID = 3953


def fetch_fields_and_samples(conn):
    """Pull current original_names + first 5 rows of sample data."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT original_name FROM smart_bi_pg_field_definitions "
            "WHERE upload_id=%s ORDER BY display_order",
            (UPLOAD_ID,),
        )
        headers = [r[0] for r in cur.fetchall()]

        cur.execute(
            "SELECT row_data FROM smart_bi_dynamic_data "
            "WHERE upload_id=%s ORDER BY row_index LIMIT 5",
            (UPLOAD_ID,),
        )
        # row_data is jsonb → {col_name: value, ...}
        samples = []
        for (row_data,) in cur.fetchall():
            samples.append([row_data.get(h) for h in headers])

    return headers, samples


def compute_flags(category):
    """Replicate Java inferSemanticType logic based on mapping.category."""
    is_measure = category in ("amount", "rate")
    is_dimension = category == "category"
    is_time = category == "time"
    return is_measure, is_dimension, is_time


def infer_semantic_type(standard, category):
    """Simple semantic_type inference (Java does this with regex on standard)."""
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


async def main():
    mapper = SemanticMapper()
    conn = psycopg2.connect(**DB_CONF)
    try:
        headers, samples = fetch_fields_and_samples(conn)
        print(f"Upload {UPLOAD_ID}: {len(headers)} fields, {len(samples)} sample rows")
        print(f"Headers: {headers}\n")

        result = await mapper.map_fields(
            columns=headers, sample_data=samples, factory_id="F001"
        )

        updates = []
        skipped_unmapped = []
        print(f"{'orig':<30} {'std':<25} {'cat':<10} {'type':<10} {'measure':<7} {'dim':<5} {'time':<5}")
        print("-" * 90)
        for m in result.field_mappings:
            # SAFETY: if mapper returned None (e.g. LLM fallback unavailable),
            # keep the existing standard_name/flags to avoid regressing well-
            # classified fields. Only migrate fields the new mapper is confident
            # about.
            if not m.standard:
                print(f"{m.original:<30} [SKIP — mapper returned None, preserving existing row]")
                skipped_unmapped.append(m.original)
                continue
            is_m, is_d, is_t = compute_flags(m.category)
            st = infer_semantic_type(m.standard, m.category)
            print(f"{m.original:<30} {m.standard or '':<25} {m.category or '':<10} "
                  f"{m.data_type or '':<10} {str(is_m):<7} {str(is_d):<5} {str(is_t):<5}")
            updates.append((
                m.standard,
                m.data_type,
                st,
                is_m,
                is_d,
                is_t,
                UPLOAD_ID,
                m.original,
            ))
        if skipped_unmapped:
            print(f"\n[INFO] Skipped {len(skipped_unmapped)} unmapped fields: {skipped_unmapped}")

        if DRY_RUN:
            print(f"\n[DRY-RUN] Would UPDATE {len(updates)} rows")
            return

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
        print(f"\n✅ UPDATED {len(updates)} field_definitions rows for upload {UPLOAD_ID}")
    finally:
        conn.close()


asyncio.run(main())
