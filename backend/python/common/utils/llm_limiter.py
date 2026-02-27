"""
Global DashScope LLM API rate limiter.

Limits concurrent LLM API calls across all Python services to prevent
DashScope QPS saturation when multiple sheets enrich simultaneously.
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

# Max concurrent DashScope API calls across the entire Python process.
# DashScope free-tier QPS is typically 3-5 per API key.
_MAX_CONCURRENT_LLM_CALLS = 3
_semaphore: asyncio.Semaphore | None = None


def get_semaphore() -> asyncio.Semaphore:
    """Lazy-init semaphore (must be created inside a running event loop).

    Use directly in async generators where the context manager can't be used:
        sem = get_semaphore()
        await sem.acquire()
        try:
            async for chunk in stream:
                yield chunk
        finally:
            sem.release()
    """
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(_MAX_CONCURRENT_LLM_CALLS)
    return _semaphore


@asynccontextmanager
async def llm_rate_limit():
    """Async context manager that limits concurrent DashScope LLM calls.

    Usage:
        async with llm_rate_limit():
            response = await client.post(...)
    """
    sem = get_semaphore()
    await sem.acquire()
    try:
        yield
    finally:
        sem.release()
