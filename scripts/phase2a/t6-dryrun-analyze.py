#!/usr/bin/env python3
"""T6.1 dryrun NDJSON analyzer — GO/no-go report.

Reads NDJSON output from scripts/t6-dryrun-compare.sh, aggregates verdicts
+ per-endpoint breakdown + latency stats + diverge deep-analysis, prints
GO/no-go summary, optionally writes Markdown report.

Usage:
  t6-dryrun-analyze.py <ndjson-file> [--start ISO] [--end ISO] [--out-md PATH]

Exit codes:
  0  GO criteria all met
  1  GO criteria failed (one or more thresholds breached)
  2  Usage error / file not found / no samples after filtering

Stdlib only (no pandas / numpy). NDJSON line schema:
  {"ts","endpoint","java":{"http","lat_s","size"},"python":{...},"verdict","diff"}
Verdicts: match | diverge | compare_err
"""

import argparse
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# GO criteria thresholds (per Phase 2A T6 plan + retrospective)
# ---------------------------------------------------------------------------
OVERALL_MATCH_THRESHOLD = 0.99       # ≥ 99% overall match rate
TOP_N_ENDPOINTS = 5                  # top-N endpoints (by sample count) must hit 100%
MAX_COMPARE_ERR = 0                  # zero compare_err allowed
PYTHON_LATENCY_RATIO_CAP = 5.0       # python p99 must be < 5× java p99
DIVERGE_SAMPLE_LIMIT = 50            # full-content samples kept for deep review
LAST_HOUR_WINDOW_S = 3600


def parse_iso(s):
    """Parse ISO-8601 timestamp (with timezone offset). Returns aware datetime."""
    s = s.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(s)
    except (AttributeError, ValueError):
        # Python <3.7 fallback: parse "...+HH:MM" manually
        if len(s) >= 6 and (s[-6] in "+-") and s[-3] == ":":
            base, tz = s[:-6], s[-6:]
            offset = int(tz[1:3]) * 60 + int(tz[4:6])
            if tz[0] == "-":
                offset = -offset
            dt = datetime.strptime(base, "%Y-%m-%dT%H:%M:%S.%f")
            return dt.replace(tzinfo=timezone(timedelta(minutes=offset)))
        raise


def percentile(values, pct):
    """Linear-interpolation percentile. Empty list returns 0.0."""
    if not values:
        return 0.0
    s = sorted(values)
    k = (len(s) - 1) * pct / 100
    f = int(k)
    c = min(f + 1, len(s) - 1)
    if f == c:
        return s[f]
    return s[f] + (s[c] - s[f]) * (k - f)


def parse_ndjson(path, start_dt=None, end_dt=None):
    """Stream-parse NDJSON. Returns (samples, malformed_count).

    Each sample is the original dict augmented with parsed_ts (datetime).
    Filters by start_dt / end_dt if provided.
    """
    samples = []
    malformed = 0
    with open(path, "r", encoding="utf-8") as f:
        for ln, raw in enumerate(f, 1):
            raw = raw.strip()
            if not raw:
                continue
            try:
                obj = json.loads(raw)
                obj["_parsed_ts"] = parse_iso(obj["ts"])
            except (json.JSONDecodeError, KeyError, ValueError):
                malformed += 1
                continue
            if start_dt and obj["_parsed_ts"] < start_dt:
                continue
            if end_dt and obj["_parsed_ts"] > end_dt:
                continue
            samples.append(obj)
    return samples, malformed


def aggregate(samples):
    """Build aggregate stats dict from samples list."""
    if not samples:
        return None

    verdicts = Counter(s.get("verdict", "unknown") for s in samples)
    per_endpoint = defaultdict(lambda: Counter())
    for s in samples:
        per_endpoint[s["endpoint"]][s.get("verdict", "unknown")] += 1

    # Endpoint summary, sorted by sample count desc
    endpoint_stats = []
    for ep, vc in per_endpoint.items():
        total = sum(vc.values())
        m = vc.get("match", 0)
        endpoint_stats.append({
            "endpoint": ep,
            "total": total,
            "match": m,
            "diverge": vc.get("diverge", 0),
            "compare_err": vc.get("compare_err", 0),
            "match_rate": m / total if total else 0.0,
        })
    endpoint_stats.sort(key=lambda x: x["total"], reverse=True)

    # Latency stats (filter out compare_err where lat may be missing)
    j_lat = [s["java"]["lat_s"] for s in samples if s.get("java", {}).get("lat_s") is not None]
    p_lat = [s["python"]["lat_s"] for s in samples if s.get("python", {}).get("lat_s") is not None]

    # Last-hour window
    last_ts = max(s["_parsed_ts"] for s in samples)
    cutoff = last_ts - timedelta(seconds=LAST_HOUR_WINDOW_S)
    last_hour = [s for s in samples if s["_parsed_ts"] >= cutoff]
    lh_total = len(last_hour)
    lh_match = sum(1 for s in last_hour if s.get("verdict") == "match")

    # Non-2xx HTTP counts
    j_non200 = sum(1 for s in samples
                   if s.get("java", {}).get("http") is not None
                   and not (200 <= s["java"]["http"] < 300))
    p_non200 = sum(1 for s in samples
                   if s.get("python", {}).get("http") is not None
                   and not (200 <= s["python"]["http"] < 300))

    # Diverge samples (collect ALL, capped at DIVERGE_SAMPLE_LIMIT for full content)
    diverge_samples = [s for s in samples if s.get("verdict") == "diverge"]
    diverge_per_endpoint = Counter(s["endpoint"] for s in diverge_samples)

    return {
        "total": len(samples),
        "verdicts": verdicts,
        "endpoint_stats": endpoint_stats,
        "java_lat": {
            "p50": percentile(j_lat, 50) * 1000,
            "p95": percentile(j_lat, 95) * 1000,
            "p99": percentile(j_lat, 99) * 1000,
        },
        "python_lat": {
            "p50": percentile(p_lat, 50) * 1000,
            "p95": percentile(p_lat, 95) * 1000,
            "p99": percentile(p_lat, 99) * 1000,
        },
        "window_start": min(s["_parsed_ts"] for s in samples),
        "window_end": last_ts,
        "last_hour_total": lh_total,
        "last_hour_match": lh_match,
        "last_hour_match_rate": (lh_match / lh_total) if lh_total else 0.0,
        "java_non200": j_non200,
        "python_non200": p_non200,
        "diverge_samples": diverge_samples,
        "diverge_per_endpoint": diverge_per_endpoint,
    }


def evaluate_go(stats):
    """Apply GO criteria. Returns (overall_pass, list of (label, pass, detail))."""
    total = stats["total"]
    match = stats["verdicts"].get("match", 0)
    overall_rate = match / total if total else 0.0

    top_n = stats["endpoint_stats"][:TOP_N_ENDPOINTS]
    top_n_failures = [e for e in top_n if e["match_rate"] < 1.0]

    compare_err = stats["verdicts"].get("compare_err", 0)

    j_p99 = stats["java_lat"]["p99"]
    p_p99 = stats["python_lat"]["p99"]
    lat_ratio = (p_p99 / j_p99) if j_p99 > 0 else 0.0

    checks = [
        ("Overall match rate >= 99%",
         overall_rate >= OVERALL_MATCH_THRESHOLD,
         f"actual: {overall_rate * 100:.3f}% ({match}/{total})"),
        (f"Top-{TOP_N_ENDPOINTS} endpoints 100% match",
         len(top_n_failures) == 0,
         "all top-{} 100%".format(TOP_N_ENDPOINTS) if not top_n_failures
         else "{} endpoint(s) below 100%: ".format(len(top_n_failures))
              + ", ".join(short_endpoint(e["endpoint"]) + " " + f"{e['match_rate']*100:.3f}%"
                          for e in top_n_failures)),
        ("Zero compare_err",
         compare_err <= MAX_COMPARE_ERR,
         f"actual: {compare_err}"),
        (f"Python p99 < {PYTHON_LATENCY_RATIO_CAP:.0f}x Java p99",
         lat_ratio < PYTHON_LATENCY_RATIO_CAP,
         f"java p99={j_p99:.1f}ms python p99={p_p99:.1f}ms ratio={lat_ratio:.2f}x"),
    ]
    overall_pass = all(c[1] for c in checks)
    return overall_pass, checks


def short_endpoint(ep):
    """Strip /api/mobile/{factory}/smart-bi/ prefix and date params for display."""
    if "smart-bi/" in ep:
        ep = ep.split("smart-bi/", 1)[1]
    if "?" in ep:
        path, qs = ep.split("?", 1)
        keep = []
        for kv in qs.split("&"):
            k = kv.split("=", 1)[0]
            if k not in ("startDate", "endDate"):
                keep.append(kv)
        ep = path + ("?" + "&".join(keep) if keep else "")
    return ep


def render_console(stats, checks, overall_pass, ndjson_path, malformed):
    out = []
    p = out.append
    p("T6.1 Dryrun Analysis -- {}".format(ndjson_path))
    p("=" * 72)
    p("Window: {} -> {}".format(
        stats["window_start"].isoformat(), stats["window_end"].isoformat()))
    p("Total samples: {}{}".format(
        stats["total"],
        "  (malformed lines skipped: {})".format(malformed) if malformed else ""))
    p("")

    p("Verdict breakdown:")
    total = stats["total"]
    for v in ("match", "diverge", "compare_err"):
        n = stats["verdicts"].get(v, 0)
        pct = (n / total * 100) if total else 0.0
        p("  {:<13} {:>6} ({:.3f}%)".format(v + ":", n, pct))
    other = sum(n for v, n in stats["verdicts"].items()
                if v not in ("match", "diverge", "compare_err"))
    if other:
        p("  {:<13} {:>6}".format("other:", other))
    p("")

    p("HTTP non-2xx:  java={}  python={}".format(
        stats["java_non200"], stats["python_non200"]))
    p("")

    p("Latency (ms):           p50      p95      p99")
    for side in ("java", "python"):
        lat = stats[side + "_lat"]
        p("  {:<8}            {:>7.1f}  {:>7.1f}  {:>7.1f}".format(
            side, lat["p50"], lat["p95"], lat["p99"]))
    p("")

    lh_pct = stats["last_hour_match_rate"] * 100
    p("Last 1h (ending {}):".format(stats["window_end"].isoformat()))
    p("  samples: {}  match: {} ({:.3f}%)".format(
        stats["last_hour_total"], stats["last_hour_match"], lh_pct))
    p("")

    p("Top-{} endpoints (by sample count):".format(TOP_N_ENDPOINTS))
    for e in stats["endpoint_stats"][:TOP_N_ENDPOINTS]:
        p("  {:<60} n={:<5} match={} ({:.3f}%)".format(
            short_endpoint(e["endpoint"])[:60],
            e["total"], e["match"], e["match_rate"] * 100))
    p("")

    if stats["diverge_samples"]:
        p("Diverge breakdown by endpoint ({} total):".format(
            len(stats["diverge_samples"])))
        for ep, n in stats["diverge_per_endpoint"].most_common():
            p("  {:<60} n={}".format(short_endpoint(ep)[:60], n))
        p("")

        p("Diverge samples (first {} of {}):".format(
            min(DIVERGE_SAMPLE_LIMIT, len(stats["diverge_samples"])),
            len(stats["diverge_samples"])))
        for s in stats["diverge_samples"][:DIVERGE_SAMPLE_LIMIT]:
            j = s.get("java", {})
            py = s.get("python", {})
            size_diff = (j.get("size", 0) or 0) - (py.get("size", 0) or 0)
            p("  {} {} java={}B python={}B diff={:+d}B".format(
                s["ts"], short_endpoint(s["endpoint"])[:55],
                j.get("size"), py.get("size"), size_diff))
        p("")

    p("GO criteria:")
    for label, ok, detail in checks:
        flag = "[PASS]" if ok else "[FAIL]"
        p("  {} {:<45}  {}".format(flag, label, detail))
    p("")
    p("Verdict: {}".format("GO" if overall_pass else "NO-GO"))
    return "\n".join(out)


def render_markdown(stats, checks, overall_pass, ndjson_path, malformed):
    out = []
    p = out.append
    p("# T6.1 Dryrun Analysis — {}".format(stats["window_end"].date().isoformat()))
    p("")
    p("**NDJSON**: `{}`  ".format(ndjson_path))
    p("**Window**: {} → {}  ".format(
        stats["window_start"].isoformat(), stats["window_end"].isoformat()))
    p("**Total samples**: {}{}  ".format(
        stats["total"],
        " (malformed lines skipped: {})".format(malformed) if malformed else ""))
    p("**Verdict**: **{}**".format("GO" if overall_pass else "NO-GO"))
    p("")
    p("## Verdict breakdown")
    p("")
    p("| verdict | count | % |")
    p("|---|---:|---:|")
    total = stats["total"]
    for v in ("match", "diverge", "compare_err"):
        n = stats["verdicts"].get(v, 0)
        pct = (n / total * 100) if total else 0.0
        p("| {} | {} | {:.3f}% |".format(v, n, pct))
    p("")

    p("## Latency (ms)")
    p("")
    p("| side | p50 | p95 | p99 |")
    p("|---|---:|---:|---:|")
    for side in ("java", "python"):
        lat = stats[side + "_lat"]
        p("| {} | {:.1f} | {:.1f} | {:.1f} |".format(
            side, lat["p50"], lat["p95"], lat["p99"]))
    p("")

    p("## Top-{} endpoints (by sample count)".format(TOP_N_ENDPOINTS))
    p("")
    p("| endpoint | n | match | rate |")
    p("|---|---:|---:|---:|")
    for e in stats["endpoint_stats"][:TOP_N_ENDPOINTS]:
        p("| `{}` | {} | {} | {:.3f}% |".format(
            short_endpoint(e["endpoint"]), e["total"], e["match"],
            e["match_rate"] * 100))
    p("")

    p("## All endpoints")
    p("")
    p("| endpoint | n | match | diverge | compare_err | rate |")
    p("|---|---:|---:|---:|---:|---:|")
    for e in stats["endpoint_stats"]:
        p("| `{}` | {} | {} | {} | {} | {:.3f}% |".format(
            short_endpoint(e["endpoint"]), e["total"], e["match"],
            e["diverge"], e["compare_err"], e["match_rate"] * 100))
    p("")

    if stats["diverge_samples"]:
        p("## Diverge deep-analysis")
        p("")
        p("**By endpoint**:")
        p("")
        p("| endpoint | diverges |")
        p("|---|---:|")
        for ep, n in stats["diverge_per_endpoint"].most_common():
            p("| `{}` | {} |".format(short_endpoint(ep), n))
        p("")
        p("**Samples (first {} of {})**:".format(
            min(DIVERGE_SAMPLE_LIMIT, len(stats["diverge_samples"])),
            len(stats["diverge_samples"])))
        p("")
        p("| ts | endpoint | java size | python size | Δbytes | diff field |")
        p("|---|---|---:|---:|---:|---|")
        for s in stats["diverge_samples"][:DIVERGE_SAMPLE_LIMIT]:
            j = s.get("java", {})
            py = s.get("python", {})
            size_diff = (j.get("size") or 0) - (py.get("size") or 0)
            diff = s.get("diff")
            diff_str = json.dumps(diff, ensure_ascii=False) if diff else ""
            # Truncate long diff repr to keep markdown readable
            if len(diff_str) > 80:
                diff_str = diff_str[:77] + "..."
            # Escape pipe chars for markdown
            diff_str = diff_str.replace("|", "\\|")
            p("| {} | `{}` | {} | {} | {:+d} | {} |".format(
                s["ts"], short_endpoint(s["endpoint"])[:55],
                j.get("size"), py.get("size"), size_diff, diff_str))
        p("")

    p("## GO criteria")
    p("")
    p("| check | result | detail |")
    p("|---|:--:|---|")
    for label, ok, detail in checks:
        p("| {} | {} | {} |".format(label, "PASS" if ok else "FAIL", detail))
    p("")
    p("## Verdict")
    p("")
    p("**{}**".format("GO" if overall_pass else "NO-GO"))
    return "\n".join(out)


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Analyze T6.1 dryrun NDJSON and emit GO/no-go report.")
    parser.add_argument("ndjson", help="Path to NDJSON dryrun output")
    parser.add_argument("--start", help="Filter: ISO timestamp lower bound (inclusive)")
    parser.add_argument("--end", help="Filter: ISO timestamp upper bound (inclusive)")
    parser.add_argument("--out-md", help="Write Markdown report to this path")
    args = parser.parse_args(argv)

    ndjson_path = Path(args.ndjson)
    if not ndjson_path.is_file():
        print("error: file not found: {}".format(ndjson_path), file=sys.stderr)
        return 2

    start_dt = parse_iso(args.start) if args.start else None
    end_dt = parse_iso(args.end) if args.end else None

    samples, malformed = parse_ndjson(ndjson_path, start_dt, end_dt)
    if not samples:
        print("error: no samples after filtering (malformed: {})".format(malformed),
              file=sys.stderr)
        return 2

    stats = aggregate(samples)
    overall_pass, checks = evaluate_go(stats)

    print(render_console(stats, checks, overall_pass, ndjson_path, malformed))

    if args.out_md:
        Path(args.out_md).write_text(
            render_markdown(stats, checks, overall_pass, ndjson_path, malformed),
            encoding="utf-8")
        print("\nMarkdown report written to: {}".format(args.out_md))

    return 0 if overall_pass else 1


if __name__ == "__main__":
    sys.exit(main())
