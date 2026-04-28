"""TDD tests for /api/smartbi/admin/data-quality-queue/list (餐饮 Phase A Task 3.2).

Two focused unit tests that do NOT require a live DB or running app:
- test_list_rejects_non_admin       → 403 when role is 'operator'
- test_list_returns_paginated       → paginated response for platform_admin + factoryId

Pattern mirrors test_restaurant_etl_admin.py: use require_admin directly (not
via TestClient) to keep tests minimal and avoid HTTP transport overhead.
"""
from __future__ import annotations

import pytest
from fastapi import HTTPException
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_list_rejects_non_admin():
    """role='operator' → HTTPException 403 with '管理员' in detail."""
    from smartbi.api.data_quality_queue_admin import list_queue

    class _S:
        role = "operator"
        auth_method = "jwt"
        factory_id = "F001"

    class _Req:
        state = _S()

    with pytest.raises(HTTPException) as exc:
        await list_queue(
            request=_Req(),
            factoryId=None,
            entityType=None,
            status=None,
            page=1,
            pageSize=50,
        )
    assert exc.value.status_code == 403
    assert "管理员" in (exc.value.detail or "")


@pytest.mark.asyncio
async def test_list_returns_paginated():
    """role='platform_admin' + factoryId='F001' → paginated response with 1 item."""
    from smartbi.api.data_quality_queue_admin import list_queue

    class _S:
        role = "platform_admin"
        auth_method = "jwt"
        factory_id = "F001"

    class _Req:
        state = _S()

    fake_items = [{"id": 1, "rawName": "x"}]
    fake_total = 1

    with patch(
        "smartbi.api.data_quality_queue_admin._fetch_queue_items",
        new=AsyncMock(return_value=(fake_items, fake_total)),
    ):
        with patch(
            "smartbi.api.data_quality_queue_admin.get_pg_pool",
            new=AsyncMock(return_value=AsyncMock()),
        ):
            result = await list_queue(
                request=_Req(),
                factoryId="F001",
                entityType=None,
                status=None,
                page=1,
                pageSize=50,
            )

    assert "items" in result
    assert result["total"] == 1
    assert len(result["items"]) == 1
    assert result["page"] == 1
    assert result["pageSize"] == 50
