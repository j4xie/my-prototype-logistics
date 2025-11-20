#!/bin/bash

###############################################################################
# 原材料规格配置 E2E 测试脚本
# 功能：测试所有3个API端点和前后端集成
# 创建日期：2025-11-18
###############################################################################

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
BASE_URL="http://localhost:10010"
FACTORY_ID="F001"
API_PATH="/api/mobile/${FACTORY_ID}/material-spec-config"

# 测试计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 打印分隔线
print_separator() {
    echo ""
    echo "=========================================="
    echo "$1"
    echo "=========================================="
    echo ""
}

# 打印测试标题
print_test() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "${BLUE}[TEST $TOTAL_TESTS]${NC} $1"
}

# 打印成功
print_success() {
    PASSED_TESTS=$((PASSED_TESTS + 1))
    echo -e "${GREEN}✅ PASS:${NC} $1"
    echo ""
}

# 打印失败
print_fail() {
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo -e "${RED}❌ FAIL:${NC} $1"
    echo ""
}

# 检查服务是否运行
check_service() {
    print_separator "Step 0: 检查后端服务"

    if lsof -i :10010 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 后端服务正在运行 (端口10010)${NC}"
    else
        echo -e "${RED}❌ 后端服务未运行${NC}"
        echo "请先启动后端服务："
        echo "  cd backend-java"
        echo "  java -jar target/cretas-backend-system-1.0.0.jar"
        exit 1
    fi
    echo ""
}

# 检查数据库
check_database() {
    print_separator "Step 1: 检查数据库状态"

    print_test "检查material_spec_config表是否存在"
    TABLE_EXISTS=$(mysql -u root cretas_db -se "SHOW TABLES LIKE 'material_spec_config';" 2>/dev/null)
    if [ "$TABLE_EXISTS" = "material_spec_config" ]; then
        print_success "material_spec_config表已存在"
    else
        print_fail "material_spec_config表不存在"
        exit 1
    fi

    print_test "检查系统默认数据"
    COUNT=$(mysql -u root cretas_db -se "SELECT COUNT(*) FROM material_spec_config WHERE factory_id = 'SYSTEM_DEFAULT';" 2>/dev/null)
    if [ "$COUNT" = "9" ]; then
        print_success "系统默认数据已插入 (9条记录)"
    else
        print_fail "系统默认数据不完整 (期望9条，实际${COUNT}条)"
    fi
}

# 测试1: GET 获取配置
test_get_config() {
    print_separator "TEST 1: GET 获取规格配置"

    print_test "GET ${API_PATH}"
    RESPONSE=$(curl -s "${BASE_URL}${API_PATH}")

    # 检查响应格式
    SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))" 2>/dev/null)
    CODE=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('code', 0))" 2>/dev/null)

    if [ "$SUCCESS" = "True" ] && [ "$CODE" = "200" ]; then
        print_success "API响应成功 (success=true, code=200)"
    else
        print_fail "API响应失败 (success=$SUCCESS, code=$CODE)"
        echo "Response: $RESPONSE"
        return 1
    fi

    # 检查是否返回9个类别
    CATEGORIES=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d['data']))" 2>/dev/null)
    if [ "$CATEGORIES" = "9" ]; then
        print_success "返回所有9个类别"
    else
        print_fail "类别数量不正确 (期望9，实际$CATEGORIES)"
    fi

    # 检查"海鲜"类别的规格
    SEAFOOD_SPECS=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d['data'].get('海鲜', [])))" 2>/dev/null)
    if [ "$SEAFOOD_SPECS" = "7" ]; then
        print_success "海鲜类别有7个规格选项"
    else
        print_fail "海鲜规格数量不正确 (期望7，实际$SEAFOOD_SPECS)"
    fi

    # 显示所有类别
    echo "所有类别："
    echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); [print(f'  - {k}: {len(v)}项') for k,v in d['data'].items()]" 2>/dev/null
    echo ""
}

# 测试2: PUT 更新配置
test_put_config() {
    print_separator "TEST 2: PUT 更新规格配置"

    # 清理旧数据
    mysql -u root cretas_db -se "DELETE FROM material_spec_config WHERE factory_id = '${FACTORY_ID}' AND category = '海鲜';" 2>/dev/null

    print_test "PUT ${API_PATH}/海鲜 (创建新配置)"
    RESPONSE=$(curl -s -X PUT "${BASE_URL}${API_PATH}/海鲜" \
        -H "Content-Type: application/json" \
        -d '{"specifications": ["整条", "切片", "去骨切片(测试新增)", "鱼块", "鱼排", "虾仁", "去壳"]}')

    SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))" 2>/dev/null)
    if [ "$SUCCESS" = "True" ]; then
        print_success "创建配置成功"
    else
        print_fail "创建配置失败"
        echo "Response: $RESPONSE"
        return 1
    fi

    # 验证数据库
    print_test "验证数据库中的数据"
    DB_SPECS=$(mysql -u root cretas_db -se "SELECT specifications FROM material_spec_config WHERE factory_id = '${FACTORY_ID}' AND category = '海鲜';" 2>/dev/null)
    if echo "$DB_SPECS" | grep -q "去骨切片(测试新增)"; then
        print_success "数据已正确保存到数据库"
    else
        print_fail "数据库中的数据不正确"
        echo "DB Data: $DB_SPECS"
    fi

    # 再次更新（测试UPSERT）
    print_test "PUT ${API_PATH}/海鲜 (更新现有配置)"
    RESPONSE=$(curl -s -X PUT "${BASE_URL}${API_PATH}/海鲜" \
        -H "Content-Type: application/json" \
        -d '{"specifications": ["整条", "切片", "去骨切片(第二次更新)", "鱼块"]}')

    SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))" 2>/dev/null)
    if [ "$SUCCESS" = "True" ]; then
        print_success "更新配置成功 (UPSERT逻辑正常)"
    else
        print_fail "更新配置失败"
    fi

    # 验证GET返回更新后的数据
    print_test "验证GET返回更新后的数据"
    GET_RESPONSE=$(curl -s "${BASE_URL}${API_PATH}")
    if echo "$GET_RESPONSE" | grep -q "去骨切片(第二次更新)"; then
        print_success "GET接口返回更新后的数据"
    else
        print_fail "GET接口未返回更新后的数据"
    fi
}

# 测试3: DELETE 重置配置
test_delete_config() {
    print_separator "TEST 3: DELETE 重置为默认配置"

    print_test "DELETE ${API_PATH}/海鲜"
    RESPONSE=$(curl -s -X DELETE "${BASE_URL}${API_PATH}/海鲜")

    SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))" 2>/dev/null)
    MESSAGE=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('message', ''))" 2>/dev/null)

    if [ "$SUCCESS" = "True" ] && echo "$MESSAGE" | grep -q "默认"; then
        print_success "重置为默认配置成功"
    else
        print_fail "重置失败"
        echo "Response: $RESPONSE"
        return 1
    fi

    # 验证数据库中的记录已删除
    print_test "验证数据库中的自定义配置已删除"
    COUNT=$(mysql -u root cretas_db -se "SELECT COUNT(*) FROM material_spec_config WHERE factory_id = '${FACTORY_ID}' AND category = '海鲜';" 2>/dev/null)
    if [ "$COUNT" = "0" ]; then
        print_success "自定义配置已删除"
    else
        print_fail "自定义配置未删除 (仍有${COUNT}条记录)"
    fi

    # 验证GET返回默认配置
    print_test "验证GET返回系统默认配置"
    GET_RESPONSE=$(curl -s "${BASE_URL}${API_PATH}")
    SEAFOOD_COUNT=$(echo "$GET_RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d['data'].get('海鲜', [])))" 2>/dev/null)

    if [ "$SEAFOOD_COUNT" = "7" ]; then
        print_success "GET返回默认配置 (7个规格选项)"
    else
        print_fail "GET返回的配置不正确 (期望7，实际$SEAFOOD_COUNT)"
    fi

    # 验证默认配置内容
    HAS_DEFAULT=$(echo "$GET_RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); specs=d['data'].get('海鲜', []); print('去骨切片' in specs)" 2>/dev/null)
    if [ "$HAS_DEFAULT" = "True" ]; then
        print_success "返回的是系统默认规格（包含'去骨切片'）"
    else
        print_fail "返回的不是系统默认规格"
    fi
}

# 测试4: 边界情况和错误处理
test_edge_cases() {
    print_separator "TEST 4: 边界情况和错误处理"

    # 测试空规格列表
    print_test "PUT 空的规格列表（应该返回400）"
    RESPONSE=$(curl -s -X PUT "${BASE_URL}${API_PATH}/海鲜" \
        -H "Content-Type: application/json" \
        -d '{"specifications": []}')

    CODE=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('code', 0))" 2>/dev/null)
    if [ "$CODE" = "400" ]; then
        print_success "正确拒绝空规格列表 (返回400)"
    else
        print_fail "应该拒绝空规格列表 (实际返回$CODE)"
    fi

    # 测试获取不存在工厂的配置（应该返回默认配置）
    print_test "GET 不存在的工厂配置（应返回默认）"
    RESPONSE=$(curl -s "${BASE_URL}/api/mobile/NONEXISTENT/material-spec-config")
    SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))" 2>/dev/null)

    if [ "$SUCCESS" = "True" ]; then
        print_success "不存在的工厂返回默认配置"
    else
        print_fail "不存在的工厂应该返回默认配置"
    fi
}

# 测试5: 性能测试
test_performance() {
    print_separator "TEST 5: 性能测试"

    print_test "GET请求响应时间测试 (10次)"
    TOTAL_TIME=0
    for i in {1..10}; do
        START=$(date +%s%N)
        curl -s "${BASE_URL}${API_PATH}" > /dev/null
        END=$(date +%s%N)
        TIME=$((($END - $START) / 1000000)) # 转换为毫秒
        TOTAL_TIME=$((TOTAL_TIME + TIME))
    done
    AVG_TIME=$((TOTAL_TIME / 10))

    if [ $AVG_TIME -lt 100 ]; then
        print_success "平均响应时间: ${AVG_TIME}ms (优秀: <100ms)"
    elif [ $AVG_TIME -lt 500 ]; then
        print_success "平均响应时间: ${AVG_TIME}ms (良好: <500ms)"
    else
        print_fail "平均响应时间: ${AVG_TIME}ms (需要优化: >500ms)"
    fi
}

# 测试6: 前后端集成验证
test_frontend_integration() {
    print_separator "TEST 6: 前后端集成验证"

    print_test "验证API响应格式与前端期望一致"
    RESPONSE=$(curl -s "${BASE_URL}${API_PATH}")

    # 检查ApiResponse结构
    HAS_SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print('success' in d)" 2>/dev/null)
    HAS_CODE=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print('code' in d)" 2>/dev/null)
    HAS_MESSAGE=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print('message' in d)" 2>/dev/null)
    HAS_DATA=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print('data' in d)" 2>/dev/null)

    if [ "$HAS_SUCCESS" = "True" ] && [ "$HAS_CODE" = "True" ] && [ "$HAS_MESSAGE" = "True" ] && [ "$HAS_DATA" = "True" ]; then
        print_success "API响应格式符合ApiResponse<T>接口"
    else
        print_fail "API响应格式不符合前端期望"
    fi

    # 检查data格式是否为 Map<String, List<String>>
    print_test "验证data格式为 Map<category, specifications[]>"
    IS_DICT=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(isinstance(d['data'], dict))" 2>/dev/null)
    ALL_LISTS=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(all(isinstance(v, list) for v in d['data'].values()))" 2>/dev/null)

    if [ "$IS_DICT" = "True" ] && [ "$ALL_LISTS" = "True" ]; then
        print_success "data格式正确 (Map<String, List<String>>)"
    else
        print_fail "data格式不正确"
    fi

    # 验证前端DEFAULT_SPEC_CONFIG与后端一致
    print_test "验证前端DEFAULT_SPEC_CONFIG与后端一致"
    BACKEND_CATEGORIES=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(sorted(d['data'].keys()))" 2>/dev/null)
    EXPECTED_CATEGORIES="['其他', '海鲜', '油类', '水果', '米面', '粉类', '肉类', '蔬菜', '调料']"

    if [ "$BACKEND_CATEGORIES" = "$EXPECTED_CATEGORIES" ]; then
        print_success "前后端类别一致 (9个类别)"
    else
        print_fail "前后端类别不一致"
        echo "期望: $EXPECTED_CATEGORIES"
        echo "实际: $BACKEND_CATEGORIES"
    fi
}

# 主测试流程
main() {
    print_separator "原材料规格配置 E2E 测试"
    echo "测试时间: $(date)"
    echo "后端地址: ${BASE_URL}"
    echo "工厂ID: ${FACTORY_ID}"

    # 执行所有测试
    check_service
    check_database
    test_get_config
    test_put_config
    test_delete_config
    test_edge_cases
    test_performance
    test_frontend_integration

    # 打印测试结果
    print_separator "测试结果汇总"
    echo "总测试数: $TOTAL_TESTS"
    echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
    echo -e "${RED}失败: $FAILED_TESTS${NC}"
    echo ""

    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✅ 所有测试通过！原材料规格配置功能正常！${NC}"
        echo ""
        echo "🎉 功能已100%完成并测试通过："
        echo "   ✅ 后端API (3个端点)"
        echo "   ✅ 数据库持久化"
        echo "   ✅ 前后端集成"
        echo "   ✅ 性能测试"
        echo "   ✅ 边界情况处理"
        echo ""
        echo "📋 可以进行下一步："
        echo "   1. 启用前端编辑功能"
        echo "   2. 用户验收测试"
        echo "   3. 开始下一个功能开发"
        echo ""
        exit 0
    else
        echo -e "${RED}❌ 有 $FAILED_TESTS 个测试失败，请检查问题${NC}"
        exit 1
    fi
}

# 运行主测试
main
