"""Tests for /api/smartbi/provenance/audit endpoint (Sub-Project C Day 26).

Verifies the cell-level lineage detail endpoint:
  - Empty cell → {current: None, history: []}
  - Single active row (sentinel) → file_name None, is_backfill False
  - Active + superseded chain → current is the active, history has both
    in valid_from DESC order
  - Backfill flag from created_by='backfill_from_agg'
  - Non-sentinel upload → file_name surfaced from JOIN
  - RBAC: non-admin role → 403
  - Bad entity_id → 400

Real-PG fixture follows the test_top_products_provenance.py pattern:
skips when settings.postgres_url is unset, RLS scoped via set_factory_id.

The HTTP-level tests use FastAPI TestClient with a fresh ``FastAPI`` app
that mounts the router and a tiny middleware that injects ``request.state``
the same way auth_middleware.py does in prod. We don't reuse the global
``main.py`` app so the test stays focused and we don't have to start the
full service stack.
"""
from __future__ import annotations

from datetime import date
from typing import Optional

import pytest
import pytest_asyncio


_TENANT = "TEST_AUDIT_C"


# P2-7: pool fixture extracted to conftest.py as c_provenance_pool. Local
# alias keeps existing call sites stable.
@pytest_asyncio.fixture
async def pool(c_provenance_pool):
    yield c_provenance_pool


async def _clean(conn, tenant: str, extra_upload_ids: list[int] | None = None) -> None:
    """Wipe field_provenance and (optionally) any test upload rows.

    field_provenance has FK ON DELETE RESTRICT to smart_bi_pg_excel_uploads
    so it must be wiped first. Sentinel upload (id=0) is left intact —
    it's owned by the migration, not the test.
    """
    await conn.execute("DELETE FROM field_provenance WHERE factory_id=$1", tenant)
    if extra_upload_ids:
        # Defensive: only delete if it's a tenant-owned row, never id=0.
        for uid in extra_upload_ids:
            if uid == 0:
                continue
            await conn.execute(
                "DELETE FROM smart_bi_pg_excel_uploads WHERE id=$1 AND factory_id=$2",
                uid, tenant,
            )


@pytest_asyncio.fixture
async def clean_rows(pool):
    """Pre/post wipe of tenant rows. Caller seeds inside the test."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    token = set_factory_id(_TENANT)
    extra_uploads: list[int] = []
    try:
        async with pool.acquire() as conn:
            await _clean(conn, _TENANT)
        # Yield a list the test can append upload ids to so cleanup
        # picks them up regardless of which test branch ran.
        yield extra_uploads
    finally:
        async with pool.acquire() as conn:
            await _clean(conn, _TENANT, extra_uploads)
        reset_factory_id(token)


async def _insert_provenance(
    conn,
    tenant: str,
    *,
    entity_type: str = "product",
    entity_id: int = 1,
    field_name: str = "revenue",
    field_value: float = 100.0,
    confidence: float = 0.9,
    source_type: str = "manual",
    source_upload_id: int = 0,
    mapper_method: str = "rule",
    valid_from: date = date(2026, 4, 1),
    valid_to: Optional[date] = None,
    superseded_by_id: Optional[int] = None,
    superseded_reason: Optional[str] = None,
    created_by: Optional[str] = None,
    confidence_method: Optional[str] = None,
    notes: Optional[str] = None,
) -> int:
    """Direct INSERT, returns the generated id."""
    return int(
        await conn.fetchval(
            """
            INSERT INTO field_provenance
              (factory_id, entity_type, entity_id, field_name, field_value,
               source_upload_id, source_type, confidence, valid_from, valid_to,
               mapper_method, superseded_by_id, superseded_reason,
               created_by, confidence_method, notes)
            VALUES ($1, $2, $3, $4, to_jsonb($5::float8),
                    $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING id
            """,
            tenant, entity_type, entity_id, field_name, field_value,
            source_upload_id, source_type, confidence, valid_from, valid_to,
            mapper_method, superseded_by_id, superseded_reason,
            created_by, confidence_method, notes,
        )
    )


# ── Direct-call tests for the SQL/shape (no HTTP) ──────────────────────


@pytest.mark.asyncio
async def test_audit_returns_empty_when_cell_has_no_provenance(pool, clean_rows):
    """Empty cell → current null, history empty."""
    from smartbi.api.provenance_audit import get_cell_audit
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    # Build a fake Request with the auth state the endpoint reads.
    class _S:
        role = "factory_super_admin"
        auth_method = "jwt"
        factory_id = _TENANT

    class _Req:
        state = _S()

    token = set_factory_id(_TENANT)
    try:
        out = await get_cell_audit(
            request=_Req(),  # type: ignore[arg-type]
            factory_id=_TENANT,
            entity_type="product",
            entity_id="42",
            field="revenue",
        )
    finally:
        reset_factory_id(token)

    assert out["current"] is None
    assert out["history"] == []
    assert out["key"] == {
        "factory_id": _TENANT,
        "entity_type": "product",
        "entity_id": "42",
        "field": "revenue",
    }


@pytest.mark.asyncio
async def test_audit_single_active_row_sentinel(pool, clean_rows):
    """One active row, sentinel upload → file_name None, is_backfill False."""
    from smartbi.api.provenance_audit import get_cell_audit
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    class _S:
        role = "platform_admin"
        auth_method = "jwt"
        factory_id = _TENANT

    class _Req:
        state = _S()

    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            row_id = await _insert_provenance(
                conn, _TENANT,
                entity_id=1, field_name="cost_per_unit",
                field_value=60.0, confidence=0.95,
                source_type="industry_default",
                source_upload_id=0,  # sentinel
                created_by="rule_engine",
                confidence_method="rule",
                notes="from default cost rate",
            )

        out = await get_cell_audit(
            request=_Req(),  # type: ignore[arg-type]
            factory_id=_TENANT,
            entity_type="product",
            entity_id="1",
            field="cost_per_unit",
        )
    finally:
        reset_factory_id(token)

    assert out["current"] is not None
    cur = out["current"]
    assert cur["id"] == row_id
    assert cur["source_type"] == "industry_default"
    assert cur["source_upload_id"] == 0
    assert cur["file_name"] is None  # NC-4: sentinel masked
    assert cur["confidence"] == pytest.approx(0.95, abs=0.0001)
    assert cur["mapper_method"] == "rule"
    assert cur["created_by"] == "rule_engine"
    assert cur["confidence_method"] == "rule"
    assert cur["is_backfill"] is False
    # field_value JSONB → primitive (60.0 cast through to_jsonb).
    assert cur["field_value"] == 60.0
    assert len(out["history"]) == 1
    assert out["history"][0]["id"] == row_id


@pytest.mark.asyncio
async def test_audit_active_plus_superseded_chain(pool, clean_rows):
    """Two-row chain: active newest, superseded older. current = active."""
    from smartbi.api.provenance_audit import get_cell_audit
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    class _S:
        role = "factory_super_admin"
        auth_method = "jwt"
        factory_id = _TENANT

    class _Req:
        state = _S()

    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            # Active first (so the older row can FK-reference it).
            active_id = await _insert_provenance(
                conn, _TENANT,
                entity_id=2, field_name="cost_per_unit",
                field_value=70.0, confidence=0.95,
                source_type="manual", source_upload_id=0,
                valid_from=date(2026, 7, 1),
            )
            old_id = await _insert_provenance(
                conn, _TENANT,
                entity_id=2, field_name="cost_per_unit",
                field_value=55.0, confidence=0.5,
                source_type="industry_default", source_upload_id=0,
                valid_from=date(2026, 1, 1),
                superseded_by_id=active_id,
                superseded_reason="higher_priority",
            )

        out = await get_cell_audit(
            request=_Req(),  # type: ignore[arg-type]
            factory_id=_TENANT,
            entity_type="product",
            entity_id="2",
            field="cost_per_unit",
        )
    finally:
        reset_factory_id(token)

    assert out["current"]["id"] == active_id
    assert out["current"]["superseded_by_id"] is None
    assert out["current"]["confidence"] == pytest.approx(0.95, abs=0.0001)
    # History sorted valid_from DESC: active (2026-07-01) before old (2026-01-01).
    assert [h["id"] for h in out["history"]] == [active_id, old_id]
    assert out["history"][1]["superseded_by_id"] == active_id
    assert out["history"][1]["superseded_reason"] == "higher_priority"


@pytest.mark.asyncio
async def test_audit_flags_backfill_rows(pool, clean_rows):
    """Row with created_by='backfill_from_agg' → is_backfill True."""
    from smartbi.api.provenance_audit import get_cell_audit
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    class _S:
        role = "platform_admin"
        auth_method = "jwt"
        factory_id = _TENANT

    class _Req:
        state = _S()

    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            await _insert_provenance(
                conn, _TENANT,
                entity_id=3, field_name="revenue",
                created_by="backfill_from_agg",
            )

        out = await get_cell_audit(
            request=_Req(),  # type: ignore[arg-type]
            factory_id=_TENANT,
            entity_type="product",
            entity_id="3",
            field="revenue",
        )
    finally:
        reset_factory_id(token)

    assert out["current"]["is_backfill"] is True
    assert out["current"]["created_by"] == "backfill_from_agg"


@pytest.mark.asyncio
async def test_audit_surfaces_file_name_for_real_upload(pool, clean_rows):
    """Non-sentinel upload → file_name flowed from JOIN."""
    from smartbi.api.provenance_audit import get_cell_audit
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    class _S:
        role = "factory_super_admin"
        auth_method = "jwt"
        factory_id = _TENANT

    class _Req:
        state = _S()

    extra_upload_ids = clean_rows  # the fixture yields the list

    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            # Insert a real upload row this tenant owns. Use a high id so
            # we don't collide with anything already in the table.
            uid = await conn.fetchval(
                """
                INSERT INTO smart_bi_pg_excel_uploads
                  (factory_id, file_name, upload_status)
                VALUES ($1, $2, 'COMPLETED')
                RETURNING id
                """,
                _TENANT, "recipe_v3_2026.xlsx",
            )
            extra_upload_ids.append(int(uid))

            await _insert_provenance(
                conn, _TENANT,
                entity_id=4, field_name="cost_per_unit",
                field_value=42.0, confidence=0.88,
                source_type="pos_excel",
                source_upload_id=int(uid),
            )

        out = await get_cell_audit(
            request=_Req(),  # type: ignore[arg-type]
            factory_id=_TENANT,
            entity_type="product",
            entity_id="4",
            field="cost_per_unit",
        )
    finally:
        reset_factory_id(token)

    assert out["current"]["source_upload_id"] == int(uid)
    assert out["current"]["file_name"] == "recipe_v3_2026.xlsx"
    assert out["current"]["source_type"] == "pos_excel"


# ── RBAC + input-validation tests (don't need PG) ──────────────────────


@pytest.mark.asyncio
async def test_audit_rejects_non_admin_role():
    """Non-admin role → 403, no DB query attempted."""
    from fastapi import HTTPException
    from smartbi.api.provenance_audit import get_cell_audit

    class _S:
        role = "operator"
        auth_method = "jwt"
        factory_id = _TENANT

    class _Req:
        state = _S()

    with pytest.raises(HTTPException) as exc:
        await get_cell_audit(
            request=_Req(),  # type: ignore[arg-type]
            factory_id=_TENANT,
            entity_type="product",
            entity_id="1",
            field="revenue",
        )
    assert exc.value.status_code == 403
    assert "管理员" in exc.value.detail


@pytest.mark.asyncio
async def test_audit_rejects_when_no_auth_state():
    """Missing role on request.state → 401."""
    from fastapi import HTTPException
    from smartbi.api.provenance_audit import get_cell_audit

    class _S:
        role = None
        auth_method = None
        factory_id = None

    class _Req:
        state = _S()

    with pytest.raises(HTTPException) as exc:
        await get_cell_audit(
            request=_Req(),  # type: ignore[arg-type]
            factory_id=_TENANT,
            entity_type="product",
            entity_id="1",
            field="revenue",
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_audit_rejects_non_integer_entity_id():
    """entity_id='abc' → 400, no DB query attempted."""
    from fastapi import HTTPException
    from smartbi.api.provenance_audit import get_cell_audit

    class _S:
        role = "factory_super_admin"
        auth_method = "jwt"
        factory_id = _TENANT

    class _Req:
        state = _S()

    with pytest.raises(HTTPException) as exc:
        await get_cell_audit(
            request=_Req(),  # type: ignore[arg-type]
            factory_id=_TENANT,
            entity_type="product",
            entity_id="abc",
            field="revenue",
        )
    assert exc.value.status_code == 400


# ─────────────────────────────────────────────────────────────────────────
# P0-C3 (post-review test backfill): _parse_entity_id boundary coverage.
# Adds the 3 cases the original P2-12 commit `cc38b4270` shipped without:
#   1. entity_id="0" → 400 (must be POSITIVE integer, 0 is not)
#   2. entity_id="-5" → 400 (negative branch)
#   3. entity_id="9999999999999999999999" → 400 (BIGINT overflow guard,
#      added by `cc38b4270` to convert PG's 500 NumericOutOfRange into a
#      friendly 400. Without this test the guard could be silently
#      removed by a refactor and tests would still pass.)
# ─────────────────────────────────────────────────────────────────────────

class _AdminState:
    role = "factory_super_admin"
    auth_method = "jwt"
    factory_id = _TENANT


class _AdminRequest:
    state = _AdminState()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "bad_entity_id,expected_substr",
    [
        ("0", "正整数"),                          # zero rejected by ``v <= 0`` branch
        ("-5", "正整数"),                          # negative rejected by same branch
        ("9999999999999999999999", "BIGINT 范围"),  # overflows PG BIGINT max
    ],
)
async def test_audit_rejects_entity_id_boundary(bad_entity_id, expected_substr):
    """entity_id boundary cases: 0, negative, BIGINT-overflow → 400 with
    Chinese detail mentioning the right keyword.
    """
    from fastapi import HTTPException
    from smartbi.api.provenance_audit import get_cell_audit

    with pytest.raises(HTTPException) as exc:
        await get_cell_audit(
            request=_AdminRequest(),  # type: ignore[arg-type]
            factory_id=_TENANT,
            entity_type="product",
            entity_id=bad_entity_id,
            field="revenue",
        )
    assert exc.value.status_code == 400
    assert expected_substr in exc.value.detail


# ─────────────────────────────────────────────────────────────────────────
# P0-C1 (post-review test backfill): truncated banner end-to-end.
# Seeds 501 rows for one cell, verifies:
#   - response.truncated is True
#   - response.history has exactly 500 rows (HISTORY_LIMIT, +1 buffer dropped)
#   - response.history_limit echoes the constant 500
# Pair with the corresponding vitest in cell-audit.spec.ts that asserts the
# UI banner appears when truncated:true is in the API response.
# ─────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_audit_truncated_when_history_exceeds_limit(pool, clean_rows):
    """501 rows for one cell → response truncates to 500 + flags it.

    All rows have superseded_by_id pointing at one "current" row so the
    history is large but uq_fp_dedup partial unique stays clean (only
    one active row).
    """
    from datetime import date as _date

    from smartbi.api.provenance_audit import get_cell_audit
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            # Insert 1 active row first so we can point all the rest at it.
            current_id = int(
                await conn.fetchval(
                    """
                    INSERT INTO field_provenance
                      (factory_id, entity_type, entity_id, field_name, field_value,
                       source_upload_id, source_type, confidence, valid_from,
                       mapper_method, created_by)
                    VALUES ($1, 'product', 999, 'revenue', '{"v": 999}'::jsonb,
                            0, 'manual', 0.95, $2,
                            'rule', 'truncate_seed')
                    RETURNING id
                    """,
                    _TENANT, _date(2026, 1, 1),
                )
            )

            # Build 501 superseded rows in one batch (use executemany).
            # valid_from steps from 2024-01-01 backwards by day so each row
            # is distinct (avoids any uniq constraint on the dedup key).
            rows = [
                (
                    _TENANT, "product", 999, "revenue",
                    f'{{"v": {i}}}',
                    0, "inferred", 0.5,
                    _date(2024 - (i // 365), 1, 1).replace(
                        # cheap distinct dates: month wraps using i, year decremented
                        month=((i % 12) + 1),
                    ),
                    "rule", current_id, f"hist_{i}",
                )
                for i in range(501)
            ]
            await conn.executemany(
                """
                INSERT INTO field_provenance
                  (factory_id, entity_type, entity_id, field_name, field_value,
                   source_upload_id, source_type, confidence, valid_from,
                   mapper_method, superseded_by_id, created_by)
                VALUES ($1, $2, $3, $4, $5::jsonb,
                        $6, $7, $8, $9, $10, $11, $12)
                """,
                rows,
            )

        result = await get_cell_audit(
            request=_AdminRequest(),  # type: ignore[arg-type]
            factory_id=_TENANT,
            entity_type="product",
            entity_id="999",
            field="revenue",
        )
    finally:
        reset_factory_id(token)

    # Total seeded = 1 active + 501 superseded = 502 rows.
    # Response should cap at HISTORY_LIMIT=500 and flag truncated.
    assert result["truncated"] is True
    assert result["history_limit"] == 500
    assert len(result["history"]) == 500
    # current still picked correctly (the one active row should be in
    # the first 500 since they're ordered valid_from DESC and 2026-01-01
    # is the most recent).
    assert result["current"] is not None
    assert result["current"]["id"] == current_id


@pytest.mark.asyncio
async def test_audit_not_truncated_at_exactly_limit(pool, clean_rows):
    """500 rows total → truncated=False (boundary inclusive of LIMIT)."""
    from datetime import date as _date

    from smartbi.api.provenance_audit import get_cell_audit
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            current_id = int(
                await conn.fetchval(
                    """
                    INSERT INTO field_provenance
                      (factory_id, entity_type, entity_id, field_name, field_value,
                       source_upload_id, source_type, confidence, valid_from,
                       mapper_method, created_by)
                    VALUES ($1, 'product', 998, 'revenue', '{"v": 998}'::jsonb,
                            0, 'manual', 0.95, $2,
                            'rule', 'truncate_seed')
                    RETURNING id
                    """,
                    _TENANT, _date(2026, 1, 1),
                )
            )
            rows = [
                (
                    _TENANT, "product", 998, "revenue",
                    f'{{"v": {i}}}',
                    0, "inferred", 0.5,
                    _date(2024 - (i // 365), ((i % 12) + 1), 1),
                    "rule", current_id, f"hist_{i}",
                )
                for i in range(499)
            ]
            await conn.executemany(
                """
                INSERT INTO field_provenance
                  (factory_id, entity_type, entity_id, field_name, field_value,
                   source_upload_id, source_type, confidence, valid_from,
                   mapper_method, superseded_by_id, created_by)
                VALUES ($1, $2, $3, $4, $5::jsonb,
                        $6, $7, $8, $9, $10, $11, $12)
                """,
                rows,
            )

        result = await get_cell_audit(
            request=_AdminRequest(),  # type: ignore[arg-type]
            factory_id=_TENANT,
            entity_type="product",
            entity_id="998",
            field="revenue",
        )
    finally:
        reset_factory_id(token)

    # 1 active + 499 superseded = 500 rows total. At limit, NOT truncated.
    assert result["truncated"] is False
    assert result["history_limit"] == 500
    assert len(result["history"]) == 500


@pytest.mark.asyncio
async def test_audit_rejects_factory_id_mismatch_with_jwt():
    """JWT tenant != query factory_id → 403."""
    from fastapi import HTTPException
    from smartbi.api.provenance_audit import get_cell_audit

    class _S:
        role = "factory_super_admin"
        auth_method = "jwt"
        factory_id = "F999"

    class _Req:
        state = _S()

    with pytest.raises(HTTPException) as exc:
        await get_cell_audit(
            request=_Req(),  # type: ignore[arg-type]
            factory_id="F001",  # different
            entity_type="product",
            entity_id="1",
            field="revenue",
        )
    assert exc.value.status_code == 403
