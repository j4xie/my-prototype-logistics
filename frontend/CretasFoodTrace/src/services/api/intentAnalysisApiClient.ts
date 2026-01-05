import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 意图分析 API 客户端
 *
 * 对应后端 IntentAnalysisController
 * 基础路径: /api/mobile/{factoryId}/intent-analysis
 *
 * @version 1.0.0
 * @since 2026-01-06
 */

// ============ 类型定义 ============

/**
 * 意图建议类型
 */
export type SuggestionType = 'CREATE_INTENT' | 'UPDATE_INTENT' | 'UPDATE_KEYWORDS';

/**
 * 建议状态
 */
export type SuggestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

/**
 * 意图优化建议
 */
export interface IntentOptimizationSuggestion {
  id: string;
  factoryId: string;
  suggestionType: SuggestionType;
  intentCode: string;
  suggestedIntentCode?: string;
  suggestedIntentName?: string;
  suggestedKeywords?: string[];
  suggestedCategory?: string;
  suggestedDescription?: string;
  llmConfidence: number;
  llmReasoning?: string;
  matchRecordId?: string;
  originalInput?: string;
  frequency: number;
  status: SuggestionStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 建议列表响应
 */
export interface SuggestionListResponse {
  content: IntentOptimizationSuggestion[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

/**
 * 审批新意图请求
 */
export interface ApproveCreateIntentRequest {
  intentCode: string;
  intentName: string;
  keywords: string[];
  description?: string;
  category?: string;
}

/**
 * 审批更新意图请求
 */
export interface ApproveUpdateIntentRequest {
  keywords?: string[];
  description?: string;
}

/**
 * 建议统计
 */
export interface SuggestionStats {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalCount: number;
  createIntentCount: number;
  updateIntentCount: number;
}

// ============ API客户端类 ============

class IntentAnalysisApiClient {
  /**
   * 获取基础路径
   */
  private getBasePath(factoryId?: string): string {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/intent-analysis`;
  }

  // ========== 建议列表接口 ==========

  /**
   * 获取待审批的创建意图建议列表
   */
  async getCreateIntentSuggestions(
    page = 1,
    size = 20,
    factoryId?: string
  ): Promise<SuggestionListResponse> {
    const response = await apiClient.get<SuggestionListResponse>(
      `${this.getBasePath(factoryId)}/suggestions/create-intent`,
      { params: { page, size } }
    );
    return response;
  }

  /**
   * 获取待审批的更新意图建议列表
   */
  async getUpdateIntentSuggestions(
    page = 1,
    size = 20,
    factoryId?: string
  ): Promise<SuggestionListResponse> {
    const response = await apiClient.get<SuggestionListResponse>(
      `${this.getBasePath(factoryId)}/suggestions/update-intent`,
      { params: { page, size } }
    );
    return response;
  }

  /**
   * 获取所有待审批建议列表
   */
  async getPendingSuggestions(
    page = 1,
    size = 20,
    factoryId?: string
  ): Promise<SuggestionListResponse> {
    const response = await apiClient.get<SuggestionListResponse>(
      `${this.getBasePath(factoryId)}/suggestions`,
      { params: { page, size, status: 'PENDING' } }
    );
    return response;
  }

  /**
   * 获取建议详情
   */
  async getSuggestionDetail(
    suggestionId: string,
    factoryId?: string
  ): Promise<IntentOptimizationSuggestion> {
    const response = await apiClient.get<IntentOptimizationSuggestion>(
      `${this.getBasePath(factoryId)}/suggestions/${suggestionId}`
    );
    return response;
  }

  // ========== 审批接口 ==========

  /**
   * 批准创建新意图建议
   */
  async approveCreateIntent(
    suggestionId: string,
    request: ApproveCreateIntentRequest,
    factoryId?: string
  ): Promise<void> {
    await apiClient.post(
      `${this.getBasePath(factoryId)}/suggestions/${suggestionId}/approve-create-intent`,
      request
    );
  }

  /**
   * 批准更新意图建议
   */
  async approveUpdateIntent(
    suggestionId: string,
    request: ApproveUpdateIntentRequest,
    factoryId?: string
  ): Promise<void> {
    await apiClient.post(
      `${this.getBasePath(factoryId)}/suggestions/${suggestionId}/approve-update-intent`,
      request
    );
  }

  /**
   * 拒绝建议
   */
  async rejectSuggestion(
    suggestionId: string,
    reason?: string,
    factoryId?: string
  ): Promise<void> {
    await apiClient.post(
      `${this.getBasePath(factoryId)}/suggestions/${suggestionId}/reject`,
      { reason }
    );
  }

  // ========== 统计接口 ==========

  /**
   * 获取建议统计
   */
  async getSuggestionStats(factoryId?: string): Promise<SuggestionStats> {
    const response = await apiClient.get<SuggestionStats>(
      `${this.getBasePath(factoryId)}/suggestions/stats`
    );
    return response;
  }

  // ========== 批量操作接口 ==========

  /**
   * 批量拒绝建议
   */
  async batchRejectSuggestions(
    suggestionIds: string[],
    reason?: string,
    factoryId?: string
  ): Promise<void> {
    await apiClient.post(
      `${this.getBasePath(factoryId)}/suggestions/batch-reject`,
      { suggestionIds, reason }
    );
  }
}

// ============ 导出 ============

export const intentAnalysisApiClient = new IntentAnalysisApiClient();

export default intentAnalysisApiClient;
