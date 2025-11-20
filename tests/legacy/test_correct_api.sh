#!/bin/bash

echo "## 测试Dashboard API可用性 (使用正确的登录接口)"
echo ""

# 测试登录获取token
echo "### 1. 测试统一登录接口"
LOGIN_RESP=$(curl -s -X POST "http://106.14.165.234:10010/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"testadmin","password":"123456","factoryId":"FISH_2025_001"}')

echo "登录响应: $LOGIN_RESP"
echo ""

# 提取token
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys, json; print(json.load(sys.stdin).get('data', {}).get('accessToken', ''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "❌ 未能获取token，尝试其他字段..."
    TOKEN=$(echo "$LOGIN_RESP" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
fi

if [ -z "$TOKEN" ]; then
    echo "❌ 未能获取token"
    exit 1
fi

echo "✅ Token获取成功: ${TOKEN:0:50}..."
echo ""

# 测试各个dashboard端点
echo "### 2. 测试Dashboard端点"
echo ""

echo "#### 2.1 测试 /dashboard/production"
PROD_RESP=$(curl -s -X GET "http://106.14.165.234:10010/api/mobile/FISH_2025_001/processing/dashboard/production" \
  -H "Authorization: Bearer $TOKEN")
echo "$PROD_RESP" | head -c 500
echo ""
echo ""

echo "#### 2.2 测试 /dashboard/overview"
OVER_RESP=$(curl -s -X GET "http://106.14.165.234:10010/api/mobile/FISH_2025_001/processing/dashboard/overview" \
  -H "Authorization: Bearer $TOKEN")
echo "$OVER_RESP" | head -c 500
echo ""
echo ""

echo "#### 2.3 测试 /dashboard/equipment"
EQUIP_RESP=$(curl -s -X GET "http://106.14.165.234:10010/api/mobile/FISH_2025_001/processing/dashboard/equipment" \
  -H "Authorization: Bearer $TOKEN")
echo "$EQUIP_RESP" | head -c 500
echo ""
echo ""

echo "#### 2.4 测试 /dashboard/quality"
QUAL_RESP=$(curl -s -X GET "http://106.14.165.234:10010/api/mobile/FISH_2025_001/processing/dashboard/quality" \
  -H "Authorization: Bearer $TOKEN")
echo "$QUAL_RESP" | head -c 500
echo ""
