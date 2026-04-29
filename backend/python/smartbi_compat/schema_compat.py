"""Helpers to keep Python alias responses byte-for-byte equivalent
to Java SmartBI controller responses.

Java envelope: {"success": bool, "data": <body>, "message": str}
"""
from __future__ import annotations
from typing import Any, Optional


def wrap_response(data: Any, *, message: str = "操作成功", success: bool = True) -> dict:
    """Standard Java-compatible response envelope used by every alias route."""
    return {"success": success, "data": data, "message": message}


def wrap_error(message: str, *, code: Optional[str] = None) -> dict:
    """Error envelope. Most callers should let HTTPException flow through;
    use this only when the Java endpoint itself returns 200+success=false."""
    out: dict = {"success": False, "data": None, "message": message}
    if code is not None:
        out["code"] = code
    return out
