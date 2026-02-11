#!/bin/bash

# ============================================================
# 创建测试所需的原材料批次数据
# 用途: 为Phase 2.1测试提供必要的业务数据
# ============================================================

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
API_URL="http://localhost:10010/api/mobile"
FACTORY_ID="CRETAS_2024_001"
USERNAME="proc_admin"
PASSWORD="123456"

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}创建测试所需的原材料批次数据${NC}"
echo -e "${BLUE}============================================================${NC}"

# ============================================================
# 前置准备: 登录获取Token
# ============================================================
echo -e "\n${YELLOW}步骤 1: 用户登录${NC}"

LOGIN_RESP=$(curl -s -X POST ${API_URL}/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")

ACCESS_TOKEN=$(echo $LOGIN_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('accessToken', ''))" 2>/dev/null || echo "")

if [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${RED}✗ 登录失败，无法获取Token${NC}"
    echo "响应: $LOGIN_RESP"
    exit 1
fi

echo -e "${GREEN}✓ 登录成功${NC}"
echo "Token: ${ACCESS_TOKEN:0:30}..."

# ============================================================
# 创建批次 MB-001 (AVAILABLE状态 - 用于消耗测试)
# ============================================================
echo -e "\n${YELLOW}步骤 2: 创建批次 MB-001 (AVAILABLE状态)${NC}"

BATCH_001_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/material-batches" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "batchNumber": "MB-001",
    "materialTypeId": "MT001",
    "supplierId": "80d9966a-0140-46bc-a098-b45bb6d0ee80",
    "receiptDate": "2025-11-20",
    "receiptQuantity": 500.0,
    "quantityUnit": "kg",
    "totalWeight": 500.0,
    "totalValue": 17500.0,
    "unitPrice": 35.0,
    "storageLocation": "A区仓库-1号位",
    "expireDate": "2025-12-20",
    "productionDate": "2025-11-19",
    "notes": "测试批次-可用于消耗"
  }')

BATCH_001_ID=$(echo $BATCH_001_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('id', ''))" 2>/dev/null || echo "")

if [ -z "$BATCH_001_ID" ]; then
    echo -e "${RED}✗ 创建批次MB-001失败${NC}"
    echo "响应: $BATCH_001_RESP"
else
    echo -e "${GREEN}✓ 批次MB-001创建成功${NC}"
    echo "ID: $BATCH_001_ID"
fi

# ============================================================
# 创建批次 MB-002 (AVAILABLE状态 - 用于预留/释放测试)
# ============================================================
echo -e "\n${YELLOW}步骤 3: 创建批次 MB-002 (AVAILABLE状态)${NC}"

BATCH_002_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/material-batches" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "batchNumber": "MB-002",
    "materialTypeId": "MT002",
    "supplierId": "20ca7b77-3eb1-41bb-bd59-8a303dedd322",
    "receiptDate": "2025-11-20",
    "receiptQuantity": 300.0,
    "quantityUnit": "kg",
    "totalWeight": 300.0,
    "totalValue": 8400.0,
    "unitPrice": 28.0,
    "storageLocation": "B区仓库-2号位",
    "expireDate": "2025-12-25",
    "productionDate": "2025-11-19",
    "notes": "测试批次-可用于预留"
  }')

BATCH_002_ID=$(echo $BATCH_002_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('id', ''))" 2>/dev/null || echo "")

if [ -z "$BATCH_002_ID" ]; then
    echo -e "${RED}✗ 创建批次MB-002失败${NC}"
    echo "响应: $BATCH_002_RESP"
else
    echo -e "${GREEN}✓ 批次MB-002创建成功${NC}"
    echo "ID: $BATCH_002_ID"
fi

# ============================================================
# 创建批次 MB-003 (FRESH状态 - 用于冷冻转换测试)
# ============================================================
echo -e "\n${YELLOW}步骤 4: 创建批次 MB-003 (FRESH状态 - 用于冷冻转换)${NC}"

BATCH_003_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/material-batches" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "batchNumber": "MB-003",
    "materialTypeId": "MT001",
    "supplierId": "80d9966a-0140-46bc-a098-b45bb6d0ee80",
    "receiptDate": "2025-11-20",
    "receiptQuantity": 200.0,
    "quantityUnit": "kg",
    "totalWeight": 200.0,
    "totalValue": 7000.0,
    "unitPrice": 35.0,
    "storageLocation": "C区冷藏室-1号位",
    "expireDate": "2025-11-23",
    "productionDate": "2025-11-20",
    "notes": "测试批次-鲜品待冷冻"
  }')

BATCH_003_ID=$(echo $BATCH_003_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('id', ''))" 2>/dev/null || echo "")

if [ -z "$BATCH_003_ID" ]; then
    echo -e "${RED}✗ 创建批次MB-003失败${NC}"
    echo "响应: $BATCH_003_RESP"
else
    echo -e "${GREEN}✓ 批次MB-003创建成功${NC}"
    echo "ID: $BATCH_003_ID"

    # 将MB-003状态改为FRESH (使用UUID ID而非batch_number)
    echo -e "${YELLOW}  设置MB-003状态为FRESH...${NC}"
    STATUS_RESP=$(curl -s -X PUT "${API_URL}/${FACTORY_ID}/material-batches/${BATCH_003_ID}/status" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{
        "status": "FRESH",
        "notes": "设置为鲜品状态，准备冷冻转换测试"
      }')

    STATUS_SUCCESS=$(echo $STATUS_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))" 2>/dev/null || echo "False")

    if [ "$STATUS_SUCCESS" = "True" ]; then
        echo -e "${GREEN}  ✓ MB-003状态已设置为FRESH${NC}"
    else
        echo -e "${RED}  ✗ 设置MB-003状态失败${NC}"
        echo "  响应: $STATUS_RESP"
    fi
fi

# ============================================================
# 创建批次 MB-009 (FROZEN状态 - 用于解冻测试)
# ============================================================
echo -e "\n${YELLOW}步骤 5: 创建批次 MB-009 (FROZEN状态 - 用于解冻测试)${NC}"

BATCH_009_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/material-batches" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "batchNumber": "MB-009",
    "materialTypeId": "MT001",
    "supplierId": "80d9966a-0140-46bc-a098-b45bb6d0ee80",
    "receiptDate": "2025-11-15",
    "receiptQuantity": 150.0,
    "quantityUnit": "kg",
    "totalWeight": 150.0,
    "totalValue": 5250.0,
    "unitPrice": 35.0,
    "storageLocation": "D区冷冻室-3号位",
    "expireDate": "2026-11-15",
    "productionDate": "2025-11-14",
    "notes": "测试批次-冻品待解冻"
  }')

BATCH_009_ID=$(echo $BATCH_009_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('id', ''))" 2>/dev/null || echo "")

if [ -z "$BATCH_009_ID" ]; then
    echo -e "${RED}✗ 创建批次MB-009失败${NC}"
    echo "响应: $BATCH_009_RESP"
else
    echo -e "${GREEN}✓ 批次MB-009创建成功${NC}"
    echo "ID: $BATCH_009_ID"

    # 先设置为FRESH (使用UUID ID而非batch_number)
    echo -e "${YELLOW}  设置MB-009状态为FRESH...${NC}"
    STATUS_RESP1=$(curl -s -X PUT "${API_URL}/${FACTORY_ID}/material-batches/${BATCH_009_ID}/status" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{
        "status": "FRESH",
        "notes": "临时设为鲜品"
      }')

    # 然后冷冻转换 (使用UUID ID而非batch_number)
    echo -e "${YELLOW}  执行冷冻转换...${NC}"
    FREEZE_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/material-batches/${BATCH_009_ID}/convert-to-frozen" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{
        "convertedBy": 1,
        "convertedDate": "2025-11-15",
        "storageLocation": "D区冷冻室-3号位",
        "notes": "提前冷冻保存"
      }')

    FREEZE_SUCCESS=$(echo $FREEZE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))" 2>/dev/null || echo "False")

    if [ "$FREEZE_SUCCESS" = "True" ]; then
        echo -e "${GREEN}  ✓ MB-009已转为FROZEN状态${NC}"
    else
        echo -e "${RED}  ✗ 冷冻转换失败${NC}"
        echo "  响应: $FREEZE_RESP"
    fi
fi

# ============================================================
# 总结
# ============================================================
echo -e "\n${BLUE}============================================================${NC}"
echo -e "${BLUE}批次数据创建完成总结${NC}"
echo -e "${BLUE}============================================================${NC}"

echo -e "\n${GREEN}✓ MB-001${NC} - AVAILABLE状态 (用于消耗测试)"
echo -e "${GREEN}✓ MB-002${NC} - AVAILABLE状态 (用于预留/释放测试)"
echo -e "${GREEN}✓ MB-003${NC} - FRESH状态 (用于冷冻转换测试)"
echo -e "${GREEN}✓ MB-009${NC} - FROZEN状态 (用于解冻测试)"

echo -e "\n${YELLOW}现在可以运行Phase 2.1测试脚本:${NC}"
echo -e "${BLUE}bash tests/api/test_phase2_1_material_batches.sh${NC}"

echo ""
