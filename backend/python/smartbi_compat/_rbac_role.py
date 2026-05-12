"""Role-based access control gate for SmartBI analysis endpoints.

Mirrors Java ``@RequirePermission`` + ``PermissionInterceptor`` for endpoints
that moved to Python after T6.5 Phase C. PR #470 caught ``warehouse_mgr1``
(role ``warehouse_manager``, no ``analytics`` permission) reading nested price
fields from 6 ``/analysis/*`` endpoints because the layered protection was

  ``verify_jwt_and_factory`` (JWT + cross-factory only)
   → ``strip_price_for_role`` (incomplete: misses ``rankings[*].value`` /
     ``charts.data[*]`` / ``formattedValue`` per audit §3)

i.e. only the latter checked the role, and it had gaps. This module adds a
``verify_jwt_and_factory``-style FastAPI dependency that gates on role
membership in :data:`ANALYTICS_READ_ROLES` BEFORE the handler runs, so denied
roles never see any response body to leak through.

The 4-位一体 ({message, actionHint, severity, meta}) error envelope mirrors
the Java ``PermissionInterceptor.sendPermissionDenied`` output, so the
frontend keeps one error-handling code path. Reference body lives in
``backend/java/.../config/PermissionInterceptor.java:99-179``.

Source of truth for the whitelist is Java
``PermissionServiceImpl.PERMISSION_MATRIX`` — every role listed below has
``analytics:read`` or ``analytics:read_write`` there (the only Java action
levels that satisfy ``checkAction(permType, "read")`` per Java line 429-430).
Keep this list in sync when the Java matrix changes.
"""
from __future__ import annotations

from typing import Optional

from fastapi import Depends, Request
from fastapi.responses import JSONResponse

from smartbi_compat.auth import AuthContext, verify_jwt_and_factory


# Whitelist mirrors Java PermissionServiceImpl.PERMISSION_MATRIX entries that
# grant ``analytics:read`` (also satisfied by ``analytics:read_write`` per
# Java checkAction "read" branch). super_admin roles short-circuit in
# Java line 295-297; they're explicit here so the gate doesn't depend on a
# downstream check.
ANALYTICS_READ_ROLES: frozenset[str] = frozenset({
    # super_admin short-circuit (Java PermissionServiceImpl line 295-297)
    "factory_super_admin",
    "platform_admin",
    "platform_super_admin",   # mirror auth.py PRIVILEGED_ROLES
    # analytics: read_write (Java PERMISSION_MATRIX)
    "dispatcher",
    "production_manager",     # alias of dispatcherPerms (Java line 103)
    "finance_manager",
    # analytics: read
    "sales_manager",
    "restaurant_manager",
    "viewer",                 # all-modules-read except system (Java line 240-242)
    # backward-compat aliases (Java line 246-247)
    "permission_admin",       # superAdminPerms
    "department_admin",       # dispatcherPerms
})


# Chinese labels mirror Java PermissionInterceptor.roleLabel / moduleLabel /
# actionLabel (lines 181-223). Required so the 4-位一体 body reads the same
# whether the gate fired on Java or Python side.
_ROLE_LABELS: dict[str, str] = {
    "factory_super_admin": "工厂超级管理员",
    "platform_admin": "平台管理员",
    "platform_super_admin": "平台超级管理员",
    "dispatcher": "调度员",
    "production_manager": "生产主管",
    "quality_manager": "质量主管",
    "warehouse_manager": "仓储主管",
    "warehouse_worker": "仓库管理员",
    "hr_admin": "人事管理员",
    "equipment_admin": "设备管理员",
    "procurement_manager": "采购主管",
    "sales_manager": "销售主管",
    "finance_manager": "财务主管",
    "restaurant_manager": "餐饮主管",
    "quality_inspector": "质检员",
    "workshop_supervisor": "车间主任",
    "team_leader": "大组长",
    "group_leader": "小组长",
    "operator": "操作员",
    "viewer": "查看者",
    "permission_admin": "权限管理员",
    "department_admin": "部门管理员",
    "unactivated": "未激活",
}

_MODULE_LABELS: dict[str, str] = {
    "dashboard": "首页",
    "production": "生产管理",
    "warehouse": "仓储管理",
    "quality": "质量管理",
    "procurement": "采购管理",
    "sales": "销售管理",
    "hr": "人事管理",
    "equipment": "设备管理",
    "finance": "财务管理",
    "system": "系统管理",
    "analytics": "数据分析",
    "scheduling": "智能调度",
    "work_report": "工作报告",
    "inventory": "库存管理",
    "report": "报表",
    "rd": "研发管理",
    "restaurant": "餐饮管理",
}

_ACTION_LABELS: dict[str, str] = {
    "read": "读取",
    "write": "写入",
    "read_write": "读写",
    "create": "创建",
    "approve": "审批",
}


class RbacForbiddenException(Exception):
    """Raised by :func:`require_analytics_read` when the role lacks access.

    Carries the role / module / action triple so the registered FastAPI
    exception handler can render the 4-位一体 body without needing to know
    which endpoint raised it.
    """

    def __init__(self, role: Optional[str], module: str, action: str):
        self.role = role or ""
        self.module = module
        self.action = action
        super().__init__(f"role={self.role} lacks {module}:{action}")


def build_forbidden_body(role: Optional[str], module: str, action: str) -> dict:
    """Build the 4-位一体 403 body. Public for tests + handler reuse."""
    role_str = role or ""
    role_label = _ROLE_LABELS.get(role_str, role_str or "未知角色")
    module_label = _MODULE_LABELS.get(module, module)
    action_label = _ACTION_LABELS.get(action, action)
    return {
        "success": False,
        "code": "FORBIDDEN",
        "message": (
            f"您的角色 [{role_label}] 在 [{module_label}] 模块无 [{action_label}] 权限"
        ),
        "severity": "error",
        "actionHint": (
            f"请联系工厂管理员在 Canvas → 模块权限 矩阵为角色 [{role_label}] "
            f"开通 [{module_label}] 的 [{action_label}] 权限, "
            "或切换到有权限的账号重试"
        ),
        "meta": {
            "role": role_str or "unknown",
            "module": module,
            "action": action,
            "requireAll": False,
            "requiredPermissions": [{"module": module, "action": action}],
        },
    }


async def rbac_forbidden_handler(request: Request, exc: RbacForbiddenException):
    """FastAPI exception handler — register in main.py via add_exception_handler."""
    return JSONResponse(
        status_code=403,
        content=build_forbidden_body(exc.role, exc.module, exc.action),
    )


async def require_analytics_read(
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> AuthContext:
    """FastAPI dependency that gates on ``analytics:read``.

    Mirror of Java ``@RequirePermission({"analytics:read"})``: passes if the
    role appears in :data:`ANALYTICS_READ_ROLES`; otherwise raises
    :class:`RbacForbiddenException` which the registered handler renders as a
    403 with the 4-位一体 body. The transitive ``Depends`` on
    ``verify_jwt_and_factory`` means the existing JWT + cross-factory checks
    still run first.
    """
    if auth.role not in ANALYTICS_READ_ROLES:
        raise RbacForbiddenException(auth.role, "analytics", "read")
    return auth


__all__ = [
    "ANALYTICS_READ_ROLES",
    "RbacForbiddenException",
    "build_forbidden_body",
    "rbac_forbidden_handler",
    "require_analytics_read",
]
