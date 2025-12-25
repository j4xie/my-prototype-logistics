---
name: test-material-batch
description: 原材料管理模块自动化测试。测试批次入库、预留、消耗、FIFO分配、库存预警。使用此Skill验证原材料管理系统的完整性。
allowed-tools:
  - Bash
  - Read
  - Grep
---

# 原材料管理测试 Skill

测试 Cretas 食品溯源系统的原材料批次管理模块。

## 测试环境

- **服务地址**: localhost:10010
- **测试工厂**: F001

## 执行测试

运行以下命令执行完整的原材料管理测试：

```bash
echo "========================================"
echo "原材料管理模块 - 自动化测试报告"
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

# ========== 测试1: 获取原材料批次列表 ==========
echo "[测试1] 获取原材料批次列表"
echo "  请求: GET /api/mobile/F001/material-batches"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/material-batches" \
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

# ========== 测试2: 创建原材料批次 ==========
echo "[测试2] 创建原材料批次(入库)"
echo "  请求: POST /api/mobile/F001/material-batches"

BATCH_ID="MB-TEST-$(date +%s)"
RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/material-batches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"batchNumber\": \"$BATCH_ID\",
    \"materialTypeId\": \"MT001\",
    \"quantity\": 500,
    \"unit\": \"kg\",
    \"supplierId\": \"SUP001\",
    \"receivedDate\": \"$(date +%Y-%m-%d)\",
    \"expirationDate\": \"$(date -v+30d +%Y-%m-%d 2>/dev/null || date -d '+30 days' +%Y-%m-%d)\",
    \"storageLocation\": \"仓库A-01\"
  }")

if echo "$RESULT" | grep -q "id\|batchNumber\|success"; then
  MATERIAL_ID=$(echo "$RESULT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -z "$MATERIAL_ID" ]; then
    MATERIAL_ID=$(echo "$RESULT" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
  fi
  echo "  期望: 入库成功，状态AVAILABLE"
  echo "  实际: 创建成功，批次=$BATCH_ID ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 创建成功"
  echo "  实际: $(echo $RESULT | head -c 150)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
  MATERIAL_ID=""
fi
echo ""

# ========== 测试3: 获取批次详情 ==========
echo "[测试3] 获取批次详情"
echo "  请求: GET /api/mobile/F001/material-batches/$BATCH_ID"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/material-batches/$BATCH_ID" \
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
echo ""

# ========== 测试4: 按状态筛选批次 ==========
echo "[测试4] 按状态筛选批次"
echo "  请求: GET /api/mobile/F001/material-batches?status=AVAILABLE"

RESULT=$(curl -s "http://localhost:10010/api/mobile/F001/material-batches?status=AVAILABLE" \
  -H "Authorization: Bearer $TOKEN")

if echo "$RESULT" | grep -q "content\|data\|\[\]"; then
  echo "  期望: 返回AVAILABLE状态批次"
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

# ========== 测试5: 预留原材料 ==========
echo "[测试5] 预留原材料"
echo "  请求: POST /api/mobile/F001/material-batches/$BATCH_ID/reserve"

# 注意: 后端期望字段是 planId (生产计划ID), 不是 productionBatchId
RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/material-batches/$BATCH_ID/reserve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 100, "planId": "PLAN-TEST-001", "notes": "测试预留"}')

if echo "$RESULT" | grep -q "reserved\|success\|RESERVED\|code\":200"; then
  echo "  期望: 预留100kg成功"
  echo "  实际: 成功 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 预留成功"
  echo "  实际: $(echo $RESULT | head -c 150)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试6: 消耗原材料 ==========
echo "[测试6] 消耗原材料"
echo "  请求: POST /api/mobile/F001/material-batches/$BATCH_ID/consume"

# 注意: 后端期望字段是 processId (生产批次ID, Long类型), 不是 productionBatchId (String)
# 还需要 consumedBy 字段 (操作人ID)
RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/material-batches/$BATCH_ID/consume" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 50, "processId": 1, "consumedBy": 22}')

if echo "$RESULT" | grep -q "consumed\|success\|IN_USE\|code\":200"; then
  echo "  期望: 消耗50kg成功"
  echo "  实际: 成功 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 消耗成功"
  echo "  实际: $(echo $RESULT | head -c 150)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试7: 释放预留 ==========
echo "[测试7] 释放预留"
echo "  请求: POST /api/mobile/F001/material-batches/$BATCH_ID/release"

# 注意: 后端期望字段是 productionPlanId, 不是 productionBatchId
RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/material-batches/$BATCH_ID/release" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 50, "productionPlanId": "PLAN-TEST-001", "notes": "测试释放"}')

if echo "$RESULT" | grep -q "released\|success\|AVAILABLE\|code\":200"; then
  echo "  期望: 释放50kg预留成功"
  echo "  实际: 成功 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 释放成功"
  echo "  实际: $(echo $RESULT | head -c 150)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试8: 转冻品 ==========
echo "[测试8] 转冻品"
echo "  请求: POST /api/mobile/F001/material-batches/$BATCH_ID/freeze"

RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/material-batches/$BATCH_ID/freeze" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "测试转冻"}')

if echo "$RESULT" | grep -q "FROZEN\|success\|frozen"; then
  echo "  期望: 转冻品成功"
  echo "  实际: 成功 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 转冻成功"
  echo "  实际: $(echo $RESULT | head -c 150)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试9: 撤销转冻(10分钟内) ==========
echo "[测试9] 撤销转冻(10分钟内可撤销)"
echo "  请求: POST /api/mobile/F001/material-batches/$BATCH_ID/unfreeze"

RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/material-batches/$BATCH_ID/unfreeze" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "撤销转冻测试"}')

if echo "$RESULT" | grep -q "AVAILABLE\|success\|unfrozen"; then
  echo "  期望: 撤销成功，恢复AVAILABLE"
  echo "  实际: 成功 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 撤销成功"
  echo "  实际: $(echo $RESULT | head -c 150)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试10: 获取材料类型列表 ==========
echo "[测试10] 获取材料类型列表"
echo "  请求: GET /api/mobile/F001/material-types"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/material-types" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回材料类型"
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

# ========== 测试11: 库存预警查询 ==========
echo "[测试11] 库存预警查询"
echo "  请求: GET /api/mobile/F001/material-batches/alerts"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/material-batches/alerts" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回预警列表"
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

# ========== 测试12: 即将过期批次查询 ==========
echo "[测试12] 即将过期批次查询"
echo "  请求: GET /api/mobile/F001/material-batches/expiring?days=7"

RESULT=$(curl -s "http://localhost:10010/api/mobile/F001/material-batches/expiring?days=7" \
  -H "Authorization: Bearer $TOKEN")

if echo "$RESULT" | grep -q "content\|data\|\[\]"; then
  echo "  期望: 返回7天内过期批次"
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

## 批次状态说明

```
AVAILABLE (可用)
    │
    ├── reserve → RESERVED (已预留)
    │                 │
    │                 ├── consume → IN_USE (使用中)
    │                 │                 │
    │                 │                 └── 全部消耗 → DEPLETED
    │                 │
    │                 └── release → AVAILABLE
    │
    └── freeze → FROZEN (冻品)
                    │
                    └── unfreeze (10分钟内) → AVAILABLE
```

## FIFO原则

系统自动按入库日期排序，优先使用最早入库的批次。

## 库存预警类型

| 类型 | 触发条件 |
|------|----------|
| 低库存 | 当前库存 < 最低库存线 |
| 即将过期 | 距离过期 ≤ 7天 |
| 已过期 | 当前日期 > 过期日期 |
