#!/usr/bin/env python3
"""Rule 9 body sampler for Phase C Day 0 probe.

Captures full JSON response bodies for a small cohort of factories x endpoints
to verify response shape / data presence beyond what record-batch.sh's
status-only verdict provides. Output: JSON file with one entry per
(factory, endpoint), including parsed body or excerpt + body-hash.

Usage:
    JWT_SECRET=<...> python3 sample-bodies.py \
        --base-url https://api.cretaceousfuture.com \
        --factories F002,FOOD_3101_034,TEST_0000_001 \
        --endpoints scripts/active-e2e/curl-replay/preset-phase-c-day0-4.txt \
        --output out/phase-c-day0-body-samples.json
"""
import argparse
import hashlib
import json
import os
import ssl
import sys
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

import jwt

ssl._create_default_https_context = ssl._create_unverified_context


def make_token(factory_id, secret):
    payload = {
        "userId": 1,
        "username": "active_e2e_sampler",
        "factoryId": factory_id,
        "role": "factory_super_admin",
        "exp": int(time.time()) + 3600,
    }
    tok = jwt.encode(payload, secret, algorithm="HS256")
    return tok if isinstance(tok, str) else tok.decode("utf-8")


def load_endpoints(path):
    out = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            method, p = line.split(maxsplit=1)
            out.append((method.upper(), p))
    return out


def fetch_one(base_url, factory, method, path_template, token):
    url = base_url + path_template.replace("{factoryId}", factory)
    req = Request(url, headers={"Authorization": "Bearer " + token}, method=method)
    t0 = time.time()
    try:
        with urlopen(req, timeout=15) as resp:
            body = resp.read()
            elapsed = time.time() - t0
            status = resp.status
    except HTTPError as e:
        body = e.read() if hasattr(e, "read") else b""
        elapsed = time.time() - t0
        status = e.code
    except (URLError, OSError) as e:
        return {
            "factory": factory, "endpoint": path_template, "status": -1,
            "elapsed_s": round(time.time() - t0, 3), "error": str(e),
        }

    body_str = body.decode("utf-8", errors="replace")
    body_hash = hashlib.sha256(body).hexdigest()[:16]
    try:
        parsed = json.loads(body_str)
        success = parsed.get("success") if isinstance(parsed, dict) else None
        # Capture top-level keys + sample of data shape
        data = parsed.get("data") if isinstance(parsed, dict) else None
        if isinstance(data, dict):
            data_keys = list(data.keys())[:15]
        elif isinstance(data, list):
            data_keys = f"list[{len(data)}]"
        else:
            data_keys = type(data).__name__
        return {
            "factory": factory,
            "endpoint": path_template,
            "status": status,
            "elapsed_s": round(elapsed, 3),
            "body_size": len(body),
            "body_hash16": body_hash,
            "success": success,
            "data_shape": data_keys,
            "top_keys": list(parsed.keys()) if isinstance(parsed, dict) else None,
            "body_excerpt": body_str[:600],
        }
    except json.JSONDecodeError:
        return {
            "factory": factory,
            "endpoint": path_template,
            "status": status,
            "elapsed_s": round(elapsed, 3),
            "body_size": len(body),
            "body_hash16": body_hash,
            "parse_error": True,
            "body_excerpt": body_str[:600],
        }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--base-url", required=True)
    p.add_argument("--factories", required=True, help="CSV factory IDs")
    p.add_argument("--endpoints", required=True)
    p.add_argument("--output", required=True)
    args = p.parse_args()

    secret = os.environ["JWT_SECRET"]
    factories = [s.strip() for s in args.factories.split(",") if s.strip()]
    endpoints = load_endpoints(args.endpoints)

    samples = []
    for fid in factories:
        token = make_token(fid, secret)
        for method, path in endpoints:
            s = fetch_one(args.base_url, fid, method, path, token)
            samples.append(s)
            print(f"  {fid:20s} {path.split('?')[0].split('/')[-1]:15s} "
                  f"status={s.get('status')} size={s.get('body_size','?')} hash={s.get('body_hash16','?')}",
                  file=sys.stderr)

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(samples, f, ensure_ascii=False, indent=2)
    print(f"\nWrote {len(samples)} samples to {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
