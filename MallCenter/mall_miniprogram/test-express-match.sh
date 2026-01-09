#!/bin/bash
# 极速匹配功能测试

API_BASE="http://139.196.165.140:8083"
APP_ID="wxf8e90943620b4080"
TEST_SESSION="test_express_$(date +%s)"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 创建测试Session
SESSION_JSON='{"wxUserId":"1352168072700571649","appId":"wxf8e90943620b4080","sessionKey":"CNKq11a69WSezik2aobqsA==","openId":"ol3ea5DyEplVd0B5lD9gLwCme8zw"}'
ssh root@139.196.165.140 "redis-cli SET 'wx:ma:3rd_session:$TEST_SESSION' '$SESSION_JSON' EX 600" > /dev/null 2>&1

echo "=========================================="
echo "极速匹配功能测试 - 不存在的商品"
echo "=========================================="
echo -e "${GREEN}OK${NC}"
echo "Session: $TEST_SESSION"

# 测试1: 搜索不存在的商品
echo ""
echo "=== 搜索不存在的商品 (进口蓝莓果酱) ==="
RESPONSE=$(curl -s -X POST "$API_BASE/weixin/api/ma/ai/chat" \
  -H "Content-Type: application/json" \
  -H "app-id: $APP_ID" \
  -H "third-session: $TEST_SESSION" \
  -d '{"message":"我想买进口蓝莓果酱"}')

echo "--- 响应 ---"
echo "意图: $(echo $RESPONSE | jq -r '.data.intent // "N/A"')"
echo "有商品: $(echo $RESPONSE | jq -r '.data.hasProducts // "N/A"')"
echo "商品数: $(echo $RESPONSE | jq -r '.data.products | length // 0')"
echo "显示极速匹配: $(echo $RESPONSE | jq -r '.data.showExpressMatchOption // false')"
echo "---"
echo "AI回复:"
echo $RESPONSE | jq -r '.data.response // "无回复"'

# 测试2: 搜索另一个不存在的商品
echo ""
echo "=== 搜索另一个不存在的商品 (有机藜麦) ==="
RESPONSE2=$(curl -s -X POST "$API_BASE/weixin/api/ma/ai/chat" \
  -H "Content-Type: application/json" \
  -H "app-id: $APP_ID" \
  -H "third-session: $TEST_SESSION" \
  -d '{"message":"你们有卖有机藜麦吗"}')

echo "--- 响应 ---"
echo "意图: $(echo $RESPONSE2 | jq -r '.data.intent // "N/A"')"
echo "有商品: $(echo $RESPONSE2 | jq -r '.data.hasProducts // "N/A"')"
echo "商品数: $(echo $RESPONSE2 | jq -r '.data.products | length // 0')"
echo "显示极速匹配: $(echo $RESPONSE2 | jq -r '.data.showExpressMatchOption // false')"
echo "---"
echo "AI回复:"
echo $RESPONSE2 | jq -r '.data.response // "无回复"'

# 测试3: 搜索存在的商品
echo ""
echo "=== 搜索存在的商品 (牛筋丸) ==="
RESPONSE3=$(curl -s -X POST "$API_BASE/weixin/api/ma/ai/chat" \
  -H "Content-Type: application/json" \
  -H "app-id: $APP_ID" \
  -H "third-session: $TEST_SESSION" \
  -d '{"message":"我想买牛筋丸"}')

echo "--- 响应 ---"
echo "意图: $(echo $RESPONSE3 | jq -r '.data.intent // "N/A"')"
echo "有商品: $(echo $RESPONSE3 | jq -r '.data.hasProducts // "N/A"')"
echo "商品数: $(echo $RESPONSE3 | jq -r '.data.products | length // 0')"
echo "显示极速匹配: $(echo $RESPONSE3 | jq -r '.data.showExpressMatchOption // false')"
echo "---"
echo "AI回复:"
echo $RESPONSE3 | jq -r '.data.response // "无回复"'
echo "商品名称:"
echo $RESPONSE3 | jq -r '.data.products[].name // "无商品"' | head -3

# 清理
ssh root@139.196.165.140 "redis-cli DEL 'wx:ma:3rd_session:$TEST_SESSION'" > /dev/null 2>&1

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
