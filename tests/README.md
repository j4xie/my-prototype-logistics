# 测试脚本使用指南

本目录包含白垩纪食品溯源系统的所有测试脚本。

---

## 📁 目录结构

```
tests/
├── timeclock/              # TimeClock API 测试脚本（当前可用）
│   ├── test-timeclock-e2e-fixed.sh
│   └── test-frontend-backend-integration.sh
└── legacy/                 # 历史遗留测试脚本（已归档）
    ├── test_apis.sh
    ├── test_ai_todo_apis.sh
    └── ... (其他旧脚本)
```

---

## ✅ 当前可用的测试脚本

### 1. TimeClock E2E 测试

**脚本**: `tests/timeclock/test-timeclock-e2e-fixed.sh`

**用途**: 完整的 TimeClock API 端到端测试，覆盖 9 个测试场景

**测试场景**:
1. 获取今日打卡记录 (初始状态 - 应为空)
2. 上班打卡 (创建新记录)
3. 获取今日打卡记录 (已上班 - 应有数据)
4. 获取打卡状态
5. 开始休息
6. 结束休息
7. 下班打卡
8. 获取今日打卡记录 (已下班 - 完整记录)
9. 获取打卡历史记录

**使用方法**:
```bash
cd /Users/jietaoxie/my-prototype-logistics

# 1. 确保后端服务正在运行
lsof -i :10010  # 检查端口10010是否被监听

# 2. 清理测试数据（可选）
mysql -u root cretas_db -e "DELETE FROM time_clock_record WHERE user_id = 1;"

# 3. 运行测试
./tests/timeclock/test-timeclock-e2e-fixed.sh
```

**预期结果**:
```
==========================================
  Test Results Summary
==========================================

Total Tests: 9
Passed: 9
Failed: 0

✅ All tests passed! TimeClock API is working correctly!
```

**配置参数**:
```bash
# 可通过环境变量自定义配置
BASE_URL=http://localhost:10010  # 后端服务地址
FACTORY_ID=F001                  # 工厂ID
USER_ID=1                        # 用户ID

# 示例：测试不同的用户
USER_ID=2 ./tests/timeclock/test-timeclock-e2e-fixed.sh
```

---

### 2. 前后端集成测试

**脚本**: `tests/timeclock/test-frontend-backend-integration.sh`

**用途**: 验证前端 TypeScript 接口定义与后端 API 响应格式是否匹配

**测试内容**:
- **第1部分**: API 响应格式测试 (ApiResponse<T> 结构)
- **第2部分**: 数据字段测试 (ClockRecord 17个字段)
- **第3部分**: GPS 参数测试 (latitude/longitude 传输)

**使用方法**:
```bash
# 1. 确保后端服务正在运行
lsof -i :10010

# 2. 运行集成测试
./tests/timeclock/test-frontend-backend-integration.sh
```

**预期结果**:
```
==========================================
  测试结果汇总
==========================================

总测试数: 4
通过: 4
失败: 0

✅ 所有测试通过！前后端接口完全匹配！

🎉 集成测试结论:
   ✅ 响应格式正确 (success, code, message, data)
   ✅ 数据字段完整 (TimeClockRecord所有字段)
   ✅ GPS参数正确传递和保存
   ✅ 前后端类型定义匹配
```

**验证点**:
- ✅ ApiResponse 结构: `{ success, code, message, data }`
- ✅ ClockRecord 字段: 17个字段全部匹配
- ✅ GPS 坐标: latitude/longitude 正确保存

---

## 🔧 后端服务管理

### 启动后端服务

**方法1: 使用编译好的 JAR 文件**
```bash
cd /Users/jietaoxie/my-prototype-logistics/backend/java/cretas-api

# 启动服务
nohup java -jar target/cretas-backend-system-1.0.0.jar > backend.log 2>&1 &

# 查看日志
tail -f backend.log

# 检查服务状态
lsof -i :10010
```

**方法2: 使用本地运行脚本**
```bash
cd /Users/jietaoxie/my-prototype-logistics/backend/java/cretas-api
./run-local.sh
```

### 停止后端服务

```bash
# 查找进程ID
lsof -i :10010

# 停止服务（替换 PID 为实际进程ID）
kill -9 <PID>
```

### 查看后端日志

```bash
# 实时查看日志
tail -f /Users/jietaoxie/my-prototype-logistics/backend/java/cretas-api/backend.log

# 查看最近30行
tail -n 30 backend.log

# 搜索错误
grep -i error backend.log
```

---

## 📊 测试数据管理

### 清理测试数据

```bash
# 清理指定用户的打卡记录
mysql -u root cretas_db -e "DELETE FROM time_clock_record WHERE user_id = 1;"

# 清理今日的打卡记录
mysql -u root cretas_db -e "DELETE FROM time_clock_record WHERE DATE(clock_in_time) = CURDATE();"

# 清理所有打卡记录
mysql -u root cretas_db -e "TRUNCATE TABLE time_clock_record;"
```

### 查看测试数据

```bash
# 查看所有打卡记录
mysql -u root cretas_db -e "SELECT * FROM time_clock_record;"

# 查看今日打卡记录
mysql -u root cretas_db -e "SELECT * FROM time_clock_record WHERE DATE(clock_in_time) = CURDATE();"

# 查看指定用户的记录
mysql -u root cretas_db -e "SELECT * FROM time_clock_record WHERE user_id = 1 ORDER BY clock_in_time DESC LIMIT 5;"
```

---

## 🧪 手动API测试

### 使用 curl 测试 API

```bash
# 1. 获取今日打卡记录
curl -s "http://localhost:10010/api/mobile/F001/timeclock/today?userId=1" | python3 -m json.tool

# 2. 上班打卡 (含GPS)
curl -s -X POST "http://localhost:10010/api/mobile/F001/timeclock/clock-in?userId=1&location=Test+Location&device=iPhone&latitude=31.2304&longitude=121.4737" | python3 -m json.tool

# 3. 获取打卡状态
curl -s "http://localhost:10010/api/mobile/F001/timeclock/status?userId=1" | python3 -m json.tool

# 4. 开始休息
curl -s -X POST "http://localhost:10010/api/mobile/F001/timeclock/break-start?userId=1" | python3 -m json.tool

# 5. 结束休息
curl -s -X POST "http://localhost:10010/api/mobile/F001/timeclock/break-end?userId=1" | python3 -m json.tool

# 6. 下班打卡
curl -s -X POST "http://localhost:10010/api/mobile/F001/timeclock/clock-out?userId=1" | python3 -m json.tool

# 7. 获取打卡历史
curl -s "http://localhost:10010/api/mobile/F001/timeclock/history?userId=1&startDate=2025-11-01&endDate=2025-11-30&page=1&size=20" | python3 -m json.tool
```

---

## 📝 常见问题

### Q1: 测试提示"后端服务未启动"怎么办？

**A**: 检查后端服务是否运行:
```bash
lsof -i :10010
```

如果没有输出，说明服务未启动。使用以下命令启动:
```bash
cd backend/java/cretas-api
nohup java -jar target/cretas-backend-system-1.0.0.jar > backend.log 2>&1 &
```

### Q2: 测试失败"HTTP 400 - Bad Request"怎么办？

**A**: 这通常是URL编码问题。确保使用的是 `test-timeclock-e2e-fixed.sh`（修复版），而不是旧的 `test-timeclock-e2e.sh`。

### Q3: GPS参数没有保存怎么办？

**A**: 检查以下几点:
1. 前端是否正确传递 `latitude` 和 `longitude` 参数
2. 后端 `TimeClockRecord` 实体是否包含这两个字段
3. 数据库表是否有 `latitude` 和 `longitude` 列

### Q4: 如何重新编译后端？

**A**:
```bash
cd backend/java/cretas-api
./mvnw.cmd clean package -Dmaven.test.skip=true
```

编译成功后会在 `target/` 目录生成新的 JAR 文件。

### Q5: 如何重置数据库？

**A**:
```bash
# 删除表
mysql -u root cretas_db -e "DROP TABLE IF EXISTS time_clock_record;"

# 重新创建表
mysql -u root cretas_db < backend/java/cretas-api/database/create_timeclock_table.sql
```

---

## 📚 参考文档

- [完整测试报告](../COMPLETE_TEST_REPORT.md) - 所有测试的详细结果
- [后端测试计划](../BACKEND_TEST_PLAN.md) - 完整的测试计划（包括P1、P2测试）
- [前后端修复总结](../FRONTEND_BACKEND_FIX_SUMMARY.md) - 前端接口修复详情
- [前后端集成测试报告](../FRONTEND_BACKEND_INTEGRATION_TEST_REPORT.md) - 集成测试分析

---

## 🗂️ 历史遗留脚本 (Legacy)

`tests/legacy/` 目录包含以下历史遗留测试脚本：

- `test_apis.sh` - 旧的通用API测试
- `test_ai_todo_apis.sh` - AI相关API测试
- `test_4_api_fixes.sh` - API修复测试
- `test_dashboard_apis.sh` - Dashboard API测试
- `test_frontend_api_paths.sh` - 前端API路径测试
- `test_server_106.sh` - 远程服务器测试
- `create-mock-data-and-test-ai.sh` - AI mock数据测试
- 等等...

**注意**: 这些脚本已经过时或被新的测试脚本替代，保留仅供参考。**不推荐使用**。

---

## ✅ 最佳实践

1. **运行测试前**:
   - 确保后端服务正在运行
   - 检查数据库连接正常
   - 清理旧的测试数据

2. **测试失败时**:
   - 查看后端日志 `backend.log`
   - 检查数据库状态
   - 验证API响应格式

3. **开发新功能时**:
   - 参考现有测试脚本
   - 保持测试脚本更新
   - 添加新的测试场景

4. **提交代码前**:
   - 运行 E2E 测试确保所有功能正常
   - 运行前后端集成测试确保接口匹配
   - 检查无遗留的测试数据

---

**最后更新**: 2025-11-15
**维护者**: Claude (AI Assistant) & Jietao Xie
