import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 白名单管理API客户端 - MVP精简版
 * MVP保留：5个核心API
 * 已移除：15个高级功能API（过期管理、使用统计、导入导出等）
 * 路径：/api/mobile/{factoryId}/whitelist/*
 *
 * 业务场景：管理员批量添加允许注册的手机号，员工注册时自动验证
 */

// ========== 类型定义 ==========

export interface WhitelistDTO {
  id: number;
  phoneNumber: string;
  realName: string;
  role: string;
  department?: string;
  status: 'PENDING' | 'ACTIVE' | 'DISABLED' | 'EXPIRED' | 'LIMIT_REACHED' | 'DELETED';
  maxUsageCount?: number;
  usedCount: number;
  expiresAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateWhitelistRequest {
  phoneNumber: string;
  realName: string;
  role: string;
  department?: string;
  maxUsageCount?: number;
  expiresAt?: string;
}

export interface BatchAddRequest {
  whitelists: CreateWhitelistRequest[];
}

export interface BatchResult {
  success: number;
  failed: number;
  errors?: string[];
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

// ========== API客户端类 ==========

class WhitelistApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    /* if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    } */
    return `/api/mobile/${currentFactoryId}/whitelist`;
  }

  /**
   * 1. 获取白名单列表（分页）
   * GET /api/{factoryId}/whitelist
   */
  async getWhitelist(params?: {
    factoryId?: string;
    status?: string;
    department?: string;
    role?: string;
    keyword?: string;
    page?: number;
    size?: number;
    sortBy?: string;
    sortDirection?: 'ASC' | 'DESC';
  }): Promise<PageResponse<WhitelistDTO>> {
    const { factoryId, ...queryParams } = params || {};
    // apiClient拦截器已统一返回data
    return await apiClient.get<PageResponse<WhitelistDTO>>(
      this.getPath(factoryId),
      { params: queryParams }
    );
  }

  /**
   * 2. 删除白名单
   * DELETE /api/{factoryId}/whitelist/{id}
   */
  async deleteWhitelist(id: number, factoryId?: string): Promise<void> {
    await apiClient.delete(`${this.getPath(factoryId)}/${id}`);
  }

  /**
   * 3. 批量添加白名单
   * POST /api/{factoryId}/whitelist/batch
   */
  async batchAddWhitelist(
    request: BatchAddRequest,
    factoryId?: string
  ): Promise<BatchResult> {
    // apiClient拦截器已统一返回data
    return await apiClient.post<BatchResult>(
      `${this.getPath(factoryId)}/batch`,
      request
    );
  }

  /**
   * 4. 批量删除白名单
   * DELETE /api/{factoryId}/whitelist/batch
   */
  async batchDeleteWhitelist(
    ids: number[],
    factoryId?: string
  ): Promise<BatchResult> {
    // apiClient拦截器已统一返回data
    return await apiClient.delete<BatchResult>(
      `${this.getPath(factoryId)}/batch`,
      { data: { ids } }
    );
  }

  /**
   * 5. 验证手机号是否在白名单中（注册时检查）
   * GET /api/{factoryId}/whitelist/validate/{phoneNumber}
   */
  async validatePhoneNumber(
    phoneNumber: string,
    factoryId?: string
  ): Promise<{
    isValid: boolean;
    whitelist?: WhitelistDTO;
    message?: string;
  }> {
    return await apiClient.get<{
      isValid: boolean;
      whitelist?: WhitelistDTO;
      message?: string;
    }>(
      `${this.getPath(factoryId)}/validate/${encodeURIComponent(phoneNumber)}`
    );
  }

  // ===== 新增功能 (Phase 3) =====

  /**
   * 6. 获取白名单详情
   * GET /api/{factoryId}/whitelist/{id}
   */
  async getWhitelistById(
    id: number,
    factoryId?: string
  ): Promise<WhitelistDTO> {
    return await apiClient.get<WhitelistDTO>(
      `${this.getPath(factoryId)}/${id}`
    );
  }

  /**
   * 7. 更新白名单
   * PUT /api/{factoryId}/whitelist/{id}
   */
  async updateWhitelist(
    id: number,
    request: Partial<CreateWhitelistRequest>,
    factoryId?: string
  ): Promise<WhitelistDTO> {
    return await apiClient.put<WhitelistDTO>(
      `${this.getPath(factoryId)}/${id}`,
      request
    );
  }

  /**
   * 8. 获取白名单统计信息
   * GET /api/{factoryId}/whitelist/stats
   */
  async getWhitelistStats(factoryId?: string): Promise<{
    total: number;
    pending: number;
    active: number;
    disabled: number;
    expired: number;
    limitReached: number;
  }> {
    return await apiClient.get<{
      total: number;
      pending: number;
      active: number;
      disabled: number;
      expired: number;
      limitReached: number;
    }>(
      `${this.getPath(factoryId)}/stats`
    );
  }

  /**
   * 9. 更新过期状态
   * PUT /api/{factoryId}/whitelist/expired
   */
  async updateExpiredStatus(factoryId?: string): Promise<{ updated: number }> {
    return await apiClient.put<{ updated: number }>(
      `${this.getPath(factoryId)}/expired`
    );
  }

  /**
   * 10. 搜索白名单
   * GET /api/{factoryId}/whitelist/search
   */
  async searchWhitelist(params: {
    keyword: string;
    page?: number;
    size?: number;
    factoryId?: string;
  }): Promise<PageResponse<WhitelistDTO>> {
    const { factoryId, ...queryParams } = params;
    return await apiClient.get<PageResponse<WhitelistDTO>>(
      `${this.getPath(factoryId)}/search`,
      { params: queryParams }
    );
  }

  /**
   * 11. 获取即将过期的白名单
   * GET /api/{factoryId}/whitelist/expiring
   */
  async getExpiringSoon(params?: {
    days?: number;
    factoryId?: string;
  }): Promise<WhitelistDTO[]> {
    const { factoryId, ...queryParams } = params || {};
    return await apiClient.get<WhitelistDTO[]>(
      `${this.getPath(factoryId)}/expiring`,
      { params: queryParams }
    );
  }

  /**
   * 12. 获取最活跃用户
   * GET /api/{factoryId}/whitelist/most-active
   */
  async getMostActiveUsers(params?: {
    limit?: number;
    factoryId?: string;
  }): Promise<WhitelistDTO[]> {
    const { factoryId, ...queryParams } = params || {};
    return await apiClient.get<WhitelistDTO[]>(
      `${this.getPath(factoryId)}/most-active`,
      { params: queryParams }
    );
  }

  /**
   * 13. 获取最近使用
   * GET /api/{factoryId}/whitelist/recently-used
   */
  async getRecentlyUsed(params?: {
    limit?: number;
    factoryId?: string;
  }): Promise<WhitelistDTO[]> {
    const { factoryId, ...queryParams } = params || {};
    return await apiClient.get<WhitelistDTO[]>(
      `${this.getPath(factoryId)}/recently-used`,
      { params: queryParams }
    );
  }

  /**
   * 14. 导出白名单
   * GET /api/{factoryId}/whitelist/export
   */
  async exportWhitelist(params?: {
    status?: string;
    factoryId?: string;
  }): Promise<Blob> {
    const { factoryId, ...queryParams } = params || {};
    return await apiClient.get<Blob>(
      `${this.getPath(factoryId)}/export`,
      {
        params: queryParams,
        responseType: 'blob'
      }
    );
  }

  /**
   * 15. 导入白名单
   * POST /api/{factoryId}/whitelist/import
   */
  async importWhitelist(
    csvData: string,
    factoryId?: string
  ): Promise<BatchResult> {
    return await apiClient.post<BatchResult>(
      `${this.getPath(factoryId)}/import`,
      { csvData }
    );
  }

  /**
   * 16. 清理已删除的记录
   * DELETE /api/{factoryId}/whitelist/cleanup
   */
  async cleanupDeleted(params?: {
    daysOld?: number;
    factoryId?: string;
  }): Promise<{ deleted: number }> {
    const { factoryId, ...queryParams } = params || {};
    return await apiClient.delete<{ deleted: number }>(
      `${this.getPath(factoryId)}/cleanup`,
      { params: queryParams }
    );
  }

  /**
   * 17. 延长有效期
   * PUT /api/{factoryId}/whitelist/{id}/extend
   */
  async extendExpiration(params: {
    id: number;
    days: number;
    factoryId?: string;
  }): Promise<WhitelistDTO> {
    const { factoryId, id, days } = params;
    return await apiClient.put<WhitelistDTO>(
      `${this.getPath(factoryId)}/${id}/extend`,
      { days }
    );
  }

  // ===== 不实现的功能 (详见 .claude/rules/unused-api-endpoints.md) =====
  /*
   * 以下功能由后端自动处理，前端不需要调用：
   * - resetUsageCount - 重置使用次数 (PUT /{id}/reset-usage)
   * - incrementUsage - 增加使用次数 (PUT /usage/{phoneNumber})
   * - updateLimitReached - 更新达限状态 (PUT /limit-reached)
   */
}

export const whitelistApiClient = new WhitelistApiClient();
export default whitelistApiClient;
