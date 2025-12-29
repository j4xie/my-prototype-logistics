---
name: test-quality-inspection
description: 质检流程模块自动化测试。测试质检记录创建、提交、审核、查询。使用此Skill验证质检管理系统的完整性。
allowed-tools:
  - Bash
  - Read
  - Grep
---

# 质检流程测试 Skill

测试 Cretas 食品溯源系统的质检流程模块。

## 测试环境

- **服务地址**: localhost:10010
- **测试工厂**: F001

## 执行测试

运行以下命令执行完整的质检流程测试：

```bash
echo "========================================"
echo "质检流程模块 - 自动化测试报告"
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

# ========== 测试1: 获取质检记录列表 ==========
echo "[测试1] 获取质检记录列表"
echo "  请求: GET /api/mobile/F001/processing/quality/inspections"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/processing/quality/inspections" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回质检列表"
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

# ========== 测试2: 创建质检记录(草稿) ==========
echo "[测试2] 创建质检记录(草稿状态)"
echo "  请求: POST /api/mobile/F001/processing/quality/inspections"

RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/processing/quality/inspections" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "1",
    "inspectionType": "process",
    "inspector": "张检验员",
    "inspectionDate": "'$(date +%Y-%m-%d)'",
    "inspectionTime": "'$(date +%H:%M:%S)'",
    "scores": {"freshness": 90, "appearance": 85, "smell": 88, "other": 92},
    "conclusion": "pass",
    "notes": "测试质检记录",
    "status": "draft"
  }')

if echo "$RESULT" | grep -q "id\|success\|draft"; then
  INSPECTION_ID=$(echo "$RESULT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -z "$INSPECTION_ID" ]; then
    INSPECTION_ID=$(echo "$RESULT" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
  fi
  echo "  期望: 创建成功，状态为draft"
  echo "  实际: 创建成功，ID=$INSPECTION_ID ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 创建成功"
  echo "  实际: $(echo $RESULT | head -c 150)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
  INSPECTION_ID=""
fi
echo ""

# ========== 测试3: 获取质检记录详情 ==========
echo "[测试3] 获取质检记录详情"
if [ -n "$INSPECTION_ID" ]; then
  echo "  请求: GET /api/mobile/F001/processing/quality/inspections/$INSPECTION_ID"

  RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    "http://localhost:10010/api/mobile/F001/processing/quality/inspections/$INSPECTION_ID" \
    -H "Authorization: Bearer $TOKEN")
  HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

  if [ "$HTTP_CODE" = "200" ]; then
    echo "  期望: HTTP 200, 返回记录详情"
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
  echo "  跳过: 无可用质检ID"
  echo "  结果: ❌ FAIL (前置条件不满足)"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试4: 更新质检记录(草稿) ==========
echo "[测试4] 更新质检记录(仅草稿可更新)"
if [ -n "$INSPECTION_ID" ]; then
  echo "  请求: PUT /api/mobile/F001/processing/quality/inspections/$INSPECTION_ID"

  RESULT=$(curl -s -X PUT "http://localhost:10010/api/mobile/F001/processing/quality/inspections/$INSPECTION_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "scores": {"freshness": 95, "appearance": 90, "smell": 92, "other": 88},
      "notes": "更新后的备注"
    }')

  if echo "$RESULT" | grep -q "success\|更新\|95"; then
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
  echo "  跳过: 无可用质检ID"
  echo "  结果: ❌ FAIL (前置条件不满足)"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试5: 提交质检记录 ==========
echo "[测试5] 提交质检记录(draft → submitted)"
if [ -n "$INSPECTION_ID" ]; then
  echo "  请求: PUT /api/mobile/F001/processing/quality/inspections/$INSPECTION_ID"

  RESULT=$(curl -s -X PUT "http://localhost:10010/api/mobile/F001/processing/quality/inspections/$INSPECTION_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status": "submitted"}')

  if echo "$RESULT" | grep -q "submitted\|success"; then
    echo "  期望: 状态变为submitted"
    echo "  实际: 提交成功 ✓"
    echo "  结果: ✅ PASS"
    PASS=$((PASS+1))
  else
    echo "  期望: 提交成功"
    echo "  实际: $(echo $RESULT | head -c 150)"
    echo "  结果: ❌ FAIL"
    FAIL=$((FAIL+1))
  fi
else
  echo "  跳过: 无可用质检ID"
  echo "  结果: ❌ FAIL (前置条件不满足)"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试6: 审核质检记录(通过) ==========
echo "[测试6] 审核质检记录(通过)"
if [ -n "$INSPECTION_ID" ]; then
  echo "  请求: POST /api/mobile/F001/processing/quality/inspections/$INSPECTION_ID/review"

  RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/processing/quality/inspections/$INSPECTION_ID/review" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"approved": true, "reviewNotes": "审核通过"}')

  if echo "$RESULT" | grep -q "reviewed\|success\|approved"; then
    echo "  期望: 审核通过"
    echo "  实际: 成功 ✓"
    echo "  结果: ✅ PASS"
    PASS=$((PASS+1))
  else
    echo "  期望: 审核通过"
    echo "  实际: $(echo $RESULT | head -c 150)"
    echo "  结果: ❌ FAIL"
    FAIL=$((FAIL+1))
  fi
else
  echo "  跳过: 无可用质检ID"
  echo "  结果: ❌ FAIL (前置条件不满足)"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试7: 按状态筛选质检记录 ==========
echo "[测试7] 按状态筛选质检记录"
echo "  请求: GET /api/mobile/F001/processing/quality/inspections?status=submitted"

RESULT=$(curl -s "http://localhost:10010/api/mobile/F001/processing/quality/inspections?status=submitted" \
  -H "Authorization: Bearer $TOKEN")

if echo "$RESULT" | grep -q "content\|data\|\[\]"; then
  echo "  期望: 返回submitted状态记录"
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

# ========== 测试8: 按批次筛选质检记录 ==========
echo "[测试8] 按批次筛选质检记录"
echo "  请求: GET /api/mobile/F001/processing/quality/inspections?batchId=1"

RESULT=$(curl -s "http://localhost:10010/api/mobile/F001/processing/quality/inspections?batchId=1" \
  -H "Authorization: Bearer $TOKEN")

if echo "$RESULT" | grep -q "content\|data\|\[\]"; then
  echo "  期望: 返回指定批次的质检记录"
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

# ========== 测试9: 创建并删除草稿 ==========
echo "[测试9] 删除质检记录(仅草稿可删)"

# 创建一个新的草稿用于删除测试
DELETE_RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/processing/quality/inspections" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "1",
    "inspectionType": "raw_material",
    "inspector": "删除测试",
    "inspectionDate": "'$(date +%Y-%m-%d)'",
    "inspectionTime": "'$(date +%H:%M:%S)'",
    "scores": {"freshness": 80, "appearance": 80, "smell": 80, "other": 80},
    "conclusion": "pass",
    "status": "draft"
  }')

DELETE_ID=$(echo "$DELETE_RESULT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$DELETE_ID" ]; then
  DELETE_ID=$(echo "$DELETE_RESULT" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
fi

if [ -n "$DELETE_ID" ]; then
  echo "  请求: DELETE /api/mobile/F001/processing/quality/inspections/$DELETE_ID"

  RESULT=$(curl -s -X DELETE "http://localhost:10010/api/mobile/F001/processing/quality/inspections/$DELETE_ID" \
    -H "Authorization: Bearer $TOKEN")

  if echo "$RESULT" | grep -q "deleted\|success\|true"; then
    echo "  期望: 删除成功"
    echo "  实际: 成功 ✓"
    echo "  结果: ✅ PASS"
    PASS=$((PASS+1))
  else
    echo "  期望: 删除成功"
    echo "  实际: $(echo $RESULT | head -c 150)"
    echo "  结果: ❌ FAIL"
    FAIL=$((FAIL+1))
  fi
else
  echo "  跳过: 创建测试记录失败"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试10: 质检类型验证 ==========
echo "[测试10] 质检类型验证(raw_material/process/final_product)"
echo "  请求: POST 创建final_product类型质检"

RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/processing/quality/inspections" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "1",
    "inspectionType": "final_product",
    "inspector": "成品检验员",
    "inspectionDate": "'$(date +%Y-%m-%d)'",
    "inspectionTime": "'$(date +%H:%M:%S)'",
    "scores": {"freshness": 95, "appearance": 93, "smell": 94, "other": 96},
    "conclusion": "pass",
    "status": "draft"
  }')

if echo "$RESULT" | grep -q "id\|success\|final_product"; then
  echo "  期望: 支持final_product类型"
  echo "  实际: 成功 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 创建成功"
  echo "  实际: $(echo $RESULT | head -c 150)"
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

## 质检流程说明

```
创建草稿(draft)
    │
    │ 更新/修改
    ↓
提交审核(submitted)
    │
    ├── 审核通过 → reviewed (标记合格)
    │
    └── 审核驳回 → 返工处理
```

## 质检类型

| 类型 | 说明 |
|------|------|
| raw_material | 原材料质检 |
| process | 过程质检 |
| final_product | 成品质检 |

## 结论类型

| 结论 | 说明 |
|------|------|
| pass | 合格 |
| conditional_pass | 条件合格 |
| fail | 不合格 |
