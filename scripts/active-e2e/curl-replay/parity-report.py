#!/usr/bin/env python3
"""scripts/active-e2e/curl-replay/parity-report.py

Active E2E framework v1 — aggregate NDJSON output from record-batch.sh
or replay-and-compare.py into a markdown summary suitable for pasting
into a marching-order ping or PR comment.

Usage:
  python3 parity-report.py path/to/results.ndjson [path2 ...] > summary.md

Auto-detects schema:
  - record-batch.sh format: keys {ts, factory, method, endpoint, status, verdict, ...}
  - replay-and-compare.py format: keys {ts, factory, method, endpoint, java, python, verdict, ...}
"""
import json
import sys
from collections import Counter, defaultdict


def load_ndjson(path):
    out = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            out.append(json.loads(line))
    return out


def detect_schema(rows):
    if not rows:
        return "unknown"
    sample = rows[0]
    if "java" in sample and "python" in sample:
        return "replay-compare"
    if "status" in sample:
        return "single-call"
    return "unknown"


def report_single_call(rows):
    by_verdict = Counter(r["verdict"] for r in rows)
    by_status = Counter(r["status"] for r in rows)
    by_factory_fail = defaultdict(int)
    fail_examples = []
    for r in rows:
        if r["verdict"] in ("FAIL", "FAIL_5XX", "REGRESSION", "ERR"):
            by_factory_fail[r["factory"]] += 1
            if len(fail_examples) < 10:
                fail_examples.append(r)

    total = len(rows)
    pass_count = by_verdict.get("PASS", 0)
    out = []
    out.append("# Active E2E parity report — single-call mode")
    out.append("")
    out.append(f"- Total calls: **{total}**")
    out.append(f"- PASS: {pass_count} ({100 * pass_count / total:.2f}%)")
    out.append("")
    out.append("## Verdict breakdown")
    out.append("")
    out.append("| Verdict | Count | % |")
    out.append("|---|---:|---:|")
    for v, n in sorted(by_verdict.items()):
        out.append(f"| {v} | {n} | {100 * n / total:.2f}% |")
    out.append("")
    out.append("## HTTP status breakdown")
    out.append("")
    out.append("| Status | Count |")
    out.append("|---|---:|")
    for s, n in sorted(by_status.items(), key=lambda kv: (-kv[1], kv[0])):
        out.append(f"| {s} | {n} |")
    out.append("")
    if fail_examples:
        out.append("## First 10 failure samples")
        out.append("")
        out.append("| Factory | Method | Endpoint | Status | Verdict | Notes |")
        out.append("|---|---|---|---:|---|---|")
        for r in fail_examples:
            ep = r["endpoint"][:60] + ("…" if len(r["endpoint"]) > 60 else "")
            note = (r.get("notes") or "")[:80]
            out.append(f"| {r['factory']} | {r['method']} | `{ep}` | {r['status']} | {r['verdict']} | {note} |")
        out.append("")
    if by_factory_fail:
        out.append("## Failures by factory")
        out.append("")
        out.append("| Factory | FAIL count |")
        out.append("|---|---:|")
        for f, n in sorted(by_factory_fail.items(), key=lambda kv: -kv[1]):
            out.append(f"| {f} | {n} |")
        out.append("")
    return "\n".join(out)


def report_replay_compare(rows):
    by_verdict = Counter(r["verdict"] for r in rows)
    diverge_examples = []
    err_examples = []
    for r in rows:
        if r["verdict"] == "diverge" and len(diverge_examples) < 10:
            diverge_examples.append(r)
        elif r["verdict"] in ("java_err", "python_err", "both_err") and len(err_examples) < 10:
            err_examples.append(r)

    total = len(rows)
    match = by_verdict.get("match", 0)
    out = []
    out.append("# Active E2E parity report — replay-compare mode")
    out.append("")
    out.append(f"- Total pairs: **{total}**")
    out.append(f"- Match: {match} ({100 * match / total:.4f}%)")
    out.append("")
    out.append("## Verdict breakdown")
    out.append("")
    out.append("| Verdict | Count | % |")
    out.append("|---|---:|---:|")
    for v, n in sorted(by_verdict.items()):
        out.append(f"| {v} | {n} | {100 * n / total:.2f}% |")
    out.append("")
    if diverge_examples:
        out.append("## First 10 divergence samples")
        out.append("")
        out.append("| Factory | Method | Endpoint | Java | Python | Diverge summary |")
        out.append("|---|---|---|---:|---:|---|")
        for r in diverge_examples:
            ep = r["endpoint"][:50] + ("…" if len(r["endpoint"]) > 50 else "")
            ds = (r.get("diverge_summary") or "")[:120]
            out.append(f"| {r['factory']} | {r['method']} | `{ep}` | "
                       f"{r['java']['http']} ({r['java']['size']}B) | "
                       f"{r['python']['http']} ({r['python']['size']}B) | "
                       f"{ds} |")
        out.append("")
    if err_examples:
        out.append("## First 10 error samples")
        out.append("")
        out.append("| Factory | Endpoint | Verdict | Detail |")
        out.append("|---|---|---|---|")
        for r in err_examples:
            ep = r["endpoint"][:50]
            d = (r.get("diverge_summary") or "")[:80]
            out.append(f"| {r['factory']} | `{ep}` | {r['verdict']} | {d} |")
        out.append("")

    if total > 0 and match / total >= 0.99:
        out.append("## Verdict: GO")
        out.append("")
        out.append(f"Match rate {100 * match / total:.4f}% ≥ Phase 2A threshold 99%.")
    elif total > 0:
        out.append("## Verdict: STOP")
        out.append("")
        out.append(f"Match rate {100 * match / total:.4f}% < Phase 2A threshold 99%. Investigate divergences before proceeding.")
    return "\n".join(out)


def main():
    if len(sys.argv) < 2:
        print("Usage: parity-report.py <results.ndjson> [more.ndjson ...]", file=sys.stderr)
        sys.exit(1)

    rows = []
    for p in sys.argv[1:]:
        rows.extend(load_ndjson(p))

    if not rows:
        print("No rows loaded.", file=sys.stderr)
        sys.exit(1)

    schema = detect_schema(rows)
    if schema == "single-call":
        print(report_single_call(rows))
    elif schema == "replay-compare":
        print(report_replay_compare(rows))
    else:
        print(f"Unknown NDJSON schema (sample row keys: {sorted(rows[0].keys())})", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
