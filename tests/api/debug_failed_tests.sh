#!/bin/bash

API_URL="http://localhost:10010/api/mobile"
FACTORY_ID="CRETAS_2024_001"

# 登录
TOKEN=$(curl -s -X POST ${API_URL}/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d '{"username":"proc_admin","password":"123456"}' | \
  python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('accessToken', ''))" 2>/dev/null)

echo "Token: ${TOKEN:0:40}..."

# 获取MB-002的UUID
MB_002_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/material-batches?batchNumber=MB-002&page=1&pageSize=50" \
  -H "Authorization: Bearer $TOKEN")
MB_002_ID=$(echo $MB_002_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); items=data.get('data', {}).get('content', []); result=[item['id'] for item in items if item.get('batchNumber') == 'MB-002']; print(result[0] if result else '')" 2>/dev/null)

# 获取MB-003的UUID
MB_003_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/material-batches?batchNumber=MB-003&page=1&pageSize=50" \
  -H "Authorization: Bearer $TOKEN")
MB_003_ID=$(echo $MB_003_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); items=data.get('data', {}).get('content', []); result=[item['id'] for item in items if item.get('batchNumber') == 'MB-003']; print(result[0] if result else '')" 2>/dev/null)

# 获取MB-009的UUID
MB_009_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/material-batches?batchNumber=MB-009&page=1&pageSize=50" \
  -H "Authorization: Bearer $TOKEN")
MB_009_ID=$(echo $MB_009_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); items=data.get('data', {}).get('content', []); result=[item['id'] for item in items if item.get('batchNumber') == 'MB-009']; print(result[0] if result else '')" 2>/dev/null)

echo ""
echo "MB-002 ID: $MB_002_ID"
echo "MB-003 ID: $MB_003_ID"
echo "MB-009 ID: $MB_009_ID"

echo ""
echo "========== TEST 15: 批次预留 =========="
curl -s -X POST "${API_URL}/${FACTORY_ID}/material-batches/${MB_002_ID}/reserve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 50.0,
    "productionBatchId": "5145f9b1-30bf-4726-9692-0ede3bb0bb15",
    "notes": "预留给生产计划"
  }' | python3 -m json.tool

echo ""
echo "========== TEST 21: 转为冷冻 =========="
# 先查看MB-003当前状态
curl -s -X GET "${API_URL}/${FACTORY_ID}/material-batches/${MB_003_ID}" \
  -H "Authorization: Bearer $TOKEN" | \
  python3 -c "import sys, json; data=json.load(sys.stdin); d=data.get('data', {}); print(f\"当前状态: {d.get('status')}, 批次号: {d.get('batchNumber')}\")"

echo ""
curl -s -X POST "${API_URL}/${FACTORY_ID}/material-batches/${MB_003_ID}/convert-to-frozen" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "convertedBy": 1,
    "convertedDate": "2025-11-20",
    "storageLocation": "D区冷冻室2号",
    "notes": "延长保质期"
  }' | python3 -m json.tool

echo ""
echo "========== TEST 22: 解冻 =========="
# 先查看MB-009当前状态
curl -s -X GET "${API_URL}/${FACTORY_ID}/material-batches/${MB_009_ID}" \
  -H "Authorization: Bearer $TOKEN" | \
  python3 -c "import sys, json; data=json.load(sys.stdin); d=data.get('data', {}); print(f\"当前状态: {d.get('status')}, 批次号: {d.get('batchNumber')}\")"

echo ""
curl -s -X POST "${API_URL}/${FACTORY_ID}/material-batches/${MB_009_ID}/undo-frozen" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "convertedBy": 1,
    "convertedDate": "2025-11-20",
    "storageLocation": "A区冷藏室3号",
    "notes": "准备使用"
  }' | python3 -m json.tool
