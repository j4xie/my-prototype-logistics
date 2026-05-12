"""Parity-gate report renderers — JSON + HTML.

Top-level report shape (per Steve's spec):

    {
      "factory": "R_QINGHUAJIAO_REAL",
      "java_base": "http://...:10010",
      "python_base": "http://...:8083",
      "endpoints_tested": 15,
      "match_rate": 99.945,                  # percent, 3 decimals
      "endpoints_matched": 14,
      "endpoints_diverged": 1,
      "total_real_bugs": 3,
      "total_pattern_a": 27,
      "timestamp": "2026-05-12T10:30:00",
      "results": [
        {
          "endpoint": "/api/mobile/.../analysis/production",
          "params": "analysisType=overview&startDate=...",
          "verdict": "match" | "diverge" | "java_error" | "python_error",
          "java_http": 200,
          "python_http": 200,
          "java_size": 1234,
          "python_size": 1230,
          "java_lat_s": 0.123,
          "python_lat_s": 0.087,
          "dict_eq": {  # full dict_eq_match output if comparable
            "match": bool,
            "total_leaves": int,
            "matched_leaves": int,
            "diverges": [...REAL_BUG entries...],
            "tolerated_byte_diffs": [...PATTERN_A entries...]
          }
        },
        ...
      ]
    }
"""
from __future__ import annotations

import datetime
import html
import json
from pathlib import Path
from typing import Any, Dict, List


def build_report(
    factory: str,
    java_base: str,
    python_base: str,
    results: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Aggregate per-endpoint results into a report dict.

    Args:
        results: list of dicts each with fields:
            endpoint, params, java (fetch result), python (fetch result),
            dict_eq (None if fetch failed; dict_eq_match output otherwise),
            routing_pattern (optional: "java_deleted" | "both_gone" |
                "python_not_in_scope" — set by compare.classify_routing when
                an HTTP mismatch is a known Phase-C cutover artefact, NOT a
                regression).

    Verdict semantics (post-Phase-C aware):
        * match / diverge — body comparison ran and produced a result.
        * java_deleted — Java 404 (handler intentionally removed in Phase C)
          and Python served the path; counted as **matched** because the
          migration is exactly what was expected.
        * both_gone — Java 404 AND Python 4xx (e.g. 501 stub or 422 missing
          param). Logged separately; NOT counted as matched or diverged. F-1
          in the 2026-05-12 cohort sweep — latent coverage gap, not a
          regression.
        * python_not_in_scope — Python 404 and Java served the path
          (dashboards, smartbi-config/thresholds remain Java-only). Counted
          as matched on the Phase-C topology.
        * http_mismatch — any other HTTP status disagreement (still a real
          concern — investigate).
        * java_error / python_error — network error on that side.
    """
    total = len(results)
    matched = 0
    diverged = 0
    total_real_bugs = 0
    total_pattern_a = 0
    total_pattern_b = 0
    total_pattern_b_contexts = 0
    total_java_deleted = 0
    total_both_gone = 0
    total_python_not_in_scope = 0
    entries: List[Dict[str, Any]] = []

    for r in results:
        java_r = r["java"]
        python_r = r["python"]
        de = r.get("dict_eq")
        routing_pattern = r.get("routing_pattern")

        # Determine verdict for this endpoint. Routing patterns take precedence
        # over generic http_mismatch — when classify_routing tagged a known
        # Phase-C topology, the HTTP mismatch is expected, not a regression.
        if java_r["verdict"] == "network_error":
            verdict = "java_error"
        elif python_r["verdict"] == "network_error":
            verdict = "python_error"
        elif routing_pattern == "java_deleted":
            verdict = "java_deleted"
            matched += 1
            total_java_deleted += 1
        elif routing_pattern == "both_gone":
            verdict = "both_gone"
            total_both_gone += 1
        elif routing_pattern == "python_not_in_scope":
            verdict = "python_not_in_scope"
            matched += 1
            total_python_not_in_scope += 1
        elif java_r["http"] != python_r["http"]:
            verdict = "http_mismatch"
        elif de is None:
            verdict = "parse_error"
        elif de["match"]:
            verdict = "match"
            matched += 1
        else:
            verdict = "diverge"
            diverged += 1

        if de is not None:
            total_real_bugs += sum(
                1 for d in de["diverges"] if d.get("classification") == "REAL_BUG"
            )
            # tolerated entries may include Pattern A (auto) + Pattern B (opt-in).
            # Bucket per classification so the aggregate is honest.
            for d in de["tolerated_byte_diffs"]:
                c = d.get("classification")
                if c == "PATTERN_A_INT_COLLAPSE":
                    total_pattern_a += 1
                elif c == "PATTERN_B_STRUCTURAL":
                    total_pattern_b += 1
            if de.get("pattern_b_context"):
                total_pattern_b_contexts += 1

        entries.append(
            {
                "endpoint": r["endpoint"],
                "params": r.get("params", ""),
                "verdict": verdict,
                "routing_pattern": routing_pattern,
                "java_http": java_r["http"],
                "python_http": python_r["http"],
                "java_size": java_r["size"],
                "python_size": python_r["size"],
                "java_lat_s": java_r["lat_s"],
                "python_lat_s": python_r["lat_s"],
                "java_error": java_r.get("error"),
                "python_error": python_r.get("error"),
                "dict_eq": de,
            }
        )

    rate = (matched / total * 100) if total else 100.0
    return {
        "factory": factory,
        "java_base": java_base,
        "python_base": python_base,
        "endpoints_tested": total,
        "endpoints_matched": matched,
        "endpoints_diverged": diverged,
        "match_rate": round(rate, 3),
        "total_real_bugs": total_real_bugs,
        "total_pattern_a": total_pattern_a,
        "total_pattern_b": total_pattern_b,
        "endpoints_in_pattern_b_context": total_pattern_b_contexts,
        "total_java_deleted": total_java_deleted,
        "total_both_gone": total_both_gone,
        "total_python_not_in_scope": total_python_not_in_scope,
        "timestamp": datetime.datetime.now().isoformat(timespec="seconds"),
        "results": entries,
    }


def write_json(report: Dict[str, Any], output_path: str) -> None:
    """Write the report dict as pretty-printed JSON."""
    p = Path(output_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2, default=str)


def write_html(report: Dict[str, Any], output_path: str) -> None:
    """Write a side-by-side human-review HTML report."""
    p = Path(output_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(_render_html(report))


def _render_html(report: Dict[str, Any]) -> str:
    factory = html.escape(report["factory"])
    java_base = html.escape(report["java_base"])
    python_base = html.escape(report["python_base"])
    rate = report["match_rate"]
    rate_class = (
        "rate-pass" if rate >= 99.945 else "rate-warn" if rate >= 99.0 else "rate-fail"
    )

    rows = []
    for r in report["results"]:
        verdict_class = {
            "match": "verdict-match",
            "diverge": "verdict-diverge",
            "java_error": "verdict-error",
            "python_error": "verdict-error",
            "http_mismatch": "verdict-error",
            "parse_error": "verdict-error",
            "java_deleted": "verdict-routing",
            "python_not_in_scope": "verdict-routing",
            "both_gone": "verdict-routing-warn",
        }.get(r["verdict"], "")

        diverges_html = ""
        if r["dict_eq"]:
            de = r["dict_eq"]
            if de["diverges"]:
                diverges_html = "<details><summary>{n} REAL_BUG</summary><table class='diverge-table'>".format(
                    n=len(de["diverges"])
                )
                diverges_html += "<tr><th>path</th><th>java</th><th>python</th></tr>"
                for d in de["diverges"][:50]:
                    diverges_html += "<tr><td>{}</td><td>{}</td><td>{}</td></tr>".format(
                        html.escape(str(d["path"])),
                        html.escape(str(d["java"]))[:200],
                        html.escape(str(d["python"]))[:200],
                    )
                if len(de["diverges"]) > 50:
                    diverges_html += "<tr><td colspan=3>... +{} more</td></tr>".format(
                        len(de["diverges"]) - 50
                    )
                diverges_html += "</table></details>"
            if de["tolerated_byte_diffs"]:
                diverges_html += "<details><summary class='pattern-a'>{n} PATTERN_A (tolerated)</summary>".format(
                    n=len(de["tolerated_byte_diffs"])
                )
                diverges_html += "<table class='diverge-table'>"
                diverges_html += "<tr><th>path</th><th>java</th><th>python</th></tr>"
                for d in de["tolerated_byte_diffs"][:20]:
                    diverges_html += "<tr><td>{}</td><td>{}</td><td>{}</td></tr>".format(
                        html.escape(str(d["path"])),
                        html.escape(str(d["java"])),
                        html.escape(str(d["python"])),
                    )
                if len(de["tolerated_byte_diffs"]) > 20:
                    diverges_html += "<tr><td colspan=3>... +{} more</td></tr>".format(
                        len(de["tolerated_byte_diffs"]) - 20
                    )
                diverges_html += "</table></details>"

        params_html = html.escape(r.get("params", ""))
        rows.append(
            f"""<tr class="{verdict_class}">
                <td>{html.escape(r['endpoint'])}<br><small>{params_html}</small></td>
                <td>{r['java_http']} ({r['java_size']} B / {r['java_lat_s']}s)</td>
                <td>{r['python_http']} ({r['python_size']} B / {r['python_lat_s']}s)</td>
                <td class="verdict">{r['verdict']}</td>
                <td>{diverges_html}</td>
            </tr>"""
        )

    rows_html = "\n".join(rows)

    return f"""<!doctype html>
<html><head>
<meta charset="utf-8">
<title>Parity Gate Report — {factory}</title>
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 20px; }}
h1 {{ margin-bottom: 4px; }}
.summary {{ background: #f6f8fa; padding: 16px; border-radius: 6px; margin-bottom: 24px; }}
.summary .rate {{ font-size: 32px; font-weight: bold; }}
.rate-pass {{ color: #1a7f37; }}
.rate-warn {{ color: #9a6700; }}
.rate-fail {{ color: #cf222e; }}
table {{ border-collapse: collapse; width: 100%; font-size: 14px; }}
th, td {{ border: 1px solid #d0d7de; padding: 8px; text-align: left; vertical-align: top; }}
th {{ background: #f6f8fa; font-weight: 600; }}
.verdict-match {{ background: #dafbe1; }}
.verdict-diverge {{ background: #fff8c5; }}
.verdict-error {{ background: #ffebe9; }}
.verdict-routing {{ background: #ddf4ff; }}
.verdict-routing-warn {{ background: #fff1e5; }}
.verdict {{ font-weight: 600; font-family: monospace; }}
details {{ margin-top: 4px; }}
summary {{ cursor: pointer; font-size: 12px; }}
summary.pattern-a {{ color: #6e7781; }}
.diverge-table {{ font-size: 12px; margin-top: 4px; font-family: monospace; }}
.diverge-table td {{ padding: 4px; max-width: 400px; word-break: break-all; }}
</style>
</head><body>
<h1>Parity Gate Report — {factory}</h1>
<div class="summary">
  <div class="rate {rate_class}">{rate}% match</div>
  <div>{report['endpoints_matched']}/{report['endpoints_tested']} endpoints matched
       ({report['endpoints_diverged']} diverged · {report['total_real_bugs']} REAL_BUG
       · {report['total_pattern_a']} PATTERN_A tolerated
       · {report.get('total_java_deleted', 0)} java_deleted
       · {report.get('total_both_gone', 0)} both_gone
       · {report.get('total_python_not_in_scope', 0)} python_not_in_scope)</div>
  <div>Java: <code>{java_base}</code> · Python: <code>{python_base}</code></div>
  <div>Generated: {report['timestamp']}</div>
  <div><small>Phase 2A standard: ≥99.945% dict-eq match (T6.1 dryrun bar).</small></div>
</div>
<table>
<tr><th>Endpoint</th><th>Java</th><th>Python</th><th>Verdict</th><th>Details</th></tr>
{rows_html}
</table>
</body></html>
"""


def load_report(path: str) -> Dict[str, Any]:
    """Read a previously written JSON report."""
    with open(path, encoding="utf-8") as f:
        return json.load(f)
