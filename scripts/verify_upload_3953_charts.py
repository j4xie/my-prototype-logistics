"""
E2E verify: upload 3953 post-migration → chart pipeline output is clean.

Queries live DB for upload 3953's field_definitions + sample row_data,
builds DataSummary from them (as chart_recommender would see), runs
_minimal_fallback, and dumps recommended charts with x_axis for inspection.

Key checks:
- No collision-suffixed 数量金额_N used as x_axis (should be measure only)
- x_axis uses real dim name (门店/商品分类/etc), not generic 'category'
- cardinality gate should block mismatched charts if a dim has unique_count=1
"""
import importlib.util
import os
import sys
import psycopg2

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


cr_mod = _load("cr", "smartbi/services/chart_recommender.py")
DataSummary = cr_mod.DataSummary
ChartRecommender = cr_mod.ChartRecommender

DB_CONF = dict(
    host="localhost",
    user="smartbi_user",
    password="smartbi_secure_password_2025",
    dbname="smartbi_db",
    port=5432,
)

UPLOAD_ID = 3953


def build_features_from_db():
    """Mimic what data_feature_analyzer would produce for upload 3953."""
    conn = psycopg2.connect(**DB_CONF)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT original_name, standard_name, field_type,
                   is_measure, is_dimension, is_time
            FROM smart_bi_pg_field_definitions
            WHERE upload_id=%s
            ORDER BY display_order
            """,
            (UPLOAD_ID,),
        )
        rows = cur.fetchall()

        cur.execute(
            "SELECT row_data FROM smart_bi_dynamic_data "
            "WHERE upload_id=%s",
            (UPLOAD_ID,),
        )
        all_rows = [r[0] for r in cur.fetchall()]

    features = []
    for orig, std, dtype, is_m, is_d, is_t in rows:
        # Compute uniqueCount from actual data
        values = set()
        for row in all_rows:
            v = row.get(orig)
            if v is not None and str(v).strip():
                values.add(str(v))
        unique_count = len(values)

        # Map field_type (NUMERIC/TEXT/empty) + flags to DataSummary's expected type
        if is_t:
            dt = "DATE"
        elif is_m:
            dt = "NUMERIC"
        elif is_d:
            dt = "CATEGORICAL"
        else:
            dt = dtype or "TEXT"

        features.append({
            "columnName": orig,
            "dataType": dt,
            "uniqueCount": unique_count,
            "sampleValues": [],
        })
    conn.close()
    return features, len(all_rows)


def main():
    features, row_count = build_features_from_db()
    print(f"=== Upload {UPLOAD_ID} analysis after Layer A migration ===")
    print(f"Row count: {row_count}")
    print(f"\nColumn cardinalities:")
    for f in features:
        print(f"  {f['columnName']:<30} type={f['dataType']:<12} unique={f['uniqueCount']}")

    ds = DataSummary.from_feature_results(features, row_count=row_count)
    print(f"\nDataSummary:")
    print(f"  time_columns: {ds.time_columns}")
    print(f"  category_columns: {ds.category_columns}")
    print(f"  measures: {ds.measures}")
    print(f"  cardinality: {ds.cardinality}")

    svc = ChartRecommender()
    recs = svc._minimal_fallback(ds, scenario="restaurant")
    print(f"\n=== Recommended charts ({len(recs)}) ===")
    for i, r in enumerate(recs, 1):
        print(f"  {i}. [{r.chart_type}] title={r.title!r} x_axis={r.x_axis} y_axis={r.y_axis}")

    # Verify x_axis is not a measure column
    measure_set = set(ds.measures)
    chart_bugs = [r for r in recs if r.x_axis in measure_set]
    if chart_bugs:
        print(f"\n⚠️  Chart bug: {len(chart_bugs)} charts use a measure as x_axis")
        for b in chart_bugs:
            print(f"    - {b.chart_type} title={b.title!r} x_axis={b.x_axis}")
    else:
        print(f"\n✅ All x_axes use dimension columns (not measures)")

    # Verify chart titles are meaningful
    generic_titles = [r for r in recs if r.title in ("分类对比", "占比分析")]
    print(f"\nGeneric-title charts: {len(generic_titles)} (may be acceptable for minimal fallback)")


main()
