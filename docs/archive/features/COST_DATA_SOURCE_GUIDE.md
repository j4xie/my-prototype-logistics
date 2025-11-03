# 成本数据来源与AI分析集成指南

## 🎯 核心问题：AI如何获得成本数据？

这份文档详细解释了**成本数据的来源、计算方式，以及如何传递给AI进行分析**。

---

## 📊 成本数据来源全景图

### 1. 数据库表结构

成本数据存储在多个关联表中：

```
production_batches (生产批次表)
├── material_cost      (原材料成本) ← 从 material_consumptions 计算
├── labor_cost         (人工成本)   ← 从 batch_work_sessions 计算
├── equipment_cost     (设备成本)   ← 从 equipment_usage 计算
├── other_cost         (其他成本)   ← 手动输入或计算
└── total_cost         (总成本)     ← 自动汇总

关联表：
├── material_consumptions      (原材料消耗记录)
├── batch_work_sessions        (员工工作会话)
├── employee_work_sessions     (员工工时记录)
└── equipment_usage            (设备使用记录)
```

### 2. ProductionBatch 实体（核心数据源）

**位置**: `src/main/java/com/cretas/aims/entity/ProductionBatch.java`

**核心字段**:

```java
public class ProductionBatch {
    // 基础信息
    private Long id;
    private String factoryId;
    private String batchNumber;           // 批次号
    private String productName;           // 产品名称

    // 生产数量
    private BigDecimal plannedQuantity;   // 计划产量
    private BigDecimal actualQuantity;    // 实际产量
    private BigDecimal goodQuantity;      // 良品数量
    private BigDecimal defectQuantity;    // 不良品数量

    // 成本数据（核心！）
    private BigDecimal materialCost;      // 原材料成本
    private BigDecimal laborCost;         // 人工成本
    private BigDecimal equipmentCost;     // 设备成本
    private BigDecimal otherCost;         // 其他成本
    private BigDecimal totalCost;         // 总成本
    private BigDecimal unitCost;          // 单位成本

    // 生产指标
    private BigDecimal yieldRate;         // 良品率
    private BigDecimal efficiency;        // 效率
    private Integer workDurationMinutes;  // 工作时长(分钟)
    private Integer workerCount;          // 工人数

    // 时间信息
    private LocalDateTime startTime;      // 开始时间
    private LocalDateTime endTime;        // 结束时间

    // 负责人信息
    private Integer supervisorId;         // 负责人ID
    private String supervisorName;        // 负责人名称
}
```

### 3. 成本计算逻辑

**在 `ProductionBatch.java` 的 `calculateMetrics()` 方法**:

```java
public void calculateMetrics() {
    // 1. 计算总成本（自动汇总）
    totalCost = BigDecimal.ZERO;
    if (materialCost != null) totalCost = totalCost.add(materialCost);
    if (laborCost != null) totalCost = totalCost.add(laborCost);
    if (equipmentCost != null) totalCost = totalCost.add(equipmentCost);
    if (otherCost != null) totalCost = totalCost.add(otherCost);

    // 2. 计算单位成本
    if (totalCost != null && actualQuantity != null && actualQuantity > 0) {
        unitCost = totalCost / actualQuantity;
    }

    // 3. 计算良品率
    if (goodQuantity != null && actualQuantity != null && actualQuantity > 0) {
        yieldRate = (goodQuantity / actualQuantity) * 100;
    }

    // 4. 计算效率
    if (actualQuantity != null && plannedQuantity != null && plannedQuantity > 0) {
        efficiency = (actualQuantity / plannedQuantity) * 100;
    }

    // 5. 计算工作时长
    if (startTime != null && endTime != null) {
        workDurationMinutes = Duration.between(startTime, endTime).toMinutes();
    }
}
```

---

## 🔍 现有的成本分析接口

### getBatchCostAnalysis 方法

**位置**: `ProcessingServiceImpl.java` 第440行

**当前实现**:

```java
public Map<String, Object> getBatchCostAnalysis(String factoryId, Long batchId) {
    // 1. 获取批次数据
    ProductionBatch batch = getBatchById(factoryId, batchId);

    // 2. 构建分析数据
    Map<String, Object> analysis = new HashMap<>();
    analysis.put("batch", batch);
    analysis.put("materialCost", batch.getMaterialCost());
    analysis.put("laborCost", batch.getLaborCost());
    analysis.put("equipmentCost", batch.getEquipmentCost());
    analysis.put("otherCost", batch.getOtherCost());
    analysis.put("totalCost", batch.getTotalCost());
    analysis.put("unitCost", batch.getUnitCost());

    // 3. 计算成本构成比例
    if (batch.getTotalCost() != null && batch.getTotalCost() > 0) {
        analysis.put("materialCostRatio",
            (materialCost / totalCost) * 100);
        analysis.put("laborCostRatio",
            (laborCost / totalCost) * 100);
        analysis.put("equipmentCostRatio",
            (equipmentCost / totalCost) * 100);
        analysis.put("otherCostRatio",
            (otherCost / totalCost) * 100);
    }

    return analysis;
}
```

**返回的数据格式**:

```json
{
  "batch": {
    "id": 1,
    "batchNumber": "BATCH_20251003_001",
    "productName": "冷冻鱼片",
    "plannedQuantity": 500.00,
    "actualQuantity": 480.00,
    "goodQuantity": 460.00,
    "defectQuantity": 20.00,
    "yieldRate": 95.83,
    "efficiency": 96.00,
    "workDurationMinutes": 510,
    "workerCount": 8
  },
  "materialCost": 2000.00,
  "laborCost": 1200.00,
  "equipmentCost": 400.00,
  "otherCost": 0.00,
  "totalCost": 3600.00,
  "unitCost": 7.50,
  "materialCostRatio": 55.56,
  "laborCostRatio": 33.33,
  "equipmentCostRatio": 11.11,
  "otherCostRatio": 0.00
}
```

---

## 🤖 AI如何获得成本数据？完整流程

### Step 1: 从数据库获取批次数据

```java
// ProcessingServiceImpl.java
ProductionBatch batch = productionBatchRepository
    .findByIdAndFactoryId(batchId, factoryId)
    .orElseThrow(() -> new ResourceNotFoundException("批次不存在"));
```

这一步会获取：
- ✅ 基础成本数据（materialCost, laborCost, equipmentCost）
- ✅ 生产指标（actualQuantity, yieldRate, efficiency）
- ✅ 时间数据（startTime, endTime, workDurationMinutes）
- ✅ 人员数据（workerCount, supervisorName）

### Step 2: 获取关联的详细数据（可选）

如果需要更详细的分析，可以查询关联表：

#### 2.1 原材料消耗详情

```java
// 获取原材料消耗记录
List<MaterialConsumption> materialConsumptions =
    materialConsumptionRepository.findByProductionBatchId(batchId);

// 计算明细
for (MaterialConsumption consumption : materialConsumptions) {
    String materialName = consumption.getBatch().getMaterialName();
    BigDecimal quantity = consumption.getQuantity();
    BigDecimal unitPrice = consumption.getUnitPrice();
    BigDecimal cost = consumption.getTotalCost();
}
```

#### 2.2 员工工时详情

```java
// 获取员工工作会话
List<BatchWorkSession> workSessions =
    batchWorkSessionRepository.findByBatchId(batchId);

// 计算明细
for (BatchWorkSession session : workSessions) {
    Integer employeeId = session.getEmployeeId();
    Integer workMinutes = session.getWorkMinutes();
    BigDecimal laborCost = session.getLaborCost();
}
```

#### 2.3 设备使用详情

```java
// 获取设备使用记录
List<EquipmentUsage> equipmentUsages =
    equipmentUsageRepository.findByProductionBatchId(batchId);

// 计算明细
for (EquipmentUsage usage : equipmentUsages) {
    String equipmentName = usage.getEquipment().getName();
    Integer durationHours = usage.getDurationHours();
    BigDecimal hourlyCost = usage.getEquipment().getHourlyCost();
}
```

### Step 3: 格式化为AI提示词

```java
// AIAnalysisService.java
private String formatCostDataForAI(String factoryId, Long batchId,
                                   Map<String, Object> costData) {
    StringBuilder prompt = new StringBuilder();

    // 基础信息
    prompt.append("批次编号: ").append(costData.get("batchNumber")).append("\n");
    prompt.append("产品名称: ").append(costData.get("productName")).append("\n\n");

    // 成本汇总
    prompt.append("【成本汇总】\n");
    prompt.append("总成本: ¥").append(costData.get("totalCost")).append("\n");
    prompt.append("原材料成本: ¥").append(costData.get("materialCost"))
          .append(" (").append(costData.get("materialCostRatio")).append("%)\n");
    prompt.append("人工成本: ¥").append(costData.get("laborCost"))
          .append(" (").append(costData.get("laborCostRatio")).append("%)\n");
    prompt.append("设备成本: ¥").append(costData.get("equipmentCost"))
          .append(" (").append(costData.get("equipmentCostRatio")).append("%)\n\n");

    // 生产数据
    prompt.append("【生产数据】\n");
    prompt.append("计划产量: ").append(costData.get("plannedQuantity")).append("kg\n");
    prompt.append("实际产量: ").append(costData.get("actualQuantity")).append("kg\n");
    prompt.append("良品率: ").append(costData.get("yieldRate")).append("%\n");
    prompt.append("生产时长: ").append(costData.get("workDurationMinutes") / 60.0)
          .append("小时\n\n");

    // 员工效率
    prompt.append("【员工效率】\n");
    prompt.append("员工人数: ").append(costData.get("workerCount")).append("人\n");
    prompt.append("总工时: ").append(costData.get("totalWorkHours")).append("小时\n");
    prompt.append("人均产量: ").append(costData.get("avgProductivity")).append("kg/人\n\n");

    prompt.append("请分析以上成本数据，识别问题点并提供优化建议。");

    return prompt.toString();
}
```

### Step 4: 调用AI服务

```java
// AIAnalysisService.java
public Map<String, Object> analyzeCost(String factoryId, Long batchId,
                                       Map<String, Object> costData) {
    // 1. 格式化为提示词
    String message = formatCostDataForAI(factoryId, batchId, costData);

    // 2. 构建请求
    Map<String, Object> request = new HashMap<>();
    request.put("message", message);
    request.put("user_id", factoryId + "_batch_" + batchId);

    // 3. 调用AI服务
    String aiServiceUrl = "http://localhost:8085/api/ai/chat";
    ResponseEntity<Map> response = restTemplate.postForEntity(
        aiServiceUrl, request, Map.class);

    // 4. 返回AI分析结果
    return response.getBody();
}
```

### Step 5: 示例 - AI接收到的完整提示词

```
批次编号: BATCH_20251003_001
产品名称: 冷冻鱼片

【成本汇总】
总成本: ¥3600
原材料成本: ¥2000 (55.56%)
人工成本: ¥1200 (33.33%)
设备成本: ¥400 (11.11%)

【生产数据】
计划产量: 500kg
实际产量: 480kg
良品率: 95.83%
生产时长: 8.5小时

【员工效率】
员工人数: 8人
总工时: 68小时
人均产量: 60kg/人

请分析以上成本数据，识别问题点并提供优化建议。
```

### Step 6: AI返回分析结果

```json
{
  "reply": "根据提供的成本数据分析：\n\n**成本结构分析**：\n- 原材料成本55.56%处于合理范围（正常50-60%）\n- 人工成本33.33%偏高，行业标准为25-30%\n- 设备成本11.11%合理\n\n**问题识别**：\n1. 人工成本占比偏高，建议优化人员配置\n2. 良品率95.83%可以提升至98%以上\n3. 人均产量60kg/人低于行业标准70-80kg/人\n\n**优化建议**：\n1. 减少1-2名操作工，优化工序流程\n2. 加强员工培训，提高良品率\n3. 检查设备效率，提高人均产量\n\n**预期收益**：\n- 减少2名工人可节省¥300/批次\n- 提高良品率至98%可减少损失¥150/批次\n- 总计可节省约¥450/批次（12.5%成本降低）",
  "session_id": "abc123def456",
  "message_count": 1
}
```

---

## 💡 关键要点总结

### 成本数据来源

| 成本类型 | 数据来源 | 计算方式 |
|---------|---------|---------|
| **原材料成本** | `material_consumptions` 表 | `SUM(quantity × unit_price)` |
| **人工成本** | `batch_work_sessions` 表 | `SUM(work_minutes × hourly_rate / 60)` |
| **设备成本** | `equipment_usage` 表 | `SUM(duration_hours × hourly_cost)` |
| **其他成本** | 手动输入 | 直接记录 |
| **总成本** | 自动计算 | `material + labor + equipment + other` |

### AI获取数据的三种方式

#### 方式1: 仅使用批次汇总数据（推荐 - 最简单）

```java
// 直接使用 ProductionBatch 表中已计算好的成本
public Map<String, Object> getBatchCostAnalysis(String factoryId, Long batchId) {
    ProductionBatch batch = getBatchById(factoryId, batchId);

    // 批次中已有所有汇总数据
    return Map.of(
        "totalCost", batch.getTotalCost(),
        "materialCost", batch.getMaterialCost(),
        "laborCost", batch.getLaborCost(),
        "equipmentCost", batch.getEquipmentCost(),
        "yieldRate", batch.getYieldRate(),
        "efficiency", batch.getEfficiency()
    );
}
```

**优点**:
- ✅ 最简单，数据已经计算好
- ✅ 查询速度快（只需1次查询）
- ✅ 足够用于基本AI分析

**缺点**:
- ❌ 没有详细的明细数据

#### 方式2: 包含部分明细数据（平衡）

```java
public Map<String, Object> getBatchCostAnalysisWithDetails(String factoryId, Long batchId) {
    // 1. 获取批次汇总
    ProductionBatch batch = getBatchById(factoryId, batchId);

    // 2. 获取原材料消耗明细（前3条）
    List<MaterialConsumption> topMaterials =
        materialConsumptionRepository.findTop3ByProductionBatchIdOrderByTotalCostDesc(batchId);

    // 3. 获取员工数量和平均效率
    Integer employeeCount = batchWorkSessionRepository.countByBatchId(batchId);
    Double avgProductivity = batch.getActualQuantity() / employeeCount;

    // 4. 组合数据
    return Map.of(
        "summary", batch,
        "topMaterials", topMaterials,
        "employeeCount", employeeCount,
        "avgProductivity", avgProductivity
    );
}
```

**优点**:
- ✅ 有足够的细节进行深度分析
- ✅ 查询次数可控（3-4次）
- ✅ AI可以给出更具体的建议

#### 方式3: 完整明细数据（最详细）

```java
public Map<String, Object> getBatchCostAnalysisFull(String factoryId, Long batchId) {
    ProductionBatch batch = getBatchById(factoryId, batchId);

    // 获取所有关联数据
    List<MaterialConsumption> allMaterials =
        materialConsumptionRepository.findByProductionBatchId(batchId);
    List<BatchWorkSession> allWorkSessions =
        batchWorkSessionRepository.findByBatchId(batchId);
    List<EquipmentUsage> allEquipmentUsages =
        equipmentUsageRepository.findByProductionBatchId(batchId);

    // 返回完整数据
    return Map.of(
        "batch", batch,
        "materials", allMaterials,
        "workSessions", allWorkSessions,
        "equipmentUsages", allEquipmentUsages
    );
}
```

**优点**:
- ✅ AI可以进行最深度的分析
- ✅ 可以识别具体的问题员工、设备、原材料

**缺点**:
- ❌ 查询慢（多次关联查询）
- ❌ 数据量大，AI token消耗多
- ❌ 不推荐用于实时分析

---

## 🚀 推荐实现方案

### 最佳实践：使用方式1（汇总数据）+ 按需补充明细

```java
@Service
public class AIAnalysisService {

    /**
     * AI成本分析 - 推荐实现
     */
    public Map<String, Object> analyzeCost(String factoryId, Long batchId) {
        // 1. 获取批次汇总数据（已包含所有核心指标）
        Map<String, Object> costData = processingService.getBatchCostAnalysis(factoryId, batchId);

        // 2. 补充关键计算数据（不需要额外查询数据库）
        ProductionBatch batch = (ProductionBatch) costData.get("batch");

        // 计算人均产量
        if (batch.getWorkerCount() != null && batch.getWorkerCount() > 0) {
            double avgProductivity = batch.getActualQuantity()
                .divide(BigDecimal.valueOf(batch.getWorkerCount()), 2, RoundingMode.HALF_UP)
                .doubleValue();
            costData.put("avgProductivity", avgProductivity);
        }

        // 计算总工时
        if (batch.getWorkDurationMinutes() != null && batch.getWorkerCount() != null) {
            double totalWorkHours = (batch.getWorkDurationMinutes() * batch.getWorkerCount()) / 60.0;
            costData.put("totalWorkHours", totalWorkHours);
        }

        // 计算CCR成本率（如果有人工成本）
        if (batch.getLaborCost() != null && batch.getWorkDurationMinutes() != null) {
            double ccrRate = batch.getLaborCost()
                .divide(BigDecimal.valueOf(batch.getWorkDurationMinutes()), 4, RoundingMode.HALF_UP)
                .doubleValue();
            costData.put("ccrRate", ccrRate);
        }

        // 3. 格式化为AI提示词
        String message = formatCostDataForAI(factoryId, batchId, costData);

        // 4. 调用AI服务
        Map<String, Object> aiRequest = new HashMap<>();
        aiRequest.put("message", message);
        aiRequest.put("user_id", factoryId + "_batch_" + batchId);

        ResponseEntity<Map> response = restTemplate.postForEntity(
            aiServiceUrl + "/api/ai/chat", aiRequest, Map.class);

        // 5. 返回结果
        Map<String, Object> result = new HashMap<>();
        result.put("batchId", batchId);
        result.put("batchNumber", batch.getBatchNumber());
        result.put("costSummary", costData);
        result.put("aiAnalysis", response.getBody().get("reply"));
        result.put("sessionId", response.getBody().get("session_id"));

        return result;
    }
}
```

---

## 📋 实现检查清单

### ✅ 数据层面
- [x] `ProductionBatch` 表已有所有核心成本字段
- [x] `calculateMetrics()` 方法自动计算总成本、单位成本、良品率
- [x] 关联表（`material_consumptions`, `batch_work_sessions`, `equipment_usage`）记录明细

### ✅ 服务层面
- [x] `getBatchCostAnalysis()` 方法已实现基本成本分析
- [ ] 需要新增 `analyzeWithAI()` 方法（调用AI服务）
- [ ] 需要新增 `AIAnalysisService` 类（AI服务客户端）

### ✅ AI层面
- [x] AI服务已配置（localhost:8085）
- [x] System Prompt已优化（成本分析专用）
- [x] API端点可用（POST /api/ai/chat）

### ✅ 配置层面
- [ ] 修改 `application.yml` 的 AI服务URL（8000 → 8085）
- [ ] 确保AI服务已启动

---

## 🎯 总结

### AI获取成本数据的完整路径

```
1. 前端请求
   POST /api/mobile/{factoryId}/processing/batches/{batchId}/ai-cost-analysis

2. Spring Boot 后端
   └─ ProcessingService.analyzeWithAI(factoryId, batchId)
      └─ getBatchCostAnalysis(factoryId, batchId)
         └─ 从 ProductionBatch 表获取所有成本数据
            ├─ materialCost (原材料成本)
            ├─ laborCost (人工成本)
            ├─ equipmentCost (设备成本)
            ├─ totalCost (总成本)
            ├─ yieldRate (良品率)
            ├─ efficiency (效率)
            └─ workDurationMinutes (工作时长)

3. 格式化数据
   └─ AIAnalysisService.formatCostDataForAI()
      └─ 将成本数据转换为自然语言提示词

4. 调用AI服务
   └─ POST http://localhost:8085/api/ai/chat
      └─ AI分析并返回建议

5. 返回结果
   └─ 包含成本汇总 + AI分析 + 会话ID
```

### 核心要点

1. **成本数据已经存在** - `ProductionBatch` 表已经有所有需要的成本数据
2. **无需复杂查询** - 使用汇总数据即可满足AI分析需求
3. **AI服务已就绪** - 只需要调用 `localhost:8085/api/ai/chat`
4. **实现简单** - 主要工作是格式化数据为AI提示词

---

**现在你应该完全明白了：成本数据从哪里来，如何传递给AI！** 🎉
