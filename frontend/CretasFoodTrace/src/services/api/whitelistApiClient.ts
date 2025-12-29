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
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'LIMIT_REACHED';
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
  private getFactoryPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}`;
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
      `${this.getFactoryPath(factoryId)}/whitelist`,
      { params: queryParams }
    );
  }

  /**
   * 2. 删除白名单
   * DELETE /api/{factoryId}/whitelist/{id}
   */
  async deleteWhitelist(id: number, factoryId?: string): Promise<void> {
    await apiClient.delete(`${this.getFactoryPath(factoryId)}/whitelist/${id}`);
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
    console.log("----", request);
    var _data = {entries: request.whitelists}
    return await apiClient.post<BatchResult>(
      `${this.getFactoryPath(factoryId)}/whitelist/batch`,
      _data
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
      `${this.getFactoryPath(factoryId)}/whitelist/batch`,
      { data: { ids } }
    );
  }

  /**
   * 5. 验证手机号是否在白名单中（注册时检查）
   * GET /api/{factoryId}/whitelist/check?phoneNumber=X
   */
  async validatePhoneNumber(
    phoneNumber: string,
    factoryId?: string
  ): Promise<{
    isValid: boolean;
    whitelist?: WhitelistDTO;
    message?: string;
  }> {
    // apiClient拦截器已统一返回data
    return await apiClient.get<{
      isValid: boolean;
      whitelist?: WhitelistDTO;
      message?: string;
    }>(
      `${this.getFactoryPath(factoryId)}/whitelist/check`,
      { params: { phoneNumber } }
    );
  }

  // ===== 以下方法在MVP中暂不使用，已注释保留供后续版本使用 =====

  /*
   * MVP暂不使用的功能（15个方法）：
   *
   * 1. getWhitelistById - 获取详情（MVP不需要详情页）
   * 2. updateWhitelist - 更新白名单（MVP直接删除重建）
   * 3. searchWhitelist - 搜索（列表API的keyword参数已足够）
   * 4. getWhitelistStats - 统计信息（后期添加）
   * 5. getExpiringWhitelist - 即将过期（MVP暂不做过期管理）
   * 6. getMostActiveWhitelist - 最活跃用户（统计功能）
   * 7. getRecentlyUsedWhitelist - 最近使用（统计功能）
   * 8. incrementUsage - 增加使用次数（后端自动处理）
   * 9. extendExpiry - 延长有效期（MVP暂不需要）
   * 10. resetUsage - 重置使用次数（MVP暂不需要）
   * 11. updateExpiredStatus - 更新过期状态（后端定时任务处理）
   * 12. updateLimitReachedStatus - 更新达限状态（后端定时任务处理）
   * 13. cleanupDeleted - 清理已删除记录（后端定时任务处理）
   * 14. exportWhitelist - 导出白名单（MVP数据量小，不需要导出）
   * 15. importWhitelist - 导入白名单（批量添加API已足够）
   *
   * 如需使用这些功能，请查看Git历史或参考完整版API文档
   */
}

export const whitelistApiClient = new WhitelistApiClient();
export default whitelistApiClient;
