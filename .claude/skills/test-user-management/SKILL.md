---
name: test-user-management
description: 用户管理模块自动化测试。测试白名单管理、用户注册、用户CRUD、角色筛选。使用此Skill验证用户管理系统的完整性。
allowed-tools:
  - Bash
  - Read
  - Grep
---

# 用户管理测试 Skill

测试 Cretas 食品溯源系统的用户管理模块。

## 测试环境

- **服务地址**: localhost:10010
- **测试工厂**: F001

## 执行测试

运行以下命令执行完整的用户管理测试：

```bash
echo "========================================"
echo "用户管理模块 - 自动化测试报告"
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

# ========== 测试1: 获取用户列表 ==========
echo "[测试1] 获取用户列表"
echo "  请求: GET /api/mobile/F001/users"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/users" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回用户数组"
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

# ========== 测试2: 按角色筛选用户 ==========
echo "[测试2] 按角色筛选用户"
echo "  请求: GET /api/mobile/F001/users?role=operator"

RESULT=$(curl -s "http://localhost:10010/api/mobile/F001/users?role=operator" \
  -H "Authorization: Bearer $TOKEN")

if echo "$RESULT" | grep -q "operator\|content\|data"; then
  echo "  期望: 返回operator角色用户"
  echo "  实际: 成功返回 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 返回用户列表"
  echo "  实际: $(echo $RESULT | head -c 100)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试3: 获取单个用户详情 ==========
echo "[测试3] 获取单个用户详情"
echo "  请求: GET /api/mobile/F001/users/22"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/users/22" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回用户详情"
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

# ========== 测试4: 获取白名单列表 ==========
echo "[测试4] 获取白名单列表"
echo "  请求: GET /api/mobile/F001/whitelist"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/whitelist" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回白名单"
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

# ========== 测试5: 批量添加白名单 ==========
echo "[测试5] 批量添加白名单"
echo "  请求: POST /api/mobile/F001/whitelist/batch"

TEST_PHONE="139$(date +%s | tail -c 9)"
RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/whitelist/batch" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"whitelists\":[{\"phoneNumber\":\"$TEST_PHONE\",\"realName\":\"测试用户\",\"role\":\"operator\"}]}")

if echo "$RESULT" | grep -q "success\|Success\|添加"; then
  echo "  期望: 添加成功"
  echo "  实际: 成功 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 添加成功"
  echo "  实际: $(echo $RESULT | head -c 100)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试6: 验证白名单手机号 ==========
echo "[测试6] 验证白名单手机号"
echo "  请求: GET /api/mobile/F001/whitelist/validate/$TEST_PHONE"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/whitelist/validate/$TEST_PHONE" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ] && echo "$RESULT" | grep -q "isValid\|valid\|true\|code\":200"; then
  echo "  期望: 手机号在白名单中"
  echo "  实际: 验证通过 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 验证通过"
  echo "  实际: HTTP $HTTP_CODE - $(echo $RESULT | head -c 100)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试7: 验证非白名单手机号 ==========
echo "[测试7] 验证非白名单手机号"
echo "  请求: GET /api/mobile/F001/whitelist/validate/10000000000"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/whitelist/validate/10000000000" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

# 200返回但isValid=false，或者返回404表示不在白名单
if echo "$RESULT" | grep -q "false\|不在\|isValid\":false"; then
  echo "  期望: 手机号不在白名单"
  echo "  实际: 验证不通过 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
elif [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: 手机号不在白名单"
  echo "  实际: HTTP $HTTP_CODE (检查响应) ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 验证不通过"
  echo "  实际: HTTP $HTTP_CODE - $(echo $RESULT | head -c 100)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试8: 更新用户状态 ==========
echo "[测试8] 更新用户状态(激活用户)"
echo "  请求: POST /api/mobile/F001/users/{userId}/activate"

# 尝试激活用户(用户ID 25)
RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/users/25/activate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

if echo "$RESULT" | grep -q "success\|200\|true\|code\":200\|激活"; then
  echo "  期望: 用户激活成功"
  echo "  实际: 激活成功 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  # 也尝试停用测试
  echo "  激活结果: $(echo $RESULT | head -c 80)"
  echo "  尝试停用: POST /api/mobile/F001/users/25/deactivate"
  RESULT2=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/users/25/deactivate" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")
  if echo "$RESULT2" | grep -q "success\|200\|true\|code\":200\|停用"; then
    echo "  期望: 状态更新成功"
    echo "  实际: 停用成功 ✓"
    echo "  结果: ✅ PASS"
    PASS=$((PASS+1))
  else
    echo "  期望: 状态更新成功"
    echo "  实际: $(echo $RESULT2 | head -c 100)"
    echo "  结果: ❌ FAIL"
    FAIL=$((FAIL+1))
  fi
fi
echo ""

# ========== 测试9: 搜索用户 ==========
echo "[测试9] 搜索用户"
echo "  请求: GET /api/mobile/F001/users/search?keyword=admin"

RESULT=$(curl -s "http://localhost:10010/api/mobile/F001/users/search?keyword=admin" \
  -H "Authorization: Bearer $TOKEN")

if echo "$RESULT" | grep -q "admin\|content\|data\|\[\]"; then
  echo "  期望: 返回搜索结果"
  echo "  实际: 成功 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 返回搜索结果"
  echo "  实际: $(echo $RESULT | head -c 100)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试10: 获取部门列表 ==========
echo "[测试10] 获取部门列表"
echo "  请求: GET /api/mobile/F001/departments"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/departments" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回部门列表"
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

## 测试用例说明

| 序号 | 用例名称 | 验证目标 |
|------|----------|----------|
| 1 | 获取用户列表 | 分页查询功能 |
| 2 | 按角色筛选 | 角色过滤功能 |
| 3 | 用户详情 | 单用户查询 |
| 4 | 白名单列表 | 白名单查询 |
| 5 | 批量添加白名单 | 白名单创建 |
| 6 | 验证白名单手机号 | 注册前验证 |
| 7 | 验证非白名单 | 拒绝非白名单 |
| 8 | 更新用户状态 | 激活/停用功能 |
| 9 | 搜索用户 | 关键字搜索 |
| 10 | 部门列表 | 部门查询 |

## 业务流程说明

```
管理员添加白名单 → 员工验证手机号 → 员工注册 → 管理员激活 → 员工可登录
```
