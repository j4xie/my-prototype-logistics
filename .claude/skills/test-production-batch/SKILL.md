---
name: test-production-batch
description: 生产批次模块自动化测试。测试批次创建、状态流转、原料消耗、完成/取消生产。使用此Skill验证生产管理系统的完整性。
allowed-tools:
  - Bash
  - Read
  - Grep
---

# 生产批次测试 Skill

测试 Cretas 食品溯源系统的生产批次管理模块。

## 测试环境

- **服务地址**: localhost:10010
- **测试工厂**: F001

## 执行测试

运行以下命令执行完整的生产批次测试：

```bash
echo "========================================"
echo "生产批次模块 - 自动化测试报告"
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

# ========== 测试1: 获取批次列表 ==========
echo "[测试1] 获取批次列表"
echo "  请求: GET /api/mobile/F001/processing/batches"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/processing/batches" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回批次列表"
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

# ========== 测试2: 创建生产批次 ==========
echo "[测试2] 创建生产批次"
echo "  请求: POST /api/mobile/F001/processing/batches"

BATCH_NUM="TEST-$(date +%s)"
RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/processing/batches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"batchNumber\":\"$BATCH_NUM\",\"productTypeId\":\"PT001\",\"plannedQuantity\":100,\"supervisorId\":22}")

if echo "$RESULT" | grep -q "id\|batchNumber\|success"; then
  BATCH_ID=$(echo "$RESULT" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
  echo "  期望: 创建成功，返回批次ID"
  echo "  实际: 批次ID=$BATCH_ID ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 创建成功"
  echo "  实际: $(echo $RESULT | head -c 150)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
  BATCH_ID=""
fi
echo ""

# ========== 测试3: 获取批次详情 ==========
echo "[测试3] 获取批次详情"
if [ -n "$BATCH_ID" ]; then
  echo "  请求: GET /api/mobile/F001/processing/batches/$BATCH_ID"

  RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    "http://localhost:10010/api/mobile/F001/processing/batches/$BATCH_ID" \
    -H "Authorization: Bearer $TOKEN")
  HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

  if [ "$HTTP_CODE" = "200" ]; then
    echo "  期望: HTTP 200, 返回批次详情"
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
  echo "  跳过: 无可用批次ID"
  echo "  结果: ❌ FAIL (前置条件不满足)"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试4: 按状态筛选批次 ==========
echo "[测试4] 按状态筛选批次"
echo "  请求: GET /api/mobile/F001/processing/batches?status=CREATED"

RESULT=$(curl -s "http://localhost:10010/api/mobile/F001/processing/batches?status=CREATED" \
  -H "Authorization: Bearer $TOKEN")

if echo "$RESULT" | grep -q "content\|data\|\[\]"; then
  echo "  期望: 返回CREATED状态批次"
  echo "  实际: 成功 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 返回批次列表"
  echo "  实际: $(echo $RESULT | head -c 100)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试5: 开始生产 ==========
echo "[测试5] 开始生产"
if [ -n "$BATCH_ID" ]; then
  echo "  请求: POST /api/mobile/F001/processing/batches/$BATCH_ID/start"

  RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/processing/batches/$BATCH_ID/start?supervisorId=22" \
    -H "Authorization: Bearer $TOKEN")

  if echo "$RESULT" | grep -q "IN_PROGRESS\|success\|started"; then
    echo "  期望: 状态变为IN_PROGRESS"
    echo "  实际: 开始成功 ✓"
    echo "  结果: ✅ PASS"
    PASS=$((PASS+1))
  else
    echo "  期望: 开始成功"
    echo "  实际: $(echo $RESULT | head -c 150)"
    echo "  结果: ❌ FAIL"
    FAIL=$((FAIL+1))
  fi
else
  echo "  跳过: 无可用批次ID"
  echo "  结果: ❌ FAIL (前置条件不满足)"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试6: 记录原料消耗 ==========
echo "[测试6] 记录原料消耗"
if [ -n "$BATCH_ID" ]; then
  echo "  请求: POST /api/mobile/F001/processing/batches/$BATCH_ID/material-consumption"

  RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/processing/batches/$BATCH_ID/material-consumption" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"materialId":"MT001","quantity":50,"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}')

  if echo "$RESULT" | grep -q "recorded\|success\|true"; then
    echo "  期望: 消耗记录成功"
    echo "  实际: 记录成功 ✓"
    echo "  结果: ✅ PASS"
    PASS=$((PASS+1))
  else
    echo "  期望: 记录成功"
    echo "  实际: $(echo $RESULT | head -c 150)"
    echo "  结果: ❌ FAIL"
    FAIL=$((FAIL+1))
  fi
else
  echo "  跳过: 无可用批次ID"
  echo "  结果: ❌ FAIL (前置条件不满足)"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试7: 完成生产 ==========
echo "[测试7] 完成生产"
if [ -n "$BATCH_ID" ]; then
  echo "  请求: POST /api/mobile/F001/processing/batches/$BATCH_ID/complete"

  RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/processing/batches/$BATCH_ID/complete" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"actualQuantity":95}')

  if echo "$RESULT" | grep -q "COMPLETED\|success\|completed"; then
    echo "  期望: 状态变为COMPLETED"
    echo "  实际: 完成成功 ✓"
    echo "  结果: ✅ PASS"
    PASS=$((PASS+1))
  else
    echo "  期望: 完成成功"
    echo "  实际: $(echo $RESULT | head -c 150)"
    echo "  结果: ❌ FAIL"
    FAIL=$((FAIL+1))
  fi
else
  echo "  跳过: 无可用批次ID"
  echo "  结果: ❌ FAIL (前置条件不满足)"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试8: 创建并取消批次 ==========
echo "[测试8] 取消生产测试"
echo "  步骤: 创建新批次 → 取消"

CANCEL_BATCH="CANCEL-$(date +%s)"
CREATE_RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/processing/batches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"batchNumber\":\"$CANCEL_BATCH\",\"productTypeId\":\"PT001\",\"plannedQuantity\":50,\"supervisorId\":22}")

CANCEL_ID=$(echo "$CREATE_RESULT" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$CANCEL_ID" ]; then
  RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/processing/batches/$CANCEL_ID/cancel" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"reason":"测试取消"}')

  if echo "$RESULT" | grep -q "CANCELLED\|success\|cancelled"; then
    echo "  期望: 状态变为CANCELLED"
    echo "  实际: 取消成功 ✓"
    echo "  结果: ✅ PASS"
    PASS=$((PASS+1))
  else
    echo "  期望: 取消成功"
    echo "  实际: $(echo $RESULT | head -c 150)"
    echo "  结果: ❌ FAIL"
    FAIL=$((FAIL+1))
  fi
else
  echo "  跳过: 创建取消测试批次失败"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试9: 获取产品类型列表 ==========
echo "[测试9] 获取产品类型列表"
echo "  请求: GET /api/mobile/F001/product-types"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/product-types" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回产品类型"
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

# ========== 测试10: 更新批次信息 ==========
echo "[测试10] 更新批次信息"

# 先创建一个新批次用于更新测试
UPDATE_BATCH="UPDATE-$(date +%s)"
CREATE_RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/processing/batches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"batchNumber\":\"$UPDATE_BATCH\",\"productTypeId\":\"PT001\",\"plannedQuantity\":100,\"supervisorId\":22}")

UPDATE_ID=$(echo "$CREATE_RESULT" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$UPDATE_ID" ]; then
  echo "  请求: PUT /api/mobile/F001/processing/batches/$UPDATE_ID"

  RESULT=$(curl -s -X PUT "http://localhost:10010/api/mobile/F001/processing/batches/$UPDATE_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"notes":"更新测试备注"}')

  if echo "$RESULT" | grep -q "success\|notes\|更新"; then
    echo "  期望: 更新成功"
    echo "  实际: 成功 ✓"
    echo "  结果: ✅ PASS"
    PASS=$((PASS+1))
  else
    echo "  期望: 更新成功"
    echo "  实际: $(echo $RESULT | head -c 150)"
    echo "  结果: ❌ FAIL"
    FAIL=$((FAIL+1))
  fi
else
  echo "  跳过: 创建测试批次失败"
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

## 状态流转说明

```
CREATED (已创建)
    │
    │ start (指定负责人)
    ↓
IN_PROGRESS (生产中)
    │
    ├── complete → COMPLETED (已完成)
    │
    └── cancel → CANCELLED (已取消)
```

## 测试用例说明

| 序号 | 用例名称 | 验证目标 |
|------|----------|----------|
| 1 | 批次列表 | 分页查询 |
| 2 | 创建批次 | 基本创建 |
| 3 | 批次详情 | 单条查询 |
| 4 | 状态筛选 | 条件过滤 |
| 5 | 开始生产 | 状态流转 |
| 6 | 原料消耗 | 关联记录 |
| 7 | 完成生产 | 状态流转 |
| 8 | 取消生产 | 状态流转 |
| 9 | 产品类型 | 基础数据 |
| 10 | 更新批次 | 信息修改 |
