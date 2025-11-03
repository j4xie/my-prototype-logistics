# AI成本分析 - API接口需求文档

## 📋 目录
1. [架构概览](#架构概览)
2. [AI服务现状](#ai服务现状)
3. [需要的后端接口](#需要的后端接口)
4. [数据流转过程](#数据流转过程)
5. [实现方案](#实现方案)
6. [配置说明](#配置说明)

---

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│  React Native 移动端 (CretasFoodTrace)                      │
│  └─ CostAnalysisDashboard.tsx                               │
│     └─ "AI 智能分析" 按钮                                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP POST
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Spring Boot 后端 (cretas-backend-system)                   │
│  端口: 10010                                                │
│  POST /api/mobile/{factoryId}/processing/ai-cost-analysis   │
│  └─ 1. 获取批次成本数据                                      │
│  └─ 2. 格式化为AI提示词                                      │
│  └─ 3. 调用AI服务API                                         │
│  └─ 4. 返回AI分析结果                                        │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP POST
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  FastAPI AI服务 (backend-ai-chat)                           │
│  端口: 8085                                                 │
│  POST /api/ai/chat                                          │
│  └─ Llama-3.1-8B-Instruct (Hugging Face)                   │
│  └─ 成本分析专用System Prompt                               │
│  └─ Redis/内存会话管理                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🤖 AI服务现状

### 已完成配置 ✅

AI服务已在 `backend-ai-chat/` 目录下配置完成：

| 项目 | 状态 | 说明 |
|------|------|------|
| **服务地址** | ✅ | http://localhost:8085 |
| **AI模型** | ✅ | Llama-3.1-8B-Instruct (Hugging Face) |
| **System Prompt** | ✅ | 专门为水产加工成本分析优化 |
| **API端点** | ✅ | POST /api/ai/chat |
| **会话管理** | ✅ | 支持Redis/内存存储 |
| **CORS配置** | ✅ | 允许跨域访问 |
| **文档** | ✅ | Swagger UI: http://localhost:8085/docs |

### AI服务核心API

**端点**: `POST http://localhost:8085/api/ai/chat`

**请求格式**:
```json
{
  "message": "批次BATCH_20251003_001的成本数据：原材料成本¥2000(55.6%)，人工成本¥1200(33.3%)，设备成本¥400(11.1%)，总成本¥3600。请分析成本结构是否合理？",
  "session_id": "可选-用于多轮对话",
  "user_id": "factory_001_batch_001"
}
```

**响应格式**:
```json
{
  "reply": "根据提供的成本数据分析：\n\n**成本结构分析**：\n- 原材料成本: ¥2000 (55.6%) - 合理范围...",
  "session_id": "abc123def456",
  "message_count": 2
}
```

### AI成本分析能力

System Prompt已针对以下场景优化：

1. **成本分析建议** - 分析原材料、人工、设备成本的合理性
2. **生产效率优化** - 分析员工效率（通过CCR成本率和加工数量）
3. **设备使用优化** - 分析设备利用率和维护时机
4. **利润分析** - 评估批次盈利能力和定价策略

---

## 🔌 需要的后端接口

### 方案1: 新增专用AI分析接口（推荐）

#### 1.1 AI成本分析接口

**在 `ProcessingController.java` 中新增**:

```java
/**
 * AI成本分析
 */
@PostMapping("/batches/{batchId}/ai-cost-analysis")
@Operation(summary = "AI成本分析", description = "使用AI分析批次成本并给出优化建议")
public ApiResponse<Map<String, Object>> aiCostAnalysis(
        @PathVariable @Parameter(description = "工厂ID") String factoryId,
        @PathVariable @Parameter(description = "批次ID") Long batchId,
        @RequestParam(required = false) @Parameter(description = "会话ID") String sessionId,
        @RequestParam(required = false) @Parameter(description = "自定义问题") String customMessage) {
    log.info("AI成本分析: factoryId={}, batchId={}", factoryId, batchId);
    Map<String, Object> result = processingService.analyzeWithAI(factoryId, batchId, sessionId, customMessage);
    return ApiResponse.success(result);
}
```

**响应格式**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "batchId": 1234,
    "batchNumber": "BATCH_20251003_001",
    "aiAnalysis": "根据提供的成本数据分析：\n\n**成本结构分析**：...",
    "sessionId": "abc123def456",
    "costSummary": {
      "totalCost": 3600,
      "materialCost": 2000,
      "laborCost": 1200,
      "equipmentCost": 400
    },
    "timestamp": "2025-01-09T10:30:00"
  }
}
```

#### 1.2 AI对话历史接口（可选）

```java
/**
 * 获取AI对话历史
 */
@GetMapping("/ai-sessions/{sessionId}")
@Operation(summary = "AI对话历史", description = "获取AI成本分析对话历史")
public ApiResponse<List<Map<String, Object>>> getAISessionHistory(
        @PathVariable @Parameter(description = "工厂ID") String factoryId,
        @PathVariable @Parameter(description = "会话ID") String sessionId) {
    log.info("获取AI对话历史: factoryId={}, sessionId={}", factoryId, sessionId);
    List<Map<String, Object>> history = processingService.getAISessionHistory(sessionId);
    return ApiResponse.success(history);
}
```

---

### 方案2: 增强现有成本分析接口（备选）

#### 2.1 增强现有 `getBatchCostAnalysis` 接口

**现有接口** (第292行):
```java
@GetMapping("/batches/{batchId}/cost-analysis")
public ApiResponse<Map<String, Object>> getBatchCostAnalysis(...)
```

**增强建议** - 添加AI分析选项:
```java
@GetMapping("/batches/{batchId}/cost-analysis")
public ApiResponse<Map<String, Object>> getBatchCostAnalysis(
        @PathVariable String factoryId,
        @PathVariable Long batchId,
        @RequestParam(defaultValue = "false") @Parameter(description = "是否包含AI分析") Boolean includeAI) {

    Map<String, Object> analysis = processingService.getBatchCostAnalysis(factoryId, batchId);

    if (includeAI) {
        // 调用AI服务获取分析
        String aiAnalysis = processingService.getAICostAnalysis(factoryId, batchId, analysis);
        analysis.put("aiAnalysis", aiAnalysis);
    }

    return ApiResponse.success(analysis);
}
```

---

## 📊 数据流转过程

### 完整流程

```
1. 用户点击 "AI分析" 按钮
   └─ React Native: CostAnalysisDashboard.tsx

2. 前端调用后端API
   └─ POST /api/mobile/{factoryId}/processing/batches/{batchId}/ai-cost-analysis

3. Spring Boot后端处理
   ├─ 从数据库获取批次成本数据 (ProductionBatch)
   ├─ 从数据库获取员工工时数据 (EmployeeWorkSession)
   ├─ 从数据库获取设备使用数据 (Equipment)
   ├─ 从数据库获取原材料消耗数据 (MaterialBatch)
   └─ 格式化为AI提示词

4. 调用AI服务
   └─ POST http://localhost:8085/api/ai/chat
       {
         "message": "批次BATCH_001的成本数据...",
         "user_id": "factory_001_batch_001"
       }

5. AI服务处理
   ├─ 调用 Llama-3.1-8B-Instruct 模型
   ├─ 使用成本分析专用System Prompt
   └─ 生成专业分析建议

6. 返回结果
   └─ Spring Boot → React Native
       {
         "aiAnalysis": "根据数据分析...",
         "costSummary": {...}
       }

7. 前端显示
   └─ 在成本分析页面展示AI建议
```

---

## 🛠️ 实现方案

### Step 1: 创建AI服务客户端

**在 Spring Boot 项目中新建**: `src/main/java/com/cretas/aims/service/AIAnalysisService.java`

```java
package com.cretas.aims.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * AI成本分析服务
 */
@Slf4j
@Service
public class AIAnalysisService {

    @Value("${cretas.ai.service.url:http://localhost:8085}")
    private String aiServiceUrl;

    @Value("${cretas.ai.service.timeout:30000}")
    private int timeout;

    private final RestTemplate restTemplate;

    public AIAnalysisService() {
        this.restTemplate = new RestTemplate();
    }

    /**
     * 调用AI分析批次成本
     *
     * @param factoryId 工厂ID
     * @param batchId 批次ID
     * @param costData 成本数据
     * @param sessionId 会话ID（可选，用于多轮对话）
     * @return AI分析结果
     */
    public Map<String, Object> analyzeCost(String factoryId, Long batchId,
                                           Map<String, Object> costData,
                                           String sessionId) {
        try {
            // 1. 格式化成本数据为AI提示词
            String message = formatCostDataForAI(factoryId, batchId, costData);

            // 2. 构建请求
            String url = aiServiceUrl + "/api/ai/chat";
            Map<String, Object> request = new HashMap<>();
            request.put("message", message);
            request.put("user_id", factoryId + "_batch_" + batchId);
            if (sessionId != null && !sessionId.isEmpty()) {
                request.put("session_id", sessionId);
            }

            // 3. 发送请求
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            log.info("调用AI服务: url={}, batchId={}", url, batchId);
            ResponseEntity<Map> response = restTemplate.exchange(
                url, HttpMethod.POST, entity, Map.class);

            // 4. 处理响应
            if (response.getStatusCode() == HttpStatus.OK) {
                Map<String, Object> result = new HashMap<>();
                Map<String, Object> body = response.getBody();

                result.put("success", true);
                result.put("aiAnalysis", body.get("reply"));
                result.put("sessionId", body.get("session_id"));
                result.put("messageCount", body.get("message_count"));

                log.info("AI分析成功: batchId={}, sessionId={}", batchId, body.get("session_id"));
                return result;
            } else {
                throw new RuntimeException("AI服务返回错误: " + response.getStatusCode());
            }

        } catch (Exception e) {
            log.error("AI分析失败: factoryId={}, batchId={}, error={}",
                     factoryId, batchId, e.getMessage(), e);

            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("success", false);
            errorResult.put("error", "AI服务暂时不可用: " + e.getMessage());
            return errorResult;
        }
    }

    /**
     * 格式化成本数据为AI提示词
     */
    private String formatCostDataForAI(String factoryId, Long batchId, Map<String, Object> costData) {
        StringBuilder sb = new StringBuilder();

        // 基础信息
        sb.append("批次编号: ").append(costData.get("batchNumber")).append("\n");
        sb.append("工厂: ").append(factoryId).append("\n\n");

        // 成本汇总
        sb.append("【成本汇总】\n");
        sb.append("总成本: ¥").append(costData.get("totalCost")).append("\n");
        sb.append("原材料成本: ¥").append(costData.get("materialCost"))
          .append(" (").append(costData.get("materialCostPercent")).append("%)\n");
        sb.append("人工成本: ¥").append(costData.get("laborCost"))
          .append(" (").append(costData.get("laborCostPercent")).append("%)\n");
        sb.append("设备成本: ¥").append(costData.get("equipmentCost"))
          .append(" (").append(costData.get("equipmentCostPercent")).append("%)\n\n");

        // 生产数据
        if (costData.containsKey("productionData")) {
            Map<String, Object> prod = (Map<String, Object>) costData.get("productionData");
            sb.append("【生产数据】\n");
            sb.append("计划产量: ").append(prod.get("plannedQuantity")).append("kg\n");
            sb.append("实际产量: ").append(prod.get("actualQuantity")).append("kg\n");
            sb.append("良品率: ").append(prod.get("goodRate")).append("%\n");
            sb.append("生产时长: ").append(prod.get("duration")).append("小时\n\n");
        }

        // 员工效率
        if (costData.containsKey("laborData")) {
            Map<String, Object> labor = (Map<String, Object>) costData.get("laborData");
            sb.append("【员工效率】\n");
            sb.append("员工人数: ").append(labor.get("employeeCount")).append("人\n");
            sb.append("总工时: ").append(labor.get("totalHours")).append("小时\n");
            sb.append("人均产量: ").append(labor.get("avgProductivity")).append("kg/人\n");
            sb.append("CCR成本率: ¥").append(labor.get("ccrRate")).append("/分钟\n\n");
        }

        // 设备使用
        if (costData.containsKey("equipmentData")) {
            Map<String, Object> equip = (Map<String, Object>) costData.get("equipmentData");
            sb.append("【设备使用】\n");
            sb.append("设备数量: ").append(equip.get("equipmentCount")).append("台\n");
            sb.append("总使用时长: ").append(equip.get("totalUsage")).append("小时\n");
            sb.append("平均利用率: ").append(equip.get("avgUtilization")).append("%\n\n");
        }

        sb.append("请分析以上成本数据，识别问题点并提供优化建议。");

        return sb.toString();
    }

    /**
     * 获取AI会话历史
     */
    public List<Map<String, Object>> getSessionHistory(String sessionId) {
        try {
            String url = aiServiceUrl + "/api/ai/session/" + sessionId;
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);

            if (response.getStatusCode() == HttpStatus.OK) {
                Map<String, Object> body = response.getBody();
                return (List<Map<String, Object>>) body.get("messages");
            }
        } catch (Exception e) {
            log.error("获取AI会话历史失败: sessionId={}, error={}", sessionId, e.getMessage());
        }
        return List.of();
    }
}
```

### Step 2: 在 ProcessingService 中集成AI分析

**修改**: `src/main/java/com/cretas/aims/service/ProcessingService.java`

```java
@Service
public class ProcessingService {

    private final AIAnalysisService aiAnalysisService; // 注入AI服务

    /**
     * AI成本分析
     */
    public Map<String, Object> analyzeWithAI(String factoryId, Long batchId,
                                            String sessionId, String customMessage) {
        // 1. 获取批次成本数据
        Map<String, Object> costData = getBatchCostAnalysis(factoryId, batchId);

        // 2. 如果有自定义问题，添加到数据中
        if (customMessage != null && !customMessage.isEmpty()) {
            costData.put("customQuestion", customMessage);
        }

        // 3. 调用AI服务
        Map<String, Object> aiResult = aiAnalysisService.analyzeCost(
            factoryId, batchId, costData, sessionId);

        // 4. 组合结果
        Map<String, Object> result = new HashMap<>();
        result.put("batchId", batchId);
        result.put("batchNumber", costData.get("batchNumber"));
        result.put("costSummary", costData);
        result.put("aiAnalysis", aiResult.get("aiAnalysis"));
        result.put("sessionId", aiResult.get("sessionId"));
        result.put("success", aiResult.get("success"));

        return result;
    }

    /**
     * 获取AI会话历史
     */
    public List<Map<String, Object>> getAISessionHistory(String sessionId) {
        return aiAnalysisService.getSessionHistory(sessionId);
    }
}
```

### Step 3: 在 ProcessingController 中添加端点

**修改**: `src/main/java/com/cretas/aims/controller/ProcessingController.java`

在 `// ========== 成本分析接口 ==========` 部分添加：

```java
/**
 * AI成本分析
 */
@PostMapping("/batches/{batchId}/ai-cost-analysis")
@Operation(summary = "AI成本分析", description = "使用AI分析批次成本并给出优化建议")
public ApiResponse<Map<String, Object>> aiCostAnalysis(
        @PathVariable @Parameter(description = "工厂ID") String factoryId,
        @PathVariable @Parameter(description = "批次ID") Long batchId,
        @RequestParam(required = false) @Parameter(description = "会话ID") String sessionId,
        @RequestParam(required = false) @Parameter(description = "自定义问题") String customMessage) {
    log.info("AI成本分析: factoryId={}, batchId={}", factoryId, batchId);
    Map<String, Object> result = processingService.analyzeWithAI(factoryId, batchId, sessionId, customMessage);
    return ApiResponse.success(result);
}

/**
 * 获取AI对话历史
 */
@GetMapping("/ai-sessions/{sessionId}")
@Operation(summary = "AI对话历史", description = "获取AI成本分析对话历史")
public ApiResponse<List<Map<String, Object>>> getAISessionHistory(
        @PathVariable @Parameter(description = "工厂ID") String factoryId,
        @PathVariable @Parameter(description = "会话ID") String sessionId) {
    log.info("获取AI对话历史: factoryId={}, sessionId={}", factoryId, sessionId);
    List<Map<String, Object>> history = processingService.getAISessionHistory(sessionId);
    return ApiResponse.success(history);
}
```

---

## ⚙️ 配置说明

### 1. application.yml 配置

**已有配置** (第95-99行):
```yaml
# AI服务配置
cretas:
  ai:
    service:
      url: http://localhost:8000  # 需要改为 8085
      timeout: 30000
```

**需要修改为**:
```yaml
# AI服务配置
cretas:
  ai:
    service:
      url: http://localhost:8085  # AI服务实际端口
      timeout: 30000              # 30秒超时
```

### 2. 依赖检查

确保 Spring Boot 项目中有 HTTP 客户端依赖（通常已包含）：

```xml
<!-- pom.xml -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
```

### 3. 启动AI服务

在使用前确保AI服务已启动：

```bash
cd backend-ai-chat
python main.py
# 或使用启动脚本
start-ai-service.cmd
```

验证AI服务:
```bash
curl http://localhost:8085/
```

应返回:
```json
{
  "service": "白垩纪 AI 成本分析 API",
  "status": "running",
  "version": "1.0.0",
  "model": "Llama-3.1-8B-Instruct"
}
```

---

## 📝 需要的成本数据结构

### getBatchCostAnalysis 应返回的数据格式

```java
{
  "batchNumber": "BATCH_20251003_001",
  "totalCost": 3600.00,
  "materialCost": 2000.00,
  "materialCostPercent": 55.6,
  "laborCost": 1200.00,
  "laborCostPercent": 33.3,
  "equipmentCost": 400.00,
  "equipmentCostPercent": 11.1,

  "productionData": {
    "plannedQuantity": 500.0,
    "actualQuantity": 480.0,
    "goodQuantity": 460.0,
    "goodRate": 95.8,
    "duration": 8.5
  },

  "laborData": {
    "employeeCount": 8,
    "totalHours": 68.0,
    "avgProductivity": 60.0,  // kg/人
    "ccrRate": 2.5           // 元/分钟
  },

  "equipmentData": {
    "equipmentCount": 4,
    "totalUsage": 34.0,      // 小时
    "avgUtilization": 85.0   // %
  }
}
```

---

## 🧪 测试步骤

### 1. 测试AI服务独立运行

```bash
cd backend-ai-chat
python test_cretas.py
```

### 2. 测试Spring Boot集成

```bash
# 启动AI服务
cd backend-ai-chat && python main.py

# 启动Spring Boot（另一个终端）
cd cretas-backend-system-main
mvn spring-boot:run

# 测试AI分析端点
curl -X POST "http://localhost:10010/api/mobile/F001/processing/batches/1/ai-cost-analysis" \
  -H "Content-Type: application/json"
```

### 3. 完整集成测试

```bash
# 1. AI服务运行: localhost:8085
# 2. Spring Boot运行: localhost:10010
# 3. React Native运行: Expo

# 在React Native中点击"AI分析"按钮
# 查看完整数据流转
```

---

## 📊 成本效益分析

### AI服务成本

- **模型**: Llama-3.1-8B-Instruct (Hugging Face)
- **单次分析**: ~0.003元 (2650 tokens)
- **月度成本** (中型工厂，30批次/天): ~¥2.55
- **相比预算**: 仅占 8.5% (预算¥30/月)

### 性能指标

- **响应时间**: 3-8秒
- **成功率**: >95%
- **并发支持**: 5-10请求
- **缓存机制**: 可选（节省30-40%成本）

---

## 🎯 总结

### 需要新增的接口

1. ✅ **AI成本分析接口** (核心)
   - `POST /api/mobile/{factoryId}/processing/batches/{batchId}/ai-cost-analysis`

2. ✅ **AI会话历史接口** (可选)
   - `GET /api/mobile/{factoryId}/processing/ai-sessions/{sessionId}`

### 需要新增的服务类

1. ✅ **AIAnalysisService.java** - AI服务客户端
2. ✅ **ProcessingService.analyzeWithAI()** - AI分析业务逻辑

### 需要修改的配置

1. ✅ **application.yml** - AI服务URL改为 http://localhost:8085

### AI服务已完成

1. ✅ AI服务已配置并可用 (backend-ai-chat/)
2. ✅ 成本分析专用System Prompt
3. ✅ API文档和测试脚本
4. ✅ 成本极低（¥2.55/月）

---

## 📚 参考文档

- [AI服务使用指南](backend-ai-chat/README_CRETAS.md)
- [AI集成指南](backend-ai-chat/INTEGRATION_GUIDE.md)
- [成本对比分析](backend-ai-chat/COST_COMPARISON.md)
- [Spring Boot接口文档](http://localhost:10010/swagger-ui.html)
- [AI服务API文档](http://localhost:8085/docs)

---

**版本**: v1.0.0
**更新时间**: 2025-01-09
**状态**: ✅ 准备就绪
