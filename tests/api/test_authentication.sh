#!/bin/bash

# Phase 1 End-to-End Testing - Authentication Flow
# Test all 8 roles, token refresh, permission isolation
# Generated: 2025-11-20

set -e

BASE_URL="http://localhost:10010"
API_URL="${BASE_URL}/api/mobile"
REPORT_FILE="test-reports/phase1-authentication-report.md"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test results array
declare -a TEST_RESULTS

# Function to print test result
print_result() {
  local test_name="$1"
  local result="$2"
  local details="$3"

  TOTAL_TESTS=$((TOTAL_TESTS + 1))

  if [ "$result" == "PASS" ]; then
    echo -e "${GREEN}✓${NC} ${test_name}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    TEST_RESULTS+=("✅ **${test_name}**: PASS")
  else
    echo -e "${RED}✗${NC} ${test_name}"
    echo -e "  ${RED}${details}${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    TEST_RESULTS+=("❌ **${test_name}**: FAIL - ${details}")
  fi

  if [ -n "$details" ] && [ "$result" == "PASS" ]; then
    TEST_RESULTS+=("  - ${details}")
  fi
}

# Function to extract JSON field
extract_json() {
  local json="$1"
  local field="$2"
  echo "$json" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('$field', ''))" 2>/dev/null || echo ""
}

echo "=========================================="
echo "Phase 1 Authentication Flow Testing"
echo "=========================================="
echo "Backend: ${BASE_URL}"
echo "Start Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ================================================
# Test 1: Backend Health Check
# ================================================
echo "Test 1: Backend Health Check"
HEALTH_RESPONSE=$(curl -s "${API_URL}/health" || echo '{"error":"Connection failed"}')
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', 'error'))" 2>/dev/null || echo "error")

if [ "$HEALTH_STATUS" == "UP" ]; then
  print_result "Backend Health Check" "PASS" "Status: UP, Port: 10010"
else
  print_result "Backend Health Check" "FAIL" "Backend not responding or unhealthy"
  exit 1
fi

echo ""

# ================================================
# Test 2-9: Login with 8 Roles
# ================================================
echo "Test 2-9: Authentication for 8 Roles"

declare -A TEST_USERS=(
  ["developer"]="test-developer"
  ["platform_admin"]="test-platform-admin"
  ["factory_super_admin"]="test-super-admin-a"
  ["factory_admin"]="test-admin-a"
  ["department_admin"]="test-dept-admin-a"
  ["quality_inspector"]="test-inspector-a"
  ["supervisor"]="test-supervisor-a"
  ["operator"]="test-operator-a"
)

declare -A ACCESS_TOKENS
declare -A REFRESH_TOKENS

for role in developer platform_admin factory_super_admin factory_admin department_admin quality_inspector supervisor operator; do
  username="${TEST_USERS[$role]}"

  LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/unified-login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${username}\",\"password\":\"Test@123456\"}" || echo '{"error":"Request failed"}')

  SUCCESS=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "False")

  if [ "$SUCCESS" == "True" ]; then
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
    REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['refreshToken'])" 2>/dev/null)
    USER_ROLE=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['user']['role'])" 2>/dev/null)

    ACCESS_TOKENS[$role]="$ACCESS_TOKEN"
    REFRESH_TOKENS[$role]="$REFRESH_TOKEN"

    if [ "$USER_ROLE" == "$role" ]; then
      print_result "Login as ${role}" "PASS" "Username: ${username}, Role: ${USER_ROLE}"
    else
      print_result "Login as ${role}" "FAIL" "Expected role: ${role}, Got: ${USER_ROLE}"
    fi
  else
    ERROR_MSG=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('message', 'Unknown error'))" 2>/dev/null)
    print_result "Login as ${role}" "FAIL" "Login failed: ${ERROR_MSG}"
  fi
done

echo ""

# ================================================
# Test 10: Token Refresh
# ================================================
echo "Test 10: Token Refresh"

if [ -n "${REFRESH_TOKENS[factory_admin]}" ]; then
  REFRESH_RESPONSE=$(curl -s -X POST "${API_URL}/auth/refresh-token" \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\":\"${REFRESH_TOKENS[factory_admin]}\"}" || echo '{"error":"Request failed"}')

  SUCCESS=$(echo "$REFRESH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "False")

  if [ "$SUCCESS" == "True" ]; then
    NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
    if [ -n "$NEW_ACCESS_TOKEN" ] && [ "$NEW_ACCESS_TOKEN" != "${ACCESS_TOKENS[factory_admin]}" ]; then
      print_result "Token Refresh" "PASS" "New access token issued successfully"
      ACCESS_TOKENS[factory_admin]="$NEW_ACCESS_TOKEN"
    else
      print_result "Token Refresh" "FAIL" "New token same as old token or empty"
    fi
  else
    ERROR_MSG=$(echo "$REFRESH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('message', 'Unknown error'))" 2>/dev/null)
    print_result "Token Refresh" "FAIL" "Refresh failed: ${ERROR_MSG}"
  fi
else
  print_result "Token Refresh" "FAIL" "No refresh token available from factory_admin login"
fi

echo ""

# ================================================
# Test 11-12: Permission Isolation
# ================================================
echo "Test 11-12: Cross-Factory Permission Isolation"

# Test 11: Factory Admin A tries to access Factory A dashboard (should succeed)
if [ -n "${ACCESS_TOKENS[factory_admin]}" ]; then
  DASHBOARD_RESPONSE=$(curl -s -X GET "${API_URL}/dashboard/test-factory-001" \
    -H "Authorization: Bearer ${ACCESS_TOKENS[factory_admin]}" || echo '{"error":"Request failed"}')

  SUCCESS=$(echo "$DASHBOARD_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "False")

  if [ "$SUCCESS" == "True" ]; then
    print_result "Access Own Factory Dashboard (Factory Admin A → Factory A)" "PASS" "Authorized access granted"
  else
    ERROR_MSG=$(echo "$DASHBOARD_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('message', 'Unknown error'))" 2>/dev/null)
    print_result "Access Own Factory Dashboard (Factory Admin A → Factory A)" "FAIL" "Access denied: ${ERROR_MSG}"
  fi
else
  print_result "Access Own Factory Dashboard (Factory Admin A → Factory A)" "FAIL" "No access token available"
fi

# Test 12: Factory Admin A tries to access Factory B dashboard (should fail)
if [ -n "${ACCESS_TOKENS[factory_admin]}" ]; then
  CROSS_RESPONSE=$(curl -s -X GET "${API_URL}/dashboard/test-factory-002" \
    -H "Authorization: Bearer ${ACCESS_TOKENS[factory_admin]}" || echo '{"error":"Request failed"}')

  SUCCESS=$(echo "$CROSS_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "False")

  if [ "$SUCCESS" == "False" ]; then
    ERROR_MSG=$(echo "$CROSS_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('message', 'Unknown error'))" 2>/dev/null)
    if [[ "$ERROR_MSG" == *"权限"* ]] || [[ "$ERROR_MSG" == *"permission"* ]] || [[ "$ERROR_MSG" == *"Forbidden"* ]]; then
      print_result "Cross-Factory Access Prevention (Factory Admin A → Factory B)" "PASS" "Access correctly denied: ${ERROR_MSG}"
    else
      print_result "Cross-Factory Access Prevention (Factory Admin A → Factory B)" "FAIL" "Unexpected error: ${ERROR_MSG}"
    fi
  else
    print_result "Cross-Factory Access Prevention (Factory Admin A → Factory B)" "FAIL" "Cross-factory access should be denied but was allowed"
  fi
else
  print_result "Cross-Factory Access Prevention (Factory Admin A → Factory B)" "FAIL" "No access token available"
fi

echo ""

# ================================================
# Test 13: Invalid Credentials
# ================================================
echo "Test 13: Invalid Credentials Handling"

INVALID_RESPONSE=$(curl -s -X POST "${API_URL}/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"test-admin-a","password":"WrongPassword123"}' || echo '{"error":"Request failed"}')

SUCCESS=$(echo "$INVALID_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "False")

if [ "$SUCCESS" == "False" ]; then
  ERROR_MSG=$(echo "$INVALID_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('message', 'Unknown error'))" 2>/dev/null)
  print_result "Invalid Credentials Rejection" "PASS" "Login correctly rejected: ${ERROR_MSG}"
else
  print_result "Invalid Credentials Rejection" "FAIL" "Invalid credentials should be rejected but were accepted"
fi

echo ""

# ================================================
# Test 14: Token Expiration (Simulated)
# ================================================
echo "Test 14: Expired Token Handling"

EXPIRED_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"

EXPIRED_RESPONSE=$(curl -s -X GET "${API_URL}/dashboard/test-factory-001" \
  -H "Authorization: Bearer ${EXPIRED_TOKEN}" || echo '{"error":"Request failed"}')

SUCCESS=$(echo "$EXPIRED_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "False")

if [ "$SUCCESS" == "False" ]; then
  ERROR_MSG=$(echo "$EXPIRED_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('message', 'Unknown error'))" 2>/dev/null)
  if [[ "$ERROR_MSG" == *"token"* ]] || [[ "$ERROR_MSG" == *"Unauthorized"* ]] || [[ "$ERROR_MSG" == *"认证"* ]]; then
    print_result "Expired Token Rejection" "PASS" "Invalid token correctly rejected: ${ERROR_MSG}"
  else
    print_result "Expired Token Rejection" "FAIL" "Unexpected error: ${ERROR_MSG}"
  fi
else
  print_result "Expired Token Rejection" "FAIL" "Expired token should be rejected but was accepted"
fi

echo ""

# ================================================
# Summary
# ================================================
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Total Tests:  ${TOTAL_TESTS}"
echo -e "Passed:       ${GREEN}${PASSED_TESTS}${NC}"
echo -e "Failed:       ${RED}${FAILED_TESTS}${NC}"
echo -e "Pass Rate:    $(awk "BEGIN {printf \"%.1f\", (${PASSED_TESTS}/${TOTAL_TESTS})*100}")%"
echo "End Time:     $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ================================================
# Generate Markdown Report
# ================================================
mkdir -p test-reports

cat > "$REPORT_FILE" << EOF
# Phase 1 Authentication Flow Test Report

**Generated**: $(date '+%Y-%m-%d %H:%M:%S')
**Backend**: ${BASE_URL}
**Test Script**: \`tests/api/test_authentication.sh\`

---

## Test Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${TOTAL_TESTS} |
| Passed | ${PASSED_TESTS} ✅ |
| Failed | ${FAILED_TESTS} ❌ |
| Pass Rate | $(awk "BEGIN {printf \"%.1f\", (${PASSED_TESTS}/${TOTAL_TESTS})*100}")% |

---

## Test Results

EOF

for result in "${TEST_RESULTS[@]}"; do
  echo "$result" >> "$REPORT_FILE"
done

cat >> "$REPORT_FILE" << EOF

---

## Test Details

### Test Categories

1. **Backend Health Check** (1 test)
   - Verify backend service is running on port 10010
   - Check API health endpoint responds correctly

2. **8-Role Authentication** (8 tests)
   - Developer login
   - Platform Admin login
   - Factory Super Admin login
   - Factory Admin login
   - Department Admin login
   - Quality Inspector login
   - Supervisor login
   - Operator login

3. **Token Management** (1 test)
   - Token refresh functionality
   - New access token generation

4. **Permission Isolation** (2 tests)
   - Same-factory access (should succeed)
   - Cross-factory access (should fail)

5. **Security** (2 tests)
   - Invalid credentials rejection
   - Expired/invalid token rejection

---

## Next Steps

EOF

if [ $FAILED_TESTS -eq 0 ]; then
  cat >> "$REPORT_FILE" << EOF
✅ **All authentication tests passed!**

Continue to Phase 1.2: Main Navigation and Home Screen Testing

\`\`\`bash
bash tests/api/test_navigation.sh
\`\`\`
EOF
else
  cat >> "$REPORT_FILE" << EOF
❌ **${FAILED_TESTS} test(s) failed**

**Action Required**: Fix authentication issues before proceeding to navigation tests.

Review failed tests above and:
1. Check backend logs: \`tail -100 backend-java/logs/application.log\`
2. Verify test data loaded: \`mysql -u root cretas_db < tests/test-data/phase1_test_data.sql\`
3. Check user credentials match expected values
4. Verify JWT token configuration
EOF
fi

cat >> "$REPORT_FILE" << EOF

---

## Test Data Used

- **Test Factories**: test-factory-001, test-factory-002
- **Test Users**: 8 roles (test-developer, test-platform-admin, ..., test-operator-a)
- **Password**: Test@123456 (all test users)
- **Department**: Test Department (ID: 9001) in Factory A

---

**Report End**
EOF

echo "Report generated: ${REPORT_FILE}"

# Exit with appropriate code
if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed. See report for details.${NC}"
  exit 1
fi
