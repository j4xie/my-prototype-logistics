#!/bin/bash
# Thinking mode optimization test
# Tests simple vs complex queries on test environment (port 10011)

BASE_URL="http://47.100.235.168:10011"

# Login
TOKEN=$(curl -s -X POST "$BASE_URL/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin1","password":"123456"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

if [ -z "$TOKEN" ]; then
  echo "Login failed!"
  exit 1
fi
echo "Login OK (token length: ${#TOKEN})"
echo ""

# Function to test a query
test_query() {
  local label="$1"
  local json_file="$2"

  echo "=== $label ==="
  cat "$json_file" | python3 -c "import sys,json; d=json.load(sys.stdin); msgs=d['messages']; print('Query:', [m['content'] for m in msgs if m['role']=='user'][-1][:80])"

  START_MS=$(python3 -c "import time; print(int(time.time()*1000))")

  RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/mobile/ai/chat" \
    -H "Content-Type: application/json; charset=utf-8" \
    -H "Authorization: Bearer $TOKEN" \
    --data-binary "@$json_file")

  END_MS=$(python3 -c "import time; print(int(time.time()*1000))")
  ELAPSED=$(( (END_MS - START_MS) ))

  HTTP_CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | head -n -1)

  echo "HTTP: $HTTP_CODE | Time: ${ELAPSED}ms"
  echo "$BODY" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    if d.get('success'):
        content=d['data']['content']
        tokens=d['data'].get('tokensUsed','?')
        model=d['data'].get('model','?')
        print(f'Model: {model} | Tokens: {tokens}')
        print(f'Response: {content[:200]}')
    else:
        print(f'ERROR: {d.get(\"message\",str(d))}')
except Exception as e:
    print(f'Parse error: {e}')
" 2>&1
  echo ""
}

# Create test JSON files with proper UTF-8
python3 -c "
import json

tests = [
    ('test_simple1.json', {
        'messages': [{'role': 'user', 'content': 'hello'}],
        'temperature': 0.7, 'maxTokens': 500
    }),
    ('test_simple2.json', {
        'messages': [{'role': 'user', 'content': 'what is 2+2'}],
        'temperature': 0.7, 'maxTokens': 500
    }),
    ('test_simple3.json', {
        'messages': [
            {'role': 'system', 'content': 'You are a helpful assistant for a food factory.'},
            {'role': 'user', 'content': 'Show me today production count'}
        ],
        'temperature': 0.7, 'maxTokens': 500
    }),
    ('test_complex1.json', {
        'messages': [
            {'role': 'system', 'content': 'You are a business analyst for a food traceability company.'},
            {'role': 'user', 'content': 'Please analyze the production efficiency trends over the past quarter and suggest optimization strategies for reducing waste while maintaining quality standards across all production lines'}
        ],
        'temperature': 0.7, 'maxTokens': 2000
    }),
    ('test_complex2.json', {
        'messages': [
            {'role': 'system', 'content': 'You are a business analyst.'},
            {'role': 'user', 'content': 'Compare and analyze our warehouse inventory turnover rate versus industry benchmarks, identify the root causes for slow-moving items, and provide a detailed optimization plan with predicted cost savings'}
        ],
        'temperature': 0.7, 'maxTokens': 2000
    }),
]

for fname, data in tests:
    with open(f'/tmp/{fname}', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
    print(f'Created /tmp/{fname}')
"

echo "========================================="
echo "  Thinking Mode Optimization Test"
echo "  Test Environment: $BASE_URL"
echo "========================================="
echo ""

echo "--- SIMPLE QUERIES (thinking should be OFF = faster) ---"
echo ""
test_query "Test 1: Greeting (short, <15 chars)" "/tmp/test_simple1.json"
test_query "Test 2: Math question (short)" "/tmp/test_simple2.json"
test_query "Test 3: Factory query (medium, no complex keywords)" "/tmp/test_simple3.json"

echo "--- COMPLEX QUERIES (thinking should be ON = slower but deeper) ---"
echo ""
test_query "Test 4: Production analysis (long + complex keywords)" "/tmp/test_complex1.json"
test_query "Test 5: Warehouse analysis (long + multiple complex keywords)" "/tmp/test_complex2.json"

echo "========================================="
echo "  Test Complete"
echo "========================================="
