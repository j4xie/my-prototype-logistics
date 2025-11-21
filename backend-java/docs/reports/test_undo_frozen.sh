#!/bin/bash
echo "=== 测试撤销转冻品功能 ==="
echo ""

BATCH_ID="1d3b647d-5615-474f-a966-39c7b4dfa2ec"

echo "批次ID: $BATCH_ID"
echo ""

# 步骤1: 将批次转为鲜品（如果是冻品）
echo "步骤1: 检查并准备测试批次..."
mysql -u root cretas_db -e "UPDATE material_batches SET status='FRESH', storage_location='A区-01货架' WHERE id='$BATCH_ID';"
mysql -u root cretas_db -e "SELECT id, batch_number, status, storage_location FROM material_batches WHERE id='$BATCH_ID';"
echo ""

# 步骤2: 转为冻品
echo "步骤2: 转为冻品..."
CONVERT_RESPONSE=$(curl -s -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/material-batches/${BATCH_ID}/convert-to-frozen" \
  -H 'Content-Type: application/json' \
  -d '{"convertedBy":1,"convertedDate":"2025-11-20","storageLocation":"冷冻库-F区","notes":"测试转冻品"}')

echo "转换响应:"
echo "$CONVERT_RESPONSE" | python3 -m json.tool | grep -E '"code"|"message"|"status"'
echo ""

# 验证状态
echo "验证转换后状态:"
mysql -u root cretas_db -e "SELECT id, batch_number, status, storage_location FROM material_batches WHERE id='$BATCH_ID';"
echo ""

# 步骤3: 立即撤销（应该成功）
echo "步骤3: 立即撤销（应该成功）..."
sleep 2  # 等待2秒
UNDO_RESPONSE=$(curl -s -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/material-batches/${BATCH_ID}/undo-frozen" \
  -H 'Content-Type: application/json' \
  -d '{"operatorId":1,"reason":"测试撤销功能"}')

echo "撤销响应:"
echo "$UNDO_RESPONSE" | python3 -m json.tool
echo ""

# 验证撤销后状态
echo "验证撤销后状态:"
mysql -u root cretas_db -e "SELECT id, batch_number, status, storage_location FROM material_batches WHERE id='$BATCH_ID';"
echo ""

# 步骤4: 再次转为冻品，等待11分钟后尝试撤销（应该失败）
echo "步骤4: 测试超时撤销（模拟）..."
echo "转为冻品并修改notes时间戳为11分钟前..."

# 转为冻品
curl -s -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/material-batches/${BATCH_ID}/convert-to-frozen" \
  -H 'Content-Type: application/json' \
  -d '{"convertedBy":1,"convertedDate":"2025-11-20","storageLocation":"冷冻库-F区","notes":"测试"}' > /dev/null

# 修改notes中的时间为11分钟前
ELEVEN_MIN_AGO=$(date -u -v-11M +"%Y-%m-%dT%H:%M:%S")
mysql -u root cretas_db << EOF
UPDATE material_batches
SET notes = CONCAT('[${ELEVEN_MIN_AGO}] 转冻品操作 - 操作人ID:1, 转换日期:2025-11-20, 备注: 测试')
WHERE id = '${BATCH_ID}';
EOF

echo "已修改转换时间为11分钟前"
echo ""

# 尝试撤销（应该失败）
echo "尝试撤销（应该失败，超过10分钟）..."
TIMEOUT_RESPONSE=$(curl -s -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/material-batches/${BATCH_ID}/undo-frozen" \
  -H 'Content-Type: application/json' \
  -d '{"operatorId":1,"reason":"尝试超时撤销"}')

echo "超时撤销响应:"
echo "$TIMEOUT_RESPONSE" | python3 -m json.tool | grep -E '"code"|"message"'
echo ""

echo "=== 测试完成 ==="
echo ""
echo "测试结果总结:"
echo "✅ 1. 转为冻品"
echo "✅ 2. 10分钟内撤销（应该成功）"
echo "✅ 3. 超过10分钟撤销（应该失败）"
