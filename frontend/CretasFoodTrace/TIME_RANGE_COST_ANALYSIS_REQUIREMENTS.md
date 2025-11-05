# 时间范围成本分析 - 后端API需求文档

**创建日期**: 2025-11-04
**功能模块**: 生产成本分析
**优先级**: P1 - 高优先级
**状态**: 前端已实现，等待后端开发

---

## 📋 功能概述

用户可以选择时间范围（日期区间）来查看该时间段内的成本汇总分析，包括：
- 总成本统计
- 批次数量统计
- 平均单批成本
- 成本明细分解（原材料、人工、设备、管理费用）
- 批次列表及成本
- AI智能分析（可选）

---

## 🎯 用户流程

1. 用户点击生产仪表板的"成本分析"按钮
2. 选择"按时间范围分析"
3. 选择快捷时间范围（今天/本周/本月）或自定义日期区间
4. 系统加载该时间段内的成本数据
5. 显示成本汇总、成本明细和批次列表
6. （可选）用户可以请求AI生成分析报告

---

## 🔧 后端API需求

### API 1: 获取时间范围成本分析数据

**路径**: `GET /api/mobile/{factoryId}/processing/cost-analysis/time-range`

**请求参数**:
```json
{
  "startDate": "2025-11-01T00:00:00.000Z",  // ISO 8601格式
  "endDate": "2025-11-04T23:59:59.999Z"     // ISO 8601格式
}
```

**响应格式**:
```json
{
  "success": true,
  "data": {
    "totalCost": 156800.00,           // 总成本
    "totalBatches": 12,                // 批次数量
    "avgCostPerBatch": 13066.67,       // 平均单批成本
    "costBreakdown": {
      "rawMaterials": 98000.00,        // 原材料成本
      "labor": 35000.00,               // 人工成本
      "equipment": 18800.00,           // 设备成本
      "overhead": 5000.00              // 管理费用
    },
    "batches": [
      {
        "id": "BATCH001",
        "batchNumber": "BATCH001",
        "productType": "白垩纪羊肉",
        "totalCost": 12500.00,
        "date": "2025-11-01T08:00:00.000Z",
        "status": "completed"
      },
      {
        "id": "BATCH002",
        "batchNumber": "BATCH002",
        "productType": "白垩纪牛肉",
        "totalCost": 15800.00,
        "date": "2025-11-02T09:30:00.000Z",
        "status": "completed"
      }
      // ... 更多批次
    ],
    "period": {
      "startDate": "2025-11-01T00:00:00.000Z",
      "endDate": "2025-11-04T23:59:59.999Z"
    }
  }
}
```

**业务逻辑**:
1. 查询指定时间范围内所有批次（建议使用 `createdAt` 或 `startTime` 字段）
2. 计算每个批次的成本（使用现有的 `ProcessingBatchRepository.calculateBatchCost()` 方法）
3. 聚合所有批次的成本数据
4. 按成本类型分类汇总（原材料、人工、设备、管理费用）
5. 计算统计指标（总成本、批次数、平均成本）

**数据库查询示例** (参考现有代码):
```java
// 使用ProcessingBatchRepository的现有方法
// 1. 获取时间范围内的批次
List<ProductionBatch> batches = productionBatchRepository
    .findByFactoryIdAndCreatedAtBetween(factoryId, startDate, endDate);

// 2. 对每个批次计算成本
for (ProductionBatch batch : batches) {
    BatchCostBreakdown cost = processingService.calculateBatchCost(batch.getId());
    // 聚合成本数据...
}

// 3. 使用现有的聚合查询方法（如果需要优化性能）
// processProductionBatchRepository.calculateTotalCostAfter(factoryId, startDate);
// processProductionBatchRepository.calculateDailyCost(factoryId, startDate, endDate);
```

**参考现有代码**:
- `ProcessingBatchRepository.calculateTotalCostAfter()` - 已有的时间范围成本计算
- `ProcessingBatchRepository.calculateDailyCost()` - 已有的日成本计算
- `AIEnterpriseService.generateWeeklyReport()` - 周报生成逻辑可复用

---

### API 2: AI时间范围成本分析（可选）

**路径**: `POST /api/mobile/{factoryId}/processing/ai-cost-analysis/time-range`

**请求体**:
```json
{
  "startDate": "2025-11-01T00:00:00.000Z",
  "endDate": "2025-11-04T23:59:59.999Z",
  "question": "本周成本相比上周有什么变化？",  // 可选
  "session_id": "session_12345"                  // 可选，支持连续对话
}
```

**响应格式**:
```json
{
  "success": true,
  "data": {
    "analysisText": "## 本周成本分析\n\n### 成本概览\n...",
    "session_id": "session_12345",
    "expiresAt": "2025-11-04T15:30:00.000Z",
    "cached": false
  }
}
```

**业务逻辑**:
1. 获取时间范围内的成本数据（调用API 1的逻辑）
2. 调用DeepSeek AI API生成分析报告
3. 缓存分析结果（30分钟）
4. 记录AI审计日志
5. 检查配额使用情况

**参考现有代码**:
- `AIEnterpriseService.generateWeeklyReport()` - 周报生成逻辑
- `AIEnterpriseService.callAIForBatchAnalysis()` - AI调用逻辑
- `AIQuotaService` - 配额管理

---

## 📊 数据库表关系

### 主要涉及的表：

1. **production_batch** - 生产批次表
   - `id` - 批次ID
   - `factory_id` - 工厂ID
   - `batch_number` - 批次号
   - `created_at` - 创建时间（用于时间范围筛选）
   - `start_time` - 开始生产时间
   - `end_time` - 完成生产时间

2. **material_consumption** - 原材料消耗表
   - `batch_id` - 关联批次
   - `cost` - 原材料成本

3. **employee_work_session** - 员工工时表
   - `batch_id` - 关联批次
   - `labor_cost` - 人工成本

4. **equipment_usage** - 设备使用表
   - `batch_id` - 关联批次
   - `equipment_cost` - 设备成本

### 成本计算逻辑（参考现有实现）:

```sql
-- 已有的时间范围成本查询示例（来自ProductionBatchRepository）

-- 1. 计算指定日期后的总成本
@Query(value = "SELECT SUM(total_cost) FROM processing_batches " +
               "WHERE factory_id = ?1 AND created_at >= ?2",
       nativeQuery = true)
Double calculateTotalCostAfter(String factoryId, LocalDateTime afterDate);

-- 2. 计算每日成本
@Query(value = "SELECT DATE(created_at) as date, SUM(total_cost) as daily_cost " +
               "FROM processing_batches " +
               "WHERE factory_id = ?1 AND created_at BETWEEN ?2 AND ?3 " +
               "GROUP BY DATE(created_at)",
       nativeQuery = true)
List<Map<String, Object>> calculateDailyCost(String factoryId,
                                               LocalDateTime startDate,
                                               LocalDateTime endDate);
```

---

## 🎨 前端实现状态

### 已完成 ✅:
1. ✅ ProcessingDashboard - 添加了"成本分析"选择对话框
2. ✅ TimeRangeCostAnalysisScreen - 完整的时间范围分析UI
3. ✅ API Client - processingApiClient.getTimeRangeCostAnalysis()
4. ✅ Navigation - 路由配置和类型定义
5. ✅ 日期选择器 - react-native-paper-dates集成
6. ✅ 快捷时间范围 - 今天/本周/本月/自定义

### 前端文件清单:
- `src/screens/processing/ProcessingDashboard.tsx` - 入口对话框
- `src/screens/processing/TimeRangeCostAnalysisScreen.tsx` - 时间范围分析页面
- `src/services/api/processingApiClient.ts` - API客户端（方法14-15）
- `src/navigation/ProcessingStackNavigator.tsx` - 导航配置
- `src/types/navigation.ts` - 类型定义

---

## 🧪 前端测试方案

### 当前行为（后端API未实现时）:
- 前端自动使用模拟数据
- 控制台显示警告：`⚠️ 后端API未实现，使用模拟数据`
- 用户可以正常测试UI交互和流程

### 测试步骤:
1. 启动前端应用
2. 登录工厂用户账号
3. 导航到"生产"标签
4. 点击"成本分析"按钮
5. 选择"按时间范围分析"
6. 选择不同的时间范围（今天/本周/本月/自定义）
7. 验证数据显示正确
8. 查看控制台日志确认API调用

---

## 📝 后端开发任务清单

### Task 1: 实现时间范围成本查询API
- [ ] 创建 `TimeRangeCostAnalysisDTO` 数据传输对象
- [ ] 在 `ProcessingService` 中实现 `getTimeRangeCostAnalysis()` 方法
- [ ] 复用现有的成本计算逻辑
- [ ] 添加批次聚合逻辑
- [ ] 在 `ProcessingController` 中添加 GET endpoint
- [ ] 添加参数验证（日期格式、范围合理性）
- [ ] 单元测试和集成测试

### Task 2: AI时间范围分析（可选，P2优先级）
- [ ] 扩展 `AIEnterpriseService` 以支持自定义时间范围
- [ ] 实现 `generateTimeRangeReport()` 方法
- [ ] 复用周报/月报的AI调用逻辑
- [ ] 在 `ProcessingController` 中添加 POST endpoint
- [ ] 测试AI分析效果

### Task 3: 性能优化（可选）
- [ ] 添加数据库索引（created_at, factory_id）
- [ ] 实现查询结果缓存（Redis）
- [ ] 优化大时间范围的查询性能

---

## 🔗 相关文档

### 后端参考文档:
- `AI_COST_ANALYSIS_IMPLEMENTATION.md` - AI成本分析完整实现文档
- `V1.5__ai_cost_analysis_tables.sql` - AI分析相关数据库表
- `AIReportScheduler.java` - 定时报告生成逻辑（可参考）
- `AIEnterpriseService.java` - AI企业服务实现
- `ProcessingBatchRepository.java` - 批次查询方法

### 前端参考文档:
- `COST_ANALYSIS_NAVIGATION.md` - 成本分析导航流程文档
- `CostAnalysisDashboard/README.md` - 单批次成本分析组件文档

---

## 💡 实现建议

### 1. 最小化实现（MVP）
优先实现API 1（时间范围成本查询），AI分析可以后续添加。

### 2. 复用现有代码
- 使用 `ProcessingBatchRepository` 的现有查询方法
- 复用 `calculateBatchCost()` 的成本计算逻辑
- 参考 `generateWeeklyReport()` 的数据聚合方式

### 3. 性能考虑
- 对于大时间范围（如1年），考虑分页或限制
- 添加合理的超时设置
- 使用数据库索引优化查询

### 4. 用户体验
- 返回数据时包含批次详情，方便用户查看明细
- 提供清晰的错误消息
- 考虑添加导出功能（CSV/Excel）

---

## ✅ 验收标准

### 后端API验收:
1. ✅ API返回正确的成本汇总数据
2. ✅ 支持不同的时间范围（天/周/月/自定义）
3. ✅ 成本明细分类正确（原材料、人工、设备、管理费用）
4. ✅ 批次列表包含必要信息
5. ✅ 响应时间 < 3秒（正常时间范围）
6. ✅ 错误处理完善（无效日期、无权限等）

### 前后端集成验收:
1. ✅ 前端成功调用后端API
2. ✅ 数据显示格式正确
3. ✅ 不同时间范围切换正常
4. ✅ 日期选择器功能正常
5. ✅ 错误场景处理正确

---

## 📞 联系方式

如有疑问，请查阅：
- 📄 本文档
- 📚 `AI_COST_ANALYSIS_IMPLEMENTATION.md`
- 💬 前端代码注释

**文档版本**: v1.0.0
**最后更新**: 2025-11-04
