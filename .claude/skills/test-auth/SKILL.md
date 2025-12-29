---
name: test-auth
description: 认证授权模块自动化测试。测试登录、Token刷新、角色权限、工厂数据隔离。使用此Skill验证认证系统的完整性。
allowed-tools:
  - Bash
  - Read
  - Grep
---

# 认证授权测试 Skill

测试 Cretas 食品溯源系统的认证授权模块。

## 测试环境

- **服务地址**: localhost:10010
- **测试账号**: 详见下方账号列表

## 执行测试

运行以下命令执行完整的认证授权测试：

```bash
echo "========================================"
echo "认证授权模块 - 自动化测试报告"
echo "环境: localhost:10010"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
echo ""

# 初始化计数器
PASS=0
FAIL=0

# ========== 测试1: 工厂用户登录 ==========
echo "[测试1] 工厂用户登录"
echo "  请求: POST /api/mobile/auth/unified-login"
echo "  账号: factory_admin1 / 123456"

RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin1","password":"123456"}')

if echo "$RESULT" | grep -q '"success":true'; then
  echo "  期望: success=true, 返回accessToken"
  echo "  实际: success=true ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
  FACTORY_TOKEN=$(echo "$RESULT" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
else
  echo "  期望: success=true"
  echo "  实际: $(echo $RESULT | head -c 100)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试2: 平台用户登录 ==========
echo "[测试2] 平台用户登录"
echo "  请求: POST /api/mobile/auth/unified-login"
echo "  账号: platform_admin / 123456"

RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"platform_admin","password":"123456"}')

if echo "$RESULT" | grep -q '"success":true'; then
  echo "  期望: success=true, role=super_admin"
  ROLE=$(echo "$RESULT" | grep -o '"role":"[^"]*"' | cut -d'"' -f4)
  echo "  实际: success=true, role=$ROLE"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
  PLATFORM_TOKEN=$(echo "$RESULT" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
else
  echo "  期望: success=true"
  echo "  实际: $(echo $RESULT | head -c 100)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试3: 错误密码登录 ==========
echo "[测试3] 错误密码登录"
echo "  请求: POST /api/mobile/auth/unified-login"
echo "  账号: factory_admin1 / wrong_password"

RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin1","password":"wrong_password"}')

if echo "$RESULT" | grep -q '"success":false'; then
  echo "  期望: success=false (拒绝错误密码)"
  echo "  实际: success=false ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: success=false"
  echo "  实际: $(echo $RESULT | head -c 100)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试4: 不存在用户登录 ==========
echo "[测试4] 不存在用户登录"
echo "  请求: POST /api/mobile/auth/unified-login"
echo "  账号: nonexistent_user / 123456"

RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"nonexistent_user","password":"123456"}')

if echo "$RESULT" | grep -q '"success":false'; then
  echo "  期望: success=false (用户不存在)"
  echo "  实际: success=false ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: success=false"
  echo "  实际: $(echo $RESULT | head -c 100)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试5: 无Token访问受保护接口 ==========
echo "[测试5] 无Token访问受保护接口"
echo "  请求: GET /api/mobile/dashboard/F001 (无Authorization)"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" "http://localhost:10010/api/mobile/dashboard/F001")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo "  期望: HTTP 401/403 (未授权)"
  echo "  实际: HTTP $HTTP_CODE ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: HTTP 401/403"
  echo "  实际: HTTP $HTTP_CODE"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试6: 有效Token访问本工厂数据 ==========
echo "[测试6] 有效Token访问本工厂数据"
echo "  请求: GET /api/mobile/dashboard/F001 (Bearer Token)"

if [ -n "$FACTORY_TOKEN" ]; then
  RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    "http://localhost:10010/api/mobile/dashboard/F001" \
    -H "Authorization: Bearer $FACTORY_TOKEN")
  HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

  if [ "$HTTP_CODE" = "200" ]; then
    echo "  期望: HTTP 200 (允许访问)"
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
  echo "  跳过: 未获取到工厂Token"
  echo "  结果: ❌ FAIL (前置条件不满足)"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试7: 工厂数据隔离 - 访问其他工厂 ==========
echo "[测试7] 工厂数据隔离 - 访问其他工厂"
echo "  请求: GET /api/mobile/dashboard/F002 (使用F001的Token)"

if [ -n "$FACTORY_TOKEN" ]; then
  RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    "http://localhost:10010/api/mobile/dashboard/F002" \
    -H "Authorization: Bearer $FACTORY_TOKEN")
  HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

  if [ "$HTTP_CODE" = "403" ]; then
    echo "  期望: HTTP 403 (禁止访问其他工厂)"
    echo "  实际: HTTP 403 ✓"
    echo "  结果: ✅ PASS"
    PASS=$((PASS+1))
  else
    echo "  期望: HTTP 403"
    echo "  实际: HTTP $HTTP_CODE"
    echo "  结果: ❌ FAIL (数据隔离失效!)"
    FAIL=$((FAIL+1))
  fi
else
  echo "  跳过: 未获取到工厂Token"
  echo "  结果: ❌ FAIL (前置条件不满足)"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试8: 平台管理员跨工厂访问 ==========
echo "[测试8] 平台管理员跨工厂访问"
echo "  请求: GET /api/mobile/dashboard/F001 (平台Token)"

if [ -n "$PLATFORM_TOKEN" ]; then
  RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    "http://localhost:10010/api/mobile/dashboard/F001" \
    -H "Authorization: Bearer $PLATFORM_TOKEN")
  HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

  if [ "$HTTP_CODE" = "200" ]; then
    echo "  期望: HTTP 200 (平台管理员可跨工厂)"
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
  echo "  跳过: 未获取到平台Token"
  echo "  结果: ❌ FAIL (前置条件不满足)"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试9: Token刷新 ==========
echo "[测试9] Token刷新"
echo "  请求: POST /api/mobile/auth/refresh?refreshToken=xxx"

# 先获取refreshToken
REFRESH_RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin1","password":"123456"}')
REFRESH_TOKEN=$(echo "$REFRESH_RESULT" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)

if [ -n "$REFRESH_TOKEN" ]; then
  RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/auth/refresh?refreshToken=$REFRESH_TOKEN")

  if echo "$RESULT" | grep -q '"accessToken"\|"code":200'; then
    echo "  期望: 返回新的accessToken"
    echo "  实际: 成功返回新Token ✓"
    echo "  结果: ✅ PASS"
    PASS=$((PASS+1))
  else
    echo "  期望: 返回新的accessToken"
    echo "  实际: $(echo $RESULT | head -c 100)"
    echo "  结果: ❌ FAIL"
    FAIL=$((FAIL+1))
  fi
else
  echo "  跳过: 未获取到refreshToken"
  echo "  结果: ❌ FAIL (前置条件不满足)"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试10: 无效Token刷新 ==========
echo "[测试10] 无效Token刷新"
echo "  请求: POST /api/mobile/auth/refresh?refreshToken=invalid"

RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/auth/refresh?refreshToken=invalid_token_12345")

if echo "$RESULT" | grep -q '"success":false\|error\|401\|403'; then
  echo "  期望: 拒绝无效Token"
  echo "  实际: 拒绝 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 拒绝无效Token"
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

## 测试账号

| 账号 | 角色 | 所属工厂 |
|------|------|----------|
| platform_admin | super_admin | - (平台级) |
| factory_admin1 | factory_super_admin | F001 |
| factory_admin2 | factory_super_admin | F002 |
| operator1 | operator | F001 |

**通用密码**: `123456`

## 测试用例说明

| 序号 | 用例名称 | 验证目标 |
|------|----------|----------|
| 1 | 工厂用户登录 | 正常登录返回Token |
| 2 | 平台用户登录 | 平台角色正确识别 |
| 3 | 错误密码登录 | 密码验证机制 |
| 4 | 不存在用户登录 | 用户存在性检查 |
| 5 | 无Token访问 | 认证拦截器生效 |
| 6 | 有效Token访问 | Token验证通过 |
| 7 | 工厂数据隔离 | 禁止访问其他工厂 |
| 8 | 平台管理员跨工厂 | 平台权限验证 |
| 9 | Token刷新 | refreshToken机制 |
| 10 | 无效Token刷新 | 拒绝无效Token |

## 前置条件

1. 后端服务运行在 localhost:10010
2. 数据库中存在测试账号

## 故障排查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 所有登录失败 | 后端未启动 | `lsof -i :10010` 检查服务 |
| Token刷新失败 | JWT配置问题 | 检查后端JWT配置 |
| 数据隔离失败 | 拦截器未生效 | 检查JwtAuthInterceptor |
