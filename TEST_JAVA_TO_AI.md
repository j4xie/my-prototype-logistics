# Java 后端调用 AI 服务测试指南

## 📋 架构图

```
React Native 前端
    ↓
    ↓ (HTTP POST)
    ↓
Java Spring Boot 后端 (10010)
    ↓
    ↓ (HTTP POST /api/ai/chat)
    ↓
Python AI 服务 (8085)
    ↓
    ↓ (Hugging Face Llama 模型)
    ↓
返回 AI 分析结果
```

---

## 🔧 Java 后端已有的核心类

### 1. **AIAnalysisService**
`src/main/java/com/cretas/aims/service/AIAnalysisService.java`

- 负责调用 Python AI 服务
- 配置 AI 服务 URL: `cretas.ai.service.url=http://localhost:8085`
- 支持多轮对话（sessionId）
- 格式化成本数据为提示词

### 2. **AIController**
`src/main/java/com/cretas/aims/controller/AIController.java`

- REST API 端点: `/api/mobile/{factoryId}/ai/analysis/cost/batch`
- 支持批次成本分析
- 支持时间范围分析

### 3. **AIEnterpriseService**
企业级 AI 服务，包含配额管理

---

## 🚀 测试方式

### 方式1️⃣: 直接调用后端 API（推荐）

Java 后端已经暴露了 API 端点，你可以直接调用：

**API 端点**:
```
POST /api/mobile/{factoryId}/ai/analysis/cost/batch
```

**请求示例** (在宝塔终端):

```bash
curl -X POST http://localhost:10010/api/mobile/CRETAS_2024_001/ai/analysis/cost/batch \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiZmFjdG9yeV9zdXBlcl9hZG1pbiIsInVzZXJJZCI6IjEiLCJzdWIiOiIxIiwiaWF0IjoxNzYzNjczOTA5LCJleHAiOjE3NjM3NjAzMDl9.sCuUPcwGA4QFwPecdrOUw5ewQUADffoRSFmmhOmcZgc" \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "BATCH_001",
    "costData": {
      "totalMaterialCost": 1000,
      "totalLaborCost": 500,
      "totalEquipmentCost": 300
    }
  }'
```

**预期响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "success": true,
    "aiAnalysis": "【**成本结构分析**】\n\n根据批次的成本数据...",
    "sessionId": "session_xxxxx",
    "messageCount": 1
  }
}
```

---

### 方式2️⃣: 在 Java 代码中调用（开发者）

如果你要在 Java 后端代码中直接调用 AI 服务：

```java
// 注入 AIAnalysisService
@Autowired
private AIAnalysisService aiAnalysisService;

// 调用方法
Map<String, Object> costData = new HashMap<>();
costData.put("totalMaterialCost", 1000);
costData.put("totalLaborCost", 500);
costData.put("totalEquipmentCost", 300);

Map<String, Object> result = aiAnalysisService.analyzeCost(
    "CRETAS_2024_001",           // factoryId
    "BATCH_001",                  // batchId
    costData,                      // 成本数据
    null,                          // sessionId (首次为 null)
    null                           // customMessage (使用默认格式化)
);

System.out.println(result);
```

---

## 📊 测试场景

### 场景1️⃣: 简单成本分析

**请求数据**:
```json
{
  "batchId": "BATCH_SIMPLE_001",
  "costData": {
    "totalMaterialCost": 1000,
    "totalLaborCost": 500,
    "totalEquipmentCost": 300
  }
}
```

**AI 会进行**:
- 成本比例分析
- 成本合理性评估
- 优化建议

---

### 场景2️⃣: 完整生产数据分析

**请求数据** (增强版):
```json
{
  "batchId": "BATCH_FULL_001",
  "costData": {
    "batchInfo": {
      "batchNumber": "BATCH_20251121_001",
      "productName": "鲜品鱼类",
      "status": "COMPLETED",
      "plannedQuantity": 500,
      "actualQuantity": 450,
      "goodQuantity": 440,
      "defectQuantity": 10,
      "yieldRate": 97.8,
      "efficiency": 95.5
    },
    "materialConsumptions": [
      {
        "materialName": "大黄鱼",
        "quantity": 500,
        "unit": "kg",
        "cost": 2000,
        "supplier": { "name": "供应商A" }
      }
    ],
    "equipmentUsages": [
      {
        "equipmentName": "切割机",
        "durationHours": 4,
        "cost": 300
      }
    ],
    "laborSessions": [
      {
        "employee": { "fullName": "张三" },
        "workType": { "name": "切割" },
        "workMinutes": 240,
        "laborCost": 120
      }
    ],
    "costSummary": {
      "totalCost": 2420,
      "materialCostRatio": 82.6,
      "laborCostRatio": 10.5,
      "equipmentCostRatio": 6.9,
      "unitCost": 5.49
    }
  }
}
```

**AI 会进行深度分析**:
- 完整业务链成本分析
- 各环节效率评估
- 质量指标分析
- 详细的优化建议

---

### 场景3️⃣: 多轮对话（Follow-up）

**第一次请求** (获取 sessionId):
```bash
curl -X POST http://localhost:10010/api/mobile/CRETAS_2024_001/ai/analysis/cost/batch \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"batchId": "BATCH_001", "costData": {...}}'
```

**响应** (包含 sessionId):
```json
{
  "sessionId": "session_abc123xyz789",
  "aiAnalysis": "...",
  "messageCount": 1
}
```

**第二次请求** (使用 sessionId 追问):
```bash
curl -X POST http://localhost:10010/api/mobile/CRETAS_2024_001/ai/analysis/cost/batch \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "BATCH_001",
    "question": "基于上述分析，如何降低人工成本？",
    "sessionId": "session_abc123xyz789"
  }'
```

---

## ✅ 配置检查

### 确保后端配置正确

编辑 `application.properties` 或 `application.yml`:

```properties
# AI 服务配置
cretas.ai.service.url=http://localhost:8085
cretas.ai.service.timeout=30000
```

**或者 YAML 格式**:
```yaml
cretas:
  ai:
    service:
      url: http://localhost:8085
      timeout: 30000
```

---

## 🧪 测试命令汇总

### 1️⃣ 检查 Java 后端是否运行

```bash
lsof -i :10010
```

### 2️⃣ 检查 AI 服务是否运行

```bash
lsof -i :8085
```

### 3️⃣ 测试后端 AI 接口

```bash
curl -X POST http://localhost:10010/api/mobile/CRETAS_2024_001/ai/analysis/cost/batch \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiZmFjdG9yeV9zdXBlcl9hZG1pbiIsInVzZXJJZCI6IjEiLCJzdWIiOiIxIiwiaWF0IjoxNzYzNjczOTA5LCJleHAiOjE3NjM3NjAzMDl9.sCuUPcwGA4QFwPecdrOUw5ewQUADffoRSFmmhOmcZgc" \
  -H "Content-Type: application/json" \
  -d '{"batchId":"TEST_001","costData":{"totalMaterialCost":1000,"totalLaborCost":500,"totalEquipmentCost":300}}'
```

### 4️⃣ 查看后端日志

```bash
tail -f /www/wwwroot/project/logs/cretas-backend.log
```

### 5️⃣ 查看 AI 服务日志

```bash
tail -f /www/wwwroot/project/logs/ai-service.log
```

---

## 📈 完整的请求/响应流程

```
【前端】React Native
    ↓
POST /api/mobile/CRETAS_2024_001/ai/analysis/cost/batch
{
  "batchId": "BATCH_001",
  "costData": {...}
}

    ↓
【后端】Spring Boot (10010)
AIController.analyzeBatchCost()
    ↓
AIAnalysisService.analyzeCost()
    ↓
POST http://localhost:8085/api/ai/chat
{
  "message": "【批次信息】...",
  "user_id": "CRETAS_2024_001_batch_BATCH_001"
}

    ↓
【AI 服务】Python FastAPI (8085)
处理请求并调用 Llama 模型
    ↓
返回分析结果
{
  "success": true,
  "aiAnalysis": "【**成本结构分析**】...",
  "sessionId": "session_xxx",
  "messageCount": 1
}

    ↓
【后端】处理响应
{
  "code": 200,
  "message": "success",
  "data": {...}
}

    ↓
【前端】展示给用户
```

---

## 🎯 现在就测试！

你已经有：
- ✅ Java 后端在 10010 运行
- ✅ AI 服务在 8085 运行
- ✅ 防火墙已开放两个端口

现在直接执行这个命令测试：

```bash
curl -X POST http://localhost:10010/api/mobile/CRETAS_2024_001/ai/analysis/cost/batch \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiZmFjdG9yeV9zdXBlcl9hZG1pbiIsInVzZXJJZCI6IjEiLCJzdWIiOiIxIiwiaWF0IjoxNzYzNjczOTA5LCJleHAiOjE3NjM3NjAzMDl9.sCuUPcwGA4QFwPecdrOUw5ewQUADffoRSFmmhOmcZgc" \
  -H "Content-Type: application/json" \
  -d '{"batchId":"TEST_001","costData":{"totalMaterialCost":1000,"totalLaborCost":500,"totalEquipmentCost":300}}'
```

如果看到 `"code":200` 和 AI 分析结果，说明完全成功了！ 🎉

---

**完整的前后端 AI 集成链路已经打通！** 🚀
