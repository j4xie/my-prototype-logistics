"""Phase 2B-final analysis.py pilot — 4 list endpoint backfill.

Covers ``backend/python/smartbi_compat/api/analysis.py``:

* ``GET /query-templates`` (line 127) — list saved query templates
* ``GET /datasource/list`` (line 931) — list active datasources
* ``GET /alerts`` (line 946) — sales/finance/department/all alerts
* ``GET /recommendations`` (line 972) — sales/finance/customer/all recs

Test pattern mirrors ``test_config_thresholds_pilot.py`` (gold standard, 41 tests)
+ ``test_dashboard_composite_pilot.py`` (42 tests) — TestClient + JWT for endpoint
contract, monkeypatch on module-level seam functions (``_query_*``) for helper
unit tests.

Rules in scope per ``.claude/rules/python-java-port.md``:

* Rule 1 — ``Decimal("0")`` not silently skipped (truthy-check trap)
* Rule 4 — ``_decimal_to_number`` makes value/threshold render as JSON number
* Rule 6 — DateRange.by_period rejects unsupported periods (NotImplementedError)
* Rule 9 — Lombok @Data DTOs emit null fields; field order matches Java
* Rule 11 — ``_java_isoformat`` mirrors Jackson μs trim on LocalDateTime
* Rule 12 — ``_format_decimal_half_up`` for HALF_UP display (vs banker's)

Spec: ``docs/qa-audits/2026-05-12-python-migration-test-coverage-audit.md`` §2.5
"""
from __future__ import annotations

import os
from datetime import date, datetime
from decimal import Decimal
from types import SimpleNamespace

import jwt
import pytest

# Must be set BEFORE importing analysis (auth module reads at decode time).
os.environ.setdefault("JWT_SECRET", "phase-2b-final-analysis-py-pilot-secret")

from smartbi_compat.api import analysis  # noqa: E402
from smartbi_compat.auth import JWT_ALGORITHM  # noqa: E402
from smartbi_compat.date_range import DateRange  # noqa: E402

# Phase 2B endpoint coverage gate markers (see conftest.py KNOWN_ENDPOINTS).
# Note: query-templates uses ``analysis_query_templates_list`` (plus the 3 write
# ops live in ``query_templates_write.py``); the read endpoint marker is
# distinct from the write-side markers.
pytestmark = [
    pytest.mark.api_endpoint("analysis_query_templates_list"),
    pytest.mark.api_endpoint("analysis_datasource_list"),
    pytest.mark.api_endpoint("analysis_alerts"),
    pytest.mark.api_endpoint("analysis_recommendations"),
]


JWT_SECRET = "phase-2b-final-analysis-py-pilot-secret"


# ============================================================
# JWT + TestClient fixtures
# ============================================================


def _make_token(
    *,
    user_id: int = 22,
    username: str = "alice",
    factory_id: str | None = "F001",
    role: str = "factory_super_admin",
    exp_offset: int = 3600,
) -> str:
    from time import time

    payload: dict = {
        "userId": user_id,
        "username": username,
        "role": role,
        "exp": int(time()) + exp_offset,
    }
    if factory_id is not None:
        payload["factoryId"] = factory_id
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _auth_header(token: str | None = None, **token_kwargs) -> dict:
    if token is None:
        token = _make_token(**token_kwargs)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def test_client():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    app = FastAPI()
    app.include_router(analysis.router)
    return TestClient(app)


def _fixed_dt(year=2026, month=5, day=12, hour=10, minute=30, second=0, microsecond=150710):
    return datetime(year, month, day, hour, minute, second, microsecond)


# ============================================================
# /query-templates — _row_to_dict shape + endpoint contract
# ============================================================


def test_query_templates_row_to_dict_emits_11_jackson_keys():
    """Rule 9 — Lombok @Data on BaseEntity + SmartBiQueryTemplate emits 11 fields
    in declared order with @JsonInclude default (nulls emitted)."""
    row = SimpleNamespace(
        id="tpl-1",
        factory_id="F001",
        name="My Template",
        category="sales",
        description="desc",
        query_template="SELECT 1",
        parameters={"k": "v"},
        created_at=_fixed_dt(),
        updated_at=_fixed_dt(),
        deleted_at=None,
    )
    d = analysis._row_to_dict(row)
    assert list(d.keys()) == [
        "createdAt", "updatedAt", "deletedAt",
        "id", "factoryId", "name", "category",
        "description", "queryTemplate", "parameters", "deleted",
    ]
    assert d["deleted"] is False  # @Where derived flag
    assert d["deletedAt"] is None


def test_query_templates_row_to_dict_deleted_flag_when_soft_deleted():
    """``deleted`` boolean = (deleted_at != None) per BaseEntity.isDeleted()."""
    row = SimpleNamespace(
        id="tpl-2",
        factory_id="F001",
        name="Soft-Deleted",
        category=None,
        description=None,
        query_template="SELECT 2",
        parameters=None,
        created_at=_fixed_dt(),
        updated_at=_fixed_dt(),
        deleted_at=_fixed_dt(),
    )
    d = analysis._row_to_dict(row)
    assert d["deleted"] is True
    assert d["deletedAt"] is not None


def test_query_templates_row_to_dict_rule11_microsecond_trim():
    """Rule 11 — _java_isoformat strips trailing-zero μs to mirror Jackson."""
    # 150710 → ".15071" (drop trailing 0)
    row = SimpleNamespace(
        id="tpl-3", factory_id="F001", name="x", category=None,
        description=None, query_template="SELECT 1", parameters=None,
        created_at=datetime(2026, 5, 12, 10, 30, 0, 150710),
        updated_at=datetime(2026, 5, 12, 10, 30, 0, 200000),
        deleted_at=None,
    )
    d = analysis._row_to_dict(row)
    assert d["createdAt"] == "2026-05-12T10:30:00.15071"
    assert d["updatedAt"] == "2026-05-12T10:30:00.2"


def test_query_templates_endpoint_happy_path(test_client, monkeypatch):
    """Endpoint wraps _query_templates output in ApiResponse envelope."""
    fake_rows = [
        {"id": "tpl-A", "name": "A", "factoryId": "F001"},
        {"id": "tpl-B", "name": "B", "factoryId": "F001"},
    ]
    monkeypatch.setattr(analysis, "_query_templates", lambda fid: fake_rows)

    r = test_client.get(
        "/api/mobile/F001/smart-bi/query-templates",
        headers=_auth_header(),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"] == fake_rows


def test_query_templates_endpoint_empty_factory_returns_empty_list(
    test_client, monkeypatch
):
    """Boundary — DB returns no rows → endpoint returns ``data: []``."""
    monkeypatch.setattr(analysis, "_query_templates", lambda fid: [])
    r = test_client.get(
        "/api/mobile/F001/smart-bi/query-templates",
        headers=_auth_header(),
    )
    assert r.status_code == 200
    assert r.json()["data"] == []


def test_query_templates_endpoint_missing_jwt_returns_401(test_client):
    r = test_client.get("/api/mobile/F001/smart-bi/query-templates")
    assert r.status_code == 401


def test_query_templates_endpoint_cross_factory_returns_403(test_client):
    """Token has factoryId=F002, URL is F001 → cross-factory denied."""
    r = test_client.get(
        "/api/mobile/F001/smart-bi/query-templates",
        headers=_auth_header(factory_id="F002"),
    )
    assert r.status_code == 403


# ============================================================
# /datasource/list — _datasource_row_to_dict shape + endpoint
# ============================================================


def test_datasource_row_to_dict_emits_17_jackson_keys():
    """Rule 9 — Lombok @Data on BaseEntity + SmartBiDatasource — 17 fields in
    declared order; ``fieldDefinitions`` always [] (lazy @OneToMany never
    loaded by list query); ``deleted`` last (BaseEntity.isDeleted())."""
    row = SimpleNamespace(
        id="ds-1",
        name="Production DB",
        source_type="POSTGRES",
        factory_id="F001",
        schema_version=3,
        last_schema_change=_fixed_dt(),
        description="prod",
        connection_config={"host": "db.local"},
        is_active=True,
        code="DS001",
        refresh_interval=60,
        linked_upload_id="upload-1",
        created_at=_fixed_dt(),
        updated_at=_fixed_dt(),
        deleted_at=None,
    )
    d = analysis._datasource_row_to_dict(row)
    assert list(d.keys()) == [
        "createdAt", "updatedAt", "deletedAt",
        "id", "name", "sourceType", "factoryId",
        "schemaVersion", "lastSchemaChange",
        "description", "connectionConfig",
        "isActive", "code", "refreshInterval",
        "linkedUploadId", "fieldDefinitions", "deleted",
    ]
    assert d["fieldDefinitions"] == []
    assert d["deleted"] is False


def test_datasource_row_to_dict_emits_null_optional_fields():
    """Rule 9.2 — Lombok @Data without @JsonInclude(NON_NULL) emits null fields
    explicitly (description / connectionConfig / linkedUploadId nullable)."""
    row = SimpleNamespace(
        id="ds-2", name="Minimal", source_type="MYSQL", factory_id="F001",
        schema_version=1, last_schema_change=None,
        description=None, connection_config=None,
        is_active=True, code="DS002", refresh_interval=None,
        linked_upload_id=None,
        created_at=_fixed_dt(), updated_at=_fixed_dt(), deleted_at=None,
    )
    d = analysis._datasource_row_to_dict(row)
    assert d["description"] is None
    assert d["connectionConfig"] is None
    assert d["linkedUploadId"] is None
    assert d["lastSchemaChange"] is None  # Rule 11: _java_isoformat(None) → None


def test_datasource_endpoint_happy_path(test_client, monkeypatch):
    fake_rows = [{"id": "ds-A", "name": "A", "isActive": True}]
    monkeypatch.setattr(analysis, "_query_datasources", lambda fid: fake_rows)

    r = test_client.get(
        "/api/mobile/F001/smart-bi/datasource/list",
        headers=_auth_header(),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"] == fake_rows


def test_datasource_endpoint_empty_returns_empty_list(test_client, monkeypatch):
    monkeypatch.setattr(analysis, "_query_datasources", lambda fid: [])
    r = test_client.get(
        "/api/mobile/F001/smart-bi/datasource/list",
        headers=_auth_header(),
    )
    assert r.status_code == 200
    assert r.json()["data"] == []


def test_datasource_endpoint_missing_jwt_returns_401(test_client):
    r = test_client.get("/api/mobile/F001/smart-bi/datasource/list")
    assert r.status_code == 401


def test_datasource_endpoint_cross_factory_returns_403(test_client):
    r = test_client.get(
        "/api/mobile/F001/smart-bi/datasource/list",
        headers=_auth_header(factory_id="F002"),
    )
    assert r.status_code == 403


# ============================================================
# /alerts — generators + endpoint contract
# ============================================================


def _sales_row(name, amount, target, *, product=None, customer=None,
               order_date=None):
    return SimpleNamespace(
        salesperson_name=name,
        amount=Decimal(str(amount)) if amount is not None else None,
        monthly_target=Decimal(str(target)) if target is not None else None,
        product_category=product,
        customer_name=customer,
        order_date=order_date or date(2026, 5, 12),
    )


def _finance_row(*, customer, receivable, aging, budget=0, actual=0,
                 material=0, labor=0, overhead=0):
    return SimpleNamespace(
        customer_name=customer,
        receivable_amount=Decimal(str(receivable)),
        aging_days=aging,
        budget_amount=Decimal(str(budget)),
        actual_amount=Decimal(str(actual)),
        material_cost=Decimal(str(material)),
        labor_cost=Decimal(str(labor)),
        overhead_cost=Decimal(str(overhead)),
    )


def _dept_row(department, sales, headcount):
    return SimpleNamespace(
        department=department,
        sales_amount=Decimal(str(sales)),
        headcount=headcount,
    )


def test_alerts_sales_completion_red_below_60(monkeypatch):
    """completion_rate 50 < 60 (red) → RED ``销售目标严重滞后`` alert."""
    monkeypatch.setattr(
        analysis,
        "_query_sales_data",
        lambda fid, rng: [_sales_row("Alice", 5000, 10000)],
    )
    rng = DateRange(date(2026, 5, 1), date(2026, 5, 31))
    alerts = analysis._generate_sales_alerts("F001", rng)
    # Overall + per-person both RED (50% completion in both contexts)
    overall = [a for a in alerts if a["metric"] == "目标完成率"]
    assert len(overall) == 1
    assert overall[0]["level"] == "RED"
    assert overall[0]["urgent"] is True
    assert overall[0]["category"] == "sales"


def test_alerts_sales_empty_data_returns_empty(monkeypatch):
    """Boundary — empty sales data → no alerts."""
    monkeypatch.setattr(analysis, "_query_sales_data", lambda fid, rng: [])
    rng = DateRange(date(2026, 5, 1), date(2026, 5, 31))
    assert analysis._generate_sales_alerts("F001", rng) == []


def test_alerts_finance_aging_red_over_90_days(monkeypatch):
    """aging > 90 → RED 应收账款严重逾期 alert + Rule 4 value/threshold are numbers."""
    monkeypatch.setattr(
        analysis,
        "_query_finance_data",
        lambda fid, rng: [
            _finance_row(customer="客户A", receivable=10000, aging=120),
        ],
    )
    rng = DateRange(date(2026, 5, 1), date(2026, 5, 31))
    alerts = analysis._generate_finance_alerts("F001", rng)
    aging_alerts = [a for a in alerts if a["metric"] == "账龄天数"]
    assert len(aging_alerts) == 1
    a = aging_alerts[0]
    assert a["level"] == "RED"
    # Rule 4 — Decimal serialization makes value/threshold render as JSON number.
    assert isinstance(a["value"], int)
    assert a["value"] == 120
    assert isinstance(a["threshold"], int)
    assert a["threshold"] == 90


def test_alerts_finance_no_alerts_when_aging_below_yellow(monkeypatch):
    """aging=30 < yellow=60 → no alert emitted (boundary clear-skies)."""
    monkeypatch.setattr(
        analysis,
        "_query_finance_data",
        lambda fid, rng: [
            _finance_row(customer="客户A", receivable=10000, aging=30),
        ],
    )
    rng = DateRange(date(2026, 5, 1), date(2026, 5, 31))
    alerts = analysis._generate_finance_alerts("F001", rng)
    aging_alerts = [a for a in alerts if a["metric"] == "账龄天数"]
    assert aging_alerts == []


def test_alerts_finance_skips_zero_receivable_rule1(monkeypatch):
    """Rule 1 hand-off — receivable<=0 must be filtered (matches Java check)."""
    monkeypatch.setattr(
        analysis,
        "_query_finance_data",
        lambda fid, rng: [
            _finance_row(customer="ZeroBalance", receivable=0, aging=120),
        ],
    )
    rng = DateRange(date(2026, 5, 1), date(2026, 5, 31))
    alerts = analysis._generate_finance_alerts("F001", rng)
    assert [a for a in alerts if a["metric"] == "账龄天数"] == []


def test_alerts_department_per_capita_red(monkeypatch):
    """per_capita 5000 < red 50000 → RED dept alert."""
    monkeypatch.setattr(
        analysis,
        "_query_department_data",
        lambda fid, rng: [_dept_row("生产部", 50000, 10)],  # 5000/head
    )
    rng = DateRange(date(2026, 5, 1), date(2026, 5, 31))
    alerts = analysis._generate_department_alerts("F001", rng)
    assert len(alerts) == 1
    assert alerts[0]["level"] == "RED"
    assert "生产部" in alerts[0]["title"]


def test_alerts_all_branch_sorts_by_severity_desc(monkeypatch):
    """default branch (no category) → all alerts sorted RED>YELLOW>... per Java."""
    # 1 RED sales + 1 YELLOW finance
    monkeypatch.setattr(
        analysis,
        "_query_sales_data",
        lambda fid, rng: [_sales_row("Alice", 5000, 10000)],  # 50% red
    )
    monkeypatch.setattr(
        analysis,
        "_query_finance_data",
        lambda fid, rng: [
            _finance_row(customer="C", receivable=10000, aging=75),  # yellow
        ],
    )
    monkeypatch.setattr(analysis, "_query_department_data", lambda fid, rng: [])
    rng = DateRange(date(2026, 5, 1), date(2026, 5, 31))
    alerts = analysis._generate_all_alerts("F001", rng)
    levels = [a["level"] for a in alerts]
    # RED must come before YELLOW
    assert levels[0] == "RED"
    if "YELLOW" in levels:
        assert levels.index("RED") < levels.index("YELLOW")


def test_alerts_endpoint_returns_envelope(test_client, monkeypatch):
    """Endpoint default (no category) wraps _generate_all_alerts in envelope."""
    fake_alerts = [{"id": "a-1", "level": "RED", "category": "sales"}]
    monkeypatch.setattr(
        analysis, "_generate_all_alerts", lambda fid, rng: fake_alerts
    )
    r = test_client.get(
        "/api/mobile/F001/smart-bi/alerts",
        headers=_auth_header(),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"] == fake_alerts


def test_alerts_endpoint_category_sales_branch(test_client, monkeypatch):
    """?category=sales → only sales generator called."""
    monkeypatch.setattr(
        analysis, "_generate_sales_alerts", lambda fid, rng: [{"id": "s-1"}]
    )

    def _explode(*_a, **_kw):
        raise AssertionError("non-sales generator must not be called")

    monkeypatch.setattr(analysis, "_generate_finance_alerts", _explode)
    monkeypatch.setattr(analysis, "_generate_department_alerts", _explode)
    monkeypatch.setattr(analysis, "_generate_all_alerts", _explode)

    r = test_client.get(
        "/api/mobile/F001/smart-bi/alerts?category=sales",
        headers=_auth_header(),
    )
    assert r.status_code == 200
    assert r.json()["data"] == [{"id": "s-1"}]


def test_alerts_endpoint_missing_jwt_returns_401(test_client):
    r = test_client.get("/api/mobile/F001/smart-bi/alerts")
    assert r.status_code == 401


def test_alerts_endpoint_cross_factory_returns_403(test_client):
    r = test_client.get(
        "/api/mobile/F001/smart-bi/alerts",
        headers=_auth_header(factory_id="F002"),
    )
    assert r.status_code == 403


def test_alerts_new_alert_dict_has_15_keys_jackson_order():
    """Rule 9 — Alert.java Lombok @Data: 13 fields + 2 derived (levelName, urgent).
    Jackson order: 13 declared → levelName → urgent."""
    d = analysis._new_alert_dict(
        level="RED",
        category="sales",
        title="t",
        message="m",
        metric="目标完成率",
        value=Decimal("50"),
        threshold=Decimal("60"),
        suggestion="s",
    )
    assert list(d.keys()) == [
        "id", "level", "category", "title", "message", "metric",
        "value", "threshold", "gapPercent", "suggestion",
        "relatedEntityId", "relatedEntityName", "createdAt",
        "levelName", "urgent",
    ]
    # AlertLevel.needsAction() — RED + CRITICAL urgent
    assert d["urgent"] is True


def test_alerts_new_alert_dict_urgent_false_for_yellow():
    d = analysis._new_alert_dict(
        level="YELLOW", category="sales", title="t", message="m",
        metric="x", value=Decimal("1"), threshold=Decimal("2"), suggestion="s",
    )
    assert d["urgent"] is False


# ============================================================
# /recommendations — generators + endpoint contract
# ============================================================


def test_recommendations_new_dict_has_13_keys_jackson_order():
    """Rule 9 — Recommendation.java Lombok @Data: 11 declared + 2 derived
    (typeName, highPriority). Jackson order: 11 declared → typeName → highPriority."""
    d = analysis._new_recommendation_dict(
        rec_type="SALES_IMPROVEMENT",
        title="t",
        description="d",
        priority=1,
        impact="i",
        action_items=["a"],
    )
    assert list(d.keys()) == [
        "id", "type", "title", "description", "priority", "impact",
        "actionItems", "relatedData", "targetId", "targetName",
        "createdAt", "typeName", "highPriority",
    ]
    # priority <= 2 → highPriority True
    assert d["highPriority"] is True
    assert d["typeName"] == "销售提升"
    # relatedData defaults to {} (never None — matches Java line 743)
    assert d["relatedData"] == {}


def test_recommendations_new_dict_low_priority_flag():
    d = analysis._new_recommendation_dict(
        rec_type="OPERATION_OPTIMIZATION",
        title="t", description="d", priority=5, impact="i", action_items=[],
    )
    assert d["highPriority"] is False
    assert d["typeName"] == "运营优化"


def test_recommendations_sales_product_concentration_triggers_focus(monkeypatch):
    """Single product >60% of sales → PRODUCT_FOCUS rec priority 2."""
    monkeypatch.setattr(
        analysis,
        "_query_sales_data",
        lambda fid, rng: [
            _sales_row("Alice", 7000, 0, product="电子产品"),
            _sales_row("Bob", 2000, 0, product="服装"),
            _sales_row("Carol", 1000, 0, product="食品"),
        ],
    )
    rng = DateRange(date(2026, 5, 1), date(2026, 5, 31))
    recs = analysis._generate_sales_recommendations("F001", rng)
    focus = [r for r in recs if r["type"] == "PRODUCT_FOCUS"]
    assert len(focus) == 1
    assert focus[0]["priority"] == 2
    assert focus[0]["typeName"] == "产品聚焦"


def test_recommendations_sales_empty_data_returns_empty(monkeypatch):
    monkeypatch.setattr(analysis, "_query_sales_data", lambda fid, rng: [])
    rng = DateRange(date(2026, 5, 1), date(2026, 5, 31))
    assert analysis._generate_sales_recommendations("F001", rng) == []


def test_recommendations_cost_material_ratio_over_60(monkeypatch):
    """material_cost > 60% of total → COST_REDUCTION rec priority 2."""
    monkeypatch.setattr(
        analysis,
        "_query_finance_data",
        lambda fid, rng: [
            _finance_row(
                customer="c", receivable=0, aging=0,
                material=7000, labor=2000, overhead=1000,  # 70% material
            )
        ],
    )
    rng = DateRange(date(2026, 5, 1), date(2026, 5, 31))
    recs = analysis._generate_cost_recommendations("F001", rng)
    cost_recs = [r for r in recs if r["type"] == "COST_REDUCTION"]
    assert len(cost_recs) == 1
    assert cost_recs[0]["priority"] == 2


def test_recommendations_customer_top3_concentration(monkeypatch):
    """Top 3 customers > 50% of sales → CUSTOMER_RETENTION rec priority 1."""
    monkeypatch.setattr(
        analysis,
        "_query_sales_data",
        lambda fid, rng: [
            _sales_row(None, 5000, 0, customer="客户A"),
            _sales_row(None, 3000, 0, customer="客户B"),
            _sales_row(None, 2000, 0, customer="客户C"),
            _sales_row(None, 100, 0, customer="客户D"),
        ],
    )
    rng = DateRange(date(2026, 5, 1), date(2026, 5, 31))
    recs = analysis._generate_customer_recommendations("F001", rng)
    retention = [r for r in recs if r["type"] == "CUSTOMER_RETENTION"]
    assert len(retention) == 1
    assert retention[0]["priority"] == 1
    assert retention[0]["highPriority"] is True


def test_recommendations_all_branch_sorts_by_priority_asc(monkeypatch):
    """Default branch concatenates 3 generators + sorts by priority ASC."""
    monkeypatch.setattr(
        analysis,
        "_query_sales_data",
        lambda fid, rng: [
            _sales_row("Alice", 7000, 0, product="x", customer="客户A"),
            _sales_row("Bob", 2000, 0, product="x", customer="客户B"),
            _sales_row("Carol", 1000, 0, product="x", customer="客户C"),
        ],
    )
    monkeypatch.setattr(
        analysis, "_query_finance_data", lambda fid, rng: []
    )
    rng = DateRange(date(2026, 5, 1), date(2026, 5, 31))
    recs = analysis._generate_recommendations("F001", rng, "all")
    priorities = [r["priority"] for r in recs]
    assert priorities == sorted(priorities)


def test_recommendations_endpoint_returns_envelope(test_client, monkeypatch):
    fake_recs = [{"id": "r-1", "type": "SALES_IMPROVEMENT", "priority": 1}]
    monkeypatch.setattr(
        analysis,
        "_generate_recommendations",
        lambda fid, rng, atype: fake_recs,
    )
    r = test_client.get(
        "/api/mobile/F001/smart-bi/recommendations",
        headers=_auth_header(),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"] == fake_recs


def test_recommendations_endpoint_passes_analysis_type(test_client, monkeypatch):
    """?analysisType=sales → forwarded to _generate_recommendations."""
    received: dict = {}

    def _fake(fid, rng, atype):
        received["fid"] = fid
        received["atype"] = atype
        return []

    monkeypatch.setattr(analysis, "_generate_recommendations", _fake)
    r = test_client.get(
        "/api/mobile/F001/smart-bi/recommendations?analysisType=sales",
        headers=_auth_header(),
    )
    assert r.status_code == 200
    assert received["fid"] == "F001"
    assert received["atype"] == "sales"


def test_recommendations_endpoint_missing_jwt_returns_401(test_client):
    r = test_client.get("/api/mobile/F001/smart-bi/recommendations")
    assert r.status_code == 401


def test_recommendations_endpoint_cross_factory_returns_403(test_client):
    r = test_client.get(
        "/api/mobile/F001/smart-bi/recommendations",
        headers=_auth_header(factory_id="F002"),
    )
    assert r.status_code == 403


# ============================================================
# Cross-cutting Rules — _calculate_rate / _calculate_growth_rate (Rule 10)
# ============================================================


def test_calculate_rate_zero_denominator_returns_zero():
    """Division-by-zero guard mirrors Java early return."""
    assert analysis._calculate_rate(Decimal("100"), Decimal("0")) == Decimal("0")


def test_calculate_rate_rule10_intermediate_quantize_1_over_3():
    """Rule 10 — Java: BigDecimal.ONE.divide(THREE, 4, HALF_UP).multiply(100)
    = 0.3333 * 100 = 33.3300 (not 33.3333... as Python's naive *100/quantize)."""
    result = analysis._calculate_rate(Decimal("1"), Decimal("3"))
    # _SCALE_4 quantize, then *100 → "33.3300"
    assert result == Decimal("33.3300")


def test_calculate_growth_rate_zero_previous_returns_zero():
    assert analysis._calculate_growth_rate(Decimal("100"), Decimal("0")) == Decimal("0")


def test_calculate_growth_rate_positive_growth():
    """current=150, previous=100 → (50/100).quantize(4) * 100 = 50.0000."""
    result = analysis._calculate_growth_rate(Decimal("150"), Decimal("100"))
    assert result == Decimal("50.0000")


# ============================================================
# DateRange month boundaries — Rule 6 unsupported period
# ============================================================


def test_date_range_by_period_rejects_unsupported(monkeypatch):
    """Rule 6 — explicit NotImplementedError beats silent BETWEEN NULL ...
    The /alerts + /recommendations endpoints only call ``by_period('month')``
    today; non-month branches must raise (YAGNI documented in date_range.py)."""
    with pytest.raises(NotImplementedError, match="not yet ported"):
        DateRange.by_period("week")


def test_prev_month_boundary_january_wraps_to_prior_december():
    """_prev_month_start handles year-rollback (Jan 2026 → Dec 2025)."""
    result = analysis._prev_month_start(date(2026, 1, 15))
    assert result == date(2025, 12, 15)


def test_prev_month_end_is_last_day_of_prior_month():
    """_prev_month_end(May 1) = Apr 30 (one day before)."""
    result = analysis._prev_month_end(date(2026, 5, 1))
    assert result == date(2026, 4, 30)
    # Also check Feb 1 → Jan 31
    assert analysis._prev_month_end(date(2026, 2, 1)) == date(2026, 1, 31)
