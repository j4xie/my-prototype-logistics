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

import json
import logging
import time
from typing import Any, Dict, List, Optional

from .compute.polars_backend import PolarsBackend
from .domain_detector import get_default_detector
from .schema import DataSchema, Domain, Field, FieldRole
from .templates.base import TemplateResult
from .templates.registry import get_registry, load_all_templates

logger = logging.getLogger(__name__)

# Priority keywords for picking primary_measure (restaurant/sales oriented).
# Matches chat.py Phase B priority for consistency.
_PRIORITY_MEASURE_KW = [
    '销售金额', '销售额', '营业额', '营业收入', '实收',
    '主营业务收入', '金额', '订单金额', '消费金额',
]


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


def _pick_primary_measure(field_meta: List[Dict[str, Any]]) -> Optional[str]:
    measures = [f['original_name'] for f in field_meta if f.get('is_measure')]
    for kw in _PRIORITY_MEASURE_KW:
        for m in measures:
            if kw in m:
                return m
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
    primary_measure = _pick_primary_measure(field_meta)
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


async def materialize_upload(pool, upload_id: int) -> List[TemplateResult]:
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

        # 3. Row data (full load for in-memory OLAP — upload is immutable)
        data_rows = await conn.fetch(
            """SELECT row_data FROM smart_bi_dynamic_data WHERE upload_id = $1""",
            upload_id
        )
        rows: List[Dict[str, Any]] = []
        for r in data_rows:
            rd = r['row_data']
            if isinstance(rd, str):
                rd = json.loads(rd)
            rows.append(rd)

    logger.info(
        f"[materializer] upload {upload_id}: loaded {len(rows)} rows, "
        f"{len(field_meta)} fields in {time.time() - t_start:.1f}s"
    )

    # 4+5. Build schema (domain detection inside)
    sample = rows[:5] if rows else []
    schema = build_schema(upload_id, factory_id, field_meta, row_count, sample_rows=sample)
    logger.info(
        f"[materializer] upload {upload_id}: domain={schema.domain.value}, "
        f"primary_measure={schema.primary_measure}, time_field={schema.time_field}"
    )

    # 6. Backend
    backend = PolarsBackend.from_rows(rows)

    # 7. Run all templates
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
    return results
