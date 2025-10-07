/**
 * 工厂设置API客户端
 * 工厂超级管理员功能
 */

import { apiClient } from './apiClient';
import type { AISettings, AISettingsResponse, AIUsageStats } from '../../types/processing';

export const factorySettingsAPI = {
  /**
   * 获取AI设置
   */
  getAISettings: async (): Promise<{
    success: boolean;
    data: AISettingsResponse;
    message?: string;
  }> => {
    const response = await apiClient.get('/api/mobile/factory-settings/ai');
    return response.data;
  },

  /**
   * 更新AI设置（不含配额）
   */
  updateAISettings: async (settings: Partial<AISettings>): Promise<{
    success: boolean;
    data: AISettings;
    message?: string;
  }> => {
    const response = await apiClient.put('/api/mobile/factory-settings/ai', settings);
    return response.data;
  },

  /**
   * 获取本工厂AI使用统计
   */
  getAIUsageStats: async (period: 'week' | 'all' = 'week'): Promise<{
    success: boolean;
    data: AIUsageStats;
    message?: string;
  }> => {
    const response = await apiClient.get('/api/mobile/factory-settings/ai/usage-stats', {
      params: { period }
    });
    return response.data;
  },
};

export default factorySettingsAPI;
