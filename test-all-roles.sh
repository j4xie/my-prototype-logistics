#!/bin/bash
# Test all role logins and their key API endpoints
BASE="http://47.100.235.168:10010"
PASS="123456"

USERS=(
  "factory_admin1:factory_super_admin"
  "dispatcher1:dispatcher"
  "hr_admin1:hr_admin"
  "operator1:operator"
  "workshop_sup1:workshop_supervisor"
  "warehouse_mgr1:warehouse_manager"
  "quality_insp1:quality_inspector"
  "quality_mgr1:quality_manager"
  "sales_mgr1:sales_manager"
  "procurement_mgr1:procurement_manager"
  "finance_mgr1:finance_manager"
  "production_mgr1:production_manager"
)

# Role-specific dashboard APIs
declare -A ROLE_APIS
ROLE_APIS[factory_super_admin]="/reports/dashboard/overview"
ROLE_APIS[dispatcher]="/scheduling/dashboard"
ROLE_APIS[hr_admin]="/hr/dashboard"
ROLE_APIS[operator]="/processing/batches?page=0&size=5"
ROLE_APIS[workshop_supervisor]="/processing/batches?page=0&size=5"
ROLE_APIS[warehouse_manager]="/materials?page=0&size=5"
ROLE_APIS[quality_inspector]="/quality/inspections?page=0&size=5"
ROLE_APIS[quality_manager]="/quality/inspections?page=0&size=5"
ROLE_APIS[sales_manager]="/sales/orders?page=0&size=5"
ROLE_APIS[procurement_manager]="/purchase-orders?page=0&size=5"
ROLE_APIS[finance_manager]="/finance/invoices?page=0&size=5"
ROLE_APIS[production_manager]="/processing/batches?page=0&size=5"

echo "=== 全角色登录 + 首页API测试 ==="
echo ""

FAIL_COUNT=0
PASS_COUNT=0

for entry in "${USERS[@]}"; do
  IFS=':' read -r user role <<< "$entry"

  # Login
  LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/mobile/auth/unified-login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$user\",\"password\":\"$PASS\"}" 2>&1)

  HTTP_CODE=$(echo "$LOGIN_RESP" | tail -1)
  BODY=$(echo "$LOGIN_RESP" | head -1)

  if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ [$role] $user — 登录失败 (HTTP $HTTP_CODE)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    continue
  fi

  # Extract token
  TOKEN=$(echo "$BODY" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
  FACTORY_ID=$(echo "$BODY" | grep -o '"factoryId":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -z "$TOKEN" ]; then
    echo "❌ [$role] $user — 登录成功但无token"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    continue
  fi

  echo -n "✅ [$role] $user — 登录成功"

  # Test role-specific API
  API_PATH="${ROLE_APIS[$role]}"
  if [ -n "$API_PATH" ] && [ -n "$FACTORY_ID" ]; then
    API_URL="$BASE/api/mobile/$FACTORY_ID$API_PATH"
    API_RESP=$(curl -s -w "\n%{http_code}" "$API_URL" \
      -H "Authorization: Bearer $TOKEN" 2>&1)
    API_CODE=$(echo "$API_RESP" | tail -1)
    API_BODY=$(echo "$API_RESP" | head -1)

    SUCCESS=$(echo "$API_BODY" | grep -o '"success":true' | head -1)

    if [ "$API_CODE" = "200" ] && [ -n "$SUCCESS" ]; then
      echo " | API ✅ $API_PATH"
      PASS_COUNT=$((PASS_COUNT + 1))
    else
      ERR_MSG=$(echo "$API_BODY" | grep -o '"message":"[^"]*"' | head -1 | cut -d'"' -f4)
      echo " | API ❌ $API_PATH → HTTP $API_CODE: $ERR_MSG"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  else
    echo ""
    PASS_COUNT=$((PASS_COUNT + 1))
  fi
done

echo ""
echo "=== 总结: ✅ $PASS_COUNT 通过, ❌ $FAIL_COUNT 失败 ==="
