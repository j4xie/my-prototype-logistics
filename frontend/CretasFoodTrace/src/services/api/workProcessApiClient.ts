/**
 * 工序管理 API 客户端
 *
 * 对接后端:
 * - WorkProcessController (/api/mobile/{factoryId}/work-processes)
 * - ProductWorkProcessController (/api/mobile/{factoryId}/product-work-processes)
 *
 * Track D2 — M-WP-1 / M-WP-2
 */

import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';
import type {
  CreateProductWorkProcessRequest,
  CreateWorkProcessRequest,
  ProductWorkProcess,
  ProductWorkProcessBatchSortRequest,
  UpdateProductWorkProcessRequest,
  UpdateWorkProcessRequest,
  WorkProcess,
  WorkProcessSortOrderUpdate,
} from '../../types/workProcess';

/**
 * 后端统一响应格式 (apiClient 拦截器已 unwrap response.data, 这里的 ApiResponse 是再下一层)
 */
interface ApiResponse<T> {
  success: boolean;
  code?: number;
  message?: string;
  data: T;
}

interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

class WorkProcessApiClient {
  private workProcessPath(factoryId?: string): string {
    const fid = getCurrentFactoryId(factoryId);
    if (!fid) {
      throw new Error('factoryId 必填, 请先登录或显式传入');
    }
    return `/api/mobile/${fid}/work-processes`;
  }

  private productWorkProcessPath(factoryId?: string): string {
    const fid = getCurrentFactoryId(factoryId);
    if (!fid) {
      throw new Error('factoryId 必填, 请先登录或显式传入');
    }
    return `/api/mobile/${fid}/product-work-processes`;
  }

  // ==================== WorkProcess ====================

  /**
   * 工序列表 (分页)
   */
  async listWorkProcesses(
    params?: {
      factoryId?: string;
      page?: number;
      size?: number;
      sortBy?: string;
      sortDirection?: 'ASC' | 'DESC';
    },
  ): Promise<WorkProcess[]> {
    const { factoryId, ...query } = params || {};
    const response = await apiClient.get<ApiResponse<PageResponse<WorkProcess>>>(
      this.workProcessPath(factoryId),
      { params: query },
    );

    // 后端 PageResponse 形态: { content: [...], totalElements, totalPages, size, number }
    if (response.data?.content) {
      return response.data.content;
    }

    // 防御: 兼容直接返回数组的情况
    if (Array.isArray(response.data)) {
      return response.data as WorkProcess[];
    }

    return [];
  }

  /**
   * 获取所有启用的工序 (无分页, sortOrder 升序)
   *
   * 用于 ProductWorkProcessConfigScreen 选择工序时的下拉
   */
  async listActiveWorkProcesses(factoryId?: string): Promise<WorkProcess[]> {
    const response = await apiClient.get<ApiResponse<WorkProcess[]>>(
      `${this.workProcessPath(factoryId)}/active`,
    );
    return response.data || [];
  }

  /**
   * 工序详情
   */
  async getWorkProcess(id: string, factoryId?: string): Promise<WorkProcess> {
    const response = await apiClient.get<ApiResponse<WorkProcess>>(
      `${this.workProcessPath(factoryId)}/${id}`,
    );
    return response.data;
  }

  /**
   * 创建工序
   */
  async createWorkProcess(
    data: CreateWorkProcessRequest,
    factoryId?: string,
  ): Promise<WorkProcess> {
    const response = await apiClient.post<ApiResponse<WorkProcess>>(
      this.workProcessPath(factoryId),
      data,
    );
    return response.data;
  }

  /**
   * 更新工序
   */
  async updateWorkProcess(
    id: string,
    data: UpdateWorkProcessRequest,
    factoryId?: string,
  ): Promise<WorkProcess> {
    const response = await apiClient.put<ApiResponse<WorkProcess>>(
      `${this.workProcessPath(factoryId)}/${id}`,
      data,
    );
    return response.data;
  }

  /**
   * 删除工序 (软删 — 后端 @Where(deleted_at IS NULL))
   */
  async deleteWorkProcess(id: string, factoryId?: string): Promise<void> {
    await apiClient.delete(`${this.workProcessPath(factoryId)}/${id}`);
  }

  /**
   * 切换工序启用/禁用状态
   */
  async toggleWorkProcessStatus(id: string, factoryId?: string): Promise<WorkProcess> {
    const response = await apiClient.put<ApiResponse<WorkProcess>>(
      `${this.workProcessPath(factoryId)}/${id}/toggle-status`,
      {},
    );
    return response.data;
  }

  /**
   * 批量更新工序排序
   */
  async updateWorkProcessSortOrder(
    updates: WorkProcessSortOrderUpdate[],
    factoryId?: string,
  ): Promise<void> {
    await apiClient.put(`${this.workProcessPath(factoryId)}/sort-order`, updates);
  }

  // ==================== ProductWorkProcess ====================

  /**
   * 查询产品已绑定的工序列表 (按 processOrder 升序)
   *
   * 用于 ProductWorkProcessConfigScreen + Day 6 bug 修复 (生产计划工序下拉)
   */
  async listProductWorkProcesses(
    productTypeId: string,
    factoryId?: string,
  ): Promise<ProductWorkProcess[]> {
    if (!productTypeId) {
      throw new Error('productTypeId 必填');
    }
    const response = await apiClient.get<ApiResponse<ProductWorkProcess[]>>(
      this.productWorkProcessPath(factoryId),
      { params: { productTypeId } },
    );
    return response.data || [];
  }

  /**
   * 绑定产品 × 工序
   */
  async createProductWorkProcess(
    data: CreateProductWorkProcessRequest,
    factoryId?: string,
  ): Promise<ProductWorkProcess> {
    const response = await apiClient.post<ApiResponse<ProductWorkProcess>>(
      this.productWorkProcessPath(factoryId),
      data,
    );
    return response.data;
  }

  /**
   * 更新产品 × 工序绑定 (调整 processOrder / unitOverride / 等)
   */
  async updateProductWorkProcess(
    id: number,
    data: UpdateProductWorkProcessRequest,
    factoryId?: string,
  ): Promise<ProductWorkProcess> {
    const response = await apiClient.put<ApiResponse<ProductWorkProcess>>(
      `${this.productWorkProcessPath(factoryId)}/${id}`,
      data,
    );
    return response.data;
  }

  /**
   * 删除产品 × 工序绑定 (物理删, 后端 entity 不带软删字段)
   */
  async deleteProductWorkProcess(id: number, factoryId?: string): Promise<void> {
    await apiClient.delete(`${this.productWorkProcessPath(factoryId)}/${id}`);
  }

  /**
   * 批量调整产品 × 工序绑定排序
   */
  async batchSortProductWorkProcesses(
    request: ProductWorkProcessBatchSortRequest,
    factoryId?: string,
  ): Promise<void> {
    await apiClient.put(`${this.productWorkProcessPath(factoryId)}/batch-sort`, request);
  }
}

export const workProcessApiClient = new WorkProcessApiClient();
