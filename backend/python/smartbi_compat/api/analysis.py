"""Phase 2A alias routes for SmartBIAnalysisController paths.

T5b: GET /api/mobile/{factory_id}/smart-bi/query-templates — Java-shape
list of saved query templates (sorted by created_at DESC, soft-delete
filtered).

Java reference: SmartBIAnalysisController.getQueryTemplates (line 954)
backed by SmartBiQueryTemplateRepository.findByFactoryIdOrderByCreatedAtDesc
which returns List<SmartBiQueryTemplate> (BaseEntity + 7 fields). Lombok
@Data on BaseEntity then SmartBiQueryTemplate fixes Jackson key order:
    createdAt, updatedAt, deletedAt, id, factoryId, name, category,
    description, queryTemplate, parameters, deleted
where ``deleted`` is the @Where soft-delete derived flag (deletedAt != null).

T5c: GET /api/mobile/{factory_id}/smart-bi/datasource/list — Java-shape
list of active datasources for a factory (no explicit ORDER BY, soft-delete
filtered, is_active=true filtered).

Java reference: SmartBIAnalysisController.listDatasources (line 731-745)
backed by SmartBiSchemaServiceImpl.listDatasources, which returns
List<SmartBiDatasource> via SmartBiDatasourceRepository
.findByFactoryIdAndIsActiveTrue (BaseEntity adds @Where deleted_at IS NULL
auto-filter). Lombok @Data on BaseEntity then SmartBiDatasource fixes
Jackson key order:
    createdAt, updatedAt, deletedAt, id, name, sourceType, factoryId,
    schemaVersion, lastSchemaChange, description, connectionConfig,
    isActive, code, refreshInterval, linkedUploadId, fieldDefinitions,
    deleted
where ``fieldDefinitions`` is a Hibernate lazy @OneToMany collection that
the list query never loads (always serialises as []) and ``deleted`` is
the @Where soft-delete derived flag (deletedAt != null).
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Iterable, List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy import text

from smartbi_compat.alert_thresholds import load_thresholds
from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.date_range import DateRange
from smartbi_compat.schema_compat import wrap_response

router = APIRouter()
logger = logging.getLogger(__name__)


def _row_to_dict(row: Any) -> dict:
    """Convert a smart_bi_query_templates row to a Java-shape JSON dict.

    ``row`` is duck-typed: production passes a SQLAlchemy ``Row``, tests
    pass ``types.SimpleNamespace``. Both expose columns as attributes
    (``row.created_at``, ``row.factory_id``, etc.), so we annotate the
    parameter as ``Any`` rather than a structural protocol.

    Field key order MUST match Jackson serialisation of
    SmartBiQueryTemplate (Lombok @Data on BaseEntity superclass first,
    then on SmartBiQueryTemplate, then the @Where-derived ``deleted``
    boolean):
        createdAt, updatedAt, deletedAt, id, factoryId, name, category,
        description, queryTemplate, parameters, deleted

    Timestamps render as ``datetime.isoformat()`` to match Java's Jackson
    LocalDateTime default (no timezone, microseconds — see schema_compat
    module docstring on the Java/Python precision compromise).
    """
    return {
        "createdAt": row.created_at.isoformat() if row.created_at else None,
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
        "deletedAt": row.deleted_at.isoformat() if row.deleted_at else None,
        "id": row.id,
        "factoryId": row.factory_id,
        "name": row.name,
        "category": row.category,
        "description": row.description,
        "queryTemplate": row.query_template,
        "parameters": row.parameters,
        "deleted": row.deleted_at is not None,
    }


def _query_templates(factory_id: str) -> List[dict]:
    """Return saved query templates for a factory, sorted by created_at DESC.

    Mirrors Java
    SmartBiQueryTemplateRepository.findByFactoryIdOrderByCreatedAtDesc.
    BaseEntity adds ``@Where(clause = "deleted_at IS NULL")`` so we
    filter the soft-deleted rows in SQL.

    Isolated as a module-level function so contract tests can monkey-patch
    it without standing up a Postgres instance. Production calls go through
    smartbi.database.connection.get_db_context() against the SmartBI DB.
    """
    # Lazy import: keeps smartbi_compat tests independent of smartbi.database
    # initialisation when POSTGRES_ENABLED is unset (e.g. CI / unit tests).
    from smartbi.database.connection import get_db_context, is_postgres_enabled

    if not is_postgres_enabled():
        logger.warning(
            "query-templates: postgres not enabled; returning [] "
            "(factory_id=%s)",
            factory_id,
        )
        return []

    sql = text(
        "SELECT id, factory_id, name, category, description, query_template, "
        "parameters, created_at, updated_at, deleted_at "
        "FROM smart_bi_query_templates "
        "WHERE factory_id = :fid AND deleted_at IS NULL "
        "ORDER BY created_at DESC"
    )
    with get_db_context() as db:
        rows = db.execute(sql, {"fid": factory_id}).all()
    return [_row_to_dict(r) for r in rows]


@router.get("/api/mobile/{factory_id}/smart-bi/query-templates")
async def list_query_templates(
    factory_id: str,
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict[str, Any]:
    """Java-compatible alias: list saved query templates for a factory.

    Uses ``auth.factory_id`` rather than the path ``factory_id`` to match
    dashboard.py's pattern; the auth dependency already enforces
    path-equals-token-factoryId, so the two are equivalent in practice.
    """
    rows = _query_templates(auth.factory_id)
    return wrap_response(rows)


def _datasource_row_to_dict(row: Any) -> dict:
    """Convert a smart_bi_datasource row to a Java-shape JSON dict.

    ``row`` is duck-typed: production passes a SQLAlchemy ``Row``, tests
    pass ``types.SimpleNamespace``. Both expose columns as attributes
    (``row.created_at``, ``row.factory_id``, ``row.source_type``, etc.),
    so we annotate the parameter as ``Any`` rather than a structural
    protocol.

    Field key order MUST match Jackson serialisation of SmartBiDatasource
    (Lombok @Data on BaseEntity superclass first, then on
    SmartBiDatasource fields in declaration order, then the @Where-derived
    ``deleted`` boolean from BaseEntity.isDeleted() last):
        createdAt, updatedAt, deletedAt, id, name, sourceType, factoryId,
        schemaVersion, lastSchemaChange, description, connectionConfig,
        isActive, code, refreshInterval, linkedUploadId, fieldDefinitions,
        deleted

    ``fieldDefinitions`` is a Hibernate lazy @OneToMany collection that
    findByFactoryIdAndIsActiveTrue never loads — it is always serialised
    as ``[]``. The Python alias unconditionally emits ``[]`` for this key
    (does NOT query the smart_bi_field_definition table) to match Java
    byte-shape exactly.

    Timestamps render as ``datetime.isoformat()`` to match Java's Jackson
    LocalDateTime default (no timezone, microseconds — see schema_compat
    module docstring on the Java/Python precision compromise).
    """
    return {
        "createdAt": row.created_at.isoformat() if row.created_at else None,
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
        "deletedAt": row.deleted_at.isoformat() if row.deleted_at else None,
        "id": row.id,
        "name": row.name,
        "sourceType": row.source_type,
        "factoryId": row.factory_id,
        "schemaVersion": row.schema_version,
        "lastSchemaChange": (
            row.last_schema_change.isoformat() if row.last_schema_change else None
        ),
        "description": row.description,
        "connectionConfig": row.connection_config,
        "isActive": row.is_active,
        "code": row.code,
        "refreshInterval": row.refresh_interval,
        "linkedUploadId": row.linked_upload_id,
        # Hibernate lazy @OneToMany never loaded by the list query; always [].
        "fieldDefinitions": [],
        "deleted": row.deleted_at is not None,
    }


def _query_datasources(factory_id: str) -> List[dict]:
    """Return active datasources for a factory.

    Mirrors Java SmartBiSchemaServiceImpl.listDatasources, which calls
    SmartBiDatasourceRepository.findByFactoryIdAndIsActiveTrue. BaseEntity
    adds ``@Where(clause = "deleted_at IS NULL")`` so we filter the
    soft-deleted rows in SQL.

    No explicit ORDER BY: Java's findByFactoryIdAndIsActiveTrue does not
    add one, and the recorded golden was captured under PG's natural
    (effectively physical row) order. Adding ORDER BY here would diverge
    from Java byte-shape on ties.

    Isolated as a module-level function so contract tests can monkey-patch
    it without standing up a Postgres instance. Production calls go through
    smartbi.database.connection.get_db_context() against the SmartBI DB.
    """
    # Lazy import: keeps smartbi_compat tests independent of smartbi.database
    # initialisation when POSTGRES_ENABLED is unset (e.g. CI / unit tests).
    from smartbi.database.connection import get_db_context, is_postgres_enabled

    if not is_postgres_enabled():
        logger.warning(
            "datasource-list: postgres not enabled; returning [] "
            "(factory_id=%s)",
            factory_id,
        )
        return []

    sql = text(
        "SELECT id, name, source_type, factory_id, schema_version, "
        "last_schema_change, description, connection_config, is_active, "
        "code, refresh_interval, linked_upload_id, "
        "created_at, updated_at, deleted_at "
        "FROM smart_bi_datasource "
        "WHERE factory_id = :fid AND is_active = TRUE AND deleted_at IS NULL"
    )
    with get_db_context() as db:
        rows = db.execute(sql, {"fid": factory_id}).all()
    return [_datasource_row_to_dict(r) for r in rows]


_SCALE_4 = Decimal("0.0001")

_THRESHOLDS = load_thresholds()


def _sum_field(rows: Iterable, attr: str) -> Decimal:
    """Sum ``getattr(row, attr)`` over rows, skipping None values.

    Mirrors Java sumField(data, ::getX) — null entries are treated as zero.
    """
    total = Decimal("0")
    for r in rows:
        v = getattr(r, attr, None)
        if v is not None:
            total += Decimal(str(v))
    return total


def _calculate_rate(numerator: Decimal, denominator: Decimal) -> Decimal:
    """Return (numerator / denominator) * 100, scale 4, HALF_UP rounding.

    Returns Decimal("0") when denominator is zero (matches Java behavior:
    BigDecimal.divide on zero would throw, but the Java helper guards against it).
    """
    if denominator == 0:
        return Decimal("0")
    return (numerator / denominator * 100).quantize(_SCALE_4, rounding=ROUND_HALF_UP)


def _calculate_growth_rate(current: Decimal, previous: Decimal) -> Decimal:
    """Return ((current - previous) / previous) * 100, scale 4, HALF_UP rounding.

    Returns Decimal("0") when previous is zero.
    """
    if previous == 0:
        return Decimal("0")
    return ((current - previous) / previous * 100).quantize(_SCALE_4, rounding=ROUND_HALF_UP)


def _prev_month_start(current_start):
    """First day of the month before current_start."""
    if current_start.month == 1:
        return current_start.replace(year=current_start.year - 1, month=12)
    return current_start.replace(month=current_start.month - 1)


def _prev_month_end(current_start):
    """Last day of the month before current_start."""
    return current_start - timedelta(days=1)


def _query_sales_data(factory_id: str, range_) -> list:
    """Return smart_bi_sales_data rows for a factory in a date range.

    Mirrors Java SmartBiSalesDataRepository.findByFactoryIdAndOrderDateBetween.
    Module-level seam so contract tests can monkey-patch without standing up PG.
    """
    from smartbi.database.connection import get_db_context, is_postgres_enabled

    if not is_postgres_enabled():
        logger.warning(
            "alerts/sales: postgres not enabled; returning [] (factory_id=%s)",
            factory_id,
        )
        return []

    sql = text(
        "SELECT salesperson_name, amount, monthly_target "
        "FROM smart_bi_sales_data "
        "WHERE factory_id = :fid AND order_date BETWEEN :start AND :end"
    )
    with get_db_context() as db:
        return db.execute(
            sql,
            {"fid": factory_id, "start": range_.start_date, "end": range_.end_date},
        ).all()


def _new_alert_dict(
    *,
    level: str,
    category: str,
    title: str,
    message: str,
    metric: str,
    value: Decimal,
    threshold: Decimal,
    suggestion: str,
    related_entity_id: str | None = None,
    related_entity_name: str | None = None,
) -> dict:
    """Build a Java-shape Alert dict — 15 keys in Jackson order.

    Java's Alert.java has 13 declared fields + 2 derived getters (getLevelName,
    isUrgent). Lombok @Data exposes both — Jackson serializes declared fields
    first, then getter-only properties at end (alphabetical-ish but observed
    order is levelName, then urgent).

    AlertLevel.needsAction() returns true when severity >= RED.severity (so
    RED + CRITICAL both urgent, GREEN + YELLOW are not).
    """
    return {
        "id": str(uuid.uuid4()),
        "level": level,
        "category": category,
        "title": title,
        "message": message,
        "metric": metric,
        "value": value,
        "threshold": threshold,
        "gapPercent": None,
        "suggestion": suggestion,
        "relatedEntityId": related_entity_id,
        "relatedEntityName": related_entity_name,
        "createdAt": datetime.now().isoformat(),
        "levelName": level,
        "urgent": level in ("RED", "CRITICAL"),
    }


def _generate_sales_alerts(factory_id: str, range_: DateRange) -> list[dict]:
    """Mirror RecommendationServiceImpl.generateSalesAlerts (Java line 162-274)."""
    sales_data = _query_sales_data(factory_id, range_)
    if not sales_data:
        return []
    alerts: list[dict] = []
    th = _THRESHOLDS.sales

    # 1. Overall completion rate
    total_sales = _sum_field(sales_data, "amount")
    total_target = _sum_field(sales_data, "monthly_target")
    completion_rate = _calculate_rate(total_sales, total_target)

    if completion_rate < th.completion_red:
        alerts.append(_new_alert_dict(
            level="RED",
            category="sales",
            title="销售目标严重滞后",
            message=f"当前完成率仅为 {completion_rate:.1f}%，远低于预期",
            metric="目标完成率",
            value=completion_rate,
            threshold=th.completion_red,
            suggestion="建议立即召开销售会议，分析原因并制定追赶计划",
        ))
    elif completion_rate < th.completion_yellow:
        alerts.append(_new_alert_dict(
            level="YELLOW",
            category="sales",
            title="销售目标需加速",
            message=f"当前完成率为 {completion_rate:.1f}%，需要加快进度",
            metric="目标完成率",
            value=completion_rate,
            threshold=th.completion_yellow,
            suggestion="建议加强客户跟进，提高成交转化率",
        ))

    # 2. Month-over-month growth
    prev_start = _prev_month_start(range_.start_date)
    prev_end = _prev_month_end(range_.start_date)
    prev_range = DateRange(prev_start, prev_end)
    previous_data = _query_sales_data(factory_id, prev_range)
    if previous_data:
        previous_sales = _sum_field(previous_data, "amount")
        growth_rate = _calculate_growth_rate(total_sales, previous_sales)
        if growth_rate < th.growth_red:
            alerts.append(_new_alert_dict(
                level="RED",
                category="sales",
                title="销售额大幅下降",
                message=f"销售额环比下降 {abs(growth_rate):.1f}%，需紧急关注",
                metric="环比增长率",
                value=growth_rate,
                threshold=th.growth_red,
                suggestion="建议分析下降原因，检查是否存在市场变化或竞争加剧",
            ))
        elif growth_rate < th.growth_yellow:
            alerts.append(_new_alert_dict(
                level="YELLOW",
                category="sales",
                title="销售额有所下降",
                message=f"销售额环比下降 {abs(growth_rate):.1f}%，需关注趋势",
                metric="环比增长率",
                value=growth_rate,
                threshold=th.growth_yellow,
                suggestion="建议分析原因，制定应对措施",
            ))

    # 3. Per-salesperson alerts (sorted by name to match Java TreeMap fix)
    per_person_sales: dict[str, Decimal] = {}
    per_person_target: dict[str, Decimal] = {}
    for d in sales_data:
        if d.salesperson_name is None:
            continue
        per_person_sales[d.salesperson_name] = (
            per_person_sales.get(d.salesperson_name, Decimal("0"))
            + (Decimal(str(d.amount)) if d.amount is not None else Decimal("0"))
        )
        per_person_target[d.salesperson_name] = (
            per_person_target.get(d.salesperson_name, Decimal("0"))
            + (Decimal(str(d.monthly_target)) if d.monthly_target is not None else Decimal("0"))
        )

    for name in sorted(per_person_sales.keys()):
        sales = per_person_sales[name]
        target = per_person_target.get(name, Decimal("0"))
        rate = _calculate_rate(sales, target)
        if rate < th.completion_red:
            alerts.append(_new_alert_dict(
                level="RED",
                category="sales",
                title=f"销售员 {name} 业绩预警",
                message=f"{name} 目标完成率仅为 {rate:.1f}%",
                metric="个人完成率",
                value=rate,
                threshold=th.completion_red,
                suggestion="建议一对一沟通，了解困难并提供支持",
                related_entity_name=name,
            ))

    return alerts


@router.get("/api/mobile/{factory_id}/smart-bi/datasource/list")
async def list_datasources(
    factory_id: str,
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict[str, Any]:
    """Java-compatible alias: list active datasources for a factory.

    Uses ``auth.factory_id`` rather than the path ``factory_id`` to match
    dashboard.py's pattern; the auth dependency already enforces
    path-equals-token-factoryId, so the two are equivalent in practice.
    """
    rows = _query_datasources(auth.factory_id)
    return wrap_response(rows)


@router.get("/api/mobile/{factory_id}/smart-bi/alerts")
async def get_alerts(
    factory_id: str,
    category: Optional[str] = None,
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict[str, Any]:
    """Java-compatible alias: GET /smart-bi/alerts[?category=sales|finance|department].

    Java reference: SmartBIAnalysisController.getAlerts (line 590-617)
    backed by RecommendationServiceImpl.generateSales/Finance/Department/All.

    Phase 2A chat 2: only sales generator ported; finance / department / aggregator
    return [] until chat 3 (Phase C/D/E). Default branch returns sales for now.
    """
    range_ = DateRange.by_period("month")
    if category == "sales":
        alerts = _generate_sales_alerts(auth.factory_id, range_)
    elif category in ("finance", "department"):
        alerts = []
    else:
        alerts = _generate_sales_alerts(auth.factory_id, range_)
    return wrap_response(alerts)
