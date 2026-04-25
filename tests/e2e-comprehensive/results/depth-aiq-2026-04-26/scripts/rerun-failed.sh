#!/bin/bash
# S1-9: 重传 S1 失败的 8 个文件 (Bug A 修后).
set -u
RESULT="tests/e2e-comprehensive/results/depth-aiq-2026-04-26/upload-rerun.json"
LOG="tests/e2e-comprehensive/results/depth-aiq-2026-04-26/upload-rerun.log"
API_BASE="http://139.196.165.140:8086"

login() {
  curl -sS -X POST "${API_BASE}/api/mobile/auth/unified-login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$1\",\"password\":\"123456\",\"factoryId\":\"$2\"}" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin).get("data",{}).get("token","ERR"))'
}

upload_async() {
  local token="$1" factory="$2" file="$3"
  local fname=$(basename "$file")
  local size_kb=$(($(stat -c%s "$file") / 1024))
  local t0=$(date +%s%N)

  local resp=$(curl -sS -X POST "${API_BASE}/smartbi-api/api/smartbi/excel/auto-parse-async" \
    -H "Authorization: Bearer ${token}" \
    -F "file=@${file}" -F "factory_id=${factory}" \
    --max-time 600)
  local t_upload=$(date +%s%N)
  local upload_ms=$(( (t_upload - t0) / 1000000 ))

  local upload_id=$(echo "$resp" | python3 -c 'import sys,json
try: d=json.load(sys.stdin); print(d.get("uploadId") or "NULL")
except: print("PARSE_ERR")' 2>&1)

  if [ "$upload_id" = "NULL" ] || [ "$upload_id" = "PARSE_ERR" ]; then
    echo "{\"file\":\"$fname\",\"size_kb\":$size_kb,\"upload_ms\":$upload_ms,\"error\":\"submit_failed\"}"
    return
  fi

  local status="PENDING" attempts=0 s_resp=""
  while [ $attempts -lt 90 ]; do
    attempts=$((attempts+1))
    sleep 3
    s_resp=$(curl -sS "${API_BASE}/smartbi-api/api/smartbi/excel/auto-parse-status/${upload_id}" \
      -H "Authorization: Bearer ${token}" --max-time 10)
    status=$(echo "$s_resp" | python3 -c 'import sys,json
try: d=json.load(sys.stdin); print(d.get("status","ERR"))
except: print("PARSE_ERR")' 2>&1)
    case "$status" in
      "COMPLETED"|"FAILED") break ;;
    esac
  done

  local t1=$(date +%s%N)
  local total_ms=$(( (t1 - t0) / 1000000 ))
  local row_count=$(echo "$s_resp" | python3 -c 'import sys,json
try: d=json.load(sys.stdin); print(d.get("rowCount") or 0)
except: print(0)' 2>&1)
  local error=$(echo "$s_resp" | python3 -c 'import sys,json
try: d=json.load(sys.stdin); e=d.get("error") or ""; print(json.dumps(e))
except: print("\"\"")' 2>&1)

  echo "{\"file\":\"$fname\",\"size_kb\":$size_kb,\"uploadId\":$upload_id,\"status\":\"$status\",\"upload_ms\":$upload_ms,\"total_ms\":$total_ms,\"poll_attempts\":$attempts,\"row_count\":$row_count,\"error\":$error}"
}

QHJ_DIR="smartbi维度分析/大众点评/真实餐饮连锁数据/青花椒"
GML_DIR="smartbi维度分析/大众点评/真实餐饮连锁数据"
XMX_DIR="smartbi维度分析/大众点评/真实餐饮连锁数据"

# Failed-but-now-fixed file list
declare -a TASKS=(
  "qhj|RES_3101_009|${QHJ_DIR}/收入管理报表.xlsx"
  "qhj|RES_3101_009|${QHJ_DIR}/评价下载2025.07.01-2025.09.30_1328220_1773721054386.xlsx"
  "qhj|RES_3101_009|${QHJ_DIR}/评价下载2025.10.01-2025.12.31_1328223_1773720937524.xlsx"
  "gml|RES_GML_001|${GML_DIR}/桂满陇2月_商品销量报表/20260422100942814_caa2b475591_商品销量报表.csv"
  "gml|RES_GML_001|${GML_DIR}/桂满陇2月_营业概况报表（兼容月报表）/20260422100050052_ec62cc005a1_营业概况报表（兼容月报表）.xlsx"
  "gml|RES_GML_001|${GML_DIR}/桂满陇3月_营业概况报表（兼容月报表）/20260422100251341_324e5e89071_营业概况报表（兼容月报表）.xlsx"
  "xmx|R_XMX_FRESH|${XMX_DIR}/20260421100716739_c29cee7a081唏嘛香会员数据.xlsx"
  "xmx|R_XMX_FRESH|${XMX_DIR}/20260421100421唏嘛香4月付款报表.xls"
)

echo "{\"timestamp\":\"$(date -Iseconds)\",\"endpoint\":\"async-rerun-after-bug-A-fix\",\"results\":[" > "$RESULT"
echo "Started: $(date)" | tee "$LOG"

LAST_TENANT=""
TOKEN=""
FIRST=1
for spec in "${TASKS[@]}"; do
  IFS='|' read -r tenant factory file <<< "$spec"

  if [ "$tenant" != "$LAST_TENANT" ]; then
    case "$tenant" in
      qhj) TOKEN=$(login "qhj_prod" "$factory") ;;
      gml) TOKEN=$(login "gml_prod" "$factory") ;;
      xmx) TOKEN=$(login "xmx_fresh" "$factory") ;;
    esac
    if [ ${#TOKEN} -lt 20 ]; then
      echo "Login failed for $tenant" | tee -a "$LOG"
      continue
    fi
    echo "" | tee -a "$LOG"
    echo "=== Tenant: ${tenant} ===" | tee -a "$LOG"
    LAST_TENANT="$tenant"
  fi

  if [ ! -f "$file" ]; then
    echo "  ✗ MISSING: $file" | tee -a "$LOG"
    continue
  fi

  if [ "$FIRST" = "0" ]; then echo "," >> "$RESULT"; fi
  FIRST=0

  bname=$(basename "$file")
  echo "  → $bname" | tee -a "$LOG"
  R=$(upload_async "$TOKEN" "$factory" "$file")
  echo "    $R" | tee -a "$LOG"
  echo -n "    $R" >> "$RESULT"
done

echo "]}" >> "$RESULT"
echo "" | tee -a "$LOG"
echo "Done: $(date)" | tee -a "$LOG"
echo "Result: $RESULT"
