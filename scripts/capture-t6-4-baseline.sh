#!/usr/bin/env bash
# T6.4 baseline metrics capture — runs ON server 47 (loopback).
#
# Captures Java prod (10010) + Python prod (8083) responses for 14 real
# customer factories × 4 SmartBI endpoints (overview-only, no analysisType).
# Output: /tmp/t6-4-baseline/{java,python}/<factoryId>-<endpoint>.json
#         /tmp/t6-4-baseline/manifest.tsv (per-call http_code/elapsed_ms/bytes)
#
# Usage (on server 47):
#   source /www/wwwroot/cretas/.env.prod   # exposes JWT_SECRET
#   bash capture-t6-4-baseline.sh
#
# Read-only. Generates 1h JWT per factory with factory_super_admin role,
# matching the established record-java-golden.sh pattern. No prod state mutation.

set -u

: "${JWT_SECRET:?JWT_SECRET env var required (source /www/wwwroot/cretas/.env.prod)}"

START_DATE="2026-01-01"
END_DATE="2026-05-08"
DASHBOARD_PERIOD="year"

OUTPUT_DIR="/tmp/t6-4-baseline"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/java" "$OUTPUT_DIR/python"

FACTORIES=(
  F002 F003 F004 F006
  R001
  RES_3101_009 RES_GML_001
  R_GML_DEMO R_XMX_CHAIN R_XMX_FRESH R_XMX_FRESH2 R_XMX_FRESH3
  R_YHDJ_DEMO R_YJJ_DEMO
)

# name|relative_path (under /api/mobile/<factoryId>/smart-bi)
ENDPOINTS=(
  "dashboard|/dashboard?period=$DASHBOARD_PERIOD"
  "analysis-sales|/analysis/sales?startDate=$START_DATE&endDate=$END_DATE"
  "analysis-finance|/analysis/finance?startDate=$START_DATE&endDate=$END_DATE"
  "analysis-inventory|/analysis/inventory?startDate=$START_DATE&endDate=$END_DATE"
)

generate_jwt() {
  local factory="$1"
  FACTORY_ID="$factory" python3 - <<'PY'
import jwt, os, time
tok = jwt.encode({
  "userId": 1,
  "username": "t6_4_baseline_capture",
  "factoryId": os.environ["FACTORY_ID"],
  "role": "factory_super_admin",
  "exp": int(time.time()) + 3600,
}, os.environ["JWT_SECRET"], algorithm="HS256")
print(tok if isinstance(tok, str) else tok.decode("utf-8"))
PY
}

manifest="$OUTPUT_DIR/manifest.tsv"
printf 'factory\tendpoint\tservice\thttp_code\telapsed_ms\tbytes\tnotes\n' > "$manifest"

started_at="$(date -Iseconds)"
echo "Started: $started_at"
echo "Window:  $START_DATE → $END_DATE (dashboard period=$DASHBOARD_PERIOD)"

for factory in "${FACTORIES[@]}"; do
  echo "=== $factory ==="
  TOKEN="$(generate_jwt "$factory")"
  for ep_spec in "${ENDPOINTS[@]}"; do
    name="${ep_spec%%|*}"
    path="${ep_spec#*|}"
    full_path="/api/mobile/$factory/smart-bi$path"

    for service_pair in "java|10010" "python|8083"; do
      service="${service_pair%%|*}"
      port="${service_pair#*|}"
      url="http://localhost:$port$full_path"
      out_file="$OUTPUT_DIR/$service/$factory-$name.json"

      tmp_body="$(mktemp)"
      stats=$(curl -sS --max-time 60 \
        -H "Authorization: Bearer $TOKEN" \
        -w '%{http_code}|%{time_total}|%{size_download}' \
        -o "$tmp_body" "$url" || echo "000|0|0")
      http_code="${stats%%|*}"
      rest="${stats#*|}"
      time_total="${rest%%|*}"
      bytes="${rest##*|}"
      elapsed_ms="$(awk -v t="$time_total" 'BEGIN { printf "%.0f", t * 1000 }')"

      # Pretty-print if JSON, else save raw
      if python3 -c "import json; json.load(open('$tmp_body'))" 2>/dev/null; then
        python3 -c "import json; print(json.dumps(json.load(open('$tmp_body')), indent=2, ensure_ascii=False))" > "$out_file"
        notes="ok"
      else
        cp "$tmp_body" "$out_file"
        notes="non-json-body"
      fi
      rm -f "$tmp_body"

      printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
        "$factory" "$name" "$service" "$http_code" "$elapsed_ms" "$bytes" "$notes" \
        >> "$manifest"
      echo "  $service $name → $http_code (${elapsed_ms}ms, ${bytes}B)"
    done
  done
done

ended_at="$(date -Iseconds)"
total=$(($(wc -l < "$manifest") - 1))
ok=$(awk -F'\t' 'NR>1 && $4==200' "$manifest" | wc -l)

echo
echo "=== Done ==="
echo "Started: $started_at"
echo "Ended:   $ended_at"
echo "Total captures: $total"
echo "HTTP 200:       $ok"
echo "Output dir:     $OUTPUT_DIR"
echo "Manifest:       $manifest"
