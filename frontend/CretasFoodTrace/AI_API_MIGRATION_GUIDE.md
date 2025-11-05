# 前端AI API迁移指南

**版本**: v2.0.0
**日期**: 2025-11-04
**状态**: ✅ 迁移工具已就绪，示例已更新

---

## 📋 概述

本指南帮助前端开发者将现有的AI API调用从旧的分散端点迁移到新的**统一AI API**。

### 为什么要迁移？

1. **✅ 解决后端编译错误** - 旧API有重复方法名导致编译失败
2. **✅ API结构更清晰** - 统一路径前缀 `/ai/*`
3. **✅ 更好的类型安全** - 完整的TypeScript类型定义
4. **✅ 易于维护** - 单一的API客户端
5. **✅ 向后兼容** - 旧API仍然可用（已标记废弃）

---

## 🚀 快速开始

### 1. 导入新的API客户端

```typescript
// 旧方式（废弃）
import { processingAPI } from '../../services/api/processingApiClient';

// 新方式（推荐）
import { aiApiClient } from '../../services/api/aiApiClient';
```

### 2. 更新API调用

```typescript
// 旧方式（废弃）
const response = await processingAPI.aiCostAnalysis({
  batchId: batchId.toString(),
  question: question,
  session_id: sessionId,
});

// 新方式（推荐）
const response = await aiApiClient.analyzeBatchCost({
  batchId: Number(batchId),
  question: question,
  sessionId: sessionId,
  analysisType: 'default',
});
```

### 3. 更新响应处理

```typescript
// 字段名称变化
// response.data.session_id  → response.session_id
// response.data.analysis    → response.analysis
// response.data.quota       → response.quota

if (response.success) {
  setAiAnalysis(response.analysis);      // 注意：不是 response.data.analysis
  setSessionId(response.session_id);     // 注意：不是 response.data.session_id
  setQuota(response.quota);              // 注意：不是 response.data.quota
}
```

---

## 📊 API对照表

### 批次成本分析

#### 旧API（废弃）
```typescript
// 方式1
POST /api/mobile/{factoryId}/processing/batches/{batchId}/ai-cost-analysis
await processingAPI.aiCostAnalysisByBatchId(batchId, { question, sessionId });

// 方式2
POST /api/mobile/{factoryId}/processing/ai-cost-analysis
await processingAPI.aiCostAnalysis({
  batchId: batchId.toString(),
  question: question,
  session_id: sessionId,
});
```

#### 新API（推荐）
```typescript
POST /api/mobile/{factoryId}/ai/analysis/cost/batch
await aiApiClient.analyzeBatchCost({
  batchId: Number(batchId),
  question?: string,
  sessionId?: string,
  analysisType?: 'default' | 'deep' | 'comparison',
});
```

**响应格式变化**:
```typescript
// 旧响应
{
  success: true,
  data: {
    analysis: string,
    session_id: string,
    quota: {...}
  }
}

// 新响应（扁平化）
{
  success: true,
  analysis: string,
  session_id: string,
  quota: {...},
  cacheHit?: boolean,
  responseTimeMs?: number,
  generatedAt?: string
}
```

---

### AI配额查询

#### 旧API（废弃）
```typescript
GET /api/mobile/{factoryId}/processing/ai-quota
await processingAPI.getAIQuota();
```

#### 新API（推荐）
```typescript
GET /api/mobile/{factoryId}/ai/quota
await aiApiClient.getQuotaInfo(factoryId);
```

**响应格式**: 保持不变

---

### AI对话历史

#### 旧API（废弃）
```typescript
GET /api/mobile/{factoryId}/processing/ai-sessions/{sessionId}
await processingAPI.getAISessionHistory(sessionId);
```

#### 新API（推荐）
```typescript
GET /api/mobile/{factoryId}/ai/conversations/{sessionId}
await aiApiClient.getConversation(sessionId, factoryId);
```

---

### AI报告列表

#### 旧API（废弃）
```typescript
GET /api/mobile/{factoryId}/processing/ai-reports
await processingAPI.getAIReports({ reportType, startDate, endDate });
```

#### 新API（推荐）
```typescript
GET /api/mobile/{factoryId}/ai/reports
await aiApiClient.getReports(
  { reportType, startDate, endDate },
  factoryId
);
```

---

### AI健康检查

#### 旧API（废弃）
```typescript
GET /api/mobile/{factoryId}/processing/ai-service/health
await processingAPI.checkAIServiceHealth();
```

#### 新API（推荐）
```typescript
GET /api/mobile/{factoryId}/ai/health
await aiApiClient.checkHealth(factoryId);
```

---

## 🔧 完整迁移示例

### 示例1: CostAnalysisDashboard.tsx（✅ 已迁移）

**文件**: `src/screens/processing/CostAnalysisDashboard.tsx`

#### 修改前
```typescript
import { processingAPI } from '../../services/api/processingApiClient';

const handleAiAnalysis = async (question?: string) => {
  try {
    const response = await processingAPI.aiCostAnalysis({
      batchId: batchId.toString(),
      question: question || undefined,
      session_id: aiSessionId || undefined,
    });

    if (response.success) {
      setAiAnalysis(response.data.analysis);
      setAiSessionId(response.data.session_id);
      if (response.data.quota) {
        setQuota(response.data.quota);
      }
    }
  } catch (error) {
    // 错误处理
  }
};
```

#### 修改后
```typescript
import { aiApiClient } from '../../services/api/aiApiClient';

const handleAiAnalysis = async (question?: string) => {
  try {
    const response = await aiApiClient.analyzeBatchCost({
      batchId: Number(batchId),
      question: question || undefined,
      sessionId: aiSessionId || undefined,
      analysisType: 'default',
    });

    if (response.success) {
      setAiAnalysis(response.analysis);           // 注意：字段名变化
      setAiSessionId(response.session_id || '');  // 注意：字段名变化
      if (response.quota) {
        setQuota(response.quota);                 // 注意：字段名变化
      }
    }
  } catch (error) {
    // 错误处理保持不变
  }
};
```

---

### 示例2: 配额查询组件（待迁移）

**假设文件**: `src/components/ai/AIQuotaDisplay.tsx`

#### 修改前
```typescript
import { processingAPI } from '../../services/api/processingApiClient';

const loadQuota = async () => {
  try {
    const response = await processingAPI.getAIQuota();
    setQuota(response.data);
  } catch (error) {
    console.error('加载配额失败', error);
  }
};
```

#### 修改后
```typescript
import { aiApiClient } from '../../services/api/aiApiClient';

const loadQuota = async () => {
  try {
    const quota = await aiApiClient.getQuotaInfo();
    setQuota(quota);  // 注意：直接返回数据，不是 response.data
  } catch (error) {
    console.error('加载配额失败', error);
  }
};
```

---

## 🆕 新功能

新的AI API客户端提供了额外的功能：

### 1. 时间范围成本分析

```typescript
const response = await aiApiClient.analyzeTimeRangeCost({
  startDate: '2025-11-01T00:00:00.000Z',
  endDate: '2025-11-30T23:59:59.999Z',
  dimension: 'overall',
  question: '这个月的成本趋势如何？',
});
```

### 2. 批次对比分析

```typescript
const response = await aiApiClient.compareBatchCosts({
  batchIds: [101, 102, 103],
  dimension: 'comprehensive',
  question: '哪个批次的效率最高？',
});
```

### 3. 关闭对话会话

```typescript
await aiApiClient.closeConversation(sessionId);
```

### 4. 生成报告

```typescript
const response = await aiApiClient.generateReport({
  reportType: 'weekly',
  startDate: '2025-11-01',
  endDate: '2025-11-07',
  title: '第45周成本报告',
});
```

---

## 📝 迁移检查清单

### 必须迁移的文件

- [x] `src/screens/processing/CostAnalysisDashboard.tsx` - ✅ 已迁移
- [ ] `src/screens/processing/CostAnalysisDashboard/hooks/useAIAnalysis.ts`
- [ ] `src/screens/platform/PlatformDashboardScreen.tsx`
- [ ] 其他使用AI API的自定义组件

### 可选迁移（如果存在）

- [ ] AI配额显示组件
- [ ] AI报告列表组件
- [ ] AI对话历史组件

### 测试清单

- [ ] **批次成本分析** - 点击AI分析按钮能正常工作
- [ ] **Follow-up对话** - 追问功能正常
- [ ] **配额显示** - 配额信息正确显示
- [ ] **错误处理** - 429/403错误正确处理
- [ ] **加载状态** - Loading动画正常
- [ ] **响应格式** - 所有字段访问正确

---

## 🐛 常见问题

### Q1: 为什么要改变响应格式？

**A**: 旧API返回 `response.data.analysis`，新API直接返回 `response.analysis`。这是为了统一响应格式，减少嵌套层级。

### Q2: 旧API还能用吗？

**A**: 可以！旧API已标记为 `@Deprecated` 但仍然可用。建议尽快迁移，旧API将在未来版本中移除。

### Q3: 类型定义在哪里？

**A**: 所有类型定义在 `src/services/api/aiApiClient.ts` 中。完整的TypeScript类型支持。

### Q4: 如何处理错误？

**A**: 错误处理逻辑保持不变。429（超限）、403（禁用）等HTTP状态码处理方式相同。

### Q5: factoryId参数是可选的吗？

**A**: 是的。如果不传 `factoryId`，API客户端会使用 `DEFAULT_FACTORY_ID` 常量。

---

## 🔍 查找需要迁移的代码

使用以下命令查找所有使用旧API的代码：

```bash
# 查找旧的AI API调用
cd frontend/CretasFoodTrace/src
grep -r "processingAPI.aiCostAnalysis" .
grep -r "processingAPI.getAIQuota" .
grep -r "processingAPI.getAIReports" .
grep -r "processingAPI.getAISessionHistory" .
grep -r "ai-cost-analysis" .
grep -r "ai-quota" .
grep -r "ai-reports" .
```

---

## 📞 支持

如果在迁移过程中遇到问题：

1. **查看类型定义**: `src/services/api/aiApiClient.ts`
2. **查看示例代码**: `src/screens/processing/CostAnalysisDashboard.tsx`
3. **参考后端API**: `/Users/jietaoxie/Downloads/cretas-backend-system-main/src/main/java/com/cretas/aims/controller/AIController.java`
4. **查阅完整报告**: `AI_API_REFACTORING_COMPLETED.md`

---

## ⏱️ 迁移时间表

### Phase 1: 准备工作（✅ 完成）
- [x] 后端创建新的AIController
- [x] 前端创建aiApiClient
- [x] 标记旧API为Deprecated
- [x] 创建迁移指南

### Phase 2: 核心组件迁移（🔄 进行中）
- [x] CostAnalysisDashboard.tsx（已完成）
- [ ] 其他使用AI API的组件
- [ ] 测试所有迁移的组件

### Phase 3: 清理工作（⏳ 待开始）
- [ ] 移除对旧API的所有引用
- [ ] 更新文档和注释
- [ ] 完整的端到端测试

### Phase 4: 下线旧API（📅 1个月后）
- [ ] 监控旧API使用率
- [ ] 当使用率 < 5% 时发布弃用公告
- [ ] 完全移除旧代码

---

## 📚 相关文档

- [AI API重构完成报告](../../../AI_API_REFACTORING_COMPLETED.md)
- [AI API重构计划](../../../AI_API_REFACTORING_PLAN.md)
- [AI API问题分析](./AI_API_ISSUES_ANALYSIS.md)
- [时间范围成本分析修复](./API_PATH_FIX.md)

---

**文档版本**: v1.0.0
**最后更新**: 2025-11-04
**维护状态**: ✅ 活跃维护
