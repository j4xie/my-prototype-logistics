#!/bin/bash

TOKEN=$(curl -s -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d '{"username":"proc_admin","password":"123456"}' | \
  python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('accessToken', ''))" 2>/dev/null)

echo "Token: ${TOKEN:0:20}..."
echo ""

echo "=== 测试1: 完整请求（包含所有字段） ==="
curl -s -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/equipment" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "EQ-DEBUG-FULL",
    "name": "完整测试设备",
    "category": "CUTTING",
    "model": "TEST-100",
    "manufacturer": "测试厂商",
    "purchaseDate": "2025-01-01",
    "purchasePrice": 100000.00,
    "status": "active",
    "location": "测试车间",
    "maintenanceIntervalDays": 180
  }' | python3 -m json.tool

echo ""
echo "=== 测试2: 最小请求（只包含必需字段name） ==="
curl -s -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/equipment" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "最小测试设备"
  }' | python3 -m json.tool

echo ""
echo "=== 检查后端日志（最近50行） ==="
tail -50 /Users/jietaoxie/my-prototype-logistics/backend-java/backend.log | grep -A 10 "创建设备\|Exception\|Error" | tail -30
