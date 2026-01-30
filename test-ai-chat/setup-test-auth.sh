#!/bin/bash
# Setup test authentication token in Redis on the production server
# This creates a third-session token that the test runner can use

set -e

SERVER="139.196.165.140"
APP_ID="wxf8e90943620b4080"
TEST_TOKEN="test-ai-chat-quality-$(date +%s)"

echo "Setting up test auth token on server..."

# First, check if there's an existing wx_user we can use, or create one
# Then create a Redis third-session entry
ssh root@$SERVER << 'REMOTE_SCRIPT'
# Check existing wx users
echo "=== Checking existing wx_user records ==="

# Try PostgreSQL first (based on migration status)
PGPASSWORD="Cretas2024!" psql -h localhost -U cretas -d mall_center -c "SELECT id, openid, nick_name, phone FROM wx_user LIMIT 5;" 2>/dev/null || \
mysql -u root mall_center -e "SELECT id, openid, nick_name, phone FROM wx_user LIMIT 5;" 2>/dev/null || \
echo "Could not query database"

REMOTE_SCRIPT

echo ""
echo "Now creating Redis session token..."

# Create the Redis entry with a test user
ssh root@$SERVER << REMOTE_REDIS
# Find an existing user ID first
WX_USER_ID=\$(PGPASSWORD="Cretas2024!" psql -h localhost -U cretas -d mall_center -t -c "SELECT id FROM wx_user LIMIT 1;" 2>/dev/null | tr -d ' ' || echo "")

if [ -z "\$WX_USER_ID" ]; then
  # Try MySQL
  WX_USER_ID=\$(mysql -u root mall_center -sN -e "SELECT id FROM wx_user LIMIT 1;" 2>/dev/null || echo "")
fi

if [ -z "\$WX_USER_ID" ]; then
  echo "ERROR: No wx_user found in database. Creating test user..."
  PGPASSWORD="Cretas2024!" psql -h localhost -U cretas -d mall_center -c "
    INSERT INTO wx_user (openid, nick_name, phone, create_time, update_time)
    VALUES ('test_openid_ai_quality', 'AI测试用户', '13800000000', NOW(), NOW())
    ON CONFLICT (openid) DO NOTHING
    RETURNING id;
  " 2>/dev/null || echo "Failed to create test user"
  WX_USER_ID=\$(PGPASSWORD="Cretas2024!" psql -h localhost -U cretas -d mall_center -t -c "SELECT id FROM wx_user WHERE openid='test_openid_ai_quality';" 2>/dev/null | tr -d ' ')
fi

echo "Using wxUserId: \$WX_USER_ID"

# Create Redis third-session token (6 hour TTL = 21600 seconds)
TOKEN="$TEST_TOKEN"
SESSION_DATA='{"wxUserId":"'\$WX_USER_ID'","appId":"$APP_ID","sessionKey":"test_session_key","openId":"test_openid_ai_quality"}'

redis-cli SET "wx:ma:3rd_session:\$TOKEN" "\$SESSION_DATA" EX 21600

echo "=== Auth Token Created ==="
echo "Token: \$TOKEN"
echo "TTL: 6 hours"
echo "Data: \$SESSION_DATA"
REMOTE_REDIS

echo ""
echo "=== Save this to .auth-cache.json ==="
echo "{\"appId\": \"$APP_ID\", \"thirdSession\": \"$TEST_TOKEN\", \"timestamp\": $(date +%s)000}"
