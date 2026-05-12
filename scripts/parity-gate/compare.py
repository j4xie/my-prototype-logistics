"""parity-gate CLI — main entry point.

Usage examples:

    # Single endpoint
    python scripts/parity-gate/compare.py \\
        --factory R_QINGHUAJIAO_REAL \\
        --endpoint '/api/mobile/{factory_id}/smart-bi/analysis/production' \\
        --params 'analysisType=overview&startDate=2026-01-01&endDate=2026-01-31' \\
        --java-base http://47.100.235.168:10010 \\
        --python-base http://47.100.235.168:8083 \\
        --output report.json

    # Batch from preset file or spec doc
    python scripts/parity-gate/compare.py \\
        --factory R_ILTEATRO_REAL \\
        --endpoint-list scripts/parity-gate/presets/production.txt \\
        --output-dir reports/

    # Offline self-test using local JSON fixtures (no HTTP needed)
    python scripts/parity-gate/compare.py \\
        --factory R_TEST_MOCK \\
        --endpoint '/api/mobile/{factory_id}/smart-bi/analysis/production' \\
        --params 'analysisType=overview&startDate=2026-01-01&endDate=2026-01-31' \\
        --fixtures-java fixtures/java/prod-overview.json \\
        --fixtures-python fixtures/python/prod-overview.json \\
        --output report.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Allow running as a script without installing as a package.
_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

import dict_eq          # noqa: E402
import endpoint_list    # noqa: E402
import fetch_endpoint   # noqa: E402
import report           # noqa: E402


def _attach_query(path: str, params: str) -> str:
    """Append ?params to path (unless path already has ?)."""
    if not params:
        return path
    sep = "&" if "?" in path else "?"
    return f"{path}{sep}{params}"


def classify_routing(
    java_http: int,
    python_http: int,
    tolerate_java_deleted: bool = True,
    tolerate_python_not_in_scope: bool = True,
) -> Optional[str]:
    """Phase-C cutover routing classifier.

    Returns one of:
        ``"java_deleted"``         — Java 404 (handler removed in Phase C),
                                     Python served the path with 2xx.
        ``"both_gone"``            — Java 404 AND Python 4xx. Latent coverage
                                     gap (e.g. /analysis/finance?analysisType=
                                     overview): F-1 in 2026-05-12 cohort sweep.
        ``"python_not_in_scope"``  — Python 404, Java served with 2xx. Java-only
                                     paths (/dashboard*, /smartbi-config/*).
        ``None``                   — no routing pattern applies; defer to the
                                     normal http_mismatch / dict_eq logic.

    Tolerance flags control whether the classification fires at all. When both
    are False the function returns None for every input — the harness reverts
    to pre-F-2 behaviour. Default both True because we're post-Phase-C and the
    HTTP mismatches caught by these patterns are EXPECTED, not regressions
    (see 2026-05-12 cohort sweep §4: zero genuine REAL_BUG behind 102 runs).
    """
    if java_http == 404 and 200 <= python_http < 300 and tolerate_java_deleted:
        return "java_deleted"
    if (
        java_http == 404
        and 400 <= python_http < 600
        and tolerate_java_deleted
    ):
        return "both_gone"
    if (
        python_http == 404
        and 200 <= java_http < 300
        and tolerate_python_not_in_scope
    ):
        return "python_not_in_scope"
    return None


def _load_fixture(path: Optional[str]) -> Optional[Any]:
    """Read a JSON fixture file. Returns None if path is falsy."""
    if not path:
        return None
    p = Path(path)
    if not p.is_file():
        raise FileNotFoundError(f"fixture not found: {path}")
    return json.loads(p.read_text(encoding="utf-8"))


def run_single(
    factory_id: str,
    method: str,
    path: str,
    params: str,
    java_base: Optional[str],
    python_base: Optional[str],
    java_fixture: Optional[Any] = None,
    python_fixture: Optional[Any] = None,
    java_token: Optional[str] = None,
    timeout: int = 20,
    tolerate_all: bool = False,
    tolerate_patterns: Optional[set] = None,
    tolerate_java_deleted: bool = True,
    tolerate_python_not_in_scope: bool = True,
) -> Dict[str, Any]:
    """Fetch one endpoint pair, classify routing, run dict_eq_match, return entry.

    Routing classification (F-2 / Phase-C cutover): when the HTTP-status pair
    matches a known Phase-C topology (Java handler deleted, Python-only or
    Java-only) we tag ``routing_pattern`` and SKIP dict_eq. Otherwise dict_eq
    runs as before and may produce REAL_BUG / Pattern A/B diverges.

    When fixtures are supplied (offline mode), HTTP is skipped entirely and
    the fixture JSON is treated as a parsed 200 response body. Routing
    classification still consults the synthesised http codes so fixtures
    representing 404 shells exercise the same path.
    """
    full_path = _attach_query(path, params)

    if java_fixture is not None and python_fixture is not None:
        # Offline mode — synthesize fetch-result shapes.
        java_r = {
            "url": f"<fixture> {full_path}",
            "http": 200,
            "lat_s": 0.0,
            "size": len(json.dumps(java_fixture, ensure_ascii=False)),
            "raw": json.dumps(java_fixture, ensure_ascii=False),
            "data": java_fixture,
            "error": None,
            "verdict": "ok",
        }
        python_r = {
            "url": f"<fixture> {full_path}",
            "http": 200,
            "lat_s": 0.0,
            "size": len(json.dumps(python_fixture, ensure_ascii=False)),
            "raw": json.dumps(python_fixture, ensure_ascii=False),
            "data": python_fixture,
            "error": None,
            "verdict": "ok",
        }
    else:
        if not java_base or not python_base:
            raise ValueError(
                "java_base + python_base required when fixtures are absent"
            )
        if java_token is None:
            java_token = fetch_endpoint.make_jwt_token(factory_id)
        pair = fetch_endpoint.fetch_pair(
            java_base,
            python_base,
            full_path,
            factory_id,
            java_token,
            method=method,
            timeout=timeout,
        )
        java_r = pair["java"]
        python_r = pair["python"]

    # Classify routing FIRST: when Phase-C deleted the Java handler the 404
    # shell parses as JSON and dict_eq would generate dozens of bogus REAL_BUG
    # entries comparing it against Python's real payload (F-2 finding).
    routing_pattern: Optional[str] = None
    if java_r["verdict"] != "network_error" and python_r["verdict"] != "network_error":
        routing_pattern = classify_routing(
            java_r["http"],
            python_r["http"],
            tolerate_java_deleted=tolerate_java_deleted,
            tolerate_python_not_in_scope=tolerate_python_not_in_scope,
        )

    # Run dict_eq only if both responses parsed AND we're not in a routing
    # pattern (the routing patterns intentionally compare different-shape
    # envelopes — dict_eq output would be noise).
    de: Optional[Dict[str, Any]] = None
    if (
        routing_pattern is None
        and java_r["data"] is not None
        and python_r["data"] is not None
    ):
        de = dict_eq.dict_eq_match(java_r["data"], python_r["data"])
        if tolerate_all or tolerate_patterns:
            de = dict_eq.apply_tolerance(
                de,
                tolerate_all=tolerate_all,
                tolerate_patterns=tolerate_patterns,
            )

    return {
        "endpoint": path,
        "params": params,
        "java": java_r,
        "python": python_r,
        "dict_eq": de,
        "routing_pattern": routing_pattern,
    }


def run_batch(
    factory_id: str,
    endpoints: List[Tuple[str, str, str]],
    java_base: Optional[str],
    python_base: Optional[str],
    java_token: Optional[str] = None,
    timeout: int = 20,
    tolerate_all: bool = False,
    tolerate_patterns: Optional[set] = None,
    tolerate_java_deleted: bool = True,
    tolerate_python_not_in_scope: bool = True,
) -> Dict[str, Any]:
    """Run parity gate over multiple endpoints, build aggregate report."""
    if java_token is None and java_base:
        java_token = fetch_endpoint.make_jwt_token(factory_id)

    results = []
    for method, path, params in endpoints:
        entry = run_single(
            factory_id,
            method,
            path,
            params,
            java_base=java_base,
            python_base=python_base,
            java_token=java_token,
            timeout=timeout,
            tolerate_all=tolerate_all,
            tolerate_patterns=tolerate_patterns,
            tolerate_java_deleted=tolerate_java_deleted,
            tolerate_python_not_in_scope=tolerate_python_not_in_scope,
        )
        results.append(entry)

    return report.build_report(
        factory=factory_id,
        java_base=java_base or "<fixtures>",
        python_base=python_base or "<fixtures>",
        results=results,
    )


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(
        description="Phase 2A dict-eq parity-gate compare harness.",
    )
    p.add_argument("--factory", required=True, help="factory_id (e.g. R_TEST_MOCK)")
    p.add_argument(
        "--endpoint",
        help="Single endpoint path (with optional ?params or use --params)",
    )
    p.add_argument(
        "--endpoint-list",
        help="File listing endpoints (.md = spec doc auto-extract; else preset)",
    )
    p.add_argument("--method", default="GET", help="HTTP method (default GET)")
    p.add_argument("--params", default="", help="Query string for --endpoint mode")
    p.add_argument("--java-base", help="e.g. http://47.100.235.168:10010")
    p.add_argument("--python-base", help="e.g. http://47.100.235.168:8083")
    p.add_argument(
        "--fixtures-java",
        help="Offline mode: read Java response from this JSON file instead of HTTP.",
    )
    p.add_argument(
        "--fixtures-python",
        help="Offline mode: read Python response from this JSON file instead of HTTP.",
    )
    p.add_argument(
        "--jwt-secret",
        help="Override $JWT_SECRET env var.",
    )
    p.add_argument("--timeout", type=int, default=20)
    p.add_argument(
        "--output",
        help="Output JSON path (single-mode default: stdout). Also writes a "
        ".html sibling automatically.",
    )
    p.add_argument(
        "--output-dir",
        help="Batch-mode dir; writes <dir>/<factory>.json + <factory>.html",
    )
    p.add_argument(
        "--gate-rate",
        type=float,
        default=99.945,
        help="Exit non-zero if match_rate < this (default 99.945, Phase 2A bar)",
    )
    p.add_argument(
        "--tolerate-divergence",
        action="store_true",
        help=(
            "Tolerate ALL classified divergence patterns (move them from "
            "diverges into tolerated_byte_diffs). REAL_BUG still fails. "
            "Per Sub-A spec §6.1 informational-only factory parity mode."
        ),
    )
    p.add_argument(
        "--tolerate-divergence-patterns",
        default="",
        help=(
            "Comma-separated pattern letters to tolerate (e.g. 'B' or 'A,B'). "
            "Valid: A (int-collapse), A2 (trailing-zero, post-parse invisible), "
            "B (structural Java mock vs Python tenant envelope), "
            "C (value placeholder, not auto-detected), "
            "X (java_deleted), Y (both_gone), Z (python_not_in_scope). "
            "Overrides --tolerate-divergence when set. "
            "X/Y/Z are HTTP-layer — the canonical flags are "
            "--tolerate-java-deleted and --tolerate-python-not-in-scope."
        ),
    )
    # F-2 fix (2026-05-12 cohort sweep finding) — Phase-C cutover topology
    # awareness. Defaults are ON because we ARE post-Phase-C — the previous
    # default of 'compare every HTTP-mismatched body byte by byte' produced
    # 4-7 false-positive REAL_BUG per row across the cohort sweep. The flags
    # exist so a pre-Phase-C run (historical replay) can opt back out.
    p.add_argument(
        "--tolerate-java-deleted",
        dest="tolerate_java_deleted",
        action="store_true",
        default=True,
        help=(
            "Treat Java 404 + Python 2xx as java_deleted (matched) and "
            "Java 404 + Python 4xx as both_gone (logged, NOT REAL_BUG). "
            "Default ON post-Phase-C. Pass --no-tolerate-java-deleted to "
            "revert to strict http_mismatch verdict."
        ),
    )
    p.add_argument(
        "--no-tolerate-java-deleted",
        dest="tolerate_java_deleted",
        action="store_false",
        help="Disable --tolerate-java-deleted (strict mode).",
    )
    p.add_argument(
        "--tolerate-python-not-in-scope",
        dest="tolerate_python_not_in_scope",
        action="store_true",
        default=True,
        help=(
            "Treat Python 404 + Java 2xx as python_not_in_scope (matched). "
            "Java-only paths (/dashboard*, /smartbi-config/*) stay this way "
            "by design — see 2026-05-12 cohort sweep §1 topology. Default ON."
        ),
    )
    p.add_argument(
        "--no-tolerate-python-not-in-scope",
        dest="tolerate_python_not_in_scope",
        action="store_false",
        help="Disable --tolerate-python-not-in-scope (strict mode).",
    )
    # Task B — BG-aware Java port detection. Opt-in by flag because explicit
    # --java-base http://...:10010 should keep working unchanged.
    p.add_argument(
        "--java-bg-fallback",
        action="store_true",
        default=False,
        help=(
            "Probe both Blue (10010) and Green (10020) Java ports and use "
            "whichever answers /api/mobile/health with 200. Prevents 88/88 "
            "false-positive 'Connection refused' when the BG slot flips mid-"
            "task (PR #403 §6 hardening). Cached per-process. Only fires when "
            "--java-base ends in :10010 or :10020."
        ),
    )
    args = p.parse_args(argv)

    if not args.endpoint and not args.endpoint_list:
        p.error("Either --endpoint or --endpoint-list must be supplied")

    # Resolve JWT secret if provided.
    if args.jwt_secret:
        import os
        os.environ["JWT_SECRET"] = args.jwt_secret

    # Build endpoint list.
    endpoints: List[Tuple[str, str, str]]
    if args.endpoint_list:
        endpoints = endpoint_list.auto_parse(args.endpoint_list)
        if not endpoints:
            p.error(f"endpoint-list {args.endpoint_list} parsed to 0 entries")
    else:
        endpoints = [(args.method.upper(), args.endpoint, args.params)]

    # Validate fixture-arg pair BEFORE loading either (so missing-one yields
    # SystemExit instead of FileNotFoundError).
    if bool(args.fixtures_java) != bool(args.fixtures_python):
        p.error("Both --fixtures-java AND --fixtures-python required (offline mode)")

    if args.fixtures_java and len(endpoints) > 1:
        p.error("Fixtures mode supports only --endpoint (single), not --endpoint-list")

    java_fixture = _load_fixture(args.fixtures_java)
    python_fixture = _load_fixture(args.fixtures_python)

    # Parse tolerance config (fail loudly on unknown pattern letters).
    try:
        tolerate_patterns = dict_eq.parse_patterns_arg(args.tolerate_divergence_patterns)
    except ValueError as e:
        p.error(str(e))

    tolerate_all = bool(args.tolerate_divergence) and tolerate_patterns is None

    # Resolve BG slot before any live fetch. resolve_java_base is a no-op for
    # fixture mode and for explicit non-BG ports.
    resolved_java_base = args.java_base
    if args.java_base and java_fixture is None:
        resolved_java_base = fetch_endpoint.resolve_java_base(
            args.java_base,
            bg_fallback=args.java_bg_fallback,
        )

    # Run.
    if java_fixture is not None:
        method, path, params = endpoints[0]
        entry = run_single(
            args.factory,
            method,
            path,
            params,
            java_base=None,
            python_base=None,
            java_fixture=java_fixture,
            python_fixture=python_fixture,
            tolerate_all=tolerate_all,
            tolerate_patterns=tolerate_patterns,
            tolerate_java_deleted=args.tolerate_java_deleted,
            tolerate_python_not_in_scope=args.tolerate_python_not_in_scope,
        )
        result = report.build_report(
            factory=args.factory,
            java_base="<fixture>",
            python_base="<fixture>",
            results=[entry],
        )
    else:
        result = run_batch(
            args.factory,
            endpoints,
            java_base=resolved_java_base,
            python_base=args.python_base,
            timeout=args.timeout,
            tolerate_all=tolerate_all,
            tolerate_patterns=tolerate_patterns,
            tolerate_java_deleted=args.tolerate_java_deleted,
            tolerate_python_not_in_scope=args.tolerate_python_not_in_scope,
        )

    # Write output.
    if args.output_dir:
        out_json = Path(args.output_dir) / f"{args.factory}.json"
        out_html = Path(args.output_dir) / f"{args.factory}.html"
        report.write_json(result, str(out_json))
        report.write_html(result, str(out_html))
        print(f"Wrote {out_json}", file=sys.stderr)
        print(f"Wrote {out_html}", file=sys.stderr)
    elif args.output:
        report.write_json(result, args.output)
        html_path = args.output.replace(".json", ".html")
        if html_path != args.output:
            report.write_html(result, html_path)
            print(f"Wrote {args.output}", file=sys.stderr)
            print(f"Wrote {html_path}", file=sys.stderr)
        else:
            print(f"Wrote {args.output}", file=sys.stderr)
    else:
        json.dump(result, sys.stdout, ensure_ascii=False, indent=2, default=str)
        print()

    # Gate.
    rate = result["match_rate"]
    routing_summary = ""
    routing_total = (
        result.get("total_java_deleted", 0)
        + result.get("total_both_gone", 0)
        + result.get("total_python_not_in_scope", 0)
    )
    if routing_total:
        routing_summary = (
            f", {result.get('total_java_deleted', 0)} java_deleted"
            f", {result.get('total_both_gone', 0)} both_gone"
            f", {result.get('total_python_not_in_scope', 0)} python_not_in_scope"
        )
    print(
        f"\nmatch_rate={rate}% "
        f"({result['endpoints_matched']}/{result['endpoints_tested']} matched, "
        f"{result['total_real_bugs']} REAL_BUG, "
        f"{result['total_pattern_a']} PATTERN_A tolerated{routing_summary})",
        file=sys.stderr,
    )
    if rate < args.gate_rate:
        print(
            f"GATE FAIL: match_rate {rate}% < threshold {args.gate_rate}%",
            file=sys.stderr,
        )
        return 1
    print(f"GATE PASS: match_rate {rate}% ≥ threshold {args.gate_rate}%", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
