"""Materializer — one-call entry point for upload-level pre-computation.

Flow:
  1. Load upload metadata (factory_id, row_count, file_name) from smart_bi_pg_excel_uploads
  2. Load field_definitions from smart_bi_pg_field_definitions
  3. Load all rows from smart_bi_dynamic_data (row_data JSONB)
  4. Build DataSchema (map field roles, infer primary_measure + time_field)
  5. Detect domain via DomainDetector
  6. Load PolarsBackend from rows
  7. Run all registered templates → List[TemplateResult]

Callers (API endpoint, upload hook) pass a pool and upload_id;
materialize_upload handles the rest.
"""
from __future__ import annotations

import gc
import json
import logging
import time
from typing import Any, Dict, List, Optional

from .compute.polars_backend import PolarsBackend
from .domain_detector import get_default_detector
from .schema import DataSchema, Field, FieldRole
from .templates.base import TemplateResult
from .templates.registry import get_registry, load_all_templates

logger = logging.getLogger(__name__)

# Priority keywords for picking primary_measure (restaurant/sales oriented).
# Matches chat.py Phase B priority for consistency.
_PRIORITY_MEASURE_KW = [
    '销售金额', '销售额', '营业额', '营业收入', '实收',
    '主营业务收入', '金额', '订单金额', '消费金额',
]

# Apr 26 2026: ID-like column patterns to EXCLUDE from primary_measure
# candidates even when is_measure=True. qhj 4216 卡详情 had 卡号 / 手机
# numeric columns marked is_measure (because they're integer-typed) but
# they're identifiers, not metrics. Picking 卡号 made top_n_by_dim render
# "Top 值 497,533,214,596 元" garbage (sum of card-IDs).
_ID_LIKE_PATTERNS = (
    '卡号', '会员号', '会员编号', '卡编号', '手机', '电话',
    '订单号', '账单号', 'ID', 'id', '编号', '工号',
)


def _is_id_like(name: str) -> bool:
    """Detect identifier columns wrongly classified as measures."""
    return any(p in name for p in _ID_LIKE_PATTERNS)


def _field_role_from_def(fd: Dict[str, Any]) -> FieldRole:
    if fd.get('is_time'):
        return FieldRole.TIME
    if fd.get('is_measure'):
        return FieldRole.MEASURE
    if fd.get('is_dimension'):
        return FieldRole.DIMENSION
    return FieldRole.UNKNOWN


def _infer_dtype(fd: Dict[str, Any]) -> str:
    """Best-effort dtype from field_definitions (future: read actual column type)."""
    if fd.get('is_time'):
        return 'datetime'
    if fd.get('is_measure'):
        return 'float'
    return 'string'


def _pick_primary_measure(
    field_meta: List[Dict[str, Any]],
    sample_rows: Optional[List[Dict[str, Any]]] = None,
) -> Optional[str]:
    # Apr 26 2026: filter out ID-like columns. See _ID_LIKE_PATTERNS.
    measures = [
        f['original_name'] for f in field_meta
        if f.get('is_measure') and not _is_id_like(f['original_name'])
    ]
    for kw in _PRIORITY_MEASURE_KW:
        for m in measures:
            if kw in m:
                return m  # priority match — trust it (real revenue column)

    # Fallback: first measure. But verify it has signal — qhj 4216 卡详情
    # has 余额/本金/赠送金/押金 all 0 (member-card data, no transactions),
    # so picking "本金" makes ALL revenue-dependent templates produce
    # "Top 1 X 0 元 / 占比 0%" garbage. If sample shows no non-zero
    # values, return None → templates' applies() returns False, no
    # garbage cache served.
    if measures and sample_rows:
        candidate = measures[0]
        non_zero_count = 0
        for r in sample_rows[:100]:  # check up to 100 sample rows
            v = r.get(candidate)
            if v is None:
                continue
            try:
                if float(v) != 0:
                    non_zero_count += 1
                    if non_zero_count >= 3:
                        return candidate  # has signal — proceed
            except (TypeError, ValueError):
                pass
        if non_zero_count == 0:
            logger.info(
                f"[materializer] fallback measure {candidate!r} has no non-zero "
                f"values in sample — returning None primary_measure (revenue "
                f"templates will skip via applies())"
            )
            return None
    return measures[0] if measures else None


def _pick_time_field(field_meta: List[Dict[str, Any]]) -> Optional[str]:
    for f in field_meta:
        if f.get('is_time'):
            return f['original_name']
    return None


def build_schema(
    upload_id: int,
    factory_id: str,
    field_meta: List[Dict[str, Any]],
    row_count: int,
    sample_rows: Optional[List[Dict[str, Any]]] = None,
) -> DataSchema:
    """Construct DataSchema from raw field_definitions rows.

    Domain detection runs last; pass sample_rows (small slice) for
    future detectors that need data inspection (not currently used by
    RestaurantRuleDetector but kept for interface stability).
    """
    fields = tuple(
        Field(
            name=fd['original_name'],
            role=_field_role_from_def(fd),
            dtype=_infer_dtype(fd),
        )
        for fd in field_meta
    )
    primary_measure = _pick_primary_measure(field_meta, sample_rows=sample_rows)
    time_field = _pick_time_field(field_meta)

    detector = get_default_detector()
    domain = detector.detect(list(fields), sample_rows or [])

    return DataSchema(
        upload_id=upload_id,
        factory_id=factory_id,
        domain=domain,
        fields=fields,
        row_count=row_count,
        primary_measure=primary_measure,
        time_field=time_field,
    )


async def materialize_upload(
    pool, upload_id: int, _out_ctx: Optional[Dict[str, Any]] = None,
) -> List[TemplateResult]:
    """Run all registered templates against an upload's data.

    Args:
      pool: asyncpg pool (injected so caller controls connection lifecycle).
      upload_id: target upload.

    Returns: list of TemplateResult (all templates, including applies=False skips).
    Caller decides whether to persist skipped ones (Task 11 persistence filters them).
    """
    t_start = time.time()

    # Ensure templates are loaded (idempotent via _registry collision guard — but
    # we catch the ValueError on re-registration since register() raises on dup)
    try:
        load_all_templates()
    except ValueError as e:
        # Already loaded — fine
        logger.debug(f"[materializer] templates already loaded: {e}")

    # Phase 1: lightweight metadata queries (separate conn, short-lived).
    # Conn closes before we begin streaming, freeing any lingering refs.
    async with pool.acquire() as conn:
        # 1. Upload metadata
        upload_row = await conn.fetchrow(
            """SELECT id, factory_id, file_name, row_count
               FROM smart_bi_pg_excel_uploads WHERE id = $1""",
            upload_id
        )
        if upload_row is None:
            raise ValueError(f"upload {upload_id} not found")
        factory_id = upload_row['factory_id']
        row_count = upload_row['row_count'] or 0

        # 2. Field definitions
        field_rows = await conn.fetch(
            """SELECT original_name, standard_name,
                      is_measure, is_dimension, is_time
               FROM smart_bi_pg_field_definitions
               WHERE upload_id = $1 ORDER BY display_order""",
            upload_id
        )
        field_meta = [dict(r) for r in field_rows]
        if not field_meta:
            logger.warning(f"[materializer] upload {upload_id}: no field_definitions")
            return []

    # Phase 2+4 (fused): stream rows in chunks, convert each chunk to polars
    # immediately, and release the dict batch before accumulating the next.
    #
    # The old path held all 200K row_data dicts in a Python list then called
    # pl.from_dicts on the whole list — during that conversion both the dict
    # list AND the growing columnar arrays existed, peaking at ~10 GB on a
    # 200K × 231 field upload and triggering OOM. Apr 23 2026 prod incident.
    #
    # Chunked build peaks at ~500-800 MB (one chunk of dicts + accumulated
    # polars frames which are columnar-compact).
    import polars as pl
    CURSOR_PREFETCH = 10_000
    CHUNK_SIZE = 10_000  # dicts per polars conversion
    frames: List[Any] = []  # pl.DataFrame instances
    batch: List[Dict[str, Any]] = []
    sample: List[Dict[str, Any]] = []  # first 5 rows for build_schema
    inferred_schema: Optional[Dict[str, Any]] = None
    total_rows = 0

    def _flush_batch() -> None:
        # noqa: F821 — `batch` and `frames` are closures over outer-scope
        # AnnAssign vars (lines 224-225); pyflakes has a known false-positive
        # detecting AnnAssign-then-closure binding, but Python runtime resolves
        # them via cell-variable lookup correctly.
        nonlocal inferred_schema
        if not batch:  # noqa: F821
            return
        if inferred_schema is None:
            # Apr 26 2026 fix: was infer_schema_length=min(1000, len(batch))
            # — qhj 4216 卡详情 32K rows had `售卡人` column where first ~1000
            # rows were all null, then later rows had "收银"/actual names.
            # polars inferred Null type → ComputeError "could not append value
            # 收银 of type str to builder" (misleadingly suffixed with
            # "or value overflows data-type's capacity"). Scan whole batch
            # (≤10K) — small upfront cost avoids type-mismatch crashes.
            try:
                df = pl.from_dicts(batch, infer_schema_length=len(batch))  # noqa: F821
            except Exception:
                # Last resort: schema=None (slowest but most permissive)
                df = pl.from_dicts(batch, infer_schema_length=None)  # noqa: F821
            inferred_schema = dict(df.schema)
        else:
            try:
                df = pl.from_dicts(batch, schema=inferred_schema)  # noqa: F821
            except Exception:
                # Loose fallback: re-infer per chunk and let concat reconcile
                # via diagonal merge. Only hit if a later chunk has a new
                # non-null column that didn't appear in the first 10K.
                df = pl.from_dicts(batch, infer_schema_length=len(batch))  # noqa: F821
        frames.append(df)  # noqa: F821
        batch.clear()  # noqa: F821

    async with pool.acquire() as conn:
        async with conn.transaction():
            async for r in conn.cursor(
                "SELECT row_data FROM smart_bi_dynamic_data WHERE upload_id = $1",
                upload_id,
                prefetch=CURSOR_PREFETCH,
            ):
                rd = r['row_data']
                if isinstance(rd, str):
                    rd = json.loads(rd)
                if len(sample) < 5:
                    sample.append(rd)
                batch.append(rd)
                total_rows += 1
                if len(batch) >= CHUNK_SIZE:
                    _flush_batch()
            _flush_batch()  # trailing remainder

    t_load = time.time() - t_start
    logger.info(
        f"[materializer] upload {upload_id}: streamed {total_rows} rows, "
        f"{len(field_meta)} fields in {t_load:.1f}s ({len(frames)} chunks)"
    )

    # Phase 3: Build schema (domain detection inside) — uses the small sample.
    schema = build_schema(upload_id, factory_id, field_meta, row_count, sample_rows=sample)
    logger.info(
        f"[materializer] upload {upload_id}: domain={schema.domain.value}, "
        f"primary_measure={schema.primary_measure}, time_field={schema.time_field}"
    )

    # Phase 4 (cont.): concat chunks into one DataFrame + wrap in PolarsBackend.
    # `diagonal_relaxed` handles the rare case where later chunks surface new
    # columns or slightly different dtypes vs. the first chunk's inferred schema.
    if frames:
        if len(frames) == 1:
            df_final = frames[0]
        else:
            try:
                df_final = pl.concat(frames, how="diagonal_relaxed")
            except Exception as e:
                logger.warning(f"[materializer] diagonal_relaxed concat failed: {e}; trying diagonal")
                df_final = pl.concat(frames, how="diagonal")
    else:
        df_final = pl.DataFrame()
    backend = PolarsBackend(df_final)
    frames.clear()
    del frames, batch, sample
    gc.collect()
    logger.info(
        f"[materializer] upload {upload_id}: polars DF built, "
        f"chunks released (row_count={backend.row_count()})"
    )

    # Phase 5: Run all templates sequentially
    registry = get_registry()
    results: List[TemplateResult] = []
    for template in registry.all():
        t0 = time.time()
        result = template.run(backend, schema)
        dt = time.time() - t0
        results.append(result)
        status = "OK" if result.applies else ("ERR" if result.error else "SKIP")
        logger.info(
            f"[materializer] template {result.code}: {status} in {dt * 1000:.0f}ms"
        )

    logger.info(
        f"[materializer] upload {upload_id}: {sum(1 for r in results if r.applies)}/"
        f"{len(results)} templates applicable, total wall {time.time() - t_start:.1f}s"
    )
    # Expose internals for callers that want to piggyback additional in-memory
    # computation on the same polars DataFrame (e.g. hooks.py computing the
    # LLM-fallback aggregate bundle). The backend/schema/field_meta dict is
    # opt-in — callers that don't pass _out_ctx get the old return shape.
    if _out_ctx is not None:
        _out_ctx["backend"] = backend
        _out_ctx["schema"] = schema
        _out_ctx["field_meta"] = field_meta
    return results
