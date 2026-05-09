#!/usr/bin/env python3
"""scripts/active-e2e/curl-replay/replay-and-compare.py

Active E2E framework v1 — dual-call dict-eq sidecar with NDJSON logging.

Replays each (factory × endpoint) pair against TWO base URLs (e.g. Java prod
:10010 and Python prod :8083) and compares the parsed JSON via dict-eq
(volatile keys stripped per Phase 2A standard / Chat F/G dispatcher).

Distinct from curl-replay/record-batch.sh:
  - record-batch.sh hits ONE base URL and asserts status/marker.
  - replay-and-compare.py hits TWO base URLs and asserts response equivalence.

Use after a Python cutover step to verify Python's response matches the
historical Java baseline (or to live-compare during dryrun).

NDJSON schema (one line per call pair):
  {
    "ts": "2026-05-09T13:01:00",
    "factory": "F002",
    "method": "GET",
    "endpoint": "/api/mobile/{factoryId}/smart-bi/analysis/sales?...",
    "java": {"http": 200, "lat_s": 0.123, "size": 8421},
    "python": {"http": 200, "lat_s": 0.087, "size": 8419},
    "verdict": "match" | "diverge" | "java_err" | "python_err" | "both_err",
    "diverge_summary": null | "<key path or 'shape mismatch'>"
  }
"""
import argparse
import asyncio
import json
import os
import sys
import time
from typing import Any, Dict, List, Tuple

import jwt
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


VOLATILE_KEYS = frozenset({"generatedAt", "lastUpdated", "cacheExpireAt", "timestamp", "dataVersion"})


def strip_volatile(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: strip_volatile(v) for k, v in obj.items() if k not in VOLATILE_KEYS}
    if isinstance(obj, list):
        return [strip_volatile(item) for item in obj]
    return obj


def make_token(factory_id: str, secret: str) -> str:
    payload = {
        "userId": 1,
        "username": "active_e2e_replay",
        "factoryId": factory_id,
        "role": "factory_super_admin",
        "exp": int(time.time()) + 3600,
    }
    tok = jwt.encode(payload, secret, algorithm="HS256")
    return tok if isinstance(tok, str) else tok.decode("utf-8")


def fetch(base_url: str, factory_id: str, method: str, path_template: str, token: str) -> Dict[str, Any]:
    url = base_url + path_template.replace("{factoryId}", factory_id)
    headers = {"Authorization": f"Bearer {token}"}
    data = None
    if method in ("POST", "PUT"):
        headers["Content-Type"] = "application/json"
        data = b"{}"
    req = Request(url, headers=headers, method=method, data=data)

    t0 = time.time()
    try:
        with urlopen(req, timeout=20) as resp:
            body = resp.read()
            return {
                "http": resp.status,
                "lat_s": round(time.time() - t0, 3),
                "size": len(body),
                "body": body,
            }
    except HTTPError as e:
        try:
            body = e.read()
        except Exception:
            body = b""
        return {"http": e.code, "lat_s": round(time.time() - t0, 3), "size": len(body), "body": body}
    except (URLError, OSError) as e:
        return {"http": -1, "lat_s": round(time.time() - t0, 3), "size": 0, "body": b"",
                "error": str(e)[:200]}


def compare_one(java_resp: Dict, python_resp: Dict) -> Tuple[str, str]:
    """Returns (verdict, diverge_summary)."""
    if java_resp["http"] < 0 and python_resp["http"] < 0:
        return "both_err", f"java={java_resp.get('error')}, python={python_resp.get('error')}"
    if java_resp["http"] < 0:
        return "java_err", java_resp.get("error", "unknown")
    if python_resp["http"] < 0:
        return "python_err", python_resp.get("error", "unknown")
    if java_resp["http"] != python_resp["http"]:
        return "diverge", f"http {java_resp['http']} vs {python_resp['http']}"
    try:
        java_obj = json.loads(java_resp["body"].decode("utf-8"))
        python_obj = json.loads(python_resp["body"].decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        return "diverge", f"parse error: {e}"

    java_stripped = strip_volatile(java_obj)
    python_stripped = strip_volatile(python_obj)

    if java_stripped == python_stripped:
        return "match", None

    return "diverge", _diverge_summary(java_stripped, python_stripped)


def _diverge_summary(a: Any, b: Any, path: str = "") -> str:
    """First-encountered divergence path, lightweight."""
    if type(a) is not type(b):
        return f"{path or '<root>'}: type {type(a).__name__} vs {type(b).__name__}"
    if isinstance(a, dict):
        a_keys, b_keys = set(a.keys()), set(b.keys())
        only_a = a_keys - b_keys
        only_b = b_keys - a_keys
        if only_a or only_b:
            return f"{path or '<root>'}: keys diff (java only={sorted(only_a)[:3]}, python only={sorted(only_b)[:3]})"
        for k in a_keys:
            sub = _diverge_summary(a[k], b[k], f"{path}.{k}" if path else k)
            if sub:
                return sub
        return None
    if isinstance(a, list):
        if len(a) != len(b):
            return f"{path}: list length {len(a)} vs {len(b)}"
        for i in range(len(a)):
            sub = _diverge_summary(a[i], b[i], f"{path}[{i}]")
            if sub:
                return sub
        return None
    if a != b:
        a_str = json.dumps(a)[:80]
        b_str = json.dumps(b)[:80]
        return f"{path}: {a_str} vs {b_str}"
    return None


def load_endpoints(path: str) -> List[Tuple[str, str]]:
    out = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split(maxsplit=1)
            if len(parts) != 2:
                raise ValueError(f"bad line: {line!r}")
            out.append((parts[0].upper(), parts[1]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--java-base", required=True, help="e.g. http://47.100.235.168:10010")
    ap.add_argument("--python-base", required=True, help="e.g. http://47.100.235.168:8083")
    ap.add_argument("--factories", required=True, help="comma list (e.g. F002,F003) or 'F999' or 'F001'")
    ap.add_argument("--endpoints", required=True, help="preset file path")
    ap.add_argument("--output", required=True, help="NDJSON output path")
    ap.add_argument("--duration", default="0", help="repeat for this many seconds (0 = single pass)")
    ap.add_argument("--interval", type=int, default=30, help="seconds between repeats")
    args = ap.parse_args()

    secret = os.environ.get("JWT_SECRET")
    if not secret:
        print("ERROR: JWT_SECRET env required", file=sys.stderr)
        sys.exit(1)

    factories = [s.strip() for s in args.factories.split(",") if s.strip()]
    endpoints = load_endpoints(args.endpoints)
    tokens = {fid: make_token(fid, secret) for fid in factories}

    duration_s = _parse_duration(args.duration)
    t_start = time.time()
    rounds = 0

    print(f"Replay-and-compare:")
    print(f"  java:    {args.java_base}")
    print(f"  python:  {args.python_base}")
    print(f"  N×M:     {len(factories)} × {len(endpoints)} = {len(factories) * len(endpoints)} pairs/round")
    print(f"  duration: {args.duration} (interval {args.interval}s)")
    print(f"  output:  {args.output}")
    print()

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    out_f = open(args.output, "w", encoding="utf-8")

    counters = {"match": 0, "diverge": 0, "java_err": 0, "python_err": 0, "both_err": 0}

    try:
        while True:
            rounds += 1
            for fid in factories:
                for method, path in endpoints:
                    java_r = fetch(args.java_base, fid, method, path, tokens[fid])
                    python_r = fetch(args.python_base, fid, method, path, tokens[fid])
                    verdict, summary = compare_one(java_r, python_r)
                    counters[verdict] = counters.get(verdict, 0) + 1
                    out_f.write(json.dumps({
                        "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
                        "factory": fid,
                        "method": method,
                        "endpoint": path,
                        "java": {"http": java_r["http"], "lat_s": java_r["lat_s"], "size": java_r["size"]},
                        "python": {"http": python_r["http"], "lat_s": python_r["lat_s"], "size": python_r["size"]},
                        "verdict": verdict,
                        "diverge_summary": summary,
                    }, ensure_ascii=False) + "\n")
                    out_f.flush()
            elapsed = time.time() - t_start
            print(f"  round {rounds} done @ +{elapsed:.0f}s — match={counters['match']} diverge={counters['diverge']} err={counters['java_err']+counters['python_err']+counters['both_err']}")
            if duration_s == 0 or elapsed >= duration_s:
                break
            sleep_left = max(0, args.interval - (time.time() % args.interval))
            time.sleep(sleep_left)
    finally:
        out_f.close()

    total = sum(counters.values())
    match_rate = (counters["match"] / total) if total else 0.0
    print(f"\nTotals: {counters} ({total} pairs, match_rate={match_rate:.4%})")
    if counters["diverge"] + counters["java_err"] + counters["python_err"] + counters["both_err"] == 0:
        sys.exit(0)
    if match_rate >= 0.99:
        # Phase 2A standard: ≥99% match acceptable
        sys.exit(0)
    sys.exit(1)


def _parse_duration(s: str) -> int:
    if not s:
        return 0
    s = s.strip()
    if s == "0":
        return 0
    suffix_map = {"s": 1, "m": 60, "h": 3600, "d": 86400}
    if s[-1] in suffix_map:
        return int(s[:-1]) * suffix_map[s[-1]]
    return int(s)


if __name__ == "__main__":
    main()
