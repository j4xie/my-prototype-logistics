#!/bin/bash

# 认证API快速测试脚本
# 用法: ./test-auth-api.sh [本地|服务器] [用户名] [密码]

API_BASE_URL="${1:-服务器}"
USERNAME="${2:-super_admin}"
PASSWORD="${3:-123456}"

# 根据参数选择API地址
if [[ "$API_BASE_URL" == "本地" ]]; then
    API_URL="http://localhost:10010"
    echo "📍 使用本地API地址: $API_URL"
else
    API_URL="http://139.196.165.140:10010"
    echo "📍 使用服务器API地址: $API_URL"
fi

echo ""
echo "🔐 认证API测试"
echo "======================================"

# 1. 测试连接
echo ""
echo "1️⃣  测试服务器连接..."
if curl -s -f "$API_URL/api/mobile/auth/unified-login" > /dev/null 2>&1; then
    echo "✅ 服务器连接正常"
else
    echo "⚠️  服务器可能未启动"
fi

# 2. 测试登录
echo ""
echo "2️⃣  测试登录接口..."
echo "   用户名: $USERNAME"
echo "   密码: $PASSWORD"

LOGIN_RESPONSE=$(python3 << PYTHON_EOF
import requests
import json

response = requests.post(
    "$API_URL/api/mobile/auth/unified-login",
    json={
        "username": "$USERNAME",
        "password": "$PASSWORD",
        "deviceInfo": {
            "deviceId": "test-device-001",
            "deviceType": "Android",
            "osVersion": "11"
        }
    },
    headers={"Content-Type": "application/json"},
    timeout=10
)

result = response.json()
print(json.dumps(result, indent=2, ensure_ascii=False))
PYTHON_EOF
)

echo ""
echo "📋 服务器响应:"
echo "$LOGIN_RESPONSE"

# 3. 解析响应
echo ""
if echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); sys.exit(0 if data.get('success') else 1)" 2>/dev/null; then
    echo "✅ 登录成功！"

    # 提取Token信息
    TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('data', {}).get('token', ''))" 2>/dev/null)
    USER_ID=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('data', {}).get('userId', ''))" 2>/dev/null)
    ROLE=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('data', {}).get('role', ''))" 2>/dev/null)

    echo ""
    echo "📊 用户信息:"
    echo "   用户ID: $USER_ID"
    echo "   用户名: $USERNAME"
    echo "   角色: $ROLE"

    if [ ! -z "$TOKEN" ]; then
        echo ""
        echo "🔑 Token 信息:"
        echo "   Token: ${TOKEN:0:50}..."

        # 测试Token验证
        echo ""
        echo "3️⃣  测试Token验证..."

        VALIDATE_RESPONSE=$(curl -s -X GET \
            -H "Authorization: Bearer $TOKEN" \
            "$API_URL/api/mobile/auth/validate")

        echo "   验证结果: $VALIDATE_RESPONSE"
    fi
else
    echo "❌ 登录失败"
    ERROR_MESSAGE=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('message', '未知错误'))" 2>/dev/null)
    echo "   错误: $ERROR_MESSAGE"
fi

echo ""
echo "======================================"
echo "✅ 测试完成"
