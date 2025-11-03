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

// Mock数据 - 临时使用，待后端API实现后删除
const MOCK_FACTORY_QUOTAS: FactoryAIQuota[] = [
  {
    id: 'FISH_2025_001',
    name: '白垩纪鱼肉加工厂',
    aiWeeklyQuota: 100,
    _count: {
      aiUsageLogs: 245
    }
  },
  {
    id: 'MEAT_2025_001',
    name: '白垩纪肉类加工厂',
    aiWeeklyQuota: 80,
    _count: {
      aiUsageLogs: 156
    }
  },
  {
    id: 'VEG_2025_001',
    name: '白垩纪蔬菜加工厂',
    aiWeeklyQuota: 50,
    _count: {
      aiUsageLogs: 89
    }
  }
];

const MOCK_USAGE_STATS: PlatformAIUsageStats = {
  currentWeek: '2025-W44',
  totalUsed: 187,
  factories: [
    {
      factoryId: 'FISH_2025_001',
      factoryName: '白垩纪鱼肉加工厂',
      weeklyQuota: 100,
      used: 78,
      remaining: 22,
      utilization: '78.00'
    },
    {
      factoryId: 'MEAT_2025_001',
      factoryName: '白垩纪肉类加工厂',
      weeklyQuota: 80,
      used: 65,
      remaining: 15,
      utilization: '81.25'
    },
    {
      factoryId: 'VEG_2025_001',
      factoryName: '白垩纪蔬菜加工厂',
      weeklyQuota: 50,
      used: 44,
      remaining: 6,
      utilization: '88.00'
    }
  ]
};

export const platformAPI = {
  /**
   * 获取所有工厂的AI配额设置
   * TODO: 后端API未实现，当前使用Mock数据
   * 后端API: GET /api/platform/ai-quota
   */
  getFactoryAIQuotas: async (): Promise<{
    success: boolean;
    data: FactoryAIQuota[];
    message?: string;
  }> => {
    // 尝试调用真实API
    try {
      const response = await apiClient.get('/api/platform/ai-quota');
      return response.data;
    } catch (error: any) {
      // 如果404或其他错误，返回Mock数据
      console.log('📦 后端API未实现，使用Mock数据 - getFactoryAIQuotas');
      return {
        success: true,
        data: MOCK_FACTORY_QUOTAS,
        message: '使用模拟数据（后端API未实现）'
      };
    }
  },

  /**
   * 更新工厂AI配额
   * TODO: 后端API未实现，当前使用Mock响应
   * 后端API: PUT /api/platform/ai-quota/:factoryId
   */
  updateFactoryAIQuota: async (params: AIQuotaUpdate): Promise<{
    success: boolean;
    data: { factoryId: string; weeklyQuota: number };
    message?: string;
  }> => {
    try {
      const response = await apiClient.put(
        `/api/platform/ai-quota/${params.factoryId}`,
        { weeklyQuota: params.weeklyQuota }
      );
      return response.data;
    } catch (error: any) {
      console.log('📦 后端API未实现，使用Mock响应 - updateFactoryAIQuota');
      // 更新Mock数据
      const factory = MOCK_FACTORY_QUOTAS.find(f => f.id === params.factoryId);
      if (factory) {
        factory.aiWeeklyQuota = params.weeklyQuota;
      }
      return {
        success: true,
        data: { factoryId: params.factoryId, weeklyQuota: params.weeklyQuota },
        message: '配额已更新（模拟数据）'
      };
    }
  },

  /**
   * 获取平台AI使用统计
   * TODO: 后端API未实现，当前使用Mock数据
   * 后端API: GET /api/platform/ai-usage-stats
   */
  getPlatformAIUsageStats: async (): Promise<{
    success: boolean;
    data: PlatformAIUsageStats;
    message?: string;
  }> => {
    try {
      const response = await apiClient.get('/api/platform/ai-usage-stats');
      return response.data;
    } catch (error: any) {
      console.log('📦 后端API未实现，使用Mock数据 - getPlatformAIUsageStats');
      return {
        success: true,
        data: MOCK_USAGE_STATS,
        message: '使用模拟数据（后端API未实现）'
      };
    }
  },
};

export default platformAPI;
