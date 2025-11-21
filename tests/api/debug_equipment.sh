#!/bin/bash

TOKEN=$(curl -s -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d '{"username":"proc_admin","password":"123456"}' | \
  python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('accessToken', ''))" 2>/dev/null)

echo "Token: ${TOKEN:0:20}..."
echo ""

echo "=== TEST 1: 创建设备 ==="
curl -s -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/equipment" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "EQ-DEBUG-001",
    "name": "调试设备",
    "category": "CUTTING",
    "status": "IDLE"
  }' | python3 -m json.tool

echo ""
echo "=== TEST 11: 更新设备状态 (设备ID 103) ==="
curl -s -X PUT "http://localhost:10010/api/mobile/CRETAS_2024_001/equipment/103/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "RUNNING",
    "notes": "测试设备启动"
  }' | python3 -m json.tool

echo ""
echo "=== TEST 12: 启动设备 (设备ID 103) ==="
curl -s -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/equipment/103/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "开始生产"
  }' | python3 -m json.tool

echo ""
echo "=== TEST 14: 设备维护 (设备ID 101) ==="
curl -s -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/equipment/101/maintenance" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "maintenanceType": "PREVENTIVE",
    "notes": "定期保养",
    "cost": 5000.00
  }' | python3 -m json.tool

echo ""
echo "=== TEST 17: 设备统计信息 (设备ID 101) ==="
curl -s -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/equipment/101/statistics" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo ""
echo "=== TEST 21: 设备效率报告 (设备ID 101) ==="
curl -s -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/equipment/101/efficiency-report" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo ""
echo "=== TEST 22: 设备OEE (设备ID 101) ==="
curl -s -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/equipment/101/oee" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo ""
echo "=== TEST 23: 批量导入 ==="
curl -s -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/equipment/import" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "equipments": [
      {
        "code": "EQ-IMPORT-001",
        "name": "导入测试设备1",
        "category": "CUTTING",
        "status": "IDLE"
      }
    ]
  }' | python3 -m json.tool
