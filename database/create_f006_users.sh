#!/bin/bash
# =============================================
# Create F006 (六膳门) user accounts
# Run this script ON the server (47.100.235.168)
# =============================================

set -e

echo "=== Creating F006 users via REST API ==="

# Step 1: Login as platform_admin to get JWT token
echo "[1/4] Logging in as platform_admin..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username": "platform_admin", "password": "123456"}')

# Extract token from response
TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data.get('success'):
    print(data['data']['accessToken'])
else:
    print('LOGIN_FAILED', file=sys.stderr)
    sys.exit(1)
" 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "" ]; then
  echo "ERROR: Login failed. Response: $LOGIN_RESPONSE"
  exit 1
fi
echo "  Token obtained successfully."

# Step 2: Create factory admin for F006
echo "[2/4] Creating f006_admin (工厂管理员)..."
RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F006/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "username": "f006_admin",
    "password": "123456",
    "email": "f006_admin@cretas.com",
    "phone": "16651196431",
    "fullName": "六膳门管理员",
    "roleCode": "factory_super_admin",
    "department": "管理部",
    "position": "工厂管理员"
  }')
echo "  Result: $RESULT"

# Step 3: Create workshop supervisor for F006
echo "[3/4] Creating f006_workshop_sup (车间主管)..."
RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F006/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "username": "f006_workshop_sup",
    "password": "123456",
    "email": "f006_workshop@cretas.com",
    "fullName": "六膳门车间主管",
    "roleCode": "workshop_supervisor",
    "department": "生产车间",
    "position": "车间主管"
  }')
echo "  Result: $RESULT"

# Step 4: Create operator for F006
echo "[4/4] Creating f006_worker1 (操作员)..."
RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F006/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "username": "f006_worker1",
    "password": "123456",
    "email": "f006_worker1@cretas.com",
    "fullName": "六膳门操作员1",
    "roleCode": "operator",
    "department": "生产车间",
    "position": "操作员"
  }')
echo "  Result: $RESULT"

echo ""
echo "=== Done. Verify by logging in as f006_admin / 123456 ==="
