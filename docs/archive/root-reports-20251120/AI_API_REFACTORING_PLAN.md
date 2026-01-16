# AI API 完整重构方案

**日期**: 2025-11-04
**策略**: 长期架构优化
**目标**: 创建统一、清晰、易维护的AI API架构
**预计工作量**: 1-2天（后端）+ 4-6小时（前端）

---

## 🎯 重构目标

### 核心原则
1. **单一职责** - 每个Controller专注于一个领域
2. **RESTful设计** - 遵循REST API最佳实践
3. **清晰的资源层级** - `/ai/resource/action` 结构
4. **统一的响应格式** - 标准化数据结构
5. **向后兼容** - 保留旧端点一段时间

### 解决的问题
- ✅ 消除编译错误（同名方法）
- ✅ 统一AI相关端点到一个Controller
- ✅ 清晰区分配额、分析、会话、报告
- ✅ 支持未来扩展（多模型、流式响应等）

---

## 📁 新的API架构设计

### 整体结构

```
/api/mobile/{factoryId}/ai/
├── analysis/          # AI分析相关
│   ├── cost/         # 成本分析
│   └── quality/      # 质量分析（未来）
├── quota/            # 配额管理
├── conversations/    # 对话会话
├── reports/          # 历史报告
└── health/           # 健康检查
```

---

## 🔧 详细API规范

### 1. AI成本分析 (/ai/analysis/cost)

#### 1.1 单批次成本分析
```
POST /api/mobile/{factoryId}/ai/analysis/cost/batch/{batchId}

Request Body:
{
  "question": "string (optional)",    # 自定义问题
  "sessionId": "string (optional)",   # 会话ID（多轮对话）
  "analysisDepth": "basic|detailed|comprehensive"  # 分析深度
}

Response:
{
  "success": true,
  "data": {
    "batchId": "string",
    "analysisText": "string (markdown)",   # AI分析结果
    "sessionId": "string",                 # 会话ID
    "insights": [                           # 结构化洞察
      {
        "category": "cost_optimization",
        "severity": "high|medium|low",
        "description": "string",
        "actionItems": ["string"]
      }
    ],
    "costBreakdown": {                     # 成本明细
      "materialCost": 0.00,
      "laborCost": 0.00,
      "equipmentCost": 0.00,
      "overheadCost": 0.00,
      "totalCost": 0.00
    },
    "comparisonWithAverage": {             # 与平均值对比
      "percentageDifference": 0.00,
      "interpretation": "string"
    },
    "metadata": {
      "generatedAt": "2025-11-04T10:00:00Z",
      "model": "llm",
      "quotaConsumed": 1,
      "cached": false
    }
  }
}
```

#### 1.2 时间范围成本分析
```
POST /api/mobile/{factoryId}/ai/analysis/cost/time-range

Request Body:
{
  "startDate": "2025-11-01",             # LocalDate格式
  "endDate": "2025-11-04",
  "aggregationType": "daily|weekly|monthly",  # 聚合类型
  "question": "string (optional)",
  "sessionId": "string (optional)"
}

Response:
{
  "success": true,
  "data": {
    "period": {
      "startDate": "2025-11-01",
      "endDate": "2025-11-04"
    },
    "analysisText": "string (markdown)",
    "sessionId": "string",
    "aggregatedData": {
      "totalCost": 0.00,
      "averageDailyCost": 0.00,
      "batchCount": 0,
      "costByCategory": {
        "materialCost": 0.00,
        "laborCost": 0.00,
        "equipmentCost": 0.00,
        "overheadCost": 0.00
      }
    },
    "trends": [                             # 趋势数据
      {
        "date": "2025-11-01",
        "cost": 0.00,
        "batchCount": 0
      }
    ],
    "insights": [...],                      # 同上
    "metadata": {...}                       # 同上
  }
}
```

#### 1.3 批次对比分析
```
POST /api/mobile/{factoryId}/ai/analysis/cost/compare

Request Body:
{
  "batchIds": ["batch1", "batch2", "batch3"],  # 最多5个批次
  "comparisonDimensions": [                     # 对比维度
    "total_cost",
    "material_efficiency",
    "labor_efficiency"
  ],
  "question": "string (optional)"
}

Response:
{
  "success": true,
  "data": {
    "analysisText": "string (markdown)",
    "comparison": [
      {
        "batchId": "string",
        "batchNumber": "string",
        "metrics": {
          "totalCost": 0.00,
          "materialEfficiency": 0.00,
          "laborEfficiency": 0.00
        },
        "rank": 1
      }
    ],
    "recommendations": [...],
    "metadata": {...}
  }
}
```

---

### 2. 配额管理 (/ai/quota)

#### 2.1 获取配额信息
```
GET /api/mobile/{factoryId}/ai/quota

Response:
{
  "success": true,
  "data": {
    "factoryId": "string",
    "quotaType": "weekly",
    "currentPeriod": {
      "startDate": "2025-11-04",           # 本周一
      "endDate": "2025-11-10"              # 本周日
    },
    "quota": {
      "total": 100,                         # 总配额
      "used": 45,                           # 已使用
      "remaining": 55,                      # 剩余
      "percentageUsed": 45.0
    },
    "usage": [                              # 使用明细
      {
        "date": "2025-11-04",
        "count": 12,
        "types": {
          "batch_analysis": 8,
          "time_range_analysis": 3,
          "compare_analysis": 1
        }
      }
    ],
    "nextResetDate": "2025-11-11"
  }
}
```

#### 2.2 获取配额历史统计
```
GET /api/mobile/{factoryId}/ai/quota/history?weeks=4

Response:
{
  "success": true,
  "data": {
    "weeks": [
      {
        "weekStart": "2025-10-28",
        "weekEnd": "2025-11-03",
        "quotaUsed": 78,
        "quotaLimit": 100
      }
    ],
    "averageUsage": 65.5,
    "trend": "increasing|stable|decreasing"
  }
}
```

---

### 3. 对话会话 (/ai/conversations)

#### 3.1 获取会话详情
```
GET /api/mobile/{factoryId}/ai/conversations/{sessionId}

Response:
{
  "success": true,
  "data": {
    "sessionId": "string",
    "createdAt": "2025-11-04T10:00:00Z",
    "lastUpdatedAt": "2025-11-04T10:05:00Z",
    "status": "active|completed",
    "context": {
      "type": "batch|time-range|compare",
      "batchId": "string (if applicable)",
      "timeRange": {...} (if applicable)
    },
    "messages": [
      {
        "role": "user|assistant",
        "content": "string",
        "timestamp": "2025-11-04T10:00:00Z"
      }
    ],
    "metadata": {
      "totalMessages": 5,
      "quotaConsumed": 2
    }
  }
}
```

#### 3.2 继续对话
```
POST /api/mobile/{factoryId}/ai/conversations/{sessionId}/continue

Request Body:
{
  "question": "string"
}

Response:
{
  "success": true,
  "data": {
    "sessionId": "string",
    "response": "string (markdown)",
    "quotaConsumed": 1
  }
}
```

#### 3.3 获取会话列表
```
GET /api/mobile/{factoryId}/ai/conversations?page=0&size=20

Response:
{
  "success": true,
  "data": {
    "conversations": [
      {
        "sessionId": "string",
        "preview": "string",              # 前50字
        "createdAt": "2025-11-04T10:00:00Z",
        "messageCount": 5
      }
    ],
    "pagination": {
      "page": 0,
      "size": 20,
      "totalElements": 150,
      "totalPages": 8
    }
  }
}
```

---

### 4. 历史报告 (/ai/reports)

#### 4.1 获取报告列表
```
GET /api/mobile/{factoryId}/ai/reports?type=batch|weekly|monthly&page=0&size=20

Response:
{
  "success": true,
  "data": {
    "reports": [
      {
        "reportId": "string",
        "reportType": "batch|weekly|monthly",
        "title": "string",
        "createdAt": "2025-11-04T10:00:00Z",
        "expiresAt": "2025-12-04T10:00:00Z",
        "summary": "string",               # 摘要
        "context": {
          "batchId": "string (if batch)",
          "period": {...} (if weekly/monthly)
        }
      }
    ],
    "pagination": {...}
  }
}
```

#### 4.2 获取报告详情
```
GET /api/mobile/{factoryId}/ai/reports/{reportId}

Response:
{
  "success": true,
  "data": {
    "reportId": "string",
    "reportType": "batch|weekly|monthly",
    "title": "string",
    "content": "string (markdown)",        # 完整内容
    "insights": [...],                     # 结构化洞察
    "metadata": {
      "createdAt": "2025-11-04T10:00:00Z",
      "expiresAt": "2025-12-04T10:00:00Z",
      "isAutoGenerated": false
    }
  }
}
```

---

### 5. 健康检查 (/ai/health)

```
GET /api/mobile/{factoryId}/ai/health

Response:
{
  "success": true,
  "data": {
    "status": "healthy|degraded|down",
    "services": {
      "llmAPI": {
        "status": "up",
        "responseTime": 234,               # ms
        "lastChecked": "2025-11-04T10:00:00Z"
      },
      "cacheService": {
        "status": "up",
        "hitRate": 0.65
      },
      "quotaService": {
        "status": "up"
      }
    },
    "currentLoad": {
      "activeRequests": 5,
      "queueLength": 0
    }
  }
}
```

---

## 🔄 迁移计划

### 阶段1: 创建新Controller (第1天上午)

**文件**: `AIController.java`

```java
package com.cretas.aims.controller;

@RestController
@RequestMapping("/api/mobile/{factoryId}/ai")
@Tag(name = "AI智能分析", description = "统一的AI分析API")
@Validated
@Slf4j
public class AIController {

    @Autowired
    private AIAnalysisService aiAnalysisService;

    @Autowired
    private AIQuotaService aiQuotaService;

    @Autowired
    private AIConversationService aiConversationService;

    @Autowired
    private AIReportService aiReportService;

    // === 成本分析 ===

    @PostMapping("/analysis/cost/batch/{batchId}")
    @Operation(summary = "单批次成本AI分析")
    public ApiResponse<AICostAnalysisResponse> analyzeBatchCost(
        @PathVariable String factoryId,
        @PathVariable String batchId,
        @RequestBody @Valid AICostAnalysisRequest request
    ) {
        log.info("AI批次成本分析: factoryId={}, batchId={}", factoryId, batchId);
        AICostAnalysisResponse response = aiAnalysisService.analyzeBatchCost(
            factoryId, batchId, request
        );
        return ApiResponse.success(response);
    }

    @PostMapping("/analysis/cost/time-range")
    @Operation(summary = "时间范围成本AI分析")
    public ApiResponse<AITimeRangeAnalysisResponse> analyzeTimeRangeCost(
        @PathVariable String factoryId,
        @RequestBody @Valid AITimeRangeAnalysisRequest request
    ) {
        log.info("AI时间范围成本分析: factoryId={}, period={} to {}",
            factoryId, request.getStartDate(), request.getEndDate());
        AITimeRangeAnalysisResponse response = aiAnalysisService.analyzeTimeRangeCost(
            factoryId, request
        );
        return ApiResponse.success(response);
    }

    @PostMapping("/analysis/cost/compare")
    @Operation(summary = "批次对比AI分析")
    public ApiResponse<AIComparativeAnalysisResponse> compareBatchCosts(
        @PathVariable String factoryId,
        @RequestBody @Valid AIComparativeAnalysisRequest request
    ) {
        log.info("AI批次对比分析: factoryId={}, batchCount={}",
            factoryId, request.getBatchIds().size());
        AIComparativeAnalysisResponse response = aiAnalysisService.compareBatchCosts(
            factoryId, request
        );
        return ApiResponse.success(response);
    }

    // === 配额管理 ===

    @GetMapping("/quota")
    @Operation(summary = "获取AI配额信息")
    public ApiResponse<AIQuotaInfoResponse> getQuotaInfo(
        @PathVariable String factoryId
    ) {
        log.info("获取AI配额: factoryId={}", factoryId);
        AIQuotaInfoResponse response = aiQuotaService.getQuotaInfo(factoryId);
        return ApiResponse.success(response);
    }

    @GetMapping("/quota/history")
    @Operation(summary = "获取配额历史统计")
    public ApiResponse<AIQuotaHistoryResponse> getQuotaHistory(
        @PathVariable String factoryId,
        @RequestParam(defaultValue = "4") Integer weeks
    ) {
        log.info("获取AI配额历史: factoryId={}, weeks={}", factoryId, weeks);
        AIQuotaHistoryResponse response = aiQuotaService.getQuotaHistory(
            factoryId, weeks
        );
        return ApiResponse.success(response);
    }

    // === 对话会话 ===

    @GetMapping("/conversations/{sessionId}")
    @Operation(summary = "获取会话详情")
    public ApiResponse<AIConversationResponse> getConversation(
        @PathVariable String factoryId,
        @PathVariable String sessionId
    ) {
        log.info("获取AI会话: factoryId={}, sessionId={}", factoryId, sessionId);
        AIConversationResponse response = aiConversationService.getConversation(
            factoryId, sessionId
        );
        return ApiResponse.success(response);
    }

    @PostMapping("/conversations/{sessionId}/continue")
    @Operation(summary = "继续对话")
    public ApiResponse<AIContinueConversationResponse> continueConversation(
        @PathVariable String factoryId,
        @PathVariable String sessionId,
        @RequestBody @Valid AIContinueConversationRequest request
    ) {
        log.info("继续AI对话: factoryId={}, sessionId={}", factoryId, sessionId);
        AIContinueConversationResponse response = aiConversationService.continueConversation(
            factoryId, sessionId, request
        );
        return ApiResponse.success(response);
    }

    @GetMapping("/conversations")
    @Operation(summary = "获取会话列表")
    public ApiResponse<PagedResponse<AIConversationSummary>> getConversations(
        @PathVariable String factoryId,
        @RequestParam(defaultValue = "0") Integer page,
        @RequestParam(defaultValue = "20") Integer size
    ) {
        log.info("获取AI会话列表: factoryId={}, page={}", factoryId, page);
        PagedResponse<AIConversationSummary> response = aiConversationService.getConversations(
            factoryId, page, size
        );
        return ApiResponse.success(response);
    }

    // === 历史报告 ===

    @GetMapping("/reports")
    @Operation(summary = "获取AI报告列表")
    public ApiResponse<PagedResponse<AIReportSummary>> getReports(
        @PathVariable String factoryId,
        @RequestParam(required = false) String type,
        @RequestParam(defaultValue = "0") Integer page,
        @RequestParam(defaultValue = "20") Integer size
    ) {
        log.info("获取AI报告列表: factoryId={}, type={}", factoryId, type);
        PagedResponse<AIReportSummary> response = aiReportService.getReports(
            factoryId, type, page, size
        );
        return ApiResponse.success(response);
    }

    @GetMapping("/reports/{reportId}")
    @Operation(summary = "获取报告详情")
    public ApiResponse<AIReportResponse> getReport(
        @PathVariable String factoryId,
        @PathVariable String reportId
    ) {
        log.info("获取AI报告详情: factoryId={}, reportId={}", factoryId, reportId);
        AIReportResponse response = aiReportService.getReport(factoryId, reportId);
        return ApiResponse.success(response);
    }

    // === 健康检查 ===

    @GetMapping("/health")
    @Operation(summary = "AI服务健康检查")
    public ApiResponse<AIHealthResponse> checkHealth(
        @PathVariable String factoryId
    ) {
        log.info("AI健康检查: factoryId={}", factoryId);
        AIHealthResponse response = aiAnalysisService.checkHealth();
        return ApiResponse.success(response);
    }
}
```

---

### 阶段2: 创建Service接口 (第1天下午)

**新建文件**:
- `AIAnalysisService.java` - AI分析服务
- `AIQuotaService.java` - 配额管理服务
- `AIConversationService.java` - 会话管理服务
- `AIReportService.java` - 报告管理服务

---

### 阶段3: 迁移现有逻辑 (第2天上午)

从现有Controller中提取逻辑到新Service：
- `ProcessingController` → `AIAnalysisService`
- `FactorySettingsController` → `AIQuotaService`
- 复用现有的 `AIEnterpriseService` 核心逻辑

---

### 阶段4: 标记旧端点为废弃 (第2天下午)

```java
@Deprecated
@PostMapping("/batches/{batchId}/ai-cost-analysis")
public ApiResponse<?> oldAICostAnalysis(...) {
    // 重定向到新端点
    return analyzeBatchCost(factoryId, batchId, ...);
}
```

---

### 阶段5: 更新前端 (2-3小时)

创建新的 `aiApiClient.ts`:

```typescript
import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

class AIApiClient {
  private getBasePath(factoryId?: string) {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}/ai`;
  }

  // === 成本分析 ===

  async analyzeBatchCost(params: {
    batchId: string;
    question?: string;
    sessionId?: string;
    analysisDepth?: 'basic' | 'detailed' | 'comprehensive';
    factoryId?: string;
  }) {
    const { factoryId, batchId, ...body } = params;
    return await apiClient.post(
      `${this.getBasePath(factoryId)}/analysis/cost/batch/${batchId}`,
      body
    );
  }

  async analyzeTimeRangeCost(params: {
    startDate: string;
    endDate: string;
    aggregationType?: 'daily' | 'weekly' | 'monthly';
    question?: string;
    sessionId?: string;
    factoryId?: string;
  }) {
    const { factoryId, ...body } = params;
    return await apiClient.post(
      `${this.getBasePath(factoryId)}/analysis/cost/time-range`,
      body
    );
  }

  async compareBatchCosts(params: {
    batchIds: string[];
    comparisonDimensions?: string[];
    question?: string;
    factoryId?: string;
  }) {
    const { factoryId, ...body } = params;
    return await apiClient.post(
      `${this.getBasePath(factoryId)}/analysis/cost/compare`,
      body
    );
  }

  // === 配额管理 ===

  async getQuotaInfo(factoryId?: string) {
    return await apiClient.get(`${this.getBasePath(factoryId)}/quota`);
  }

  async getQuotaHistory(params: {
    weeks?: number;
    factoryId?: string;
  }) {
    const { factoryId, weeks = 4 } = params;
    return await apiClient.get(`${this.getBasePath(factoryId)}/quota/history`, {
      params: { weeks }
    });
  }

  // === 对话会话 ===

  async getConversation(params: {
    sessionId: string;
    factoryId?: string;
  }) {
    const { factoryId, sessionId } = params;
    return await apiClient.get(
      `${this.getBasePath(factoryId)}/conversations/${sessionId}`
    );
  }

  async continueConversation(params: {
    sessionId: string;
    question: string;
    factoryId?: string;
  }) {
    const { factoryId, sessionId, question } = params;
    return await apiClient.post(
      `${this.getBasePath(factoryId)}/conversations/${sessionId}/continue`,
      { question }
    );
  }

  async getConversations(params: {
    page?: number;
    size?: number;
    factoryId?: string;
  }) {
    const { factoryId, page = 0, size = 20 } = params;
    return await apiClient.get(
      `${this.getBasePath(factoryId)}/conversations`,
      { params: { page, size } }
    );
  }

  // === 历史报告 ===

  async getReports(params: {
    type?: 'batch' | 'weekly' | 'monthly';
    page?: number;
    size?: number;
    factoryId?: string;
  }) {
    const { factoryId, type, page = 0, size = 20 } = params;
    return await apiClient.get(`${this.getBasePath(factoryId)}/reports`, {
      params: { type, page, size }
    });
  }

  async getReport(params: {
    reportId: string;
    factoryId?: string;
  }) {
    const { factoryId, reportId } = params;
    return await apiClient.get(
      `${this.getBasePath(factoryId)}/reports/${reportId}`
    );
  }

  // === 健康检查 ===

  async checkHealth(factoryId?: string) {
    return await apiClient.get(`${this.getBasePath(factoryId)}/health`);
  }
}

export const aiApiClient = new AIApiClient();
export default aiApiClient;
```

---

## 📋 完整的文件清单

### 后端新建文件 (9个)

#### Controllers (1个)
1. `AIController.java` - 统一的AI API入口

#### Services (4个接口 + 4个实现)
2. `AIAnalysisService.java` (接口)
3. `AIAnalysisServiceImpl.java` (实现)
4. `AIQuotaService.java` (接口)
5. `AIQuotaServiceImpl.java` (实现)
6. `AIConversationService.java` (接口)
7. `AIConversationServiceImpl.java` (实现)
8. `AIReportService.java` (接口)
9. `AIReportServiceImpl.java` (实现)

#### DTOs (可选，如果需要新的数据结构)
10-20. `AI*Request.java` 和 `AI*Response.java`

### 后端修改文件 (3个)

1. `ProcessingController.java` - 标记旧方法为@Deprecated
2. `FactorySettingsController.java` - 标记旧方法为@Deprecated
3. `PlatformController.java` - 保持不变（管理员端点）

### 前端新建文件 (1个)

1. `src/services/api/aiApiClient.ts` - 新的AI API客户端

### 前端修改文件 (3-5个)

1. `processingApiClient.ts` - 标记旧方法为deprecated
2. `CostAnalysisDashboard/hooks/useAIAnalysis.ts` - 使用新API
3. `AISettingsScreen.tsx` - 使用新配额API
4. `TimeRangeCostAnalysisScreen.tsx` - 使用新时间范围API
5. 其他使用AI功能的组件

---

## 🧪 测试计划

### 单元测试
- [ ] AIController 所有端点测试
- [ ] AIAnalysisService 业务逻辑测试
- [ ] AIQuotaService 配额计算测试
- [ ] AIConversationService 会话管理测试
- [ ] AIReportService 报告查询测试

### 集成测试
- [ ] 前端→新API端点调用成功
- [ ] 配额扣减正确
- [ ] 会话持久化正常
- [ ] 报告生成和查询正常

### 性能测试
- [ ] 并发AI请求处理
- [ ] 缓存命中率验证
- [ ] 响应时间基准测试

---

## 📊 预期收益

### 代码质量
- ✅ 消除编译错误
- ✅ 减少代码重复
- ✅ 提高可维护性
- ✅ 清晰的职责分离

### 开发效率
- ✅ 新功能容易添加
- ✅ API文档自动生成
- ✅ 前端调用更直观
- ✅ 减少前后端沟通成本

### 系统架构
- ✅ 更好的扩展性
- ✅ 支持API版本控制
- ✅ 易于添加新的AI模型
- ✅ 支持流式响应等高级功能

---

## 🎯 时间表

| 阶段 | 任务 | 预计时间 | 负责人 |
|------|------|---------|--------|
| 1 | 创建AIController和DTO | 3-4小时 | 后端 |
| 2 | 创建Service接口和实现 | 4-5小时 | 后端 |
| 3 | 迁移现有逻辑 | 3-4小时 | 后端 |
| 4 | 标记旧端点废弃 | 1小时 | 后端 |
| 5 | 单元测试 | 2-3小时 | 后端 |
| 6 | 创建前端aiApiClient | 2小时 | 前端 |
| 7 | 更新前端组件 | 2-3小时 | 前端 |
| 8 | 前端测试 | 1-2小时 | 前端 |
| 9 | 集成测试 | 2-3小时 | 全栈 |
| 10 | 文档更新 | 1-2小时 | 全栈 |
| **总计** | | **21-29小时** | **(约3-4天)** |

---

## ✅ 检查清单

### 开发前
- [ ] 团队评审架构设计
- [ ] 确认向后兼容策略
- [ ] 准备测试数据和环境

### 开发中
- [ ] 后端Controller完成
- [ ] 后端Service完成
- [ ] 前端API客户端完成
- [ ] 单元测试通过
- [ ] 集成测试通过

### 发布前
- [ ] API文档生成
- [ ] 前端组件更新完成
- [ ] 性能测试通过
- [ ] Code Review完成
- [ ] 更新CHANGELOG

### 发布后
- [ ] 监控新API使用情况
- [ ] 收集反馈
- [ ] 逐步废弃旧端点
- [ ] 6个月后完全移除旧端点

---

**文档版本**: v1.0.0
**最后更新**: 2025-11-04
**状态**: ✅ 待实施
