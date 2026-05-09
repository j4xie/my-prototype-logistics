#!/usr/bin/env python3
"""T6.3 cutover smoke - 61 factories x 19 endpoints = 1159 calls via 139 nginx."""
import json
import os
import socket
import ssl
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

import jwt

JWT_SECRET = os.environ["JWT_SECRET"]
NGINX_HOST = "api.cretaceousfuture.com"
NGINX_IP = "139.196.165.140"

FACTORY_IDS = ["F001"]
FACTORY_IDS += ["FOOD_3101_{:03d}".format(n) for n in range(1, 49)]
FACTORY_IDS += ["MEAT_3101_001", "MEAT_3101_002"]
FACTORY_IDS += ["OTHER_3101_001"]
FACTORY_IDS += ["RES_3101_{:03d}".format(n) for n in range(1, 9)]
FACTORY_IDS += ["TEST_0000_001"]
assert len(FACTORY_IDS) == 61, "factory count {} != 61".format(len(FACTORY_IDS))

ENDPOINTS = [
    "/api/mobile/{factoryId}/smart-bi/analysis/finance?startDate=2026-01-01&endDate=2026-12-31",
    "/api/mobile/{factoryId}/smart-bi/analysis/sales?startDate=2026-01-01&endDate=2026-12-31",
    "/api/mobile/{factoryId}/smart-bi/analysis/department?startDate=2026-01-01&endDate=2026-12-31",
    "/api/mobile/{factoryId}/smart-bi/analysis/region?startDate=2026-01-01&endDate=2026-12-31",
    "/api/mobile/{factoryId}/smart-bi/analysis/inventory?startDate=2026-01-01&endDate=2026-12-31",
    "/api/mobile/{factoryId}/smart-bi/analysis/procurement?startDate=2026-01-01&endDate=2026-12-31",
    "/api/mobile/{factoryId}/smart-bi/analysis/finance?startDate=2026-01-01&endDate=2026-12-31&analysisType=payable",
    "/api/mobile/{factoryId}/smart-bi/analysis/finance?startDate=2026-01-01&endDate=2026-12-31&analysisType=profit",
    "/api/mobile/{factoryId}/smart-bi/analysis/finance?startDate=2026-01-01&endDate=2026-12-31&analysisType=cost",
    "/api/mobile/{factoryId}/smart-bi/analysis/finance?startDate=2026-01-01&endDate=2026-12-31&analysisType=receivable",
    "/api/mobile/{factoryId}/smart-bi/analysis/finance?startDate=2026-01-01&endDate=2026-12-31&analysisType=budget",
    "/api/mobile/{factoryId}/smart-bi/analysis/finance/budget-achievement?startDate=2026-01-01&endDate=2026-12-31&year=2026",
    "/api/mobile/{factoryId}/smart-bi/analysis/finance/yoy-mom?startDate=2026-01-01&endDate=2026-12-31&periodType=MONTH&startPeriod=2026-01",
    "/api/mobile/{factoryId}/smart-bi/analysis/finance/category-comparison?startDate=2026-01-01&endDate=2026-12-31&year=2026&compareYear=2025",
    "/api/mobile/{factoryId}/smart-bi/alerts",
    "/api/mobile/{factoryId}/smart-bi/recommendations",
    "/api/mobile/{factoryId}/smart-bi/data-date-range",
    "/api/mobile/{factoryId}/smart-bi/query-templates",
    "/api/mobile/{factoryId}/smart-bi/datasource/list",
]
assert len(ENDPOINTS) == 19, "endpoint count {} != 19".format(len(ENDPOINTS))


def make_token(factory_id):
    payload = {
        "userId": 1,
        "username": "t6_3_smoke",
        "factoryId": factory_id,
        "role": "factory_super_admin",
        "exp": int(time.time()) + 3600,
    }
    tok = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    return tok if isinstance(tok, str) else tok.decode("utf-8")


# Force DNS for NGINX_HOST -> NGINX_IP (curl --resolve equivalent)
_orig_getaddrinfo = socket.getaddrinfo
def _patched_getaddrinfo(host, *args, **kwargs):
    if host == NGINX_HOST:
        return _orig_getaddrinfo(NGINX_IP, *args, **kwargs)
    return _orig_getaddrinfo(host, *args, **kwargs)
socket.getaddrinfo = _patched_getaddrinfo

_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE


def smoke_one(factory_id, endpoint_template, token):
    url_path = endpoint_template.replace("{factoryId}", factory_id)
    url = "https://" + NGINX_HOST + url_path
    req = Request(url, headers={"Authorization": "Bearer " + token})
    t0 = time.time()
    try:
        with urlopen(req, timeout=15, context=_ssl_ctx) as resp:
            body_bytes = resp.read(2048)
            elapsed = time.time() - t0
            try:
                body_obj = json.loads(body_bytes.decode("utf-8", errors="replace"))
                has_success = "success" in body_obj
            except (json.JSONDecodeError, ValueError):
                has_success = None
            return {
                "factory": factory_id,
                "endpoint": endpoint_template[:50],
                "status": resp.status,
                "elapsed_s": round(elapsed, 3),
                "has_success_field": has_success,
            }
    except HTTPError as e:
        elapsed = time.time() - t0
        return {
            "factory": factory_id,
            "endpoint": endpoint_template[:50],
            "status": e.code,
            "elapsed_s": round(elapsed, 3),
            "has_success_field": None,
            "error": str(e)[:120],
        }
    except (URLError, socket.timeout, Exception) as e:
        elapsed = time.time() - t0
        return {
            "factory": factory_id,
            "endpoint": endpoint_template[:50],
            "status": -1,
            "elapsed_s": round(elapsed, 3),
            "has_success_field": None,
            "error": str(e)[:120],
        }


def main():
    print("T6.3 smoke: {} factories x {} endpoints = {} calls".format(
        len(FACTORY_IDS), len(ENDPOINTS), len(FACTORY_IDS) * len(ENDPOINTS)))
    print("Target: https://{} -> {} (139 nginx, T6.3 vhost)".format(NGINX_HOST, NGINX_IP))
    print("Started: {} UTC".format(time.strftime("%Y-%m-%d %H:%M:%S")))
    print()

    tokens = {fid: make_token(fid) for fid in FACTORY_IDS}

    tasks = [
        (fid, ep, tokens[fid])
        for fid in FACTORY_IDS
        for ep in ENDPOINTS
    ]

    results = []
    t_start = time.time()
    with ThreadPoolExecutor(max_workers=6) as exe:
        futures = [exe.submit(smoke_one, *t) for t in tasks]
        for i, fut in enumerate(as_completed(futures), 1):
            r = fut.result()
            results.append(r)
            if i % 100 == 0 or i == len(tasks):
                print("  progress: {}/{} ({:.1f}%)".format(i, len(tasks), 100*i/len(tasks)))

    total_time = time.time() - t_start
    print("\nDone in {:.1f}s ({:.1f} req/s)".format(total_time, len(results) / total_time))
    print()

    by_status = {}
    by_factory = {}
    fails = []
    for r in results:
        s = r["status"]
        by_status[s] = by_status.get(s, 0) + 1
        f = r["factory"]
        by_factory.setdefault(f, {"pass": 0, "fail": 0})
        if 200 <= s < 300:
            by_factory[f]["pass"] += 1
        else:
            by_factory[f]["fail"] += 1
            fails.append(r)

    total = len(results)
    pass_total = sum(1 for r in results if 200 <= r["status"] < 300)
    print("=== Status breakdown ===")
    for s in sorted(by_status, key=lambda x: (x != 200, x)):
        if 200 <= s < 300:
            marker = "PASS"
        elif 400 <= s < 500:
            marker = "WARN"
        elif s >= 500 or s == -1:
            marker = "FAIL"
        else:
            marker = "?"
        print("  [{}] HTTP {}: {}".format(marker, s, by_status[s]))
    print("\nTotal: {}/{} = {:.2f}% pass\n".format(pass_total, total, 100 * pass_total / total))

    print("=== Per-factory pass/fail ===")
    for fid in FACTORY_IDS:
        s = by_factory[fid]
        marker = "PASS" if s["fail"] == 0 else "FAIL"
        print("  [{}] {}: {}/{}".format(marker, fid, s["pass"], s["pass"] + s["fail"]))
    print()

    if fails:
        print("=== Non-2xx samples (first 30) ===")
        for r in fails[:30]:
            err = r.get("error", "")
            print("  HTTP {:>4} | {:<20} | {} | {}".format(
                r["status"], r["factory"], r["endpoint"], err[:60]))
        if len(fails) > 30:
            print("  ... and {} more".format(len(fails) - 30))
        print()

    has_5xx = any(r["status"] >= 500 or r["status"] == -1 for r in results)
    pct_4xx = sum(1 for r in results if 400 <= r["status"] < 500) / total * 100

    if has_5xx:
        print("VERDICT: HAS 5xx -- STOP, rollback per runbook section 5")
    elif pct_4xx > 0.5:
        print("VERDICT: {:.2f}% 4xx -- investigate before continue".format(pct_4xx))
    else:
        print("VERDICT: GO ({}/{} = {:.2f}%)".format(pass_total, total, 100 * pass_total / total))

    with open("/tmp/t6-3-smoke-results.json", "w") as f:
        json.dump({
            "factory_count": len(FACTORY_IDS),
            "endpoint_count": len(ENDPOINTS),
            "total_calls": total,
            "pass": pass_total,
            "by_status": by_status,
            "by_factory": by_factory,
            "fails": fails[:200],
        }, f, indent=2)
    print("\nFull results: /tmp/t6-3-smoke-results.json")

if __name__ == "__main__":
    main()
