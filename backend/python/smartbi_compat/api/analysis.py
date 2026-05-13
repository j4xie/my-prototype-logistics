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

from smartbi_compat._java_compat import _format_decimal_half_up
from smartbi_compat._rbac_role import require_analytics_read
from smartbi_compat._rbac_strip import strip_price_for_role
from smartbi_compat.alert_thresholds import ALERT_SEVERITY, load_thresholds
from smartbi_compat.api.analysis_finance import _decimal_to_number
from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.date_range import DateRange
from smartbi_compat.schema_compat import _java_isoformat, wrap_response

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

    Timestamps render via ``_java_isoformat`` to match Java Jackson
    ``LocalDateTime`` (no timezone, trailing-zero microseconds dropped per
    Rule 11).
    """
    return {
        "createdAt": _java_isoformat(row.created_at),
        "updatedAt": _java_isoformat(row.updated_at),
        "deletedAt": _java_isoformat(row.deleted_at),
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
    smartbi.database.connection.get_cretas_db_context() against the Cretas DB
    (Java repo SmartBiQueryTemplateRepository binds to default datasource =
    cretas_db; see PR-A through PR-H May 5 for the same fix family).
    """
    # Lazy import: keeps smartbi_compat tests independent of smartbi.database
    # initialisation when POSTGRES_ENABLED is unset (e.g. CI / unit tests).
    from smartbi.database.connection import get_cretas_db_context, is_postgres_enabled

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
    with get_cretas_db_context() as db:
        rows = db.execute(sql, {"fid": factory_id}).all()
    return [_row_to_dict(r) for r in rows]


@router.get("/api/mobile/{factory_id}/smart-bi/query-templates")
async def list_query_templates(
    factory_id: str,
    auth: AuthContext = Depends(require_analytics_read),
) -> dict[str, Any]:
    """Java-compatible alias: list saved query templates for a factory.

    Uses ``auth.factory_id`` rather than the path ``factory_id`` to match
    dashboard.py's pattern; the auth dependency already enforces
    path-equals-token-factoryId, so the two are equivalent in practice.
    """
    rows = _query_templates(auth.factory_id)
    return wrap_response(strip_price_for_role(rows, auth.role))


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

    Timestamps render via ``_java_isoformat`` to match Java Jackson
    ``LocalDateTime`` (no timezone, trailing-zero microseconds dropped per
    Rule 11).
    """
    return {
        "createdAt": _java_isoformat(row.created_at),
        "updatedAt": _java_isoformat(row.updated_at),
        "deletedAt": _java_isoformat(row.deleted_at),
        "id": row.id,
        "name": row.name,
        "sourceType": row.source_type,
        "factoryId": row.factory_id,
        "schemaVersion": row.schema_version,
        "lastSchemaChange": _java_isoformat(row.last_schema_change),
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
    smartbi.database.connection.get_cretas_db_context() against cretas_prod_db
    (smart_bi_datasource lives there per spec
    2026-05-05-phase2a-db-pool-wiring-fix §1.3).
    """
    # Lazy import: keeps smartbi_compat tests independent of smartbi.database
    # initialisation when POSTGRES_ENABLED is unset (e.g. CI / unit tests).
    from smartbi.database.connection import get_cretas_db_context, is_postgres_enabled

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
    # Reads cretas_prod_db (smart_bi_datasource per spec §1.3)
    with get_cretas_db_context() as db:
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

    Mirrors Java RecommendationServiceImpl.calculateRate (line 968-973):
        actual.divide(target, SCALE=4, ROUND_HALF_UP).multiply(BigDecimal("100"))

    Java rounds the FRACTION at scale=4 BEFORE multiplying by 100. Python's
    naive `(num / den * 100).quantize(scale=4)` rounds the percentage instead,
    diverging when the fraction has more than 4 decimal digits of significance.
    See Rule 10 in .claude/rules/python-java-port.md.

    Returns Decimal("0") when denominator is zero.
    """
    if denominator == 0:
        return Decimal("0")
    return (numerator / denominator).quantize(_SCALE_4, rounding=ROUND_HALF_UP) * Decimal("100")


def _calculate_growth_rate(current: Decimal, previous: Decimal) -> Decimal:
    """Return ((current - previous) / previous) * 100, scale 4, HALF_UP rounding.

    Mirrors Java RecommendationServiceImpl.calculateGrowthRate (line 978-985):
        current.subtract(previous).divide(previous, SCALE=4, ROUND_HALF_UP).multiply(BigDecimal("100"))

    See _calculate_rate above for the divide-then-multiply rationale (Rule 10).

    Returns Decimal("0") when previous is zero.
    """
    if previous == 0:
        return Decimal("0")
    return ((current - previous) / previous).quantize(_SCALE_4, rounding=ROUND_HALF_UP) * Decimal("100")


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
    from smartbi.database.connection import get_cretas_db_context, is_postgres_enabled

    if not is_postgres_enabled():
        logger.warning(
            "alerts/sales: postgres not enabled; returning [] (factory_id=%s)",
            factory_id,
        )
        return []

    sql = text(
        "SELECT salesperson_name, amount, monthly_target, "
        "       product_category, customer_name, order_date "
        "FROM smart_bi_sales_data "
        "WHERE factory_id = :fid AND order_date BETWEEN :start AND :end"
    )
    # Reads cretas_prod_db (smart_bi_sales_data per spec §1.3)
    with get_cretas_db_context() as db:
        return db.execute(
            sql,
            {"fid": factory_id, "start": range_.start_date, "end": range_.end_date},
        ).all()


def _query_finance_data(factory_id: str, range_) -> list:
    """Mirror SmartBiFinanceDataRepository.findByFactoryIdAndRecordDateBetween.

    Returns rows with columns needed by the finance generator: customer_name,
    receivable_amount, aging_days, budget_amount, actual_amount.
    """
    from smartbi.database.connection import get_cretas_db_context, is_postgres_enabled

    if not is_postgres_enabled():
        logger.warning(
            "alerts/finance: postgres not enabled; returning [] (factory_id=%s)",
            factory_id,
        )
        return []

    sql = text(
        "SELECT customer_name, receivable_amount, aging_days, "
        "       budget_amount, actual_amount, "
        "       material_cost, labor_cost, overhead_cost "
        "FROM smart_bi_finance_data "
        "WHERE factory_id = :fid AND record_date BETWEEN :start AND :end"
    )
    # Reads cretas_prod_db (smart_bi_finance_data per spec §1.3)
    with get_cretas_db_context() as db:
        return db.execute(
            sql,
            {"fid": factory_id, "start": range_.start_date, "end": range_.end_date},
        ).all()


def _query_department_data(factory_id: str, range_) -> list:
    """Mirror SmartBiDepartmentDataRepository.findByFactoryIdAndRecordDateBetween."""
    from smartbi.database.connection import get_cretas_db_context, is_postgres_enabled

    if not is_postgres_enabled():
        logger.warning(
            "alerts/department: postgres not enabled; returning [] (factory_id=%s)",
            factory_id,
        )
        return []

    sql = text(
        "SELECT department, sales_amount, headcount "
        "FROM smart_bi_department_data "
        "WHERE factory_id = :fid AND record_date BETWEEN :start AND :end"
    )
    # Reads cretas_prod_db (smart_bi_department_data per spec §1.3)
    with get_cretas_db_context() as db:
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
    # Rule 4: BigDecimal value/threshold must serialize as JSON number, not string.
    # FastAPI default emits Decimal as str → byte-shape divergence with Java Jackson.
    return {
        "id": str(uuid.uuid4()),
        "level": level,
        "category": category,
        "title": title,
        "message": message,
        "metric": metric,
        "value": _decimal_to_number(value),
        "threshold": _decimal_to_number(threshold),
        "gapPercent": None,
        "suggestion": suggestion,
        "relatedEntityId": related_entity_id,
        "relatedEntityName": related_entity_name,
        "createdAt": _java_isoformat(datetime.now()),
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
            message=f"当前完成率仅为 {_format_decimal_half_up(completion_rate, 1)}%，远低于预期",  # Rule 12
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
            message=f"当前完成率为 {_format_decimal_half_up(completion_rate, 1)}%，需要加快进度",  # Rule 12
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
                message=f"销售额环比下降 {_format_decimal_half_up(abs(growth_rate), 1)}%，需紧急关注",  # Rule 12
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
                message=f"销售额环比下降 {_format_decimal_half_up(abs(growth_rate), 1)}%，需关注趋势",  # Rule 12
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
                message=f"{name} 目标完成率仅为 {_format_decimal_half_up(rate, 1)}%",  # Rule 12
                metric="个人完成率",
                value=rate,
                threshold=th.completion_red,
                suggestion="建议一对一沟通，了解困难并提供支持",
                related_entity_name=name,
            ))

    return alerts


def _generate_finance_alerts(factory_id: str, range_: DateRange) -> list[dict]:
    """Mirror RecommendationServiceImpl.generateFinanceAlerts (Java line 278-376).

    3 alert types:
      1. Per-record aging (red >90, yellow >60) — List iteration, already stable
      2. Cost over-budget (max 1 alert; uses _calculate_growth_rate semantics)
      3. Large receivable total (max 1 alert; sum vs amount thresholds)
    """
    finance_data = _query_finance_data(factory_id, range_)
    if not finance_data:
        return []
    alerts: list[dict] = []
    th = _THRESHOLDS.finance

    # 1. Per-receivable aging alerts
    for d in finance_data:
        receivable = Decimal(str(d.receivable_amount)) if d.receivable_amount is not None else Decimal("0")
        if receivable <= 0:
            continue
        aging = d.aging_days if d.aging_days is not None else 0

        if aging > th.aging_red:
            alerts.append(_new_alert_dict(
                level="RED",
                category="finance",
                title="应收账款严重逾期",
                message=f"客户 {d.customer_name} 应收款 {_format_decimal_half_up(receivable, 2)} 元已逾期 {aging} 天",  # Rule 12
                metric="账龄天数",
                value=Decimal(aging),
                threshold=Decimal(th.aging_red),
                suggestion="建议立即联系客户催收，必要时采取法律手段",
            ))
        elif aging > th.aging_yellow:
            alerts.append(_new_alert_dict(
                level="YELLOW",
                category="finance",
                title="应收账款即将逾期",
                message=f"客户 {d.customer_name} 应收款 {_format_decimal_half_up(receivable, 2)} 元账龄已达 {aging} 天",  # Rule 12
                metric="账龄天数",
                value=Decimal(aging),
                threshold=Decimal(th.aging_yellow),
                suggestion="建议跟进客户付款计划，发送催款提醒",
            ))

    # 2. Cost over-budget (max 1 alert)
    total_budget = _sum_field(finance_data, "budget_amount")
    total_actual = _sum_field(finance_data, "actual_amount")
    if total_budget > 0:
        variance = _calculate_growth_rate(total_actual, total_budget)
        if variance > th.cost_variance_red:
            alerts.append(_new_alert_dict(
                level="RED",
                category="finance",
                title="成本严重超支",
                message=f"实际支出超预算 {_format_decimal_half_up(variance, 1)}%，需严格控制",  # Rule 12
                metric="预算偏差率",
                value=variance,
                threshold=th.cost_variance_red,
                suggestion="建议立即审查各项支出，暂停非必要开支",
            ))
        elif variance > th.cost_variance_yellow:
            alerts.append(_new_alert_dict(
                level="YELLOW",
                category="finance",
                title="成本有所超支",
                message=f"实际支出超预算 {_format_decimal_half_up(variance, 1)}%，需关注",  # Rule 12
                metric="预算偏差率",
                value=variance,
                threshold=th.cost_variance_yellow,
                suggestion="建议优化支出结构，控制成本增长",
            ))

    # 3. Large receivable total (max 1 alert)
    total_receivable = _sum_field(finance_data, "receivable_amount")
    if total_receivable > th.amount_red:
        alerts.append(_new_alert_dict(
            level="RED",
            category="finance",
            title="应收账款总额过高",
            message=f"应收账款总额达 {_format_decimal_half_up(total_receivable, 2)} 元，资金压力大",  # Rule 12
            metric="应收总额",
            value=total_receivable,
            threshold=th.amount_red,
            suggestion="建议制定催收计划，加速资金回笼",
        ))
    elif total_receivable > th.amount_yellow:
        alerts.append(_new_alert_dict(
            level="YELLOW",
            category="finance",
            title="应收账款总额较高",
            message=f"应收账款总额达 {_format_decimal_half_up(total_receivable, 2)} 元，需关注回款",  # Rule 12
            metric="应收总额",
            value=total_receivable,
            threshold=th.amount_yellow,
            suggestion="建议加强应收账款管理，定期跟进回款",
        ))

    return alerts


def _generate_department_alerts(factory_id: str, range_: DateRange) -> list[dict]:
    """Mirror RecommendationServiceImpl.generateDepartmentAlerts (Java line 380-434).

    Per-department per_capita check (sorted by name to match Java TreeMap fix).
    """
    dept_data = _query_department_data(factory_id, range_)
    if not dept_data:
        return []
    alerts: list[dict] = []
    th = _THRESHOLDS.department

    by_dept: dict[str, list] = {}
    for d in dept_data:
        if d.department is None:
            continue
        by_dept.setdefault(d.department, []).append(d)

    for dept_name in sorted(by_dept.keys()):
        rows = by_dept[dept_name]
        total_sales = _sum_field(rows, "sales_amount")
        headcount_max = max(
            (r.headcount for r in rows if r.headcount is not None),
            default=1,
        )
        if headcount_max <= 0:
            continue
        per_capita = (total_sales / Decimal(headcount_max)).quantize(
            _SCALE_4, rounding=ROUND_HALF_UP
        )

        if per_capita < th.per_capita_red:
            alerts.append(_new_alert_dict(
                level="RED",
                category="department",
                title=f"{dept_name} 人均产出过低",
                message=f"{dept_name} 人均销售额仅为 {_format_decimal_half_up(per_capita, 2)} 元，严重低于标准",  # Rule 12
                metric="人均产出",
                value=per_capita,
                threshold=th.per_capita_red,
                suggestion="建议分析人员效能，考虑调整人员配置或加强培训",
            ))
        elif per_capita < th.per_capita_yellow:
            alerts.append(_new_alert_dict(
                level="YELLOW",
                category="department",
                title=f"{dept_name} 人均产出偏低",
                message=f"{dept_name} 人均销售额为 {_format_decimal_half_up(per_capita, 2)} 元，低于期望",  # Rule 12
                metric="人均产出",
                value=per_capita,
                threshold=th.per_capita_yellow,
                suggestion="建议提升人员效率，优化工作流程",
            ))

    return alerts


def _generate_all_alerts(factory_id: str, range_: DateRange) -> list[dict]:
    """Mirror RecommendationServiceImpl.generateAllAlerts (Java line 438-454).

    Concatenates sales+finance+department alerts, then sorts by severity DESC.
    Python list.sort is stable so within-severity preserves sub-generator order.
    """
    all_alerts: list[dict] = []
    all_alerts.extend(_generate_sales_alerts(factory_id, range_))
    all_alerts.extend(_generate_finance_alerts(factory_id, range_))
    all_alerts.extend(_generate_department_alerts(factory_id, range_))
    all_alerts.sort(key=lambda a: -ALERT_SEVERITY[a["level"]])
    return all_alerts


# ─── /recommendations port ───────────────────────────────────────────────────
# Mirrors RecommendationServiceImpl.generateRecommendations (Java line 463-491)
# + 3 sub-generators (sales/cost/customer). Sort by priority ASC.

# Maps RecommendationType enum → Chinese display name (Java getDisplayName())
_RECOMMENDATION_TYPE_DISPLAY = {
    "SALES_IMPROVEMENT": "销售提升",
    "COST_REDUCTION": "成本优化",
    "CUSTOMER_RETENTION": "客户维护",
    "PRODUCT_FOCUS": "产品聚焦",
    "REGION_EXPANSION": "区域拓展",
    "COLLECTION_ALERT": "催收提醒",
    "INCENTIVE_PLAN": "激励方案",
    "OPERATION_OPTIMIZATION": "运营优化",
    "RISK_WARNING": "风险预警",
}


def _new_recommendation_dict(
    *,
    rec_type: str,
    title: str,
    description: str,
    priority: int,
    impact: str,
    action_items: list[str],
    related_data: dict | None = None,
    target_id: str | None = None,
    target_name: str | None = None,
) -> dict:
    """Build a Java-shape Recommendation dict — 13 keys in Jackson order.

    Java's Recommendation.java has 11 declared fields + 2 derived getters
    (getTypeName, isHighPriority). Lombok @Data exposes both. Jackson order:
    11 declared first, then alphabetical-ish for derived (typeName, highPriority).
    """
    return {
        "id": str(uuid.uuid4()),
        "type": rec_type,
        "title": title,
        "description": description,
        "priority": priority,
        "impact": impact,
        "actionItems": action_items,
        "relatedData": related_data if related_data is not None else {},
        "targetId": target_id,
        "targetName": target_name,
        "createdAt": _java_isoformat(datetime.now()),
        "typeName": _RECOMMENDATION_TYPE_DISPLAY.get(rec_type, ""),
        "highPriority": priority <= 2,
    }


def _generate_sales_recommendations(factory_id: str, range_: DateRange) -> list[dict]:
    """Mirror RecommendationServiceImpl.generateSalesRecommendations (Java line 495-573)."""
    sales_data = _query_sales_data(factory_id, range_)
    if not sales_data:
        return []
    recommendations: list[dict] = []

    # 1. Product concentration check (top single category > 60% → PRODUCT_FOCUS priority 2)
    product_sales: dict[str, Decimal] = {}
    for d in sales_data:
        if d.product_category is None:
            continue
        product_sales[d.product_category] = (
            product_sales.get(d.product_category, Decimal("0"))
            + (Decimal(str(d.amount)) if d.amount is not None else Decimal("0"))
        )

    total_sales = sum(product_sales.values(), Decimal("0"))
    if total_sales > 0 and product_sales:
        top_product = max(product_sales.values())
        concentration = (top_product / total_sales * 100).quantize(_SCALE_4, rounding=ROUND_HALF_UP)
        if concentration > Decimal("60"):
            recommendations.append(_new_recommendation_dict(
                rec_type="PRODUCT_FOCUS",
                title="优化产品结构",
                description=f"单一产品占比达 {_format_decimal_half_up(concentration, 1)}%，建议分散风险",  # Rule 12
                priority=2,
                impact="降低对单一产品的依赖，提高业务稳定性",
                action_items=[
                    "分析其他产品的市场潜力",
                    "制定新产品推广计划",
                    "对销售团队进行产品培训",
                ],
            ))

    # 2. Salesperson variance check (max/min > 3x → SALES_IMPROVEMENT priority 1)
    salesperson_sales: dict[str, Decimal] = {}
    for d in sales_data:
        if d.salesperson_name is None:
            continue
        salesperson_sales[d.salesperson_name] = (
            salesperson_sales.get(d.salesperson_name, Decimal("0"))
            + (Decimal(str(d.amount)) if d.amount is not None else Decimal("0"))
        )

    if len(salesperson_sales) > 1:
        max_sales = max(salesperson_sales.values())
        min_sales = min(salesperson_sales.values())
        if max_sales > 0 and min_sales > 0:
            variance = (max_sales / min_sales).quantize(_SCALE_4, rounding=ROUND_HALF_UP)
            if variance > Decimal("3"):
                # Find topSeller (max-by-value); ties broken by earliest sorted name
                top_seller = max(
                    sorted(salesperson_sales.keys()),
                    key=lambda name: salesperson_sales[name],
                )
                recommendations.append(_new_recommendation_dict(
                    rec_type="SALES_IMPROVEMENT",
                    title="缩小销售团队业绩差距",
                    description="销售员业绩差异较大，建议加强团队协作",
                    priority=1,
                    impact="提升团队整体销售能力，增加总销售额",
                    action_items=[
                        f"安排销冠 {top_seller} 分享成功经验",
                        "对业绩落后人员进行一对一辅导",
                        "建立销售技能提升计划",
                    ],
                ))

    return recommendations


def _generate_cost_recommendations(factory_id: str, range_: DateRange) -> list[dict]:
    """Mirror RecommendationServiceImpl.generateCostRecommendations (Java line 577-612)."""
    finance_data = _query_finance_data(factory_id, range_)
    if not finance_data:
        return []
    recommendations: list[dict] = []

    material_cost = _sum_field(finance_data, "material_cost")
    labor_cost = _sum_field(finance_data, "labor_cost")
    overhead_cost = _sum_field(finance_data, "overhead_cost")
    total_cost = material_cost + labor_cost + overhead_cost

    if total_cost > 0:
        material_ratio = (material_cost / total_cost * 100).quantize(_SCALE_4, rounding=ROUND_HALF_UP)
        if material_ratio > Decimal("60"):
            recommendations.append(_new_recommendation_dict(
                rec_type="COST_REDUCTION",
                title="优化原材料成本",
                description=f"原材料成本占比达 {_format_decimal_half_up(material_ratio, 1)}%，建议优化采购",  # Rule 12
                priority=2,
                impact="降低原材料成本，提高利润率",
                action_items=[
                    "寻找替代供应商进行比价",
                    "与现有供应商谈判优惠价格",
                    "优化库存管理减少损耗",
                ],
            ))

    return recommendations


def _generate_customer_recommendations(factory_id: str, range_: DateRange) -> list[dict]:
    """Mirror RecommendationServiceImpl.generateCustomerRecommendations (Java line 616-680)."""
    sales_data = _query_sales_data(factory_id, range_)
    if not sales_data:
        return []
    recommendations: list[dict] = []

    customer_sales: dict[str, Decimal] = {}
    for d in sales_data:
        if d.customer_name is None:
            continue
        customer_sales[d.customer_name] = (
            customer_sales.get(d.customer_name, Decimal("0"))
            + (Decimal(str(d.amount)) if d.amount is not None else Decimal("0"))
        )

    total_sales = sum(customer_sales.values(), Decimal("0"))
    if total_sales > 0 and customer_sales:
        # 1. Top 3 customer concentration > 50% → CUSTOMER_RETENTION priority 1
        sorted_values = sorted(customer_sales.values(), reverse=True)
        top_3_sum = sum(sorted_values[:3], Decimal("0"))
        top_ratio = (top_3_sum / total_sales * 100).quantize(_SCALE_4, rounding=ROUND_HALF_UP)
        if top_ratio > Decimal("50"):
            recommendations.append(_new_recommendation_dict(
                rec_type="CUSTOMER_RETENTION",
                title="加强核心客户维护",
                description=f"Top 3 客户贡献 {_format_decimal_half_up(top_ratio, 1)}% 销售额，需重点维护",  # Rule 12
                priority=1,
                impact="稳定核心客户，降低客户流失风险",
                action_items=[
                    "为核心客户制定专属服务方案",
                    "定期进行客户满意度调研",
                    "安排高层拜访加强合作关系",
                ],
            ))

        # 2. Small customers (<10000) > 50% of total customer count → REGION_EXPANSION priority 2
        small_customer_count = sum(1 for v in customer_sales.values() if v < Decimal("10000"))
        if small_customer_count > len(customer_sales) // 2:
            recommendations.append(_new_recommendation_dict(
                rec_type="REGION_EXPANSION",
                title="发展中大型客户",
                description="小客户占比过高，建议拓展中大型客户",
                priority=2,
                impact="提高客单价，提升运营效率",
                action_items=[
                    "识别潜在中大型客户目标",
                    "制定针对性的销售策略",
                    "安排专人负责大客户开发",
                ],
            ))

    return recommendations


def _generate_recommendations(factory_id: str, range_: DateRange, analysis_type: str | None) -> list[dict]:
    """Mirror RecommendationServiceImpl.generateRecommendations (Java line 463-491).

    Sort by priority ASC (lower priority value = higher priority).
    """
    recs: list[dict] = []
    type_lc = (analysis_type or "all").lower()
    if type_lc == "sales":
        recs.extend(_generate_sales_recommendations(factory_id, range_))
    elif type_lc == "finance":
        recs.extend(_generate_cost_recommendations(factory_id, range_))
    elif type_lc == "customer":
        recs.extend(_generate_customer_recommendations(factory_id, range_))
    else:  # "all" or any other value
        recs.extend(_generate_sales_recommendations(factory_id, range_))
        recs.extend(_generate_cost_recommendations(factory_id, range_))
        recs.extend(_generate_customer_recommendations(factory_id, range_))
    recs.sort(key=lambda r: r["priority"])
    return recs


@router.get("/api/mobile/{factory_id}/smart-bi/datasource/list")
async def list_datasources(
    factory_id: str,
    auth: AuthContext = Depends(require_analytics_read),
) -> dict[str, Any]:
    """Java-compatible alias: list active datasources for a factory.

    Uses ``auth.factory_id`` rather than the path ``factory_id`` to match
    dashboard.py's pattern; the auth dependency already enforces
    path-equals-token-factoryId, so the two are equivalent in practice.
    """
    rows = _query_datasources(auth.factory_id)
    return wrap_response(strip_price_for_role(rows, auth.role))


@router.get("/api/mobile/{factory_id}/smart-bi/alerts")
async def get_alerts(
    factory_id: str,
    category: Optional[str] = None,
    auth: AuthContext = Depends(require_analytics_read),
) -> dict[str, Any]:
    """Java-compatible alias: GET /smart-bi/alerts[?category=sales|finance|department].

    Java reference: SmartBIAnalysisController.getAlerts (line 590-617)
    backed by RecommendationServiceImpl.generateSales/Finance/Department/All.

    Default branch (no category) returns aggregator: sales+finance+department
    concatenated and sorted by AlertLevel severity DESC (matches Java line 438-454).
    """
    range_ = DateRange.by_period("month")
    if category == "sales":
        alerts = _generate_sales_alerts(auth.factory_id, range_)
    elif category == "finance":
        alerts = _generate_finance_alerts(auth.factory_id, range_)
    elif category == "department":
        alerts = _generate_department_alerts(auth.factory_id, range_)
    else:
        alerts = _generate_all_alerts(auth.factory_id, range_)
    return wrap_response(strip_price_for_role(alerts, auth.role))


@router.get("/api/mobile/{factory_id}/smart-bi/recommendations")
async def get_recommendations(
    factory_id: str,
    analysisType: Optional[str] = None,
    auth: AuthContext = Depends(require_analytics_read),
) -> dict[str, Any]:
    """Java-compatible alias: GET /smart-bi/recommendations[?analysisType=sales|finance|customer|all].

    Java reference: SmartBIAnalysisController.getRecommendations (line 621-637)
    backed by RecommendationServiceImpl.generateRecommendations.

    analysisType branches:
      - sales: only sales recommendations (product concentration + salesperson variance)
      - finance: only cost recommendations (material cost ratio)
      - customer: only customer recommendations (top 3 + small customer count)
      - all (default): all 3 generators concatenated, sorted by priority ASC
    """
    range_ = DateRange.by_period("month")
    recs = _generate_recommendations(auth.factory_id, range_, analysisType)
    return wrap_response(strip_price_for_role(recs, auth.role))
