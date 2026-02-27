#!/bin/bash
# === 全模型测试脚本 ===
# 测试所有 8 个免费额度模型的实际使用场景
# 指标: 响应时间 (秒) | 返回质量 (内容长度+关键字段)

SERVER="http://localhost:10010"
PYTHON="http://localhost:8083"
RESULTS_FILE="/tmp/model-test-results.txt"

echo "=========================================="
echo "  LLM 模型全面测试 — $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

# 获取 JWT Token
echo "[准备] 获取认证 Token..."
LOGIN_RESP=$(curl -s -X POST $SERVER/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin1","password":"123456"}')
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "FATAL: 无法获取 Token，退出"
  echo "Response: $LOGIN_RESP"
  exit 1
fi
echo "[准备] Token 获取成功: ${TOKEN:0:20}..."
echo ""

# 初始化结果
> $RESULTS_FILE
PASS=0
FAIL=0
TOTAL=0

test_endpoint() {
  local TEST_NUM="$1"
  local MODEL="$2"
  local DESC="$3"
  local URL="$4"
  local DATA="$5"
  local CHECK_FIELD="$6"

  TOTAL=$((TOTAL+1))
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "TEST $TEST_NUM: $DESC"
  echo "  模型: $MODEL"
  echo "  端点: $URL"

  START_MS=$(date +%s%3N)

  RESPONSE=$(curl -s --max-time 90 -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$DATA" 2>&1)

  END_MS=$(date +%s%3N)
  ELAPSED=$((END_MS - START_MS))
  ELAPSED_SEC=$(echo "scale=2; $ELAPSED / 1000" | bc)

  # 解析结果
  PARSED=$(echo "$RESPONSE" | python3 << 'PYEOF'
import sys, json
try:
    r = json.load(sys.stdin)
    success = r.get('success', None)
    if success is None:
        if 'error' in r or 'detail' in r:
            success = False
        else:
            success = True

    content = json.dumps(r, ensure_ascii=False)
    content_len = len(content)

    check_field = """CHECK_PLACEHOLDER"""
    has_field = True
    if check_field and check_field != "":
        def deep_get(d, keys):
            for k in keys.split('.'):
                if isinstance(d, dict):
                    d = d.get(k)
                else:
                    return None
            return d
        val = deep_get(r, check_field)
        has_field = val is not None and val != '' and val != []

    preview = ''
    for key in ['reply', 'response', 'answer', 'aiAnalysis', 'analysis', 'summary', 'content', 'naturalResponse']:
        val = r.get(key) or (r.get('data', {}) or {}).get(key, '')
        if val and isinstance(val, str) and len(val) > 10:
            preview = val[:200].replace('\n', ' ').replace('\r', '')
            break
    if not preview:
        for key in ['insights', 'recommendations', 'fields', 'structure', 'scenario']:
            val = r.get(key) or (r.get('data', {}) or {}).get(key)
            if val:
                preview = json.dumps(val, ensure_ascii=False)[:200].replace('\n', ' ')
                break
    if not preview:
        preview = content[:200].replace('\n', ' ')

    print(f'SUCCESS|{success}')
    print(f'LEN|{content_len}')
    print(f'FIELD|{has_field}')
    print(f'PREVIEW|{preview}')
except Exception as e:
    print(f'SUCCESS|False')
    print(f'LEN|0')
    print(f'FIELD|False')
    print(f'PREVIEW|ERROR: {str(e)[:100]}')
PYEOF
)
  # Replace placeholder
  PARSED=$(echo "$PARSED" | sed "s|CHECK_PLACEHOLDER|$CHECK_FIELD|g")

  SUCCESS=$(echo "$PARSED" | grep "^SUCCESS|" | cut -d'|' -f2)
  CONTENT_LEN=$(echo "$PARSED" | grep "^LEN|" | cut -d'|' -f2)
  HAS_FIELD=$(echo "$PARSED" | grep "^FIELD|" | cut -d'|' -f2)
  PREVIEW=$(echo "$PARSED" | grep "^PREVIEW|" | cut -d'|' -f2-)

  # 速度评级
  if [ "$ELAPSED" -lt 3000 ]; then
    SPEED="极快"
  elif [ "$ELAPSED" -lt 8000 ]; then
    SPEED="正常"
  elif [ "$ELAPSED" -lt 20000 ]; then
    SPEED="较慢"
  else
    SPEED="超慢"
  fi

  # 质量评级
  if [ "$SUCCESS" = "True" ] && [ "${CONTENT_LEN:-0}" -gt 50 ]; then
    QUALITY="PASS"
    PASS=$((PASS+1))
  else
    QUALITY="FAIL"
    FAIL=$((FAIL+1))
  fi

  echo "  结果: $QUALITY | 耗时: ${ELAPSED_SEC}s ($SPEED) | 响应: ${CONTENT_LEN:-0} 字符"
  echo "  预览: ${PREVIEW:0:150}"
  echo ""

  echo "$TEST_NUM|$MODEL|$DESC|$QUALITY|${ELAPSED_SEC}s|${CONTENT_LEN:-0}|$SPEED" >> $RESULTS_FILE
}


echo ""
echo "##########################################"
echo "#  1. qwen3.5-plus (Java 主模型)          #"
echo "##########################################"
echo ""

test_endpoint "1.1" "qwen3.5-plus" \
  "通用AI对话-单轮" \
  "$SERVER/api/mobile/ai/chat" \
  '{"messages":[{"role":"user","content":"简要介绍食品安全溯源体系的三个关键环节，每个环节用一句话"}]}' \
  "data.reply"

test_endpoint "1.2" "qwen3.5-plus" \
  "通用AI对话-多轮" \
  "$SERVER/api/mobile/ai/chat" \
  '{"messages":[{"role":"user","content":"HACCP是什么"},{"role":"assistant","content":"HACCP是危害分析关键控制点体系"},{"role":"user","content":"它有几个原则？请列出"}]}' \
  "data.reply"


echo ""
echo "##########################################"
echo "#  2. qwen3.5-plus-2026-02-15             #"
echo "#     (Python 主文本模型)                  #"
echo "##########################################"
echo ""

test_endpoint "2.1" "qwen3.5-plus-0215" \
  "通用数据分析" \
  "$PYTHON/api/chat/general-analysis" \
  '{"query":"分析这组销售数据的趋势和异常点","data":[{"month":"1月","sales":150000,"cost":100000,"profit":50000},{"month":"2月","sales":180000,"cost":110000,"profit":70000},{"month":"3月","sales":160000,"cost":115000,"profit":45000},{"month":"4月","sales":220000,"cost":130000,"profit":90000}]}' \
  "answer"

test_endpoint "2.2" "qwen3.5-plus-0215" \
  "根因分析" \
  "$PYTHON/api/chat/root-cause" \
  '{"query":"3月利润为什么下降了","data":[{"month":"1月","sales":150000,"cost":100000,"profit":50000},{"month":"2月","sales":180000,"cost":110000,"profit":70000},{"month":"3月","sales":160000,"cost":115000,"profit":45000}],"metric":"profit","direction":"down"}' \
  "answer"

test_endpoint "2.3" "qwen3.5-plus-0215" \
  "多维度分析" \
  "$PYTHON/api/chat/multi-dimension" \
  '{"query":"按月份和产品分析销售","data":[{"month":"1月","product":"苹果","sales":50000},{"month":"1月","product":"香蕉","sales":30000},{"month":"2月","product":"苹果","sales":60000},{"month":"2月","product":"香蕉","sales":35000}],"dimensions":["month","product"]}' \
  "answer"


echo ""
echo "##########################################"
echo "#  3. qwen3.5-flash-2026-02-23            #"
echo "#     (Python 洞察生成)                    #"
echo "##########################################"
echo ""

test_endpoint "3.1" "qwen3.5-flash-0223" \
  "洞察生成-财务" \
  "$PYTHON/api/insight/generate" \
  '{"data":[{"month":"1月","revenue":500000,"cost":350000,"gross_margin":0.30},{"month":"2月","revenue":550000,"cost":370000,"gross_margin":0.33},{"month":"3月","revenue":480000,"cost":360000,"gross_margin":0.25},{"month":"4月","revenue":620000,"cost":400000,"gross_margin":0.35}],"columns":["month","revenue","cost","gross_margin"],"sheet_name":"季度财务"}' \
  "insights"

test_endpoint "3.2" "qwen3.5-flash-0223" \
  "洞察生成-产品明细" \
  "$PYTHON/api/insight/generate" \
  '{"data":[{"date":"2025-01","product":"A","qty":100,"price":50},{"date":"2025-02","product":"B","qty":200,"price":30},{"date":"2025-03","product":"A","qty":150,"price":50},{"date":"2025-04","product":"C","qty":80,"price":100},{"date":"2025-05","product":"B","qty":180,"price":30},{"date":"2025-06","product":"A","qty":120,"price":50}],"columns":["date","product","qty","price"],"sheet_name":"产品销售明细"}' \
  "insights"

test_endpoint "3.3" "qwen3.5-flash-0223" \
  "指标分析 (analyze-metrics)" \
  "$PYTHON/api/insight/analyze-metrics" \
  '{"data":[{"month":"1月","revenue":50,"cost":35},{"month":"2月","revenue":55,"cost":37},{"month":"3月","revenue":48,"cost":36}],"columns":["month","revenue","cost"],"metrics":["revenue","cost"]}' \
  "metrics"


echo ""
echo "##########################################"
echo "#  4. qwen3.5-27b (Python 图表推荐)       #"
echo "##########################################"
echo ""

test_endpoint "4.1" "qwen3.5-27b" \
  "图表推荐-时序数据" \
  "$PYTHON/api/smartbi/chart/recommend" \
  '{"columns":["month","revenue","cost","profit","margin"],"sample_data":[{"month":"1月","revenue":500000,"cost":350000,"profit":150000,"margin":0.30},{"month":"2月","revenue":550000,"cost":370000,"profit":180000,"margin":0.33}],"row_count":12,"sheet_name":"年度财务"}' \
  "recommendations"

test_endpoint "4.2" "qwen3.5-27b" \
  "图表推荐-分类数据" \
  "$PYTHON/api/smartbi/chart/recommend" \
  '{"columns":["region","Q1","Q2","Q3","Q4"],"sample_data":[{"region":"华东","Q1":120,"Q2":150,"Q3":180,"Q4":200},{"region":"华南","Q1":100,"Q2":130,"Q3":160,"Q4":190}],"row_count":6,"sheet_name":"区域季度对比"}' \
  "recommendations"


echo ""
echo "##########################################"
echo "#  5. qwen3.5-122b-a10b                   #"
echo "#     (Python 字段映射/数据清洗)           #"
echo "##########################################"
echo ""

test_endpoint "5.1" "qwen3.5-122b-a10b" \
  "字段类型检测" \
  "$PYTHON/api/smartbi/excel/detect-fields" \
  '{"columns":["日期","产品名称","销售数量","单价","总金额","备注"],"sample_values":[["2025-01-01","红富士苹果",100,5.50,550.00,"正常"],["2025-01-02","海南香蕉",200,3.00,600.00,"促销"],["2025-01-03","新疆葡萄",150,8.00,1200.00,""]]}' \
  "fields"

test_endpoint "5.2" "qwen3.5-122b-a10b" \
  "结构分析" \
  "$PYTHON/api/smartbi/excel/analyze-structure" \
  '{"columns":["月份","产品线","销售额","成本","毛利率"],"sample_data":[{"月份":"2025-01","产品线":"饮料","销售额":150,"成本":100,"毛利率":33.3},{"月份":"2025-01","产品线":"零食","销售额":80,"成本":50,"毛利率":37.5}],"row_count":24,"sheet_name":"产品线月度分析"}' \
  "structure"


echo ""
echo "##########################################"
echo "#  6. qwen3.5-flash (Python 快速分类)     #"
echo "##########################################"
echo ""

test_endpoint "6.1" "qwen3.5-flash" \
  "场景检测" \
  "$PYTHON/api/smartbi/excel/detect-scenario" \
  '{"columns":["日期","产品","数量","金额"],"sample_data":[{"日期":"2025-01-01","产品":"苹果","数量":100,"金额":500}],"sheet_name":"销售明细","row_count":100}' \
  "scenario"

test_endpoint "6.2" "qwen3.5-flash" \
  "意图分类 (LLM)" \
  "$PYTHON/api/ai/intent/classify" \
  '{"text":"查看本月产量报表","factoryId":"F001"}' \
  "intent"


echo ""
echo "##########################################"
echo "#  7. qwen3.5-397b-a17b (Python 深度推理) #"
echo "##########################################"
echo ""

test_endpoint "7.1" "qwen3.5-397b-a17b" \
  "基准对比分析" \
  "$PYTHON/api/chat/benchmark" \
  '{"query":"与行业标准对比分析","data":[{"metric":"毛利率","value":0.28},{"metric":"净利率","value":0.05},{"metric":"库存周转天数","value":45},{"metric":"应收账款周转天数","value":60}],"industry":"食品加工"}' \
  "answer"


echo ""
echo "##########################################"
echo "#  8. qwen3.5-35b-a3b (Java 纠错+ArenaRL) #"
echo "##########################################"
echo ""

test_endpoint "8.1" "qwen3.5-35b-a3b" \
  "意图执行-生产查询" \
  "$SERVER/api/mobile/F001/ai-intents/execute" \
  '{"query":"查看今天的生产报工数据"}' \
  "data"

test_endpoint "8.2" "qwen3.5-35b-a3b" \
  "意图执行-质量查询" \
  "$SERVER/api/mobile/F001/ai-intents/execute" \
  '{"query":"最近质量检查情况怎么样"}' \
  "data"


echo ""
echo ""
echo "=========================================="
echo "  测试完成汇总 — $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""
echo "  通过: $PASS / $TOTAL"
echo "  失败: $FAIL / $TOTAL"
echo ""

# 打印汇总表
echo "┌──────┬─────────────────────────────┬──────────────────────────┬────────┬──────────┬──────────┬────────┐"
printf "│ %-4s │ %-27s │ %-24s │ %-6s │ %-8s │ %-8s │ %-6s │\n" "编号" "模型" "测试项" "结果" "耗时" "响应" "速度"
echo "├──────┼─────────────────────────────┼──────────────────────────┼────────┼──────────┼──────────┼────────┤"
while IFS='|' read -r num model desc quality time size speed; do
  printf "│ %-4s │ %-27s │ %-24s │ %-6s │ %-8s │ %6sB │ %-6s │\n" "$num" "$model" "$desc" "$quality" "$time" "$size" "$speed"
done < $RESULTS_FILE
echo "└──────┴─────────────────────────────┴──────────────────────────┴────────┴──────────┴──────────┴────────┘"
