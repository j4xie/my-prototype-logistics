"""
Data Completeness Calculator
Computes field-level completeness for each entity type by querying PostgreSQL.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
import asyncpg
import os
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class CompletenessResult(BaseModel):
    entity_type: str
    total_records: int
    field_completeness: Dict[str, float]  # field_name -> completion %
    overall_completeness: float


class CompletenessRequest(BaseModel):
    factory_id: str
    entity_types: Optional[List[str]] = None  # if None, compute all


# Entity type to table/field mapping
ENTITY_FIELD_MAP = {
    "PROCESSING_BATCH": {
        "table": "production_batches",
        "factory_filter": "factory_id",
        "fields": [
            "batch_number", "product_name", "planned_quantity", "actual_quantity",
            "good_quantity", "defect_quantity", "yield_rate", "material_cost",
            "labor_cost", "equipment_cost", "total_cost", "unit_cost",
            "equipment_id", "supervisor_id", "worker_count", "start_time", "completed_time"
        ]
    },
    "WORK_SESSION": {
        "table": "employee_work_sessions",
        "factory_filter": "factory_id",
        "fields": [
            "user_id", "work_type_id", "start_time", "end_time",
            "break_minutes", "actual_work_minutes", "hourly_rate", "labor_cost"
        ]
    },
    "MATERIAL_BATCH": {
        "table": "material_batches",
        "factory_filter": "factory_id",
        "fields": [
            "batch_number", "material_type_id", "quantity", "unit_price",
            "supplier_id", "expiry_date", "storage_location"
        ]
    },
    "QUALITY_INSPECTION": {
        "table": "quality_inspections",
        "factory_filter": "factory_id",
        "fields": [
            "batch_id", "inspector_id", "inspection_type", "result",
            "defect_count", "defect_type"
        ]
    },
    "EQUIPMENT": {
        "table": "factory_equipment",
        "factory_filter": "factory_id",
        "fields": [
            "equipment_name", "equipment_type", "operating_hours",
            "last_maintenance_date", "status"
        ]
    }
}


async def _get_db_pool():
    """Get asyncpg connection pool using cretas database config."""
    db_url = os.getenv("COMPLETENESS_DB_URL", "postgresql://cretas_user:cretas_pass@localhost:5432/cretas_db")
    return await asyncpg.create_pool(db_url, min_size=1, max_size=3)


async def compute_completeness(factory_id: str, entity_types: Optional[List[str]] = None) -> List[CompletenessResult]:
    """Compute field-level null rates for specified entity types."""
    results = []
    types_to_check = entity_types or list(ENTITY_FIELD_MAP.keys())

    pool = await _get_db_pool()
    try:
        async with pool.acquire() as conn:
            for entity_type in types_to_check:
                if entity_type not in ENTITY_FIELD_MAP:
                    continue
                config = ENTITY_FIELD_MAP[entity_type]
                table = config["table"]
                factory_col = config["factory_filter"]
                fields = config["fields"]

                # Build query: COUNT(*) and COUNT(field) for each field
                count_exprs = ", ".join([f"COUNT({f}) as cnt_{f}" for f in fields])
                query = f"""
                    SELECT COUNT(*) as total, {count_exprs}
                    FROM {table}
                    WHERE {factory_col} = $1 AND deleted_at IS NULL
                """

                row = await conn.fetchrow(query, factory_id)
                total = row["total"] if row else 0

                field_completeness = {}
                if total > 0:
                    for f in fields:
                        cnt = row[f"cnt_{f}"]
                        field_completeness[f] = round(cnt / total * 100, 1)

                overall = round(sum(field_completeness.values()) / len(field_completeness), 1) if field_completeness else 0

                results.append(CompletenessResult(
                    entity_type=entity_type,
                    total_records=total,
                    field_completeness=field_completeness,
                    overall_completeness=overall
                ))
    finally:
        await pool.close()

    return results


@router.post("/completeness/compute")
async def api_compute_completeness(req: CompletenessRequest):
    """Compute data completeness for a factory."""
    try:
        results = await compute_completeness(req.factory_id, req.entity_types)
        return {"success": True, "data": [r.dict() for r in results]}
    except Exception as e:
        logger.error(f"Completeness computation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/completeness/trend")
async def api_completeness_trend(factory_id: str, entity_type: str = "PROCESSING_BATCH", months: int = 6):
    """Get completeness trend from snapshots table."""
    pool = await _get_db_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT snapshot_date, overall_completeness, field_completeness
                FROM data_completeness_snapshots
                WHERE factory_id = $1 AND entity_type = $2
                ORDER BY snapshot_date DESC
                LIMIT $3
            """, factory_id, entity_type, months)

            data = [{
                "date": str(r["snapshot_date"]),
                "overall": r["overall_completeness"],
                "fields": json.loads(r["field_completeness"]) if r["field_completeness"] else {}
            } for r in rows]

            return {"success": True, "data": data}
    finally:
        await pool.close()
