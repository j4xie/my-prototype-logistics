"""Validates that aggregator.gather_with_pool_safety prevents asyncpg pool
exhaustion under concurrent gather-heavy aliases."""
import asyncio
import pytest

# conftest already adds backend/python to sys.path
from smartbi_compat.aggregator import gather_with_pool_safety


@pytest.mark.asyncio
async def test_gather_respects_semaphore_limit():
    """20 concurrent slow tasks with max_concurrent=5 must not exceed 5 in-flight."""
    in_flight = 0
    peak = 0
    lock = asyncio.Lock()

    async def slow_task(i):
        nonlocal in_flight, peak
        async with lock:
            in_flight += 1
            peak = max(peak, in_flight)
        await asyncio.sleep(0.05)
        async with lock:
            in_flight -= 1
        return i

    coros = [slow_task(i) for i in range(20)]
    results = await gather_with_pool_safety(*coros, max_concurrent=5)
    assert sorted(results) == list(range(20))
    assert peak <= 5, f"semaphore failed: peak in_flight={peak}"


@pytest.mark.asyncio
async def test_gather_returns_in_order():
    """asyncio.gather preserves input order regardless of finish order."""
    async def task(i, delay):
        await asyncio.sleep(delay)
        return i

    results = await gather_with_pool_safety(
        task(1, 0.03), task(2, 0.01), task(3, 0.02),
        max_concurrent=10,
    )
    assert results == [1, 2, 3]


@pytest.mark.asyncio
async def test_gather_with_max_concurrent_one_serializes():
    """max_concurrent=1 should fully serialize execution."""
    order = []

    async def task(i):
        order.append(f"start-{i}")
        await asyncio.sleep(0.01)
        order.append(f"end-{i}")
        return i

    await gather_with_pool_safety(
        task(1), task(2), task(3),
        max_concurrent=1,
    )
    # With max=1, each task must finish before the next starts:
    assert order == ["start-1", "end-1", "start-2", "end-2", "start-3", "end-3"]
