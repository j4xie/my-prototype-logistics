"""test_materializer.py"""
from __future__ import annotations

import os
import pytest
import pytest_asyncio

from smartbi.services.materialized_analytics.materializer import (
    build_schema, materialize_upload,
)
from smartbi.services.materialized_analytics.schema import Domain, FieldRole


def test_build_schema_maps_roles_correctly():
    field_meta = [
        {"original_name": "门店名称", "is_dimension": True, "is_measure": False, "is_time": False, "display_order": 1},
        {"original_name": "订单日期", "is_dimension": False, "is_measure": False, "is_time": True, "display_order": 2},
        {"original_name": "销售金额", "is_dimension": False, "is_measure": True, "is_time": False, "display_order": 3},
        {"original_name": "菜品名称", "is_dimension": True, "is_measure": False, "is_time": False, "display_order": 4},
    ]
    schema = build_schema(upload_id=42, factory_id="F001", field_meta=field_meta,
                          row_count=100, sample_rows=[])
    assert schema.domain == Domain.RESTAURANT  # keywords match: 门店名称, 菜品名称 + 销售金额
    assert schema.primary_measure == "销售金额"
    assert schema.time_field == "订单日期"
    assert len(schema.fields) == 4
    # Role mapping
    roles = {f.name: f.role for f in schema.fields}
    assert roles["门店名称"] == FieldRole.DIMENSION
    assert roles["订单日期"] == FieldRole.TIME
    assert roles["销售金额"] == FieldRole.MEASURE


def test_build_schema_primary_measure_prefers_keyword():
    # Should prefer 销售金额 over the alphabetically earlier 成本
    field_meta = [
        {"original_name": "成本", "is_dimension": False, "is_measure": True, "is_time": False, "display_order": 1},
        {"original_name": "销售金额", "is_dimension": False, "is_measure": True, "is_time": False, "display_order": 2},
        {"original_name": "门店", "is_dimension": True, "is_measure": False, "is_time": False, "display_order": 3},
        {"original_name": "菜品", "is_dimension": True, "is_measure": False, "is_time": False, "display_order": 4},
    ]
    schema = build_schema(upload_id=1, factory_id="F001", field_meta=field_meta,
                          row_count=10, sample_rows=[])
    assert schema.primary_measure == "销售金额"


def test_build_schema_unknown_domain_for_generic_fields():
    field_meta = [
        {"original_name": "col_a", "is_dimension": True, "is_measure": False, "is_time": False, "display_order": 1},
        {"original_name": "col_b", "is_dimension": False, "is_measure": True, "is_time": False, "display_order": 2},
    ]
    schema = build_schema(upload_id=1, factory_id="F001", field_meta=field_meta,
                          row_count=10, sample_rows=[])
    assert schema.domain == Domain.UNKNOWN


# Integration test — hits real test DB. Marked so can skip with -m 'not integration'
@pytest.mark.integration
@pytest.mark.asyncio
async def test_materialize_real_upload_3971():
    """Run materializer end-to-end against qhj_100.csv (upload 3971, 96 rows) on test DB.

    Connection string uses test env vars (run on server or via SSH tunnel).
    """
    try:
        import asyncpg
    except ImportError:
        pytest.skip("asyncpg not installed")

    dsn = os.environ.get(
        "TEST_SMARTBI_DSN",
        "postgresql://smartbi_user:smartbi_secure_password_2025@47.100.235.168:5432/smartbi_db"
    )
    try:
        pool = await asyncpg.create_pool(dsn, min_size=1, max_size=4, timeout=5.0)
    except Exception as e:
        pytest.skip(f"Cannot connect to test DB: {e}")

    try:
        results = await materialize_upload(pool, upload_id=3971)
    finally:
        await pool.close()

    # Expect 5 results total (one per registered template)
    assert len(results) == 5
    codes = [r.code for r in results]
    expected = {'top_n_by_dim', 'monthly_trend', 'category_distribution',
                'anomaly_detection', 'pareto_analysis'}
    assert set(codes) == expected

    applied = [r for r in results if r.applies]
    assert len(applied) >= 1  # at least some templates should produce output on real data
    print(f"applied: {[r.code for r in applied]}")
    print(f"skipped: {[(r.code, r.skip_reason) for r in results if not r.applies]}")
