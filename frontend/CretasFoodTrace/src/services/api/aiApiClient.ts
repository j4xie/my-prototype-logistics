import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * AI API客户端
 *
 * 统一的AI接口调用，对应后端 AIController
 * 基础路径: /api/mobile/{factoryId}/ai
 *
 * @version 2.0.0
 * @since 2025-11-04
 */

// ============ 类型定义 ============

/**
 * AI批次成本分析请求
 */
export interface BatchCostAnalysisRequest {
  batchId: number;
  question?: string;
  sessionId?: string;
  analysisType?: 'default' | 'deep' | 'comparison';
  /**
   * 是否启用思考模式（默认true）
   * 思考模式下，AI会先进行深度推理再给出答案
   */
  enableThinking?: boolean;
  /**
   * 思考预算（10-100，默认50）
   * 数值越大，思考越深入
   */
  thinkingBudget?: number;
}

/**
 * AI时间范围成本分析请求
 */
export interface TimeRangeCostAnalysisRequest {
  startDate: string; // ISO 8601 format
  endDate: string;   // ISO 8601 format
  dimension?: 'overall' | 'daily' | 'weekly';
  question?: string;
  /** 是否启用思考模式（默认true） */
  enableThinking?: boolean;
  /** 思考预算（10-100，默认50） */
  thinkingBudget?: number;
}

/**
 * AI批次对比分析请求
 */
export interface ComparativeCostAnalysisRequest {
  batchIds: number[];
  dimension?: 'cost' | 'efficiency' | 'quality' | 'comprehensive';
  question?: string;
  /** 是否启用思考模式（默认true） */
  enableThinking?: boolean;
  /** 思考预算（10-100，默认50） */
  thinkingBudget?: number;
}

/**
 * AI对话请求
 */
export interface ConversationRequest {
  sessionId: string;
  message: string;
  contextBatchId?: number;
}

/**
 * AI报告生成请求
 */
export interface ReportGenerationRequest {
  reportType: 'batch' | 'weekly' | 'monthly' | 'custom';
  batchId?: number;
  startDate?: string;
  endDate?: string;
  title?: string;
  dimensions?: string[];
}

/**
 * 通用API响应包装格式
 */
interface ApiResponseWrapper<T> {
  success: boolean;
  code: number;
  message: string;
  data: T;
  timestamp?: string;
}

/**
 * AI成本分析响应 - 后端原始格式
 */
interface AICostAnalysisResponseBackend {
  success: boolean;
  analysis: string;
  session_id?: string;
  messageCount?: number;
  quota?: AIQuotaInfoBackend;
  cacheHit?: boolean;
  processingTimeMs?: number;  // 后端使用 processingTimeMs
  errorMessage?: string;
  generatedAt?: string;
  expiresAt?: string;
}

/**
 * AI成本分析响应 - 前端使用格式
 */
export interface AICostAnalysisResponse {
  success: boolean;
  analysis: string;
  session_id?: string;
  messageCount?: number;
  quota?: AIQuotaInfo;
  cacheHit?: boolean;
  responseTimeMs?: number;  // 前端使用 responseTimeMs
  errorMessage?: string;
  generatedAt?: string;
  expiresAt?: string;
}

/**
 * AI配额信息 - 后端实际返回格式
 */
export interface AIQuotaInfoBackend {
  total: number;
  used: number;
  remaining: number;
  usageRate: number;
  resetDate: string;
  exceeded: boolean;
}

/**
 * AI配额信息 - 前端使用格式
 */
export interface AIQuotaInfo {
  weeklyQuota: number;
  usedQuota: number;
  remainingQuota: number;
  resetDate: string;
  usagePercentage: number;
  status: 'active' | 'warning' | 'exhausted' | 'expired';
}

/**
 * 转换后端配额响应为前端格式
 */
function transformQuotaResponse(backendQuota: AIQuotaInfoBackend | null | undefined): AIQuotaInfo | undefined {
  if (!backendQuota) return undefined;

  // 计算状态
  let status: AIQuotaInfo['status'] = 'active';
  if (backendQuota.exceeded) {
    status = 'exhausted';
  } else if (backendQuota.usageRate > 80) {
    status = 'warning';
  }

  return {
    weeklyQuota: backendQuota.total ?? 100,
    usedQuota: backendQuota.used ?? 0,
    remainingQuota: backendQuota.remaining ?? 100,
    resetDate: backendQuota.resetDate ?? '',
    usagePercentage: backendQuota.usageRate ?? 0,
    status,
  };
}

/**
 * 转换后端分析响应为前端格式
 */
function transformAnalysisResponse(backendResponse: AICostAnalysisResponseBackend): AICostAnalysisResponse {
  return {
    success: backendResponse.success,
    analysis: backendResponse.analysis,
    session_id: backendResponse.session_id,
    messageCount: backendResponse.messageCount,
    quota: transformQuotaResponse(backendResponse.quota),
    cacheHit: backendResponse.cacheHit,
    responseTimeMs: backendResponse.processingTimeMs, // 字段名映射
    errorMessage: backendResponse.errorMessage,
    generatedAt: backendResponse.generatedAt,
    expiresAt: backendResponse.expiresAt,
  };
}

/**
 * AI对话响应
 */
export interface ConversationResponse {
  sessionId: string;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'closed';
  contextBatchId?: number;
}

/**
 * 对话消息
 */
export interface ConversationMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  tokens?: number;
}

/**
 * AI报告列表响应
 */
export interface ReportListResponse {
  reports: ReportSummary[];
  total: number;
  page?: number;
  pageSize?: number;
}

/**
 * 报告摘要
 */
export interface ReportSummary {
  reportId: number;
  reportType: 'batch' | 'weekly' | 'monthly' | 'custom';
  title: string;
  createdAt: string;
  batchId?: number;
  batchNumber?: string;
  startDate?: string;
  endDate?: string;
  totalCost?: number;
  keyFindingsCount?: number;
  suggestionsCount?: number;
}

/**
 * AI健康检查响应
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unavailable';
  deepseekAvailable: boolean;
  responseTime: number;
  lastCheckTime: string;
  errorMessage?: string;
}

// ============ API客户端类 ============

/**
 * AI API客户端
 */
class AIApiClient {
  /**
   * 获取基础路径
   */
  private getBasePath(factoryId?: string): string {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/ai`;
  }

  // ========== 成本分析接口 ==========

  /**
   * AI批次成本分析
   *
   * 支持三种分析模式：
   * 1. 默认分析（无question）- 首次分析，消耗配额
   * 2. Follow-up对话（有question + sessionId）- 追问，少量消耗配额
   * 3. 历史综合报告（历史批次）- 深度分析，较多消耗配额
   *
   * @param request 批次成本分析请求
   * @param factoryId 工厂ID（可选）
   */
  async analyzeBatchCost(
    request: BatchCostAnalysisRequest,
    factoryId?: string
  ): Promise<AICostAnalysisResponse> {
    // API返回格式: { code, message, data: AICostAnalysisResponseBackend, ... }
    const response = await apiClient.post<ApiResponseWrapper<AICostAnalysisResponseBackend>>(
      `${this.getBasePath(factoryId)}/analysis/cost/batch`,
      request
    );
    // 从响应包装中提取实际数据并转换为前端格式
    return transformAnalysisResponse(response.data);
  }

  /**
   * AI时间范围成本分析
   *
   * 分析指定时间段内的成本数据
   *
   * @param request 时间范围分析请求
   * @param factoryId 工厂ID（可选）
   */
  async analyzeTimeRangeCost(
    request: TimeRangeCostAnalysisRequest,
    factoryId?: string
  ): Promise<AICostAnalysisResponse> {
    // API返回格式: { code, message, data: AICostAnalysisResponseBackend, ... }
    const response = await apiClient.post<ApiResponseWrapper<AICostAnalysisResponseBackend>>(
      `${this.getBasePath(factoryId)}/analysis/cost/time-range`,
      request
    );
    // 从响应包装中提取实际数据并转换为前端格式
    return transformAnalysisResponse(response.data);
  }

  /**
   * AI批次对比分析
   *
   * 对比2-5个批次的成本、效率、质量等指标
   *
   * @param request 批次对比分析请求
   * @param factoryId 工厂ID（可选）
   */
  async compareBatchCosts(
    request: ComparativeCostAnalysisRequest,
    factoryId?: string
  ): Promise<AICostAnalysisResponse> {
    // API返回格式: { code, message, data: AICostAnalysisResponseBackend, ... }
    const response = await apiClient.post<ApiResponseWrapper<AICostAnalysisResponseBackend>>(
      `${this.getBasePath(factoryId)}/analysis/cost/compare`,
      request
    );
    // 从响应包装中提取实际数据并转换为前端格式
    return transformAnalysisResponse(response.data);
  }

  // ========== 配额管理接口 ==========

  /**
   * 查询AI配额信息
   *
   * 获取工厂的AI配额使用情况、剩余额度、使用记录等
   *
   * @param factoryId 工厂ID（可选）
   */
  async getQuotaInfo(factoryId?: string): Promise<AIQuotaInfo> {
    // API返回格式: { code, message, data: AIQuotaInfoBackend, ... }
    const response = await apiClient.get<ApiResponseWrapper<AIQuotaInfoBackend>>(
      `${this.getBasePath(factoryId)}/quota`
    );
    // 从响应包装中提取实际数据并转换为前端格式
    const transformed = transformQuotaResponse(response.data);
    if (!transformed) {
      throw new Error('无法获取配额信息');
    }
    return transformed;
  }

  /**
   * 更新AI配额（仅供平台管理员使用）
   *
   * @param newQuota 新配额金额
   * @param factoryId 工厂ID（可选）
   */
  async updateQuota(newQuota: number, factoryId?: string): Promise<void> {
    await apiClient.put(
      `${this.getBasePath(factoryId)}/quota`,
      null,
      {
        params: { newQuota }
      }
    );
  }

  // ========== 对话管理接口 ==========

  /**
   * 获取AI对话历史
   *
   * 获取指定会话的完整对话历史记录
   *
   * @param sessionId 会话ID
   * @param factoryId 工厂ID（可选）
   */
  async getConversation(
    sessionId: string,
    factoryId?: string
  ): Promise<ConversationResponse> {
    return await apiClient.get<ConversationResponse>(
      `${this.getBasePath(factoryId)}/conversations/${sessionId}`
    );
  }

  /**
   * 继续AI对话
   *
   * @param request 对话请求
   * @param factoryId 工厂ID（可选）
   */
  async continueConversation(
    request: ConversationRequest,
    factoryId?: string
  ): Promise<AICostAnalysisResponse> {
    // API返回格式: { code, message, data: AICostAnalysisResponseBackend, ... }
    const response = await apiClient.post<ApiResponseWrapper<AICostAnalysisResponseBackend>>(
      `${this.getBasePath(factoryId)}/conversations/continue`,
      request
    );
    // 从响应包装中提取实际数据并转换为前端格式
    return transformAnalysisResponse(response.data);
  }

  /**
   * 关闭AI对话会话
   *
   * @param sessionId 会话ID
   * @param factoryId 工厂ID（可选）
   */
  async closeConversation(
    sessionId: string,
    factoryId?: string
  ): Promise<void> {
    await apiClient.delete(
      `${this.getBasePath(factoryId)}/conversations/${sessionId}`
    );
  }

  // ========== 报告管理接口 ==========

  /**
   * 获取AI报告列表
   *
   * 获取工厂的AI成本分析报告列表，支持按类型和时间筛选
   *
   * @param params 查询参数
   * @param factoryId 工厂ID（可选）
   */
  async getReports(
    params?: {
      reportType?: string;
      startDate?: string;
      endDate?: string;
    },
    factoryId?: string
  ): Promise<ReportListResponse> {
    const response = await apiClient.get<any>(
      `${this.getBasePath(factoryId)}/reports`,
      { params }
    );

    // 后端返回格式与前端类型不匹配，需要转换字段名
    const backendData = response.data;
    if (backendData && Array.isArray(backendData.reports)) {
      const transformedReports: ReportSummary[] = backendData.reports.map((report: any) => ({
        reportId: report.id,
        reportType: report.reportType,
        title: report.summaryText?.substring(0, 100) || `${report.reportType === 'weekly' ? '周报' : report.reportType === 'monthly' ? '月报' : '报告'} - ${new Date(report.createdAt).toLocaleDateString('zh-CN')}`,
        createdAt: report.createdAt,
        batchId: report.batchId,
        batchNumber: report.batchNumber,
        startDate: report.periodStart,
        endDate: report.periodEnd,
        totalCost: report.totalCost,
        keyFindingsCount: report.keyFindingsCount,
        suggestionsCount: report.suggestionsCount,
      }));
      return {
        reports: transformedReports,
        total: backendData.total ?? transformedReports.length,
        page: backendData.page,
        pageSize: backendData.pageSize,
      };
    }

    return { reports: [], total: 0 };
  }

  /**
   * 获取AI报告详情
   *
   * @param reportId 报告ID
   * @param factoryId 工厂ID（可选）
   */
  async getReportDetail(
    reportId: number,
    factoryId?: string
  ): Promise<AICostAnalysisResponse> {
    // API返回格式: { code, message, data: AICostAnalysisResponseBackend, ... }
    // apiClient.get 返回的是axios response.data，即整个响应体
    const response = await apiClient.get<ApiResponseWrapper<AICostAnalysisResponseBackend>>(
      `${this.getBasePath(factoryId)}/reports/${reportId}`
    );

    // 从响应包装中提取实际数据
    const backendData = response.data;

    // 转换后端响应为前端格式
    return transformAnalysisResponse(backendData);
  }

  /**
   * 生成新报告（手动触发）
   *
   * @param request 报告生成请求
   * @param factoryId 工厂ID（可选）
   */
  async generateReport(
    request: ReportGenerationRequest,
    factoryId?: string
  ): Promise<AICostAnalysisResponse> {
    // API返回格式: { code, message, data: AICostAnalysisResponseBackend, ... }
    const response = await apiClient.post<ApiResponseWrapper<AICostAnalysisResponseBackend>>(
      `${this.getBasePath(factoryId)}/reports/generate`,
      request
    );
    // 从响应包装中提取实际数据并转换为前端格式
    return transformAnalysisResponse(response.data);
  }

  // ========== 健康检查接口 ==========

  /**
   * AI服务健康检查
   *
   * 检查AI服务和DeepSeek API的可用性
   *
   * @param factoryId 工厂ID（可选）
   */
  async checkHealth(factoryId?: string): Promise<HealthCheckResponse> {
    return await apiClient.get<HealthCheckResponse>(
      `${this.getBasePath(factoryId)}/health`
    );
  }
}

// ============ 导出 ============

/**
 * AI API客户端单例
 */
export const aiApiClient = new AIApiClient();

/**
 * 默认导出
 */
export default aiApiClient;
