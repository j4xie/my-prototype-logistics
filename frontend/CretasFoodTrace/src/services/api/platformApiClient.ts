/**
 * 平台管理员API客户端
 * 仅平台管理员可访问的功能
 */

import { apiClient } from './apiClient';
import { NotImplementedError } from '../../errors';
import type {
  FactoryAIQuota,
  PlatformAIUsageStats,
  AIQuotaUpdate
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
    const response = await apiClient.get('/api/platform/factories');
    return response.data;
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
    return response.data;
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
    return response.data;
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
    return response.data;
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
    return response.data;
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
    return response.data;
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
    return response.data;
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
    return response.data;
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
    return response.data;
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
    return response.data;
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
    return response.data;
  },
};

export default platformAPI;
