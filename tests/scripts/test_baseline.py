"""Smoke tests for scripts/lib/baseline-aggregate.py.

Source-of-truth spec: docs/superpowers/specs/2026-05-02-phase2a-t6-deploy-runbook.md §6
Implements: scripts/baseline-java-metrics.sh + scripts/lib/baseline-aggregate.py

Test scope:
  1. Synthetic CSV with known distribution → p50/p99 correct
  2. Empty CSV → empty stats (no crash)
  3. Single row → p50 == p95 == p99 == single latency
  4. Negative / non-numeric latency rows → skipped gracefully
  5. --endpoint-filter substring works

The aggregator script lives at scripts/lib/baseline-aggregate.py — invoked here
via subprocess to test the public CLI surface, not internal helpers.
"""
from __future__ import annotations

import csv
import io
import subprocess
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "lib" / "baseline-aggregate.py"


def _write_csv(path: Path, rows: list) -> None:
    """Write a list of dicts to CSV with the standard 5-column header."""
    fields = ["timestamp_iso", "endpoint", "http_status", "latency_seconds", "response_bytes"]
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def _run_aggregate(input_path: Path, *extra_args: str) -> tuple[str, str, int]:
    """Invoke the aggregator script. Returns (stdout, stderr, return_code)."""
    cmd = [sys.executable, str(SCRIPT), "--input", str(input_path), *extra_args]
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    return proc.stdout, proc.stderr, proc.returncode


def _parse_csv_output(stdout: str) -> dict:
    """Parse the aggregator's CSV stdout into {endpoint: row dict}."""
    reader = csv.DictReader(io.StringIO(stdout))
    return {row["endpoint"]: row for row in reader}


# ============================================================
# 1. Synthetic CSV with known distribution → p50/p99 correct
# ============================================================
def test_synthetic_csv_p50_p99_correct(tmp_path: Path) -> None:
    """100 samples 0.001..0.100 sec → p50 ~= 0.050, p99 ~= 0.099 (nearest-rank)."""
    csv_path = tmp_path / "input.csv"
    rows = [
        {
            "timestamp_iso": f"2026-05-15T09:{i // 60:02d}:{i % 60:02d}+00:00",
            "endpoint": "/api/test",
            "http_status": "200",
            "latency_seconds": f"{(i + 1) / 1000:.3f}",
            "response_bytes": "1000",
        }
        for i in range(100)
    ]
    _write_csv(csv_path, rows)

    stdout, stderr, rc = _run_aggregate(csv_path)
    assert rc == 0, f"non-zero exit: {stderr}"

    parsed = _parse_csv_output(stdout)
    assert "/api/test" in parsed
    row = parsed["/api/test"]
    assert int(row["n"]) == 100
    assert int(row["n_errors"]) == 0
    # Nearest-rank p50 of 100 samples: index ceil(0.5*100)-1 = 49 → value (49+1)/1000 = 0.050
    assert float(row["p50_seconds"]) == pytest.approx(0.050, abs=0.001)
    # p99: index ceil(0.99*100)-1 = 98 → value 0.099
    assert float(row["p99_seconds"]) == pytest.approx(0.099, abs=0.001)
    assert float(row["error_rate"]) == 0.0


# ============================================================
# 2. Empty CSV (header only) → no endpoints, no crash
# ============================================================
def test_empty_csv_returns_empty_stats(tmp_path: Path) -> None:
    csv_path = tmp_path / "empty.csv"
    _write_csv(csv_path, [])  # header only

    stdout, stderr, rc = _run_aggregate(csv_path)
    assert rc == 0
    parsed = _parse_csv_output(stdout)
    assert parsed == {}, f"expected empty stats, got {parsed}"


# ============================================================
# 3. Single row → p50 == p95 == p99 == that row's latency
# ============================================================
def test_single_row_p50_eq_p99(tmp_path: Path) -> None:
    csv_path = tmp_path / "single.csv"
    _write_csv(csv_path, [{
        "timestamp_iso": "2026-05-15T09:00:00+00:00",
        "endpoint": "/api/single",
        "http_status": "200",
        "latency_seconds": "0.123",
        "response_bytes": "500",
    }])

    stdout, stderr, rc = _run_aggregate(csv_path)
    assert rc == 0
    parsed = _parse_csv_output(stdout)
    row = parsed["/api/single"]
    assert int(row["n"]) == 1
    assert float(row["p50_seconds"]) == pytest.approx(0.123)
    assert float(row["p95_seconds"]) == pytest.approx(0.123)
    assert float(row["p99_seconds"]) == pytest.approx(0.123)


# ============================================================
# 4. Negative / non-numeric latency rows → skipped gracefully
# ============================================================
def test_negative_or_null_latency_handled_gracefully(tmp_path: Path) -> None:
    csv_path = tmp_path / "bad_data.csv"
    _write_csv(csv_path, [
        # Good row (counted in latency stats)
        {"timestamp_iso": "2026-05-15T09:00:00+00:00", "endpoint": "/api/x",
         "http_status": "200", "latency_seconds": "0.100", "response_bytes": "100"},
        # Negative latency → skipped from samples but still counted in totals
        {"timestamp_iso": "2026-05-15T09:01:00+00:00", "endpoint": "/api/x",
         "http_status": "200", "latency_seconds": "-1", "response_bytes": "100"},
        # Non-numeric latency → skipped
        {"timestamp_iso": "2026-05-15T09:02:00+00:00", "endpoint": "/api/x",
         "http_status": "200", "latency_seconds": "garbage", "response_bytes": "100"},
        # Error status (counts toward n_errors and total, NOT latency samples)
        {"timestamp_iso": "2026-05-15T09:03:00+00:00", "endpoint": "/api/x",
         "http_status": "500", "latency_seconds": "0.200", "response_bytes": "0"},
        # Curl-fail sentinel (status=0)
        {"timestamp_iso": "2026-05-15T09:04:00+00:00", "endpoint": "/api/x",
         "http_status": "0", "latency_seconds": "99", "response_bytes": "0"},
    ])

    stdout, stderr, rc = _run_aggregate(csv_path)
    assert rc == 0, f"aggregator crashed on bad rows: {stderr}"
    parsed = _parse_csv_output(stdout)
    row = parsed["/api/x"]
    # n counts ALL rows for the endpoint (5)
    assert int(row["n"]) == 5
    # 2 errors (500 + curl-fail 0)
    assert int(row["n_errors"]) == 2
    # error_rate = 2/5 = 0.4
    assert float(row["error_rate"]) == pytest.approx(0.4)
    # Latency stats only computed from the 1 valid 200-row (negative + non-numeric skipped)
    assert float(row["p50_seconds"]) == pytest.approx(0.100)


# ============================================================
# 5. --endpoint-filter substring filter
# ============================================================
def test_aggregate_filter_by_endpoint_pattern_works(tmp_path: Path) -> None:
    csv_path = tmp_path / "filter.csv"
    _write_csv(csv_path, [
        {"timestamp_iso": "2026-05-15T09:00:00+00:00", "endpoint": "/api/finance",
         "http_status": "200", "latency_seconds": "0.100", "response_bytes": "100"},
        {"timestamp_iso": "2026-05-15T09:00:01+00:00", "endpoint": "/api/sales",
         "http_status": "200", "latency_seconds": "0.200", "response_bytes": "100"},
        {"timestamp_iso": "2026-05-15T09:00:02+00:00", "endpoint": "/api/finance/detail",
         "http_status": "200", "latency_seconds": "0.150", "response_bytes": "100"},
    ])

    # Filter for "finance" → 2 endpoints (no /api/sales)
    stdout, stderr, rc = _run_aggregate(csv_path, "--endpoint-filter", "finance")
    assert rc == 0
    parsed = _parse_csv_output(stdout)
    assert "/api/finance" in parsed
    assert "/api/finance/detail" in parsed
    assert "/api/sales" not in parsed, f"sales should be filtered out: {parsed}"
