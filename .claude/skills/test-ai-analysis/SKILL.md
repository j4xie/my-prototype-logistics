---
name: test-ai-analysis
description: AI分析模块自动化测试。测试成本分析、配额管理、缓存机制、对话历史。使用此Skill验证AI分析系统的完整性。
allowed-tools:
  - Bash
  - Read
  - Grep
---

# AI分析测试 Skill

测试 Cretas 食品溯源系统的AI智能分析模块。

## 测试环境

- **服务地址**: localhost:10010 (Java后端) / localhost:8085 (Python AI服务)
- **测试工厂**: F001
- **AI服务**: 阿里云通义千问 (DashScope API)

## 执行测试

运行以下命令执行完整的AI分析测试：

```bash
echo "========================================"
echo "AI分析模块 - 自动化测试报告"
echo "环境: localhost:10010"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
echo ""

# 初始化计数器
PASS=0
FAIL=0

# 获取Token
echo "[前置] 获取测试Token..."
LOGIN_RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin1","password":"123456"}')
TOKEN=$(echo "$LOGIN_RESULT" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ 获取Token失败，测试终止"
  exit 1
fi
echo "✓ Token获取成功"
echo ""

# ========== 测试0: Python AI服务健康检查 ==========
echo "[测试0] Python AI服务健康检查"
echo "  请求: GET http://localhost:8085/"

AI_RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" "http://localhost:8085/")
AI_HTTP_CODE=$(echo "$AI_RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$AI_HTTP_CODE" = "200" ]; then
  AI_VERSION=$(echo "$AI_RESULT" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
  AI_CONFIGURED=$(echo "$AI_RESULT" | grep -o '"api_configured":[a-z]*' | cut -d':' -f2)
  echo "  期望: HTTP 200, AI服务运行中"
  echo "  实际: HTTP 200, version=$AI_VERSION, api_configured=$AI_CONFIGURED ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
  AI_SERVICE_UP=true
else
  echo "  期望: HTTP 200"
  echo "  实际: HTTP $AI_HTTP_CODE (Python AI服务可能未启动)"
  echo "  结果: ⚠️ SKIP (AI服务不可用，跳过AI相关测试)"
  AI_SERVICE_UP=false
fi
echo ""

# ========== 测试1: 获取AI配额状态 ==========
echo "[测试1] 获取AI配额状态"
echo "  请求: GET /api/mobile/F001/ai/quota"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/ai/quota" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  REMAINING=$(echo "$RESULT" | grep -o '"remaining":[0-9]*' | cut -d':' -f2)
  echo "  期望: HTTP 200, 返回配额信息"
  echo "  实际: HTTP 200, 剩余配额=$REMAINING ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: HTTP 200"
  echo "  实际: HTTP $HTTP_CODE"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试2: 获取批次成本数据 ==========
echo "[测试2] 获取批次成本数据"
echo "  请求: GET /api/mobile/F001/processing/batches/1/cost-analysis"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/processing/batches/1/cost-analysis" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回成本数据"
  echo "  实际: HTTP 200 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: HTTP 200"
  echo "  实际: HTTP $HTTP_CODE"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试3: AI批次成本分析 ==========
echo "[测试3] AI批次成本分析"
echo "  请求: POST /api/mobile/F001/ai/analysis/cost/batch"

RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/ai/analysis/cost/batch" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"batchId": 1, "question": "分析这个批次的成本构成"}' \
  --max-time 30)

if echo "$RESULT" | grep -q "analysis\|content\|session_id\|成本"; then
  SESSION_ID=$(echo "$RESULT" | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4)
  echo "  期望: 返回AI分析结果"
  echo "  实际: 成功，session_id=$SESSION_ID ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 分析成功"
  echo "  实际: $(echo $RESULT | head -c 150)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
  SESSION_ID=""
fi
echo ""

# ========== 测试4: AI追问(followup) ==========
echo "[测试4] AI追问(消耗1次配额)"
if [ -n "$SESSION_ID" ]; then
  echo "  请求: POST /api/mobile/F001/ai/analysis/cost/batch (followup)"

  RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/ai/analysis/cost/batch" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"batchId\": 1, \"question\": \"如何降低人工成本?\", \"sessionId\": \"$SESSION_ID\"}" \
    --max-time 30)

  if echo "$RESULT" | grep -q "analysis\|content\|人工"; then
    echo "  期望: 追问成功"
    echo "  实际: 成功 ✓"
    echo "  结果: ✅ PASS"
    PASS=$((PASS+1))
  else
    echo "  期望: 追问成功"
    echo "  实际: $(echo $RESULT | head -c 150)"
    echo "  结果: ❌ FAIL"
    FAIL=$((FAIL+1))
  fi
else
  echo "  跳过: 无可用session_id"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试5: 时间范围成本分析 ==========
echo "[测试5] 时间范围成本分析"
echo "  请求: GET /api/mobile/F001/reports/cost-analysis"

START_DATE=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d '7 days ago' +%Y-%m-%d)
END_DATE=$(date +%Y-%m-%d)

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/reports/cost-analysis?startDate=$START_DATE&endDate=$END_DATE" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回时间范围成本"
  echo "  实际: HTTP 200 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: HTTP 200"
  echo "  实际: HTTP $HTTP_CODE"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试6: AI时间范围成本分析 ==========
echo "[测试6] AI时间范围成本分析(周报)"
echo "  请求: POST /api/mobile/F001/ai/analysis/cost/time-range"

RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/ai/analysis/cost/time-range" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"startDate\": \"$START_DATE\", \"endDate\": \"$END_DATE\", \"question\": \"生成本周成本分析报告\"}" \
  --max-time 30)

if echo "$RESULT" | grep -q "analysis\|report\|session_id\|周"; then
  echo "  期望: 返回周报分析"
  echo "  实际: 成功 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 分析成功"
  echo "  实际: $(echo $RESULT | head -c 150)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试7: 批次对比分析 ==========
echo "[测试7] 批次成本对比"
echo "  请求: GET /api/mobile/F001/processing/cost-comparison?batchIds=1,2"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/processing/cost-comparison?batchIds=1,2" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回对比数据"
  echo "  实际: HTTP 200 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: HTTP 200"
  echo "  实际: HTTP $HTTP_CODE"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试8: 获取对话历史 ==========
echo "[测试8] 获取对话历史"
if [ -n "$SESSION_ID" ]; then
  echo "  请求: GET /api/mobile/F001/ai/conversations/$SESSION_ID"

  RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    "http://localhost:10010/api/mobile/F001/ai/conversations/$SESSION_ID" \
    -H "Authorization: Bearer $TOKEN")
  HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

  if [ "$HTTP_CODE" = "200" ]; then
    echo "  期望: HTTP 200, 返回对话历史"
    echo "  实际: HTTP 200 ✓"
    echo "  结果: ✅ PASS"
    PASS=$((PASS+1))
  else
    echo "  期望: HTTP 200"
    echo "  实际: HTTP $HTTP_CODE"
    echo "  结果: ❌ FAIL"
    FAIL=$((FAIL+1))
  fi
else
  echo "  请求: GET /api/mobile/F001/ai/reports (无session_id，改用报告列表)"
  RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    "http://localhost:10010/api/mobile/F001/ai/reports" \
    -H "Authorization: Bearer $TOKEN")
  HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

  if [ "$HTTP_CODE" = "200" ]; then
    echo "  期望: HTTP 200, 返回报告列表"
    echo "  实际: HTTP 200 ✓"
    echo "  结果: ✅ PASS"
    PASS=$((PASS+1))
  else
    echo "  期望: HTTP 200"
    echo "  实际: HTTP $HTTP_CODE"
    echo "  结果: ❌ FAIL"
    FAIL=$((FAIL+1))
  fi
fi
echo ""

# ========== 测试9: 缓存验证(相同查询) ==========
echo "[测试9] 缓存验证(5分钟内相同查询)"
echo "  请求: 连续两次相同的批次分析请求"

# 第一次请求
START_TIME=$(date +%s)
RESULT1=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/ai/analysis/cost/batch" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"batchId": 2, "question": "分析成本"}' \
  --max-time 30)
END_TIME1=$(date +%s)
TIME1=$((END_TIME1 - START_TIME))

# 第二次请求(应该命中缓存)
START_TIME=$(date +%s)
RESULT2=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/ai/analysis/cost/batch" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"batchId": 2, "question": "分析成本"}' \
  --max-time 30)
END_TIME2=$(date +%s)
TIME2=$((END_TIME2 - START_TIME))

# 缓存命中时，第二次应该更快
if [ $TIME2 -le $TIME1 ] && echo "$RESULT2" | grep -q "analysis\|content"; then
  echo "  期望: 第二次请求更快(缓存命中)"
  echo "  实际: 首次=${TIME1}s, 缓存=${TIME2}s ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 缓存生效"
  echo "  实际: 首次=${TIME1}s, 二次=${TIME2}s"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试10: 配额消耗验证 ==========
echo "[测试10] 配额消耗验证"
echo "  请求: 查询当前配额"

RESULT=$(curl -s "http://localhost:10010/api/mobile/F001/ai/quota" \
  -H "Authorization: Bearer $TOKEN")

if echo "$RESULT" | grep -q "remaining\|used\|total"; then
  REMAINING=$(echo "$RESULT" | grep -o '"remaining":[0-9]*' | cut -d':' -f2)
  USED=$(echo "$RESULT" | grep -o '"used":[0-9]*' | cut -d':' -f2)
  echo "  期望: 显示配额使用情况"
  echo "  实际: 已用=$USED, 剩余=$REMAINING ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 配额信息"
  echo "  实际: $(echo $RESULT | head -c 100)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试汇总 ==========
echo "========================================"
echo "测试汇总"
echo "========================================"
TOTAL=$((PASS+FAIL))
if [ $TOTAL -gt 0 ]; then
  RATE=$((PASS*100/TOTAL))
else
  RATE=0
fi
echo "总计: $TOTAL | 通过: $PASS | 失败: $FAIL | 通过率: ${RATE}%"
echo "========================================"

if [ $FAIL -eq 0 ]; then
  echo "✅ 所有测试通过!"
else
  echo "⚠️  有 $FAIL 个测试失败，请检查"
fi
```

## AI配额规则

| 操作类型 | 配额消耗 |
|----------|----------|
| 首次分析(default) | 0次 |
| 追问(followup) | 1次 |
| 历史报告(historical) | 5次 |

**每工厂每周配额**: 100次
**重置时间**: 每周一凌晨0点

## 缓存策略

- 相同查询条件 + 5分钟内 = 命中缓存
- 批次分析缓存: 7天
- 周报告缓存: 30天
- 月报告缓存: 90天

## Python AI 服务

**启动方式**:
```bash
cd backend-java/backend-ai-chat
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python scripts/main_enhanced.py
```

**配置文件** (.env):
```env
DASHSCOPE_API_KEY=sk-xxx
DASHSCOPE_MODEL=qwen-plus
REDIS_HOST=localhost
REDIS_PORT=6379
```

**端点**:
- `GET /` - 健康检查
- `POST /api/ai/chat` - AI对话分析
- `GET /api/ai/quota/{user_id}` - 配额查询
- `GET /api/ai/session/{session_id}` - 会话历史
- `DELETE /api/ai/session/{session_id}` - 清除会话

## 注意事项

1. AI分析需要依赖阿里云通义千问 (DashScope) API服务
2. 配额用尽后需等待周一重置
3. 缓存命中不消耗配额
4. Redis不可用时自动使用内存存储
