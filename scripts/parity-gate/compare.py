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
) -> Dict[str, Any]:
    """Fetch one endpoint pair, run dict_eq_match, return assembled entry.

    When fixtures are supplied (offline mode), HTTP is skipped entirely
    and the fixture JSON is treated as the parsed response body. This is
    how the self-test gate runs without live Java/Python servers.
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

    # Run dict_eq only if both responses parsed successfully.
    de: Optional[Dict[str, Any]] = None
    if java_r["data"] is not None and python_r["data"] is not None:
        de = dict_eq.dict_eq_match(java_r["data"], python_r["data"])

    return {
        "endpoint": path,
        "params": params,
        "java": java_r,
        "python": python_r,
        "dict_eq": de,
    }


def run_batch(
    factory_id: str,
    endpoints: List[Tuple[str, str, str]],
    java_base: Optional[str],
    python_base: Optional[str],
    java_token: Optional[str] = None,
    timeout: int = 20,
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
            java_base=args.java_base,
            python_base=args.python_base,
            timeout=args.timeout,
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
    print(
        f"\nmatch_rate={rate}% "
        f"({result['endpoints_matched']}/{result['endpoints_tested']} matched, "
        f"{result['total_real_bugs']} REAL_BUG, "
        f"{result['total_pattern_a']} PATTERN_A tolerated)",
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
