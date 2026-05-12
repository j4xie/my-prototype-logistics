"""Tests for scripts/parity-gate/ compare harness.

Covers:

* dict_eq_match algorithm — Pattern A int-collapse tolerance, REAL_BUG
  classification, volatile-key stripping, nested dicts/lists, type
  mismatches, numeric eq edge cases (bool guard, Decimal/float/int interop).
* endpoint_list parser — preset format + spec-doc auto-extract + error
  cases.
* mock_data_generator — output is deterministic + valid SQL syntax +
  contains expected edge cases.
* CLI ``compare.py`` — args parse, fixtures mode, gate exit codes.
* fetch_endpoint — network errors surface as ``verdict="network_error"``
  rather than silently swallowed.

Layout: parity-gate code lives in ``scripts/parity-gate/`` (kebab-case
dir). We add it to ``sys.path`` so individual modules import cleanly.
"""
from __future__ import annotations

import json
import os
import sys
from decimal import Decimal
from pathlib import Path

import pytest

# Add scripts/parity-gate/ to sys.path so its modules are importable.
_REPO_ROOT = Path(__file__).resolve().parents[3]
_PARITY_GATE_DIR = _REPO_ROOT / "scripts" / "parity-gate"
if str(_PARITY_GATE_DIR) not in sys.path:
    sys.path.insert(0, str(_PARITY_GATE_DIR))

import dict_eq           # noqa: E402
import endpoint_list     # noqa: E402
import fetch_endpoint    # noqa: E402
import mock_data_generator  # noqa: E402
import report            # noqa: E402


# ============================================================
# dict_eq.numeric_eq — leaf-level numeric semantics
# ============================================================


@pytest.mark.parametrize(
    "a,b",
    [
        (100, 100),
        (100, 100.0),
        (100.0, 100),
        (Decimal("100"), 100),
        (Decimal("100.00"), 100),
        (Decimal("100.00"), 100.0),
        (Decimal("99.99"), 99.99),
        (0, 0.0),
        (0, Decimal("0.00")),
        (-5, -5.0),
    ],
)
def test_numeric_eq_pattern_a_match(a, b):
    """Pattern A: same numeric value across int/float/Decimal → match."""
    assert dict_eq.numeric_eq(a, b) is True


@pytest.mark.parametrize(
    "a,b",
    [
        (100, 101),
        (100.0, 99.99),
        (Decimal("100"), Decimal("100.01")),
        (0, 1),
    ],
)
def test_numeric_eq_distinct_values_mismatch(a, b):
    """Different numeric values → not equal."""
    assert dict_eq.numeric_eq(a, b) is False


@pytest.mark.parametrize(
    "a,b,expected",
    [
        (True, 1, False),   # bool guard: True != 1
        (False, 0, False),  # bool guard: False != 0
        (True, True, True),
        (False, False, True),
        (None, 0, False),   # None never equal to a number
        (None, None, True),
        ("100", 100, False),  # str never equal to numeric (already parsed JSON)
    ],
)
def test_numeric_eq_bool_and_none_guards(a, b, expected):
    """Bool/None must not collapse to int(0)/int(1) — distinct JSON types."""
    assert dict_eq.numeric_eq(a, b) is expected


# ============================================================
# dict_eq.strip_volatile
# ============================================================


def test_strip_volatile_removes_top_level():
    """Top-level volatile keys are removed."""
    inp = {"data": {"x": 1}, "generatedAt": "2026-01-01T00:00:00", "timestamp": 42}
    out = dict_eq.strip_volatile(inp)
    assert out == {"data": {"x": 1}}


def test_strip_volatile_removes_nested():
    """Volatile keys at any nesting level are removed."""
    inp = {
        "data": {"inner": {"lastUpdated": "x", "value": 42}},
        "cacheExpireAt": "y",
    }
    out = dict_eq.strip_volatile(inp)
    assert out == {"data": {"inner": {"value": 42}}}


def test_strip_volatile_preserves_lists():
    """Lists are recursed into; non-dict members untouched."""
    inp = {"list": [{"timestamp": 1, "value": 5}, {"value": 6}]}
    out = dict_eq.strip_volatile(inp)
    assert out == {"list": [{"value": 5}, {"value": 6}]}


# ============================================================
# dict_eq.dict_eq_match — happy paths + edge cases
# ============================================================


def test_match_identical_responses():
    """Identical dicts → 100% match, no diverges."""
    a = {"value": 100, "name": "foo", "list": [1, 2, 3]}
    r = dict_eq.dict_eq_match(a, a)
    assert r["match"] is True
    assert r["diverges"] == []
    assert r["tolerated_byte_diffs"] == []
    assert r["matched_leaves"] == r["total_leaves"]


def test_match_pattern_a_int_collapse_tolerated():
    """Java emits 100.0 (float), Python emits 100 (int) — dict-eq MATCH."""
    java = {"value": 100.0}
    py = {"value": 100}
    r = dict_eq.dict_eq_match(java, py)
    assert r["match"] is True
    assert len(r["diverges"]) == 0
    assert len(r["tolerated_byte_diffs"]) == 1
    assert r["tolerated_byte_diffs"][0]["classification"] == dict_eq.PATTERN_A_INT_COLLAPSE
    assert r["tolerated_byte_diffs"][0]["path"] == "value"


def test_match_real_bug_value_mismatch():
    """Different numeric values → REAL_BUG diverge."""
    java = {"value": 100}
    py = {"value": 200}
    r = dict_eq.dict_eq_match(java, py)
    assert r["match"] is False
    assert len(r["diverges"]) == 1
    assert r["diverges"][0]["classification"] == dict_eq.REAL_BUG
    assert r["diverges"][0]["path"] == "value"


def test_match_missing_key_in_python():
    """Java has key python doesn't → REAL_BUG missing."""
    java = {"a": 1, "b": 2}
    py = {"a": 1}
    r = dict_eq.dict_eq_match(java, py)
    assert r["match"] is False
    diverge = [d for d in r["diverges"] if d["path"] == "b"][0]
    assert diverge["python"] == "<missing>"


def test_match_extra_key_in_python():
    """Python has key Java doesn't → REAL_BUG extra."""
    java = {"a": 1}
    py = {"a": 1, "b": 2}
    r = dict_eq.dict_eq_match(java, py)
    assert r["match"] is False
    diverge = [d for d in r["diverges"] if d["path"] == "b"][0]
    assert diverge["java"] == "<missing>"


def test_match_list_length_mismatch():
    """Lists of different length → REAL_BUG."""
    java = {"items": [1, 2, 3]}
    py = {"items": [1, 2]}
    r = dict_eq.dict_eq_match(java, py)
    assert r["match"] is False
    assert "items" in r["diverges"][0]["path"]


def test_match_nested_pattern_a_under_list():
    """Pattern A inside a list element is tolerated."""
    java = {"items": [{"v": 1.0}, {"v": 2.0}]}
    py = {"items": [{"v": 1}, {"v": 2}]}
    r = dict_eq.dict_eq_match(java, py)
    assert r["match"] is True
    assert len(r["tolerated_byte_diffs"]) == 2
    paths = {d["path"] for d in r["tolerated_byte_diffs"]}
    assert paths == {"items[0].v", "items[1].v"}


def test_match_type_mismatch_dict_vs_scalar():
    """One side is dict, other is scalar → REAL_BUG."""
    java = {"data": {"x": 1}}
    py = {"data": 1}
    r = dict_eq.dict_eq_match(java, py)
    assert r["match"] is False
    assert r["diverges"][0]["path"] == "data"
    assert r["diverges"][0]["classification"] == dict_eq.REAL_BUG


def test_match_string_eq():
    """String values compared exactly (no normalization)."""
    java = {"name": "foo"}
    py = {"name": "foo"}
    assert dict_eq.dict_eq_match(java, py)["match"] is True

    py_diff = {"name": "Foo"}
    assert dict_eq.dict_eq_match(java, py_diff)["match"] is False


def test_match_volatile_diffs_ignored():
    """generatedAt diff doesn't break match."""
    java = {"value": 1, "generatedAt": "2026-05-12T10:00:00"}
    py = {"value": 1, "generatedAt": "2026-05-12T11:00:00"}
    assert dict_eq.dict_eq_match(java, py)["match"] is True


def test_match_summarize_format():
    """summarize() returns readable single-line string."""
    java = {"value": 1.0}
    py = {"value": 1}
    r = dict_eq.dict_eq_match(java, py)
    s = dict_eq.summarize(r)
    assert "match=True" in s
    assert "pattern_a=1" in s


# ============================================================
# endpoint_list parser
# ============================================================


def test_endpoint_list_parse_preset(tmp_path):
    """Standard METHOD path?query format."""
    p = tmp_path / "preset.txt"
    p.write_text(
        "GET /api/mobile/{factoryId}/smart-bi/analysis/production?analysisType=oee\n"
        "# comment line\n"
        "\n"
        "POST /api/mobile/{factoryId}/smart-bi/upload\n"
    )
    out = endpoint_list.parse_preset(str(p))
    assert out == [
        ("GET", "/api/mobile/{factoryId}/smart-bi/analysis/production", "analysisType=oee"),
        ("POST", "/api/mobile/{factoryId}/smart-bi/upload", ""),
    ]


def test_endpoint_list_parse_preset_rejects_malformed(tmp_path):
    p = tmp_path / "bad.txt"
    p.write_text("this is not an endpoint line\n")
    with pytest.raises(ValueError, match="malformed"):
        endpoint_list.parse_preset(str(p))


def test_endpoint_list_parse_spec_doc(tmp_path):
    """Auto-extract from markdown — skips non-endpoint lines."""
    p = tmp_path / "spec.md"
    p.write_text(
        "# Some spec\n\n"
        "Normal prose.\n"
        "```\n"
        "GET /api/mobile/{factoryId}/smart-bi/analysis/production?analysisType=oee\n"
        "GET /api/mobile/{factoryId}/smart-bi/analysis/quality?analysisType=fpy\n"
        "GET /api/mobile/{factoryId}/smart-bi/analysis/production?analysisType=oee\n"
        "```\n"
        "More prose.\n"
    )
    out = endpoint_list.parse_spec_doc(str(p))
    # Dedupes the duplicate "production?analysisType=oee" line.
    assert len(out) == 2
    assert out[0][1] == "/api/mobile/{factoryId}/smart-bi/analysis/production"
    assert out[1][1] == "/api/mobile/{factoryId}/smart-bi/analysis/quality"


def test_endpoint_list_auto_parse_dispatches_on_extension(tmp_path):
    md = tmp_path / "x.md"
    md.write_text("GET /api/foo\n")
    assert endpoint_list.auto_parse(str(md)) == [("GET", "/api/foo", "")]
    txt = tmp_path / "x.txt"
    txt.write_text("GET /api/foo\n")
    assert endpoint_list.auto_parse(str(txt)) == [("GET", "/api/foo", "")]


def test_endpoint_list_file_not_found(tmp_path):
    with pytest.raises(FileNotFoundError):
        endpoint_list.parse_preset(str(tmp_path / "nope.txt"))


# ============================================================
# mock_data_generator
# ============================================================


def test_mock_data_generator_deterministic():
    """Same seed → identical SQL output."""
    sql_a = mock_data_generator.generate_sql(seed=42, days=5, txn_per_day=10)
    sql_b = mock_data_generator.generate_sql(seed=42, days=5, txn_per_day=10)
    assert sql_a == sql_b


def test_mock_data_generator_changes_with_seed():
    """Different seed → different SQL (bill_no count maybe same but values differ)."""
    sql_a = mock_data_generator.generate_sql(seed=1, days=2, txn_per_day=5)
    sql_b = mock_data_generator.generate_sql(seed=2, days=2, txn_per_day=5)
    assert sql_a != sql_b


def test_mock_data_generator_basic_structure():
    """SQL has BEGIN/COMMIT, DELETE cleanup, INSERTs for both tables."""
    sql = mock_data_generator.generate_sql(
        factory_id="R_TEST_MOCK", days=2, txn_per_day=3
    )
    assert "BEGIN;" in sql
    assert "COMMIT;" in sql
    assert "DELETE FROM dim_store" in sql
    assert "DELETE FROM fact_pos_transaction" in sql
    assert "INSERT INTO dim_store" in sql
    assert "INSERT INTO fact_pos_transaction" in sql
    assert "R_TEST_MOCK" in sql


def test_mock_data_generator_scale_count():
    """3 stores, 5 days, 10 txn/day, store 0 empty, 1 skip day:
       (3 - 1) stores × (5 - 1) days × 10 txn/day = 80 transactions.
    """
    sql = mock_data_generator.generate_sql(
        factory_id="R_TEST_MOCK", n_stores=3, days=5, txn_per_day=10, seed=1
    )
    # Count MOCK-NNNNNNNN bill numbers — each transaction has unique one.
    import re
    bill_nos = re.findall(r"MOCK-\d{8}", sql)
    # set() to dedupe (each appears once per VALUES tuple).
    assert len(set(bill_nos)) == 80


def test_mock_data_generator_includes_null_table_no():
    """~5% of rows have NULL table_no — at large scale this is non-zero."""
    sql = mock_data_generator.generate_sql(
        factory_id="R_TEST_MOCK", n_stores=3, days=10, txn_per_day=20, seed=42
    )
    # 'NULL' as VALUES literal for table_no should appear at least once.
    assert sql.count(", NULL,") > 0   # NULL appears between commas in VALUES


def test_mock_data_generator_include_items_flag():
    """--include-items produces fact_pos_item rows; default off."""
    sql_no_items = mock_data_generator.generate_sql(days=2, txn_per_day=3)
    assert "fact_pos_item" not in sql_no_items or "DELETE FROM fact_pos_item" in sql_no_items
    # The DELETE always emits — check INSERT
    assert "INSERT INTO fact_pos_item" not in sql_no_items

    sql_with_items = mock_data_generator.generate_sql(
        days=2, txn_per_day=3, include_items=True
    )
    assert "INSERT INTO fact_pos_item" in sql_with_items


def test_mock_data_generator_write_to_disk(tmp_path):
    """write_mock_sql writes to <factory>/<timestamp>/seed.sql."""
    path = mock_data_generator.write_mock_sql(
        output_dir=str(tmp_path),
        factory_id="R_TEST_MOCK",
        timestamp="20260512_000000",
        days=2,
        txn_per_day=3,
    )
    assert path.is_file()
    assert path.name == "seed.sql"
    assert "R_TEST_MOCK" in str(path)
    assert "20260512_000000" in str(path)
    content = path.read_text(encoding="utf-8")
    assert content.startswith("-- Mock parity-gate seed")


# ============================================================
# fetch_endpoint — network failure surfaces as verdict, not exception swallow
# ============================================================


def test_fetch_endpoint_connection_refused_returns_network_error_verdict():
    """Real connection refused should produce verdict='network_error' with non-empty .error."""
    # Use a definitely-closed port on localhost — fast and reliable failure.
    result = fetch_endpoint.fetch_endpoint(
        base_url="http://127.0.0.1:1",  # unreachable; reserved port
        path="/test",
        factory_id="F001",
        token="dummy-token",
        timeout=2,
    )
    assert result["verdict"] == "network_error"
    assert result["http"] == -1
    assert result["data"] is None
    assert result["error"] is not None


def test_fetch_endpoint_jwt_required():
    """Without JWT_SECRET, make_jwt_token raises RuntimeError immediately."""
    # Temporarily unset the env var.
    saved = os.environ.pop("JWT_SECRET", None)
    try:
        with pytest.raises(RuntimeError, match="JWT_SECRET missing"):
            fetch_endpoint.make_jwt_token("F001")
    finally:
        if saved is not None:
            os.environ["JWT_SECRET"] = saved


def test_fetch_endpoint_jwt_token_shape():
    """JWT token has 3 dot-separated base64 parts."""
    saved = os.environ.get("JWT_SECRET")
    os.environ["JWT_SECRET"] = "test-secret"
    try:
        tok = fetch_endpoint.make_jwt_token("R_TEST_MOCK")
        parts = tok.split(".")
        assert len(parts) == 3
    finally:
        if saved is None:
            os.environ.pop("JWT_SECRET", None)
        else:
            os.environ["JWT_SECRET"] = saved


# ============================================================
# compare.py CLI — fixtures mode (no HTTP)
# ============================================================


def _write_fixture(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def test_compare_cli_fixtures_mode_match(tmp_path, capsys):
    """Run --fixtures-java + --fixtures-python end-to-end. Identical → exit 0."""
    import compare  # late import (sys.path is set above)

    java_fix = tmp_path / "java.json"
    py_fix = tmp_path / "py.json"
    _write_fixture(java_fix, {"data": {"value": 100, "name": "test"}, "success": True})
    _write_fixture(py_fix, {"data": {"value": 100, "name": "test"}, "success": True})

    out_json = tmp_path / "report.json"

    rc = compare.main([
        "--factory", "R_TEST_MOCK",
        "--endpoint", "/api/test",
        "--fixtures-java", str(java_fix),
        "--fixtures-python", str(py_fix),
        "--output", str(out_json),
    ])
    assert rc == 0
    report_data = json.loads(out_json.read_text(encoding="utf-8"))
    assert report_data["match_rate"] == 100.0
    assert report_data["endpoints_matched"] == 1


def test_compare_cli_fixtures_mode_pattern_a_still_matches(tmp_path):
    """Pattern A int-collapse → still matches (rate = 100%, byte_diffs tracked)."""
    import compare

    java_fix = tmp_path / "java.json"
    py_fix = tmp_path / "py.json"
    _write_fixture(java_fix, {"data": {"value": 100.0, "rate": 99.99}, "success": True})
    _write_fixture(py_fix, {"data": {"value": 100, "rate": 99.99}, "success": True})

    out_json = tmp_path / "report.json"
    rc = compare.main([
        "--factory", "R_TEST_MOCK",
        "--endpoint", "/api/test",
        "--fixtures-java", str(java_fix),
        "--fixtures-python", str(py_fix),
        "--output", str(out_json),
    ])
    assert rc == 0
    report_data = json.loads(out_json.read_text(encoding="utf-8"))
    assert report_data["match_rate"] == 100.0
    assert report_data["total_pattern_a"] == 1  # value: 100.0 vs 100
    assert report_data["total_real_bugs"] == 0


def test_compare_cli_fixtures_mode_real_bug_fails_gate(tmp_path):
    """REAL_BUG diverge → match_rate < 99.945 → exit 1."""
    import compare

    java_fix = tmp_path / "java.json"
    py_fix = tmp_path / "py.json"
    _write_fixture(java_fix, {"data": {"value": 100}})
    _write_fixture(py_fix, {"data": {"value": 200}})  # REAL_BUG

    out_json = tmp_path / "report.json"
    rc = compare.main([
        "--factory", "R_TEST_MOCK",
        "--endpoint", "/api/test",
        "--fixtures-java", str(java_fix),
        "--fixtures-python", str(py_fix),
        "--output", str(out_json),
    ])
    assert rc == 1   # GATE FAIL
    report_data = json.loads(out_json.read_text(encoding="utf-8"))
    assert report_data["match_rate"] == 0.0
    assert report_data["total_real_bugs"] == 1


def test_compare_cli_writes_html_sibling(tmp_path):
    """--output report.json also writes report.html alongside."""
    import compare

    java_fix = tmp_path / "java.json"
    py_fix = tmp_path / "py.json"
    _write_fixture(java_fix, {"x": 1})
    _write_fixture(py_fix, {"x": 1})

    out_json = tmp_path / "r.json"
    compare.main([
        "--factory", "R_TEST_MOCK",
        "--endpoint", "/api/test",
        "--fixtures-java", str(java_fix),
        "--fixtures-python", str(py_fix),
        "--output", str(out_json),
    ])
    assert (tmp_path / "r.html").is_file()
    html_text = (tmp_path / "r.html").read_text(encoding="utf-8")
    assert "Parity Gate Report" in html_text
    assert "R_TEST_MOCK" in html_text


def test_compare_cli_requires_endpoint_or_list():
    """Without --endpoint or --endpoint-list, exit non-zero."""
    import compare
    with pytest.raises(SystemExit):
        compare.main(["--factory", "R_TEST"])


def test_compare_cli_fixtures_mismatch_fails():
    """Passing only one fixture file → argparse error (SystemExit)."""
    import compare
    with pytest.raises(SystemExit):
        compare.main([
            "--factory", "R_TEST",
            "--endpoint", "/api/x",
            "--fixtures-java", "java.json",
            # missing --fixtures-python
        ])


# ============================================================
# report.py — JSON + HTML
# ============================================================


def test_report_build_aggregates_counts():
    """build_report sums matches, real_bugs, pattern_a across entries."""
    fake_de_match = {
        "match": True,
        "total_leaves": 10,
        "matched_leaves": 10,
        "diverges": [],
        "tolerated_byte_diffs": [
            {"path": "x", "classification": "PATTERN_A_INT_COLLAPSE", "java": 1.0, "python": 1},
        ],
    }
    fake_de_diverge = {
        "match": False,
        "total_leaves": 10,
        "matched_leaves": 8,
        "diverges": [
            {"path": "y", "classification": "REAL_BUG", "java": 1, "python": 2},
            {"path": "z", "classification": "REAL_BUG", "java": "a", "python": "b"},
        ],
        "tolerated_byte_diffs": [],
    }
    ok = {"verdict": "ok", "http": 200, "size": 100, "lat_s": 0.1, "error": None}

    rep = report.build_report(
        factory="R_TEST_MOCK",
        java_base="java",
        python_base="python",
        results=[
            {"endpoint": "/a", "params": "", "java": ok, "python": ok, "dict_eq": fake_de_match},
            {"endpoint": "/b", "params": "", "java": ok, "python": ok, "dict_eq": fake_de_diverge},
        ],
    )
    assert rep["endpoints_tested"] == 2
    assert rep["endpoints_matched"] == 1
    assert rep["endpoints_diverged"] == 1
    assert rep["match_rate"] == 50.0
    assert rep["total_real_bugs"] == 2
    assert rep["total_pattern_a"] == 1


def test_report_html_render_smoke(tmp_path):
    """HTML render doesn't crash + contains expected markers."""
    rep = {
        "factory": "R_TEST_MOCK",
        "java_base": "j",
        "python_base": "p",
        "endpoints_tested": 1,
        "endpoints_matched": 1,
        "endpoints_diverged": 0,
        "match_rate": 100.0,
        "total_real_bugs": 0,
        "total_pattern_a": 0,
        "timestamp": "2026-05-12T10:00:00",
        "results": [
            {
                "endpoint": "/api/x",
                "params": "a=1",
                "verdict": "match",
                "java_http": 200,
                "python_http": 200,
                "java_size": 100,
                "python_size": 100,
                "java_lat_s": 0.1,
                "python_lat_s": 0.1,
                "java_error": None,
                "python_error": None,
                "dict_eq": {
                    "match": True,
                    "total_leaves": 5,
                    "matched_leaves": 5,
                    "diverges": [],
                    "tolerated_byte_diffs": [],
                },
            }
        ],
    }
    out = tmp_path / "report.html"
    report.write_html(rep, str(out))
    txt = out.read_text(encoding="utf-8")
    assert "R_TEST_MOCK" in txt
    assert "100.0%" in txt
    assert "verdict-match" in txt


# ============================================================
# Pattern B classifier + --tolerate-divergence (PR follow-up)
# ============================================================


def _factory_mock_body():
    """Java factory mock shape — no tenantType, factory-flavored keys."""
    return {
        "code": 200, "message": "ok", "success": True,
        "data": {
            "startDate": "2026-01-01", "endDate": "2026-01-31",
            "period": "CUSTOM",
            "kpiCards": [
                {"metricCode": "OEE", "value": 85.5, "unit": "%"},
                {"metricCode": "AVAILABILITY", "value": 92.1, "unit": "%"},
            ],
            "rankings": {"equipment": [], "production_line": []},
            "charts": {"oee_trend": None, "downtime_distribution": None},
            "aiInsights": [], "suggestions": [],
            "fromCache": False,
        },
    }


def _restaurant_envelope_body():
    """Python restaurant 3-metric envelope (PR #352 chat-A2 shape)."""
    return {
        "code": 200, "message": "操作成功", "success": True,
        "data": {
            "startDate": "2026-01-01", "endDate": "2026-01-31",
            "tenantType": "RESTAURANT",
            "metrics": [
                {"metricCode": "KITCHEN_STATION_UTILIZATION", "value": None,
                 "unit": "%", "dataAvailability": "MISSING_KITCHEN_STATION_DATA"},
                {"metricCode": "AVG_PREP_TIME", "value": None,
                 "unit": "minutes", "dataAvailability": "MISSING_ORDER_TIMESTAMP_SPLIT"},
                {"metricCode": "TABLE_TURNOVER_RATE", "value": None,
                 "unit": "turns_per_day", "dataAvailability": "PROXY_AS_BILLS_PER_STORE",
                 "proxyMetric": {"metricCode": "BILLS_PER_STORE_PER_DAY",
                                 "value": 47.33, "unit": "bills_per_store_per_day"}},
            ],
            "trendChart": None,
        },
    }


# ── Pattern B detector ──


def test_pattern_b_detected_tenant_type_only_python_side():
    """Java factory mock (no tenantType) vs Python restaurant envelope → Pattern B."""
    java = _factory_mock_body()
    py = _restaurant_envelope_body()
    assert dict_eq._detect_pattern_b_context(java, py) is True


def test_pattern_b_detected_tenant_type_value_differs():
    """Both have tenantType but values differ → Pattern B."""
    java = {"data": {"tenantType": "FACTORY", "kpiCards": []}}
    py = {"data": {"tenantType": "RESTAURANT", "metrics": []}}
    assert dict_eq._detect_pattern_b_context(java, py) is True


def test_pattern_b_detected_restaurant_signal_keys_asymmetric():
    """Same tenantType (None on both) but restaurant-signal keys asymmetric → Pattern B."""
    java = {"data": {"kpiCards": []}}
    py = {"data": {"metrics": [], "dataAvailability": "OK"}}
    assert dict_eq._detect_pattern_b_context(java, py) is True


def test_pattern_b_not_detected_same_shape():
    """Same-shape responses (no restaurant signals, no tenantType differ) → False."""
    java = {"data": {"value": 100, "name": "x"}}
    py = {"data": {"value": 100, "name": "x"}}
    assert dict_eq._detect_pattern_b_context(java, py) is False


def test_pattern_b_not_detected_when_no_envelope():
    """Top-level scalars / non-dicts → False (no envelope to inspect)."""
    assert dict_eq._detect_pattern_b_context("a", "b") is False
    assert dict_eq._detect_pattern_b_context([1, 2], [1, 2]) is False


def test_pattern_b_unwraps_envelope():
    """Detector drills past {code, message, data, ...} wrapper to inspect data."""
    java = {"code": 200, "data": {"tenantType": "FACTORY"}}
    py = {"code": 200, "data": {"tenantType": "RESTAURANT"}}
    assert dict_eq._detect_pattern_b_context(java, py) is True


# ── dict_eq_match classifies diverges as PATTERN_B_STRUCTURAL ──


def test_dict_eq_pattern_b_context_flags_diverges_as_structural():
    """When Pattern B context detected, all diverges are PATTERN_B_STRUCTURAL not REAL_BUG."""
    java = _factory_mock_body()
    py = _restaurant_envelope_body()
    r = dict_eq.dict_eq_match(java, py)
    assert r["match"] is False
    assert r["pattern_b_context"] is True
    # Every diverge should be Pattern B, not REAL_BUG.
    for d in r["diverges"]:
        assert d["classification"] == dict_eq.PATTERN_B_STRUCTURAL


def test_dict_eq_pattern_b_context_false_keeps_real_bug():
    """Without Pattern B context, diverges remain REAL_BUG."""
    java = {"data": {"value": 100}}
    py = {"data": {"value": 200}}
    r = dict_eq.dict_eq_match(java, py)
    assert r["pattern_b_context"] is False
    assert r["diverges"][0]["classification"] == dict_eq.REAL_BUG


# ── apply_tolerance — bucket moving + match recompute ──


def test_apply_tolerance_all_moves_pattern_b_to_tolerated():
    """tolerate_all=True moves Pattern B diverges to tolerated_byte_diffs and flips match."""
    java = _factory_mock_body()
    py = _restaurant_envelope_body()
    r = dict_eq.dict_eq_match(java, py)
    before_diverges = len(r["diverges"])
    assert before_diverges > 0
    dict_eq.apply_tolerance(r, tolerate_all=True)
    assert r["match"] is True
    assert r["diverges"] == []
    # All moved to tolerated.
    tolerated_b = [d for d in r["tolerated_byte_diffs"]
                   if d["classification"] == dict_eq.PATTERN_B_STRUCTURAL]
    assert len(tolerated_b) == before_diverges


def test_apply_tolerance_patterns_B_only_keeps_real_bug():
    """tolerate_patterns={B} tolerates Pattern B but REAL_BUG stays in diverges."""
    # Mix: top-level Pattern B context + a deliberate REAL_BUG injection.
    java = _factory_mock_body()
    py = _restaurant_envelope_body()
    r = dict_eq.dict_eq_match(java, py)
    # Manually inject a REAL_BUG entry to verify it survives tolerance.
    r["diverges"].append({
        "path": "manually_injected", "java": 1, "python": 2,
        "classification": dict_eq.REAL_BUG,
    })
    dict_eq.apply_tolerance(r, tolerate_patterns={"B"})
    # REAL_BUG survived; Pattern Bs moved.
    assert any(d["classification"] == dict_eq.REAL_BUG for d in r["diverges"])
    assert not any(d["classification"] == dict_eq.PATTERN_B_STRUCTURAL for d in r["diverges"])
    assert r["match"] is False  # REAL_BUG keeps match=False


def test_apply_tolerance_noop_when_no_config():
    """No tolerance flags → report untouched."""
    java = {"data": {"value": 100}}
    py = {"data": {"value": 200}}
    r = dict_eq.dict_eq_match(java, py)
    before_div = list(r["diverges"])
    before_tol = list(r["tolerated_byte_diffs"])
    dict_eq.apply_tolerance(r)  # no kwargs
    assert r["diverges"] == before_div
    assert r["tolerated_byte_diffs"] == before_tol


def test_apply_tolerance_patterns_A_does_not_affect_pattern_b():
    """tolerate_patterns={A} alone does NOT tolerate Pattern B diverges."""
    java = _factory_mock_body()
    py = _restaurant_envelope_body()
    r = dict_eq.dict_eq_match(java, py)
    before_diverges = len(r["diverges"])
    dict_eq.apply_tolerance(r, tolerate_patterns={"A"})
    # Pattern B diverges all stay (no A entries exist in this fixture).
    assert len(r["diverges"]) == before_diverges
    assert r["match"] is False


# ── parse_patterns_arg CLI helper ──


def test_parse_patterns_arg_single_letter():
    assert dict_eq.parse_patterns_arg("B") == {"B"}


def test_parse_patterns_arg_comma_list():
    assert dict_eq.parse_patterns_arg("A,B") == {"A", "B"}


def test_parse_patterns_arg_case_insensitive_with_spaces():
    assert dict_eq.parse_patterns_arg(" a , b , a2 ") == {"A", "B", "A2"}


def test_parse_patterns_arg_empty_returns_none():
    assert dict_eq.parse_patterns_arg("") is None
    assert dict_eq.parse_patterns_arg(None) is None


def test_parse_patterns_arg_unknown_raises():
    # Q is not in KNOWN_PATTERNS (A/A2/B/C plus X/Y/Z added for F-2).
    with pytest.raises(ValueError, match="Unknown tolerate-divergence pattern 'Q'"):
        dict_eq.parse_patterns_arg("Q")


# ── compare.py CLI integration ──


def test_compare_cli_tolerate_divergence_flag(tmp_path):
    """--tolerate-divergence flips Pattern B diverges into tolerated → match_rate=100%."""
    import compare

    java_fix = tmp_path / "java.json"
    py_fix = tmp_path / "python.json"
    _write_fixture(java_fix, _factory_mock_body())
    _write_fixture(py_fix, _restaurant_envelope_body())

    out_json = tmp_path / "report.json"
    rc = compare.main([
        "--factory", "R_GML_DEMO",
        "--endpoint", "/api/test",
        "--fixtures-java", str(java_fix),
        "--fixtures-python", str(py_fix),
        "--output", str(out_json),
        "--tolerate-divergence",
    ])
    assert rc == 0
    data = json.loads(out_json.read_text(encoding="utf-8"))
    assert data["match_rate"] == 100.0
    assert data["total_real_bugs"] == 0
    assert data["total_pattern_b"] > 0   # Pattern B count surfaced


def test_compare_cli_tolerate_patterns_B_only(tmp_path):
    """--tolerate-divergence-patterns B works (subset of --tolerate-divergence)."""
    import compare

    java_fix = tmp_path / "java.json"
    py_fix = tmp_path / "python.json"
    _write_fixture(java_fix, _factory_mock_body())
    _write_fixture(py_fix, _restaurant_envelope_body())

    out_json = tmp_path / "report.json"
    rc = compare.main([
        "--factory", "R_GML_DEMO",
        "--endpoint", "/api/test",
        "--fixtures-java", str(java_fix),
        "--fixtures-python", str(py_fix),
        "--output", str(out_json),
        "--tolerate-divergence-patterns", "B",
    ])
    assert rc == 0
    data = json.loads(out_json.read_text(encoding="utf-8"))
    assert data["match_rate"] == 100.0


def test_compare_cli_default_strict_fails_on_pattern_b(tmp_path):
    """Without --tolerate-divergence, Pattern B diverges fail the gate."""
    import compare

    java_fix = tmp_path / "java.json"
    py_fix = tmp_path / "python.json"
    _write_fixture(java_fix, _factory_mock_body())
    _write_fixture(py_fix, _restaurant_envelope_body())

    out_json = tmp_path / "report.json"
    rc = compare.main([
        "--factory", "R_GML_DEMO",
        "--endpoint", "/api/test",
        "--fixtures-java", str(java_fix),
        "--fixtures-python", str(py_fix),
        "--output", str(out_json),
    ])
    assert rc == 1   # GATE FAIL
    data = json.loads(out_json.read_text(encoding="utf-8"))
    assert data["match_rate"] < 99.945
    # In strict mode total_real_bugs counts ONLY REAL_BUG entries; Pattern B
    # diverges have classification PATTERN_B_STRUCTURAL so total_real_bugs is 0
    # but match_rate is still 0% (endpoint diverged).
    assert data["endpoints_diverged"] == 1


def test_compare_cli_unknown_pattern_letter_rejected(tmp_path):
    """--tolerate-divergence-patterns Q (unknown) → argparse error.

    Note: X/Y/Z now valid (registered for HTTP-layer routing tolerance, see
    PATTERN_X_JAVA_DELETED / PATTERN_Y_BOTH_GONE / PATTERN_Z_PYTHON_NOT_IN_SCOPE
    in dict_eq.KNOWN_PATTERNS).
    """
    import compare

    java_fix = tmp_path / "java.json"
    py_fix = tmp_path / "python.json"
    _write_fixture(java_fix, {"a": 1})
    _write_fixture(py_fix, {"a": 1})

    with pytest.raises(SystemExit):
        compare.main([
            "--factory", "R_TEST",
            "--endpoint", "/api/x",
            "--fixtures-java", str(java_fix),
            "--fixtures-python", str(py_fix),
            "--tolerate-divergence-patterns", "Q",
        ])


def test_compare_cli_patterns_overrides_tolerate_all(tmp_path):
    """--tolerate-divergence-patterns A should NOT tolerate Pattern B even with
    --tolerate-divergence also set (patterns is the more specific override)."""
    import compare

    java_fix = tmp_path / "java.json"
    py_fix = tmp_path / "python.json"
    _write_fixture(java_fix, _factory_mock_body())
    _write_fixture(py_fix, _restaurant_envelope_body())

    out_json = tmp_path / "report.json"
    rc = compare.main([
        "--factory", "R_GML_DEMO",
        "--endpoint", "/api/test",
        "--fixtures-java", str(java_fix),
        "--fixtures-python", str(py_fix),
        "--output", str(out_json),
        "--tolerate-divergence",
        "--tolerate-divergence-patterns", "A",
    ])
    # A alone does NOT cover Pattern B → gate still fails.
    assert rc == 1
    data = json.loads(out_json.read_text(encoding="utf-8"))
    assert data["match_rate"] < 99.945


# ── summarize() reflects pattern_b_context ──


def test_summarize_includes_b_context_marker():
    java = _factory_mock_body()
    py = _restaurant_envelope_body()
    r = dict_eq.dict_eq_match(java, py)
    s = dict_eq.summarize(r)
    assert "b_context=true" in s


# ============================================================
# F-2 — Phase-C routing-aware classification (2026-05-12 cohort sweep finding)
# ============================================================


def test_classify_routing_java_deleted():
    """Java 404 + Python 200 → java_deleted (handler intentionally removed)."""
    import compare
    assert compare.classify_routing(404, 200) == "java_deleted"
    assert compare.classify_routing(404, 201) == "java_deleted"
    assert compare.classify_routing(404, 299) == "java_deleted"


def test_classify_routing_both_gone():
    """Java 404 + Python 4xx/5xx → both_gone (latent coverage gap, F-1 in sweep)."""
    import compare
    # F-1 finding: /analysis/finance?analysisType=overview → Python 501 stub.
    assert compare.classify_routing(404, 501) == "both_gone"
    assert compare.classify_routing(404, 404) == "both_gone"
    assert compare.classify_routing(404, 422) == "both_gone"


def test_classify_routing_python_not_in_scope():
    """Python 404 + Java 200 → python_not_in_scope (dashboards stay Java-only)."""
    import compare
    assert compare.classify_routing(200, 404) == "python_not_in_scope"
    assert compare.classify_routing(204, 404) == "python_not_in_scope"


def test_classify_routing_returns_none_when_disabled():
    """All three tolerance flags off → never classify; defer to http_mismatch."""
    import compare
    assert compare.classify_routing(
        404, 200, tolerate_java_deleted=False, tolerate_python_not_in_scope=False
    ) is None
    assert compare.classify_routing(
        200, 404, tolerate_java_deleted=False, tolerate_python_not_in_scope=False
    ) is None


def test_classify_routing_returns_none_for_unrelated_mismatch():
    """Java 500 vs Python 200 is NOT a Phase-C pattern — keep http_mismatch."""
    import compare
    assert compare.classify_routing(500, 200) is None
    assert compare.classify_routing(200, 500) is None
    assert compare.classify_routing(401, 200) is None
    assert compare.classify_routing(200, 200) is None
    assert compare.classify_routing(500, 500) is None


def test_classify_routing_partial_flag_disable():
    """Java-deleted off but python-not-in-scope still on → only Z fires."""
    import compare
    assert compare.classify_routing(
        404, 200,
        tolerate_java_deleted=False,
        tolerate_python_not_in_scope=True,
    ) is None
    assert compare.classify_routing(
        200, 404,
        tolerate_java_deleted=False,
        tolerate_python_not_in_scope=True,
    ) == "python_not_in_scope"


def _fetch_envelope(http: int, data, verdict: str = "ok"):
    """Shape-builder for ``run_single``/``build_report`` test inputs."""
    return {
        "url": "<test>",
        "http": http,
        "lat_s": 0.0,
        "size": len(json.dumps(data)) if data is not None else 0,
        "raw": json.dumps(data) if data is not None else "",
        "data": data,
        "error": None,
        "verdict": verdict,
    }


def test_build_report_java_deleted_counts_as_match():
    """routing_pattern=java_deleted → endpoints_matched += 1, no REAL_BUG."""
    java_404 = _fetch_envelope(
        404, {"timestamp": "...", "status": 404, "error": "Not Found", "path": "/api/..."}
    )
    python_200 = _fetch_envelope(200, {"data": {"value": 100}, "success": True})
    rep = report.build_report(
        factory="R_TEST_MOCK",
        java_base="java", python_base="python",
        results=[{
            "endpoint": "/api/x", "params": "",
            "java": java_404, "python": python_200,
            "dict_eq": None,
            "routing_pattern": "java_deleted",
        }],
    )
    assert rep["endpoints_matched"] == 1
    assert rep["endpoints_diverged"] == 0
    assert rep["match_rate"] == 100.0
    assert rep["total_real_bugs"] == 0
    assert rep["total_java_deleted"] == 1
    assert rep["results"][0]["verdict"] == "java_deleted"
    assert rep["results"][0]["routing_pattern"] == "java_deleted"


def test_build_report_both_gone_logged_not_matched():
    """routing_pattern=both_gone → counted separately, NOT matched/diverged/REAL_BUG."""
    java_404 = _fetch_envelope(404, {"status": 404})
    python_501 = _fetch_envelope(
        501, {"code": 501, "message": "尚未 port 到 Python..."}
    )
    rep = report.build_report(
        factory="R_TEST_MOCK",
        java_base="java", python_base="python",
        results=[{
            "endpoint": "/api/analysis/finance?analysisType=overview", "params": "",
            "java": java_404, "python": python_501,
            "dict_eq": None,
            "routing_pattern": "both_gone",
        }],
    )
    assert rep["endpoints_matched"] == 0
    assert rep["endpoints_diverged"] == 0
    assert rep["total_real_bugs"] == 0
    assert rep["total_both_gone"] == 1
    assert rep["results"][0]["verdict"] == "both_gone"


def test_build_report_python_not_in_scope_counts_as_match():
    """routing_pattern=python_not_in_scope (Java-only paths) → matched."""
    java_200 = _fetch_envelope(200, {"data": {"executive": "..."}})
    python_404 = _fetch_envelope(404, {"status": 404})
    rep = report.build_report(
        factory="R_TEST_MOCK",
        java_base="java", python_base="python",
        results=[{
            "endpoint": "/api/dashboard/executive", "params": "",
            "java": java_200, "python": python_404,
            "dict_eq": None,
            "routing_pattern": "python_not_in_scope",
        }],
    )
    assert rep["endpoints_matched"] == 1
    assert rep["total_python_not_in_scope"] == 1
    assert rep["match_rate"] == 100.0


def test_build_report_cohort_simulation_zero_real_bug():
    """Simulate the 2026-05-12 cohort sweep row: 17 endpoints where Java is
    deleted (404) and Python serves. Before F-2 fix this row reported 4-7
    REAL_BUG (envelope-mismatch artefacts). After fix: 0 REAL_BUG.
    """
    results = []
    # 14 java_deleted endpoints (Java 404 ↔ Python 200)
    for i in range(14):
        results.append({
            "endpoint": f"/api/migrated/{i}", "params": "",
            "java": _fetch_envelope(404, {"status": 404, "error": "Not Found"}),
            "python": _fetch_envelope(200, {"data": {"k": i}, "success": True}),
            "dict_eq": None,
            "routing_pattern": "java_deleted",
        })
    # 3 python_not_in_scope endpoints (Java 200 ↔ Python 404 — dashboards)
    for i in range(3):
        results.append({
            "endpoint": f"/api/dashboard/{i}", "params": "",
            "java": _fetch_envelope(200, {"data": {"d": i}}),
            "python": _fetch_envelope(404, {"status": 404}),
            "dict_eq": None,
            "routing_pattern": "python_not_in_scope",
        })
    rep = report.build_report(
        factory="R_GML_DEMO",
        java_base="java", python_base="python",
        results=results,
    )
    assert rep["endpoints_tested"] == 17
    assert rep["endpoints_matched"] == 17
    assert rep["match_rate"] == 100.0
    assert rep["total_real_bugs"] == 0   # ← F-2 ACCEPTANCE: was 4-7 pre-fix
    assert rep["total_java_deleted"] == 14
    assert rep["total_python_not_in_scope"] == 3


def test_build_report_routing_overrides_http_mismatch_verdict():
    """When routing_pattern is set, verdict takes that value (not http_mismatch).

    Pre-F-2 the same Java=404 + Python=200 pair would have produced
    verdict='http_mismatch' AND a noisy dict_eq output classified as REAL_BUG.
    """
    rep = report.build_report(
        factory="R_TEST_MOCK", java_base="java", python_base="python",
        results=[{
            "endpoint": "/x", "params": "",
            "java": _fetch_envelope(404, {"status": 404, "error": "Not Found"}),
            "python": _fetch_envelope(200, {"data": {"value": 100}}),
            "dict_eq": None,
            "routing_pattern": "java_deleted",
        }],
    )
    assert rep["results"][0]["verdict"] == "java_deleted"
    assert rep["total_java_deleted"] == 1
    assert rep["match_rate"] == 100.0


def test_compare_cli_strict_mode_via_no_flag(tmp_path):
    """--no-tolerate-java-deleted + Java 404 fixture pair should NOT classify;
    the harness would then fall through to http_mismatch verdict.

    We can't drive a 404 through fixtures-mode (fixtures synthesise 200 by
    design), so this test exercises run_single directly with HTTP envelopes
    constructed in-process.
    """
    import compare
    fake_java_404 = _fetch_envelope(404, {"status": 404})
    fake_python_200 = _fetch_envelope(200, {"data": {"v": 1}})

    # Direct classify_routing call (the CLI plumbing already passes the flag
    # values straight through to this function).
    assert compare.classify_routing(
        fake_java_404["http"], fake_python_200["http"],
        tolerate_java_deleted=False, tolerate_python_not_in_scope=False,
    ) is None
    assert compare.classify_routing(
        fake_java_404["http"], fake_python_200["http"],
        tolerate_java_deleted=True, tolerate_python_not_in_scope=False,
    ) == "java_deleted"


# ============================================================
# Task B — Blue-Green Java port detection helper
# ============================================================


def test_probe_java_health_returns_false_on_refused():
    """_probe_java_health on a closed port returns False (no exception leak)."""
    assert fetch_endpoint._probe_java_health("127.0.0.1", 1, timeout=2) is False


def test_detect_active_java_port_returns_none_when_all_dead():
    """No port responds → None, NOT a silent fallback to localhost."""
    # Two definitely-closed ports.
    result = fetch_endpoint.detect_active_java_port(
        "127.0.0.1", ports=(1, 2), timeout=2
    )
    assert result is None


def test_resolve_java_base_noop_when_bg_fallback_off():
    """bg_fallback=False → return input URL unchanged, no network probes."""
    fetch_endpoint._reset_bg_cache()
    base = "http://47.100.235.168:10010"
    assert fetch_endpoint.resolve_java_base(base, bg_fallback=False) == base


def test_resolve_java_base_noop_when_port_not_in_bg_set():
    """Explicit non-BG port (e.g. test env :10011) → unchanged.

    Forbids silent move-off-the-intended-slot when an operator explicitly
    picks a non-BG port.
    """
    fetch_endpoint._reset_bg_cache()
    base = "http://47.100.235.168:10011"
    # Even with bg_fallback=True and probes that would succeed, leave alone.
    assert fetch_endpoint.resolve_java_base(
        base, bg_fallback=True, verbose=False
    ) == base


def test_resolve_java_base_swaps_to_alternate_port(monkeypatch):
    """Primary (10010) refused, alternate (10020) alive → URL swapped + cached."""
    fetch_endpoint._reset_bg_cache()
    probe_calls = []

    def fake_probe(host, port, timeout=3):
        probe_calls.append((host, port))
        return port == 10020  # only green alive
    monkeypatch.setattr(fetch_endpoint, "_probe_java_health", fake_probe)

    base = "http://47.100.235.168:10010"
    resolved = fetch_endpoint.resolve_java_base(
        base, bg_fallback=True, verbose=False
    )
    assert resolved == "http://47.100.235.168:10020"
    # Both ports probed; primary first.
    assert probe_calls == [("47.100.235.168", 10010), ("47.100.235.168", 10020)]


def test_resolve_java_base_caches_per_process(monkeypatch):
    """Second call with same input → cached, no additional probes."""
    fetch_endpoint._reset_bg_cache()
    probe_calls = []

    def fake_probe(host, port, timeout=3):
        probe_calls.append((host, port))
        return port == 10010  # blue alive
    monkeypatch.setattr(fetch_endpoint, "_probe_java_health", fake_probe)

    base = "http://47.100.235.168:10010"
    a = fetch_endpoint.resolve_java_base(base, bg_fallback=True, verbose=False)
    b = fetch_endpoint.resolve_java_base(base, bg_fallback=True, verbose=False)
    assert a == b == base
    # Second call hit cache — no extra probe.
    assert probe_calls == [("47.100.235.168", 10010)]


def test_resolve_java_base_keeps_input_when_both_dead(monkeypatch):
    """Neither slot responds → return input as-is + WARN to stderr.

    The actual fetch in fetch_pair will then surface a network_error verdict
    rather than this helper silently substituting in a localhost or anything
    else surprising.
    """
    fetch_endpoint._reset_bg_cache()
    monkeypatch.setattr(
        fetch_endpoint, "_probe_java_health", lambda host, port, timeout=3: False
    )
    base = "http://47.100.235.168:10010"
    resolved = fetch_endpoint.resolve_java_base(
        base, bg_fallback=True, verbose=False
    )
    assert resolved == base


def test_swap_port_preserves_path_and_scheme():
    """_swap_port keeps scheme + path + query + userinfo intact."""
    assert fetch_endpoint._swap_port(
        "http://47.100.235.168:10010", 10020
    ) == "http://47.100.235.168:10020"
    # Path/query preserved
    assert fetch_endpoint._swap_port(
        "http://host:10010/api/x?y=1", 10020
    ) == "http://host:10020/api/x?y=1"
