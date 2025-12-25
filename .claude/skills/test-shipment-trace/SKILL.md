---
name: test-shipment-trace
description: 出货溯源模块自动化测试。测试出货记录创建、状态更新、溯源查询。使用此Skill验证出货和溯源系统的完整性。
allowed-tools:
  - Bash
  - Read
  - Grep
---

# 出货溯源测试 Skill

测试 Cretas 食品溯源系统的出货记录和溯源查询模块。

## 测试环境

- **服务地址**: localhost:10010
- **测试工厂**: F001

## 执行测试

运行以下命令执行完整的出货溯源测试：

```bash
echo "========================================"
echo "出货溯源模块 - 自动化测试报告"
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

echo "========== 出货记录测试 =========="
echo ""

# ========== 测试1: 获取出货记录列表 ==========
echo "[测试1] 获取出货记录列表"
echo "  请求: GET /api/mobile/F001/shipments"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/shipments" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回出货列表"
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

# ========== 测试2: 创建出货记录 ==========
echo "[测试2] 创建出货记录"
echo "  请求: POST /api/mobile/F001/shipments"

SHIP_NUM="SHIP-$(date +%s)"
RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/shipments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"shipmentNumber\": \"$SHIP_NUM\",
    \"customerId\": \"CUS001\",
    \"productName\": \"测试产品\",
    \"quantity\": 100,
    \"unit\": \"箱\",
    \"unitPrice\": 50.00,
    \"shipmentDate\": \"$(date +%Y-%m-%d)\",
    \"deliveryAddress\": \"北京市朝阳区测试地址\",
    \"logisticsCompany\": \"顺丰速运\",
    \"notes\": \"测试出货记录\"
  }")

if echo "$RESULT" | grep -q '"success":true\|"code":200'; then
  SHIP_ID=$(echo "$RESULT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -z "$SHIP_ID" ]; then
    SHIP_ID=$(echo "$RESULT" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
  fi
  echo "  期望: 创建成功"
  echo "  实际: 成功，单号=$SHIP_NUM ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 创建成功"
  echo "  实际: $(echo $RESULT | head -c 150)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
  SHIP_ID=""
fi
echo ""

# ========== 测试3: 获取出货记录详情 ==========
echo "[测试3] 获取出货记录详情"
if [ -n "$SHIP_ID" ]; then
  echo "  请求: GET /api/mobile/F001/shipments/$SHIP_ID"

  RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    "http://localhost:10010/api/mobile/F001/shipments/$SHIP_ID" \
    -H "Authorization: Bearer $TOKEN")
  HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

  if [ "$HTTP_CODE" = "200" ]; then
    echo "  期望: HTTP 200"
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
  echo "  跳过: 无可用出货ID"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试4: 更新出货状态(已发货) ==========
echo "[测试4] 更新出货状态(pending → shipped)"
if [ -n "$SHIP_ID" ]; then
  echo "  请求: PUT /api/mobile/F001/shipments/$SHIP_ID/status"

  RESULT=$(curl -s -X PUT "http://localhost:10010/api/mobile/F001/shipments/$SHIP_ID/status" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status": "shipped", "trackingNumber": "SF123456789"}')

  if echo "$RESULT" | grep -q '"success":true\|"code":200'; then
    echo "  期望: 状态变为shipped"
    echo "  实际: 成功 ✓"
    echo "  结果: ✅ PASS"
    PASS=$((PASS+1))
  else
    echo "  期望: 状态更新"
    echo "  实际: $(echo $RESULT | head -c 100)"
    echo "  结果: ❌ FAIL"
    FAIL=$((FAIL+1))
  fi
else
  echo "  跳过: 无可用出货ID"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试5: 更新出货状态(已送达) ==========
echo "[测试5] 更新出货状态(shipped → delivered)"
if [ -n "$SHIP_ID" ]; then
  echo "  请求: PUT /api/mobile/F001/shipments/$SHIP_ID/status"

  RESULT=$(curl -s -X PUT "http://localhost:10010/api/mobile/F001/shipments/$SHIP_ID/status" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status": "delivered"}')

  if echo "$RESULT" | grep -q '"success":true\|"code":200'; then
    echo "  期望: 状态变为delivered"
    echo "  实际: 成功 ✓"
    echo "  结果: ✅ PASS"
    PASS=$((PASS+1))
  else
    echo "  期望: 状态更新"
    echo "  实际: $(echo $RESULT | head -c 100)"
    echo "  结果: ❌ FAIL"
    FAIL=$((FAIL+1))
  fi
else
  echo "  跳过: 无可用出货ID"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试6: 按状态筛选出货记录 ==========
echo "[测试6] 按状态筛选出货记录"
echo "  请求: GET /api/mobile/F001/shipments?status=pending"

RESULT=$(curl -s "http://localhost:10010/api/mobile/F001/shipments?status=pending" \
  -H "Authorization: Bearer $TOKEN")

if echo "$RESULT" | grep -q '"success":true\|"code":200'; then
  echo "  期望: 返回pending状态记录"
  echo "  实际: 成功 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 返回列表"
  echo "  实际: $(echo $RESULT | head -c 100)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试7: 按日期范围查询 ==========
echo "[测试7] 按日期范围查询出货记录"

START_DATE=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d '7 days ago' +%Y-%m-%d)
END_DATE=$(date +%Y-%m-%d)
echo "  请求: GET /api/mobile/F001/shipments/date-range?startDate=$START_DATE&endDate=$END_DATE"

RESULT=$(curl -s "http://localhost:10010/api/mobile/F001/shipments/date-range?startDate=$START_DATE&endDate=$END_DATE" \
  -H "Authorization: Bearer $TOKEN")

if echo "$RESULT" | grep -q '"success":true\|"code":200'; then
  echo "  期望: 返回日期范围内记录"
  echo "  实际: 成功 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 返回列表"
  echo "  实际: $(echo $RESULT | head -c 100)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

echo "========== 溯源查询测试 =========="
echo ""

# ========== 测试8: 溯源查询(按批次号) ==========
echo "[测试8] 溯源查询(按生产批次号)"
echo "  请求: GET /api/mobile/F001/traceability/batch/PB001"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/traceability/batch/PB001" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回溯源信息"
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

# ========== 测试9: 溯源查询(完整链路) ==========
echo "[测试9] 溯源完整链路查询"
echo "  请求: GET /api/mobile/F001/traceability/full/PB001"

RESULT=$(curl -s "http://localhost:10010/api/mobile/F001/traceability/full/PB001" \
  -H "Authorization: Bearer $TOKEN")

if echo "$RESULT" | grep -q '"success":true\|"code":200\|rawMaterial\|production'; then
  echo "  期望: 返回完整溯源链路"
  echo "  实际: 成功 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 完整链路"
  echo "  实际: $(echo $RESULT | head -c 150)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试10: 公开溯源查询(无需Token) ==========
echo "[测试10] 公开溯源查询(消费者扫码)"
echo "  请求: GET /api/public/trace/PB001 (无Authorization)"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/public/trace/PB001")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 公开可访问"
  echo "  实际: HTTP 200 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
elif [ "$HTTP_CODE" = "404" ]; then
  echo "  期望: 公开接口"
  echo "  实际: 404 (接口可能未实现)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
else
  echo "  期望: HTTP 200"
  echo "  实际: HTTP $HTTP_CODE"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试11: 按客户查询出货 ==========
echo "[测试11] 按客户查询出货记录"
echo "  请求: GET /api/mobile/F001/shipments/customer/CUS001"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/shipments/customer/CUS001" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回客户出货记录"
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

# ========== 测试12: 删除出货记录 ==========
echo "[测试12] 删除出货记录"

# 创建一个用于删除测试的记录
DELETE_SHIP="DEL-$(date +%s)"
CREATE_RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/shipments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"shipmentNumber\": \"$DELETE_SHIP\",
    \"customerId\": \"CUS001\",
    \"productName\": \"删除测试\",
    \"quantity\": 10,
    \"unit\": \"箱\",
    \"shipmentDate\": \"$(date +%Y-%m-%d)\"
  }")

DELETE_ID=$(echo "$CREATE_RESULT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$DELETE_ID" ]; then
  echo "  请求: DELETE /api/mobile/F001/shipments/$DELETE_ID"

  RESULT=$(curl -s -X DELETE "http://localhost:10010/api/mobile/F001/shipments/$DELETE_ID" \
    -H "Authorization: Bearer $TOKEN")

  if echo "$RESULT" | grep -q '"success":true\|"code":200'; then
    echo "  期望: 删除成功"
    echo "  实际: 成功 ✓"
    echo "  结果: ✅ PASS"
    PASS=$((PASS+1))
  else
    echo "  期望: 删除成功"
    echo "  实际: $(echo $RESULT | head -c 100)"
    echo "  结果: ❌ FAIL"
    FAIL=$((FAIL+1))
  fi
else
  echo "  跳过: 创建测试记录失败"
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

## 出货状态流转

```
pending (待发货)
    │
    │ 发货
    ↓
shipped (已发货)
    │
    │ 送达
    ↓
delivered (已送达)
    │
    │ (异常情况)
    ↓
returned (已退货)
```

## 溯源链路

```
消费者扫码
    │
    ↓
查询产品批次号
    │
    ↓
┌─────────────────────────────────────┐
│ 原材料信息                           │
│ ├── 供应商                           │
│ ├── 批次号                           │
│ └── 入库/过期日期                     │
├─────────────────────────────────────┤
│ 生产信息                             │
│ ├── 生产批次                         │
│ ├── 生产日期                         │
│ └── 负责人/设备                       │
├─────────────────────────────────────┤
│ 质检信息                             │
│ ├── 检验日期                         │
│ ├── 检验员                           │
│ └── 合格率                           │
├─────────────────────────────────────┤
│ 出货信息                             │
│ ├── 出货日期                         │
│ └── 物流信息                         │
└─────────────────────────────────────┘
```

## 业务说明

- 出货记录关联客户和产品批次
- 溯源支持公开查询(消费者扫码)
- 完整链路包含从原材料到出货的所有环节
