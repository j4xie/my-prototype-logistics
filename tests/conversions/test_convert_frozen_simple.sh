#!/bin/bash
set -e

echo "=== 转冻品功能测试 ==="
echo ""

# 1. 创建测试批次
echo "1. 创建FRESH测试批次..."
mysql -u root cretas_db << 'EOF'
DELETE FROM material_batches WHERE batch_number = 'TEST_FRESH_001';

INSERT INTO material_batches (
  id, batch_number, factory_id, material_type_id, supplier_id,
  inbound_quantity, remaining_quantity, reserved_quantity, used_quantity,
  receipt_quantity, unit_price, total_cost, quantity_unit,
  inbound_date, expiry_date, purchase_date, status,
  storage_location, notes, created_by, updated_at
) VALUES (
  'TEST_9999', 'TEST_FRESH_001', 'CRETAS_2024_001', '1', '1',
  100.00, 100.00, 0.00, 0.00,
  100.00, 25.00, 2500.00, 'kg',
  CURDATE(), DATE_ADD(CURDATE(), INTERVAL 7 DAY), CURDATE(), 'FRESH',
  'A区-01货架', '测试批次', 1, NOW()
);

SELECT id, batch_number, status, storage_location FROM material_batches WHERE batch_number = 'TEST_FRESH_001';
EOF
echo "✅ 批次创建成功"
echo ""

# 2. 获取Token
echo "2. 登录获取Token..."
TOKEN_RESPONSE=$(curl -s -X POST 'http://localhost:10010/api/mobile/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@123456"}')
echo "登录响应: $TOKEN_RESPONSE"

TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
  echo "❌ Token获取失败"
  exit 1
fi
echo "✅ Token: ${TOKEN:0:50}..."
echo ""

# 3. 调用转冻品API
echo "3. 调用转冻品API..."
API_RESPONSE=$(curl -s -X POST 'http://localhost:10010/api/mobile/CRETAS_2024_001/material-batches/TEST_9999/convert-to-frozen' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"convertedBy\":1,\"convertedDate\":\"$(date +%Y-%m-%d)\",\"storageLocation\":\"冷冻库-F区\",\"notes\":\"测试转冻品\"}")
echo "API响应:"
echo "$API_RESPONSE" | python3 -m json.tool || echo "$API_RESPONSE"
echo ""

# 4. 验证结果
echo "4. 验证数据库..."
mysql -u root cretas_db << 'EOF'
SELECT id, batch_number, status, storage_location, notes FROM material_batches WHERE batch_number = 'TEST_FRESH_001';
EOF
echo ""

echo "=== 测试完成 ==="
echo "清理命令: mysql -u root cretas_db -e \"DELETE FROM material_batches WHERE batch_number = 'TEST_FRESH_001';\""
