import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';
import { getErrorMsg } from '../../utils/errorHandler';

/**
 * 用户反馈API客户端
 * 路径：/api/mobile/{factoryId}/feedback
 *
 * 后端实现：MobileController
 * 功能：提交用户反馈（Bug报告、功能建议、其他反馈）
 */

// ========== 类型定义 ==========

export type FeedbackType = 'bug' | 'feature' | 'other';
export type FeedbackStatus = 'pending' | 'processing' | 'resolved';

/**
 * 提交反馈请求
 */
export interface SubmitFeedbackRequest {
  type: FeedbackType;
  title: string;
  content: string;
  contact?: string;
  screenshots?: string[];
}

/**
 * 反馈响应
 */
export interface FeedbackResponse {
  feedbackId: string;
  type: FeedbackType;
  title: string;
  content: string;
  contact?: string;
  status: FeedbackStatus;
  createdAt: string;      // ISO format
  resolvedAt?: string;    // ISO format
  screenshots?: string[];
}

// ========== API客户端类 ==========

class FeedbackApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/feedback`;
  }

  /**
   * 提交用户反馈
   * POST /feedback
   */
  async submitFeedback(
    request: SubmitFeedbackRequest,
    factoryId?: string
  ): Promise<{ success: boolean; data: FeedbackResponse; message: string }> {
    const response = await apiClient.post(this.getPath(factoryId), request);
    return (response as any).data;
  }
}

// ========== 单例导出 ==========

export const feedbackApiClient = new FeedbackApiClient();
export default feedbackApiClient;
