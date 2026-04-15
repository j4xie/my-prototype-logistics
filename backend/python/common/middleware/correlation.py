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

import asyncio
import logging
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

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
        except asyncio.CancelledError:
            # Client disconnected mid-request (closed tab, SSE lost, mobile
            # went to background, upstream proxy timed out). Swallow silently
            # — not a server bug, and re-raising would just flood ASGI logs
            # with "Exception in ASGI application" ERROR traces.
            logger.warning(
                "Request cancelled by client (correlation_id=%s, path=%s)",
                correlation_id,
                request.url.path,
            )
            # Return a 499-style response. Client socket is already closed
            # so this body will never be written — Starlette / uvicorn drops
            # it cleanly (unlike the RuntimeError('No response returned')
            # that propagates up when we raise).
            return Response(status_code=499, content=b"", media_type="text/plain")
        except RuntimeError as e:
            # Starlette's BaseHTTPMiddleware re-wraps cancelled downstream
            # tasks as `RuntimeError("No response returned.")`. Treat the
            # same as CancelledError above.
            if "No response returned" in str(e):
                logger.warning(
                    "Downstream handler cancelled (likely client disconnect, "
                    "correlation_id=%s, path=%s)",
                    correlation_id,
                    request.url.path,
                )
                return Response(status_code=499, content=b"", media_type="text/plain")
            raise
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
