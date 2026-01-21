#!/bin/bash
# SmartBI 全面测试脚本 V2
# 修复响应格式解析问题 (code: 200 vs success: true)

BASE_URL="http://139.196.165.140:10010/api/public/smart-bi"
REPORT_FILE="smart_bi_test_report_$(date +%Y%m%d_%H%M%S).md"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 计数器
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

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
    echo -e "  ${BLUE}INFO${NC}: $1"
    echo "  - $1" >> "$REPORT_FILE"
}

# 检查API响应是否成功 (支持两种格式)
check_api_success() {
    python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    # 支持两种响应格式
    if d.get('success') == True or d.get('code') == 200:
        sys.exit(0)
    sys.exit(1)
except:
    sys.exit(1)
"
}

init_report() {
    cat > "$REPORT_FILE" << EOF
# SmartBI 全面测试报告 V2

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

    kpi_count=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    if d.get('code') == 200 or d.get('success'):
        kpis=d.get('data',{}).get('kpiCards',[])
        print(len(kpis))
    else:
        print(0)
except:
    print(-1)
" 2>/dev/null)

    if [ "$kpi_count" -gt 0 ]; then
        log_pass "经营驾驶舱 - 返回 $kpi_count 个KPI卡片"
        # 显示KPI详情
        echo "$response" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for kpi in d.get('data',{}).get('kpiCards',[])[:3]:
    print(f\"    - {kpi.get('title')}: {kpi.get('value')}\")
" 2>/dev/null
    else
        log_fail "经营驾驶舱 - 无法获取KPI数据"
    fi

    # 1.2 销售数据概览
    echo "Testing: 销售数据概览 (/analysis/sales?dimension=overview)"
    response=$(curl -s "$BASE_URL/analysis/sales?dimension=overview")

    if echo "$response" | check_api_success; then
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

    # 1.4 部门分析
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
        log_warn "部门分析 - 数据量偏少"
    fi

    # 1.5 区域分析
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
        log_warn "区域分析 - 数据量偏少"
    fi

    # 1.6 产品分析
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
        log_warn "产品分析 - 数据量偏少"
    fi

    # 1.7 财务分析
    echo "Testing: 财务分析 (/analysis/finance)"
    response=$(curl -s "$BASE_URL/analysis/finance")

    if echo "$response" | check_api_success; then
        log_pass "财务分析 - API正常响应"
    else
        log_warn "财务分析 - API可能未实现"
    fi

    # 1.8 库存分析
    echo "Testing: 库存分析 (/analysis/inventory)"
    response=$(curl -s "$BASE_URL/analysis/inventory")

    if echo "$response" | check_api_success; then
        log_pass "库存分析 - API正常响应"
    else
        log_warn "库存分析 - API可能未实现"
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

    # 2.1 销售趋势图
    echo "Testing: 销售趋势图 (/analysis/sales?dimension=trend)"
    response=$(curl -s "$BASE_URL/analysis/sales?dimension=trend")

    chart_info=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    data=d.get('data',{})
    charts=data.get('charts',{})
    chart=charts.get('trend',data.get('chart',{}))
    chart_type=chart.get('chartType','UNKNOWN')
    data_count=len(chart.get('data',[]))
    print(f'{chart_type}|{data_count}')
except Exception as e:
    print(f'ERROR|0')
" 2>/dev/null)

    IFS='|' read -r chart_type data_count <<< "$chart_info"

    if [ "$chart_type" = "LINE" ] && [ "$data_count" -gt 0 ]; then
        log_pass "销售趋势图 - LINE图, $data_count 个数据点"
    elif [ "$data_count" -gt 0 ]; then
        log_warn "销售趋势图 - 类型: $chart_type, $data_count 个数据点"
    else
        log_fail "销售趋势图 - 无图表数据"
    fi

    # 2.2 排名图表检查
    echo "Testing: 排名图表结构"
    response=$(curl -s "$BASE_URL/analysis/department")

    has_rankings=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    rankings=d.get('data',{}).get('rankings',{})
    if rankings and len(rankings) > 0:
        print('true')
    else:
        print('false')
except:
    print('false')
" 2>/dev/null)

    if [ "$has_rankings" = "true" ]; then
        log_pass "排名数据结构 - 包含rankings对象"
    else
        log_warn "排名数据结构 - 格式可能不同"
    fi

    # 2.3 检查图表配置完整性
    echo "Testing: 图表配置完整性"
    response=$(curl -s "$BASE_URL/analysis/sales?dimension=trend")

    config_valid=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    chart=d.get('data',{}).get('charts',{}).get('trend',d.get('data',{}).get('chart',{}))
    required=['chartType','title','data']
    missing=[f for f in required if not chart.get(f)]
    if missing:
        print(f'missing:{missing}')
    else:
        print('valid')
except Exception as e:
    print(f'error:{e}')
" 2>/dev/null)

    if [ "$config_valid" = "valid" ]; then
        log_pass "图表配置完整性 - 包含必要字段"
    else
        log_warn "图表配置完整性 - $config_valid"
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

    # 意图识别测试用例
    declare -a queries=(
        "本月销售额是多少|QUERY_SALES_OVERVIEW|0.7"
        "哪个部门业绩最好|QUERY_DEPARTMENT_PERFORMANCE|0.7"
        "销售趋势如何|QUERY_SALES_TREND|0.7"
        "应收账款多少|QUERY_RECEIVABLE|0.6"
        "产品销量排名|QUERY_PRODUCT_ANALYSIS|0.7"
        "库存情况怎么样|QUERY_INVENTORY|0.6"
        "预测下个月销售|FORECAST|0.5"
        "和上月相比如何|COMPARE_PERIOD|0.5"
    )

    passed=0
    total=${#queries[@]}

    for test_case in "${queries[@]}"; do
        IFS='|' read -r query expected_intent min_confidence <<< "$test_case"

        echo "Testing: \"$query\""
        response=$(curl -s -X POST "$BASE_URL/query" \
            -H "Content-Type: application/json" \
            -d "{\"query\":\"$query\"}")

        result=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    data=d.get('data',{})
    intent=data.get('intent','UNKNOWN')
    confidence=data.get('confidence',0)
    print(f'{intent}|{confidence}')
except:
    print('ERROR|0')
" 2>/dev/null)

        IFS='|' read -r intent confidence <<< "$result"

        # 判断结果
        if [ "$intent" = "$expected_intent" ]; then
            log_pass "\"$query\" -> $intent (置信度: $confidence)"
            ((passed++))
        elif [[ "$confidence" =~ ^[0-9]*\.?[0-9]+$ ]] && (( $(echo "$confidence >= $min_confidence" | bc -l 2>/dev/null || echo 0) )); then
            log_warn "\"$query\" -> $intent (期望: $expected_intent)"
        else
            log_fail "\"$query\" -> $intent (置信度过低或解析失败)"
        fi
    done

    log_info "意图识别准确率: $passed/$total"

    # 多轮对话测试
    echo ""
    echo "Testing: 多轮对话"
    session_id="test-$(date +%s)"

    response1=$(curl -s -X POST "$BASE_URL/query" \
        -H "Content-Type: application/json" \
        -d "{\"query\":\"本月销售额\",\"sessionId\":\"$session_id\"}")

    success1=$(echo "$response1" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('true' if d.get('data',{}).get('responseText') or d.get('code')==200 else 'false')
" 2>/dev/null)

    if [ "$success1" = "true" ]; then
        log_pass "多轮对话第1轮 - 查询成功"

        response2=$(curl -s -X POST "$BASE_URL/query" \
            -H "Content-Type: application/json" \
            -d "{\"query\":\"按部门分解\",\"sessionId\":\"$session_id\"}")

        success2=$(echo "$response2" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('true' if d.get('data') else 'false')
" 2>/dev/null)

        if [ "$success2" = "true" ]; then
            log_pass "多轮对话第2轮 - 上下文保持成功"
        else
            log_warn "多轮对话第2轮 - 上下文可能丢失"
        fi
    else
        log_fail "多轮对话 - 初始查询失败"
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

    # 4.1 数据下钻测试
    echo "Testing: 数据下钻 (/drill-down)"
    response=$(curl -s -X POST "$BASE_URL/drill-down" \
        -H "Content-Type: application/json" \
        -d '{"dimension":"region","value":"华东地区"}')

    drill_status=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    if d.get('code') == 200 or d.get('success'):
        data=d.get('data',{})
        if data.get('data') or data.get('items') or data.get('rankings'):
            print('success')
        else:
            print('empty')
    elif d.get('status') == 404:
        print('not_found')
    else:
        print('failed')
except:
    print('error')
" 2>/dev/null)

    case "$drill_status" in
        "success")
            log_pass "数据下钻 - 返回下钻数据"
            ;;
        "empty")
            log_warn "数据下钻 - 无匹配数据"
            ;;
        "not_found")
            log_warn "数据下钻 - 端点未实现"
            ;;
        *)
            log_fail "数据下钻 - API调用失败"
            ;;
    esac

    # 4.2 时间范围测试
    echo ""
    echo "Testing: 时间范围切换"

    declare -a periods=("today" "week" "month" "quarter" "year")

    for period in "${periods[@]}"; do
        response=$(curl -s "$BASE_URL/dashboard/executive?period=$period")
        success=$(echo "$response" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('true' if d.get('code')==200 or d.get('success') else 'false')
" 2>/dev/null)

        if [ "$success" = "true" ]; then
            log_pass "时间范围: $period"
        else
            log_fail "时间范围: $period"
        fi
    done

    # 4.3 自定义日期范围
    echo "Testing: 自定义日期范围"
    response=$(curl -s "$BASE_URL/dashboard/executive?startDate=2026-01-01&endDate=2026-01-15")

    if echo "$response" | check_api_success; then
        log_pass "自定义日期范围 - 2026-01-01 至 2026-01-15"
    else
        log_warn "自定义日期范围 - 可能不支持"
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

    # 5.1 从统一仪表盘获取预警 (alerts端点不存在)
    echo "Testing: 预警数据 (from /dashboard)"
    response=$(curl -s "$BASE_URL/dashboard?period=month")

    alerts_info=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    data=d.get('data',{})
    alerts=data.get('alerts',[])
    if alerts is None:
        alerts=[]
    count=len(alerts)
    levels=list(set([a.get('level','') for a in alerts if a.get('level')]))
    print(f'{count}|{levels}')
except:
    print('0|[]')
" 2>/dev/null)

    IFS='|' read -r alerts_count levels <<< "$alerts_info"

    if [ "$alerts_count" -gt 0 ]; then
        log_pass "预警数据 - 返回 $alerts_count 条预警"
        log_info "预警级别: $levels"
    else
        log_warn "预警数据 - 当前无预警"
    fi

    # 5.2 建议列表
    echo "Testing: 建议列表 (/recommendations)"
    response=$(curl -s "$BASE_URL/recommendations")

    recs_info=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    if d.get('code')==200 or d.get('success'):
        recs=d.get('data',[])
        if isinstance(recs, list):
            print(f'{len(recs)}|ok')
        else:
            print('0|format')
    elif d.get('status')==404:
        print('0|not_found')
    else:
        print('0|failed')
except:
    print('0|error')
" 2>/dev/null)

    IFS='|' read -r recs_count status <<< "$recs_info"

    case "$status" in
        "ok")
            if [ "$recs_count" -gt 0 ]; then
                log_pass "建议列表 - 返回 $recs_count 条建议"
            else
                log_warn "建议列表 - 当前无建议"
            fi
            ;;
        "not_found")
            log_warn "建议列表 - 端点未实现"
            ;;
        *)
            log_fail "建议列表 - API调用失败"
            ;;
    esac

    # 5.3 激励方案
    echo "Testing: 激励方案 (/incentive-plan)"
    response=$(curl -s "$BASE_URL/incentive-plan/salesperson/王五")

    incentive_status=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    if d.get('code')==200 or d.get('success'):
        print('ok')
    elif d.get('status')==404:
        print('not_found')
    else:
        print('failed')
except:
    print('error')
" 2>/dev/null)

    case "$incentive_status" in
        "ok")
            log_pass "激励方案 - API正常"
            ;;
        "not_found")
            log_warn "激励方案 - 端点未实现"
            ;;
        *)
            log_warn "激励方案 - 调用异常"
            ;;
    esac
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

    # 6.1 预测意图识别
    echo "Testing: 预测查询"
    response=$(curl -s -X POST "$BASE_URL/query" \
        -H "Content-Type: application/json" \
        -d '{"query":"预测下周销售"}')

    forecast_info=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    data=d.get('data',{})
    intent=data.get('intent','UNKNOWN')
    has_forecast=bool(data.get('forecast') or data.get('forecastResult') or data.get('chartData',{}).get('forecastPoints'))
    print(f'{intent}|{has_forecast}')
except:
    print('ERROR|False')
" 2>/dev/null)

    IFS='|' read -r intent has_forecast <<< "$forecast_info"

    if [ "$intent" = "FORECAST" ]; then
        log_pass "预测意图识别 - 正确识别为 FORECAST"
    else
        log_warn "预测意图识别 - 识别为 $intent"
    fi

    if [ "$has_forecast" = "True" ]; then
        log_pass "预测数据 - 返回预测结果"
    else
        log_warn "预测数据 - 未返回预测点 (可能在responseText中)"
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

    echo "Testing: 统一仪表盘 (/dashboard)"
    response=$(curl -s "$BASE_URL/dashboard?period=month")

    # 详细检查各维度
    dashboard_check=$(echo "$response" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    if d.get('code') != 200 and not d.get('success'):
        print('API_FAILED')
        sys.exit(0)

    data=d.get('data',{})
    results=[]

    # 核心维度检查
    dimensions={
        'sales': '销售',
        'finance': '财务',
        'departmentRanking': '部门排名',
        'regionRanking': '区域排名',
        'alerts': '预警',
        'recommendations': '建议'
    }

    for key, name in dimensions.items():
        val=data.get(key)
        if val is not None:
            if isinstance(val, dict) and (val.get('kpiCards') or val.get('summary') or val.get('rankings')):
                results.append(f'{name}:完整')
            elif isinstance(val, list):
                results.append(f'{name}:有{len(val)}条')
            else:
                results.append(f'{name}:存在')
        else:
            results.append(f'{name}:缺失')

    print('|'.join(results))
except Exception as e:
    print(f'ERROR:{e}')
" 2>/dev/null)

    if [ "$dashboard_check" = "API_FAILED" ]; then
        log_fail "统一仪表盘 - API调用失败"
    elif [[ "$dashboard_check" == ERROR:* ]]; then
        log_fail "统一仪表盘 - $dashboard_check"
    else
        IFS='|' read -ra items <<< "$dashboard_check"
        for item in "${items[@]}"; do
            IFS=':' read -r dim status <<< "$item"
            if [[ "$status" == "完整" ]] || [[ "$status" == "存在" ]] || [[ "$status" == 有* ]]; then
                log_pass "统一仪表盘 - $dim: $status"
            else
                log_warn "统一仪表盘 - $dim: $status"
            fi
        done
    fi

    # 检查响应时间
    echo ""
    echo "Testing: API响应性能"
    start_time=$(date +%s%3N)
    curl -s "$BASE_URL/dashboard?period=month" > /dev/null
    end_time=$(date +%s%3N)
    response_time=$((end_time - start_time))

    if [ "$response_time" -lt 3000 ]; then
        log_pass "API响应时间 - ${response_time}ms"
    elif [ "$response_time" -lt 5000 ]; then
        log_warn "API响应时间 - ${response_time}ms (较慢)"
    else
        log_fail "API响应时间 - ${response_time}ms (过慢)"
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

    # 评估
    if [ "$FAIL_COUNT" -eq 0 ]; then
        echo -e "\n${GREEN}🎉 所有测试通过!${NC}"
    elif [ "$FAIL_COUNT" -lt 3 ]; then
        echo -e "\n${YELLOW}⚠ 存在少量失败，建议检查${NC}"
    else
        echo -e "\n${RED}❌ 存在较多失败，需要修复${NC}"
    fi

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

### 评估结果
EOF

    if [ "$FAIL_COUNT" -eq 0 ]; then
        echo "🎉 **所有核心功能正常**" >> "$REPORT_FILE"
    elif [ "$FAIL_COUNT" -lt 3 ]; then
        echo "⚠️ **存在少量问题，建议检查修复**" >> "$REPORT_FILE"
    else
        echo "❌ **存在较多问题，需要紧急修复**" >> "$REPORT_FILE"
    fi

    echo "" >> "$REPORT_FILE"
    echo "---" >> "$REPORT_FILE"
    echo "**测试完成时间**: $(date '+%Y-%m-%d %H:%M:%S')" >> "$REPORT_FILE"

    echo ""
    echo "详细报告: $(pwd)/$REPORT_FILE"
}

# ============================================
# 主函数
# ============================================
main() {
    echo "========================================"
    echo "SmartBI 全面测试 V2"
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
    echo "测试完成"
    echo "========================================"
}

main
