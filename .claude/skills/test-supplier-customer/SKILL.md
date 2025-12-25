---
name: test-supplier-customer
description: 供应商客户模块自动化测试。测试供应商CRUD、客户CRUD、状态切换、搜索功能。使用此Skill验证供应商客户管理系统的完整性。
allowed-tools:
  - Bash
  - Read
  - Grep
---

# 供应商客户测试 Skill

测试 Cretas 食品溯源系统的供应商和客户管理模块。

## 测试环境

- **服务地址**: localhost:10010
- **测试工厂**: F001

## 执行测试

运行以下命令执行完整的供应商客户测试：

```bash
echo "========================================"
echo "供应商客户模块 - 自动化测试报告"
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

echo "========== 供应商测试 =========="
echo ""

# ========== 测试1: 获取供应商列表 ==========
echo "[测试1] 获取供应商列表"
echo "  请求: GET /api/mobile/F001/suppliers"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/suppliers" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回供应商列表"
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

# ========== 测试2: 创建供应商 ==========
echo "[测试2] 创建供应商"
echo "  请求: POST /api/mobile/F001/suppliers"

SUP_CODE="SUP-$(date +%s)"
RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/suppliers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"supplierCode\": \"$SUP_CODE\",
    \"name\": \"测试供应商\",
    \"contactPerson\": \"张三\",
    \"phone\": \"13800138000\",
    \"address\": \"上海市浦东新区\",
    \"businessType\": \"food\"
  }")

if echo "$RESULT" | grep -q '"code":200\|"success":true'; then
  SUP_ID=$(echo "$RESULT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -z "$SUP_ID" ]; then
    SUP_ID=$(echo "$RESULT" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
  fi
  echo "  期望: 创建成功"
  echo "  实际: 成功，代码=$SUP_CODE ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 创建成功"
  echo "  实际: $(echo $RESULT | head -c 150)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
  SUP_ID=""
fi
echo ""

# ========== 测试3: 获取供应商详情 ==========
echo "[测试3] 获取供应商详情"
if [ -n "$SUP_ID" ]; then
  echo "  请求: GET /api/mobile/F001/suppliers/$SUP_ID"

  RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    "http://localhost:10010/api/mobile/F001/suppliers/$SUP_ID" \
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
  echo "  跳过: 无可用供应商ID"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试4: 更新供应商 ==========
echo "[测试4] 更新供应商"
if [ -n "$SUP_ID" ]; then
  echo "  请求: PUT /api/mobile/F001/suppliers/$SUP_ID"

  RESULT=$(curl -s -X PUT "http://localhost:10010/api/mobile/F001/suppliers/$SUP_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "测试供应商-已更新",
      "contactPerson": "李四",
      "phone": "13900139000",
      "address": "上海市浦东新区-已更新"
    }')

  if echo "$RESULT" | grep -q '"code":200\|"success":true'; then
    echo "  期望: 更新成功"
    echo "  实际: 成功 ✓"
    echo "  结果: ✅ PASS"
    PASS=$((PASS+1))
  else
    echo "  期望: 更新成功"
    echo "  实际: $(echo $RESULT | head -c 100)"
    echo "  结果: ❌ FAIL"
    FAIL=$((FAIL+1))
  fi
else
  echo "  跳过: 无可用供应商ID"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试5: 搜索供应商 ==========
echo "[测试5] 搜索供应商"
echo "  请求: GET /api/mobile/F001/suppliers/search?keyword=测试"

# URL编码中文关键字: 测试 = %E6%B5%8B%E8%AF%95
RESULT=$(curl -s "http://localhost:10010/api/mobile/F001/suppliers/search?keyword=%E6%B5%8B%E8%AF%95" \
  -H "Authorization: Bearer $TOKEN")

if echo "$RESULT" | grep -q '"code":200\|"success":true'; then
  echo "  期望: 返回搜索结果"
  echo "  实际: 成功 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 返回结果"
  echo "  实际: $(echo $RESULT | head -c 100)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试6: 切换供应商状态 ==========
echo "[测试6] 切换供应商状态(停用)"
if [ -n "$SUP_ID" ]; then
  echo "  请求: PUT /api/mobile/F001/suppliers/$SUP_ID/status"

  RESULT=$(curl -s -X PUT "http://localhost:10010/api/mobile/F001/suppliers/$SUP_ID/status" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"isActive": false}')

  if echo "$RESULT" | grep -q '"code":200\|"success":true'; then
    echo "  期望: 状态变为停用"
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
  echo "  跳过: 无可用供应商ID"
  FAIL=$((FAIL+1))
fi
echo ""

echo "========== 客户测试 =========="
echo ""

# ========== 测试7: 获取客户列表 ==========
echo "[测试7] 获取客户列表"
echo "  请求: GET /api/mobile/F001/customers"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/customers" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回客户列表"
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

# ========== 测试8: 创建客户 ==========
echo "[测试8] 创建客户"
echo "  请求: POST /api/mobile/F001/customers"

RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/customers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"测试客户-$(date +%s)\",
    \"contactPerson\": \"王五\",
    \"phone\": \"13700137000\",
    \"shippingAddress\": \"北京市朝阳区\",
    \"type\": \"distributor\"
  }")

if echo "$RESULT" | grep -q '"code":200\|"success":true'; then
  CUS_ID=$(echo "$RESULT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -z "$CUS_ID" ]; then
    CUS_ID=$(echo "$RESULT" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
  fi
  echo "  期望: 创建成功"
  echo "  实际: 成功，代码=$CUS_CODE ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 创建成功"
  echo "  实际: $(echo $RESULT | head -c 150)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
  CUS_ID=""
fi
echo ""

# ========== 测试9: 获取客户详情 ==========
echo "[测试9] 获取客户详情"
if [ -n "$CUS_ID" ]; then
  echo "  请求: GET /api/mobile/F001/customers/$CUS_ID"

  RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    "http://localhost:10010/api/mobile/F001/customers/$CUS_ID" \
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
  echo "  跳过: 无可用客户ID"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试10: 更新客户 ==========
echo "[测试10] 更新客户"
if [ -n "$CUS_ID" ]; then
  echo "  请求: PUT /api/mobile/F001/customers/$CUS_ID"

  RESULT=$(curl -s -X PUT "http://localhost:10010/api/mobile/F001/customers/$CUS_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "测试客户-已更新",
      "contactPerson": "赵六",
      "phone": "13800138888",
      "shippingAddress": "北京市朝阳区-已更新"
    }')

  if echo "$RESULT" | grep -q '"code":200\|"success":true'; then
    echo "  期望: 更新成功"
    echo "  实际: 成功 ✓"
    echo "  结果: ✅ PASS"
    PASS=$((PASS+1))
  else
    echo "  期望: 更新成功"
    echo "  实际: $(echo $RESULT | head -c 100)"
    echo "  结果: ❌ FAIL"
    FAIL=$((FAIL+1))
  fi
else
  echo "  跳过: 无可用客户ID"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试11: 搜索客户 ==========
echo "[测试11] 搜索客户"
echo "  请求: GET /api/mobile/F001/customers/search?keyword=测试"

# URL编码中文关键字: 测试 = %E6%B5%8B%E8%AF%95
RESULT=$(curl -s "http://localhost:10010/api/mobile/F001/customers/search?keyword=%E6%B5%8B%E8%AF%95" \
  -H "Authorization: Bearer $TOKEN")

if echo "$RESULT" | grep -q '"code":200\|"success":true'; then
  echo "  期望: 返回搜索结果"
  echo "  实际: 成功 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 返回结果"
  echo "  实际: $(echo $RESULT | head -c 100)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试12: 获取活跃客户 ==========
echo "[测试12] 获取活跃客户"
echo "  请求: GET /api/mobile/F001/customers/active"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/customers/active" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回活跃客户"
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

## 业务场景

### 供应商
- 管理原材料供货方
- 关联原材料批次

### 客户
- 管理销售对象
- 用于出货记录

## 客户类型

| 类型 | 说明 |
|------|------|
| distributor | 分销商 |
| retailer | 零售商 |
| direct | 直客 |
| other | 其他 |
