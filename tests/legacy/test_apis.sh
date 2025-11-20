#!/bin/bash

echo "=== 测试服务器API接口 ==="
echo ""
echo "服务器地址: http://47.251.121.76:10010"
echo ""

# 需要先登录获取token
echo "## 1. 测试登录接口"
LOGIN_RESPONSE=$(curl -s -X POST "http://47.251.121.76:10010/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testadmin",
    "password": "123456",
    "factoryId": "FISH_2025_001"
  }')
echo "$LOGIN_RESPONSE" | head -20
echo ""

# 提取token
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
echo "Token: ${TOKEN:0:50}..."
echo ""

# 测试用户管理接口
echo "## 2. 测试用户管理接口"
curl -s -X GET "http://47.251.121.76:10010/api/FISH_2025_001/users?page=0&size=5" \
  -H "Authorization: Bearer $TOKEN" | head -30
echo ""

# 测试白名单接口
echo "## 3. 测试白名单接口"
curl -s -X GET "http://47.251.121.76:10010/api/FISH_2025_001/whitelist?page=0&size=5" \
  -H "Authorization: Bearer $TOKEN" | head -30
echo ""

# 测试工厂管理接口
echo "## 4. 测试工厂管理接口"
curl -s -X GET "http://47.251.121.76:10010/api/platform/factories" \
  -H "Authorization: Bearer $TOKEN" | head -30
echo ""

