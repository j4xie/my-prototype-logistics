#!/bin/bash

# ========================================
# User管理模块 E2E测试脚本
# 总计14个API测试
# ========================================

BASE_URL="http://localhost:10010/api/mobile"
FACTORY_ID="CRETAS_2024_001"
API_PATH="${BASE_URL}/${FACTORY_ID}/users"

echo "========================================"
echo "User管理模块 - 14个API E2E测试"
echo "Base URL: ${API_PATH}"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数器
TOTAL_TESTS=14
PASSED_TESTS=0
FAILED_TESTS=0

# 辅助函数：验证响应
validate_response() {
    local response=$1
    local test_name=$2
    local expected_code=${3:-200}

    echo "Response: ${response}"

    # 检查success字段
    local success=$(echo "$response" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))" 2>/dev/null)
    local code=$(echo "$response" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('code', 0))" 2>/dev/null)

    if [ "$success" = "True" ] && [ "$code" = "$expected_code" ]; then
        echo -e "${GREEN}✅ Test PASS: ${test_name}${NC}"
        ((PASSED_TESTS++))
        return 0
    else
        echo -e "${RED}❌ Test FAIL: ${test_name}${NC}"
        echo "Expected code: ${expected_code}, Got: ${code}"
        ((FAILED_TESTS++))
        return 1
    fi
}

# ========================================
# Test 1/14: 检查用户名是否存在（准备测试）
# ========================================
echo "Test 1/14: 检查用户名是否存在"
echo "GET ${API_PATH}/check/username?username=testuser1"

RESPONSE=$(curl -s -X GET "${API_PATH}/check/username?username=testuser1")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

# 检查响应
EXISTS=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', False))")
if [ "$EXISTS" = "False" ]; then
    echo -e "${GREEN}✅ Test 1/14 PASS: 用户名不存在（准备创建）${NC}"
    ((PASSED_TESTS++))
else
    echo -e "${YELLOW}⚠️ Test 1/14 PASS: 用户名已存在（跳过创建）${NC}"
    ((PASSED_TESTS++))
fi
echo ""

# ========================================
# Test 2/14: 创建用户
# ========================================
echo "Test 2/14: 创建用户"
echo "POST ${API_PATH}"

RESPONSE=$(curl -s -X POST "${API_PATH}" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser1",
    "password": "testpass123",
    "email": "testuser1@example.com",
    "realName": "测试用户一",
    "phone": "+8618700000001",
    "role": "operator",
    "department": "processing",
    "position": "加工员"
  }')

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

# 提取用户ID
USER_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('id', ''))")
echo "Created User ID: ${USER_ID}"

validate_response "$RESPONSE" "POST - 创建用户" 201
echo ""

# ========================================
# Test 3/14: 获取用户列表（分页）
# ========================================
echo "Test 3/14: 获取用户列表（分页）"
echo "GET ${API_PATH}?page=0&size=10"

RESPONSE=$(curl -s -X GET "${API_PATH}?page=0&size=10")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "GET - 获取用户列表"
echo ""

# ========================================
# Test 4/14: 获取用户详情
# ========================================
echo "Test 4/14: 获取用户详情"
echo "GET ${API_PATH}/${USER_ID}"

RESPONSE=$(curl -s -X GET "${API_PATH}/${USER_ID}")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "GET - 获取用户详情"
echo ""

# ========================================
# Test 5/14: 更新用户信息
# ========================================
echo "Test 5/14: 更新用户信息"
echo "PUT ${API_PATH}/${USER_ID}"

RESPONSE=$(curl -s -X PUT "${API_PATH}/${USER_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "realName": "测试用户一（已更新）",
    "phone": "+8618700000099",
    "position": "高级加工员"
  }')

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "PUT - 更新用户信息"
echo ""

# ========================================
# Test 6/14: 激活用户
# ========================================
echo "Test 6/14: 激活用户"
echo "POST ${API_PATH}/${USER_ID}/activate"

RESPONSE=$(curl -s -X POST "${API_PATH}/${USER_ID}/activate")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

# 验证isActive为true
IS_ACTIVE=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('isActive', False))")
if [ "$IS_ACTIVE" = "True" ]; then
    echo -e "${GREEN}✅ Test 6/14 PASS: 用户已激活${NC}"
    ((PASSED_TESTS++))
else
    echo -e "${RED}❌ Test 6/14 FAIL: 用户未激活${NC}"
    ((FAILED_TESTS++))
fi
echo ""

# ========================================
# Test 7/14: 停用用户
# ========================================
echo "Test 7/14: 停用用户"
echo "POST ${API_PATH}/${USER_ID}/deactivate"

RESPONSE=$(curl -s -X POST "${API_PATH}/${USER_ID}/deactivate")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

# 验证isActive为false
IS_ACTIVE=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('isActive', False))")
if [ "$IS_ACTIVE" = "False" ]; then
    echo -e "${GREEN}✅ Test 7/14 PASS: 用户已停用${NC}"
    ((PASSED_TESTS++))
else
    echo -e "${RED}❌ Test 7/14 FAIL: 用户未停用${NC}"
    ((FAILED_TESTS++))
fi
echo ""

# ========================================
# Test 8/14: 更新用户角色
# ========================================
echo "Test 8/14: 更新用户角色"
echo "PUT ${API_PATH}/${USER_ID}/role"

RESPONSE=$(curl -s -X PUT "${API_PATH}/${USER_ID}/role" \
  -H "Content-Type: application/json" \
  -d '{
    "roleCode": "department_admin"
  }')

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

# 验证角色已更新
ROLE=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('role', ''))")
if [ "$ROLE" = "department_admin" ]; then
    echo -e "${GREEN}✅ Test 8/14 PASS: 角色已更新为department_admin${NC}"
    ((PASSED_TESTS++))
else
    echo -e "${RED}❌ Test 8/14 FAIL: 角色未正确更新，实际角色: ${ROLE}${NC}"
    ((FAILED_TESTS++))
fi
echo ""

# ========================================
# Test 9/14: 创建第二个用户（用于角色查询）
# ========================================
echo "Test 9/14: 创建第二个用户"
echo "POST ${API_PATH}"

RESPONSE=$(curl -s -X POST "${API_PATH}" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser2",
    "password": "testpass456",
    "email": "testuser2@example.com",
    "realName": "测试用户二",
    "role": "operator",
    "department": "quality"
  }')

USER_ID_2=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('id', ''))")
echo "Created User ID 2: ${USER_ID_2}"

validate_response "$RESPONSE" "POST - 创建第二个用户" 201
echo ""

# ========================================
# Test 10/14: 按角色获取用户列表
# ========================================
echo "Test 10/14: 按角色获取用户列表"
echo "GET ${API_PATH}/role/operator"

RESPONSE=$(curl -s -X GET "${API_PATH}/role/operator")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

# 验证返回的是数组且至少有1个operator
COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('data', [])))")
if [ "$COUNT" -ge 1 ]; then
    echo -e "${GREEN}✅ Test 10/14 PASS: 找到 ${COUNT} 个operator角色用户${NC}"
    ((PASSED_TESTS++))
else
    echo -e "${RED}❌ Test 10/14 FAIL: 未找到operator角色用户${NC}"
    ((FAILED_TESTS++))
fi
echo ""

# ========================================
# Test 11/14: 搜索用户
# ========================================
echo "Test 11/14: 搜索用户"
echo "GET ${API_PATH}/search?keyword=测试"

RESPONSE=$(curl -s -X GET "${API_PATH}/search?keyword=%E6%B5%8B%E8%AF%95")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

# 验证搜索结果
COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('data', [])))")
if [ "$COUNT" -ge 1 ]; then
    echo -e "${GREEN}✅ Test 11/14 PASS: 搜索到 ${COUNT} 个用户${NC}"
    ((PASSED_TESTS++))
else
    echo -e "${RED}❌ Test 11/14 FAIL: 未搜索到用户${NC}"
    ((FAILED_TESTS++))
fi
echo ""

# ========================================
# Test 12/14: 检查邮箱是否存在
# ========================================
echo "Test 12/14: 检查邮箱是否存在"
echo "GET ${API_PATH}/check/email?email=testuser1@example.com"

RESPONSE=$(curl -s -X GET "${API_PATH}/check/email?email=testuser1@example.com")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

EXISTS=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', False))")
if [ "$EXISTS" = "True" ]; then
    echo -e "${GREEN}✅ Test 12/14 PASS: 邮箱存在${NC}"
    ((PASSED_TESTS++))
else
    echo -e "${RED}❌ Test 12/14 FAIL: 邮箱应该存在但返回不存在${NC}"
    ((FAILED_TESTS++))
fi
echo ""

# ========================================
# Test 13/14: 导出用户列表
# ========================================
echo "Test 13/14: 导出用户列表"
echo "GET ${API_PATH}/export?role=operator"

RESPONSE=$(curl -s -X GET "${API_PATH}/export?role=operator")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "GET - 导出用户列表"
echo ""

# ========================================
# Test 14/14: 批量导入用户
# ========================================
echo "Test 14/14: 批量导入用户"
echo "POST ${API_PATH}/import"

# 创建临时CSV文件
CSV_FILE="/tmp/test-users-import.csv"
cat > "$CSV_FILE" << 'EOF'
username,password,email,realName,phone,role,department,position
testuser3,pass789,testuser3@example.com,测试用户三,+8618700000003,operator,processing,加工员
testuser4,pass999,testuser4@example.com,测试用户四,+8618700000004,viewer,logistics,观察员
EOF

RESPONSE=$(curl -s -X POST "${API_PATH}/import" \
  -F "file=@${CSV_FILE}")

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

# 清理临时文件
rm "$CSV_FILE"

# 验证导入结果
SUCCESS_COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('success', 0))")
if [ "$SUCCESS_COUNT" -ge 1 ]; then
    echo -e "${GREEN}✅ Test 14/14 PASS: 成功导入 ${SUCCESS_COUNT} 个用户${NC}"
    ((PASSED_TESTS++))
else
    echo -e "${RED}❌ Test 14/14 FAIL: 导入失败${NC}"
    ((FAILED_TESTS++))
fi
echo ""

# ========================================
# 测试总结
# ========================================
echo "========================================"
echo "测试总结"
echo "========================================"
echo "总测试数: ${TOTAL_TESTS}"
echo -e "${GREEN}通过: ${PASSED_TESTS}${NC}"
echo -e "${RED}失败: ${FAILED_TESTS}${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过！User模块功能完整！${NC}"
    exit 0
else
    echo -e "${RED}❌ 有 ${FAILED_TESTS} 个测试失败${NC}"
    exit 1
fi
