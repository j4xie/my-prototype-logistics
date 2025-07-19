/**
 * 平台管理服务
 * 处理工厂管理、平台级用户创建等功能
 */

import { apiClient } from '@/lib/api';
import { API_ENDPOINTS } from '@/config/api-endpoints';

/**
 * 工厂信息接口
 */
export interface Factory {
  id: string;
  name: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  whitelistCount: number;
}

/**
 * 工厂列表响应接口
 */
export interface FactoryListResponse {
  items: Factory[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * 工厂统计接口
 */
export interface FactoryStats {
  totalFactories: number;
  activeFactories: number;
  inactiveFactories: number;
  totalUsers: number;
  totalWhitelists: number;
  recentRegistrations: number;
}

/**
 * 创建工厂参数
 */
export interface CreateFactoryParams {
  name: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail?: string;
  description?: string;
}

/**
 * 更新工厂参数
 */
export interface UpdateFactoryParams {
  name?: string;
  address?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  description?: string;
  isActive?: boolean;
}

/**
 * 工厂查询参数
 */
export interface FactoryListParams {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
  search?: string;
}

/**
 * 创建超级管理员参数
 */
export interface CreateSuperAdminParams {
  factoryId: string;
  username: string;
  password: string;
  fullName: string;
  email?: string;
  phone?: string;
}

/**
 * 平台API错误类
 */
export class PlatformApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'PlatformApiError';
  }
}

/**
 * 平台管理服务类
 */
export class PlatformService {
  /**
   * 获取工厂列表
   */
  async getFactoryList(params: FactoryListParams = {}): Promise<FactoryListResponse> {
    try {
      const {
        page = 1,
        pageSize = 10,
        isActive,
        search
      } = params;

      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (isActive !== undefined) {
        queryParams.append('isActive', isActive.toString());
      }

      if (search) {
        queryParams.append('search', search);
      }

      const endpoint = `${API_ENDPOINTS.PLATFORM.FACTORIES}?${queryParams.toString()}`;
      const response = await apiClient.get(endpoint);

      console.log('[PlatformService] 获取工厂列表响应:', response);

      if (response && response.success) {
        return response.data;
      }

      throw new PlatformApiError(
        response?.message || '获取工厂列表失败',
        400,
        'GET_FACTORIES_FAILED'
      );

    } catch (error) {
      console.error('[PlatformService] 获取工厂列表失败:', error);

      if (error instanceof PlatformApiError) {
        throw error;
      }

      throw new PlatformApiError(
        error instanceof Error ? error.message : '获取工厂列表请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 获取工厂统计信息
   */
  async getFactoryStats(): Promise<FactoryStats> {
    try {
      const response = await apiClient.get(API_ENDPOINTS.PLATFORM.FACTORY_STATS);

      console.log('[PlatformService] 获取工厂统计响应:', response);

      if (response && response.success) {
        return response.data;
      }

      throw new PlatformApiError(
        response?.message || '获取工厂统计失败',
        400,
        'GET_FACTORY_STATS_FAILED'
      );

    } catch (error) {
      console.error('[PlatformService] 获取工厂统计失败:', error);

      if (error instanceof PlatformApiError) {
        throw error;
      }

      throw new PlatformApiError(
        error instanceof Error ? error.message : '获取工厂统计请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 创建新工厂
   */
  async createFactory(params: CreateFactoryParams): Promise<Factory> {
    try {
      console.log('[PlatformService] 创建工厂:', params);

      const response = await apiClient.post(API_ENDPOINTS.PLATFORM.FACTORIES, params);

      console.log('[PlatformService] 创建工厂响应:', response);

      if (response && response.success) {
        return response.data.factory;
      }

      throw new PlatformApiError(
        response?.message || '创建工厂失败',
        400,
        'CREATE_FACTORY_FAILED'
      );

    } catch (error) {
      console.error('[PlatformService] 创建工厂失败:', error);

      if (error instanceof PlatformApiError) {
        throw error;
      }

      throw new PlatformApiError(
        error instanceof Error ? error.message : '创建工厂请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 更新工厂信息
   */
  async updateFactory(factoryId: string, params: UpdateFactoryParams): Promise<Factory> {
    try {
      console.log('[PlatformService] 更新工厂:', { factoryId, ...params });

      const endpoint = `${API_ENDPOINTS.PLATFORM.FACTORIES}/${factoryId}`;
      const response = await apiClient.put(endpoint, params);

      console.log('[PlatformService] 更新工厂响应:', response);

      if (response && response.success) {
        return response.data.factory;
      }

      throw new PlatformApiError(
        response?.message || '更新工厂失败',
        400,
        'UPDATE_FACTORY_FAILED'
      );

    } catch (error) {
      console.error('[PlatformService] 更新工厂失败:', error);

      if (error instanceof PlatformApiError) {
        throw error;
      }

      throw new PlatformApiError(
        error instanceof Error ? error.message : '更新工厂请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 删除工厂
   */
  async deleteFactory(factoryId: string): Promise<void> {
    try {
      console.log('[PlatformService] 删除工厂:', factoryId);

      const endpoint = `${API_ENDPOINTS.PLATFORM.FACTORIES}/${factoryId}`;
      const response = await apiClient.delete(endpoint);

      console.log('[PlatformService] 删除工厂响应:', response);

      if (response && response.success) {
        return;
      }

      throw new PlatformApiError(
        response?.message || '删除工厂失败',
        400,
        'DELETE_FACTORY_FAILED'
      );

    } catch (error) {
      console.error('[PlatformService] 删除工厂失败:', error);

      if (error instanceof PlatformApiError) {
        throw error;
      }

      throw new PlatformApiError(
        error instanceof Error ? error.message : '删除工厂请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 为工厂创建超级管理员
   */
  async createSuperAdmin(params: CreateSuperAdminParams): Promise<any> {
    try {
      console.log('[PlatformService] 创建超级管理员:', { 
        factoryId: params.factoryId, 
        username: params.username 
      });

      const endpoint = `${API_ENDPOINTS.PLATFORM.CREATE_SUPER_ADMIN}/${params.factoryId}/super-admin`;
      const response = await apiClient.post(endpoint, {
        username: params.username,
        password: params.password,
        fullName: params.fullName,
        email: params.email,
        phone: params.phone
      });

      console.log('[PlatformService] 创建超级管理员响应:', response);

      if (response && response.success) {
        return response.data;
      }

      throw new PlatformApiError(
        response?.message || '创建超级管理员失败',
        400,
        'CREATE_SUPER_ADMIN_FAILED'
      );

    } catch (error) {
      console.error('[PlatformService] 创建超级管理员失败:', error);

      if (error instanceof PlatformApiError) {
        throw error;
      }

      throw new PlatformApiError(
        error instanceof Error ? error.message : '创建超级管理员请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 切换工厂状态
   */
  async toggleFactoryStatus(factoryId: string, isActive: boolean): Promise<Factory> {
    try {
      console.log('[PlatformService] 切换工厂状态:', { factoryId, isActive });

      const endpoint = `${API_ENDPOINTS.PLATFORM.FACTORIES}/${factoryId}/status`;
      const response = await apiClient.put(endpoint, { isActive });

      console.log('[PlatformService] 切换工厂状态响应:', response);

      if (response && response.success) {
        return response.data.factory;
      }

      throw new PlatformApiError(
        response?.message || '切换工厂状态失败',
        400,
        'TOGGLE_FACTORY_STATUS_FAILED'
      );

    } catch (error) {
      console.error('[PlatformService] 切换工厂状态失败:', error);

      if (error instanceof PlatformApiError) {
        throw error;
      }

      throw new PlatformApiError(
        error instanceof Error ? error.message : '切换工厂状态请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 获取工厂详情
   */
  async getFactoryDetail(factoryId: string): Promise<Factory> {
    try {
      console.log('[PlatformService] 获取工厂详情:', factoryId);

      const endpoint = `${API_ENDPOINTS.PLATFORM.FACTORIES}/${factoryId}`;
      const response = await apiClient.get(endpoint);

      console.log('[PlatformService] 获取工厂详情响应:', response);

      if (response && response.success) {
        return response.data.factory;
      }

      throw new PlatformApiError(
        response?.message || '获取工厂详情失败',
        400,
        'GET_FACTORY_DETAIL_FAILED'
      );

    } catch (error) {
      console.error('[PlatformService] 获取工厂详情失败:', error);

      if (error instanceof PlatformApiError) {
        throw error;
      }

      throw new PlatformApiError(
        error instanceof Error ? error.message : '获取工厂详情请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }
}

// 创建平台服务实例
export const platformService = new PlatformService();

// 导出服务实例
export default platformService;