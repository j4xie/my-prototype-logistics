"""Tests for ``scripts/etl/validate-restaurant-data-quality.py``.

Synthetic-data unit tests covering:

* N2 / N3 / N4 audit functions — happy / empty / missing-table paths
* derive_overall_status — READY / PARTIAL / EMPTY / SCHEMA_GAP aggregation
* JSON + Markdown output shape
* CLI argument parsing + DSN resolution
* RLS context-setting (``set_config('app.factory_id', ...)`` invoked)
* Connection-failure / asyncpg-missing graceful degrade
* SQL parametric binding (factory_id passed as $1, no string-interpolation)
* 14-chain default list matches V20260511_02 seed
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from unittest.mock import patch

import pytest


# ============================================================
# Module loading — script lives outside the import path (scripts/etl/)
# and contains hyphens, so use importlib.util to load it by file path.
# ============================================================

_SCRIPT_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "scripts"
    / "etl"
    / "validate-restaurant-data-quality.py"
)


def _load_module():
    spec = importlib.util.spec_from_file_location(
        "validate_restaurant_data_quality", _SCRIPT_PATH
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load module from {_SCRIPT_PATH}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["validate_restaurant_data_quality"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def vrdq():
    """Load the script as a module once per test module."""
    return _load_module()


# ============================================================
# Fake asyncpg connection — records SQL + last_args for assertions
# ============================================================


class _FakeConn:
    """Stub for asyncpg.Connection.

    ``fetchrow_responses`` maps a SQL substring → row dict (or None). The
    first substring that matches the SQL gets its response returned. This
    lets a single connection serve multiple audit calls.
    """

    def __init__(
        self,
        *,
        existing_tables=None,
        existing_columns=None,
        fetchrow_responses=None,
        execute_log=None,
    ):
        self.existing_tables = set(existing_tables or [])
        # set of (table, column) tuples
        self.existing_columns = set(existing_columns or [])
        self.fetchrow_responses = fetchrow_responses or {}
        self.execute_log = execute_log if execute_log is not None else []
        self.last_args = None
        self.last_sql = None
        self.set_factory_calls: list[str] = []
        self.closed = False

    async def fetchrow(self, sql, *args):
        self.last_sql = sql
        self.last_args = args

        # information_schema.tables presence check
        if "information_schema.tables" in sql and "WHERE table_schema" in sql:
            table_name = args[0]
            return {"?column?": 1} if table_name in self.existing_tables else None

        # information_schema.columns presence check
        if "information_schema.columns" in sql and "WHERE table_schema" in sql:
            table_name, column_name = args[0], args[1]
            return (
                {"?column?": 1}
                if (table_name, column_name) in self.existing_columns
                else None
            )

        # User-supplied responses (substring match)
        for substring, row in self.fetchrow_responses.items():
            if substring in sql:
                return row

        raise AssertionError(f"unexpected fetchrow SQL: {sql[:120]}")

    async def execute(self, sql, *args):
        self.last_sql = sql
        self.last_args = args
        self.execute_log.append((sql, args))
        # Capture set_config calls so tests can verify RLS context-set.
        if "set_config" in sql and "app.factory_id" in sql:
            if args:
                self.set_factory_calls.append(args[0])
        return "SELECT 1"

    async def close(self):
        self.closed = True


# ============================================================
# DSN resolution + 14-chain default list
# ============================================================


def test_real_factories_list_matches_seed(vrdq):
    """V20260511_02 seeds 14 REAL chains; the script must mirror order exactly."""
    assert len(vrdq.REAL_RESTAURANT_FACTORIES) == 14
    assert vrdq.REAL_RESTAURANT_FACTORIES[0] == "R_ILTEATRO_REAL"
    assert vrdq.REAL_RESTAURANT_FACTORIES[-1] == "R_HUOGUO_GENERIC_REAL"
    assert "R_QINGHUAJIAO_REAL" in vrdq.REAL_RESTAURANT_FACTORIES


def test_resolve_dsn_prod_default_db(vrdq, monkeypatch):
    """--env prod resolves to smartbi_prod_db by default."""
    monkeypatch.delenv("SMARTBI_PG_DB", raising=False)
    monkeypatch.setenv("SMARTBI_PG_HOST", "h")
    monkeypatch.setenv("SMARTBI_PG_USER", "u")
    monkeypatch.setenv("SMARTBI_PG_PASSWORD", "p")
    dsn = vrdq.resolve_dsn("prod", None)
    assert dsn.endswith("/smartbi_prod_db")
    assert "u:p@h" in dsn


def test_resolve_dsn_test_default_db(vrdq, monkeypatch):
    """--env test resolves to smartbi_db (the local test DB name)."""
    monkeypatch.delenv("SMARTBI_PG_DB", raising=False)
    monkeypatch.setenv("SMARTBI_PG_PASSWORD", "")
    dsn = vrdq.resolve_dsn("test", None)
    assert dsn.endswith("/smartbi_db")


def test_resolve_dsn_override_wins(vrdq):
    """--dsn argument bypasses --env entirely."""
    dsn = vrdq.resolve_dsn("prod", "postgres://x:y@h/custom")
    assert dsn == "postgres://x:y@h/custom"


def test_resolve_dsn_invalid_env_raises(vrdq):
    """Defensive: unrecognized env string fails fast."""
    with pytest.raises(ValueError, match="--env"):
        vrdq.resolve_dsn("staging", None)


# ============================================================
# N2 (complaint rate) audit — happy / empty / missing-table
# ============================================================


@pytest.mark.asyncio
async def test_n2_missing_table_returns_marker(vrdq):
    conn = _FakeConn(existing_tables=set())
    result = await vrdq.audit_n2_complaint_data(conn, "R_TEST")
    assert result == {"status": "MISSING_TABLE"}


@pytest.mark.asyncio
async def test_n2_empty_returns_zero_count(vrdq):
    conn = _FakeConn(
        existing_tables={"restaurant_reviews"},
        fetchrow_responses={
            "restaurant_reviews": {
                "row_count": 0,
                "avg_rating": None,
                "complaint_count": 0,
            }
        },
    )
    result = await vrdq.audit_n2_complaint_data(conn, "R_ILTEATRO_REAL")
    assert result["status"] == "EMPTY"
    assert result["row_count"] == 0
    assert result["avg_rating"] is None
    # RLS context was set with the right factory.
    assert conn.set_factory_calls == ["R_ILTEATRO_REAL"]


@pytest.mark.asyncio
async def test_n2_ready_with_real_rating_data(vrdq):
    conn = _FakeConn(
        existing_tables={"restaurant_reviews"},
        fetchrow_responses={
            "restaurant_reviews": {
                "row_count": 142,
                "avg_rating": 4.2,
                "complaint_count": 15,
            }
        },
    )
    result = await vrdq.audit_n2_complaint_data(conn, "R_QINGHUAJIAO_REAL")
    assert result == {
        "status": "READY",
        "row_count": 142,
        "avg_rating": 4.2,
        "complaint_count": 15,
    }


# ============================================================
# N3 (return rate) audit — happy / empty / missing-table / missing-column
# ============================================================


@pytest.mark.asyncio
async def test_n3_missing_table_returns_marker(vrdq):
    conn = _FakeConn(existing_tables=set())
    result = await vrdq.audit_n3_return_data(conn, "R_TEST")
    assert result["status"] == "MISSING_TABLE"
    assert result["missing"] == "fact_pos_item"


@pytest.mark.asyncio
async def test_n3_missing_return_qty_column_returns_marker(vrdq):
    """V20260511_03 not applied → column absent. Distinct from missing-table."""
    conn = _FakeConn(existing_tables={"fact_pos_item"}, existing_columns=set())
    result = await vrdq.audit_n3_return_data(conn, "R_TEST")
    assert result["status"] == "MISSING_TABLE"
    assert result["missing"] == "fact_pos_item.return_qty"
    assert "V20260511_03" in result["remedy"]


@pytest.mark.asyncio
async def test_n3_ready_with_return_events(vrdq):
    conn = _FakeConn(
        existing_tables={"fact_pos_item"},
        existing_columns={("fact_pos_item", "return_qty")},
        fetchrow_responses={
            "FROM fact_pos_item": {
                "fact_pos_item_count": 4500,
                "return_qty_nonzero_rows": 38,
                "total_sales_qty": 10000.0,
                "total_return_qty": 345.0,
            }
        },
    )
    result = await vrdq.audit_n3_return_data(conn, "R_ILTEATRO_REAL")
    assert result["status"] == "READY"
    assert result["fact_pos_item_count"] == 4500
    assert result["return_qty_nonzero_rows"] == 38


@pytest.mark.asyncio
async def test_n3_empty_zero_returns(vrdq):
    """POS rows exist but no returns recorded → EMPTY (endpoint emits null)."""
    conn = _FakeConn(
        existing_tables={"fact_pos_item"},
        existing_columns={("fact_pos_item", "return_qty")},
        fetchrow_responses={
            "FROM fact_pos_item": {
                "fact_pos_item_count": 1000,
                "return_qty_nonzero_rows": 0,
                "total_sales_qty": 5000.0,
                "total_return_qty": 0.0,
            }
        },
    )
    result = await vrdq.audit_n3_return_data(conn, "R_ILTEATRO_REAL")
    assert result["status"] == "EMPTY"


# ============================================================
# N4 (wastage rate) audit
# ============================================================


@pytest.mark.asyncio
async def test_n4_missing_wastage_table(vrdq):
    conn = _FakeConn(existing_tables=set())
    result = await vrdq.audit_n4_wastage_data(conn, "R_TEST")
    assert result["status"] == "MISSING_TABLE"
    assert result["missing"] == "fact_restaurant_wastage"


@pytest.mark.asyncio
async def test_n4_missing_requisition_table(vrdq):
    """Wastage exists but requisition doesn't — denominator unavailable."""
    conn = _FakeConn(existing_tables={"fact_restaurant_wastage"})
    result = await vrdq.audit_n4_wastage_data(conn, "R_TEST")
    assert result["status"] == "MISSING_TABLE"
    assert result["missing"] == "fact_restaurant_requisition"


@pytest.mark.asyncio
async def test_n4_empty_when_zero_wastage_rows(vrdq):
    """14 REAL chains all have wastage_rows=0 — expected EMPTY status."""
    conn = _FakeConn(
        existing_tables={"fact_restaurant_wastage", "fact_restaurant_requisition"},
        fetchrow_responses={
            "fact_restaurant_wastage": {
                "wastage_rows": 0,
                "requisition_rows": 23,
                "total_wastage_cost": 0.0,
                "total_requisition_cost": 5000.0,
            }
        },
    )
    result = await vrdq.audit_n4_wastage_data(conn, "R_ILTEATRO_REAL")
    assert result["status"] == "EMPTY"
    assert result["wastage_rows"] == 0
    assert result["requisition_rows"] == 23


@pytest.mark.asyncio
async def test_n4_ready_when_both_populated(vrdq):
    """Demo chain RES_3101_009 may have wastage rows — expected READY."""
    conn = _FakeConn(
        existing_tables={"fact_restaurant_wastage", "fact_restaurant_requisition"},
        fetchrow_responses={
            "fact_restaurant_wastage": {
                "wastage_rows": 12,
                "requisition_rows": 25,
                "total_wastage_cost": 1500.0,
                "total_requisition_cost": 5000.0,
            }
        },
    )
    result = await vrdq.audit_n4_wastage_data(conn, "RES_3101_009")
    assert result["status"] == "READY"


# ============================================================
# Overall status aggregation
# ============================================================


def test_derive_overall_schema_gap_when_any_missing(vrdq):
    r = vrdq.FactoryResult(factory_id="R_TEST")
    r.n2_complaints = {"status": "MISSING_TABLE"}
    r.n3_returns = {"status": "READY"}
    r.n4_wastage = {"status": "EMPTY"}
    assert vrdq.derive_overall_status(r) == "SCHEMA_GAP"


def test_derive_overall_ready_when_all_ready(vrdq):
    r = vrdq.FactoryResult(factory_id="R_TEST")
    r.n2_complaints = {"status": "READY"}
    r.n3_returns = {"status": "READY"}
    r.n4_wastage = {"status": "READY"}
    assert vrdq.derive_overall_status(r) == "READY"


def test_derive_overall_partial_when_mixed(vrdq):
    r = vrdq.FactoryResult(factory_id="R_TEST")
    r.n2_complaints = {"status": "EMPTY"}
    r.n3_returns = {"status": "READY"}
    r.n4_wastage = {"status": "EMPTY"}
    assert vrdq.derive_overall_status(r) == "PARTIAL"


def test_derive_overall_empty_when_no_ready(vrdq):
    r = vrdq.FactoryResult(factory_id="R_TEST")
    r.n2_complaints = {"status": "EMPTY"}
    r.n3_returns = {"status": "EMPTY"}
    r.n4_wastage = {"status": "EMPTY"}
    assert vrdq.derive_overall_status(r) == "EMPTY"


# ============================================================
# Top-level orchestrator + JSON/Markdown render
# ============================================================


@pytest.mark.asyncio
async def test_audit_one_factory_catches_exception(vrdq):
    """A query exception is captured in result.error, not raised to caller."""

    class _BoomConn:
        async def fetchrow(self, sql, *args):
            raise RuntimeError("simulated DB hiccup")

        async def execute(self, sql, *args):
            return "SELECT 1"

    result = await vrdq.audit_one_factory(_BoomConn(), "R_ILTEATRO_REAL")
    assert result.overall == "ERROR"
    assert "simulated DB hiccup" in (result.error or "")


def test_render_json_includes_summary_counts(vrdq):
    r1 = vrdq.FactoryResult(
        factory_id="A",
        n2_complaints={"status": "READY"},
        n3_returns={"status": "READY"},
        n4_wastage={"status": "EMPTY"},
        overall="PARTIAL",
    )
    r2 = vrdq.FactoryResult(
        factory_id="B",
        n2_complaints={"status": "EMPTY"},
        n3_returns={"status": "READY"},
        n4_wastage={"status": "EMPTY"},
        overall="PARTIAL",
    )
    payload = vrdq.render_json([r1, r2], env="test", db="smartbi_db")
    assert payload["env"] == "test"
    assert payload["database"] == "smartbi_db"
    assert payload["factory_count"] == 2
    assert payload["summary"]["n3_ready_count"] == 2
    assert payload["summary"]["n2_ready_count"] == 1
    assert payload["summary"]["by_overall_status"] == {"PARTIAL": 2}


def test_render_markdown_contains_factory_rows(vrdq):
    r = vrdq.FactoryResult(
        factory_id="R_QINGHUAJIAO_REAL",
        n2_complaints={"status": "READY"},
        n3_returns={"status": "READY"},
        n4_wastage={"status": "EMPTY"},
        overall="PARTIAL",
    )
    payload = vrdq.render_json([r], env="prod", db="smartbi_prod_db")
    md = vrdq.render_markdown(payload)
    assert "# Restaurant N1-N4 Data Readiness Audit" in md
    assert "`R_QINGHUAJIAO_REAL`" in md
    assert "**PARTIAL**" in md
    assert "smartbi_prod_db" in md


# ============================================================
# CLI argument parser
# ============================================================


def test_cli_parser_defaults_to_local_env(vrdq):
    parser = vrdq.build_arg_parser()
    args = parser.parse_args([])
    assert args.env == "local"
    assert args.dsn is None
    assert args.output is None
    assert args.markdown is None


def test_cli_parser_accepts_all_args(vrdq):
    parser = vrdq.build_arg_parser()
    args = parser.parse_args(
        [
            "--env", "prod",
            "--output", "/tmp/out.json",
            "--markdown", "/tmp/out.md",
            "--factories", "F1,F2,F3",
        ]
    )
    assert args.env == "prod"
    assert args.output == "/tmp/out.json"
    assert args.markdown == "/tmp/out.md"
    assert args.factories == "F1,F2,F3"


def test_cli_parser_rejects_invalid_env(vrdq):
    parser = vrdq.build_arg_parser()
    with pytest.raises(SystemExit):
        parser.parse_args(["--env", "staging"])


# ============================================================
# SQL parametric binding — factory_id passed via $1, not interpolated
# ============================================================


@pytest.mark.asyncio
async def test_n3_passes_factory_id_via_parameter(vrdq):
    """SQL must use $1 placeholder, not f-string interpolation (anti-injection)."""
    conn = _FakeConn(
        existing_tables={"fact_pos_item"},
        existing_columns={("fact_pos_item", "return_qty")},
        fetchrow_responses={
            "FROM fact_pos_item": {
                "fact_pos_item_count": 1, "return_qty_nonzero_rows": 1,
                "total_sales_qty": 1.0, "total_return_qty": 1.0,
            }
        },
    )
    await vrdq.audit_n3_return_data(conn, "R_TEST_FACTORY")
    # The last fetchrow on the audit query bound factory_id as $1.
    assert conn.last_args == ("R_TEST_FACTORY",)
    assert "$1" in conn.last_sql


@pytest.mark.asyncio
async def test_set_factory_context_uses_parameterized_setting(vrdq):
    """``SET app.factory_id`` must use set_config($1) not string-concat."""
    conn = _FakeConn()
    await vrdq._set_factory_context(conn, "R_FOO_REAL")
    assert conn.execute_log
    last_sql, last_args = conn.execute_log[-1]
    assert "set_config" in last_sql
    assert last_args == ("R_FOO_REAL",)


@pytest.mark.asyncio
async def test_set_factory_context_rejects_none(vrdq):
    """Rule 6 precondition — None factory_id raises rather than silently set NULL."""
    conn = _FakeConn()
    with pytest.raises(ValueError, match="factory_id required"):
        await vrdq._set_factory_context(conn, None)


# ============================================================
# Multi-factory orchestration
# ============================================================


@pytest.mark.asyncio
async def test_audit_all_factories_sequential_invocation(vrdq):
    """Each factory_id passed once, in order."""
    conn = _FakeConn(
        existing_tables={
            "restaurant_reviews",
            "fact_pos_item",
            "fact_restaurant_wastage",
            "fact_restaurant_requisition",
        },
        existing_columns={("fact_pos_item", "return_qty")},
        fetchrow_responses={
            "restaurant_reviews": {
                "row_count": 0, "avg_rating": None, "complaint_count": 0,
            },
            "FROM fact_pos_item": {
                "fact_pos_item_count": 0, "return_qty_nonzero_rows": 0,
                "total_sales_qty": 0.0, "total_return_qty": 0.0,
            },
            "fact_restaurant_wastage": {
                "wastage_rows": 0, "requisition_rows": 0,
                "total_wastage_cost": 0.0, "total_requisition_cost": 0.0,
            },
        },
    )
    results = await vrdq.audit_all_factories(conn, ["F1", "F2", "F3"])
    assert [r.factory_id for r in results] == ["F1", "F2", "F3"]
    # set_factory_context was called once per factory per metric (N2/N3/N4 = 3),
    # so 3 factories × 3 metrics = 9 invocations.
    assert len(conn.set_factory_calls) == 9
    # All overall verdicts are EMPTY for these synthetic zero-row mocks.
    assert all(r.overall == "EMPTY" for r in results)
