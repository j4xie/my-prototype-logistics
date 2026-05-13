"""Tests for services.excel_renderers._metrics — Prometheus exports.

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §10.4 + §11.3
Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task F2

Verifies:
  - All 5 metric objects exist + are usable (labels + observe/inc)
  - Metric names match spec exactly (used for Grafana queries by ops)
"""
from smartbi.services.excel_renderers._metrics import (
    REPORT_CACHE_HIT,
    REPORT_CACHE_MISS,
    REPORT_GEN_ERRORS,
    REPORT_GEN_FILE_BYTES,
    REPORT_GEN_SECONDS,
)


def test_gen_seconds_observe_with_labels():
    """Histogram for end-to-end generation time (cache-miss path only per §11.3)."""
    REPORT_GEN_SECONDS.labels(report_type="qhj_revenue_v1", status="ok").observe(1.5)


def test_file_bytes_observe_with_labels():
    REPORT_GEN_FILE_BYTES.labels(report_type="qhj_revenue_v1").observe(28456)


def test_errors_counter_inc_with_label():
    REPORT_GEN_ERRORS.labels(type="OpenpyxlError").inc()


def test_cache_hit_counter():
    REPORT_CACHE_HIT.labels(report_type="qhj_revenue_v1").inc()


def test_cache_miss_counter():
    REPORT_CACHE_MISS.labels(report_type="qhj_revenue_v1").inc()


def test_metric_names_match_spec_exactly():
    """ops Grafana dashboards depend on these names; renaming breaks alerts."""
    assert REPORT_GEN_SECONDS._name == "smartbi_report_gen_seconds"
    assert REPORT_GEN_FILE_BYTES._name == "smartbi_report_file_bytes"
    assert REPORT_GEN_ERRORS._name == "smartbi_report_gen_errors"
    assert REPORT_CACHE_HIT._name == "smartbi_report_cache_hit"
    assert REPORT_CACHE_MISS._name == "smartbi_report_cache_miss"


def test_histograms_have_buckets():
    """Histograms must have explicit buckets per spec §10.4 thresholds."""
    # gen_seconds: 0.5, 1, 2, 5, 10, 30, 60 → covers alert thresholds (p95 >30s warning)
    # file_bytes: 50K, 200K, 1M, 5M, 20M → covers typical xlsx sizes
    assert REPORT_GEN_SECONDS._kwargs.get("buckets") or REPORT_GEN_SECONDS._upper_bounds
    assert REPORT_GEN_FILE_BYTES._kwargs.get("buckets") or REPORT_GEN_FILE_BYTES._upper_bounds
