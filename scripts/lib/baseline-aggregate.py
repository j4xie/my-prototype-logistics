#!/usr/bin/env python3
"""Aggregate Java baseline metrics CSV into per-endpoint p50/p95/p99/error_rate/qps.

Source-of-truth spec: docs/superpowers/specs/2026-05-02-phase2a-t6-deploy-runbook.md §6

Input CSV format (produced by scripts/baseline-java-metrics.sh):
    timestamp_iso,endpoint,http_status,latency_seconds,response_bytes

Output formats: csv (default) or markdown table.

Usage:
    python3 scripts/lib/baseline-aggregate.py \\
        --input /var/log/baseline-java-metrics-20260515.csv \\
        --output /var/log/baseline-summary-20260515.csv \\
        --format csv

    # Markdown for runbook attachment
    python3 scripts/lib/baseline-aggregate.py --input ... --format markdown

Design decisions:
- Python 3.8 compatible (server venv38 — see .claude/rules/python-java-port.md)
- Builtin only: csv, statistics, collections, argparse, sys, math
- No numpy/pandas dependency (script runs on stripped server installs)
- Status code 0 (curl-fail in collector) and 99s sentinel timeouts treated as errors
"""
from __future__ import annotations

import argparse
import csv
import math
import sys
from collections import defaultdict
from typing import Dict, List, Optional, Tuple


# Endpoint pattern filter (None = include all)
def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--input", required=True, help="Input CSV path (from baseline-java-metrics.sh)")
    p.add_argument("--output", default="-", help="Output path; '-' = stdout (default)")
    p.add_argument("--format", choices=("csv", "markdown"), default="csv")
    p.add_argument("--endpoint-filter", default=None,
                   help="Substring filter; only include endpoints containing this substring")
    return p.parse_args()


def percentile(sorted_values: List[float], pct: float) -> Optional[float]:
    """Compute percentile via nearest-rank method.

    sorted_values must be sorted ascending. pct is in (0, 100].
    Returns None if list is empty.
    """
    if not sorted_values:
        return None
    if pct <= 0 or pct > 100:
        raise ValueError(f"percentile must be in (0, 100], got {pct}")
    # Nearest-rank: index = ceil(pct/100 * n) - 1
    n = len(sorted_values)
    idx = max(0, min(n - 1, math.ceil(pct / 100.0 * n) - 1))
    return sorted_values[idx]


def is_error_status(status_str: str) -> bool:
    """Treat any non-2xx status as error. Curl-fail sentinel (0) and timeout
    sentinel (99) both fall here naturally since they don't start with '2'."""
    s = (status_str or "").strip()
    return not s.startswith("2")


def aggregate(input_path: str, endpoint_filter: Optional[str]) -> Tuple[Dict[str, dict], int, int]:
    """Read CSV, return (per_endpoint_stats, total_rows, total_skipped_bad_rows).

    per_endpoint_stats[endpoint] = {
        "n": int, "n_errors": int,
        "p50": float|None, "p95": float|None, "p99": float|None,
        "error_rate": float, "qps": float|None,
        "first_ts": str|None, "last_ts": str|None,
    }
    """
    samples: Dict[str, List[float]] = defaultdict(list)
    errors: Dict[str, int] = defaultdict(int)
    totals: Dict[str, int] = defaultdict(int)
    first_ts: Dict[str, str] = {}
    last_ts: Dict[str, str] = {}
    skipped = 0
    rows = 0

    with open(input_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        required = {"timestamp_iso", "endpoint", "http_status", "latency_seconds"}
        if not required.issubset(reader.fieldnames or []):
            missing = required - set(reader.fieldnames or [])
            raise SystemExit(f"ERROR: input CSV missing columns: {sorted(missing)}")

        for row in reader:
            rows += 1
            ep = row.get("endpoint", "").strip()
            if not ep:
                skipped += 1
                continue
            if endpoint_filter and endpoint_filter not in ep:
                continue

            totals[ep] += 1
            if ep not in first_ts:
                first_ts[ep] = row.get("timestamp_iso", "")
            last_ts[ep] = row.get("timestamp_iso", "")

            if is_error_status(row.get("http_status", "")):
                errors[ep] += 1
                continue

            # Latency: skip if non-numeric or negative (data quality guard)
            latency_str = (row.get("latency_seconds") or "").strip()
            try:
                latency = float(latency_str)
            except ValueError:
                skipped += 1
                continue
            if latency < 0:
                skipped += 1
                continue
            samples[ep].append(latency)

    # Compute per-endpoint stats
    stats: Dict[str, dict] = {}
    for ep in sorted(totals.keys()):
        sorted_lat = sorted(samples[ep])
        n = totals[ep]
        n_err = errors[ep]
        # Error rate uses total (success + error), not just sampled
        error_rate = n_err / n if n > 0 else 0.0

        # QPS: span between first and last sample for this endpoint
        qps: Optional[float] = None
        f_ts, l_ts = first_ts.get(ep), last_ts.get(ep)
        if f_ts and l_ts and f_ts != l_ts:
            try:
                from datetime import datetime
                f_dt = datetime.fromisoformat(f_ts.replace("Z", "+00:00"))
                l_dt = datetime.fromisoformat(l_ts.replace("Z", "+00:00"))
                span = (l_dt - f_dt).total_seconds()
                if span > 0:
                    qps = n / span
            except (ValueError, TypeError):
                pass

        stats[ep] = {
            "n": n,
            "n_errors": n_err,
            "p50": percentile(sorted_lat, 50),
            "p95": percentile(sorted_lat, 95),
            "p99": percentile(sorted_lat, 99),
            "error_rate": round(error_rate, 4),
            "qps": round(qps, 3) if qps is not None else None,
            "first_ts": f_ts,
            "last_ts": l_ts,
        }
    return stats, rows, skipped


def fmt_latency(v: Optional[float]) -> str:
    if v is None:
        return ""
    return f"{v:.3f}"


def write_csv(stats: Dict[str, dict], out) -> None:
    writer = csv.writer(out)
    writer.writerow(["endpoint", "n", "n_errors", "p50_seconds", "p95_seconds", "p99_seconds", "error_rate", "qps"])
    for ep in sorted(stats.keys()):
        s = stats[ep]
        writer.writerow([
            ep, s["n"], s["n_errors"],
            fmt_latency(s["p50"]), fmt_latency(s["p95"]), fmt_latency(s["p99"]),
            f"{s['error_rate']:.4f}",
            "" if s["qps"] is None else f"{s['qps']:.3f}",
        ])


def write_markdown(stats: Dict[str, dict], out) -> None:
    out.write("| Endpoint | N | Errors | p50 (s) | p95 (s) | p99 (s) | Error rate | QPS |\n")
    out.write("|---|---:|---:|---:|---:|---:|---:|---:|\n")
    for ep in sorted(stats.keys()):
        s = stats[ep]
        qps = "—" if s["qps"] is None else f"{s['qps']:.3f}"
        out.write(
            f"| `{ep}` | {s['n']} | {s['n_errors']} | "
            f"{fmt_latency(s['p50'])} | {fmt_latency(s['p95'])} | {fmt_latency(s['p99'])} | "
            f"{s['error_rate']:.4f} | {qps} |\n"
        )


def main() -> int:
    args = parse_args()
    stats, rows, skipped = aggregate(args.input, args.endpoint_filter)

    print(f"[aggregate] input rows: {rows} (skipped {skipped})", file=sys.stderr)
    print(f"[aggregate] endpoints: {len(stats)}", file=sys.stderr)

    if args.output == "-":
        out = sys.stdout
    else:
        out = open(args.output, "w", encoding="utf-8", newline="")

    try:
        if args.format == "csv":
            write_csv(stats, out)
        else:
            write_markdown(stats, out)
    finally:
        if args.output != "-":
            out.close()
            print(f"[aggregate] wrote: {args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
