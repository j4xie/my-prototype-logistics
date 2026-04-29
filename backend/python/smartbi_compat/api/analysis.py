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

from smartbi_compat.alert_thresholds import ALERT_SEVERITY, load_thresholds
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


def _query_finance_data(factory_id: str, range_) -> list:
    """Mirror SmartBiFinanceDataRepository.findByFactoryIdAndRecordDateBetween.

    Returns rows with columns needed by the finance generator: customer_name,
    receivable_amount, aging_days, budget_amount, actual_amount.
    """
    from smartbi.database.connection import get_db_context, is_postgres_enabled

    if not is_postgres_enabled():
        logger.warning(
            "alerts/finance: postgres not enabled; returning [] (factory_id=%s)",
            factory_id,
        )
        return []

    sql = text(
        "SELECT customer_name, receivable_amount, aging_days, "
        "       budget_amount, actual_amount "
        "FROM smart_bi_finance_data "
        "WHERE factory_id = :fid AND record_date BETWEEN :start AND :end"
    )
    with get_db_context() as db:
        return db.execute(
            sql,
            {"fid": factory_id, "start": range_.start_date, "end": range_.end_date},
        ).all()


def _query_department_data(factory_id: str, range_) -> list:
    """Mirror SmartBiDepartmentDataRepository.findByFactoryIdAndRecordDateBetween."""
    from smartbi.database.connection import get_db_context, is_postgres_enabled

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
                message=f"客户 {d.customer_name} 应收款 {receivable:.2f} 元已逾期 {aging} 天",
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
                message=f"客户 {d.customer_name} 应收款 {receivable:.2f} 元账龄已达 {aging} 天",
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
                message=f"实际支出超预算 {variance:.1f}%，需严格控制",
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
                message=f"实际支出超预算 {variance:.1f}%，需关注",
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
            message=f"应收账款总额达 {total_receivable:.2f} 元，资金压力大",
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
            message=f"应收账款总额达 {total_receivable:.2f} 元，需关注回款",
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
                message=f"{dept_name} 人均销售额仅为 {per_capita:.2f} 元，严重低于标准",
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
                message=f"{dept_name} 人均销售额为 {per_capita:.2f} 元，低于期望",
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
    return wrap_response(alerts)
