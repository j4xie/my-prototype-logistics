#!/bin/bash

# Permission Control Test Runner for v10.0 Intent Recognition
# Tests the 03-permission-control.json test cases

BASE_URL="http://139.196.165.140:10010"
LOGIN_URL="$BASE_URL/api/mobile/auth/unified-login"
EXECUTE_URL="$BASE_URL/api/mobile/F001/ai/execute"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Results tracking
PASSED=0
FAILED=0
SKIPPED=0

# Declare associative array for tokens
declare -A TOKENS

# Function to login and get token
login() {
    local username=$1
    local password=$2

    # Check if we already have token
    if [[ -n "${TOKENS[$username]}" ]]; then
        echo "${TOKENS[$username]}"
        return 0
    fi

    local response=$(curl -s -X POST "$LOGIN_URL" \
        -H "Content-Type: application/json" \
        -d "{\"username\": \"$username\", \"password\": \"$password\"}")

    local token=$(echo "$response" | jq -r '.data.accessToken // .data.token // empty')

    if [[ -n "$token" && "$token" != "null" ]]; then
        TOKENS[$username]=$token
        echo "$token"
        return 0
    else
        echo ""
        return 1
    fi
}

# Function to execute intent and get result
execute_intent() {
    local token=$1
    local input=$2

    local response=$(curl -s -X POST "$EXECUTE_URL" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $token" \
        -d "{\"userInput\": \"$input\"}")

    echo "$response"
}

# Function to check result
check_result() {
    local response=$1
    local expected=$2
    local test_id=$3

    # Extract status/result from response
    local status=$(echo "$response" | jq -r '.data.status // .data.result // .status // empty')
    local requires_confirmation=$(echo "$response" | jq -r '.data.requiresConfirmation // false')
    local requires_approval=$(echo "$response" | jq -r '.data.requiresApproval // false')
    local permission_denied=$(echo "$response" | jq -r '.data.permissionDenied // false')
    local message=$(echo "$response" | jq -r '.data.message // .message // empty')
    local success=$(echo "$response" | jq -r '.success')

    # Determine actual result based on response
    local actual=""

    if [[ "$permission_denied" == "true" ]] || [[ "$status" == "PERMISSION_DENIED" ]] || [[ "$message" == *"权限"* && "$message" == *"拒绝"* ]] || [[ "$message" == *"无权"* ]]; then
        actual="PERMISSION_DENIED"
    elif [[ "$requires_approval" == "true" ]] || [[ "$status" == "APPROVAL_REQUIRED" ]] || [[ "$message" == *"审批"* ]]; then
        actual="APPROVAL_REQUIRED"
    elif [[ "$requires_confirmation" == "true" ]] || [[ "$status" == "CONFIRMATION_REQUIRED" ]] || [[ "$message" == *"确认"* ]]; then
        actual="CONFIRMATION_REQUIRED"
    elif [[ "$status" == "REJECTED" ]] || [[ "$message" == *"拒绝"* && "$message" != *"权限"* ]]; then
        actual="REJECTED"
    else
        actual="$status"
    fi

    echo "$actual"
}

# Print header
echo "========================================================"
echo "  Permission Control Tests - v10.0 Intent Recognition"
echo "========================================================"
echo ""
echo "Login URL: $LOGIN_URL"
echo "Execute URL: $EXECUTE_URL"
echo ""

# Test cases array
declare -a TEST_CASES=(
    "P001|quality_insp1|123456|帮我删除这条质检记录|PERMISSION_DENIED|角色权限拒绝 - 质检员无权删除记录"
    "P002|worker1|123456|修改一下今天的排产计划|PERMISSION_DENIED|角色权限拒绝 - 工人无权修改排产"
    "P003|warehouse_mgr1|123456|帮我创建一个新用户账号|PERMISSION_DENIED|角色权限拒绝 - 仓储主管无权创建用户"
    "P004|dispatcher1|123456|删除这个供应商的所有数据|PERMISSION_DENIED|角色权限拒绝 - CRITICAL操作需要超级管理员"
    "P005|hr_admin1|123456|查看生产线的实时数据|PERMISSION_DENIED|角色权限拒绝 - HR无权访问生产数据"
    "P006|quality_insp1|123456|批准这批货的降级使用|PERMISSION_DENIED|角色权限拒绝 - 质检员只能评估不能批准"
    "P007|worker1|123456|导出全厂员工的工资明细|PERMISSION_DENIED|角色权限拒绝 - 敏感数据需要HR或财务权限"
    "P008|dispatcher1|123456|修改系统参数配置|PERMISSION_DENIED|角色权限拒绝 - SYSTEM操作需要超级管理员"
    "P009|warehouse_mgr1|123456|强制通过这批不合格品|PERMISSION_DENIED|角色权限拒绝 - 质量处置需要质检权限"
    "P010|hr_admin1|123456|调整产品定价|PERMISSION_DENIED|角色权限拒绝 - 定价需要销售或财务权限"
    "P011|quality_insp1|123456|取消已发出的发货单|PERMISSION_DENIED|角色权限拒绝 - 需要物流或销售主管权限"
    "P012|worker1|123456|查看其他员工的绩效考核详情|PERMISSION_DENIED|角色权限拒绝 - 只能查看自己的绩效"
    "P013|dispatcher1|123456|删除设备维护记录|PERMISSION_DENIED|角色权限拒绝 - 维护记录归档后不可删除"
    "P014|warehouse_mgr1|123456|修改已入账的财务数据|PERMISSION_DENIED|角色权限拒绝 - 财务数据锁定需要财务主管权限"
    "P015|hr_admin1|123456|访问客户的联系方式和订单历史|PERMISSION_DENIED|角色权限拒绝 - CRM数据需要销售权限"
    "P016|factory_admin1|123456|批量更新500条原料记录的状态|APPROVAL_REQUIRED|敏感度触发审批 - 批量操作风险提示"
    "P017|factory_admin1|123456|删除三个月前的所有考勤异常记录|APPROVAL_REQUIRED|敏感度触发审批 - 数据删除需要超级管理员审批"
    "P018|factory_admin1|123456|修改全厂的安全库存阈值|APPROVAL_REQUIRED|敏感度触发审批 - 全局参数修改需要审批"
    "P019|factory_admin1|123456|强制将这批不合格品改为合格|APPROVAL_REQUIRED|敏感度触发审批 - 质量数据篡改风险最高"
    "P020|factory_admin1|123456|重置供应商评分系统|APPROVAL_REQUIRED|敏感度触发审批 - 系统重置操作"
    "P021|factory_admin1|123456|批量调整上个月所有员工的工资|APPROVAL_REQUIRED|敏感度触发审批 - 薪资批量修改"
    "P022|factory_admin1|123456|导出全部客户数据到Excel|APPROVAL_REQUIRED|敏感度触发审批 - 敏感数据导出"
    "P023|factory_admin1|123456|修改质检标准参数|APPROVAL_REQUIRED|敏感度触发审批 - 质量标准变更"
    "P024|factory_admin1|123456|取消进行中的生产订单|APPROVAL_REQUIRED|敏感度触发审批 - 订单取消"
    "P025|factory_admin1|123456|批量作废本月的质检报告|APPROVAL_REQUIRED|敏感度触发审批 - 质检数据批量作废"
    "P026|factory_admin1|123456|修改已完成发货单的数量|APPROVAL_REQUIRED|敏感度触发审批 - 已完成单据修改"
    "P027|factory_admin1|123456|删除设备的校准历史记录|APPROVAL_REQUIRED|敏感度触发审批 - 合规数据删除"
    "P028|factory_admin1|123456|批量创建200个新的原料批次|CONFIRMATION_REQUIRED|敏感度触发确认 - 批量创建需要用户二次确认"
    "P029|factory_admin1|123456|修改核心BOM配方数据|APPROVAL_REQUIRED|敏感度触发审批 - 配方修改"
    "P030|factory_admin1|123456|清空测试环境的所有数据|REJECTED|敏感度拒绝 - 生产环境不允许此操作"
)

# Output file
OUTPUT_FILE="permission-test-results-$(date +%Y%m%d-%H%M%S).json"
echo "[" > "$OUTPUT_FILE"
FIRST_RESULT=true

# Run tests
for test_case in "${TEST_CASES[@]}"; do
    IFS='|' read -r id username password input expected description <<< "$test_case"

    echo "--------------------------------------------------------"
    echo -e "Test: ${YELLOW}$id${NC}"
    echo "User: $username (Role: $description)"
    echo "Input: \"$input\""
    echo "Expected: $expected"

    # Login
    token=$(login "$username" "$password")

    if [[ -z "$token" ]]; then
        echo -e "Result: ${YELLOW}SKIPPED${NC} - Login failed for $username"
        ((SKIPPED++))

        if [[ "$FIRST_RESULT" == "false" ]]; then
            echo "," >> "$OUTPUT_FILE"
        fi
        FIRST_RESULT=false

        echo "{\"id\": \"$id\", \"username\": \"$username\", \"input\": \"$input\", \"expected\": \"$expected\", \"actual\": \"LOGIN_FAILED\", \"passed\": false, \"skipped\": true}" >> "$OUTPUT_FILE"
        continue
    fi

    # Execute intent
    response=$(execute_intent "$token" "$input")

    # Parse response for actual result
    actual=$(check_result "$response" "$expected" "$id")

    # Compare results
    if [[ "$actual" == "$expected" ]]; then
        echo -e "Actual: ${GREEN}$actual${NC}"
        echo -e "Status: ${GREEN}PASSED${NC}"
        ((PASSED++))
        passed=true
    else
        echo -e "Actual: ${RED}$actual${NC}"
        echo -e "Status: ${RED}FAILED${NC}"
        echo "Response: $response"
        ((FAILED++))
        passed=false
    fi

    # Write to JSON output
    if [[ "$FIRST_RESULT" == "false" ]]; then
        echo "," >> "$OUTPUT_FILE"
    fi
    FIRST_RESULT=false

    # Escape special characters in response for JSON
    escaped_response=$(echo "$response" | jq -c '.' 2>/dev/null || echo "{}")

    echo "{\"id\": \"$id\", \"username\": \"$username\", \"input\": \"$input\", \"expected\": \"$expected\", \"actual\": \"$actual\", \"passed\": $passed, \"response\": $escaped_response}" >> "$OUTPUT_FILE"

    echo ""
done

echo "]" >> "$OUTPUT_FILE"

# Print summary
echo "========================================================"
echo "                    TEST SUMMARY"
echo "========================================================"
echo -e "Total: $((PASSED + FAILED + SKIPPED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Skipped: $SKIPPED${NC}"
echo ""
echo "Results saved to: $OUTPUT_FILE"
echo "========================================================"

# Exit with appropriate code
if [[ $FAILED -gt 0 ]]; then
    exit 1
else
    exit 0
fi
