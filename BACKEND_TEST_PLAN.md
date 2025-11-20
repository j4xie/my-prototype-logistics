# 后端测试计划 - TimeClock API

**测试日期**: 2025-11-15
**测试状态**: ⏳ 待执行
**后端状态**: 📦 未编译

---

## 📋 测试总览

| 测试类别 | 测试数量 | 状态 | 优先级 |
|---------|---------|------|--------|
| 编译测试 | 1项 | ⏳ 待执行 | 🔴 P0 |
| 数据库测试 | 3项 | ⏳ 待执行 | 🔴 P0 |
| 单元测试 | 7项 | ⏳ 待执行 | 🟡 P1 |
| API端点测试 | 7项 | ⏳ 待执行 | 🔴 P0 |
| 业务逻辑测试 | 5项 | ⏳ 待执行 | 🟡 P1 |
| 集成测试 | 9项 | ⏳ 待执行 | 🔴 P0 |
| 性能测试 | 3项 | ⏳ 待执行 | 🟢 P2 |
| 安全测试 | 2项 | ⏳ 待执行 | 🟡 P1 |

**总计**: 37项测试

---

## 🔴 P0 - 必须测试（阻塞上线）

### 1. 编译测试 ⏳

**目标**: 确保后端代码可以成功编译

**测试步骤**:
```bash
cd backend-java
./build.sh
```

**期望结果**:
- ✅ Maven 依赖下载成功
- ✅ Java 代码编译无错误
- ✅ JAR 文件生成: `target/cretas-backend-system-1.0.0.jar`

**可能的问题**:
- ❌ Java 版本不匹配（需要 Java 11）
- ❌ Maven 依赖下载失败
- ❌ 代码编译错误

**状态**: ⏳ **未测试**

---

### 2. 数据库测试 ⏳

#### 2.1 数据库连接测试

**目标**: 确保可以连接到 MySQL 数据库

**测试步骤**:
```bash
# 检查 MySQL 服务状态
brew services list | grep mysql

# 测试连接
mysql -u root -p -e "SELECT 1"
```

**期望结果**:
- ✅ MySQL 服务运行中
- ✅ 可以使用 root 用户连接
- ✅ 查询返回结果

**状态**: ⏳ **未测试**

#### 2.2 数据库创建测试

**目标**: 创建 cretas_db 数据库

**测试步骤**:
```bash
mysql -u root -p << 'EOF'
CREATE DATABASE IF NOT EXISTS cretas_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

SHOW DATABASES LIKE 'cretas_db';
EOF
```

**期望结果**:
- ✅ 数据库创建成功
- ✅ 字符集为 utf8mb4

**状态**: ⏳ **未测试**

#### 2.3 表结构创建测试

**目标**: 创建 time_clock_record 表

**测试步骤**:
```bash
mysql -u root -p cretas_db < backend-java/database/create_timeclock_table.sql

# 验证表结构
mysql -u root -p cretas_db -e "DESCRIBE time_clock_record;"
```

**期望结果**:
- ✅ 表创建成功
- ✅ 所有字段正确
- ✅ 索引创建成功

**可能的问题**:
- ❌ SQL 语法错误
- ❌ 字段类型不支持
- ❌ 索引创建失败

**状态**: ⏳ **未测试**

---

### 3. 本地运行测试 ⏳

**目标**: 在本地成功启动后端服务

**测试步骤**:
```bash
# 1. 配置数据库连接（编辑 application.properties）
cd backend-java
nano src/main/resources/application.properties
# 设置正确的数据库密码

# 2. 启动服务
./run-local.sh
```

**期望结果**:
- ✅ Spring Boot 启动成功
- ✅ 端口 10010 监听
- ✅ 数据库连接成功
- ✅ 无启动错误

**可能的问题**:
- ❌ 数据库连接失败
- ❌ 端口被占用
- ❌ 配置错误

**状态**: ⏳ **未测试**

---

### 4. API 端点测试 (7个) ⏳

#### 4.1 GET /today - 获取今日打卡记录

**测试命令**:
```bash
curl -s "http://localhost:10010/api/mobile/F001/timeclock/today?userId=1" | python3 -m json.tool
```

**期望响应**:
```json
{
  "success": true,
  "code": 200,
  "message": "今日未打卡",
  "data": null
}
```

**验证点**:
- ✅ HTTP 200 状态码
- ✅ 响应包含 success, code, message, data
- ✅ 今日未打卡时 data 为 null

**状态**: ⏳ **未测试**

#### 4.2 POST /clock-in - 上班打卡

**测试命令**:
```bash
curl -X POST "http://localhost:10010/api/mobile/F001/timeclock/clock-in?userId=1&location=测试地点&device=测试设备&latitude=31.2304&longitude=121.4737" | python3 -m json.tool
```

**期望响应**:
```json
{
  "success": true,
  "code": 200,
  "message": "上班打卡成功",
  "data": {
    "id": 1,
    "userId": 1,
    "factoryId": "F001",
    "clockInTime": "2025-11-15T...",
    "location": "测试地点",
    "device": "测试设备",
    "latitude": 31.2304,
    "longitude": 121.4737,
    "status": "working",
    ...
  }
}
```

**验证点**:
- ✅ HTTP 200 状态码
- ✅ 返回完整的 TimeClockRecord
- ✅ GPS 坐标正确保存
- ✅ status 为 "working"
- ✅ clockInTime 有值

**状态**: ⏳ **未测试**

#### 4.3 GET /status - 获取打卡状态

**测试命令**:
```bash
curl -s "http://localhost:10010/api/mobile/F001/timeclock/status?userId=1" | python3 -m json.tool
```

**期望响应**:
```json
{
  "success": true,
  "code": 200,
  "message": "获取打卡状态成功",
  "data": {
    "canClockIn": false,
    "canClockOut": true,
    "lastClockIn": "2025-11-15T...",
    "lastClockOut": null,
    "status": "working",
    "todayRecord": { ... }
  }
}
```

**验证点**:
- ✅ canClockIn 和 canClockOut 逻辑正确
- ✅ 返回今日记录

**状态**: ⏳ **未测试**

#### 4.4 POST /break-start - 开始休息

**测试命令**:
```bash
curl -X POST "http://localhost:10010/api/mobile/F001/timeclock/break-start?userId=1" | python3 -m json.tool
```

**期望响应**:
```json
{
  "success": true,
  "code": 200,
  "message": "开始休息成功",
  "data": {
    "breakStartTime": "2025-11-15T...",
    "status": "on_break",
    ...
  }
}
```

**验证点**:
- ✅ breakStartTime 有值
- ✅ status 变为 "on_break"

**状态**: ⏳ **未测试**

#### 4.5 POST /break-end - 结束休息

**测试命令**:
```bash
curl -X POST "http://localhost:10010/api/mobile/F001/timeclock/break-end?userId=1" | python3 -m json.tool
```

**期望响应**:
```json
{
  "success": true,
  "code": 200,
  "message": "结束休息成功",
  "data": {
    "breakStartTime": "2025-11-15T...",
    "breakEndTime": "2025-11-15T...",
    "breakDuration": 10,
    "status": "working",
    ...
  }
}
```

**验证点**:
- ✅ breakEndTime 有值
- ✅ breakDuration 自动计算
- ✅ status 变回 "working"

**状态**: ⏳ **未测试**

#### 4.6 POST /clock-out - 下班打卡

**测试命令**:
```bash
curl -X POST "http://localhost:10010/api/mobile/F001/timeclock/clock-out?userId=1" | python3 -m json.tool
```

**期望响应**:
```json
{
  "success": true,
  "code": 200,
  "message": "下班打卡成功",
  "data": {
    "clockInTime": "2025-11-15T09:00:00",
    "clockOutTime": "2025-11-15T18:00:00",
    "workDuration": 530,
    "breakDuration": 10,
    "status": "off_work",
    ...
  }
}
```

**验证点**:
- ✅ clockOutTime 有值
- ✅ workDuration 自动计算（总时长 - 休息时长）
- ✅ status 变为 "off_work"

**状态**: ⏳ **未测试**

#### 4.7 GET /history - 获取打卡历史

**测试命令**:
```bash
TODAY=$(date +%Y-%m-%d)
curl -s "http://localhost:10010/api/mobile/F001/timeclock/history?userId=1&startDate=$TODAY&endDate=$TODAY&page=1&size=20" | python3 -m json.tool
```

**期望响应**:
```json
{
  "success": true,
  "code": 200,
  "message": "获取打卡历史成功",
  "data": {
    "records": [{ ... }],
    "total": 1,
    "page": 1,
    "size": 20,
    "totalPages": 1
  }
}
```

**验证点**:
- ✅ 返回今日的打卡记录
- ✅ 分页信息正确

**状态**: ⏳ **未测试**

---

### 5. E2E 集成测试 (9个场景) ⏳

**目标**: 测试完整的打卡工作流程

**测试脚本**: `backend-java/test-timeclock-e2e.sh`

**测试场景**:
1. ✅ 查询今日打卡记录（初始状态 - 应为空）
2. ✅ 上班打卡
3. ✅ 查询今日打卡记录（应有数据）
4. ✅ 获取打卡状态
5. ✅ 开始休息
6. ✅ 结束休息
7. ✅ 下班打卡
8. ✅ 查询今日打卡记录（完整记录）
9. ✅ 获取打卡历史

**运行命令**:
```bash
cd backend-java
./test-timeclock-e2e.sh
```

**期望结果**:
- ✅ 所有9个测试通过
- ✅ 完整的打卡流程正常工作
- ✅ 数据正确保存和计算

**状态**: ⏳ **未测试**

---

## 🟡 P1 - 应该测试（重要但不阻塞）

### 6. 业务逻辑测试 (5项)

#### 6.1 重复打卡测试

**目标**: 验证不能重复上班打卡

**测试步骤**:
```bash
# 第一次打卡（应成功）
curl -X POST "http://localhost:10010/api/mobile/F001/timeclock/clock-in?userId=1"

# 第二次打卡（应失败）
curl -X POST "http://localhost:10010/api/mobile/F001/timeclock/clock-in?userId=1"
```

**期望结果**:
- ✅ 第一次返回 200
- ✅ 第二次返回 400
- ✅ 错误消息: "今日已打卡，不能重复打卡"

**状态**: ⏳ **未测试**

#### 6.2 未打卡就下班测试

**目标**: 验证未上班打卡不能下班打卡

**测试步骤**:
```bash
# 清空今日记录
# 直接下班打卡（应失败）
curl -X POST "http://localhost:10010/api/mobile/F001/timeclock/clock-out?userId=99"
```

**期望结果**:
- ✅ 返回 400
- ✅ 错误消息: "今日未上班打卡，不能下班打卡"

**状态**: ⏳ **未测试**

#### 6.3 工作时长计算测试

**目标**: 验证工作时长计算正确

**测试步骤**:
1. 上班打卡: 9:00
2. 开始休息: 12:00
3. 结束休息: 13:00
4. 下班打卡: 18:00

**期望结果**:
- ✅ workDuration = 540 - 60 = 480 分钟 (8小时)
- ✅ breakDuration = 60 分钟 (1小时)

**状态**: ⏳ **未测试**

#### 6.4 多用户隔离测试

**目标**: 验证不同用户的打卡记录隔离

**测试步骤**:
```bash
# 用户1打卡
curl -X POST "http://localhost:10010/api/mobile/F001/timeclock/clock-in?userId=1"

# 用户2打卡
curl -X POST "http://localhost:10010/api/mobile/F001/timeclock/clock-in?userId=2"

# 查询用户1记录
curl "http://localhost:10010/api/mobile/F001/timeclock/today?userId=1"

# 查询用户2记录
curl "http://localhost:10010/api/mobile/F001/timeclock/today?userId=2"
```

**期望结果**:
- ✅ 两个用户都能成功打卡
- ✅ 各自查询只能看到自己的记录

**状态**: ⏳ **未测试**

#### 6.5 跨天边界测试

**目标**: 验证日期边界处理正确

**测试内容**:
- 23:59 打卡，第二天查询应为空
- 00:01 打卡，是新的一天的记录

**状态**: ⏳ **未测试**

---

### 7. 安全测试 (2项)

#### 7.1 SQL 注入测试

**目标**: 验证不受 SQL 注入攻击

**测试步骤**:
```bash
curl -X POST "http://localhost:10010/api/mobile/F001/timeclock/clock-in?userId=1' OR '1'='1&location=test"
```

**期望结果**:
- ✅ 参数验证失败或安全处理
- ✅ 不会执行恶意 SQL

**状态**: ⏳ **未测试**

#### 7.2 XSS 测试

**目标**: 验证不受 XSS 攻击

**测试步骤**:
```bash
curl -X POST "http://localhost:10010/api/mobile/F001/timeclock/clock-in?userId=1&location=<script>alert('xss')</script>"
```

**期望结果**:
- ✅ 特殊字符正确转义
- ✅ 返回数据中脚本被转义

**状态**: ⏳ **未测试**

---

## 🟢 P2 - 可选测试（优化性能）

### 8. 性能测试 (3项)

#### 8.1 响应时间测试

**目标**: API 响应时间 < 500ms

**测试命令**:
```bash
time curl -s "http://localhost:10010/api/mobile/F001/timeclock/today?userId=1" > /dev/null
```

**期望结果**:
- ✅ 响应时间 < 500ms

**状态**: ⏳ **未测试**

#### 8.2 并发测试

**目标**: 支持 100 并发请求

**测试工具**: Apache Bench (ab)

**测试命令**:
```bash
ab -n 1000 -c 100 "http://localhost:10010/api/mobile/F001/timeclock/today?userId=1"
```

**期望结果**:
- ✅ 无请求失败
- ✅ 平均响应时间 < 1s

**状态**: ⏳ **未测试**

#### 8.3 数据库查询性能测试

**目标**: 索引优化，查询时间 < 100ms

**测试方法**:
- 插入 10000 条打卡记录
- 查询今日记录
- 使用 EXPLAIN 分析查询计划

**期望结果**:
- ✅ 使用索引 idx_user_factory_time
- ✅ 查询时间 < 100ms

**状态**: ⏳ **未测试**

---

## 📊 测试优先级建议

### 立即执行（今天）

1. **编译测试** - 确保代码可以编译 ✅
2. **数据库测试** - 创建数据库和表 ✅
3. **本地运行测试** - 启动服务 ✅
4. **基础 API 测试** - 测试 /today, /clock-in, /clock-out ✅
5. **E2E 集成测试** - 运行完整流程测试 ✅

**预计时间**: 30-60分钟

### 短期执行（本周）

6. **业务逻辑测试** - 重复打卡、未打卡就下班等 ⏳
7. **安全测试** - SQL注入、XSS ⏳

**预计时间**: 1-2小时

### 后续优化（下周）

8. **性能测试** - 响应时间、并发、数据库性能 ⏳

**预计时间**: 2-3小时

---

## 🚀 快速测试指南

### 一键测试脚本

创建 `run-all-tests.sh`:

```bash
#!/bin/bash

echo "=========================================="
echo "  TimeClock 后端完整测试"
echo "=========================================="

# 1. 编译测试
echo "1. 编译测试..."
cd backend-java
./build.sh
if [ $? -ne 0 ]; then
    echo "❌ 编译失败"
    exit 1
fi

# 2. 配置数据库
echo "2. 配置数据库..."
# TODO: 自动配置数据库

# 3. 启动服务
echo "3. 启动服务..."
./run-local.sh &
BACKEND_PID=$!
sleep 10

# 4. 运行 E2E 测试
echo "4. 运行 E2E 测试..."
./test-timeclock-e2e.sh

# 5. 停止服务
kill $BACKEND_PID

echo "=========================================="
echo "  测试完成！"
echo "=========================================="
```

---

## 📋 测试检查清单

在部署到生产环境之前，确保以下测试全部通过：

### 编译和构建
- [ ] Maven 编译成功
- [ ] JAR 文件生成
- [ ] 无编译警告

### 数据库
- [ ] 数据库连接成功
- [ ] 表结构创建成功
- [ ] 索引创建成功

### 基础功能
- [ ] 服务启动成功
- [ ] 所有7个 API 端点正常响应
- [ ] 响应格式正确（ApiResponse）

### 业务逻辑
- [ ] 上班打卡成功
- [ ] 下班打卡成功
- [ ] 休息功能正常
- [ ] 工作时长计算正确
- [ ] 防重复打卡
- [ ] 状态验证

### E2E 测试
- [ ] 完整流程测试通过（9/9）
- [ ] GPS 数据正确保存
- [ ] 历史记录查询正常

### 安全
- [ ] SQL 注入防护
- [ ] XSS 防护

### 性能
- [ ] API 响应时间 < 500ms
- [ ] 支持并发请求

---

## 🎯 测试成功标准

### P0 必须通过（阻塞上线）

| 测试项 | 通过标准 |
|--------|---------|
| 编译测试 | JAR 文件成功生成 |
| 数据库测试 | 表结构创建成功 |
| API 端点测试 | 所有7个端点返回 200 |
| E2E 测试 | 9个场景全部通过 |

### P1 应该通过（重要）

| 测试项 | 通过标准 |
|--------|---------|
| 业务逻辑测试 | 5个测试全部通过 |
| 安全测试 | 2个测试全部通过 |

### P2 可选（优化）

| 测试项 | 通过标准 |
|--------|---------|
| 性能测试 | 响应时间 < 500ms，并发支持 > 100 |

---

## 📞 测试支持

### 常见问题

**Q1: 编译失败怎么办？**
- 检查 Java 版本（需要 Java 11）
- 检查 Maven 配置
- 查看错误日志

**Q2: 数据库连接失败？**
- 检查 MySQL 服务是否运行
- 检查 application.properties 配置
- 检查数据库密码

**Q3: API 返回 500 错误？**
- 查看后端日志
- 检查数据库表是否存在
- 检查请求参数格式

### 帮助资源

- 📚 后端 README: `backend-java/README.md`
- 🧪 E2E 测试脚本: `backend-java/test-timeclock-e2e.sh`
- 📊 集成测试脚本: `test-frontend-backend-integration.sh`
- 📝 API 文档: Swagger 文档

---

**测试计划创建时间**: 2025-11-15
**总测试数**: 37项
**待测试数**: 37项
**通过数**: 0项
**下一步**: 开始执行 P0 测试（编译 → 数据库 → 运行 → E2E）
