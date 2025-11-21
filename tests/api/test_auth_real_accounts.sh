#!/bin/bash

# Phase 1 认证测试 - 使用真实测试账号
# 密码: 123456 (所有账号)
# 生成时间: 2025-11-20

set -e

BASE_URL="http://localhost:10010"
API_URL="${BASE_URL}/api/mobile"
REPORT_FILE="test-reports/phase1-auth-real-accounts-report.md"

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 测试计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试结果数组
declare -a TEST_RESULTS

# 打印测试结果
print_result() {
  local test_name="$1"
  local result="$2"
  local details="$3"

  TOTAL_TESTS=$((TOTAL_TESTS + 1))

  if [ "$result" == "PASS" ]; then
    echo -e "${GREEN}✓${NC} ${test_name}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    TEST_RESULTS+=("✅ **${test_name}**: PASS")
    if [ -n "$details" ]; then
      TEST_RESULTS+=("  - ${details}")
    fi
  else
    echo -e "${RED}✗${NC} ${test_name}"
    echo -e "  ${RED}${details}${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    TEST_RESULTS+=("❌ **${test_name}**: FAIL - ${details}")
  fi
}

echo "=========================================="
echo "Phase 1 认证测试 (真实账号)"
echo "=========================================="
echo "Backend: ${BASE_URL}"
echo "密码: 123456 (所有账号)"
echo "开始时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ================================================
# Test 1: Backend连接测试 (使用登录endpoint测试)
# ================================================
echo "Test 1: Backend连接测试"
# 使用错误密码测试endpoint是否可达
CONN_TEST=$(curl -s -X POST "${API_URL}/auth/unified-login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"test","password":"test"}' 2>/dev/null || echo '{"code":0}')
RESPONSE_CODE=$(echo "$CONN_TEST" | python3 -c "import sys, json; print(json.load(sys.stdin).get('code', 0))" 2>/dev/null || echo "0")

if [ "$RESPONSE_CODE" != "0" ]; then
  print_result "Backend连接测试" "PASS" "Backend可达, 端口: 10010"
else
  print_result "Backend连接测试" "FAIL" "Backend未响应"
  exit 1
fi

echo ""

# ================================================
# Test 2-9: 8个真实账号登录测试
# ================================================
echo "Test 2-9: 8个真实账号登录测试"

declare -A TEST_USERS=(
  ["平台管理员"]="admin"
  ["开发者"]="developer"
  ["平台超管"]="platform_admin"
  ["权限管理员"]="perm_admin"
  ["加工部管理员"]="proc_admin"
  ["养殖部管理员"]="farm_admin"
  ["物流部管理员"]="logi_admin"
  ["加工操作员"]="proc_user"
)

declare -A EXPECTED_ROLES=(
  ["admin"]="factory_super_admin"
  ["developer"]="factory_super_admin"
  ["platform_admin"]="factory_super_admin"
  ["perm_admin"]="permission_admin"
  ["proc_admin"]="department_admin"
  ["farm_admin"]="department_admin"
  ["logi_admin"]="department_admin"
  ["proc_user"]="operator"
)

declare -A ACCESS_TOKENS
declare -A REFRESH_TOKENS
declare -A FACTORY_IDS

for desc in "平台管理员" "开发者" "平台超管" "权限管理员" "加工部管理员" "养殖部管理员" "物流部管理员" "加工操作员"; do
  username="${TEST_USERS[$desc]}"
  expected_role="${EXPECTED_ROLES[$username]}"

  LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/unified-login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${username}\",\"password\":\"123456\"}" 2>/dev/null || echo '{"success":false}')

  SUCCESS=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "False")

  if [ "$SUCCESS" == "True" ]; then
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
    REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['refreshToken'])" 2>/dev/null)
    USER_ROLE=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['role'])" 2>/dev/null)
    FACTORY_ID=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data'].get('factoryId', ''))" 2>/dev/null)

    ACCESS_TOKENS[$username]="$ACCESS_TOKEN"
    REFRESH_TOKENS[$username]="$REFRESH_TOKEN"
    FACTORY_IDS[$username]="$FACTORY_ID"

    if [ "$USER_ROLE" == "$expected_role" ]; then
      print_result "登录测试: ${desc} (${username})" "PASS" "角色: ${USER_ROLE}, 工厂: ${FACTORY_ID}"
    else
      print_result "登录测试: ${desc} (${username})" "FAIL" "期望角色: ${expected_role}, 实际: ${USER_ROLE}"
    fi
  else
    ERROR_MSG=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('message', 'Unknown error'))" 2>/dev/null)
    print_result "登录测试: ${desc} (${username})" "FAIL" "登录失败: ${ERROR_MSG}"
  fi
done

echo ""

# ================================================
# Test 10: Token刷新测试
# ================================================
echo "Test 10: Token刷新测试"

if [ -n "${REFRESH_TOKENS[admin]}" ]; then
  REFRESH_RESPONSE=$(curl -s -X POST "${API_URL}/auth/refresh-token" \
    -H 'Content-Type: application/json' \
    -d "{\"refreshToken\":\"${REFRESH_TOKENS[admin]}\"}" 2>/dev/null || echo '{"success":false}')

  SUCCESS=$(echo "$REFRESH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "False")

  if [ "$SUCCESS" == "True" ]; then
    NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
    if [ -n "$NEW_ACCESS_TOKEN" ] && [ "$NEW_ACCESS_TOKEN" != "${ACCESS_TOKENS[admin]}" ]; then
      print_result "Token刷新" "PASS" "新access token成功生成"
      ACCESS_TOKENS[admin]="$NEW_ACCESS_TOKEN"
    else
      print_result "Token刷新" "FAIL" "新token与旧token相同或为空"
    fi
  else
    ERROR_MSG=$(echo "$REFRESH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('message', 'Unknown error'))" 2>/dev/null)
    print_result "Token刷新" "FAIL" "刷新失败: ${ERROR_MSG}"
  fi
else
  print_result "Token刷新" "FAIL" "admin账号没有refresh token"
fi

echo ""

# ================================================
# Test 11: 错误密码拒绝
# ================================================
echo "Test 11: 错误密码拒绝测试"

INVALID_RESPONSE=$(curl -s -X POST "${API_URL}/auth/unified-login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"wrongpassword"}' 2>/dev/null || echo '{"success":false}')

SUCCESS=$(echo "$INVALID_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "False")

if [ "$SUCCESS" == "False" ]; then
  ERROR_MSG=$(echo "$INVALID_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('message', 'Unknown error'))" 2>/dev/null)
  print_result "错误密码拒绝" "PASS" "正确拒绝: ${ERROR_MSG}"
else
  print_result "错误密码拒绝" "FAIL" "错误密码应被拒绝但被接受"
fi

echo ""

# ================================================
# Test 12: 无效Token拒绝
# ================================================
echo "Test 12: 无效Token拒绝测试"

INVALID_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid"

# 尝试访问需要认证的endpoint
INVALID_TOKEN_RESPONSE=$(curl -s -X GET "${API_URL}/dashboard/${FACTORY_IDS[proc_admin]}" \
  -H "Authorization: Bearer ${INVALID_TOKEN}" 2>/dev/null || echo '{"success":false}')

SUCCESS=$(echo "$INVALID_TOKEN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "False")

if [ "$SUCCESS" == "False" ]; then
  ERROR_MSG=$(echo "$INVALID_TOKEN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('message', 'Unknown error'))" 2>/dev/null)
  print_result "无效Token拒绝" "PASS" "正确拒绝无效token: ${ERROR_MSG}"
else
  print_result "无效Token拒绝" "FAIL" "无效token应被拒绝但被接受"
fi

echo ""

# ================================================
# Test 13: 跨工厂权限隔离测试
# ================================================
echo "Test 13-14: 跨工厂权限隔离测试"

# Test 13: proc_admin访问自己的工厂 (CRETAS_2024_001) - 应成功
if [ -n "${ACCESS_TOKENS[proc_admin]}" ] && [ -n "${FACTORY_IDS[proc_admin]}" ]; then
  OWN_FACTORY_RESPONSE=$(curl -s -X GET "${API_URL}/dashboard/${FACTORY_IDS[proc_admin]}" \
    -H "Authorization: Bearer ${ACCESS_TOKENS[proc_admin]}" 2>/dev/null || echo '{"success":false}')

  SUCCESS=$(echo "$OWN_FACTORY_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "False")

  if [ "$SUCCESS" == "True" ]; then
    print_result "访问自己工厂Dashboard (proc_admin → ${FACTORY_IDS[proc_admin]})" "PASS" "授权访问成功"
  else
    ERROR_MSG=$(echo "$OWN_FACTORY_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('message', 'Unknown error'))" 2>/dev/null)
    print_result "访问自己工厂Dashboard (proc_admin → ${FACTORY_IDS[proc_admin]})" "FAIL" "访问被拒绝: ${ERROR_MSG}"
  fi
else
  print_result "访问自己工厂Dashboard (proc_admin)" "FAIL" "没有access token或factory_id"
fi

# Test 14: proc_admin尝试访问PLATFORM工厂 - 应失败
if [ -n "${ACCESS_TOKENS[proc_admin]}" ]; then
  CROSS_FACTORY_RESPONSE=$(curl -s -X GET "${API_URL}/dashboard/PLATFORM" \
    -H "Authorization: Bearer ${ACCESS_TOKENS[proc_admin]}" 2>/dev/null || echo '{"success":false}')

  SUCCESS=$(echo "$CROSS_FACTORY_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "False")

  if [ "$SUCCESS" == "False" ]; then
    ERROR_MSG=$(echo "$CROSS_FACTORY_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('message', 'Unknown error'))" 2>/dev/null)
    if [[ "$ERROR_MSG" == *"权限"* ]] || [[ "$ERROR_MSG" == *"permission"* ]] || [[ "$ERROR_MSG" == *"Forbidden"* ]] || [[ "$ERROR_MSG" == *"不允许"* ]]; then
      print_result "跨工厂访问拒绝 (proc_admin → PLATFORM)" "PASS" "正确拒绝: ${ERROR_MSG}"
    else
      print_result "跨工厂访问拒绝 (proc_admin → PLATFORM)" "FAIL" "非预期错误: ${ERROR_MSG}"
    fi
  else
    print_result "跨工厂访问拒绝 (proc_admin → PLATFORM)" "FAIL" "跨工厂访问应被拒绝但被允许"
  fi
else
  print_result "跨工厂访问拒绝 (proc_admin)" "FAIL" "没有access token"
fi

echo ""

# ================================================
# 汇总
# ================================================
echo "=========================================="
echo "测试汇总"
echo "=========================================="
echo -e "总测试数:  ${TOTAL_TESTS}"
echo -e "通过:      ${GREEN}${PASSED_TESTS}${NC}"
echo -e "失败:      ${RED}${FAILED_TESTS}${NC}"
PASS_RATE=$(awk "BEGIN {printf \"%.1f\", (${PASSED_TESTS}/${TOTAL_TESTS})*100}")
echo -e "通过率:    ${PASS_RATE}%"
echo "结束时间:  $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ================================================
# 生成Markdown报告
# ================================================
mkdir -p test-reports

cat > "$REPORT_FILE" << EOF
# Phase 1 认证测试报告 (真实账号)

**生成时间**: $(date '+%Y-%m-%d %H:%M:%S')
**Backend**: ${BASE_URL}
**测试脚本**: \`tests/api/test_auth_real_accounts.sh\`
**测试账号**: 8个真实账号 (密码: 123456)

---

## 测试汇总

| 指标 | 数值 |
|------|------|
| 总测试数 | ${TOTAL_TESTS} |
| 通过 | ${PASSED_TESTS} ✅ |
| 失败 | ${FAILED_TESTS} ❌ |
| 通过率 | ${PASS_RATE}% |

---

## 测试结果

EOF

for result in "${TEST_RESULTS[@]}"; do
  echo "$result" >> "$REPORT_FILE"
done

cat >> "$REPORT_FILE" << EOF

---

## 测试账号信息

### 平台用户 (factory_id: PLATFORM)

| 用户名 | 角色 | 描述 |
|--------|------|------|
| admin | factory_super_admin | 平台管理员 |
| developer | factory_super_admin | 开发者 |
| platform_admin | factory_super_admin | 平台超管 |

### 工厂用户 (factory_id: CRETAS_2024_001)

| 用户名 | 角色 | 部门 | 描述 |
|--------|------|------|------|
| perm_admin | permission_admin | management | 权限管理员 |
| proc_admin | department_admin | processing | 加工部管理员 |
| farm_admin | department_admin | farming | 养殖部管理员 |
| logi_admin | department_admin | logistics | 物流部管理员 |
| proc_user | operator | processing | 加工操作员 |

**所有账号密码**: 123456

---

## 测试类别

### 1. Backend健康检查 (1项)
- 验证Backend服务运行在端口10010
- 检查API health endpoint正确响应

### 2. 8个真实账号登录 (8项)
- 平台管理员 (admin)
- 开发者 (developer)
- 平台超管 (platform_admin)
- 权限管理员 (perm_admin)
- 加工部管理员 (proc_admin)
- 养殖部管理员 (farm_admin)
- 物流部管理员 (logi_admin)
- 加工操作员 (proc_user)

### 3. Token管理 (1项)
- Token刷新功能
- 新access token生成

### 4. 安全性 (2项)
- 错误密码拒绝
- 无效token拒绝

### 5. 权限隔离 (2项)
- 同工厂访问 (应成功)
- 跨工厂访问 (应失败)

---

## 下一步

EOF

if [ $FAILED_TESTS -eq 0 ]; then
  cat >> "$REPORT_FILE" << EOF
✅ **所有认证测试通过！**

继续Phase 1.2: 主导航和主屏幕测试

\`\`\`bash
bash tests/api/test_navigation.sh
\`\`\`
EOF
else
  cat >> "$REPORT_FILE" << EOF
❌ **${FAILED_TESTS}个测试失败**

**需要处理**: 在继续导航测试前修复认证问题。

查看上述失败测试并:
1. 检查backend日志: \`tail -100 backend-java/backend.log\`
2. 验证测试数据已加载: \`mysql -u root cretas_db < tests/test-data/create_standard_test_accounts.sql\`
3. 检查用户凭据是否匹配期望值
4. 验证JWT token配置
EOF
fi

cat >> "$REPORT_FILE" << EOF

---

**报告结束**
EOF

echo "报告已生成: ${REPORT_FILE}"

# 返回适当的退出码
if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}所有测试通过！${NC}"
  exit 0
else
  echo -e "${RED}部分测试失败。详见报告。${NC}"
  exit 1
fi
