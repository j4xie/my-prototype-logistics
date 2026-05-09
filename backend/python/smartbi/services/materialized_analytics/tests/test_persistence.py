"""test_persistence.py — in-memory + integration tests for persistence layer."""
from __future__ import annotations

import os
import pytest

from smartbi.services.materialized_analytics.persistence import (
    _result_to_row_fields,
    save_materialization_results,
    load_materialization_results,
)
from smartbi.services.materialized_analytics.templates.base import TemplateResult


# ── Unit tests (no DB) ──


def test_result_to_row_fields_basic():
    result = TemplateResult(
        code="top_n_by_dim", title="Top 10 维度排名",
        data={"primary_dim": "门店名称", "top_rows": [{"label": "A", "total": 100}]},
        chart_config={"type": "bar", "series": []},
        kpis={"top_label": "A", "top_value": 100},
        insight_text="A 独占 100%",
    )
    fields = _result_to_row_fields(result)
    assert fields["analysis_type"] == "materialized:top_n_by_dim"
    assert fields["template_code"] == "top_n_by_dim"
    assert fields["analysis_result"]["title"] == "Top 10 维度排名"
    assert fields["analysis_result"]["data"]["primary_dim"] == "门店名称"
    assert len(fields["chart_configs"]) == 1
    assert fields["chart_configs"][0]["type"] == "bar"
    assert fields["kpi_values"]["top_label"] == "A"
    assert len(fields["insights"]) == 1
    assert fields["insights"][0] == "A 独占 100%"


def test_result_to_row_fields_no_chart():
    # Anomaly detection returns chart_config=None
    result = TemplateResult(
        code="anomaly_detection", title="异常值检测",
        data={"outliers": [], "stats": {}},
        chart_config=None,
        kpis={"outlier_count": 0},
        insight_text=None,
    )
    fields = _result_to_row_fields(result)
    assert fields["chart_configs"] == []
    assert fields["insights"] == []


# ── Integration tests (real DB, skippable) ──


@pytest.mark.integration
@pytest.mark.asyncio
async def test_persistence_roundtrip_real_db():
    """Save → load roundtrip against test smartbi_db using a fake upload slot.

    Uses upload_id=3971 which exists in test DB. Inserts fake materialized
    rows, loads them back, verifies, then cleans up.
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
        pool = await asyncpg.create_pool(dsn, min_size=1, max_size=2, timeout=5.0)
    except Exception as e:
        pytest.skip(f"Cannot connect to test DB: {e}")

    TEST_UPLOAD = 3971
    TEST_FACTORY = "F001"
    TEST_DOMAIN = "restaurant"

    # Fake results
    results = [
        TemplateResult(
            code="top_n_by_dim", title="Top 10 维度排名",
            data={"primary_dim": "门店", "top_rows": [{"label": "X", "total": 999}]},
            chart_config={"type": "bar", "title": {"text": "Top"}, "series": []},
            kpis={"top_label": "X", "top_value": 999},
            insight_text="X 独占 100%",
        ),
        TemplateResult(
            code="anomaly_detection", title="异常值检测",
            data={"outliers": [], "stats": {"mean": 100, "std": 10}},
            chart_config=None,
            kpis={"outlier_count": 0, "mean": 100},
            insight_text="无异常",
        ),
        # A skipped one (applies=False) — should NOT persist
        TemplateResult(
            code="monthly_trend", title="时间趋势",
            data={}, applies=False, skip_reason="no time field",
        ),
    ]

    try:
        # Save
        count = await save_materialization_results(
            pool, TEST_UPLOAD, TEST_FACTORY, TEST_DOMAIN, results
        )
        assert count == 2, f"Expected 2 saved (skipped monthly_trend), got {count}"

        # Load with factory_id check (should find both)
        loaded = await load_materialization_results(pool, TEST_UPLOAD, TEST_FACTORY)
        assert len(loaded) == 2
        codes = {r["code"] for r in loaded}
        assert codes == {"top_n_by_dim", "anomaly_detection"}

        # Find the top_n one
        top_n = next(r for r in loaded if r["code"] == "top_n_by_dim")
        assert top_n["title"] == "Top 10 维度排名"
        assert top_n["data"]["primary_dim"] == "门店"
        assert top_n["chart_config"]["type"] == "bar"
        assert top_n["kpis"]["top_value"] == 999
        assert top_n["insight_text"] == "X 独占 100%"
        assert top_n["domain"] == "restaurant"
        assert top_n["schema_version"] == 1

        # Find the anomaly one (chart_config = None)
        anomaly = next(r for r in loaded if r["code"] == "anomaly_detection")
        assert anomaly["chart_config"] is None
        assert anomaly["insight_text"] == "无异常"

        # Load with wrong factory_id (should return empty)
        other = await load_materialization_results(pool, TEST_UPLOAD, "F_OTHER")
        assert other == []

        # Upsert test — save again with changed data, confirm update not insert
        results[0].kpis["top_value"] = 1500
        count2 = await save_materialization_results(
            pool, TEST_UPLOAD, TEST_FACTORY, TEST_DOMAIN, results
        )
        assert count2 == 2
        loaded2 = await load_materialization_results(pool, TEST_UPLOAD, TEST_FACTORY)
        top_n2 = next(r for r in loaded2 if r["code"] == "top_n_by_dim")
        assert top_n2["kpis"]["top_value"] == 1500, "Upsert should update not insert new"

    finally:
        # Cleanup test rows
        async with pool.acquire() as conn:
            await conn.execute(
                """DELETE FROM smart_bi_pg_analysis_results
                   WHERE upload_id = $1
                     AND template_code IN ('top_n_by_dim', 'anomaly_detection')""",
                TEST_UPLOAD
            )
        await pool.close()
