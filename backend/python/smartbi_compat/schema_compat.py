"""Helpers to keep Python alias responses byte-shape-equivalent to Java
SmartBI controller responses (com.cretas.aims.dto.common.ApiResponse).

Java envelope (8 keys, declaration order via Jackson — verified against
prod /api/mobile/F001/smart-bi/data-date-range 2026-05-06):
    {"code": 200, "message": str, "data": <body>,
     "timestamp": "<LocalDateTime ISO>", "success": bool,
     "actionHint": null, "severity": null, "hintTarget": null}

The last 3 (actionHint/severity/hintTarget) are emitted as null on success
because ApiResponse.java DTO has no @JsonInclude(NON_NULL) annotation —
Jackson emits all Lombok @Data getter fields including nulls (per
.claude/rules/python-java-port.md Rule 9). Python must emit them too or
T6 dryrun dict_eq fails on every endpoint.

Python emits the same keys in the same order. The ``timestamp`` field
is a fresh ISO 8601 LocalDateTime per response — it CANNOT byte-equal
a recorded golden, so contract tests assert structure only (see
tests/python/smartbi_compat/test_contract_compat.py::assert_envelope).

``wrap_error_with_hint`` lets callers supply non-null UX hints to mirror
``ApiResponse.errorWithHint``. Most call sites should let HTTPException
flow through and never call ``wrap_error`` directly — this module
exists for the rare Java endpoints that return 200/success=false
(I-7 follow-up).
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional


def _now_iso() -> str:
    """ISO 8601 LocalDateTime — naive datetime, no timezone, matching
    Java's ``LocalDateTime.now()`` Jackson serialisation.

    Python's microsecond precision is shorter than Java's nanosecond
    precision; this is the documented compromise (see schema_compat
    module docstring). Tests assert ISO 8601 shape, not exact length.
    """
    return datetime.now().isoformat()


def wrap_response(
    data: Any,
    *,
    message: str = "操作成功",
    success: bool = True,
    code: int = 200,
) -> dict:
    """Standard Java-compatible response envelope used by every alias route.

    Mirrors ``ApiResponse.success(message, data)``: code=200, success=true,
    fresh timestamp. Pass ``code``/``success`` explicitly for endpoints
    that diverge from the success path (e.g. ``ApiResponse.of(code, ...)``).
    """
    return {
        "code": code,
        "message": message,
        "data": data,
        "timestamp": _now_iso(),
        "success": success,
        "actionHint": None,
        "severity": None,
        "hintTarget": None,
    }


def wrap_error(message: str, *, code: int = 400) -> dict:
    """Error envelope matching ``ApiResponse.error(code, message)``.

    Most callers should raise HTTPException and let FastAPI build the
    response — use this only when the upstream Java endpoint itself
    returns HTTP 200 + success=false (recorded in goldens with the
    ``_serverSuccessFalse`` flag, tracked as I-7 follow-up).
    """
    return {
        "code": code,
        "message": message,
        "data": None,
        "timestamp": _now_iso(),
        "success": False,
        "actionHint": None,
        "severity": None,
        "hintTarget": None,
    }


def wrap_error_with_hint(
    message: str,
    *,
    code: int = 400,
    action_hint: Optional[str] = None,
    severity: Optional[str] = None,
    hint_target: Optional[str] = None,
) -> dict:
    """Error envelope with UX hint fields (mirrors ApiResponse.errorWithHint).

    Frontend interceptor renders ``actionHint`` as a notification button,
    ``severity=BLOCKING`` as a modal (otherwise toast), and ``hintTarget``
    as a UI pulse target. Caller-supplied non-null hints override the
    null defaults from ``wrap_error``. The 3 hint fields are always
    present in the JSON (matching Java Lombok @Data + no @JsonInclude
    behavior) — None values map to JSON null.
    """
    out = wrap_error(message, code=code)
    if action_hint is not None:
        out["actionHint"] = action_hint
    if severity is not None:
        out["severity"] = severity
    if hint_target is not None:
        out["hintTarget"] = hint_target
    return out
