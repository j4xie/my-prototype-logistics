#!/usr/bin/env bash
# Issue #567 — T2-4 RPF chain API verification probe
# Read-only against F006 prod via nginx at 139:8086.
#
# Usage:
#   TOKEN=<f006_admin token>  ./probe-chain.sh
#   or just run — it logs in and probes.
#
# Reproduces the 6-row tally documented in README.md.

set -euo pipefail

BASE_HOST="${BASE_HOST:-http://139.196.165.140:8086}"
FACTORY="${FACTORY:-F006}"

if [[ -z "${TOKEN:-}" ]]; then
  echo "Logging in as f006_admin..."
  TOKEN=$(curl -fsS -X POST "$BASE_HOST/api/mobile/auth/unified-login" \
    -H "Content-Type: application/json" \
    -d '{"username":"f006_admin","password":"123456","deviceId":"issue-567-probe"}' \
    | python -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
  echo "  ok (token len=${#TOKEN})"
fi

BASE="$BASE_HOST/api/mobile/$FACTORY"

count_endpoint() {
  local label="$1"
  local url="$2"
  local n
  n=$(curl -fsS -H "Authorization: Bearer $TOKEN" "$url" \
    | python -c "
import sys,json
d=json.load(sys.stdin)
if not d.get('success', True):
    print('ERR:'+str(d.get('code'))+':'+str(d.get('message'))); sys.exit()
data=d.get('data',{})
if isinstance(data, dict):
    c=data.get('totalElements', data.get('total'))
    if c is None:
        for k in ('content','list','records','items'):
            if k in data: c=len(data[k]); break
    print(c)
elif isinstance(data, list):
    print(len(data))
else:
    print('?')
")
  printf '  %-35s -> %s\n' "$label" "$n"
}

echo ""
echo "=== F006 RPF chain row counts ==="
count_endpoint "L1 /rd/samples (page=0)"             "$BASE/rd/samples?page=0&size=1"
count_endpoint "L2 /purchase/orders (page=1)"        "$BASE/purchase/orders?page=1&size=1"
count_endpoint "L3 /purchase/receives (page=1)"      "$BASE/purchase/receives?page=1&size=1"
count_endpoint "L4 /material-batches (page=1)"       "$BASE/material-batches?page=1&size=1"
count_endpoint "L5 /production-plans (page=1)"       "$BASE/production-plans?page=1&size=1"
count_endpoint "L4->L5 /material-consumptions"       "$BASE/processing/material-consumptions?page=1&size=1"

echo ""
echo "Expected for verdict PARTIAL (per README.md):"
echo "  L1=0  L2=6  L3=5  L4=3  L5=6  consumption=0"
