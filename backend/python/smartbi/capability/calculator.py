"""CapabilityCalculator — Day 2 skeleton.

Full implementation lands Day 3 per 数据织网/02-A-能力驱动渲染.md §3.1.
Includes: SQL with NULLIF + advisory_xact_lock + sentinel + lazy memo for
merge_status column existence + inflight Promise dedup + invalidation_gen
token to defeat race between invalidate() and inflight write.
"""
from __future__ import annotations
import asyncio
from typing import Optional
import asyncpg


class CapabilityCalculator:
    """聚合 factory 所有 upload 的 field_definitions, 返回 canonical 字段集合.

    Concurrency model:
    - Per-process in-memory dict cache (current prod uvicorn worker=1, OK)
    - 5 分钟 TTL + event-driven invalidate
    - Inflight Promise dedup 防 stampede
    - invalidation_gen token defeats race: invalidate() 跑时旧 inflight 还没结束,
      旧结果不会覆盖 cache.

    多 worker scale 时切 Redis (见 spec §3.4).
    """

    def __init__(self, pool: asyncpg.Pool):
        self._pool = pool
        self._cache: dict[str, tuple[set[str], float]] = {}
        self._cache_ttl = 300  # 5 分钟
        self._inflight: dict[str, asyncio.Future] = {}
        self._invalidation_gen: dict[str, int] = {}
        # merge_status column 存在性 lazy memo (一次性, 不在 hot path)
        self._has_merge_status: Optional[bool] = None

    async def _check_merge_status_column(self) -> bool:
        """检测 merge_status 列是否存在 (B 上线后存在). lazy memo 一次. spec §3.1 S-v3-1."""
        raise NotImplementedError("Day 3: per spec §3.1")

    async def get_capabilities(self, factory_id: str) -> set[str]:
        """返回 factory 当前可用的 canonical 字段集合."""
        raise NotImplementedError("Day 3: per spec §3.1")

    async def _fetch_capabilities(self, factory_id: str) -> set[str]:
        """transaction-scoped set_config + 显式 transaction 包裹.
        merge_status 过滤改 NOT LIKE 'MERGED_INTO_%' 模式 (匹配动态 id),
        column 存在性 memo 不在 hot path. spec §3.1 C-v3-1 + S-v3-1.
        """
        raise NotImplementedError("Day 3: per spec §3.1")

    def invalidate(self, factory_id: str) -> None:
        """上传完成后调用, 失效缓存. 同时 bump invalidation_gen token. spec §3.1 O5."""
        raise NotImplementedError("Day 3: per spec §3.1")
