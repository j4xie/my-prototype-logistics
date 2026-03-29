"""
Unified API response format for all Python FastAPI routes.

Matches the Java backend format: {"success": bool, "data": Any, "message": str, "code": str?}

Usage:
    from common.responses import success_response, error_response, ApiException, ErrorCode

    # Success
    return success_response(data={"items": [...]}, message="Query complete")

    # Error (raise to let the global handler format it)
    raise ApiException("File too large", ErrorCode.VALIDATION_ERROR, status_code=400)

    # Error (inline dict for response_model endpoints)
    return error_response("Processing failed", ErrorCode.DATA_PROCESSING_ERROR)
"""
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel


class ErrorCode(str, Enum):
    VALIDATION_ERROR = "VALIDATION_ERROR"
    NOT_FOUND = "NOT_FOUND"
    AUTH_ERROR = "AUTH_ERROR"
    RATE_LIMIT = "RATE_LIMIT"
    LLM_TIMEOUT = "LLM_TIMEOUT"
    LLM_ERROR = "LLM_ERROR"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    DATA_PROCESSING_ERROR = "DATA_PROCESSING_ERROR"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class ApiResponse(BaseModel):
    """Pydantic model matching the Java backend unified response format."""
    success: bool
    data: Any = None
    message: str = ""
    code: Optional[str] = None


def success_response(data: Any = None, message: str = "操作成功") -> dict:
    """Build a success response dict matching Java format."""
    return {"success": True, "data": data, "message": message}


def error_response(
    message: str,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    data: Any = None,
) -> dict:
    """Build an error response dict matching Java format."""
    return {"success": False, "data": data, "message": message, "code": code.value}


class ApiException(Exception):
    """
    Raise this instead of HTTPException for consistent error format.

    The global exception handler in main.py converts this into a JSONResponse
    with the unified {success, data, message, code} structure.
    """

    def __init__(
        self,
        message: str,
        code: ErrorCode = ErrorCode.INTERNAL_ERROR,
        status_code: int = 400,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)
