#!/bin/bash

# 配额更新调试脚本
BASE_URL="http://localhost:10010"
FACTORY_ID="F001"

echo "=== 配额更新调试 ==="
echo ""

# 1. 登录
echo "1. 获取Token..."
LOGIN_RESP=$(curl -s -X POST "${BASE_URL}/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}')

TOKEN=$(echo "$LOGIN_RESP" | grep -o '"token":"[^"]*"' | sed 's/"token":"\(.*\)"/\1/')

if [ -z "$TOKEN" ]; then
    echo "❌ 登录失败"
    exit 1
fi

echo "✅ Token获取成功"
echo ""

# 2. 测试配额更新
echo "2. 测试配额更新 (newQuotaLimit参数)..."
QUOTA_RESP=$(curl -s -X PUT "${BASE_URL}/api/mobile/${FACTORY_ID}/ai/quota?newQuotaLimit=150" \
  -H "Authorization: Bearer $TOKEN")

echo "响应: $QUOTA_RESP"
echo ""

if echo "$QUOTA_RESP" | grep -q "success.*true"; then
    echo "✅ 配额更新成功"
else
    echo "❌ 配额更新失败"
fi
