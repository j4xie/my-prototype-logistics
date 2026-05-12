"""Phase 2A alias routes for SmartBIDashboardController paths.

T5 PoC: GET /api/mobile/{factory_id}/smart-bi/data-date-range — single
end-to-end alias proving Phase 2A migration chain (route registration +
JWT middleware + DB query + Java-compatible envelope).

Java reference: SmartBIDashboardController.getDataDateRange (line ~347)
backed by SmartBIServiceImpl.getDataDateRange (line 2097), which queries
`SELECT MIN(order_date), MAX(order_date) FROM smart_bi_sales_data
 WHERE factory_id = ?` and infers granularity from the day span using
DateRange.custom(...) -> inferGranularity (DateRange.java:308).
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Any, Optional, Tuple

from fastapi import APIRouter, Depends
from sqlalchemy import text

from smartbi_compat._rbac_strip import strip_price_for_role
from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.schema_compat import wrap_response

router = APIRouter()
logger = logging.getLogger(__name__)


def _infer_granularity(start: date, end: date) -> str:
    """Mirror Java DateRange.inferGranularity(LocalDate, LocalDate).

    Boundaries (inclusive day count = end - start + 1):
      <=1   -> DAY
      <=7   -> WEEK
      <=31  -> MONTH
      <=93  -> QUARTER
      else  -> YEAR
    """
    days = (end - start).days + 1
    if days <= 1:
        return "DAY"
    if days <= 7:
        return "WEEK"
    if days <= 31:
        return "MONTH"
    if days <= 93:
        return "QUARTER"
    return "YEAR"


def _query_date_range(factory_id: str) -> Optional[Tuple[date, date]]:
    """Return (min_order_date, max_order_date) for a factory, or None when
    the factory has no rows in smart_bi_sales_data.

    Isolated as a module-level function so contract tests can monkey-patch
    it without standing up a Postgres instance. Production calls go through
    smartbi.database.connection.get_cretas_db_context() against cretas_prod_db
    (smart_bi_sales_data lives there per spec §1.3, not in smartbi_prod_db).
    """
    # Lazy import: keeps smartbi_compat tests independent of smartbi.database
    # initialisation when POSTGRES_ENABLED is unset (e.g. CI / unit tests).
    from smartbi.database.connection import get_cretas_db_context, is_postgres_enabled

    if not is_postgres_enabled():
        logger.warning(
            "data-date-range: postgres not enabled; returning None "
            "(factory_id=%s)",
            factory_id,
        )
        return None

    sql = text(
        "SELECT MIN(order_date) AS min_d, MAX(order_date) AS max_d "
        "FROM smart_bi_sales_data WHERE factory_id = :fid"
    )
    # Reads cretas_prod_db (smart_bi_sales_data per spec §1.3)
    with get_cretas_db_context() as db:
        row = db.execute(sql, {"fid": factory_id}).first()
    if row is None or row.min_d is None or row.max_d is None:
        return None
    return row.min_d, row.max_d


@router.get("/api/mobile/{factory_id}/smart-bi/data-date-range")
async def data_date_range(
    factory_id: str,
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict[str, Any]:
    """Java-compatible alias: detect a factory's sales-data date range."""
    pair = _query_date_range(auth.factory_id)
    if pair is None:
        return wrap_response(
            strip_price_for_role(
                {"hasData": False, "message": "No sales data detected"},
                auth.role,
            ),
            message="No sales data detected",
        )
    start, end = pair
    data = {
        "hasData": True,
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "granularity": _infer_granularity(start, end),
        "description": f"数据范围 {start.isoformat()} 至 {end.isoformat()}",
    }
    return wrap_response(strip_price_for_role(data, auth.role), message="Data date range detected")
