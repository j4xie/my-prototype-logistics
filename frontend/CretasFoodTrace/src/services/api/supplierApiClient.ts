import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

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
  contactPhone?: string;
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
  contactPhone?: string;
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
  private getFactoryPath(factoryId?: string) {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}`;
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
      `${this.getFactoryPath(factoryId)}/suppliers`,
      { params: queryParams }
    );
    // 兼容旧格式：包装成 {data: [...]}
    if (apiResponse.content) {
      return { data: apiResponse.content };
    }
    return { data: apiResponse };
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
      `${this.getFactoryPath(factoryId)}/suppliers`,
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
      `${this.getFactoryPath(factoryId)}/suppliers/${supplierId}`
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
      `${this.getFactoryPath(factoryId)}/suppliers/${supplierId}`,
      request
    );
  }

  /**
   * 5. 删除供应商
   * DELETE /api/mobile/{factoryId}/suppliers/{supplierId}
   */
  async deleteSupplier(supplierId: string, factoryId?: string): Promise<void> {
    await apiClient.delete(`${this.getFactoryPath(factoryId)}/suppliers/${supplierId}`);
  }

  /**
   * 6. 获取活跃供应商列表
   * GET /api/mobile/{factoryId}/suppliers/active
   */
  async getActiveSuppliers(factoryId?: string): Promise<Supplier[]> {
    // apiClient拦截器已统一返回data
    return await apiClient.get<Supplier[]>(
      `${this.getFactoryPath(factoryId)}/suppliers/active`
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
      `${this.getFactoryPath(factoryId)}/suppliers/search`,
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
      `${this.getFactoryPath(factoryId)}/suppliers/${supplierId}/status`,
      { isActive }
    );
  }

  // ===== MVP暂不使用的功能 =====
  /*
   * 以下功能在MVP阶段暂不实现，后续根据需要逐步添加：
   *
   * 1. getSuppliersByMaterial - 按材料类型筛选供应商
   *    原因：可在前端使用getSuppliers获取全部数据后筛选
   *    GET /api/mobile/{factoryId}/suppliers/by-material
   *
   * 2. checkSupplierCodeExists - 检查供应商代码是否存在
   *    原因：可在前端表单验证时处理，或在创建时由后端返回错误
   *    GET /api/mobile/{factoryId}/suppliers/check-code
   *
   * 3. getSupplierHistory - 获取供应商供货历史
   *    原因：统计分析功能，MVP阶段暂不需要
   *    GET /api/mobile/{factoryId}/suppliers/{supplierId}/history
   *
   * 4. updateCreditLimit - 更新供应商信用额度
   *    原因：财务管理功能，MVP阶段不涉及
   *    PUT /api/mobile/{factoryId}/suppliers/{supplierId}/credit-limit
   *
   * 5. updateSupplierRating - 更新供应商评级
   *    原因：评级系统功能，MVP阶段不需要
   *    PUT /api/mobile/{factoryId}/suppliers/{supplierId}/rating
   *
   * 6. getSuppliersWithOutstandingBalance - 获取有欠款的供应商
   *    原因：财务对账功能，MVP阶段不涉及
   *    GET /api/mobile/{factoryId}/suppliers/outstanding-balance
   *
   * 7. getRatingDistribution - 获取供应商评级分布
   *    原因：统计分析功能，MVP阶段暂不需要
   *    GET /api/mobile/{factoryId}/suppliers/rating-distribution
   *
   * 8. exportSuppliers - 导出供应商列表
   *    原因：导出功能属于高级特性，MVP阶段暂不实现
   *    GET /api/mobile/{factoryId}/suppliers/export
   *
   * 9. importSuppliers - 批量导入供应商
   *    原因：批量导入功能属于高级特性，MVP阶段暂不实现
   *    POST /api/mobile/{factoryId}/suppliers/import
   *
   * 10. getSupplierStatistics - 获取供应商统计信息
   *    原因：统计分析功能，MVP阶段暂不需要
   *    GET /api/mobile/{factoryId}/suppliers/{supplierId}/statistics
   */
}

export const supplierApiClient = new SupplierApiClient();
