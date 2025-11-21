#!/bin/bash

API_URL="http://localhost:10010/api/mobile"
FACTORY_ID="CRETAS_2024_001"

# Login
TOKEN=$(curl -s -X POST ${API_URL}/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d '{"username":"proc_admin","password":"123456"}' | \
  python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('accessToken', ''))" 2>/dev/null)

echo "Token: ${TOKEN:0:40}..."

# Test query with batchNumber
echo ""
echo "Testing query with batchNumber=MB-001:"
curl -s -X GET "${API_URL}/${FACTORY_ID}/material-batches?batchNumber=MB-001&page=1&pageSize=1" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo ""
echo "Listing all batches with MB- prefix:"
curl -s -X GET "${API_URL}/${FACTORY_ID}/material-batches?page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN" | \
  python3 -c "import sys, json; data=json.load(sys.stdin); items=data.get('data', {}).get('items', []); [print(f\"{item.get('id')[:36]}  {item.get('batchNumber')}\") for item in items if 'MB-' in item.get('batchNumber', '')]"
