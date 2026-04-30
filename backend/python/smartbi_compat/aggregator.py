"""Bounded asyncio.gather wrapper that prevents asyncpg pool exhaustion.

Java aliases that aggregate N sub-calls (e.g. /analysis/sales = kpis + ranking
+ trend + region) use gather_with_pool_safety to cap concurrent DB borrowers.
"""
from __future__ import annotations
import asyncio
from typing import Awaitable, TypeVar

T = TypeVar("T")

DEFAULT_MAX_CONCURRENT = 16


async def gather_with_pool_safety(
    *coros: Awaitable[T],
    max_concurrent: int = DEFAULT_MAX_CONCURRENT,
) -> list[T]:
    """Like asyncio.gather but bounded by a Semaphore.

    Each coroutine waits on the semaphore before starting. Prevents a single
    request from monopolising the asyncpg connection pool when an alias
    needs to aggregate many sub-calls.
    """
    sem = asyncio.Semaphore(max_concurrent)

    async def _run(coro: Awaitable[T]) -> T:
        async with sem:
            return await coro

    return await asyncio.gather(*[_run(c) for c in coros])
