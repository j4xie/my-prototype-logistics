#!/bin/bash
echo "=== 测试转冻品API ==="
echo ""

BATCH_ID="1d3b647d-5615-474f-a966-39c7b4dfa2ec"
echo "批次ID: $BATCH_ID"
echo ""

echo "调用API..."
curl -s -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/material-batches/${BATCH_ID}/convert-to-frozen" \
  -H 'Content-Type: application/json' \
  -d '{"convertedBy":1,"convertedDate":"2025-11-20","storageLocation":"冷冻库-F区","notes":"测试转冻品"}' \
  | python3 -m json.tool

echo ""
echo "验证数据库..."
mysql -u root cretas_db -e "SELECT id, batch_number, status, storage_location FROM material_batches WHERE id = '${BATCH_ID}';"
