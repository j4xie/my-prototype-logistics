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
 * SSE 流式响应事件类型
 */
export type SSEEventType = 'start' | 'progress' | 'thinking' | 'answer' | 'complete' | 'error';

/**
 * SSE 流式响应事件数据
 */
export interface SSEEventData {
  type: SSEEventType;
  message?: string;
  content?: string;
  analysis?: string;
  sessionId?: string;
  responseTimeMs?: number;
}

/**
 * SSE 流式响应回调函数
 */
export interface SSECallbacks {
  onStart?: () => void;
  onProgress?: (message: string) => void;
  onThinking?: (content: string) => void;
  onAnswer?: (content: string) => void;
  onComplete?: (data: { analysis: string; sessionId?: string; responseTimeMs?: number }) => void;
  onError?: (message: string) => void;
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
 * 加强空值处理，防止后端响应格式不符时崩溃
 */
function transformAnalysisResponse(backendResponse: AICostAnalysisResponseBackend | null | undefined): AICostAnalysisResponse {
  // 空值保护
  if (!backendResponse) {
    return {
      success: false,
      analysis: '',
      errorMessage: '服务响应格式错误',
    };
  }

  return {
    success: backendResponse.success ?? false,
    analysis: backendResponse.analysis ?? '',
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
    // 安全提取数据：优先使用 response.data，兼容直接返回数据的情况
    const data = response?.data ?? (response as unknown as AICostAnalysisResponseBackend);
    return transformAnalysisResponse(data);
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

    // DEBUG: 打印原始响应
    console.log('=== aiApiClient 原始响应 ===');
    console.log('response:', JSON.stringify(response, null, 2));
    console.log('response?.data:', JSON.stringify(response?.data, null, 2));

    // 安全提取数据：优先使用 response.data，兼容直接返回数据的情况
    const data = response?.data ?? (response as unknown as AICostAnalysisResponseBackend);
    console.log('data to transform:', JSON.stringify(data, null, 2));

    return transformAnalysisResponse(data);
  }

  /**
   * AI时间范围成本分析 - 流式响应版本 (SSE)
   *
   * 实时返回AI分析过程，包括思考过程和最终答案
   * 适用于需要实时展示分析进度的场景
   *
   * @param request 时间范围分析请求
   * @param callbacks SSE事件回调函数
   * @param factoryId 工厂ID（可选）
   * @returns Promise<void> - 流式处理完成后resolve
   */
  async analyzeTimeRangeCostStream(
    request: TimeRangeCostAnalysisRequest,
    callbacks: SSECallbacks,
    factoryId?: string
  ): Promise<void> {
    const url = `${this.getBasePath(factoryId)}/analysis/cost/time-range/stream`;

    // 获取 token（需要从 apiClient 获取或从 store 获取）
    const token = await this.getAuthToken();

    // 获取完整的 API 基础 URL
    const baseUrl = await this.getBaseUrl();
    const fullUrl = `${baseUrl}${url}`;

    console.log('=== SSE 流式请求开始 ===');
    console.log('URL:', fullUrl);
    console.log('Request:', JSON.stringify(request, null, 2));

    let fullAnalysis = '';
    let fullThinking = '';

    try {
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整的行

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData: SSEEventData = JSON.parse(line.substring(6));
              console.log('SSE Event:', eventData.type, eventData.message || eventData.content?.substring(0, 50));

              switch (eventData.type) {
                case 'start':
                  callbacks.onStart?.();
                  break;
                case 'progress':
                  callbacks.onProgress?.(eventData.message || '处理中...');
                  break;
                case 'thinking':
                  if (eventData.content) {
                    fullThinking += eventData.content;
                    callbacks.onThinking?.(eventData.content);
                  }
                  break;
                case 'answer':
                  if (eventData.content) {
                    fullAnalysis += eventData.content;
                    callbacks.onAnswer?.(eventData.content);
                  }
                  break;
                case 'complete':
                  callbacks.onComplete?.({
                    analysis: eventData.analysis || fullAnalysis,
                    sessionId: eventData.sessionId,
                    responseTimeMs: eventData.responseTimeMs,
                  });
                  break;
                case 'error':
                  callbacks.onError?.(eventData.message || '分析失败');
                  break;
              }
            } catch (parseError) {
              console.warn('SSE 事件解析失败:', line, parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error('SSE 流式请求失败:', error);
      callbacks.onError?.(error instanceof Error ? error.message : '流式请求失败');
      throw error;
    }
  }

  /**
   * 获取认证 token
   */
  private async getAuthToken(): Promise<string> {
    // 从 SecureStore 或 zustand store 获取 token
    try {
      const SecureStore = await import('expo-secure-store');
      const token = await SecureStore.getItemAsync('access_token');
      return token || '';
    } catch {
      console.warn('无法获取 token');
      return '';
    }
  }

  /**
   * 获取 API 基础 URL
   */
  private async getBaseUrl(): Promise<string> {
    // 使用与 apiClient 相同的配置
    // 默认使用生产服务器
    return 'http://139.196.165.140:10010';
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
    // 安全提取数据：优先使用 response.data，兼容直接返回数据的情况
    const data = response?.data ?? (response as unknown as AICostAnalysisResponseBackend);
    return transformAnalysisResponse(data);
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
    // 安全提取数据：优先使用 response.data，兼容直接返回数据的情况
    const data = response?.data ?? (response as unknown as AICostAnalysisResponseBackend);
    return transformAnalysisResponse(data);
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

    // 安全提取数据：优先使用 response.data，兼容直接返回数据的情况
    const data = response?.data ?? (response as unknown as AICostAnalysisResponseBackend);
    return transformAnalysisResponse(data);
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
    // 安全提取数据：优先使用 response.data，兼容直接返回数据的情况
    const data = response?.data ?? (response as unknown as AICostAnalysisResponseBackend);
    return transformAnalysisResponse(data);
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
