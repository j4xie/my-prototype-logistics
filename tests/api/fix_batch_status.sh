#!/bin/bash

API_URL="http://localhost:10010/api/mobile"
FACTORY_ID="CRETAS_2024_001"
USERNAME="proc_admin"
PASSWORD="123456"

# Login
ACCESS_TOKEN=$(curl -s -X POST ${API_URL}/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}" | \
  python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('accessToken', ''))" 2>/dev/null)

echo "Access Token: ${ACCESS_TOKEN:0:30}..."

# Set MB-003 to FRESH
echo ""
echo "Setting MB-003 to FRESH status..."
curl -s -X PUT "${API_URL}/${FACTORY_ID}/material-batches/MB-003/status" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"status": "FRESH", "notes": "设置为鲜品状态，准备冷冻转换"}' | python3 -m json.tool

# Set MB-009 to FRESH first
echo ""
echo "Setting MB-009 to FRESH first..."
curl -s -X PUT "${API_URL}/${FACTORY_ID}/material-batches/MB-009/status" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"status": "FRESH", "notes": "临时设为鲜品"}' | python3 -m json.tool

# Convert MB-009 to FROZEN
echo ""
echo "Converting MB-009 to FROZEN..."
curl -s -X POST "${API_URL}/${FACTORY_ID}/material-batches/MB-009/convert-to-frozen" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "convertedBy": 1,
    "convertedDate": "2025-11-20",
    "storageLocation": "D区冷冻室-3号位",
    "notes": "提前冷冻保存"
  }' | python3 -m json.tool

echo ""
echo "Done! Checking final status..."
mysql -u root cretas_db -e "SELECT batch_number, status FROM material_batches WHERE batch_number IN ('MB-003', 'MB-009');"
