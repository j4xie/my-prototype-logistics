/**
 * 平台管理员API客户端
 * 仅平台管理员可访问的功能
 */

import { apiClient } from './apiClient';
import type {
  FactoryAIQuota,
  PlatformAIUsageStats,
  AIQuotaUpdate
} from '../../types/processing';

export const platformAPI = {
  /**
   * 获取所有工厂的AI配额设置
   */
  getFactoryAIQuotas: async (): Promise<{
    success: boolean;
    data: FactoryAIQuota[];
    message?: string;
  }> => {
    const response = await apiClient.get('/api/platform/ai-quota');
    return response.data;
  },

  /**
   * 更新工厂AI配额
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
    return response.data;
  },

  /**
   * 获取平台AI使用统计
   */
  getPlatformAIUsageStats: async (): Promise<{
    success: boolean;
    data: PlatformAIUsageStats;
    message?: string;
  }> => {
    const response = await apiClient.get('/api/platform/ai-usage-stats');
    return response.data;
  },
};

export default platformAPI;
