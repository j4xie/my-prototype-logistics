#!/bin/bash
# MallCenter 小程序公开 API 测试脚本
# 无需登录即可测试的 API 端点

BASE_URL="http://139.196.165.140:8081/prod-api"
APP_ID="wxf8e90943620b4080"

echo "=========================================="
echo "MallCenter 小程序公开 API 测试"
echo "服务器: $BASE_URL"
echo "AppID: $APP_ID"
echo "时间: $(date)"
echo "=========================================="

PASS=0
FAIL=0

test_api() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local data="$4"

  echo ""
  echo "--- 测试: $name ---"
  echo "[$method] $endpoint"

  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint" \
      -H "app-id: $APP_ID" \
      -H "Content-Type: application/json")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
      -H "app-id: $APP_ID" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  # 解析响应码
  code=$(echo "$body" | grep -o '"code":[0-9]*' | head -1 | cut -d':' -f2)

  if [ "$http_code" = "200" ]; then
    if [ "$code" = "200" ] || [ "$code" = "0" ]; then
      echo "✅ 成功 (HTTP $http_code, code: $code)"
      echo "响应: $(echo "$body" | head -c 200)..."
      ((PASS++))
    elif [ "$code" = "60002" ]; then
      echo "⚠️  需要登录 (code: 60002)"
      echo "响应: $body"
      ((PASS++))  # 对于公开API测试，返回60002表示端点存在
    else
      echo "❌ 业务错误 (HTTP $http_code, code: $code)"
      echo "响应: $body"
      ((FAIL++))
    fi
  else
    echo "❌ HTTP错误 (HTTP $http_code)"
    echo "响应: $body"
    ((FAIL++))
  fi
}

echo ""
echo "========== 模块1: 商品 API =========="

test_api "商品分类树" "GET" "/weixin/api/ma/goodscategory/tree" ""

test_api "商品列表(分页)" "GET" "/weixin/api/ma/goodsspu/page?pageNum=1&pageSize=5" ""

test_api "热门搜索词" "GET" "/weixin/api/ma/search-keyword/hot?limit=10" ""

test_api "搜索建议" "GET" "/weixin/api/ma/search-keyword/suggest?prefix=%E7%89%9B%E8%82%89&limit=5" ""

echo ""
echo "========== 模块2: 广告 API =========="

test_api "启动广告" "GET" "/advertisement/splash" ""

test_api "首页Banner" "GET" "/advertisement/banners" ""

echo ""
echo "========== 模块3: 健康检查 =========="

test_api "登录接口(空参数测试)" "POST" "/weixin/api/ma/wxuser/login" '{"jsCode":""}'

echo ""
echo "========== 模块4: 用户相关(需登录) =========="

test_api "获取用户信息" "GET" "/weixin/api/ma/wxuser" ""

test_api "购物车列表" "GET" "/weixin/api/ma/shoppingcart/page?pageNum=1&pageSize=10" ""

test_api "购物车数量" "GET" "/weixin/api/ma/shoppingcart/count" ""

test_api "订单列表" "GET" "/weixin/api/ma/orderinfo/page?pageNum=1&pageSize=10" ""

test_api "订单统计" "GET" "/weixin/api/ma/orderinfo/countAll" ""

test_api "收货地址列表" "GET" "/weixin/api/ma/useraddress/page?pageNum=1&pageSize=10" ""

test_api "我的优惠券" "GET" "/weixin/api/ma/coupon/my" ""

test_api "推荐信息" "GET" "/weixin/api/ma/referral/info" ""

test_api "通知列表" "GET" "/weixin/api/ma/notification/list?pageNum=1&pageSize=10" ""

test_api "未读通知数量" "GET" "/weixin/api/ma/notification/unread-count" ""

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
echo "✅ 通过: $PASS"
echo "❌ 失败: $FAIL"
echo "总计: $((PASS + FAIL))"
echo "=========================================="
