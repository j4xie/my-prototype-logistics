#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:10010/api/mobile/auth/unified-login -H 'Content-Type: application/json' -d '{"username":"proc_admin","password":"123456"}' | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('accessToken', ''))" 2>/dev/null)

MB_002_ID=$(mysql -u root cretas_db -N -e "SELECT id FROM material_batches WHERE batch_number='MB-002' LIMIT 1;")

echo "Token: ${TOKEN:0:40}..."
echo "MB-002 ID: $MB_002_ID"
echo ""
echo "Testing reserve API..."

curl -s -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/material-batches/${MB_002_ID}/reserve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 50.0,
    "productionBatchId": "5145f9b1-30bf-4726-9692-0ede3bb0bb15",
    "notes": "预留测试"
  }' | python3 -m json.tool
