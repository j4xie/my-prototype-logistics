"""In-memory TTL cache + compute helper for upload-level aggregates.

Avoids re-running 15+ JSONB full scans on every AI chat query against the same
upload. Uploads are immutable after ingest, so a 1-hour TTL is safe.

Invalidate via `invalidate(upload_id)` when a new upload writes to the same id
(currently upload_id is auto-incremented so collisions don't happen, but the
API is there for future streaming/overwrite paths).

Cache key: upload_id (int)
Cache value: dict with keys:
  - field_meta: List[dict]          # possibly mutated by Bug #25 fallback
  - measures: List[str]              # measure column names
  - dims: List[str]                  # dimension column names
  - real_total_rows: int
  - agg_lines: List[str]             # text lines for LLM prompt (pre-entity)
  - top5_by_dim: Dict[str, List]     # structured top-5 for chart rendering
  - primary_measure: Optional[str]
  - compute_time_s: float            # SQL wall time (for observability)
"""
from __future__ import annotations

import logging
import re
import threading
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_DEFAULT_TTL = 3600  # 1 hour


class _UploadAggregateCache:
    def __init__(self, ttl_seconds: int = _DEFAULT_TTL):
        self._store: dict[int, tuple[float, Any]] = {}
        self._lock = threading.Lock()
        self._ttl = ttl_seconds

    def get(self, upload_id: int) -> Optional[Any]:
        with self._lock:
            entry = self._store.get(upload_id)
            if entry is None:
                return None
            expires_at, value = entry
            if time.time() > expires_at:
                del self._store[upload_id]
                return None
            return value

    def set(self, upload_id: int, value: Any) -> None:
        with self._lock:
            self._store[upload_id] = (time.time() + self._ttl, value)

    def invalidate(self, upload_id: int) -> bool:
        with self._lock:
            return self._store.pop(upload_id, None) is not None

    def clear(self) -> int:
        with self._lock:
            n = len(self._store)
            self._store.clear()
            return n

    def stats(self) -> dict:
        with self._lock:
            now = time.time()
            live = sum(1 for (exp, _) in self._store.values() if exp > now)
            return {"total": len(self._store), "live": live}


_cache_instance = _UploadAggregateCache()


def get_cache() -> _UploadAggregateCache:
    return _cache_instance


_UNNAMED_PAT = re.compile(r'^(Unnamed:?\s*\d+|Column_?\d+)', re.IGNORECASE)
_PRIORITY_MEASURE_KW = ['销售金额', '销售额', '营业额', '营业收入', '实收', '主营业务收入', '金额']


async def compute_upload_aggregates(
    conn,
    pool,
    upload_id: int,
    field_meta: List[Dict[str, Any]],
    sample_size: int,
) -> Dict[str, Any]:
    """Compute authoritative aggregates over ALL rows of an upload.

    Heavy: ~19 full JSONB scans on smart_bi_dynamic_data (200K+ rows).
    Callers should wrap with get_cache() to amortize across repeat queries.

    Args:
      conn: asyncpg connection (used for the initial key-check queries).
      pool: asyncpg pool (used for parallel fan-out of the 15+4+4 aggregate SQLs).
      upload_id: the upload to aggregate.
      field_meta: field definitions from smart_bi_pg_field_definitions.
                  May be mutated (Bug #25 fallback) — caller receives the mutated list back.
      sample_size: number of sample rows already loaded (just for the text label).

    Returns a dict; see module docstring for keys.
    """
    import asyncio

    t_start = asyncio.get_event_loop().time()

    # ── Bug #25 fallback: multi-level Excel may produce field_defs with clean
    # names (门店名称, 销售金额) whose original_name does NOT match the row_data
    # JSON keys (which stay as "Unnamed: X_level_0_..."). If most semantic names
    # are missing from row_data keys, drop them and keep only matching entries. ──
    actual_keys_row = await conn.fetch(
        """SELECT jsonb_object_keys(row_data) AS k
           FROM smart_bi_dynamic_data WHERE upload_id = $1 LIMIT 100""",
        upload_id
    )
    actual_keys = {r['k'] for r in (actual_keys_row or [])}
    semantic_defs = [f for f in field_meta if not _UNNAMED_PAT.match(str(f['original_name'] or ''))]
    semantic_matched = sum(1 for f in semantic_defs if f['original_name'] in actual_keys)
    if semantic_defs and semantic_matched / max(len(semantic_defs), 1) < 0.2:
        logger.warning(
            f"[agg] Bug #25 fallback: only {semantic_matched}/{len(semantic_defs)} "
            f"semantic names match row_data; keeping only row_data-matching entries"
        )
        field_meta = [f for f in field_meta if f['original_name'] in actual_keys]

    measures = [f['original_name'] for f in field_meta if f.get('is_measure')]
    dims = [f['original_name'] for f in field_meta if f.get('is_dimension')]

    # ── Total row count ──
    agg_row = await conn.fetchrow(
        "SELECT COUNT(*) AS total FROM smart_bi_dynamic_data WHERE upload_id = $1",
        upload_id
    )
    real_total_rows = agg_row['total'] if agg_row else 0
    agg_lines: List[str] = [
        f"- 全量数据行数: {real_total_rows} (样本 {sample_size} 行仅用于字段示意)"
    ]

    # Bug #21: exclude 合计/小计/Total meta-rows from SUM/MAX/MIN.
    # Check first dimension (typically 门店名称 / 产品名 / 项目) for meta labels.
    meta_dim = dims[0] if dims else None
    meta_where = ""
    meta_args_tail: List[Any] = []
    if meta_dim:
        meta_where = (
            " AND (row_data->>$3 IS NULL OR row_data->>$3 NOT IN "
            "('合计','总计','Total','TOTAL','小计','汇总','总额','Sum','sum'))"
        )
        meta_args_tail = [meta_dim]

    # ── Parallel per-measure totals + per-dim distinct counts ──
    # 15 measures + 4 dims fan-out via pool.acquire. Pool must have ≥19 conns.
    measure_sql = (
        f"""SELECT SUM((row_data->>$1)::numeric) AS s,
                   AVG((row_data->>$1)::numeric) AS a,
                   MIN((row_data->>$1)::numeric) AS mn,
                   MAX((row_data->>$1)::numeric) AS mx,
                   COUNT((row_data->>$1)::numeric) AS c
           FROM smart_bi_dynamic_data
           WHERE upload_id = $2 AND row_data->>$1 ~ '^-?[0-9.,]+$'
           {meta_where}"""
    )
    dim_distinct_sql = (
        """SELECT COUNT(DISTINCT row_data->>$1) AS c
           FROM smart_bi_dynamic_data
           WHERE upload_id = $2
             AND row_data->>$1 IS NOT NULL
             AND row_data->>$1 NOT IN ('合计','总计','Total','TOTAL','小计')"""
    )

    async def _run_measure(col):
        async with pool.acquire() as c2:
            return col, await c2.fetchrow(measure_sql, col, upload_id, *meta_args_tail)

    async def _run_dim_distinct(col):
        async with pool.acquire() as c2:
            return col, await c2.fetchrow(dim_distinct_sql, col, upload_id)

    measure_tasks = [_run_measure(m) for m in measures[:15]]
    dim_tasks = [_run_dim_distinct(d) for d in dims[:4]]
    measure_res, dim_res = await asyncio.gather(
        asyncio.gather(*measure_tasks, return_exceptions=True) if measure_tasks else asyncio.sleep(0, result=[]),
        asyncio.gather(*dim_tasks, return_exceptions=True) if dim_tasks else asyncio.sleep(0, result=[]),
    )
    for item in measure_res:
        if isinstance(item, Exception) or not item:
            continue
        m_col, r = item
        if r and r['c']:
            agg_lines.append(
                f"- {m_col} (全量): 总计={r['s'] or 0:,.2f}, "
                f"均值={r['a'] or 0:,.2f}, "
                f"最大={r['mx'] or 0:,.2f}, 最小={r['mn'] or 0:,.2f}, "
                f"有效行数={r['c']}"
            )
    for item in dim_res:
        if isinstance(item, Exception) or not item:
            continue
        d_col, dc = item
        if dc and dc['c'] is not None:
            agg_lines.append(f"- {d_col} 不同值总数: {dc['c']}")

    # ── Pick revenue-like primary measure ──
    primary_measure: Optional[str] = None
    for kw in _PRIORITY_MEASURE_KW:
        for m in measures:
            if kw in m:
                primary_measure = m
                break
        if primary_measure:
            break
    if not primary_measure and measures:
        primary_measure = measures[0]

    # ── Top-5 per (dim × primary_measure) for top dims ──
    top5_by_dim: Dict[str, List[Dict[str, Any]]] = {}
    if primary_measure:
        top5_sql = (
            """SELECT row_data->>$1 AS label,
                      SUM((row_data->>$2)::numeric) AS total
               FROM smart_bi_dynamic_data
               WHERE upload_id = $3
                 AND row_data->>$2 ~ '^-?[0-9.,]+$'
                 AND row_data->>$1 IS NOT NULL
                 AND row_data->>$1 NOT IN ('合计', '总计', 'Total', 'TOTAL', '小计')
               GROUP BY row_data->>$1
               ORDER BY total DESC NULLS LAST
               LIMIT 5"""
        )

        async def _run_top5(dim):
            async with pool.acquire() as c2:
                return dim, await c2.fetch(top5_sql, dim, primary_measure, upload_id)

        top5_res = await asyncio.gather(
            *[_run_top5(d) for d in dims[:4]], return_exceptions=True
        )
        for item in top5_res:
            if isinstance(item, Exception) or not item:
                continue
            dim, top_rows = item
            if top_rows:
                top5_by_dim[dim] = [
                    {"label": tr['label'], "total": float(tr['total'] or 0)}
                    for tr in top_rows
                ]
                top_str = ", ".join(
                    f"{tr['label']}={tr['total'] or 0:,.2f}"
                    for tr in top_rows
                )
                agg_lines.append(f"- Top5 by {dim} (按 {primary_measure}): {top_str}")

    compute_time_s = asyncio.get_event_loop().time() - t_start
    logger.info(
        f"[agg] compute_upload_aggregates upload={upload_id}: "
        f"{len(measure_tasks)} measures + {len(dim_tasks)} dim_distincts + "
        f"{len(dims[:4]) if primary_measure else 0} top5 in {compute_time_s:.1f}s"
    )

    return {
        "field_meta": field_meta,
        "measures": measures,
        "dims": dims,
        "real_total_rows": real_total_rows,
        "agg_lines": agg_lines,
        "top5_by_dim": top5_by_dim,
        "primary_measure": primary_measure,
        "compute_time_s": compute_time_s,
    }
