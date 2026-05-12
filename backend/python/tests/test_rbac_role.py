"""Unit tests for smartbi_compat._rbac_role.

Locks the post-PR-#470 contract:
  - ANALYTICS_READ_ROLES mirrors Java PERMISSION_MATRIX entries that grant
    analytics:read / analytics:read_write (including super_admin short-circuit
    and backward-compat aliases).
  - require_analytics_read denies non-whitelisted roles via
    RbacForbiddenException (NOT FastAPI HTTPException — registered handler
    renders the 4-位一体 body).
  - build_forbidden_body shape matches Java PermissionInterceptor.sendPermissionDenied
    output (keys: success/code/message/severity/actionHint/meta), with
    Chinese labels for known roles + the analytics module + the read action.
  - The handler returns a JSONResponse with status 403 and the same body.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

import pytest

os.environ.setdefault("JWT_SECRET", "rbac-role-test-secret")

from smartbi_compat import _rbac_role as mod  # noqa: E402


# ============================================================
# Whitelist semantics
# ============================================================


def test_whitelist_contains_super_admin_roles():
    """Java line 295-297 short-circuit roles must be in the whitelist
    explicitly so the dependency doesn't depend on a downstream check."""
    assert "factory_super_admin" in mod.ANALYTICS_READ_ROLES
    assert "platform_admin" in mod.ANALYTICS_READ_ROLES
    assert "platform_super_admin" in mod.ANALYTICS_READ_ROLES


def test_whitelist_contains_analytics_read_write_roles():
    """Roles with analytics: read_write per Java PERMISSION_MATRIX."""
    for role in ("dispatcher", "production_manager", "finance_manager"):
        assert role in mod.ANALYTICS_READ_ROLES


def test_whitelist_contains_analytics_read_roles():
    """Roles with analytics: read per Java PERMISSION_MATRIX."""
    for role in ("sales_manager", "restaurant_manager", "viewer"):
        assert role in mod.ANALYTICS_READ_ROLES


def test_whitelist_excludes_warehouse_and_quality_chains():
    """PR #470 P0: warehouse_manager + quality_manager must be denied.
    Operator / hr_admin / equipment_admin / procurement_manager also lack
    analytics in Java PERMISSION_MATRIX — assert they stay out so future
    refactors don't accidentally re-open the leak."""
    for role in (
        "warehouse_manager",
        "warehouse_worker",
        "quality_manager",
        "quality_inspector",
        "workshop_supervisor",
        "team_leader",
        "group_leader",
        "operator",
        "hr_admin",
        "equipment_admin",
        "procurement_manager",  # has no analytics key in Java matrix
        "unactivated",
    ):
        assert role not in mod.ANALYTICS_READ_ROLES, (
            f"{role} must NOT be allowed analytics:read — "
            "re-opens PR #470 leak"
        )


# ============================================================
# Forbidden body shape (4-位一体 parity with Java)
# ============================================================


def test_build_forbidden_body_known_role_uses_chinese_label():
    """warehouse_manager → 仓储主管 / analytics → 数据分析 / read → 读取.
    Mirrors Java PermissionInterceptor.moduleLabel / actionLabel."""
    body = mod.build_forbidden_body("warehouse_manager", "analytics", "read")
    assert body["success"] is False
    assert body["code"] == "FORBIDDEN"
    assert body["severity"] == "error"
    assert "仓储主管" in body["message"]
    assert "数据分析" in body["message"]
    assert "读取" in body["message"]
    assert "Canvas → 模块权限" in body["actionHint"]
    assert body["meta"]["role"] == "warehouse_manager"
    assert body["meta"]["module"] == "analytics"
    assert body["meta"]["action"] == "read"
    assert body["meta"]["requireAll"] is False
    assert body["meta"]["requiredPermissions"] == [
        {"module": "analytics", "action": "read"}
    ]


def test_build_forbidden_body_unknown_role_falls_back_to_role_string():
    """Unknown role passes through to body.meta.role + falls back to '未知角色'
    in the message (don't crash on a role label not in the table)."""
    body = mod.build_forbidden_body("future_role_xyz", "analytics", "read")
    assert body["meta"]["role"] == "future_role_xyz"
    # Either the role string OR "未知角色" appears — implementation choice.
    # The displayed label falls back to the raw role string when not in the
    # _ROLE_LABELS table.
    assert "future_role_xyz" in body["message"]


def test_build_forbidden_body_none_role_uses_unknown_label():
    """None role → still produce a sane body (don't NPE)."""
    body = mod.build_forbidden_body(None, "analytics", "read")
    assert body["meta"]["role"] == "unknown"
    # Label falls back to 未知角色 when role is None (no string to display)
    assert "未知角色" in body["message"]


# ============================================================
# Dependency behavior — require_analytics_read
# ============================================================


@dataclass
class _FakeAuth:
    user_id: int = 22
    username: str = "alice"
    factory_id: str = "F001"
    role: str = "warehouse_manager"


@pytest.mark.asyncio
async def test_dependency_raises_for_denied_role():
    """warehouse_manager → RbacForbiddenException with role/module/action set."""
    auth = _FakeAuth(role="warehouse_manager")
    with pytest.raises(mod.RbacForbiddenException) as exc_info:
        await mod.require_analytics_read(auth)
    assert exc_info.value.role == "warehouse_manager"
    assert exc_info.value.module == "analytics"
    assert exc_info.value.action == "read"


@pytest.mark.asyncio
async def test_dependency_passes_through_for_allowed_role():
    """factory_super_admin → returns the same AuthContext unchanged."""
    auth = _FakeAuth(role="factory_super_admin")
    result = await mod.require_analytics_read(auth)
    assert result is auth


@pytest.mark.asyncio
async def test_dependency_passes_for_finance_manager():
    """finance_manager has analytics:read_write → satisfies analytics:read."""
    auth = _FakeAuth(role="finance_manager")
    result = await mod.require_analytics_read(auth)
    assert result is auth


@pytest.mark.asyncio
async def test_dependency_raises_for_empty_role():
    """Empty role string → denied (defensive — JWT must carry a role)."""
    auth = _FakeAuth(role="")
    with pytest.raises(mod.RbacForbiddenException):
        await mod.require_analytics_read(auth)


# ============================================================
# Exception handler — JSONResponse + status 403 + body shape
# ============================================================


@pytest.mark.asyncio
async def test_handler_returns_403_with_rich_body():
    """Handler converts RbacForbiddenException into JSONResponse(403, body)."""
    exc = mod.RbacForbiddenException("warehouse_manager", "analytics", "read")
    response = await mod.rbac_forbidden_handler(request=None, exc=exc)
    assert response.status_code == 403
    # JSONResponse renders the body via JSON. Decode to check shape.
    import json

    payload = json.loads(response.body.decode("utf-8"))
    assert payload["code"] == "FORBIDDEN"
    assert payload["severity"] == "error"
    assert "仓储主管" in payload["message"]
    assert payload["meta"]["role"] == "warehouse_manager"
