#!/bin/bash

echo "======================================"
echo "Dashboard API 测试脚本"
echo "服务器: 139.196.165.140:10010"
echo "======================================"
echo ""

# 测试登录获取token
echo "### 步骤1: 测试统一登录接口"
echo ""

LOGIN_RESP=$(curl -s -X POST "http://139.196.165.140:10010/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"proc_admin","password":"123456","factoryId":"F001"}')

echo "登录响应: ${LOGIN_RESP:0:200}..."
echo ""

# 提取token
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('data', {}).get('accessToken', ''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "❌ 未能获取token - 登录可能失败"
    exit 1
fi

echo "✅ Token: ${TOKEN:0:50}..."
echo ""

# 测试 dashboard/production
echo "#### 测试 Dashboard Production"
curl -s -X GET "http://139.196.165.140:10010/api/mobile/F001/processing/dashboard/production" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null | head -30

echo ""
