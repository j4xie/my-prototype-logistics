"""
Correlation ID Middleware for FastAPI/Starlette

Propagates X-Correlation-ID across Python service boundaries:
1. Reads X-Correlation-ID from incoming request header
2. If absent, generates a new UUID
3. Stores in a contextvars.ContextVar for async-safe access
4. Adds X-Correlation-ID to the response header
5. Provides a logging.Filter that injects correlation_id into log records
"""
from __future__ import annotations

import logging
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Context variable for the current request's correlation ID (async-safe)
correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="-")

CORRELATION_ID_HEADER = "X-Correlation-ID"


def get_correlation_id() -> str:
    """Get the current correlation ID from context. Returns '-' if not set."""
    return correlation_id_var.get()


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """
    ASGI middleware that extracts or generates a correlation ID per request.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Read from incoming header or generate new
        correlation_id = request.headers.get(CORRELATION_ID_HEADER)
        if not correlation_id:
            correlation_id = str(uuid.uuid4())

        # Store in contextvar for this async context
        token = correlation_id_var.set(correlation_id)
        try:
            response: Response = await call_next(request)
            response.headers[CORRELATION_ID_HEADER] = correlation_id
            return response
        finally:
            correlation_id_var.reset(token)


class CorrelationIdLogFilter(logging.Filter):
    """
    Logging filter that injects correlation_id from the contextvar into every log record.
    Usage: add this filter to any handler or root logger.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = correlation_id_var.get()
        return True
