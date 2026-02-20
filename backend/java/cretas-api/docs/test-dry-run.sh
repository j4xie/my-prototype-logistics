#!/bin/bash

# 规则引擎 Dry-Run API 测试脚本
# 用法: ./test-dry-run.sh [test_number]

BASE_URL="http://47.100.235.168:10010"
FACTORY_ID="F001"
ACCESS_TOKEN=""  # 需要先登录获取 token

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 jq 是否安装
if ! command -v jq &> /dev/null; then
    echo -e "${RED}错误: 需要安装 jq 命令${NC}"
    echo "macOS: brew install jq"
    echo "Ubuntu: sudo apt-get install jq"
    exit 1
fi

# 登录获取 token
login() {
    echo -e "${YELLOW}正在登录...${NC}"

    RESPONSE=$(curl -s -X POST "${BASE_URL}/api/mobile/auth/login" \
        -H "Content-Type: application/json" \
        -d '{
            "username": "admin",
            "password": "Admin@123456"
        }')

    ACCESS_TOKEN=$(echo $RESPONSE | jq -r '.data.accessToken')

    if [ "$ACCESS_TOKEN" == "null" ] || [ -z "$ACCESS_TOKEN" ]; then
        echo -e "${RED}登录失败${NC}"
        echo $RESPONSE | jq '.'
        exit 1
    fi

    echo -e "${GREEN}登录成功，Token: ${ACCESS_TOKEN:0:20}...${NC}"
}

# 测试 1: 简单验证规则 - 数量检查
test_quantity_validation() {
    echo -e "\n${YELLOW}=== 测试 1: 数量验证规则 ===${NC}"

    curl -s -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/rules/dry-run" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -d '{
            "ruleContent": "package com.cretas.aims.rules;\n\nimport java.util.Map;\nimport java.util.HashMap;\nimport java.util.List;\nimport java.util.ArrayList;\n\nglobal List results;\nglobal Map simulatedChanges;\n\nrule \"Validate Material Batch Quantity\"\n  salience 100\n  when\n    $data : Map(this[\"quantity\"] != null, this[\"quantity\"] instanceof Number)\n    eval(((Number) $data.get(\"quantity\")).doubleValue() <= 0)\n  then\n    Map result = new HashMap();\n    result.put(\"result\", \"DENY\");\n    result.put(\"message\", \"数量必须大于 0\");\n    results.add(result);\nend",
            "entityType": "MATERIAL_BATCH",
            "hookPoint": "beforeCreate",
            "testData": {
                "quantity": -5,
                "materialType": "面粉",
                "supplierId": "S001"
            }
        }' | jq '.'
}

# 测试 2: 自动计算规则 - 保质期计算
test_expiry_calculation() {
    echo -e "\n${YELLOW}=== 测试 2: 保质期自动计算规则 ===${NC}"

    curl -s -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/rules/dry-run" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -d '{
            "ruleContent": "package com.cretas.aims.rules;\n\nimport java.util.Map;\nimport java.util.HashMap;\nimport java.util.List;\nimport java.util.ArrayList;\nimport java.time.LocalDate;\n\nglobal List results;\nglobal Map simulatedChanges;\n\nrule \"Calculate Expiry Date\"\n  salience 100\n  when\n    $data : Map(this[\"productionDate\"] != null, this[\"shelfLifeDays\"] != null)\n  then\n    String productionDateStr = (String) $data.get(\"productionDate\");\n    Integer shelfLifeDays = ((Number) $data.get(\"shelfLifeDays\")).intValue();\n    \n    LocalDate productionDate = LocalDate.parse(productionDateStr);\n    LocalDate expiryDate = productionDate.plusDays(shelfLifeDays);\n    \n    simulatedChanges.put(\"expiryDate\", expiryDate.toString());\n    simulatedChanges.put(\"calculationMethod\", \"productionDate + shelfLifeDays\");\n    \n    Map result = new HashMap();\n    result.put(\"result\", \"ALLOW\");\n    result.put(\"message\", \"保质期已自动计算: \" + expiryDate);\n    results.add(result);\nend",
            "entityType": "MATERIAL_BATCH",
            "hookPoint": "beforeCreate",
            "testData": {
                "productionDate": "2025-01-01",
                "shelfLifeDays": 30,
                "materialType": "鸡蛋"
            }
        }' | jq '.'
}

# 测试 3: 语法错误测试
test_syntax_error() {
    echo -e "\n${YELLOW}=== 测试 3: 语法错误检测 ===${NC}"

    curl -s -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/rules/dry-run" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -d '{
            "ruleContent": "package com.cretas.aims.rules;\n\nrule \"Invalid Rule\"\n  when\n    $data : Map(\n  then\n    // 语法错误：when 部分未闭合\nend",
            "entityType": "MATERIAL_BATCH",
            "testData": {}
        }' | jq '.'
}

# 测试 4: 多条件验证
test_quality_check() {
    echo -e "\n${YELLOW}=== 测试 4: 质检完整性验证 ===${NC}"

    curl -s -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/rules/dry-run" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -d '{
            "ruleContent": "package com.cretas.aims.rules;\n\nimport java.util.Map;\nimport java.util.HashMap;\nimport java.util.List;\nimport java.util.ArrayList;\n\nglobal List results;\nglobal Map simulatedChanges;\n\nrule \"Validate Quality Check Completeness\"\n  salience 100\n  when\n    $data : Map()\n    eval(\n      $data.get(\"sampleSize\") == null ||\n      $data.get(\"inspector\") == null ||\n      $data.get(\"inspectionDate\") == null\n    )\n  then\n    Map result = new HashMap();\n    result.put(\"result\", \"BLOCK\");\n    result.put(\"block\", true);\n    \n    List missingFields = new ArrayList();\n    if ($data.get(\"sampleSize\") == null) missingFields.add(\"sampleSize\");\n    if ($data.get(\"inspector\") == null) missingFields.add(\"inspector\");\n    if ($data.get(\"inspectionDate\") == null) missingFields.add(\"inspectionDate\");\n    \n    result.put(\"message\", \"质检记录不完整，缺少字段: \" + missingFields);\n    result.put(\"missingFields\", missingFields);\n    results.add(result);\nend",
            "entityType": "QUALITY_INSPECTION",
            "hookPoint": "beforeSubmit",
            "testData": {
                "sampleSize": 10,
                "inspectionDate": "2025-01-15"
            }
        }' | jq '.'
}

# 测试 5: 价格计算
test_cost_calculation() {
    echo -e "\n${YELLOW}=== 测试 5: 批次成本计算 ===${NC}"

    curl -s -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/rules/dry-run" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -d '{
            "ruleContent": "package com.cretas.aims.rules;\n\nimport java.util.Map;\nimport java.util.HashMap;\nimport java.util.List;\nimport java.util.ArrayList;\n\nglobal List results;\nglobal Map simulatedChanges;\n\nrule \"Calculate Batch Cost\"\n  salience 100\n  when\n    $data : Map(\n      this[\"quantity\"] != null,\n      this[\"unitPrice\"] != null\n    )\n  then\n    double quantity = ((Number) $data.get(\"quantity\")).doubleValue();\n    double unitPrice = ((Number) $data.get(\"unitPrice\")).doubleValue();\n    \n    double totalCost = quantity * unitPrice;\n    double tax = totalCost * 0.13;\n    double finalCost = totalCost + tax;\n    \n    simulatedChanges.put(\"totalCost\", totalCost);\n    simulatedChanges.put(\"tax\", tax);\n    simulatedChanges.put(\"finalCost\", finalCost);\n    \n    Map result = new HashMap();\n    result.put(\"result\", \"ALLOW\");\n    result.put(\"message\", \"批次成本已计算\");\n    result.put(\"totalCost\", totalCost);\n    result.put(\"tax\", tax);\n    result.put(\"finalCost\", finalCost);\n    results.add(result);\nend",
            "entityType": "MATERIAL_BATCH",
            "hookPoint": "beforeCreate",
            "testData": {
                "quantity": 100,
                "unitPrice": 50.0,
                "materialType": "小麦"
            }
        }' | jq '.'
}

# 主函数
main() {
    # 登录获取 token
    login

    # 根据参数执行测试
    case "$1" in
        1)
            test_quantity_validation
            ;;
        2)
            test_expiry_calculation
            ;;
        3)
            test_syntax_error
            ;;
        4)
            test_quality_check
            ;;
        5)
            test_cost_calculation
            ;;
        *)
            # 执行所有测试
            test_quantity_validation
            test_expiry_calculation
            test_syntax_error
            test_quality_check
            test_cost_calculation
            ;;
    esac

    echo -e "\n${GREEN}测试完成${NC}"
}

# 运行主函数
main "$@"
