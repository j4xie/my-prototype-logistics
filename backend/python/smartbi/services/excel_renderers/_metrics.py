"""Prometheus metrics for revenue report generation.

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §10.4 + §11.3
Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task F2

Metric names are part of the ops contract — they're referenced by Grafana
dashboards and alert rules. Renaming requires coordinated ops update.

Spec §11.3 cache-hit semantics:
  - cache hit  → REPORT_CACHE_HIT.inc() only; do NOT observe gen_seconds
                  (the cache-fetch latency goes elsewhere if measured)
  - cache miss → REPORT_GEN_SECONDS (full generation time)
                 + REPORT_GEN_FILE_BYTES
                 + REPORT_CACHE_MISS.inc()
  - error      → REPORT_GEN_ERRORS.labels(type=ExcName).inc()
"""
from prometheus_client import Counter, Histogram


REPORT_GEN_SECONDS = Histogram(
    "smartbi_report_gen_seconds",
    "Xlsx report generation wall time (cache-miss path only).",
    labelnames=("report_type", "status"),
    # Buckets cover alert thresholds (p95 > 30s warning, p95 > 60s critical
    # per spec §10.4).
    buckets=(0.5, 1, 2, 5, 10, 30, 60),
)

REPORT_GEN_FILE_BYTES = Histogram(
    "smartbi_report_file_bytes",
    "Generated xlsx file size in bytes.",
    labelnames=("report_type",),
    # Typical xlsx sizes: 50K (small per store) → 20M (large multi-store).
    buckets=(50_000, 200_000, 1_000_000, 5_000_000, 20_000_000),
)

REPORT_GEN_ERRORS = Counter(
    "smartbi_report_gen_errors",
    "Xlsx report generation failures.",
    labelnames=("type",),
)

REPORT_CACHE_HIT = Counter(
    "smartbi_report_cache_hit",
    "Redis cache hits for revenue report.",
    labelnames=("report_type",),
)

REPORT_CACHE_MISS = Counter(
    "smartbi_report_cache_miss",
    "Redis cache misses for revenue report.",
    labelnames=("report_type",),
)
