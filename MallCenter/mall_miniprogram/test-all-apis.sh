#!/bin/bash
# MallCenter 小程序完整 API 测试脚本
# 绕过微信登录，直接创建测试 session

BASE_URL="http://139.196.165.140:8081/prod-api"
APP_ID="wxf8e90943620b4080"

# 测试用户数据 (从 wx_user 表获取)
WX_USER_ID="1352168072700571649"
OPEN_ID="ol3ea5DyEplVd0B5lD9gLwCme8zw"
SESSION_KEY="CNKq11a69WSezik2aobqsA=="

# 生成测试 session
TEST_SESSION="test_session_$(date +%s)"
SESSION_JSON="{\"wxUserId\":\"$WX_USER_ID\",\"appId\":\"$APP_ID\",\"sessionKey\":\"$SESSION_KEY\",\"openId\":\"$OPEN_ID\"}"

echo "=========================================="
echo "MallCenter 小程序完整 API 测试"
echo "=========================================="
echo "服务器: $BASE_URL"
echo "AppID: $APP_ID"
echo "Session: $TEST_SESSION"
echo "时间: $(date)"
echo "=========================================="

# 在 Redis 中创建 session
echo ""
echo "=== 创建测试 Session ==="
ssh root@139.196.165.140 "redis-cli SET 'wx:ma:3rd_session:$TEST_SESSION' '$SESSION_JSON' EX 3600" 2>/dev/null
echo "Session 已创建 (有效期 1 小时)"

PASS=0
FAIL=0
TOTAL=0

test_api() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local data="$4"

  ((TOTAL++))
  echo ""
  echo "--- [$TOTAL] $name ---"
  echo "[$method] $endpoint"

  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint" \
      -H "app-id: $APP_ID" \
      -H "third-session: $TEST_SESSION" \
      -H "Content-Type: application/json")
  elif [ "$method" = "DELETE" ]; then
    response=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL$endpoint" \
      -H "app-id: $APP_ID" \
      -H "third-session: $TEST_SESSION" \
      -H "Content-Type: application/json")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
      -H "app-id: $APP_ID" \
      -H "third-session: $TEST_SESSION" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  code=$(echo "$body" | grep -o '"code":[0-9]*' | head -1 | cut -d':' -f2)
  msg=$(echo "$body" | grep -o '"msg":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ "$http_code" = "200" ]; then
    if [ "$code" = "200" ] || [ "$code" = "0" ]; then
      echo "✅ 成功 (code: $code)"
      ((PASS++))
    else
      echo "❌ 失败 (code: $code, msg: $msg)"
      ((FAIL++))
    fi
  else
    echo "❌ HTTP错误 ($http_code)"
    ((FAIL++))
  fi
}

echo ""
echo "========== 模块1: 用户 API (3个) =========="
test_api "获取用户信息" "GET" "/weixin/api/ma/wxuser" ""
test_api "保存用户信息" "POST" "/weixin/api/ma/wxuser" '{"nickName":"测试用户","sex":"1"}'

echo ""
echo "========== 模块2: 商品 API (3个) =========="
test_api "商品分类树" "GET" "/weixin/api/ma/goodscategory/tree" ""
test_api "商品列表" "GET" "/weixin/api/ma/goodsspu/page?pageNum=1&pageSize=10" ""
test_api "热门搜索词" "GET" "/weixin/api/ma/search-keyword/hot?limit=10" ""

echo ""
echo "========== 模块3: 购物车 API (3个) =========="
test_api "购物车列表" "GET" "/weixin/api/ma/shoppingcart/page?pageNum=1&pageSize=10" ""
test_api "购物车数量" "GET" "/weixin/api/ma/shoppingcart/count" ""

echo ""
echo "========== 模块4: 订单 API (3个) =========="
test_api "订单列表" "GET" "/weixin/api/ma/orderinfo/page?pageNum=1&pageSize=10" ""
test_api "订单统计" "GET" "/weixin/api/ma/orderinfo/countAll" ""

echo ""
echo "========== 模块5: 收货地址 API (1个) =========="
test_api "收货地址列表" "GET" "/weixin/api/ma/useraddress/page?pageNum=1&pageSize=10" ""

echo ""
echo "========== 模块6: 广告 API (2个) =========="
test_api "启动广告" "GET" "/advertisement/splash" ""
test_api "首页Banner" "GET" "/advertisement/banners" ""

echo ""
echo "========== 模块7: 优惠券 API (2个) =========="
test_api "我的优惠券" "GET" "/weixin/api/ma/coupon/my" ""
test_api "可用优惠券" "GET" "/weixin/api/ma/coupon/available?orderAmount=100" ""

echo ""
echo "========== 模块8: 推荐系统 API (3个) =========="
test_api "推荐信息" "GET" "/weixin/api/ma/referral/info" ""
test_api "推荐统计" "GET" "/weixin/api/ma/referral/stats" ""
test_api "推荐记录" "GET" "/weixin/api/ma/referral/records?pageNum=1&pageSize=10" ""

echo ""
echo "========== 模块9: 通知 API (2个) =========="
test_api "通知列表" "GET" "/weixin/api/ma/notification/list?pageNum=1&pageSize=10" ""
test_api "未读通知数量" "GET" "/weixin/api/ma/notification/unread-count" ""

echo ""
echo "========== 模块10: AI 功能 API (2个) =========="
test_api "AI对话" "POST" "/weixin/api/ma/ai/chat" '{"message":"推荐牛肉产品"}'
test_api "AI语义搜索" "GET" "/weixin/api/ma/ai/semantic-search?query=%E7%89%9B%E8%82%89&limit=5" ""

echo ""
echo "========== 模块11: 商户 API (1个) =========="
test_api "商户信息" "GET" "/weixin/api/ma/merchant/1" ""

echo ""
echo "========== 模块12: 溯源 API (1个) =========="
test_api "溯源查询" "GET" "/weixin/api/ma/traceability/batch/no/TEST001" ""

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
echo "✅ 通过: $PASS"
echo "❌ 失败: $FAIL"
echo "总计: $TOTAL"
echo "通过率: $(echo "scale=1; $PASS * 100 / $TOTAL" | bc)%"
echo "=========================================="

# 清理 session
echo ""
echo "清理测试 Session..."
ssh root@139.196.165.140 "redis-cli DEL 'wx:ma:3rd_session:$TEST_SESSION'" 2>/dev/null
echo "完成"
