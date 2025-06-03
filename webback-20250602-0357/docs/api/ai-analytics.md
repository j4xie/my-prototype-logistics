# AI数据分析API接口规范

<!-- updated for: Phase-3技术栈现代化 - 基于已实现功能完善AI API文档 -->
<!-- authority: 本文档是AI分析相关API接口的权威定义 -->
<!-- last-sync: 2025-05-31 -->

## 📋 概述

本文档定义了食品溯源系统AI数据分析模块的完整API接口规范。这些接口支持生产加工过程中的智能数据分析、优化建议、预测分析等核心AI功能。

### 版本信息
- **API版本**: v1
- **基础URL**: `{BASE_URL}/v1/ai`
- **认证方式**: Bearer Token
- **实现状态**: 前端Hook已完成，Mock API部分实现

## 🧠 核心AI分析接口

### 1. 生产数据洞察分析

获取生产过程中的智能数据洞察，帮助优化生产效率和质量。

```typescript
POST /v1/ai/production-insights

// 请求头
Authorization: Bearer <token>
Content-Type: application/json

// 请求参数
interface ProductionInsightsRequest {
  batchId?: string;                              // 批次ID（可选）
  timeRange?: string;                            // 时间范围: '7d', '30d', '3m', '1y'
  analysisType?: 'efficiency' | 'quality' | 'cost' | 'all';  // 分析类型
}

// 响应
interface ProductionInsightsResponse {
  success: boolean;
  data: {
    summary: {
      efficiency: number;                        // 整体效率评分 (0-100)
      quality: number;                           // 质量评分 (0-100)
      cost: number;                             // 成本控制评分 (0-100)
      trend: 'improving' | 'stable' | 'declining';  // 整体趋势
    };
    insights: Array<{
      category: 'efficiency' | 'quality' | 'cost' | 'process';
      title: string;                             // 洞察标题
      description: string;                       // 详细描述
      impact: 'high' | 'medium' | 'low';         // 影响程度
      actionable: boolean;                       // 是否可操作
      recommendedActions?: string[];             // 推荐行动
    }>;
    metrics: {
      efficiency: {
        currentValue: number;
        targetValue: number;
        improvement: number;                     // 改进百分比
        bottlenecks: string[];                   // 瓶颈分析
      };
      quality: {
        defectRate: number;                      // 缺陷率
        qualityTrend: number[];                  // 质量趋势数据
        criticalIssues: string[];                // 关键质量问题
      };
      cost: {
        totalCost: number;                       // 总成本
        costPerUnit: number;                     // 单位成本
        wastage: number;                         // 浪费率
        savingOpportunities: Array<{
          area: string;
          potentialSaving: number;
        }>;
      };
    };
    timeSeriesData: Array<{
      timestamp: string;
      efficiency: number;
      quality: number;
      cost: number;
    }>;
  };
}
```

### 2. 优化建议引擎

基于当前生产数据提供个性化的优化建议。

```typescript
POST /v1/ai/optimize

// 请求参数
interface OptimizationRequest {
  processType: 'farming' | 'processing' | 'logistics';  // 业务流程类型
  currentData: Record<string, any>;                     // 当前数据状态
  targetMetrics?: string[];                              // 目标优化指标
}

// 响应
interface OptimizationResponse {
  success: boolean;
  data: {
    suggestions: Array<{
      id: string;
      category: string;                          // 优化类别
      title: string;                             // 建议标题
      description: string;                       // 详细说明
      priority: 'high' | 'medium' | 'low';      // 优先级
      expectedImpact: {
        metric: string;                          // 影响指标
        improvement: number;                     // 预期改进幅度
        timeframe: string;                       // 生效时间框架
      };
      implementation: {
        difficulty: 'easy' | 'medium' | 'hard';  // 实施难度
        estimatedCost: number;                   // 预估成本
        requiredResources: string[];             // 所需资源
        steps: string[];                         // 实施步骤
      };
      riskAssessment: {
        level: 'low' | 'medium' | 'high';       // 风险级别
        factors: string[];                       // 风险因素
        mitigations: string[];                   // 风险缓解措施
      };
    }>;
    summary: {
      totalSuggestions: number;
      highPriority: number;
      estimatedTotalBenefit: number;
      quickWins: Array<{
        suggestion: string;
        benefit: number;
        effort: number;
      }>;
    };
  };
}
```

### 3. 预测分析服务

提供基于历史数据和机器学习模型的预测分析功能。

```typescript
POST /v1/ai/predict

// 请求参数
interface PredictiveAnalysisRequest {
  type: 'yield' | 'quality' | 'timeline' | 'cost';      // 预测类型
  inputData: Record<string, any>;                       // 输入数据
  predictionPeriod?: string;                             // 预测周期: '1d', '7d', '30d', '3m'
}

// 响应
interface PredictiveAnalysisResponse {
  success: boolean;
  data: {
    predictions: Array<{
      metric: string;                            // 预测指标
      currentValue: number;                      // 当前值
      predictedValue: number;                    // 预测值
      confidence: number;                        // 置信度 (0-1)
      trend: 'increasing' | 'decreasing' | 'stable';  // 趋势
      factors: Array<{                           // 影响因素
        name: string;
        impact: number;                          // 影响权重
        correlation: number;                     // 相关性
      }>;
    }>;
    scenarios: {
      optimistic: {                              // 乐观场景
        prediction: number;
        probability: number;
      };
      realistic: {                               // 现实场景
        prediction: number;
        probability: number;
      };
      pessimistic: {                             // 悲观场景
        prediction: number;
        probability: number;
      };
    };
    recommendations: Array<{
      action: string;                            // 推荐行动
      impact: string;                            // 预期影响
      urgency: 'immediate' | 'short_term' | 'long_term';
    }>;
    modelMetadata: {
      algorithm: string;                         // 使用的算法
      trainingDataSize: number;                  // 训练数据量
      lastUpdated: string;                       // 模型最后更新时间
      accuracy: number;                          // 模型准确率
    };
  };
}
```

### 4. 数据聚合分析

跨模块的综合数据分析和聚合统计。

```typescript
POST /v1/ai/aggregate

// 请求参数
interface DataAggregationRequest {
  sources: string[];                             // 数据源: ['farming', 'processing', 'logistics']
  timeRange: string;                             // 时间范围
  aggregationType: 'summary' | 'detailed' | 'comparison';  // 聚合类型
}

// 响应
interface DataAggregationResponse {
  success: boolean;
  data: {
    aggregatedMetrics: {
      totalRecords: number;                      // 总记录数
      dataQuality: number;                       // 数据质量评分
      completeness: number;                      // 数据完整性
      timespan: {
        start: string;
        end: string;
        duration: string;
      };
    };
    crossModuleInsights: Array<{
      correlation: {
        modules: string[];
        strength: number;                        // 相关性强度
        significance: number;                    // 统计显著性
      };
      insight: string;                           // 洞察描述
      actionable: boolean;                       // 是否可操作
    }>;
    performanceIndicators: {
      efficiency: {
        overall: number;
        byModule: Record<string, number>;
      };
      quality: {
        overall: number;
        byModule: Record<string, number>;
      };
      sustainability: {
        score: number;
        improvements: string[];
      };
    };
    trends: Array<{
      timeWindow: string;
      metrics: Record<string, number>;
      growth: Record<string, number>;
      anomalies: Array<{
        metric: string;
        deviation: number;
        explanation?: string;
      }>;
    }>;
  };
}
```

### 5. 实时监控分析

提供实时数据监控和异常检测功能。

```typescript
POST /v1/ai/realtime-analysis

// 请求参数
interface RealtimeAnalysisRequest {
  modules: string[];                             // 监控模块
  alertThresholds?: Record<string, number>;      // 警报阈值
}

// 响应
interface RealtimeAnalysisResponse {
  success: boolean;
  data: {
    currentStatus: {
      overall: 'healthy' | 'warning' | 'critical';
      modules: Record<string, {
        status: 'healthy' | 'warning' | 'critical';
        lastUpdate: string;
        metrics: Record<string, number>;
      }>;
    };
    alerts: Array<{
      id: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      module: string;
      metric: string;
      currentValue: number;
      threshold: number;
      message: string;
      timestamp: string;
      acknowledged: boolean;
      suggestedActions: string[];
    }>;
    trends: {
      shortTerm: Array<{                         // 短期趋势 (1小时内)
        timestamp: string;
        metrics: Record<string, number>;
      }>;
      patterns: Array<{                          // 发现的模式
        type: 'seasonal' | 'cyclical' | 'anomaly';
        description: string;
        confidence: number;
      }>;
    };
    predictions: Array<{                         // 短期预测
      metric: string;
      nextValue: number;
      timeframe: string;
      confidence: number;
    }>;
  };
}
```

### 6. AI模型状态查询

查询AI分析模型的健康状态和性能指标。

```typescript
GET /v1/ai/model-status

// 响应
interface ModelStatusResponse {
  success: boolean;
  data: {
    models: Array<{
      name: string;                              // 模型名称
      version: string;                           // 版本号
      status: 'active' | 'training' | 'offline' | 'error';
      accuracy: number;                          // 准确率
      lastTrained: string;                       // 最后训练时间
      trainingDataSize: number;                  // 训练数据大小
      performance: {
        responseTime: number;                    // 平均响应时间(ms)
        throughput: number;                      // 吞吐量(req/s)
        errorRate: number;                       // 错误率
      };
      resources: {
        cpuUsage: number;                        // CPU使用率
        memoryUsage: number;                     // 内存使用率
        gpuUsage?: number;                       // GPU使用率(可选)
      };
    }>;
    system: {
      overallHealth: 'healthy' | 'degraded' | 'down';
      totalRequests: number;                     // 总请求数
      successRate: number;                       // 成功率
      averageLatency: number;                    // 平均延迟
    };
  };
}
```

### 7. AI分析历史查询

获取历史AI分析结果和性能数据。

```typescript
GET /v1/ai/analysis-history?limit=20&offset=0

// 查询参数
interface AnalysisHistoryQuery {
  limit?: number;                                // 返回数量限制
  offset?: number;                               // 偏移量
  analysisType?: string;                         // 分析类型筛选
  startDate?: string;                            // 开始日期
  endDate?: string;                              // 结束日期
}

// 响应
interface AnalysisHistoryResponse {
  success: boolean;
  data: {
    analyses: Array<{
      id: string;
      type: string;                              // 分析类型
      parameters: Record<string, any>;           // 分析参数
      results: Record<string, any>;              // 分析结果
      status: 'completed' | 'failed' | 'in_progress';
      duration: number;                          // 执行时长(ms)
      accuracy?: number;                         // 结果准确度
      createdAt: string;
      updatedAt: string;
    }>;
    summary: {
      totalAnalyses: number;
      successRate: number;
      averageDuration: number;
      typeDistribution: Record<string, number>;
    };
  };
  meta: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
```

## 🔧 数据类型定义

### 通用响应格式

```typescript
interface AIApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    processingTime: number;
    version: string;
  };
}
```

### AI分析配置

```typescript
interface AIAnalysisConfig {
  modelVersion: string;                          // 模型版本
  confidence: number;                            // 最低置信度阈值
  features: string[];                            // 启用的特性
  customParams?: Record<string, any>;            // 自定义参数
}
```

## 📊 Mock数据示例

### 生产洞察分析Mock响应

```json
{
  "success": true,
  "data": {
    "summary": {
      "efficiency": 87,
      "quality": 94,
      "cost": 76,
      "trend": "improving"
    },
    "insights": [
      {
        "category": "efficiency",
        "title": "设备运行效率优化空间",
        "description": "生产线A的设备利用率仅为78%，存在20%的提升空间",
        "impact": "high",
        "actionable": true,
        "recommendedActions": [
          "优化设备维护计划",
          "调整生产排期",
          "培训操作人员"
        ]
      }
    ],
    "metrics": {
      "efficiency": {
        "currentValue": 87,
        "targetValue": 95,
        "improvement": 8,
        "bottlenecks": ["设备维护", "人员培训"]
      },
      "quality": {
        "defectRate": 0.06,
        "qualityTrend": [94, 93, 95, 94, 96],
        "criticalIssues": ["包装密封"]
      },
      "cost": {
        "totalCost": 125000,
        "costPerUnit": 12.5,
        "wastage": 0.03,
        "savingOpportunities": [
          {
            "area": "原料优化",
            "potentialSaving": 8000
          }
        ]
      }
    }
  },
  "meta": {
    "requestId": "ai-insights-20250531-001",
    "timestamp": "2025-05-31T10:30:00Z",
    "processingTime": 1500,
    "version": "1.0.0"
  }
}
```

## ⚠️ 错误处理

### 常见错误码

| 错误码 | HTTP状态 | 描述 | 解决方案 |
|--------|----------|------|-----------|
| `AI_MODEL_UNAVAILABLE` | 503 | AI模型服务不可用 | 稍后重试或使用缓存数据 |
| `INSUFFICIENT_DATA` | 400 | 数据量不足以进行分析 | 提供更多历史数据 |
| `INVALID_ANALYSIS_TYPE` | 400 | 不支持的分析类型 | 检查请求参数 |
| `MODEL_ACCURACY_LOW` | 422 | 模型准确度过低 | 等待模型重新训练 |
| `PROCESSING_TIMEOUT` | 408 | 分析处理超时 | 减少数据范围或稍后重试 |

### 错误响应示例

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_DATA",
    "message": "数据量不足以进行可靠的AI分析",
    "details": {
      "requiredDataPoints": 100,
      "availableDataPoints": 25,
      "suggestion": "建议收集至少30天的生产数据后再进行分析"
    }
  },
  "meta": {
    "requestId": "ai-error-20250531-001",
    "timestamp": "2025-05-31T10:30:00Z"
  }
}
```

## 🚀 使用指南

### 前端Hook集成

基于已实现的`useAIAnalytics` Hook，推荐使用方式：

```typescript
import { useAIAnalytics } from '@/hooks/useApi-simple';

function ProductionDashboard() {
  const { useProductionInsights } = useAIAnalytics();
  
  const insights = useProductionInsights({
    batchId: 'batch-001',
    timeRange: '30d',
    analysisType: 'all'
  });

  if (insights.loading) return <LoadingSpinner />;
  if (insights.error) return <ErrorMessage error={insights.error} />;

  return (
    <div>
      <h2>生产洞察分析</h2>
      <EfficiencyScore score={insights.data?.summary.efficiency} />
      <QualityMetrics metrics={insights.data?.metrics.quality} />
    </div>
  );
}
```

### 缓存策略

- **实时分析数据**: 5分钟缓存
- **历史分析结果**: 1小时缓存
- **模型状态信息**: 30分钟缓存
- **优化建议**: 2小时缓存

### 性能考虑

- AI分析请求优先级设置为`high`
- 使用批量处理优化大数据集分析
- 实现智能缓存减少重复计算
- 支持渐进式结果返回

---

**文档版本**: v1.0.0  
**最后更新**: 2025-05-31  
**维护责任**: AI团队 + 前端团队 