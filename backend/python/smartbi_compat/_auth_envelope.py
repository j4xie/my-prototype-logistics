"""Java-mirrored 401 envelope for SmartBI analysis endpoints (issue #530).

Mirrors ``backend/java/.../config/JwtAuthInterceptor.java:259-273``
``sendUnauthorizedResponse`` — the 6-field 188-byte envelope shape that the
customer frontend's axios interceptor already handles for Java upstream calls.

Scope: only the 3 paths chat2 verified during T6.6.3a/b/c (PR #526/#536/#543).
Sister analysis endpoints (region/sales/procurement/inventory/department)
keep the legacy 96-byte shape; broader sweep is tracked separately.

The 401 fires at ``backend/python/auth_middleware.py`` (global ASGI
``JWTAuthMiddleware``) BEFORE the FastAPI ``Depends`` chain resolves —
auth.py's ``verify_jwt_and_factory`` never runs for missing/bad tokens
because the middleware short-circuits. That is why this helper is
consumed by the middleware, not by ``_rbac_role.py``.
"""
from __future__ import annotations

from datetime import datetime

# Defaults mirror Java JwtAuthInterceptor at lines 126/138/174 (the three
# call sites that pass the canonical Chinese message + 267-268 hard-coded
# severity/actionHint inside the helper).
_DEFAULT_MESSAGE = "未授权，请先登录"
_ACTION_HINT = "会话已过期或未登录, 请重新登录"
_SEVERITY = "error"

_SMARTBI_JAVA_ENVELOPE_PATH_SEGMENTS: tuple[str, ...] = (
    "/smart-bi/analysis/production",
    "/smart-bi/analysis/quality",
    "/smart-bi/analysis/finance",
)


def is_smartbi_java_envelope_path(path: str) -> bool:
    """Return True for the 3 endpoints in issue #530 scope.

    Matched substrings cover both the bare endpoint and finance sub-routes
    (budget-achievement / yoy-mom / category-comparison), all of which use
    ``Depends(require_analytics_read)`` in ``analysis_finance.py`` and would
    otherwise emit the legacy 96-byte envelope on missing/bad bearer.
    """
    return any(seg in path for seg in _SMARTBI_JAVA_ENVELOPE_PATH_SEGMENTS)


def build_unauthorized_body(message: str | None = None) -> dict:
    """Build the 6-field Java-mirrored 401 envelope.

    Key order mirrors Java JwtAuthInterceptor.sendUnauthorizedResponse
    ``LinkedHashMap`` insertion order; Python dicts preserve insertion
    order (PEP 468, guaranteed since 3.7) and ``json.dumps`` honors it,
    so the on-wire byte layout matches Java byte-for-byte modulo the
    ``timestamp`` precision (Python isoformat = microseconds vs Java
    ``LocalDateTime.toString`` = up-to-nanoseconds-trailing-zeros-suppressed
    — both are ISO-8601 LocalDateTime shapes without timezone).
    """
    return {
        "success": False,
        "code": 401,
        "message": message or _DEFAULT_MESSAGE,
        "severity": _SEVERITY,
        "actionHint": _ACTION_HINT,
        "timestamp": datetime.now().isoformat(),
    }


__all__ = [
    "build_unauthorized_body",
    "is_smartbi_java_envelope_path",
]
