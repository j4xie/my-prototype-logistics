#!/bin/bash

TOKEN=$(curl -s -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d '{"username":"proc_admin","password":"123456"}' | \
  python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('accessToken', ''))" 2>/dev/null)

EQUIPMENT_ID_1=$(mysql -u root cretas_db -N -e "SELECT id FROM factory_equipment WHERE factory_id='CRETAS_2024_001' LIMIT 1 OFFSET 0;")
EQUIPMENT_ID_2=$(mysql -u root cretas_db -N -e "SELECT id FROM factory_equipment WHERE factory_id='CRETAS_2024_001' LIMIT 1 OFFSET 1;")

echo "Token: ${TOKEN:0:20}..."
echo "Equipment ID 1: $EQUIPMENT_ID_1"
echo "Equipment ID 2: $EQUIPMENT_ID_2"
echo ""

echo "=== TEST 11: 状态更新 ==="
curl -s -X PUT "http://localhost:10010/api/mobile/CRETAS_2024_001/equipment/${EQUIPMENT_ID_2}/status?status=RUNNING" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo ""
echo "=== TEST 12: 启动设备 ==="
curl -s -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/equipment/${EQUIPMENT_ID_2}/start?notes=测试启动" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo ""
echo "=== TEST 14: 设备维护 ==="
curl -s -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/equipment/${EQUIPMENT_ID_1}/maintenance?maintenanceDate=2025-11-21&cost=5000&description=定期保养" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo ""
echo "=== TEST 22: OEE ==="
curl -s -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/equipment/${EQUIPMENT_ID_1}/oee?startDate=2025-11-01&endDate=2025-11-21" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
