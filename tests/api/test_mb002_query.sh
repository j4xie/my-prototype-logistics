#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:10010/api/mobile/auth/unified-login -H 'Content-Type: application/json' -d '{"username":"proc_admin","password":"123456"}' | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('accessToken', ''))" 2>/dev/null)

curl -s -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/material-batches?batchNumber=MB-002&page=1&pageSize=50" -H "Authorization: Bearer $TOKEN" > /tmp/mb002.json

python3 << 'EOF'
import json
with open('/tmp/mb002.json') as f:
    data = json.load(f)
items = data.get('data', {}).get('content', [])
print(f"Total items: {len(items)}")
for item in items[:10]:
    print(f"  {item.get('batchNumber')} - ID: {item.get('id')[:36]}")

result = [item['id'] for item in items if item.get('batchNumber') == 'MB-002']
print(f"\nFiltered MB-002: {result}")
EOF
