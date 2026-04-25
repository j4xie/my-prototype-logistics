#!/bin/bash
# S1-7 v3: Async upload via Python excel/auto-parse-async endpoint.
# Bypasses Java's user-confirm flow. Direct path: file → background parse → polled COMPLETED.
#
# Endpoint flow:
#   POST /smartbi-api/api/smartbi/excel/auto-parse-async  (file + factory_id)  → {uploadId, status:PENDING}
#   GET  /smartbi-api/api/smartbi/excel/auto-parse-status/{id}  (poll until COMPLETED/FAILED)
#
# Output: upload-speed.json with per-file timings.

set -u
RESULT="tests/e2e-comprehensive/results/depth-aiq-2026-04-26/upload-speed.json"
LOG="tests/e2e-comprehensive/results/depth-aiq-2026-04-26/upload-curl.log"

API_BASE="http://139.196.165.140:8086"

login() {
  local user="$1" pwd="$2" factory="$3"
  curl -sS -X POST "${API_BASE}/api/mobile/auth/unified-login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${user}\",\"password\":\"${pwd}\",\"factoryId\":\"${factory}\"}" \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("data",{}).get("token") or d.get("data",{}).get("accessToken","ERR"))'
}

upload_async() {
  local token="$1" factory="$2" file="$3"
  local fname=$(basename "$file")
  local size_kb=$(($(stat -c%s "$file") / 1024))
  local t0=$(date +%s%N)

  # Step 1: Submit
  local resp
  resp=$(curl -sS -X POST "${API_BASE}/smartbi-api/api/smartbi/excel/auto-parse-async" \
    -H "Authorization: Bearer ${token}" \
    -F "file=@${file}" -F "factory_id=${factory}" \
    --max-time 600 2>&1)
  local t_upload=$(date +%s%N)
  local upload_ms=$(( (t_upload - t0) / 1000000 ))

  local upload_id
  upload_id=$(echo "$resp" | python3 -c 'import sys,json
try:
  d=json.load(sys.stdin)
  print(d.get("uploadId") or d.get("data",{}).get("uploadId") or "NULL")
except: print("PARSE_ERR")' 2>&1)

  if [ "$upload_id" = "NULL" ] || [ "$upload_id" = "PARSE_ERR" ]; then
    echo "{\"file\":\"$fname\",\"size_kb\":$size_kb,\"upload_ms\":$upload_ms,\"error\":\"submit_failed\",\"resp\":$(echo "$resp" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()[:300]))')}"
    return
  fi

  # Step 2: Poll status (max 240s = 120 attempts × 2s)
  local status="PENDING"
  local row_count=0
  local error=""
  local s_resp=""
  local attempts=0
  while [ $attempts -lt 120 ]; do
    attempts=$((attempts+1))
    sleep 2
    s_resp=$(curl -sS "${API_BASE}/smartbi-api/api/smartbi/excel/auto-parse-status/${upload_id}" \
      -H "Authorization: Bearer ${token}" --max-time 10 2>&1)
    status=$(echo "$s_resp" | python3 -c 'import sys,json
try:
  d=json.load(sys.stdin)
  print(d.get("status") or d.get("data",{}).get("status","ERR"))
except: print("PARSE_ERR")' 2>&1)
    case "$status" in
      "COMPLETED"|"FAILED") break ;;
      "PENDING"|"PROCESSING") continue ;;
      *) status="UNKNOWN_${status}"; break ;;
    esac
  done

  local t1=$(date +%s%N)
  local total_ms=$(( (t1 - t0) / 1000000 ))

  row_count=$(echo "$s_resp" | python3 -c 'import sys,json
try:
  d=json.load(sys.stdin)
  print(d.get("rowCount") or d.get("data",{}).get("rowCount") or 0)
except: print(0)' 2>&1)
  error=$(echo "$s_resp" | python3 -c 'import sys,json
try:
  d=json.load(sys.stdin)
  e = d.get("error") or d.get("data",{}).get("error") or ""
  print(json.dumps(e))
except: print("\"\"")' 2>&1)

  echo "{\"file\":\"$fname\",\"size_kb\":$size_kb,\"uploadId\":$upload_id,\"status\":\"$status\",\"upload_ms\":$upload_ms,\"total_ms\":$total_ms,\"poll_attempts\":$attempts,\"row_count\":$row_count,\"error\":$error}"
}

QHJ_DIR="smartbi维度分析/大众点评/真实餐饮连锁数据/青花椒"
QHJ_25_DIR="tests/e2e-comprehensive/results/depth-aiq-2026-04-26/unzipped/qhj-25"
GML_DIR="smartbi维度分析/大众点评/真实餐饮连锁数据"
XMX_DIR="smartbi维度分析/大众点评/真实餐饮连锁数据"

declare -a TENANTS=(
  "qhj|qhj_prod|RES_3101_009"
  "gml|gml_prod|RES_GML_001"
  "xmx|xmx_fresh|R_XMX_FRESH"
)

qhj_files() {
  cat <<EOF
${QHJ_DIR}/青花椒2约销量报表.csv
${QHJ_DIR}/收入管理报表.xlsx
${QHJ_DIR}/评价下载2025.07.01-2025.09.30_1328220_1773721054386.xlsx
${QHJ_DIR}/评价下载2025.10.01-2025.12.31_1328223_1773720937524.xlsx
${QHJ_25_DIR}/qhj_25_订单付款方式.csv
${QHJ_25_DIR}/qhj_25_堂食外卖占比.csv
${QHJ_25_DIR}/qhj_25_卡详情一览.csv
${QHJ_25_DIR}/qhj_25_营业概况月报.csv
EOF
}

gml_files() {
  for sub in "桂满陇1月_商品销量报表" "桂满陇2月_商品销量报表" "桂满陇3月_商品销量报表" \
             "桂满陇1月_桂满陇传菜统计报表" "桂满陇2月_桂满陇传菜统计报表" "桂满陇3月_桂满陇传菜统计报表" \
             "桂满陇1月_营业概况报表（兼容月报表）" "桂满陇2月_营业概况报表（兼容月报表）" "桂满陇3月_营业概况报表（兼容月报表）"; do
    f=$(ls "${GML_DIR}/${sub}/" 2>/dev/null | head -1)
    [ -n "$f" ] && echo "${GML_DIR}/${sub}/${f}"
  done
}

xmx_files() {
  cat <<EOF
${XMX_DIR}/20260421100716739_c29cee7a081唏嘛香会员数据.xlsx
${XMX_DIR}/20260421100421唏嘛香4月付款报表.xls
${XMX_DIR}/唏嘛香（牛肉面）2月销量报表.xls
EOF
}

echo "{\"timestamp\":\"$(date -Iseconds)\",\"apiBase\":\"${API_BASE}\",\"endpoint\":\"async-upload\",\"tenants\":[" > "$RESULT"
echo "Started: $(date)" | tee "$LOG"

FIRST_TENANT=1
for spec in "${TENANTS[@]}"; do
  IFS='|' read -r name user factory <<< "$spec"
  echo "" | tee -a "$LOG"
  echo "=== Tenant: ${name} (${factory}) ===" | tee -a "$LOG"

  TOKEN=$(login "$user" "123456" "$factory")
  if [ "$TOKEN" = "ERR" ] || [ ${#TOKEN} -lt 20 ]; then
    echo "  Login FAILED for ${user}" | tee -a "$LOG"
    continue
  fi
  echo "  Login OK (token len=${#TOKEN})" | tee -a "$LOG"

  if [ "$FIRST_TENANT" = "0" ]; then echo "," >> "$RESULT"; fi
  FIRST_TENANT=0
  echo -n "  {\"name\":\"${name}\",\"factoryId\":\"${factory}\",\"uploads\":[" >> "$RESULT"

  FILES=$(${name}_files)
  FIRST_F=1
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    if [ ! -f "$f" ]; then
      echo "  ✗ MISSING: $f" | tee -a "$LOG"
      continue
    fi
    if [ "$FIRST_F" = "0" ]; then echo "," >> "$RESULT"; fi
    FIRST_F=0
    bname=$(basename "$f")
    sz=$(($(stat -c%s "$f") / 1024))
    echo "  → $bname (${sz}KB)" | tee -a "$LOG"
    R=$(upload_async "$TOKEN" "$factory" "$f")
    echo "    $R" | tee -a "$LOG"
    echo -n "    $R" >> "$RESULT"
  done <<< "$FILES"

  echo -n "]}" >> "$RESULT"
done

echo "]}" >> "$RESULT"
echo "" | tee -a "$LOG"
echo "Done: $(date)" | tee -a "$LOG"
echo "Result: $RESULT" | tee -a "$LOG"
