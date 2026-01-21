#!/bin/bash
# SmartBI 全面测试脚本
# 验证 SmartBI 从数据查询到图表展示到动态交互的完整链路

BASE_URL="http://139.196.165.140:10010/api/public/smart-bi"
REPORT_FILE="smart_bi_test_report_$(date +%Y%m%d_%H%M%S).md"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 计数器
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# 记录函数
log_pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASS_COUNT++))
    echo "- ✅ PASS: $1" >> "$REPORT_FILE"
}

log_fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((FAIL_COUNT++))
    echo "- ❌ FAIL: $1" >> "$REPORT_FILE"
}

log_warn() {
    echo -e "${YELLOW}⚠ WARN${NC}: $1"
    ((WARN_COUNT++))
    echo "- ⚠️ WARN: $1" >> "$REPORT_FILE"
}

log_info() {
    echo -e "  INFO: $1"
    echo "  - $1" >> "$REPORT_FILE"
}

# 初始化报告
init_report() {
    cat > "$REPORT_FILE" << EOF
# SmartBI 全面测试报告

**测试时间**: $(date '+%Y-%m-%d %H:%M:%S')
**测试环境**: $BASE_URL

---

EOF
}

# ============================================
# Phase 1: 基础数据验证
# ============================================
phase1_basic_data() {
    echo ""
    echo "============================================"
    echo "Phase 1: 基础数据验证"
    echo "============================================"
    echo "" >> "$REPORT_FILE"
    echo "## Phase 1: 基础数据验证" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    # 1.1 经营驾驶舱测试
    echo "Testing: 经营驾驶舱 (/dashboard/executive)"
    response=$(curl -s "$BASE_URL/dashboard/executive?period=month")

    if echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    if d.get('success'):
        data=d.get('data',{})
        kpis=data.get('kpiCards',[])
        if len(kpis) > 0:
            sys.exit(0)
    sys.exit(1)
except:
    sys.exit(1)
" 2>/dev/null; then
        log_pass "经营驾驶舱 - 返回KPI卡片数据"
        kpi_count=$(echo "$response" | python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d.get('data',{}).get('kpiCards',[])))")
        log_info "KPI卡片数量: $kpi_count"
    else
        log_fail "经营驾驶舱 - 无法获取KPI数据"
    fi

    # 1.2 销售数据概览
    echo "Testing: 销售数据概览 (/analysis/sales?dimension=overview)"
    response=$(curl -s "$BASE_URL/analysis/sales?dimension=overview")

    if echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    if d.get('success'):
        sys.exit(0)
    sys.exit(1)
except:
    sys.exit(1)
" 2>/dev/null; then
        log_pass "销售数据概览 - API正常响应"
    else
        log_fail "销售数据概览 - API响应异常"
    fi

    # 1.3 销售员排名
    echo "Testing: 销售员排名 (/analysis/sales?dimension=salesperson)"
    response=$(curl -s "$BASE_URL/analysis/sales?dimension=salesperson")

    salesperson_count=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    data=d.get('data',{})
    rankings=data.get('rankings',{}).get('salesperson',[])
    if not rankings:
        rankings=data.get('ranking',[])
    print(len(rankings))
except:
    print(0)
" 2>/dev/null)

    if [ "$salesperson_count" -ge 1 ]; then
        log_pass "销售员排名 - 返回 $salesperson_count 位销售员数据"
    else
        log_warn "销售员排名 - 数据量偏少: $salesperson_count"
    fi

    # 1.4 部门数据
    echo "Testing: 部门分析 (/analysis/department)"
    response=$(curl -s "$BASE_URL/analysis/department")

    dept_count=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    data=d.get('data',{})
    rankings=data.get('rankings',{}).get('department',[])
    if not rankings:
        rankings=data.get('ranking',[])
    print(len(rankings))
except:
    print(0)
" 2>/dev/null)

    if [ "$dept_count" -ge 1 ]; then
        log_pass "部门分析 - 返回 $dept_count 个部门数据"
    else
        log_warn "部门分析 - 数据量偏少: $dept_count"
    fi

    # 1.5 区域数据
    echo "Testing: 区域分析 (/analysis/region)"
    response=$(curl -s "$BASE_URL/analysis/region")

    region_count=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    data=d.get('data',{})
    rankings=data.get('rankings',{}).get('region',[])
    if not rankings:
        rankings=data.get('ranking',[])
    print(len(rankings))
except:
    print(0)
" 2>/dev/null)

    if [ "$region_count" -ge 1 ]; then
        log_pass "区域分析 - 返回 $region_count 个区域数据"
    else
        log_warn "区域分析 - 数据量偏少: $region_count"
    fi

    # 1.6 产品数据
    echo "Testing: 产品分析 (/analysis/sales?dimension=product)"
    response=$(curl -s "$BASE_URL/analysis/sales?dimension=product")

    product_count=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    data=d.get('data',{})
    rankings=data.get('rankings',{}).get('product',[])
    if not rankings:
        rankings=data.get('ranking',[])
    print(len(rankings))
except:
    print(0)
" 2>/dev/null)

    if [ "$product_count" -ge 1 ]; then
        log_pass "产品分析 - 返回 $product_count 个产品数据"
    else
        log_warn "产品分析 - 数据量偏少: $product_count"
    fi
}

# ============================================
# Phase 2: 图表数据测试
# ============================================
phase2_chart_data() {
    echo ""
    echo "============================================"
    echo "Phase 2: 图表数据测试"
    echo "============================================"
    echo "" >> "$REPORT_FILE"
    echo "## Phase 2: 图表数据测试" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    # 2.1 销售趋势图 (LINE)
    echo "Testing: 销售趋势图 LINE (/analysis/sales?dimension=trend)"
    response=$(curl -s "$BASE_URL/analysis/sales?dimension=trend")

    chart_type=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    chart=d.get('data',{}).get('chart',d.get('data',{}).get('charts',{}).get('trend',{}))
    print(chart.get('chartType','UNKNOWN'))
except:
    print('ERROR')
" 2>/dev/null)

    data_points=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    chart=d.get('data',{}).get('chart',d.get('data',{}).get('charts',{}).get('trend',{}))
    print(len(chart.get('data',[])))
except:
    print(0)
" 2>/dev/null)

    if [ "$chart_type" = "LINE" ] || [ "$chart_type" = "line" ]; then
        log_pass "销售趋势图 - 图表类型: LINE, 数据点: $data_points"
    elif [ "$data_points" -gt 0 ]; then
        log_warn "销售趋势图 - 图表类型: $chart_type (期望LINE), 数据点: $data_points"
    else
        log_fail "销售趋势图 - 无法获取图表数据"
    fi

    # 2.2 部门排名图 (BAR)
    echo "Testing: 部门排名图 BAR (/analysis/department)"
    response=$(curl -s "$BASE_URL/analysis/department")

    chart_type=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    charts=d.get('data',{}).get('charts',{})
    # 尝试多种可能的字段
    chart=charts.get('ranking',charts.get('bar',charts.get('department',{})))
    print(chart.get('chartType','UNKNOWN'))
except:
    print('ERROR')
" 2>/dev/null)

    if [ "$chart_type" = "BAR" ] || [ "$chart_type" = "bar" ]; then
        log_pass "部门排名图 - 图表类型: BAR"
    else
        log_warn "部门排名图 - 图表类型: $chart_type (期望BAR)"
    fi

    # 2.3 产品分布图 (PIE)
    echo "Testing: 产品分布图 PIE"
    response=$(curl -s "$BASE_URL/analysis/sales?dimension=product")

    chart_type=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    charts=d.get('data',{}).get('charts',{})
    chart=charts.get('distribution',charts.get('pie',charts.get('product',{})))
    print(chart.get('chartType','UNKNOWN'))
except:
    print('ERROR')
" 2>/dev/null)

    if [ "$chart_type" = "PIE" ] || [ "$chart_type" = "pie" ]; then
        log_pass "产品分布图 - 图表类型: PIE"
    else
        log_warn "产品分布图 - 图表类型: $chart_type (期望PIE)"
    fi

    # 2.4 区域热力图 (HEATMAP/MAP)
    echo "Testing: 区域热力图 HEATMAP/MAP"
    response=$(curl -s "$BASE_URL/analysis/region")

    chart_type=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    charts=d.get('data',{}).get('charts',{})
    chart=charts.get('heatmap',charts.get('map',charts.get('region',{})))
    print(chart.get('chartType','UNKNOWN'))
except:
    print('ERROR')
" 2>/dev/null)

    if [ "$chart_type" = "HEATMAP" ] || [ "$chart_type" = "MAP" ] || [ "$chart_type" = "heatmap" ] || [ "$chart_type" = "map" ]; then
        log_pass "区域热力图 - 图表类型: $chart_type"
    else
        log_warn "区域热力图 - 图表类型: $chart_type (期望HEATMAP/MAP)"
    fi
}

# ============================================
# Phase 3: 自然语言查询测试
# ============================================
phase3_nl_query() {
    echo ""
    echo "============================================"
    echo "Phase 3: 自然语言查询测试"
    echo "============================================"
    echo "" >> "$REPORT_FILE"
    echo "## Phase 3: 自然语言查询测试" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    # 测试用例数组
    declare -a queries=(
        "本月销售额是多少|QUERY_SALES_OVERVIEW|0.7"
        "哪个部门业绩最好|QUERY_DEPARTMENT_PERFORMANCE|0.7"
        "华东区销售怎么样|QUERY_REGION_ANALYSIS|0.7"
        "应收账款多少|QUERY_RECEIVABLE|0.6"
        "销售趋势如何|QUERY_SALES_TREND|0.7"
        "产品销量排名|QUERY_PRODUCT_ANALYSIS|0.7"
        "库存情况怎么样|QUERY_INVENTORY|0.6"
        "预测下个月销售|FORECAST|0.5"
    )

    for test_case in "${queries[@]}"; do
        IFS='|' read -r query expected_intent min_confidence <<< "$test_case"

        echo "Testing: NL Query - \"$query\""
        response=$(curl -s -X POST "$BASE_URL/query" \
            -H "Content-Type: application/json" \
            -d "{\"query\":\"$query\"}")

        intent=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    print(d.get('data',{}).get('intent','UNKNOWN'))
except:
    print('ERROR')
" 2>/dev/null)

        confidence=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    print(d.get('data',{}).get('confidence',0))
except:
    print(0)
" 2>/dev/null)

        # 检查置信度是否为有效数字
        if [[ "$confidence" =~ ^[0-9]*\.?[0-9]+$ ]]; then
            if (( $(echo "$confidence >= $min_confidence" | bc -l) )); then
                if [ "$intent" = "$expected_intent" ]; then
                    log_pass "\"$query\" -> $intent (置信度: $confidence)"
                else
                    log_warn "\"$query\" -> $intent (期望: $expected_intent, 置信度: $confidence)"
                fi
            else
                log_fail "\"$query\" -> $intent (置信度: $confidence < $min_confidence)"
            fi
        else
            log_fail "\"$query\" -> 无法解析置信度"
        fi
    done

    # 3.2 多轮对话测试
    echo ""
    echo "Testing: 多轮对话测试"
    session_id="test-session-$(date +%s)"

    # 第一轮
    response1=$(curl -s -X POST "$BASE_URL/query" \
        -H "Content-Type: application/json" \
        -d "{\"query\":\"华东区销售怎么样\",\"sessionId\":\"$session_id\"}")

    success1=$(echo "$response1" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('success',False))" 2>/dev/null)

    if [ "$success1" = "True" ]; then
        log_pass "多轮对话第1轮 - 华东区销售查询成功"

        # 第二轮 (指代消解)
        response2=$(curl -s -X POST "$BASE_URL/query" \
            -H "Content-Type: application/json" \
            -d "{\"query\":\"那个区域的TOP3产品呢\",\"sessionId\":\"$session_id\"}")

        success2=$(echo "$response2" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('success',False))" 2>/dev/null)

        if [ "$success2" = "True" ]; then
            log_pass "多轮对话第2轮 - 指代消解测试成功"
        else
            log_warn "多轮对话第2轮 - 指代消解可能未生效"
        fi
    else
        log_fail "多轮对话第1轮 - 查询失败"
    fi
}

# ============================================
# Phase 4: 动态交互测试
# ============================================
phase4_interaction() {
    echo ""
    echo "============================================"
    echo "Phase 4: 动态交互测试"
    echo "============================================"
    echo "" >> "$REPORT_FILE"
    echo "## Phase 4: 动态交互测试" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    # 4.1 区域下钻测试
    echo "Testing: 数据下钻 - 区域 -> 省份"
    response=$(curl -s -X POST "$BASE_URL/drill-down" \
        -H "Content-Type: application/json" \
        -d '{"dimension":"region","value":"华东地区"}')

    drill_result=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    if d.get('success'):
        data=d.get('data',{})
        items=data.get('data',data.get('items',[]))
        if isinstance(items, list):
            print(len(items))
        else:
            print(0)
    else:
        print(-1)
except:
    print(-1)
" 2>/dev/null)

    if [ "$drill_result" -gt 0 ]; then
        log_pass "区域下钻 - 返回 $drill_result 条省份数据"
    elif [ "$drill_result" -eq 0 ]; then
        log_warn "区域下钻 - 无下钻数据"
    else
        log_fail "区域下钻 - API调用失败"
    fi

    # 4.2 部门下钻测试
    echo "Testing: 数据下钻 - 部门 -> 销售员"
    response=$(curl -s -X POST "$BASE_URL/drill-down" \
        -H "Content-Type: application/json" \
        -d '{"dimension":"department","value":"销售一部"}')

    drill_result=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    if d.get('success'):
        data=d.get('data',{})
        items=data.get('data',data.get('items',[]))
        if isinstance(items, list):
            print(len(items))
        else:
            print(0)
    else:
        print(-1)
except:
    print(-1)
" 2>/dev/null)

    if [ "$drill_result" -gt 0 ]; then
        log_pass "部门下钻 - 返回 $drill_result 条销售员数据"
    elif [ "$drill_result" -eq 0 ]; then
        log_warn "部门下钻 - 无下钻数据"
    else
        log_fail "部门下钻 - API调用失败"
    fi

    # 4.3 时间范围切换测试
    echo ""
    echo "Testing: 时间范围切换"

    declare -a periods=("today" "week" "month" "quarter")

    for period in "${periods[@]}"; do
        response=$(curl -s "$BASE_URL/dashboard/executive?period=$period")
        success=$(echo "$response" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('success',False))" 2>/dev/null)

        if [ "$success" = "True" ]; then
            log_pass "时间范围: $period - 查询成功"
        else
            log_fail "时间范围: $period - 查询失败"
        fi
    done

    # 4.4 筛选条件测试
    echo ""
    echo "Testing: 筛选条件"

    response=$(curl -s "$BASE_URL/analysis/sales?department=销售一部")
    success=$(echo "$response" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('success',False))" 2>/dev/null)

    if [ "$success" = "True" ]; then
        log_pass "部门筛选 - 销售一部数据查询成功"
    else
        log_warn "部门筛选 - 查询可能不支持"
    fi
}

# ============================================
# Phase 5: 预警与建议测试
# ============================================
phase5_alerts() {
    echo ""
    echo "============================================"
    echo "Phase 5: 预警与建议测试"
    echo "============================================"
    echo "" >> "$REPORT_FILE"
    echo "## Phase 5: 预警与建议测试" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    # 5.1 预警列表测试
    echo "Testing: 预警列表 (/alerts)"
    response=$(curl -s "$BASE_URL/alerts")

    alerts_count=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    if d.get('success'):
        alerts=d.get('data',[])
        if isinstance(alerts, list):
            print(len(alerts))
        else:
            print(0)
    else:
        print(-1)
except:
    print(-1)
" 2>/dev/null)

    if [ "$alerts_count" -gt 0 ]; then
        log_pass "预警列表 - 返回 $alerts_count 条预警"

        # 检查预警级别
        levels=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    alerts=d.get('data',[])
    levels=set([a.get('level','') for a in alerts])
    print(','.join(levels))
except:
    print('')
" 2>/dev/null)
        log_info "预警级别: $levels"
    elif [ "$alerts_count" -eq 0 ]; then
        log_warn "预警列表 - 无预警数据"
    else
        log_fail "预警列表 - API调用失败"
    fi

    # 5.2 建议列表测试
    echo "Testing: 建议列表 (/recommendations)"
    response=$(curl -s "$BASE_URL/recommendations")

    recs_count=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    if d.get('success'):
        recs=d.get('data',[])
        if isinstance(recs, list):
            print(len(recs))
        else:
            print(0)
    else:
        print(-1)
except:
    print(-1)
" 2>/dev/null)

    if [ "$recs_count" -gt 0 ]; then
        log_pass "建议列表 - 返回 $recs_count 条建议"
    elif [ "$recs_count" -eq 0 ]; then
        log_warn "建议列表 - 无建议数据"
    else
        log_fail "建议列表 - API调用失败"
    fi

    # 5.3 激励方案测试
    echo "Testing: 激励方案生成"
    response=$(curl -s "$BASE_URL/incentive-plan/salesperson/王五")

    success=$(echo "$response" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('success',False))" 2>/dev/null)

    if [ "$success" = "True" ]; then
        log_pass "激励方案生成 - API正常响应"
    else
        log_warn "激励方案生成 - 可能不支持或无数据"
    fi
}

# ============================================
# Phase 6: 预测服务测试
# ============================================
phase6_forecast() {
    echo ""
    echo "============================================"
    echo "Phase 6: 预测服务测试"
    echo "============================================"
    echo "" >> "$REPORT_FILE"
    echo "## Phase 6: 预测服务测试" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    # 6.1 销售预测测试
    echo "Testing: 销售预测 (预测未来7天销售)"
    response=$(curl -s -X POST "$BASE_URL/query" \
        -H "Content-Type: application/json" \
        -d '{"query":"预测未来7天销售"}')

    intent=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    print(d.get('data',{}).get('intent','UNKNOWN'))
except:
    print('ERROR')
" 2>/dev/null)

    has_forecast=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    data=d.get('data',{})
    # 检查多种可能的预测数据字段
    forecast=data.get('forecast',data.get('forecastResult',data.get('chartData',{})))
    if forecast and (forecast.get('forecastPoints') or forecast.get('data')):
        print('true')
    else:
        print('false')
except:
    print('false')
" 2>/dev/null)

    if [ "$intent" = "FORECAST" ]; then
        log_pass "预测意图识别 - 正确识别为 FORECAST"
        if [ "$has_forecast" = "true" ]; then
            log_pass "预测数据 - 返回预测结果"
        else
            log_warn "预测数据 - 未返回预测点数据"
        fi
    else
        log_warn "预测意图识别 - 识别为 $intent (期望 FORECAST)"
    fi
}

# ============================================
# Phase 7: 统一仪表盘测试
# ============================================
phase7_dashboard() {
    echo ""
    echo "============================================"
    echo "Phase 7: 统一仪表盘聚合测试"
    echo "============================================"
    echo "" >> "$REPORT_FILE"
    echo "## Phase 7: 统一仪表盘聚合测试" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    echo "Testing: 统一仪表盘 (/dashboard?period=month)"
    response=$(curl -s "$BASE_URL/dashboard?period=month")

    # 检查各维度数据
    result=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    if not d.get('success'):
        print('API_FAILED')
        sys.exit(0)

    data=d.get('data',{})
    results=[]

    # 检查各维度
    dimensions=['sales','finance','inventory','production','quality','procurement']
    for dim in dimensions:
        dim_data=data.get(dim,{})
        if dim_data and (dim_data.get('kpiCards') or dim_data.get('summary')):
            results.append(f'{dim}:OK')
        else:
            results.append(f'{dim}:MISSING')

    # 检查排名
    if data.get('departmentRanking'):
        results.append('deptRank:OK')
    else:
        results.append('deptRank:MISSING')

    if data.get('regionRanking'):
        results.append('regionRank:OK')
    else:
        results.append('regionRank:MISSING')

    # 检查预警和建议
    if data.get('alerts') is not None:
        results.append('alerts:OK')
    else:
        results.append('alerts:MISSING')

    if data.get('recommendations') is not None:
        results.append('recs:OK')
    else:
        results.append('recs:MISSING')

    print('|'.join(results))
except Exception as e:
    print(f'ERROR:{e}')
" 2>/dev/null)

    if [ "$result" = "API_FAILED" ]; then
        log_fail "统一仪表盘 - API调用失败"
    elif [[ "$result" == ERROR:* ]]; then
        log_fail "统一仪表盘 - 解析错误: $result"
    else
        IFS='|' read -ra items <<< "$result"
        for item in "${items[@]}"; do
            IFS=':' read -r dim status <<< "$item"
            if [ "$status" = "OK" ]; then
                log_pass "统一仪表盘 - $dim 数据完整"
            else
                log_warn "统一仪表盘 - $dim 数据缺失"
            fi
        done
    fi
}

# ============================================
# 生成测试摘要
# ============================================
generate_summary() {
    echo ""
    echo "============================================"
    echo "测试摘要"
    echo "============================================"

    total=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT))
    pass_rate=0
    if [ $total -gt 0 ]; then
        pass_rate=$(echo "scale=1; $PASS_COUNT * 100 / $total" | bc)
    fi

    echo ""
    echo -e "通过: ${GREEN}$PASS_COUNT${NC}"
    echo -e "失败: ${RED}$FAIL_COUNT${NC}"
    echo -e "警告: ${YELLOW}$WARN_COUNT${NC}"
    echo "总计: $total"
    echo "通过率: $pass_rate%"

    cat >> "$REPORT_FILE" << EOF

---

## 测试摘要

| 指标 | 数值 |
|------|------|
| 通过 | $PASS_COUNT |
| 失败 | $FAIL_COUNT |
| 警告 | $WARN_COUNT |
| 总计 | $total |
| 通过率 | $pass_rate% |

---

**测试完成时间**: $(date '+%Y-%m-%d %H:%M:%S')
EOF

    echo ""
    echo "详细报告已保存到: $REPORT_FILE"
}

# ============================================
# 主函数
# ============================================
main() {
    echo "========================================"
    echo "SmartBI 全面测试 - 开始"
    echo "测试时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "目标服务: $BASE_URL"
    echo "========================================"

    init_report

    phase1_basic_data
    phase2_chart_data
    phase3_nl_query
    phase4_interaction
    phase5_alerts
    phase6_forecast
    phase7_dashboard

    generate_summary

    echo ""
    echo "========================================"
    echo "SmartBI 全面测试 - 完成"
    echo "========================================"
}

# 执行主函数
main
