#!/bin/bash
# 语义相近测试 - 测试 ArenaRL 和短语匹配

BASE_URL="http://139.196.165.140:10010"
FACTORY_ID="F001"

# 获取 Token
TOKEN=$(curl -s -X POST "${BASE_URL}/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username": "factory_admin1", "password": "123456"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "获取 Token 失败"
  exit 1
fi

echo "Token 获取成功"
echo ""

# 测试用例 (格式: "查询|期望意图|说明")
declare -a TEST_CASES=(
  "原材料批次MB001|MATERIAL_BATCH_QUERY|应通过短语匹配'原材料'加分"
  "查询原料批次|MATERIAL_BATCH_QUERY|明确的查询+原料短语"
  "批次详情|PROCESSING_BATCH_LIST|歧义查询-无明确领域"
  "溯源批次PB001|TRACE_BATCH|应匹配溯源短语"
  "批次追溯|TRACE_BATCH|应匹配追溯短语"
  "生产批次列表|PROCESSING_BATCH_LIST|明确的生产批次查询"
)

echo "| 查询 | 期望 | 实际 | 匹配 | 延迟 | 说明 |"
echo "|------|------|------|------|------|------|"

for test_case in "${TEST_CASES[@]}"; do
  IFS='|' read -r query expected note <<< "$test_case"
  
  START=$(python3 -c "import time; print(int(time.time()*1000))")
  
  RESPONSE=$(curl -s -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/ai-intents/execute" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"userInput\": \"$query\", \"previewOnly\": true}" 2>&1)
  
  END=$(python3 -c "import time; print(int(time.time()*1000))")
  LATENCY=$((END - START))
  
  actual=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('intentCode','ERROR'))" 2>/dev/null || echo "ERROR")
  confidence=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f\"{d.get('data',{}).get('confidence',0):.3f}\")" 2>/dev/null || echo "0")
  method=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('matchMethod','UNKNOWN'))" 2>/dev/null || echo "UNKNOWN")
  
  if [ "$actual" == "$expected" ]; then
    match="✅"
  else
    match="❌"
  fi
  
  echo "| $query | $expected | $actual ($confidence, $method) | $match | ${LATENCY}ms | $note |"
  
  sleep 0.3
done
