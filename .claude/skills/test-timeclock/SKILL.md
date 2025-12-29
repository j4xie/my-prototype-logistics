---
name: test-timeclock
description: 考勤打卡模块自动化测试。测试上班打卡、下班打卡、打卡状态、工时统计。使用此Skill验证考勤系统的完整性。
allowed-tools:
  - Bash
  - Read
  - Grep
---

# 考勤打卡测试 Skill

测试 Cretas 食品溯源系统的考勤打卡模块。

## 测试环境

- **服务地址**: localhost:10010
- **测试工厂**: F001

## 执行测试

运行以下命令执行完整的考勤打卡测试：

```bash
echo "========================================"
echo "考勤打卡模块 - 自动化测试报告"
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

# ========== 测试1: 获取打卡状态 ==========
echo "[测试1] 获取当前打卡状态"
echo "  请求: GET /api/mobile/F001/timeclock/status"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/timeclock/status" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  STATUS=$(echo "$RESULT" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  echo "  期望: HTTP 200, 返回打卡状态"
  echo "  实际: HTTP 200, status=$STATUS ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: HTTP 200"
  echo "  实际: HTTP $HTTP_CODE"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试2: 获取今日打卡记录 ==========
echo "[测试2] 获取今日打卡记录"
echo "  请求: GET /api/mobile/F001/timeclock/today"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/timeclock/today" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回今日记录"
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

# ========== 测试3: 上班打卡 ==========
echo "[测试3] 上班打卡"
echo "  请求: POST /api/mobile/F001/timeclock/clock-in"

# 模拟GPS位置（工厂范围内）
RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/timeclock/clock-in" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 31.2304,
    "longitude": 121.4737,
    "address": "上海市浦东新区测试工厂"
  }')

if echo "$RESULT" | grep -q "success\|clockInTime\|已打卡"; then
  echo "  期望: 打卡成功"
  echo "  实际: 成功 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
elif echo "$RESULT" | grep -q "已打过\|already\|duplicate"; then
  echo "  期望: 打卡成功(或已打卡)"
  echo "  实际: 今日已打过卡 ✓"
  echo "  结果: ✅ PASS (已有打卡记录)"
  PASS=$((PASS+1))
else
  echo "  期望: 打卡成功"
  echo "  实际: $(echo $RESULT | head -c 150)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试4: 重复上班打卡 ==========
echo "[测试4] 重复上班打卡(应拒绝或返回已打卡)"
echo "  请求: POST /api/mobile/F001/timeclock/clock-in (第二次)"

RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/timeclock/clock-in" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 31.2304,
    "longitude": 121.4737,
    "address": "上海市浦东新区测试工厂"
  }')

if echo "$RESULT" | grep -q "已打\|already\|duplicate\|exist"; then
  echo "  期望: 拒绝重复打卡"
  echo "  实际: 正确拒绝 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 拒绝重复"
  echo "  实际: $(echo $RESULT | head -c 100)"
  echo "  结果: ❌ FAIL (允许重复打卡是bug)"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试5: 下班打卡 ==========
echo "[测试5] 下班打卡"
echo "  请求: POST /api/mobile/F001/timeclock/clock-out"

RESULT=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/timeclock/clock-out" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 31.2304,
    "longitude": 121.4737,
    "address": "上海市浦东新区测试工厂"
  }')

if echo "$RESULT" | grep -q "success\|clockOutTime\|已打卡"; then
  echo "  期望: 下班打卡成功"
  echo "  实际: 成功 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
elif echo "$RESULT" | grep -q "未打卡\|未上班\|clock-in first"; then
  echo "  期望: 需先上班打卡"
  echo "  实际: 正确提示 ✓"
  echo "  结果: ✅ PASS (业务规则正确)"
  PASS=$((PASS+1))
else
  echo "  期望: 打卡成功"
  echo "  实际: $(echo $RESULT | head -c 150)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试6: 再次获取今日记录 ==========
echo "[测试6] 验证今日打卡记录更新"
echo "  请求: GET /api/mobile/F001/timeclock/today"

RESULT=$(curl -s "http://localhost:10010/api/mobile/F001/timeclock/today" \
  -H "Authorization: Bearer $TOKEN")

if echo "$RESULT" | grep -q "clockInTime\|clockOutTime\|workDuration"; then
  echo "  期望: 包含打卡时间信息"
  echo "  实际: 记录完整 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 打卡记录"
  echo "  实际: $(echo $RESULT | head -c 100)"
  echo "  结果: ❌ FAIL"
  FAIL=$((FAIL+1))
fi
echo ""

# ========== 测试7: 获取本周统计 ==========
echo "[测试7] 获取本周工时统计"
CURRENT_YEAR=$(date +%Y)
CURRENT_WEEK=$(date +%V)
echo "  请求: GET /api/mobile/F001/time-stats/weekly?year=$CURRENT_YEAR&week=$CURRENT_WEEK"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/time-stats/weekly?year=$CURRENT_YEAR&week=$CURRENT_WEEK" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回周统计"
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

# ========== 测试8: 获取本月统计 ==========
echo "[测试8] 获取本月工时统计"
CURRENT_MONTH=$(date +%-m)
echo "  请求: GET /api/mobile/F001/time-stats/monthly?year=$CURRENT_YEAR&month=$CURRENT_MONTH"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/time-stats/monthly?year=$CURRENT_YEAR&month=$CURRENT_MONTH" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回月统计"
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

# ========== 测试9: 获取打卡历史记录 ==========
echo "[测试9] 获取打卡历史记录"

START_DATE=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d '7 days ago' +%Y-%m-%d)
END_DATE=$(date +%Y-%m-%d)
echo "  请求: GET /api/mobile/F001/timeclock/history?startDate=$START_DATE&endDate=$END_DATE&page=1&size=20"

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "http://localhost:10010/api/mobile/F001/timeclock/history?startDate=$START_DATE&endDate=$END_DATE&page=1&size=20" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE:" | cut -d':' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "  期望: HTTP 200, 返回历史记录"
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

# ========== 测试10: 按日期范围查询 ==========
echo "[测试10] 按日期范围查询打卡记录(不同范围)"

MONTH_START=$(date -v-30d +%Y-%m-%d 2>/dev/null || date -d '30 days ago' +%Y-%m-%d)
MONTH_END=$(date +%Y-%m-%d)
echo "  请求: GET /api/mobile/F001/timeclock/history?startDate=$MONTH_START&endDate=$MONTH_END&page=1&size=20"

RESULT=$(curl -s "http://localhost:10010/api/mobile/F001/timeclock/history?startDate=$MONTH_START&endDate=$MONTH_END&page=1&size=20" \
  -H "Authorization: Bearer $TOKEN")

if echo "$RESULT" | grep -q "content\|data\|\[\]\|code.*200"; then
  echo "  期望: 返回日期范围内记录"
  echo "  实际: 成功 ✓"
  echo "  结果: ✅ PASS"
  PASS=$((PASS+1))
else
  echo "  期望: 返回记录"
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

## 打卡流程

```
员工上班
    │
    ↓
打开打卡页面
    │
    ↓
获取GPS位置
    │
    ↓
检查是否在工厂范围
    │
    ├── 在范围内 → 记录上班打卡
    │
    └── 不在范围 → 拒绝(或标记异常)

... 工作中 ...

下班打卡(同样流程)
    │
    ↓
计算工时
```

## 工时计算

```
工作时长 = 下班时间 - 上班时间 - 休息时间

统计维度:
├── 日统计: 当天工时
├── 周统计: 本周累计
└── 月统计: 本月累计
```

## 状态说明

| 状态 | 说明 |
|------|------|
| NOT_CLOCKED_IN | 未打卡 |
| CLOCKED_IN | 已上班打卡 |
| CLOCKED_OUT | 已下班打卡 |
| ABNORMAL | 异常(迟到/早退) |
