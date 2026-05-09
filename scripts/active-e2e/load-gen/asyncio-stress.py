#!/usr/bin/env python3
"""scripts/active-e2e/load-gen/asyncio-stress.py

Active E2E framework v1 — asyncio + aiohttp 76-factory stress sample.

Generates short (default 5 min) sustained load against the target service to:
  - confirm Python multi-worker (uvicorn N=2) doesn't queue / leak under realistic concurrency
  - surface p99 latency / error-rate trends that 0-customer-traffic state otherwise hides
  - warm caches for the active E2E flow that follows

Distinct from curl-replay/record-batch.sh:
  - record-batch hits each (factory × endpoint) ONCE for assertion.
  - asyncio-stress repeatedly hits a sample for `duration` seconds at fixed concurrency.

Output: latency histogram + error counts to stdout + optional NDJSON for CI grep.

Usage:
  JWT_SECRET=<...> python3 asyncio-stress.py \
    --base-url http://47.100.235.168:8083 \
    --factories F002,F003 \
    --endpoints scripts/active-e2e/curl-replay/preset-analysis-22.txt \
    --duration 5m --concurrency 50

Dependencies: aiohttp, pyjwt. Both already in backend/python/requirements.txt.
"""
import argparse
import asyncio
import json
import os
import statistics
import sys
import time
from collections import Counter
from typing import List, Tuple

try:
    import aiohttp
except ImportError:
    print("ERROR: aiohttp not installed (pip install aiohttp)", file=sys.stderr)
    sys.exit(1)

try:
    import jwt
except ImportError:
    print("ERROR: PyJWT not installed (pip install pyjwt)", file=sys.stderr)
    sys.exit(1)


def make_token(factory_id: str, secret: str) -> str:
    payload = {
        "userId": 1,
        "username": "active_e2e_load",
        "factoryId": factory_id,
        "role": "factory_super_admin",
        "exp": int(time.time()) + 3600,
    }
    tok = jwt.encode(payload, secret, algorithm="HS256")
    return tok if isinstance(tok, str) else tok.decode("utf-8")


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


async def worker(name, session, base_url, jobs, results, deadline):
    while time.monotonic() < deadline:
        try:
            fid, method, path, token = jobs[(int(time.monotonic() * 1000)) % len(jobs)]
        except IndexError:
            return
        url = base_url + path.replace("{factoryId}", fid)
        headers = {"Authorization": f"Bearer {token}"}
        body = b"{}" if method in ("POST", "PUT") else None
        if body is not None:
            headers["Content-Type"] = "application/json"

        t0 = time.monotonic()
        status = 0
        err = None
        try:
            async with session.request(method, url, headers=headers, data=body, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                await resp.read()
                status = resp.status
        except asyncio.TimeoutError:
            err = "timeout"
        except aiohttp.ClientError as e:
            err = type(e).__name__
        except Exception as e:
            err = type(e).__name__
        elapsed = time.monotonic() - t0
        results.append((status, elapsed, err))


async def run(args):
    secret = os.environ["JWT_SECRET"]
    factories = [f.strip() for f in args.factories.split(",") if f.strip()]
    endpoints = load_endpoints(args.endpoints)
    duration_s = _parse_duration(args.duration)
    deadline = time.monotonic() + duration_s

    print(f"Active E2E load-gen:")
    print(f"  base:        {args.base_url}")
    print(f"  factories:   {len(factories)} ({args.factories})")
    print(f"  endpoints:   {len(endpoints)}")
    print(f"  duration:    {args.duration}")
    print(f"  concurrency: {args.concurrency}")
    print()

    tokens = {fid: make_token(fid, secret) for fid in factories}
    jobs = [
        (fid, m, p, tokens[fid])
        for fid in factories
        for (m, p) in endpoints
    ]

    results = []  # (status, elapsed, err)
    connector = aiohttp.TCPConnector(limit=args.concurrency * 2, ttl_dns_cache=300)
    async with aiohttp.ClientSession(connector=connector) as session:
        workers = [worker(f"w{i}", session, args.base_url, jobs, results, deadline)
                   for i in range(args.concurrency)]
        await asyncio.gather(*workers, return_exceptions=True)

    # Aggregate
    by_status = Counter()
    errs = Counter()
    latencies = []
    for status, elapsed, err in results:
        if err:
            errs[err] += 1
            continue
        by_status[status] += 1
        latencies.append(elapsed)

    total = len(results)
    success = sum(n for s, n in by_status.items() if 200 <= s < 400)
    err_count = sum(errs.values()) + sum(n for s, n in by_status.items() if s >= 500)
    err_rate = err_count / total if total else 0.0

    print(f"\n=== Results ({total} requests) ===")
    print(f"  success: {success} ({100 * success / total:.2f}%)")
    print(f"  errors:  {err_count} ({100 * err_rate:.2f}%)")
    print()
    print(f"=== HTTP status breakdown ===")
    for s, n in sorted(by_status.items(), key=lambda kv: -kv[1]):
        print(f"  {s}: {n}")
    if errs:
        print(f"\n=== Exception breakdown ===")
        for e, n in errs.most_common():
            print(f"  {e}: {n}")
    if latencies:
        latencies.sort()
        p50 = latencies[len(latencies) // 2]
        p95 = latencies[int(len(latencies) * 0.95)]
        p99 = latencies[int(len(latencies) * 0.99)] if len(latencies) >= 100 else latencies[-1]
        avg = statistics.mean(latencies)
        print()
        print(f"=== Latency (seconds, success only) ===")
        print(f"  avg: {avg:.3f}s")
        print(f"  p50: {p50:.3f}s")
        print(f"  p95: {p95:.3f}s")
        print(f"  p99: {p99:.3f}s")
        print(f"  max: {max(latencies):.3f}s")

    if args.output:
        with open(args.output, "w") as f:
            json.dump({
                "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "config": vars(args),
                "total": total,
                "success": success,
                "err_count": err_count,
                "err_rate": err_rate,
                "by_status": dict(by_status),
                "errs": dict(errs),
                "latency": {
                    "avg": avg if latencies else None,
                    "p50": p50 if latencies else None,
                    "p95": p95 if latencies else None,
                    "p99": p99 if latencies else None,
                    "max": max(latencies) if latencies else None,
                },
            }, f, indent=2)
        print(f"\nResults written to {args.output}")

    # Phase 2A baseline: <0.5% error rate, p99 < 2000ms
    if err_rate >= 0.005:
        print(f"\nVERDICT: STOP — error rate {100 * err_rate:.2f}% ≥ 0.5% threshold")
        sys.exit(2)
    if latencies and p99 >= 2.0:
        print(f"\nVERDICT: WARN — p99 {p99:.3f}s ≥ 2.0s threshold")
        sys.exit(1)
    print(f"\nVERDICT: GO — err {100 * err_rate:.2f}% < 0.5%, p99 {p99 if latencies else 0:.3f}s < 2.0s")
    sys.exit(0)


def _parse_duration(s: str) -> int:
    s = s.strip()
    suffix = {"s": 1, "m": 60, "h": 3600}
    if s and s[-1] in suffix:
        return int(s[:-1]) * suffix[s[-1]]
    return int(s)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", required=True)
    ap.add_argument("--factories", required=True, help="comma list (e.g. F001,F002)")
    ap.add_argument("--endpoints", required=True, help="preset file path")
    ap.add_argument("--duration", default="5m", help="duration (e.g. 30s, 5m, 1h)")
    ap.add_argument("--concurrency", type=int, default=50)
    ap.add_argument("--output", default="", help="optional JSON results path")
    args = ap.parse_args()

    if not os.environ.get("JWT_SECRET"):
        print("ERROR: JWT_SECRET env required", file=sys.stderr)
        sys.exit(1)

    asyncio.run(run(args))


if __name__ == "__main__":
    main()
