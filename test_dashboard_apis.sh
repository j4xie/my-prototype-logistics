#!/bin/bash

echo "## 测试Dashboard API可用性"
echo ""

# 测试登录获取token
echo "### 1. 测试登录"
LOGIN_RESP=$(curl -s -X POST "http://106.14.165.234:10010/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"testadmin","password":"123456","factoryId":"FISH_2025_001"}')

echo "登录响应: ${LOGIN_RESP:0:200}..."
echo ""

# 提取token
TOKEN=$(echo "$LOGIN_RESP" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ 未能获取token"
    exit 1
fi

echo "✅ Token获取成功: ${TOKEN:0:30}..."
echo ""

# 测试各个dashboard端点
echo "### 2. 测试Dashboard端点"
echo ""

echo "2.1 测试 /dashboard/production"
curl -s -X GET "http://106.14.165.234:10010/api/mobile/FISH_2025_001/processing/dashboard/production" \
  -H "Authorization: Bearer $TOKEN" | head -c 300
echo ""
echo ""

echo "2.2 测试 /dashboard/overview"
curl -s -X GET "http://106.14.165.234:10010/api/mobile/FISH_2025_001/processing/dashboard/overview" \
  -H "Authorization: Bearer $TOKEN" | head -c 300
echo ""
echo ""

echo "2.3 测试 /dashboard/equipment"
curl -s -X GET "http://106.14.165.234:10010/api/mobile/FISH_2025_001/processing/dashboard/equipment" \
  -H "Authorization: Bearer $TOKEN" | head -c 300
echo ""
echo ""

echo "2.4 测试 /dashboard/quality"
curl -s -X GET "http://106.14.165.234:10010/api/mobile/FISH_2025_001/processing/dashboard/quality" \
  -H "Authorization: Bearer $TOKEN" | head -c 300
echo ""
