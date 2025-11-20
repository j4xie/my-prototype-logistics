#!/bin/bash

# ========================================
# ConversionRate管理模块 E2E测试脚本
# 总计15个API测试
# ========================================

BASE_URL="http://localhost:10010/api/mobile"
FACTORY_ID="CRETAS_2024_001"
API_PATH="${BASE_URL}/${FACTORY_ID}/conversions"

# 测试数据IDs
MATERIAL_ID_1="5750842d-52b3-491f-9aad-f8fbebb9317f"  # 鲈鱼
MATERIAL_ID_2="284ae94e-6d6c-457c-9e58-7c26198ce868"  # 带鱼
PRODUCT_ID_1="62de0ca0-24df-4f2d-a19b-12dc8ac9bb15"   # 鱼片
PRODUCT_ID_2="9273f37f-9a49-4bb8-8b4f-7a46848e27b6"   # 鱼头

echo "========================================"
echo "ConversionRate管理模块 - 15个API E2E测试"
echo "Base URL: ${API_PATH}"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# 测试计数器
TOTAL_TESTS=15
PASSED_TESTS=0
FAILED_TESTS=0

# 辅助函数：验证响应
validate_response() {
    local response=$1
    local test_name=$2
    local expected_code=${3:-200}

    echo "Response: ${response}"

    # 检查success字段
    local success=$(echo "$response" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))" 2>/dev/null)
    local code=$(echo "$response" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('code', 0))" 2>/dev/null)

    if [ "$success" = "True" ] && [ "$code" = "$expected_code" ]; then
        echo -e "${GREEN}✅ Test PASS: ${test_name}${NC}"
        ((PASSED_TESTS++))
        return 0
    else
        echo -e "${RED}❌ Test FAIL: ${test_name}${NC}"
        echo "Expected code: ${expected_code}, Got: ${code}"
        ((FAILED_TESTS++))
        return 1
    fi
}

# ========================================
# Test 1/15: 创建转化率配置
# ========================================
echo "Test 1/15: 创建转化率配置"
echo "POST ${API_PATH}"

RESPONSE=$(curl -s -X POST "${API_PATH}" \
  -H "Content-Type: application/json" \
  -d '{
    "materialTypeId": "'"${MATERIAL_ID_1}"'",
    "productTypeId": "'"${PRODUCT_ID_2}"'",
    "conversionRate": 55.5,
    "wastageRate": 4.5,
    "notes": "鲈鱼→鱼头转换率测试"
  }')

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

# 提取转化率ID
CONVERSION_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('id', ''))")
echo "Created Conversion ID: ${CONVERSION_ID}"

validate_response "$RESPONSE" "POST - 创建转化率" 201
echo ""

# ========================================
# Test 2/15: 获取转化率列表（分页）
# ========================================
echo "Test 2/15: 获取转化率列表（分页）"
echo "GET ${API_PATH}?page=0&size=10"

RESPONSE=$(curl -s -X GET "${API_PATH}?page=0&size=10")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "GET - 获取转化率列表"
echo ""

# ========================================
# Test 3/15: 获取转化率详情
# ========================================
echo "Test 3/15: 获取转化率详情"
echo "GET ${API_PATH}/${CONVERSION_ID}"

RESPONSE=$(curl -s -X GET "${API_PATH}/${CONVERSION_ID}")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "GET - 获取转化率详情"
echo ""

# ========================================
# Test 4/15: 更新转化率配置
# ========================================
echo "Test 4/15: 更新转化率配置"
echo "PUT ${API_PATH}/${CONVERSION_ID}"

RESPONSE=$(curl -s -X PUT "${API_PATH}/${CONVERSION_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "conversionRate": 60.0,
    "wastageRate": 3.5,
    "notes": "鲈鱼→鱼头转换率（已更新）"
  }')

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "PUT - 更新转化率"
echo ""

# ========================================
# Test 5/15: 按原材料类型查询转化率
# ========================================
echo "Test 5/15: 按原材料类型查询转化率"
echo "GET ${API_PATH}/material/${MATERIAL_ID_1}"

RESPONSE=$(curl -s -X GET "${API_PATH}/material/${MATERIAL_ID_1}")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "GET - 按原材料查询"
echo ""

# ========================================
# Test 6/15: 按产品类型查询转化率
# ========================================
echo "Test 6/15: 按产品类型查询转化率"
echo "GET ${API_PATH}/product/${PRODUCT_ID_1}"

RESPONSE=$(curl -s -X GET "${API_PATH}/product/${PRODUCT_ID_1}")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "GET - 按产品查询"
echo ""

# ========================================
# Test 7/15: 获取特定转化率
# ========================================
echo "Test 7/15: 获取特定原材料和产品的转化率"
echo "GET ${API_PATH}/rate?materialTypeId=${MATERIAL_ID_1}&productTypeId=${PRODUCT_ID_1}"

RESPONSE=$(curl -s -X GET "${API_PATH}/rate?materialTypeId=${MATERIAL_ID_1}&productTypeId=${PRODUCT_ID_1}")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "GET - 获取特定转化率"
echo ""

# ========================================
# Test 8/15: 计算原材料需求量
# ========================================
echo "Test 8/15: 计算原材料需求量"
echo "POST ${API_PATH}/calculate/material-requirement"

RESPONSE=$(curl -s -X POST "${API_PATH}/calculate/material-requirement" \
  -H "Content-Type: application/json" \
  -d '{
    "productTypeId": "'"${PRODUCT_ID_1}"'",
    "productQuantity": 100
  }')

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "POST - 计算原材料需求量"
echo ""

# ========================================
# Test 9/15: 计算产品产出量
# ========================================
echo "Test 9/15: 计算产品产出量"
echo "POST ${API_PATH}/calculate/product-output"

RESPONSE=$(curl -s -X POST "${API_PATH}/calculate/product-output" \
  -H "Content-Type: application/json" \
  -d '{
    "materialTypeId": "'"${MATERIAL_ID_1}"'",
    "materialQuantity": 100
  }')

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "POST - 计算产品产出量"
echo ""

# ========================================
# Test 10/15: 验证转化率配置
# ========================================
echo "Test 10/15: 验证转化率配置"
echo "POST ${API_PATH}/validate"

RESPONSE=$(curl -s -X POST "${API_PATH}/validate" \
  -H "Content-Type: application/json" \
  -d '{
    "conversionRate": 65.0,
    "wastageRate": 5.0
  }')

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

# 验证isValid字段
IS_VALID=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('isValid', False))")
if [ "$IS_VALID" = "True" ]; then
    echo -e "${GREEN}✅ Test 10/15 PASS: 验证通过${NC}"
    ((PASSED_TESTS++))
else
    echo -e "${RED}❌ Test 10/15 FAIL: 验证失败${NC}"
    ((FAILED_TESTS++))
fi
echo ""

# ========================================
# Test 11/15: 创建第二个转化率（用于批量操作）
# ========================================
echo "Test 11/15: 创建第二个转化率配置"
echo "POST ${API_PATH}"

RESPONSE=$(curl -s -X POST "${API_PATH}" \
  -H "Content-Type: application/json" \
  -d '{
    "materialTypeId": "'"${MATERIAL_ID_2}"'",
    "productTypeId": "'"${PRODUCT_ID_1}"'",
    "conversionRate": 50.0,
    "wastageRate": 6.0,
    "notes": "带鱼→鱼片转换率测试"
  }')

CONVERSION_ID_2=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('id', ''))")
echo "Created Conversion ID 2: ${CONVERSION_ID_2}"

validate_response "$RESPONSE" "POST - 创建第二个转化率" 201
echo ""

# ========================================
# Test 12/15: 批量激活/停用转化率
# ========================================
echo "Test 12/15: 批量激活/停用转化率"
echo "PUT ${API_PATH}/batch/activate"

RESPONSE=$(curl -s -X PUT "${API_PATH}/batch/activate" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["'"${CONVERSION_ID}"'", "'"${CONVERSION_ID_2}"'"],
    "isActive": false
  }')

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

# 验证批量操作结果
SUCCESS_COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('success', 0))")
if [ "$SUCCESS_COUNT" -eq 2 ]; then
    echo -e "${GREEN}✅ Test 12/15 PASS: 批量停用成功 (成功: ${SUCCESS_COUNT})${NC}"
    ((PASSED_TESTS++))
else
    echo -e "${RED}❌ Test 12/15 FAIL: 批量操作失败 (成功: ${SUCCESS_COUNT})${NC}"
    ((FAILED_TESTS++))
fi
echo ""

# ========================================
# Test 13/15: 获取统计信息
# ========================================
echo "Test 13/15: 获取转化率统计信息"
echo "GET ${API_PATH}/statistics"

RESPONSE=$(curl -s -X GET "${API_PATH}/statistics")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "GET - 获取统计信息"
echo ""

# ========================================
# Test 14/15: 导出转化率列表
# ========================================
echo "Test 14/15: 导出转化率列表"
echo "GET ${API_PATH}/export"

RESPONSE=$(curl -s -X GET "${API_PATH}/export")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "GET - 导出转化率"
echo ""

# ========================================
# Test 15/15: 批量导入（简化测试）
# ========================================
echo "Test 15/15: 批量导入转化率"
echo "POST ${API_PATH}/import"

RESPONSE=$(curl -s -X POST "${API_PATH}/import")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "POST - 批量导入"
echo ""

# ========================================
# 清理测试数据
# ========================================
echo "清理测试数据..."

# 删除测试创建的转化率
if [ -n "$CONVERSION_ID" ]; then
    curl -s -X DELETE "${API_PATH}/${CONVERSION_ID}" > /dev/null
    echo "已删除转化率: ${CONVERSION_ID}"
fi

if [ -n "$CONVERSION_ID_2" ]; then
    curl -s -X DELETE "${API_PATH}/${CONVERSION_ID_2}" > /dev/null
    echo "已删除转化率: ${CONVERSION_ID_2}"
fi
echo ""

# ========================================
# 测试总结
# ========================================
echo "========================================"
echo "测试总结"
echo "========================================"
echo "总测试数: ${TOTAL_TESTS}"
echo -e "${GREEN}通过: ${PASSED_TESTS}${NC}"
echo -e "${RED}失败: ${FAILED_TESTS}${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过！ConversionRate模块功能完整！${NC}"
    exit 0
else
    echo -e "${RED}❌ 有 ${FAILED_TESTS} 个测试失败${NC}"
    exit 1
fi
