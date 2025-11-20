#!/bin/bash

# ================================================================
# 转冻品功能测试脚本
# ================================================================
# 用途: 测试 POST /api/mobile/{factoryId}/material-batches/{batchId}/convert-to-frozen
# 创建时间: 2025-11-20
# ================================================================

API_BASE_URL="http://localhost:10010/api/mobile"
FACTORY_ID="CRETAS_2024_001"

echo "================================================================"
echo "🧪 转冻品功能集成测试"
echo "================================================================"
echo ""

# ----------------------------------------------------------------
# 步骤1: 准备测试数据
# ----------------------------------------------------------------
echo "📝 步骤1: 准备测试数据..."

# 创建一个FRESH状态的批次
mysql -u root cretas_db << 'EOF'
-- 删除旧的测试批次
DELETE FROM material_batches WHERE batch_number = 'TEST_FRESH_001';

-- 创建测试批次
INSERT INTO material_batches (
  id,
  batch_number,
  factory_id,
  material_type_id,
  supplier_id,
  receipt_quantity,
  used_quantity,
  reserved_quantity,
  unit_price,
  total_cost,
  receipt_date,
  purchase_date,
  expire_date,
  status,
  storage_location,
  notes,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  '9999',
  'TEST_FRESH_001',
  'CRETAS_2024_001',
  '1',
  '1',
  100.00,
  0.00,
  0.00,
  25.00,
  2500.00,
  CURDATE(),
  CURDATE(),
  DATE_ADD(CURDATE(), INTERVAL 7 DAY),
  'FRESH',
  'A区-01货架',
  '测试批次 - 用于转冻品功能测试',
  NOW(),
  NOW(),
  NULL
);

-- 验证数据
SELECT
  id,
  batch_number,
  status,
  storage_location,
  expire_date,
  DATEDIFF(expire_date, CURDATE()) as days_until_expiry
FROM material_batches
WHERE batch_number = 'TEST_FRESH_001';
EOF

BATCH_ID=$(mysql -u root cretas_db -N -e "SELECT id FROM material_batches WHERE batch_number = 'TEST_FRESH_001';")

if [ -z "$BATCH_ID" ]; then
  echo "❌ 测试数据创建失败"
  exit 1
fi

echo "✅ 测试批次已创建: ID=$BATCH_ID, 批次号=TEST_FRESH_001"
echo ""

# ----------------------------------------------------------------
# 步骤2: 获取认证Token
# ----------------------------------------------------------------
echo "📝 步骤2: 登录获取Token..."

LOGIN_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "Admin@123456"
  }')

echo "登录响应: $LOGIN_RESPONSE"

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//')

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ 登录失败，无法获取Token"
  echo "响应: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Token获取成功: ${ACCESS_TOKEN:0:30}..."
echo ""

# ----------------------------------------------------------------
# 步骤3: 调用转冻品API
# ----------------------------------------------------------------
echo "📝 步骤3: 调用转冻品API..."

CONVERT_REQUEST='{
  "convertedBy": 1,
  "convertedDate": "'$(date +%Y-%m-%d)'",
  "storageLocation": "冷冻库-F区",
  "notes": "测试转冻品功能 - 批次即将过期"
}'

echo "请求体:"
echo "$CONVERT_REQUEST" | python3 -m json.tool
echo ""

CONVERT_RESPONSE=$(curl -s -X POST \
  "${API_BASE_URL}/${FACTORY_ID}/material-batches/${BATCH_ID}/convert-to-frozen" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "$CONVERT_REQUEST")

echo "API响应:"
echo "$CONVERT_RESPONSE" | python3 -m json.tool || echo "$CONVERT_RESPONSE"
echo ""

# ----------------------------------------------------------------
# 步骤4: 验证结果
# ----------------------------------------------------------------
echo "📝 步骤4: 验证数据库结果..."

mysql -u root cretas_db << EOF
SELECT
  id,
  batch_number,
  status,
  storage_location,
  expire_date,
  notes,
  updated_at
FROM material_batches
WHERE batch_number = 'TEST_FRESH_001';
EOF

echo ""
echo "================================================================"
echo "🎉 测试完成！"
echo "================================================================"
echo ""
echo "✅ 检查点："
echo "1. 批次状态是否从 FRESH 变为 FROZEN"
echo "2. 存储位置是否更新为 '冷冻库-F区'"
echo "3. notes字段是否包含转换记录"
echo "4. updated_at是否更新为最新时间"
echo ""
echo "📋 清理测试数据:"
echo "   mysql -u root cretas_db -e \"DELETE FROM material_batches WHERE batch_number = 'TEST_FRESH_001';\""
echo ""
