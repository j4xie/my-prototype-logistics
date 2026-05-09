#!/usr/bin/env bash
# scripts/active-e2e/curl-replay/record-batch.sh
#
# Active E2E framework v1 — N factories × M endpoints HTTP capture.
# Replicates the t6-5-phase-b-smoke.py pattern but as a generic CLI:
#   - configurable factory cohort (preset name OR comma list OR ALL_76)
#   - configurable endpoint preset file (one "<METHOD> <path-with-{factoryId}>" per line)
#   - assertion mode: --expect-status N | --expect-status-not N | --expect-marker STRING
#   - NDJSON output for downstream aggregation by parity-report.py
#
# Usage:
#   JWT_SECRET=<from .env.prod> ./record-batch.sh \
#     --base-url http://47.100.235.168:10010 \
#     --factories ALL_76 \
#     --endpoints scripts/active-e2e/curl-replay/preset-stub-23.txt \
#     --expect-status 410 \
#     --expect-marker SMARTBI_MIGRATED \
#     --output ./out/phase-b-smoke-$(date +%Y%m%d_%H%M%S).ndjson
#
# Exit codes:
#   0  all passed
#   1  some FAIL but no REGRESSION
#   2  REGRESSION (e.g., --expect-status-not got the forbidden status)

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:10010}"
FACTORIES_ARG=""
ENDPOINTS_FILE=""
EXPECT_STATUS=""
EXPECT_STATUS_NOT=""
EXPECT_MARKER=""
OUTPUT=""
CONCURRENCY="${CONCURRENCY:-10}"

usage() {
    cat <<EOF
Usage: JWT_SECRET=<secret> $0 [options]

Required:
  --factories <preset|csv>      Factory cohort. Presets: ALL_76 | T6_4_FINAL_14 | F999 | F001
  --endpoints <file>            Preset file (one line per endpoint: METHOD /path/with/{factoryId})
  --output <path>               NDJSON output path

Assertions (at least one required):
  --expect-status <N>           All calls should return this status code
  --expect-status-not <N>       NONE of the calls should return this status (regression check)
  --expect-marker <STRING>      Response body must contain this substring

Options:
  --base-url <url>              Default: \$BASE_URL or http://localhost:10010
  --concurrency <N>             Default: 10 threads (Python's ThreadPoolExecutor)

Env:
  JWT_SECRET                    Required — JWT signing secret from .env.prod / .env.test
EOF
    exit 0
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --base-url)         BASE_URL="$2"; shift 2 ;;
        --factories)        FACTORIES_ARG="$2"; shift 2 ;;
        --endpoints)        ENDPOINTS_FILE="$2"; shift 2 ;;
        --expect-status)    EXPECT_STATUS="$2"; shift 2 ;;
        --expect-status-not) EXPECT_STATUS_NOT="$2"; shift 2 ;;
        --expect-marker)    EXPECT_MARKER="$2"; shift 2 ;;
        --output)           OUTPUT="$2"; shift 2 ;;
        --concurrency)      CONCURRENCY="$2"; shift 2 ;;
        --help|-h)          usage ;;
        *) echo "Unknown arg: $1" >&2; usage ;;
    esac
done

[[ -z "${JWT_SECRET:-}" ]] && { echo "ERROR: JWT_SECRET env required" >&2; exit 1; }
[[ -z "$FACTORIES_ARG" ]] && { echo "ERROR: --factories required" >&2; exit 1; }
[[ -z "$ENDPOINTS_FILE" ]] && { echo "ERROR: --endpoints required" >&2; exit 1; }
[[ -z "$OUTPUT" ]] && { echo "ERROR: --output required" >&2; exit 1; }
[[ ! -r "$ENDPOINTS_FILE" ]] && { echo "ERROR: endpoints file not readable: $ENDPOINTS_FILE" >&2; exit 1; }

if [[ -z "$EXPECT_STATUS" && -z "$EXPECT_STATUS_NOT" && -z "$EXPECT_MARKER" ]]; then
    echo "ERROR: at least one of --expect-status / --expect-status-not / --expect-marker required" >&2
    exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"

# Hand off to Python for the heavy lifting (matches t6-5-phase-b-smoke.py concurrency model).
exec python3 - "$BASE_URL" "$FACTORIES_ARG" "$ENDPOINTS_FILE" \
    "$EXPECT_STATUS" "$EXPECT_STATUS_NOT" "$EXPECT_MARKER" \
    "$OUTPUT" "$CONCURRENCY" <<'PY'
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

import jwt

BASE_URL, FACTORIES_ARG, ENDPOINTS_FILE = sys.argv[1], sys.argv[2], sys.argv[3]
EXPECT_STATUS = int(sys.argv[4]) if sys.argv[4] else None
EXPECT_STATUS_NOT = int(sys.argv[5]) if sys.argv[5] else None
EXPECT_MARKER = sys.argv[6] or None
OUTPUT = sys.argv[7]
CONCURRENCY = int(sys.argv[8])

JWT_SECRET = os.environ["JWT_SECRET"]


# Factory cohort presets — keep in sync with scripts/t6-5-phase-b-smoke.py
ALL_76 = ["F001"]
ALL_76 += ["FOOD_3101_{:03d}".format(n) for n in range(1, 49)]
ALL_76 += ["MEAT_3101_001", "MEAT_3101_002"]
ALL_76 += ["OTHER_3101_001"]
ALL_76 += ["RES_3101_{:03d}".format(n) for n in range(1, 9)]
ALL_76 += ["TEST_0000_001"]
ALL_76 += [
    "F002", "F003", "F004", "F006", "R001",
    "RES_GML_001", "RES_3101_009",
    "R_GML_DEMO", "R_XMX_CHAIN", "R_XMX_FRESH",
    "R_XMX_FRESH2", "R_XMX_FRESH3", "R_YHDJ_DEMO", "R_YJJ_DEMO",
    "F999",
]
assert len(ALL_76) == 76, f"ALL_76 count drift: {len(ALL_76)}"

T6_4_FINAL_14 = [
    "F002", "F003", "F004", "F006", "R001",
    "RES_GML_001", "RES_3101_009",
    "R_GML_DEMO", "R_XMX_CHAIN", "R_XMX_FRESH",
    "R_XMX_FRESH2", "R_XMX_FRESH3", "R_YHDJ_DEMO", "R_YJJ_DEMO",
]

PRESETS = {
    "ALL_76": ALL_76,
    "T6_4_FINAL_14": T6_4_FINAL_14,
    "F999": ["F999"],
    "F001": ["F001"],
}


def resolve_factories(arg: str):
    if arg in PRESETS:
        return PRESETS[arg]
    return [s.strip() for s in arg.split(",") if s.strip()]


def load_endpoints(path: str):
    """Each non-blank, non-comment line: '<METHOD> <path-with-{factoryId}>'."""
    out = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split(maxsplit=1)
            if len(parts) != 2:
                raise ValueError(f"bad endpoint line: {line!r}")
            method, p = parts[0].upper(), parts[1]
            out.append((method, p))
    return out


def make_token(factory_id: str) -> str:
    payload = {
        "userId": 1,
        "username": "active_e2e",
        "factoryId": factory_id,
        "role": "factory_super_admin",
        "exp": int(time.time()) + 3600,
    }
    tok = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    return tok if isinstance(tok, str) else tok.decode("utf-8")


def call_one(factory_id, method, path_template, token):
    url_path = path_template.replace("{factoryId}", factory_id)
    url = BASE_URL + url_path
    headers = {"Authorization": "Bearer " + token}

    # Stub paths often need POST/PUT bodies that pass Spring pre-method validation;
    # callers pass the right Content-Type via preset header convention. v1 keeps it simple:
    # no body for GET/DELETE, empty JSON for POST/PUT (caller adds body if needed via custom preset).
    data = None
    if method in ("POST", "PUT"):
        headers["Content-Type"] = "application/json"
        data = b"{}"
    req = Request(url, headers=headers, method=method, data=data)

    t0 = time.time()
    try:
        with urlopen(req, timeout=15) as resp:
            body_bytes = resp.read(4096)
            elapsed = time.time() - t0
            return _classify(factory_id, method, path_template, resp.status, body_bytes, elapsed)
    except HTTPError as e:
        elapsed = time.time() - t0
        try:
            body_bytes = e.read(4096)
        except Exception:
            body_bytes = b""
        return _classify(factory_id, method, path_template, e.code, body_bytes, elapsed)
    except (URLError, OSError) as e:
        elapsed = time.time() - t0
        return {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "factory": factory_id,
            "method": method,
            "endpoint": path_template,
            "status": -1,
            "elapsed_s": round(elapsed, 3),
            "verdict": "ERR",
            "marker_present": False,
            "error": str(e)[:200],
        }


def _classify(factory_id, method, path_template, status, body_bytes, elapsed):
    body_str = body_bytes.decode("utf-8", errors="replace")
    marker_present = (EXPECT_MARKER in body_str) if EXPECT_MARKER else None
    verdict = "PASS"
    notes = []

    if EXPECT_STATUS is not None and status != EXPECT_STATUS:
        verdict = "FAIL"
        notes.append(f"got status {status}, expected {EXPECT_STATUS}")
    if EXPECT_STATUS_NOT is not None and status == EXPECT_STATUS_NOT:
        verdict = "REGRESSION"
        notes.append(f"got forbidden status {status}")
    if EXPECT_MARKER and not marker_present:
        if verdict == "PASS":
            verdict = "FAIL"
        notes.append(f"missing marker {EXPECT_MARKER!r}")

    if status >= 500 and verdict == "PASS":
        verdict = "FAIL_5XX"

    return {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "factory": factory_id,
        "method": method,
        "endpoint": path_template,
        "status": status,
        "elapsed_s": round(elapsed, 3),
        "verdict": verdict,
        "marker_present": marker_present,
        "notes": "; ".join(notes) if notes else None,
        "body_excerpt": body_str[:240] if verdict != "PASS" else None,
    }


def main():
    factories = resolve_factories(FACTORIES_ARG)
    endpoints = load_endpoints(ENDPOINTS_FILE)

    print(f"Active E2E batch capture")
    print(f"  base_url:   {BASE_URL}")
    print(f"  factories:  {len(factories)} ({FACTORIES_ARG})")
    print(f"  endpoints:  {len(endpoints)} from {ENDPOINTS_FILE}")
    print(f"  total:      {len(factories) * len(endpoints)} calls")
    print(f"  output:     {OUTPUT}")
    print(f"  asserts:    status={EXPECT_STATUS} status_not={EXPECT_STATUS_NOT} marker={EXPECT_MARKER!r}")
    print()

    tokens = {fid: make_token(fid) for fid in factories}
    tasks = [(fid, m, p, tokens[fid]) for fid in factories for (m, p) in endpoints]
    total = len(tasks)

    results = []
    t_start = time.time()
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as exe:
        futs = [exe.submit(call_one, *t) for t in tasks]
        for i, fut in enumerate(as_completed(futs), 1):
            r = fut.result()
            results.append(r)
            if i % 200 == 0 or i == total:
                print(f"  progress: {i}/{total} ({100*i/total:.1f}%)")
    elapsed = time.time() - t_start
    print(f"\nDone in {elapsed:.1f}s ({total / elapsed:.1f} req/s)")

    # NDJSON output
    with open(OUTPUT, "w", encoding="utf-8") as f:
        for r in results:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    by_verdict = {}
    for r in results:
        by_verdict[r["verdict"]] = by_verdict.get(r["verdict"], 0) + 1

    print("\n=== Verdict breakdown ===")
    for v in sorted(by_verdict):
        print(f"  {v}: {by_verdict[v]}")

    fails = by_verdict.get("FAIL", 0) + by_verdict.get("FAIL_5XX", 0)
    regressions = by_verdict.get("REGRESSION", 0)
    errs = by_verdict.get("ERR", 0)

    if regressions > 0:
        print(f"\nVERDICT: STOP — {regressions} REGRESSIONs (forbidden status hit)")
        sys.exit(2)
    if fails > 0 or errs > 0:
        print(f"\nVERDICT: PARTIAL — {fails} FAIL + {errs} ERR (no regression)")
        sys.exit(1)
    print(f"\nVERDICT: GO — {by_verdict.get('PASS', 0)}/{total} PASS")
    sys.exit(0)


if __name__ == "__main__":
    main()
PY
