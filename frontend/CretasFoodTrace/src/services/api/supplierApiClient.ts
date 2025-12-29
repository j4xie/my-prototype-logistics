import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 供应商管理API客户端 - MVP精简版
 * MVP保留：8个核心API
 * 已移除：10个高级API（统计、财务、导入导出功能）
 * 路径：/api/mobile/{factoryId}/suppliers/*
 */

// ========== 类型定义 ==========

export interface Supplier {
  id: string;
  factoryId: string;
  supplierCode: string;
  code: string; // 别名，指向supplierCode
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  businessType?: string;
  creditLevel?: string;
  creditLimit?: number;
  currentBalance?: number;
  deliveryArea?: string;
  paymentTerms?: string;
  rating?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  _count?: {
    materialBatches: number;
  };
}

export interface SupplierStats {
  totalBatches: number;
  activeBatches: number;
  totalPurchaseValue: number;
  averageDeliveryDays?: number;
  qualityScore?: number;
  recentBatches: any[];
}

export interface CreateSupplierRequest {
  supplierCode: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  businessType?: string;
  creditLevel?: string;
  creditLimit?: number;
  deliveryArea?: string;
  paymentTerms?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

// ========== API客户端类 ==========

class SupplierApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/suppliers`;
  }

  /**
   * 1. 获取供应商列表（分页）
   * GET /api/mobile/{factoryId}/suppliers
   */
  async getSuppliers(params?: {
    factoryId?: string;
    page?: number;
    size?: number;
    sortBy?: string;
    sortDirection?: 'ASC' | 'DESC';
    keyword?: string;
    isActive?: boolean;
  }): Promise<{data: Supplier[]}> {
    const { factoryId, ...queryParams } = params || {};
    // apiClient拦截器已统一返回data
    const apiResponse = await apiClient.get<any>(
      `${this.getPath(factoryId)}`,
      { params: queryParams }
    );
    
    // 处理分页响应：apiResponse.data.content
    if (apiResponse.data?.content) {
      return { data: apiResponse.data.content };
    }
    
    // 兼容直接返回数组的情况
    if (Array.isArray(apiResponse.data)) {
      return { data: apiResponse.data };
    }
    
    // 防御性编程：兼容旧格式
    if (Array.isArray(apiResponse)) {
      return { data: apiResponse };
    }
    
    console.warn('[SupplierAPI] 未预期的响应格式:', apiResponse);
    return { data: [] };
  }

  /**
   * 2. 创建供应商
   * POST /api/mobile/{factoryId}/suppliers
   */
  async createSupplier(
    request: CreateSupplierRequest,
    factoryId?: string
  ): Promise<{data: Supplier}> {
    // apiClient拦截器已统一返回data
    const apiData = await apiClient.post<Supplier>(
      `${this.getPath(factoryId)}`,
      request
    );
    // 兼容旧格式：包装成 {data: {...}}
    return { data: apiData };
  }

  /**
   * 3. 获取供应商详情
   * GET /api/mobile/{factoryId}/suppliers/{supplierId}
   */
  async getSupplierById(supplierId: string, factoryId?: string): Promise<Supplier> {
    // apiClient拦截器已统一返回data
    return await apiClient.get<Supplier>(
      `${this.getPath(factoryId)}/${supplierId}`
    );
  }

  /**
   * 4. 更新供应商
   * PUT /api/mobile/{factoryId}/suppliers/{supplierId}
   */
  async updateSupplier(
    supplierId: string,
    request: Partial<CreateSupplierRequest>,
    factoryId?: string
  ): Promise<Supplier> {
    // apiClient拦截器已统一返回data
    return await apiClient.put<Supplier>(
      `${this.getPath(factoryId)}/${supplierId}`,
      request
    );
  }

  /**
   * 5. 删除供应商
   * DELETE /api/mobile/{factoryId}/suppliers/{supplierId}
   */
  async deleteSupplier(supplierId: string, factoryId?: string): Promise<void> {
    await apiClient.delete(`${this.getPath(factoryId)}/${supplierId}`);
  }

  /**
   * 6. 获取活跃供应商列表
   * GET /api/mobile/{factoryId}/suppliers/active
   */
  async getActiveSuppliers(factoryId?: string): Promise<Supplier[]> {
    // apiClient拦截器已统一返回data
    return await apiClient.get<Supplier[]>(
      `${this.getPath(factoryId)}/active`
    );
  }

  /**
   * 7. 搜索供应商
   * GET /api/mobile/{factoryId}/suppliers/search
   */
  async searchSuppliers(params: {
    keyword: string;
    factoryId?: string;
    businessType?: string;
    creditLevel?: string;
    isActive?: boolean;
  }): Promise<Supplier[]> {
    const { factoryId, ...queryParams } = params;
    // apiClient拦截器已统一返回data
    return await apiClient.get<Supplier[]>(
      `${this.getPath(factoryId)}/search`,
      { params: queryParams }
    );
  }

  /**
   * 8. 切换供应商状态
   * PUT /api/mobile/{factoryId}/suppliers/{supplierId}/status
   */
  async toggleSupplierStatus(
    supplierId: string,
    isActive: boolean,
    factoryId?: string
  ): Promise<Supplier> {
    // apiClient拦截器已统一返回data
    return await apiClient.put<Supplier>(
      `${this.getPath(factoryId)}/${supplierId}/status`,
      {},
      { params: { isActive: isActive } }
    );
  }

  // ===== 新增功能 (Phase 3) =====

  /**
   * 9. 按材料类型筛选供应商
   * GET /api/mobile/{factoryId}/suppliers/by-material
   */
  async getSuppliersByMaterial(params: {
    materialType: string;
    factoryId?: string;
  }): Promise<Supplier[]> {
    const { factoryId, materialType } = params;
    return await apiClient.get<Supplier[]>(
      `${this.getPath(factoryId)}/by-material`,
      { params: { materialType } }
    );
  }

  /**
   * 10. 更新供应商评级
   * PUT /api/mobile/{factoryId}/suppliers/{supplierId}/rating
   */
  async updateSupplierRating(params: {
    supplierId: string;
    rating: number;
    notes?: string;
    factoryId?: string;
  }): Promise<Supplier> {
    const { factoryId, supplierId, ...body } = params;
    return await apiClient.put<Supplier>(
      `${this.getPath(factoryId)}/${supplierId}/rating`,
      body
    );
  }

  /**
   * 11. 获取供应商统计信息
   * GET /api/mobile/{factoryId}/suppliers/{supplierId}/statistics
   */
  async getSupplierStatistics(
    supplierId: string,
    factoryId?: string
  ): Promise<SupplierStats> {
    return await apiClient.get<SupplierStats>(
      `${this.getPath(factoryId)}/${supplierId}/statistics`
    );
  }

  /**
   * 12. 获取供应商供货历史
   * GET /api/mobile/{factoryId}/suppliers/{supplierId}/history
   */
  async getSupplierHistory(
    supplierId: string,
    factoryId?: string
  ): Promise<{
    batches: any[];
    totalBatches: number;
    totalValue: number;
    averageDeliveryDays: number;
  }> {
    return await apiClient.get<{
      batches: any[];
      totalBatches: number;
      totalValue: number;
      averageDeliveryDays: number;
    }>(
      `${this.getPath(factoryId)}/${supplierId}/history`
    );
  }

  // ===== 保留供后续版本的功能 =====
  /*
   * 以下功能暂不实现，详见 .claude/rules/unused-api-endpoints.md:
   *
   * - checkSupplierCodeExists - 检查供应商代码是否存在
   * - updateCreditLimit - 更新供应商信用额度
   * - getSuppliersWithOutstandingBalance - 获取有欠款的供应商
   * - getRatingDistribution - 获取供应商评级分布
   * - exportSuppliers - 导出供应商列表
   * - importSuppliers - 批量导入供应商
   */
}

export const supplierApiClient = new SupplierApiClient();
