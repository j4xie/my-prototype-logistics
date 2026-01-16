# 🚀 完整集成测试指南

本指南将帮助您验证整个系统的完整性，包括：
- Python AI 服务 ✅
- Java Spring Boot 后端 ✅
- React Native 前端 ✅

---

## 📋 系统架构概览

```
前端 (React Native)
    ↓ [用户请求时间范围分析]
后端 API 网关
    ├─ ReportController (/api/mobile/{factoryId}/reports/cost-analysis)
    │  └─ ReportService.getCostAnalysisReport()
    │
    └─ AIController (/api/mobile/{factoryId}/ai/analysis/cost/time-range)
       └─ AIEnterpriseService.analyzeTimeRangeCost()
           ├─ processingService.getTimeRangeBatchesCostAnalysis()
           ├─ 格式化 Prompt 数据
           └─ basicAIService.analyzeCost()  (调用 Python AI)
                ↓
            Python FastAPI 服务 (端口 8085)
                └─ LLM 分析
```

---

## ✅ 已完成的实现

### 1. 后端实现状态

#### ProcessingServiceImpl 改进
- ✅ **getWeeklyBatchesCost()** 实现 (第1227-1276行)
  - 获取时间范围内的批次成本摘要
  - 返回轻量级批次数据（不包含业务链详情）

- ✅ **固定硬编码零值** (第885-898行)
  - `completedBatches` 现在查询数据库而非硬编码为0
  - `avgEfficiency` 现在查询数据库而非硬编码为0

#### AIEnterpriseService 实现完整
- ✅ **generateWeeklyReport()** - 周报告生成
- ✅ **generateMonthlyReport()** - 月报告生成
- ✅ **generateHistoricalReport()** - 历史报告生成
- ✅ **callAIForWeeklyReport()** - 调用AI处理周数据
- ✅ **callAIForMonthlyReport()** - 调用AI处理月数据
- ✅ **formatWeeklyReportPrompt()** - 周报告Prompt格式化
- ✅ **formatMonthlyReportPrompt()** - 月报告Prompt格式化
- ✅ **formatHistoricalReportPrompt()** - 历史报告Prompt格式化

#### ReportController 实现
- ✅ `/api/mobile/{factoryId}/reports/cost-analysis` - 成本分析报表
- ✅ 调用 ReportService.getCostAnalysisReport()
- ✅ 支持 startDate 和 endDate 参数

#### AIController 实现
- ✅ `/api/mobile/{factoryId}/ai/analysis/cost/time-range` - 时间范围AI分析
- ✅ 调用 AIEnterpriseService.analyzeTimeRangeCost()
- ✅ 支持 question 和 dimension 参数

### 2. 前端实现状态

#### TimeRangeCostAnalysisScreen
- ✅ 时间范围选择（今天/本周/本月/自定义）
- ✅ 快速时间范围选项 (5个)
- ✅ 日期范围选择器
- ✅ 成本数据加载显示
- ✅ AI智能分析区域
- ✅ 配额管理显示
- ✅ 快速问题选项
- ✅ 自定义问题输入

#### API 客户端
- ✅ `processingApiClient.getTimeRangeCostAnalysis()` - 获取成本分析报表
- ✅ `aiApiClient.analyzeTimeRangeCost()` - 调用AI时间范围分析

### 3. 数据库改进

#### ProductionBatchRepository
- ✅ `countByFactoryIdAndStatusAndCreatedAtAfter()` - 更改参数类型从String到ProductionBatchStatus enum
- ✅ `calculateAverageEfficiency()` - 计算平均效率
- ✅ `calculateDailyOutput()` - 计算日产量
- ✅ `calculateDailyYieldRate()` - 计算日良品率
- ✅ `calculateDailyCost()` - 计算日成本

---

## 🔄 完整数据流

### 场景 1: 时间范围成本分析报表 (不需要AI)

```
用户选择时间范围 → 前端调用 processingApiClient.getTimeRangeCostAnalysis()
    ↓
后端 /api/mobile/{factoryId}/reports/cost-analysis
    ↓
ReportService.getCostAnalysisReport()
    ↓
查询数据库计算成本明细 (materialCost, laborCost, equipmentCost, otherCost)
    ↓
返回成本构成数据到前端
    ↓
前端显示成本汇总和成本明细
```

### 场景 2: AI智能分析时间范围成本 (需要AI)

```
用户点击"获取AI分析报告" → 前端调用 aiApiClient.analyzeTimeRangeCost()
    ↓
后端 /api/mobile/{factoryId}/ai/analysis/cost/time-range
    ↓
AIEnterpriseService.analyzeTimeRangeCost()
    │
    ├─ 1. 检查缓存 (7天有效期)
    │     如果命中缓存 → 直接返回，不消耗配额
    │
    ├─ 2. 检查配额 (时间范围分析消耗2次配额)
    │     如果配额不足 → 抛出异常
    │
    ├─ 3. 获取时间范围内的批次数据
    │     processingService.getTimeRangeBatchesCostAnalysis()
    │
    ├─ 4. 格式化为AI Prompt
    │     formatTimeRangePrompt() 组织批次数据、统计信息、问题
    │
    ├─ 5. 调用Python AI服务
    │     basicAIService.analyzeCost()
    │          ↓
    │     HTTP POST to Python FastAPI (port 8085)
    │          ↓
    │     LLM 分析批次数据
    │          ↓
    │     返回AI分析文本
    │
    ├─ 6. 消耗配额 (减少2次)
    │
    ├─ 7. 保存结果到数据库 (7天有效期缓存)
    │     ai_analysis_results 表
    │
    └─ 返回 AI 分析文本到前端
         ↓
前端显示 AI 分析结果
```

---

## 🧪 集成测试步骤

### 第1步: 启动 Python AI 服务

```bash
cd backend-java/backend-ai-chat

# 创建虚拟环境 (如果尚未创建)
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate     # Windows

# 安装依赖
pip install -r requirements.txt

# 启动 FastAPI 服务
python main_enhanced.py
```

✅ **预期输出**:
```
INFO:     Uvicorn running on http://127.0.0.1:8085
```

### 第2步: 启动 MySQL 数据库

```bash
# macOS
mysql.server start

# Linux
sudo systemctl start mysql

# Windows
# 使用 MySQL Installer 或 MySQL Command Line Client
```

✅ **验证连接**:
```bash
mysql -u root -p cretas_db -e "SELECT VERSION();"
```

### 第3步: 启动 Spring Boot 后端

```bash
cd backend-java

# 确保使用 JDK 17
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home

# 构建
mvn clean package -DskipTests -q

# 启动后端服务
mvn spring-boot:run
```

✅ **预期输出**:
```
Started CretasBackendSystemApplication in X.XXX seconds
```

✅ **验证健康检查**:
```bash
curl http://localhost:10010/api/mobile/health
```

应该返回:
```json
{
  "status": "UP"
}
```

### 第4步: 启动 React Native 前端 (在新终端)

```bash
cd frontend/CretasFoodTrace

# 安装依赖 (如果尚未安装)
npm install

# 启动 Expo 开发服务器
npm start

# 扫描二维码使用 Expo Go 或按 'a' 启动 Android / 'i' 启动 iOS
```

✅ **预期输出**:
```
Expo development server running
```

---

## 🔬 单独功能测试

### 测试 1: 后端成本分析报表 API

```bash
# 获取时间范围内的成本分析报表 (不需要AI)
curl -X GET "http://localhost:10010/api/mobile/CRETAS_2024_001/reports/cost-analysis" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiZmFjdG9yeV9zdXBlcl9hZG1pbiIsInVzZXJJZCI6IjEiLCJzdWIiOiIxIiwiaWF0IjoxNzYzNjczOTA5LCJleHAiOjE3NjM3NjAzMDl9.sCuUPcwGA4QFwPecdrOUw5ewQUADffoRSFmmhOmcZgc" \
  -H "Content-Type: application/json" \
  -d '{"startDate": "2024-11-01", "endDate": "2024-11-30"}'
```

✅ **预期返回格式**:
```json
{
  "success": true,
  "code": 200,
  "message": "操作成功",
  "data": {
    "materialCost": 5000,
    "laborCost": 3000,
    "equipmentCost": 2000,
    "otherCost": 1000,
    "totalCost": 11000,
    "materialCostRatio": 45.45,
    "laborCostRatio": 27.27,
    "equipmentCostRatio": 18.18,
    "otherCostRatio": 9.09
  }
}
```

### 测试 2: 后端 AI 时间范围分析 API

```bash
# 调用 AI 时间范围分析
curl -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/ai/analysis/cost/time-range" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiZmFjdG9yeV9zdXBlcl9hZG1pbiIsInVzZXJJZCI6IjEiLCJzdWIiOiIxIiwiaWF0IjoxNzYzNjczOTA5LCJleHAiOjE3NjM3NjAzMDl9.sCuUPcwGA4QFwPecdrOUw5ewQUADffoRSFmmhOmcZgc" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-11-01",
    "endDate": "2024-11-30",
    "dimension": "overall",
    "question": null
  }'
```

✅ **预期返回格式**:
```json
{
  "success": true,
  "code": 200,
  "message": "操作成功",
  "data": {
    "analysis": "本月成本分析：...",
    "session_id": "session_xxxxx",
    "quota": {
      "remaining": 18,
      "total": 20,
      "resetDate": "2024-11-28"
    }
  }
}
```

### 测试 3: 前端 API 调用验证

在 React Native 应用中：

1. **导航到时间范围成本分析页面**
   - 打开应用
   - 进入 Processing Dashboard
   - 点击 "时间范围分析"

2. **选择时间范围**
   - 点击 "本周" 快速选项
   - 观察日期范围更新

3. **加载成本数据**
   - 应该看到成本汇总卡片
   - 成本明细应该正确显示

4. **获取 AI 分析**
   - 点击 "获取AI分析报告" 按钮
   - 应该看到加载动画
   - AI 分析结果应该在 3-10 秒内出现

5. **多轮对话**
   - 点击快速问题或输入自定义问题
   - 应该得到新的 AI 分析结果

---

## 📊 数据库验证

### 验证 AI 分析结果已保存

```bash
# 连接数据库
mysql -u root cretas_db

# 查看最新的 AI 分析结果
SELECT id, factory_id, report_type, period_start, period_end,
       created_at, expires_at FROM ai_analysis_results
WHERE factory_id = 'CRETAS_2024_001'
ORDER BY created_at DESC LIMIT 5\G

# 查看批次数据
SELECT id, batch_number, factory_id, status, actual_quantity,
       yield_rate, total_cost FROM production_batches
WHERE factory_id = 'CRETAS_2024_001'
LIMIT 10\G

# 查看配额信息
SELECT user_id, factory_id, quota_limit, quota_used,
       reset_date FROM ai_quotas
WHERE factory_id = 'CRETAS_2024_001'\G
```

---

## 🐛 常见问题排查

### 问题 1: Python AI 服务无法连接

**症状**: 后端报错 "Cannot connect to AI service"

**排查**:
```bash
# 检查 Python 服务是否运行
lsof -i :8085

# 如果没有输出，重启 Python 服务
pkill -f "main_enhanced.py"
cd backend-java/backend-ai-chat
python main_enhanced.py
```

### 问题 2: 后端无法连接数据库

**症状**: 后端启动失败，日志显示 "Connection refused"

**排查**:
```bash
# 检查 MySQL 是否运行
mysql.server status

# 启动 MySQL
mysql.server start

# 验证数据库和表
mysql -u root cretas_db -e "SHOW TABLES LIKE 'production_%'"
```

### 问题 3: 前端 API 调用返回 401

**症状**: TimeRangeCostAnalysisScreen 显示错误

**原因**: Token 过期或无效

**解决**:
1. 重新登录应用
2. 确保使用有效的工厂用户账户
3. 检查后端日志中的令牌验证错误

### 问题 4: AI 分析返回空结果

**症状**: AI 分析完成但返回空的 analysis 字段

**原因**: 可能是时间范围内没有生产批次

**排查**:
```bash
# 检查时间范围内的批次
mysql -u root cretas_db -e "SELECT COUNT(*) FROM production_batches
WHERE factory_id = 'CRETAS_2024_001'
AND created_at >= '2024-11-01'
AND created_at <= '2024-11-30'"
```

如果结果为 0，需要先创建一些测试批次。

---

## 📈 性能指标

### 预期响应时间

| API 端点 | 预期响应时间 | 说明 |
|---------|-----------|------|
| `/reports/cost-analysis` | < 500ms | 数据库查询，不需要AI |
| `/ai/analysis/cost/time-range` (首次) | 3-10秒 | 需要调用AI服务 |
| `/ai/analysis/cost/time-range` (缓存命中) | < 100ms | 返回缓存结果 |

### 配额消耗

| 分析类型 | 消耗配额 |
|---------|---------|
| 时间范围分析 | 2次 |
| 批次成本分析 | 1次 |
| 批次对比分析 | 2次 |
| 多轮对话 Follow-up | 少量消耗 |

**每周配额**: 默认 20 次，每周日自动重置

---

## ✨ 完整功能检查清单

### 后端功能
- [ ] Spring Boot 成功启动
- [ ] MySQL 数据库连接正常
- [ ] ReportController `/cost-analysis` 端点返回正确数据
- [ ] AIController `/analysis/cost/time-range` 端点可以调用
- [ ] 时间范围内能查到生产批次数据
- [ ] AI 分析结果保存到数据库
- [ ] 配额正确消耗

### 前端功能
- [ ] TimeRangeCostAnalysisScreen 页面正常加载
- [ ] 时间范围选项工作正常
- [ ] 成本数据正确加载和显示
- [ ] AI 分析能够调用
- [ ] AI 分析结果正确显示
- [ ] 配额信息正确更新
- [ ] 快速问题选项工作正常
- [ ] 自定义问题输入工作正常

### Python AI 服务
- [ ] FastAPI 服务成功启动
- [ ] 能够接收来自 Java 后端的请求
- [ ] LLM 分析返回结果
- [ ] 返回中文分析文本

---

## 🎯 后续优化方向

1. **性能优化**
   - 实现批次数据分页加载
   - 优化 AI Prompt 大小，减少 token 消耗
   - 添加请求队列防止并发过高

2. **功能扩展**
   - 支持导出 AI 分析结果为 PDF
   - 添加更多维度分析 (日/周/月)
   - 支持对比多个时间段的数据

3. **用户体验**
   - 添加分析进度条
   - 支持后台分析任务
   - 添加分析历史查看

---

## 📞 支持和反馈

如果遇到问题，请：
1. 查看本文档的"常见问题排查"部分
2. 检查后端日志: `/www/wwwroot/cretas/cretas-backend.log`
3. 提交 Issue 或联系开发团队

---

**最后更新**: 2024-11-21
**作者**: Cretas AI Integration Team
