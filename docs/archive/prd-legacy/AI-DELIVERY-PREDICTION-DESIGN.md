# AI 交付完成概率预测 - 后端实现方案

## 1. 功能概述

### 1.1 业务目标
为生产批次提供 AI 驱动的交付完成概率预测，帮助工厂管理员：
- 实时评估进行中批次能否按时交付
- 识别高风险批次，提前采取措施
- 优化生产排程和资源分配

### 1.2 预测指标
- **完成概率** (0-100%): 批次按时完成的可能性
- **风险等级**: 高 (>=80%) / 中 (50-79%) / 低 (<50%)
- **影响因素**: 导致风险的主要原因分析

---

## 2. 数据需求

### 2.1 实体数据来源

| 数据维度 | 实体 | 关键字段 |
|---------|------|---------|
| 批次信息 | `ProductionBatch` | status, plannedQuantity, actualQuantity, startTime |
| 交付时间 | `ProductionPlan` | expectedCompletionDate |
| 原材料 | `MaterialBatch` | status, availableQuantity, reservedQuantity |
| 设备状态 | `FactoryEquipment` | status, lastMaintenanceDate |
| 历史效率 | `ProcessingStageRecord` | durationMinutes, outputWeight |
| 工人效率 | `EmployeeWorkSession` | hoursWorked, performanceScore |

### 2.2 历史数据要求
- **最少样本**: 100+ 已完成批次
- **时间跨度**: 最近 90 天
- **数据质量**: 包含完整的开始/结束时间和实际产量

---

## 3. API 设计

### 3.1 单批次预测

**端点**: `GET /api/mobile/{factoryId}/reports/delivery-prediction/{batchId}`

**响应示例**:
```json
{
  "success": true,
  "data": {
    "batchId": "PB-20251227-001",
    "batchNumber": "PB-20251227-001",
    "expectedDeliveryTime": "2025-12-27T18:00:00",
    "currentProgress": 65,
    "prediction": {
      "completionProbability": 92,
      "riskLevel": "LOW",
      "confidenceScore": 0.85,
      "estimatedCompletionTime": "2025-12-27T17:30:00"
    },
    "riskFactors": [
      {
        "factor": "EQUIPMENT_STATUS",
        "impact": "LOW",
        "description": "设备运行正常"
      },
      {
        "factor": "MATERIAL_AVAILABILITY",
        "impact": "NONE",
        "description": "原材料充足"
      }
    ],
    "aiAnalysis": {
      "summary": "基于历史数据分析，该批次有92%的概率按时完成...",
      "recommendations": [
        "保持当前生产节奏",
        "无需额外资源调配"
      ]
    },
    "generatedAt": "2025-12-27T14:30:00"
  }
}
```

### 3.2 批量预测

**端点**: `GET /api/mobile/{factoryId}/reports/delivery-predictions`

**查询参数**:
- `status`: 批次状态 (IN_PROGRESS, PLANNED)
- `riskLevel`: 风险等级过滤 (HIGH, MEDIUM, LOW)
- `date`: 预期交付日期

**响应**: 返回多个批次的预测结果数组

---

## 4. 算法设计

### 4.1 特征工程

```java
public class DeliveryPredictionFeatures {
    // 批次特征
    private double progressRate;           // 当前进度百分比
    private double timeRemainingHours;     // 距交付剩余小时数
    private double plannedQuantity;        // 计划产量
    private double currentOutputRate;      // 当前产出速率 (kg/hour)

    // 历史特征
    private double historicalOnTimeRate;   // 历史按时交付率
    private double avgProductionCycle;     // 平均生产周期
    private double productTypeAvgYield;    // 该产品类型平均良品率

    // 资源特征
    private double materialAvailability;   // 原材料可用性评分 (0-1)
    private double equipmentReliability;   // 设备可靠性评分 (0-1)
    private double workerEfficiency;       // 工人效率评分 (0-1)

    // 外部因素
    private int concurrentBatches;         // 同时进行的批次数
    private boolean hasMaintenanceScheduled; // 是否有维护计划
}
```

### 4.2 预测逻辑

```java
@Service
public class DeliveryPredictionService {

    public DeliveryPrediction predict(String factoryId, Long batchId) {
        // 1. 收集特征数据
        DeliveryPredictionFeatures features = collectFeatures(factoryId, batchId);

        // 2. 基础概率计算 (基于进度和时间)
        double baseProb = calculateBaseProb(features);

        // 3. 风险因素调整
        List<RiskFactor> risks = assessRiskFactors(features);
        double adjustedProb = applyRiskAdjustments(baseProb, risks);

        // 4. AI 深度分析 (可选)
        AIAnalysis aiAnalysis = performAIAnalysis(features, adjustedProb);

        // 5. 构建预测结果
        return buildPrediction(adjustedProb, risks, aiAnalysis);
    }

    private double calculateBaseProb(DeliveryPredictionFeatures f) {
        // 基于当前产出速率和剩余时间
        double requiredRate = (f.plannedQuantity * (1 - f.progressRate))
                             / f.timeRemainingHours;
        double rateRatio = f.currentOutputRate / requiredRate;

        // Sigmoid 转换为概率
        return sigmoid(rateRatio - 1) * 100;
    }
}
```

### 4.3 风险因素评估

| 风险因素 | 权重 | 评估标准 |
|---------|------|---------|
| 进度落后 | 30% | 实际进度 < 期望进度 |
| 原材料不足 | 25% | 可用库存 < 剩余需求 |
| 设备异常 | 20% | 设备状态非 RUNNING |
| 工人效率 | 15% | 当前效率 < 历史平均 |
| 并发负载 | 10% | 同时批次数 > 阈值 |

---

## 5. LLM/AI 集成

### 5.1 提示词模板

```python
DELIVERY_PREDICTION_PROMPT = """
你是一个生产调度AI助手。请分析以下生产批次数据，预测其按时完成的概率。

## 批次信息
- 批次号: {batch_number}
- 产品: {product_name}
- 计划产量: {planned_quantity} kg
- 当前进度: {progress}%
- 预期交付时间: {expected_delivery}
- 剩余时间: {remaining_hours} 小时

## 当前状态
- 当前产出速率: {current_rate} kg/小时
- 原材料可用量: {material_available} kg
- 设备状态: {equipment_status}
- 工人数量: {worker_count} 人

## 历史数据
- 该产品历史按时交付率: {historical_rate}%
- 平均生产周期: {avg_cycle} 小时
- 最近5批良品率: {recent_yields}

请提供:
1. 完成概率评估 (0-100%)
2. 主要风险因素分析
3. 具体建议措施

以JSON格式输出:
{
  "probability": 数字,
  "risk_level": "HIGH/MEDIUM/LOW",
  "risk_factors": ["因素1", "因素2"],
  "recommendations": ["建议1", "建议2"],
  "reasoning": "详细分析..."
}
"""
```

### 5.2 Python 服务扩展

```python
# ai_service/delivery_prediction.py

class DeliveryPredictionAnalyzer:
    def __init__(self, ai_service: AIService):
        self.ai_service = ai_service

    async def analyze(self, batch_data: dict) -> dict:
        prompt = DELIVERY_PREDICTION_PROMPT.format(**batch_data)

        response = await self.ai_service.analyze_with_thinking(
            prompt=prompt,
            enable_thinking=True,  # 启用深度推理
            max_tokens=2000
        )

        return self._parse_response(response)

    def _parse_response(self, response: str) -> dict:
        # 解析 AI 返回的 JSON
        # 添加容错处理
        pass
```

---

## 6. 实施路线图

### Phase 1: 基础预测 (3-4天)
- [ ] 创建 `DeliveryPredictionService` 接口和实现
- [ ] 实现特征收集逻辑
- [ ] 实现基础概率计算算法
- [ ] 添加 API 端点

### Phase 2: 风险评估 (2-3天)
- [ ] 实现风险因素评估模块
- [ ] 添加概率调整逻辑
- [ ] 集成设备、原材料、工人效率数据

### Phase 3: AI 增强 (3-4天)
- [ ] 设计 AI/LLM 提示词
- [ ] 扩展 Python AI 服务
- [ ] 实现 Java 到 AI 服务的调用
- [ ] 添加缓存机制 (5分钟过期)

### Phase 4: 优化与测试 (2-3天)
- [ ] 性能优化
- [ ] 准确性验证
- [ ] 前端集成测试
- [ ] 文档完善

**预计总工期**: 10-14 天

---

## 7. 数据库变更

### 7.1 新增表 (可选)

```sql
-- 预测历史记录表 (用于模型优化)
CREATE TABLE delivery_predictions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    factory_id VARCHAR(50) NOT NULL,
    predicted_probability DECIMAL(5,2),
    risk_level VARCHAR(20),
    actual_completed_on_time BOOLEAN,
    prediction_time DATETIME,
    completion_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_batch_id (batch_id),
    INDEX idx_factory_id (factory_id),
    INDEX idx_prediction_time (prediction_time)
);
```

### 7.2 现有表利用
- `production_batches` - 批次基础数据
- `production_plans` - 交付时间
- `material_batches` - 原材料状态
- `factory_equipment` - 设备状态
- `processing_stage_records` - 生产效率数据

---

## 8. 注意事项

### 8.1 性能考虑
- 预测结果缓存 5 分钟
- AI 分析可设置为可选（降级到规则预测）
- 批量预测使用并行处理

### 8.2 准确性保障
- 初期使用规则 + AI 混合模式
- 收集预测结果与实际结果，持续优化
- 设置置信度阈值，低置信度时显示警告

### 8.3 用户体验
- 预测概率实时刷新（进度变化时）
- 提供"为什么"解释（AI reasoning）
- 风险批次突出显示

---

## 9. 相关文件

| 文件 | 说明 |
|------|------|
| `/backend-java/src/main/java/com/cretas/aims/service/DeliveryPredictionService.java` | 预测服务接口 |
| `/backend-java/src/main/java/com/cretas/aims/service/impl/DeliveryPredictionServiceImpl.java` | 预测服务实现 |
| `/backend-java/src/main/java/com/cretas/aims/dto/DeliveryPredictionDTO.java` | 预测结果 DTO |
| `/backend-java/src/main/java/com/cretas/aims/controller/ReportController.java` | API 端点 |
| `/ai-service/delivery_prediction.py` | Python AI 分析模块 |
