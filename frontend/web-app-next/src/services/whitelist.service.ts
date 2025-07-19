/**
 * 白名单管理服务
 * 对接新后端API的白名单管理功能
 */

import { apiClient } from '@/lib/api';
import { API_ENDPOINTS } from '@/config/api-endpoints';

/**
 * 白名单状态枚举
 */
export type WhitelistStatus = 'PENDING' | 'REGISTERED' | 'EXPIRED';

/**
 * 白名单记录接口
 */
export interface WhitelistRecord {
  id: number;
  phoneNumber: string;
  status: WhitelistStatus;
  createdAt: string;
  expiresAt?: string;
  addedByUser?: {
    id: number;
    username: string;
    fullName: string;
  };
}

/**
 * 白名单列表响应接口
 */
export interface WhitelistListResponse {
  items: WhitelistRecord[];
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
 * 白名单统计接口
 */
export interface WhitelistStats {
  statusStats: {
    PENDING: number;
    REGISTERED: number;
    EXPIRED: number;
  };
  todayAdded: number;
  expiringSoon: number;
  total: number;
}

/**
 * 白名单查询参数
 */
export interface WhitelistListParams {
  page?: number;
  pageSize?: number;
  status?: WhitelistStatus;
  search?: string;
}

/**
 * 添加白名单参数
 */
export interface AddWhitelistParams {
  phoneNumbers: string[];
  expiresAt?: string;
}

/**
 * 白名单API错误类
 */
export class WhitelistApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'WhitelistApiError';
  }
}

/**
 * 白名单管理服务类
 */
export class WhitelistService {
  /**
   * 获取白名单列表
   */
  async getWhitelistList(params: WhitelistListParams = {}): Promise<WhitelistListResponse> {
    try {
      const {
        page = 1,
        pageSize = 10,
        status,
        search
      } = params;

      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (status) {
        queryParams.append('status', status);
      }

      if (search) {
        queryParams.append('search', search);
      }

      const endpoint = `${API_ENDPOINTS.WHITELIST.LIST}?${queryParams.toString()}`;
      const response = await apiClient.get(endpoint);

      console.log('[WhitelistService] 获取白名单列表响应:', response);

      if (response && response.success) {
        return response.data;
      }

      throw new WhitelistApiError(
        response?.message || '获取白名单列表失败',
        400,
        'GET_WHITELIST_FAILED'
      );

    } catch (error) {
      console.error('[WhitelistService] 获取白名单列表失败:', error);

      if (error instanceof WhitelistApiError) {
        throw error;
      }

      throw new WhitelistApiError(
        error instanceof Error ? error.message : '获取白名单列表请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 获取白名单统计信息
   */
  async getWhitelistStats(): Promise<WhitelistStats> {
    try {
      const response = await apiClient.get(API_ENDPOINTS.WHITELIST.STATS);

      console.log('[WhitelistService] 获取白名单统计响应:', response);

      if (response && response.success) {
        return response.data;
      }

      throw new WhitelistApiError(
        response?.message || '获取白名单统计失败',
        400,
        'GET_STATS_FAILED'
      );

    } catch (error) {
      console.error('[WhitelistService] 获取白名单统计失败:', error);

      if (error instanceof WhitelistApiError) {
        throw error;
      }

      throw new WhitelistApiError(
        error instanceof Error ? error.message : '获取白名单统计请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 添加白名单
   */
  async addWhitelist(params: AddWhitelistParams): Promise<any> {
    try {
      console.log('[WhitelistService] 添加白名单:', params);

      const response = await apiClient.post(API_ENDPOINTS.WHITELIST.ADD, params);

      console.log('[WhitelistService] 添加白名单响应:', response);

      if (response && response.success) {
        return response.data;
      }

      throw new WhitelistApiError(
        response?.message || '添加白名单失败',
        400,
        'ADD_WHITELIST_FAILED'
      );

    } catch (error) {
      console.error('[WhitelistService] 添加白名单失败:', error);

      if (error instanceof WhitelistApiError) {
        throw error;
      }

      throw new WhitelistApiError(
        error instanceof Error ? error.message : '添加白名单请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 更新白名单状态
   */
  async updateWhitelist(id: number, status: WhitelistStatus, expiresAt?: string): Promise<any> {
    try {
      console.log('[WhitelistService] 更新白名单状态:', { id, status, expiresAt });

      const updateData: any = { status };
      if (expiresAt) {
        updateData.expiresAt = expiresAt;
      }

      const endpoint = `${API_ENDPOINTS.WHITELIST.UPDATE}/${id}`;
      const response = await apiClient.put(endpoint, updateData);

      console.log('[WhitelistService] 更新白名单响应:', response);

      if (response && response.success) {
        return response.data;
      }

      throw new WhitelistApiError(
        response?.message || '更新白名单失败',
        400,
        'UPDATE_WHITELIST_FAILED'
      );

    } catch (error) {
      console.error('[WhitelistService] 更新白名单失败:', error);

      if (error instanceof WhitelistApiError) {
        throw error;
      }

      throw new WhitelistApiError(
        error instanceof Error ? error.message : '更新白名单请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 删除白名单记录
   */
  async deleteWhitelist(id: number): Promise<any> {
    try {
      console.log('[WhitelistService] 删除白名单记录:', id);

      const endpoint = `${API_ENDPOINTS.WHITELIST.DELETE}/${id}`;
      const response = await apiClient.delete(endpoint);

      console.log('[WhitelistService] 删除白名单响应:', response);

      if (response && response.success) {
        return response.data;
      }

      throw new WhitelistApiError(
        response?.message || '删除白名单失败',
        400,
        'DELETE_WHITELIST_FAILED'
      );

    } catch (error) {
      console.error('[WhitelistService] 删除白名单失败:', error);

      if (error instanceof WhitelistApiError) {
        throw error;
      }

      throw new WhitelistApiError(
        error instanceof Error ? error.message : '删除白名单请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 批量删除白名单记录
   */
  async batchDeleteWhitelist(ids: number[]): Promise<any> {
    try {
      console.log('[WhitelistService] 批量删除白名单记录:', ids);

      const response = await apiClient.delete(API_ENDPOINTS.WHITELIST.BATCH_DELETE, {
        data: { ids: ids.map(id => id.toString()) }
      });

      console.log('[WhitelistService] 批量删除白名单响应:', response);

      if (response && response.success) {
        return response.data;
      }

      throw new WhitelistApiError(
        response?.message || '批量删除白名单失败',
        400,
        'BATCH_DELETE_WHITELIST_FAILED'
      );

    } catch (error) {
      console.error('[WhitelistService] 批量删除白名单失败:', error);

      if (error instanceof WhitelistApiError) {
        throw error;
      }

      throw new WhitelistApiError(
        error instanceof Error ? error.message : '批量删除白名单请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 更新过期白名单
   */
  async updateExpiredWhitelist(): Promise<any> {
    try {
      console.log('[WhitelistService] 更新过期白名单');

      const response = await apiClient.put(API_ENDPOINTS.WHITELIST.UPDATE_EXPIRED);

      console.log('[WhitelistService] 更新过期白名单响应:', response);

      if (response && response.success) {
        return response.data;
      }

      throw new WhitelistApiError(
        response?.message || '更新过期白名单失败',
        400,
        'UPDATE_EXPIRED_FAILED'
      );

    } catch (error) {
      console.error('[WhitelistService] 更新过期白名单失败:', error);

      if (error instanceof WhitelistApiError) {
        throw error;
      }

      throw new WhitelistApiError(
        error instanceof Error ? error.message : '更新过期白名单请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 批量上传白名单 (前端解析Excel后调用添加API)
   */
  async uploadWhitelistFile(file: File, expiresAt?: string): Promise<any> {
    try {
      console.log('[WhitelistService] 开始处理Excel文件:', file.name);

      // 动态导入Excel解析器
      const { excelParser } = await import('@/utils/excel-parser');
      
      // 解析文件
      const parseResult = await excelParser.parseFile(file, {
        maxRows: 1000,
        allowDuplicates: false,
        strictValidation: true
      });

      if (parseResult.phoneNumbers.length === 0) {
        throw new WhitelistApiError(
          parseResult.errors.length > 0 
            ? `文件解析失败: ${parseResult.errors.join('; ')}`
            : '文件中未找到有效的手机号码',
          400,
          'NO_VALID_PHONES'
        );
      }

      console.log('[WhitelistService] 解析结果:', {
        totalRows: parseResult.totalRows,
        validPhones: parseResult.phoneNumbers.length,
        errors: parseResult.errors.length
      });

      // 分批上传（每批最多100个）
      const batchSize = 100;
      const results = [];
      const errors = [...parseResult.errors];

      for (let i = 0; i < parseResult.phoneNumbers.length; i += batchSize) {
        const batch = parseResult.phoneNumbers.slice(i, i + batchSize);
        
        try {
          const result = await this.addWhitelist({
            phoneNumbers: batch,
            expiresAt
          });
          results.push(result);
        } catch (error) {
          const errorMsg = `批次 ${Math.floor(i / batchSize) + 1} 上传失败: ${error instanceof Error ? error.message : '未知错误'}`;
          console.warn(`[WhitelistService] ${errorMsg}`);
          errors.push(errorMsg);
          // 继续处理下一批
        }
      }

      return {
        totalPhones: parseResult.phoneNumbers.length,
        successBatches: results.length,
        totalBatches: Math.ceil(parseResult.phoneNumbers.length / batchSize),
        parseResult,
        errors,
        results
      };

    } catch (error) {
      console.error('[WhitelistService] 批量上传失败:', error);

      if (error instanceof WhitelistApiError) {
        throw error;
      }

      throw new WhitelistApiError(
        error instanceof Error ? error.message : '批量上传请求失败',
        500,
        'UPLOAD_FAILED'
      );
    }
  }

}

// 创建白名单服务实例
export const whitelistService = new WhitelistService();

// 导出服务实例
export default whitelistService;