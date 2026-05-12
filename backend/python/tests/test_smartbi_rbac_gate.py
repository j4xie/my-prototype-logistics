"""End-to-end regression tests for the PR #470 P0 RBAC gate.

For each SmartBI analysis endpoint that moved to Python after T6.5 Phase C,
verify that ``warehouse_mgr1`` (role ``warehouse_manager``) gets a 403 with
the 4-位一体 body, mirroring the Java ``/drill-down`` reference template
referenced in the PR #470 audit §4 Finding F0.

The reference body Java emits (from PR #470 audit §4 F0):

    403 {
      message: "您的角色 [仓储主管] 在 [数据分析] 模块无 [读取] 权限",
      actionHint: "请联系工厂管理员在 Canvas → 模块权限 矩阵为角色 [仓储主管] ...",
      severity: "error",
      code: "FORBIDDEN",
      meta: {role, module, action, requireAll, requiredPermissions}
    }

We assert the same shape on Python now that the gate has moved upstream of
strip_price_for_role (the audit caught strip_price_for_role missing nested
fields like rankings[*].value / charts.data[*] / formattedValue — the fix is
to deny the request BEFORE any data is computed).

Allowed-role behavior: a complementary signature inspection test asserts each
endpoint's auth parameter resolves to ``require_analytics_read`` (so refactors
that swap the dependency back to ``verify_jwt_and_factory`` fail loudly here).
The existing per-endpoint pilot tests already cover the happy admin path with
service-level mocks — duplicating those mocks here would only test the gate's
absence of impact on authorized roles, which is implicit in the signature check.
"""
from __future__ import annotations

import inspect
import os
from time import time

import jwt
import pytest

os.environ.setdefault("JWT_SECRET", "smartbi-rbac-gate-test-secret")

# Read AFTER setdefault — whichever test file imported first wins (sister
# pilot tests may have already populated this env), and ``auth.verify_jwt_and_factory``
# reads ``os.environ["JWT_SECRET"]`` at call time. We MUST encode our tokens
# with the same secret it will decode with, else the warehouse_mgr 403 path
# turns into a confusing 401 "Invalid token: Signature verification failed".
JWT_SECRET = os.environ["JWT_SECRET"]

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from smartbi_compat._rbac_role import (  # noqa: E402
    RbacForbiddenException,
    rbac_forbidden_handler,
    require_analytics_read,
)
from smartbi_compat.api import (  # noqa: E402
    analysis_department,
    analysis_finance,
    analysis_inventory,
    analysis_procurement,
    analysis_region,
    analysis_sales,
)
from smartbi_compat.auth import JWT_ALGORITHM  # noqa: E402

# Phase 2B endpoint coverage markers — this single test file documents the
# RBAC contract for all 9 Python analysis endpoints, so each gets a marker.
pytestmark = [
    pytest.mark.api_endpoint("analysis_finance"),
    pytest.mark.api_endpoint("analysis_finance_budget_achievement"),
    pytest.mark.api_endpoint("analysis_finance_yoy_mom"),
    pytest.mark.api_endpoint("analysis_finance_category_comparison"),
    pytest.mark.api_endpoint("analysis_sales"),
    pytest.mark.api_endpoint("analysis_inventory"),
    pytest.mark.api_endpoint("analysis_procurement"),
    pytest.mark.api_endpoint("analysis_department"),
    pytest.mark.api_endpoint("analysis_region"),
]


def _warehouse_token() -> str:
    """JWT mirroring the warehouse_mgr1 prod token shape PR #470 used."""
    payload = {
        "userId": 999,
        "username": "warehouse_mgr1",
        "factoryId": "F001",
        "role": "warehouse_manager",
        "exp": int(time()) + 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def client():
    """FastAPI app with all 6 analysis routers + the gate handler registered."""
    app = FastAPI()
    app.add_exception_handler(RbacForbiddenException, rbac_forbidden_handler)
    app.include_router(analysis_finance.router)
    app.include_router(analysis_sales.router)
    app.include_router(analysis_inventory.router)
    app.include_router(analysis_procurement.router)
    app.include_router(analysis_department.router)
    app.include_router(analysis_region.router)
    return TestClient(app)


# ============================================================
# 4-位一体 body shape assertion (shared across all 9 endpoints)
# ============================================================


def _assert_rule8_rich_body(body: dict) -> None:
    """Body must mirror the Java /drill-down reference (PR #470 §4 F0)."""
    assert body.get("success") is False
    assert body.get("code") == "FORBIDDEN"
    assert body.get("severity") == "error"
    assert "仓储主管" in body.get("message", "")
    assert "数据分析" in body.get("message", "")
    assert "读取" in body.get("message", "")
    assert "Canvas → 模块权限" in body.get("actionHint", "")
    meta = body.get("meta") or {}
    assert meta.get("role") == "warehouse_manager"
    assert meta.get("module") == "analytics"
    assert meta.get("action") == "read"
    assert meta.get("requireAll") is False
    assert meta.get("requiredPermissions") == [
        {"module": "analytics", "action": "read"}
    ]


# Endpoint URL × query-string fixtures — each line mirrors a real PR #470
# leak case. Keep parametrize id short so failures point clearly.
_ENDPOINTS = [
    pytest.param(
        "/api/mobile/F001/smart-bi/analysis/finance"
        "?startDate=2026-01-01&endDate=2026-03-31",
        id="finance-composite",
    ),
    pytest.param(
        "/api/mobile/F001/smart-bi/analysis/finance/budget-achievement"
        "?year=2026&metric=revenue",
        id="finance-budget-achievement",
    ),
    pytest.param(
        "/api/mobile/F001/smart-bi/analysis/finance/yoy-mom"
        "?periodType=MONTH&startPeriod=2026-01&metric=revenue",
        id="finance-yoy-mom",
    ),
    pytest.param(
        "/api/mobile/F001/smart-bi/analysis/finance/category-comparison"
        "?year=2026&compareYear=2025",
        id="finance-category-comparison",
    ),
    pytest.param(
        "/api/mobile/F001/smart-bi/analysis/sales"
        "?startDate=2026-01-01&endDate=2026-03-31",
        id="sales",
    ),
    pytest.param(
        "/api/mobile/F001/smart-bi/analysis/inventory"
        "?startDate=2026-01-01&endDate=2026-03-31",
        id="inventory",
    ),
    pytest.param(
        "/api/mobile/F001/smart-bi/analysis/procurement"
        "?startDate=2026-01-01&endDate=2026-03-31",
        id="procurement",
    ),
    pytest.param(
        "/api/mobile/F001/smart-bi/analysis/department"
        "?startDate=2026-01-01&endDate=2026-03-31",
        id="department",
    ),
    pytest.param(
        "/api/mobile/F001/smart-bi/analysis/region"
        "?startDate=2026-01-01&endDate=2026-03-31",
        id="region",
    ),
]


@pytest.mark.parametrize("url", _ENDPOINTS)
def test_warehouse_manager_returns_403_with_rule8_body(client, url):
    """PR #470 reproduction: warehouse_mgr1 token → 403 + 4-位一体 body.

    Pre-fix: HTTP 200 with nested ``rankings[*].value`` / ``formattedValue``
    visible (strip_price_for_role missed those — audit §3 root cause).
    Post-fix: gate denies BEFORE any data is computed, so even a future
    regression in strip_price_for_role can't re-leak via these endpoints.
    """
    r = client.get(url, headers=_auth_header(_warehouse_token()))
    assert r.status_code == 403, (
        f"{url} should 403 for warehouse_manager — got {r.status_code} "
        f"body={r.text[:200]}"
    )
    _assert_rule8_rich_body(r.json())


# ============================================================
# Allowed-role wiring guard — each endpoint depends on require_analytics_read
# ============================================================


_HANDLERS = [
    pytest.param(analysis_finance.get_finance_analysis, id="finance-composite"),
    pytest.param(
        analysis_finance.get_budget_achievement, id="finance-budget-achievement",
    ),
    pytest.param(analysis_finance.get_yoy_mom, id="finance-yoy-mom"),
    pytest.param(
        analysis_finance.get_category_comparison, id="finance-category-comparison",
    ),
    pytest.param(analysis_sales.get_sales_analysis, id="sales"),
    pytest.param(analysis_inventory.get_inventory_analysis, id="inventory"),
    pytest.param(analysis_procurement.get_procurement_analysis, id="procurement"),
    pytest.param(analysis_department.get_department_analysis, id="department"),
    pytest.param(analysis_region.get_region_analysis, id="region"),
]


@pytest.mark.parametrize("handler", _HANDLERS)
def test_endpoint_auth_param_uses_require_analytics_read(handler):
    """Regression guard: refactors that swap ``Depends(require_analytics_read)``
    back to ``Depends(verify_jwt_and_factory)`` re-open PR #470.

    Detect via signature inspection — the ``auth`` parameter's default is a
    FastAPI ``Depends`` whose ``.dependency`` must be ``require_analytics_read``.
    """
    sig = inspect.signature(handler)
    auth_param = sig.parameters.get("auth")
    assert auth_param is not None, (
        f"{handler.__name__} has no 'auth' parameter — expected "
        "Depends(require_analytics_read)"
    )
    dependency = getattr(auth_param.default, "dependency", None)
    assert dependency is require_analytics_read, (
        f"{handler.__name__}.auth depends on {dependency!r}, "
        f"expected require_analytics_read — re-opens PR #470 leak"
    )
