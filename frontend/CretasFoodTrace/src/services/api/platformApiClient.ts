/**
 * 平台管理员API客户端
 * 仅平台管理员可访问的功能
 */

import { apiClient } from './apiClient';
import { NotImplementedError } from '../../errors';
import type {
  FactoryAIQuota,
  PlatformAIUsageStats,
  AIQuotaUpdate,
  AIQuotaRule,
  CreateAIQuotaRuleRequest,
  UpdateAIQuotaRuleRequest
} from '../../types/processing';

// Factory类型定义
export interface FactoryDTO {
  id: string;
  factoryName: string;
  name?: string;  // 支持name和factoryName两种字段名
  address?: string;
  contactPerson?: string;
  contactPhone?: string;
  status: 'active' | 'inactive';
  totalUsers?: number;
  totalBatches?: number;
  createdAt?: string;
  updatedAt?: string;
  isActive?: boolean;
  industry?: string;
  employeeCount?: number;
  subscriptionPlan?: string;
  contactName?: string;
  contactEmail?: string;
  // Extended properties for factory detail view
  departmentCount?: number;
  productTypeCount?: number;
  blueprintName?: string;
  blueprintVersion?: string;
  blueprintSynced?: boolean;
  blueprintUpdatedAt?: string;
  aiQuotaUsed?: number;
  aiQuotaTotal?: number;
}

// 创建工厂请求
export interface CreateFactoryRequest {
  name: string;
  industry?: string;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  employeeCount?: number;
  subscriptionPlan?: string;
}

// 更新工厂请求
export interface UpdateFactoryRequest {
  name?: string;
  industry?: string;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  employeeCount?: number;
  subscriptionPlan?: string;
  isActive?: boolean;
}

// 平台统计数据
export interface PlatformStatistics {
  totalFactories: number;
  activeFactories: number;
  totalUsers: number;
  totalBatches: number;
  totalAIRequests: number;
  totalAICost: number;
  factoriesByPlan?: Record<string, number>;
  factoriesByIndustry?: Record<string, number>;
  recentActivity?: Array<{
    factoryId: string;
    factoryName: string;
    activity: string;
    timestamp: string;
  }>;
}

// ==================== 系统监控类型 ====================

/**
 * 连接池状态
 */
export interface ConnectionPoolStatus {
  activeConnections: number;
  idleConnections: number;
  maxConnections: number;
  utilizationPercent: number;
}

/**
 * 服务健康状态
 */
export interface ServiceHealthStatus {
  serviceName: string;
  status: 'UP' | 'DOWN' | 'DEGRADED';
  message: string;
  responseTimeMs: number;
}

/**
 * 活动日志
 */
export interface ActivityLog {
  id: number;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  time: string;
  icon: string;
  color: string;
}

/**
 * 系统监控指标
 */
export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  usedMemoryMB: number;
  maxMemoryMB: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
  activeConnections: number;
  requestsPerMinute: number;
  averageResponseTime: number;
  errorRate: number;
  uptime: string;
  uptimeMs: number;
  availableProcessors: number;
  javaVersion: string;
  osName: string;
  osArch: string;
  appVersion: string;
  connectionPool: ConnectionPoolStatus;
  serviceHealthStatus: ServiceHealthStatus[];
  recentActivity: ActivityLog[];
}

// ==================== AI 工厂初始化类型 ====================

/**
 * AI 工厂初始化请求
 */
export interface AIFactoryInitRequest {
  /** 工厂描述 (自然语言) */
  factoryDescription: string;
  /** 行业提示 (可选) */
  industryHint?: string;
  /** 工厂名称 (可选) */
  factoryName?: string;
  /** 是否包含业务数据建议 */
  includeBusinessData?: boolean;
}

/**
 * 实体 Schema 定义
 */
export interface EntitySchemaDTO {
  /** 实体类型 */
  entityType: string;
  /** 实体名称 */
  entityName: string;
  /** 描述 */
  description: string;
  /** Formily 格式字段列表 */
  fields: Array<Record<string, unknown>>;
}

/**
 * 建议的业务数据
 */
export interface SuggestedBusinessDataDTO {
  /** 建议的产品类型 */
  productTypes: Array<Record<string, unknown>>;
  /** 建议的原料类型 */
  materialTypes: Array<Record<string, unknown>>;
  /** 建议的转换率配置 */
  conversionRates: Array<Record<string, unknown>>;
}

/**
 * AI 工厂初始化响应
 */
export interface AIFactoryInitResponse {
  /** 是否成功 */
  success: boolean;
  /** 识别的行业代码 */
  industryCode: string;
  /** 行业名称 */
  industryName: string;
  /** 生成的表单 Schema 列表 */
  schemas: EntitySchemaDTO[];
  /** 建议的业务数据 */
  suggestedData?: SuggestedBusinessDataDTO;
  /** AI 生成的总结说明 */
  aiSummary: string;
  /** 消息 */
  message: string;
}

// ==================== 平台报表类型 ====================

/**
 * 平台报表数据
 */
export interface PlatformReportDTO {
  /** 报表摘要 */
  summary: ReportSummary;
  /** 趋势数据 */
  trends: TrendData[];
  /** 工厂排行榜 */
  topFactories: FactoryRanking[];
  /** 报表类型 */
  reportType: string;
  /** 时间周期 */
  timePeriod: string;
}

/**
 * 报表摘要
 */
export interface ReportSummary {
  /** 总营收 (元) */
  totalRevenue: number;
  /** 总产量 (吨) */
  totalProduction: number;
  /** 总订单数 */
  totalOrders: number;
  /** 平均质量分数 */
  averageQualityScore: number;
  /** 同比变化率 (%) */
  changePercentage: number;
}

/**
 * 趋势数据
 */
export interface TrendData {
  /** 周期标签 */
  period: string;
  /** 数值 */
  value: number;
  /** 变化率 (%) */
  change: number;
}

/**
 * 工厂排行
 */
export interface FactoryRanking {
  /** 工厂ID */
  factoryId: string;
  /** 工厂名称 */
  name: string;
  /** 产量 (吨) */
  production: number;
  /** 营收 (元) */
  revenue: number;
  /** 效率 (%) */
  efficiency: number;
  /** 质量分数 */
  qualityScore: number;
  /** 排名 */
  rank: number;
}

export const platformAPI = {
  /**
   * 获取所有工厂列表
   * 后端API: GET /api/platform/factories
   * ✅ P1-5: 后端已实现
   */
  getFactories: async (): Promise<{
    success: boolean;
    code: number;
    data: FactoryDTO[];
    message?: string;
  }> => {
    // apiClient拦截器已经解包了response.data，不要再次解包
    const response = await apiClient.get('/api/platform/factories');
    return response as {
      success: boolean;
      code: number;
      data: FactoryDTO[];
      message?: string;
    };
  },

  /**
   * 获取所有工厂的AI配额设置
   * 后端API: GET /api/platform/ai-quota
   */
  getFactoryAIQuotas: async (): Promise<{
    success: boolean;
    data: FactoryAIQuota[];
    message?: string;
  }> => {
    const response = await apiClient.get('/api/platform/ai-quota');
    return response as {
      success: boolean;
      data: FactoryAIQuota[];
      message?: string;
    };
  },

  /**
   * 更新工厂AI配额
   * 后端API: PUT /api/platform/ai-quota/:factoryId
   */
  updateFactoryAIQuota: async (params: AIQuotaUpdate): Promise<{
    success: boolean;
    data: { factoryId: string; weeklyQuota: number };
    message?: string;
  }> => {
    const response = await apiClient.put(
      `/api/platform/ai-quota/${params.factoryId}`,
      { weeklyQuota: params.weeklyQuota }
    );
    return response as {
      success: boolean;
      data: { factoryId: string; weeklyQuota: number };
      message?: string;
    };
  },

  /**
   * 获取平台AI使用统计
   * 后端API: GET /api/platform/ai-usage-stats
   */
  getPlatformAIUsageStats: async (): Promise<{
    success: boolean;
    data: PlatformAIUsageStats;
    message?: string;
  }> => {
    const response = await apiClient.get('/api/platform/ai-usage-stats');
    return response as {
      success: boolean;
      data: PlatformAIUsageStats;
      message?: string;
    };
  },

  // ==================== 工厂管理 CRUD ====================

  /**
   * 创建工厂
   * 后端API: POST /api/platform/factories
   */
  createFactory: async (factoryData: CreateFactoryRequest): Promise<{
    success: boolean;
    code: number;
    data: FactoryDTO;
    message?: string;
  }> => {
    const response = await apiClient.post('/api/platform/factories', factoryData);
    return response as {
      success: boolean;
      code: number;
      data: FactoryDTO;
      message?: string;
    };
  },

  /**
   * 获取工厂详情
   * 后端API: GET /api/platform/factories/:factoryId
   */
  getFactoryById: async (factoryId: string): Promise<{
    success: boolean;
    code: number;
    data: FactoryDTO;
    message?: string;
  }> => {
    const response = await apiClient.get(`/api/platform/factories/${factoryId}`);
    return response as {
      success: boolean;
      code: number;
      data: FactoryDTO;
      message?: string;
    };
  },

  /**
   * 更新工厂信息
   * 后端API: PUT /api/platform/factories/:factoryId
   */
  updateFactory: async (
    factoryId: string,
    updateData: UpdateFactoryRequest
  ): Promise<{
    success: boolean;
    code: number;
    data: FactoryDTO;
    message?: string;
  }> => {
    const response = await apiClient.put(`/api/platform/factories/${factoryId}`, updateData);
    return response as {
      success: boolean;
      code: number;
      data: FactoryDTO;
      message?: string;
    };
  },

  /**
   * 删除工厂
   * 后端API: DELETE /api/platform/factories/:factoryId
   */
  deleteFactory: async (factoryId: string): Promise<{
    success: boolean;
    code: number;
    message: string;
  }> => {
    const response = await apiClient.delete(`/api/platform/factories/${factoryId}`);
    return response as {
      success: boolean;
      code: number;
      message: string;
    };
  },

  /**
   * 激活工厂
   * 后端API: POST /api/platform/factories/:factoryId/activate
   */
  activateFactory: async (factoryId: string): Promise<{
    success: boolean;
    code: number;
    data: FactoryDTO;
    message: string;
  }> => {
    const response = await apiClient.post(`/api/platform/factories/${factoryId}/activate`);
    return response as {
      success: boolean;
      code: number;
      data: FactoryDTO;
      message: string;
    };
  },

  /**
   * 停用工厂
   * 后端API: POST /api/platform/factories/:factoryId/deactivate
   */
  deactivateFactory: async (factoryId: string): Promise<{
    success: boolean;
    code: number;
    data: FactoryDTO;
    message: string;
  }> => {
    const response = await apiClient.post(`/api/platform/factories/${factoryId}/deactivate`);
    return response as {
      success: boolean;
      code: number;
      data: FactoryDTO;
      message: string;
    };
  },

  // ==================== 平台统计 ====================

  /**
   * 获取平台统计数据
   * 后端API: GET /api/platform/dashboard/statistics
   * ✅ 已验证: 2025-11-20
   */
  getPlatformStatistics: async (): Promise<{
    success: boolean;
    code: number;
    data: PlatformStatistics;
    message?: string;
  }> => {
    const response = await apiClient.get('/api/platform/dashboard/statistics');
    return response as {
      success: boolean;
      code: number;
      data: PlatformStatistics;
      message?: string;
    };
  },

  // ==================== AI 工厂初始化 ====================

  /**
   * AI 初始化工厂配置
   *
   * 使用 AI 根据自然语言描述生成工厂的完整表单配置
   *
   * 后端API: POST /api/platform/factories/:factoryId/ai-initialize
   *
   * @param factoryId 工厂ID
   * @param request 包含工厂描述的请求
   * @returns AI 生成的配置响应
   */
  aiInitializeFactory: async (
    factoryId: string,
    request: AIFactoryInitRequest
  ): Promise<{
    success: boolean;
    code?: number;
    data: AIFactoryInitResponse;
    message?: string;
  }> => {
    const response = await apiClient.post(
      `/api/platform/factories/${factoryId}/ai-initialize`,
      request,
      {
        timeout: 120000, // 2分钟超时，AI生成需要较长时间
      }
    );
    return response as {
      success: boolean;
      code?: number;
      data: AIFactoryInitResponse;
      message?: string;
    };
  },

  // ==================== AI 配额规则管理 ====================

  /**
   * 获取所有配额规则
   * 后端API: GET /api/platform/ai-quota-rules
   */
  getAllQuotaRules: async (): Promise<{
    success: boolean;
    data: AIQuotaRule[];
    message?: string;
  }> => {
    const response = await apiClient.get('/api/platform/ai-quota-rules');
    return response as {
      success: boolean;
      data: AIQuotaRule[];
      message?: string;
    };
  },

  /**
   * 获取工厂的配额规则
   * 后端API: GET /api/platform/ai-quota-rules/factory/:factoryId
   */
  getFactoryQuotaRule: async (factoryId: string): Promise<{
    success: boolean;
    data: AIQuotaRule;
    message?: string;
  }> => {
    const response = await apiClient.get(`/api/platform/ai-quota-rules/factory/${factoryId}`);
    return response as {
      success: boolean;
      data: AIQuotaRule;
      message?: string;
    };
  },

  /**
   * 获取全局默认配额规则
   * 后端API: GET /api/platform/ai-quota-rules/default
   */
  getGlobalDefaultQuotaRule: async (): Promise<{
    success: boolean;
    data: AIQuotaRule;
    message?: string;
  }> => {
    const response = await apiClient.get('/api/platform/ai-quota-rules/default');
    return response as {
      success: boolean;
      data: AIQuotaRule;
      message?: string;
    };
  },

  /**
   * 创建配额规则
   * 后端API: POST /api/platform/ai-quota-rules
   */
  createQuotaRule: async (request: CreateAIQuotaRuleRequest): Promise<{
    success: boolean;
    data: AIQuotaRule;
    message?: string;
  }> => {
    const response = await apiClient.post('/api/platform/ai-quota-rules', request);
    return response as {
      success: boolean;
      data: AIQuotaRule;
      message?: string;
    };
  },

  /**
   * 更新配额规则
   * 后端API: PUT /api/platform/ai-quota-rules/:ruleId
   */
  updateQuotaRule: async (
    ruleId: number,
    request: UpdateAIQuotaRuleRequest
  ): Promise<{
    success: boolean;
    data: AIQuotaRule;
    message?: string;
  }> => {
    const response = await apiClient.put(`/api/platform/ai-quota-rules/${ruleId}`, request);
    return response as {
      success: boolean;
      data: AIQuotaRule;
      message?: string;
    };
  },

  /**
   * 删除配额规则
   * 后端API: DELETE /api/platform/ai-quota-rules/:ruleId
   */
  deleteQuotaRule: async (ruleId: number): Promise<{
    success: boolean;
    message: string;
  }> => {
    const response = await apiClient.delete(`/api/platform/ai-quota-rules/${ruleId}`);
    return response as {
      success: boolean;
      message: string;
    };
  },

  /**
   * 创建或更新全局默认配额规则
   * 后端API: POST /api/platform/ai-quota-rules/default
   */
  createOrUpdateGlobalDefaultRule: async (
    request: CreateAIQuotaRuleRequest
  ): Promise<{
    success: boolean;
    data: AIQuotaRule;
    message?: string;
  }> => {
    const response = await apiClient.post('/api/platform/ai-quota-rules/default', request);
    return response as {
      success: boolean;
      data: AIQuotaRule;
      message?: string;
    };
  },

  /**
   * 计算用户配额
   * 后端API: GET /api/platform/ai-quota-rules/calculate
   */
  calculateUserQuota: async (params: {
    factoryId: string;
    role: string;
  }): Promise<{
    success: boolean;
    data: {
      factoryId: string;
      role: string;
      calculatedQuota: number;
    };
    message?: string;
  }> => {
    const response = await apiClient.get('/api/platform/ai-quota-rules/calculate', { params });
    return response as {
      success: boolean;
      data: {
        factoryId: string;
        role: string;
        calculatedQuota: number;
      };
      message?: string;
    };
  },

  // ==================== 系统监控 ====================

  /**
   * 获取系统监控指标
   * 后端API: GET /api/platform/system/metrics
   */
  getSystemMetrics: async (): Promise<{
    success: boolean;
    data: SystemMetrics;
    message?: string;
  }> => {
    const response = await apiClient.get('/api/platform/system/metrics');
    return response as {
      success: boolean;
      data: SystemMetrics;
      message?: string;
    };
  },

  // ==================== 平台报表 ====================

  /**
   * 获取平台报表数据
   * 后端API: GET /api/platform/reports
   * @param reportType 报表类型 (production, financial, quality, user)
   * @param timePeriod 时间周期 (week, month, quarter, year)
   */
  getPlatformReport: async (
    reportType: string = 'production',
    timePeriod: string = 'month'
  ): Promise<{
    success: boolean;
    data: PlatformReportDTO;
    message?: string;
  }> => {
    const response = await apiClient.get('/api/platform/reports', {
      params: { reportType, timePeriod },
    });
    return response as {
      success: boolean;
      data: PlatformReportDTO;
      message?: string;
    };
  },
};

export default platformAPI;
