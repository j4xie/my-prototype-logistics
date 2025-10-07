import { apiClient } from './apiClient';

export interface Supplier {
  id: string;
  factoryId: string;
  name: string;
  code: string;
  contactPerson?: string;
  contactPhone?: string;
  address?: string;
  businessType?: string;
  creditLevel?: string;
  deliveryArea?: string;
  paymentTerms?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    materialBatches: number;
  };
}

export interface SupplierStats {
  totalBatches: number;
  activeBatches: number;
  totalPurchaseValue: number;
  recentBatches: any[];
}

export interface SupplierListResponse {
  success: boolean;
  message?: string;
  data: Supplier[];
}

export interface SupplierDetailResponse {
  success: boolean;
  message?: string;
  data: Supplier;
}

export interface SupplierStatsResponse {
  success: boolean;
  message?: string;
  data: {
    supplier: Supplier;
    stats: SupplierStats;
  };
}

class SupplierApiClient {
  private baseUrl = '/api/mobile/suppliers';

  /**
   * 获取供应商列表
   */
  async getSuppliers(params?: {
    isActive?: boolean;
  }): Promise<SupplierListResponse> {
    return apiClient.get(this.baseUrl, { params });
  }

  /**
   * 获取供应商详情
   */
  async getSupplierById(id: string): Promise<SupplierDetailResponse> {
    return apiClient.get(`${this.baseUrl}/${id}`);
  }

  /**
   * 获取供应商统计信息
   */
  async getSupplierStats(id: string): Promise<SupplierStatsResponse> {
    return apiClient.get(`${this.baseUrl}/${id}/stats`);
  }

  /**
   * 创建供应商
   */
  async createSupplier(data: {
    name: string;
    contactPerson?: string;
    contactPhone?: string;
    address?: string;
    businessType?: string;
    creditLevel?: string;
    deliveryArea?: string;
    paymentTerms?: string;
  }): Promise<SupplierDetailResponse> {
    return apiClient.post(this.baseUrl, data);
  }

  /**
   * 更新供应商
   */
  async updateSupplier(
    id: string,
    data: {
      name?: string;
      contactPerson?: string;
      contactPhone?: string;
      address?: string;
      businessType?: string;
      creditLevel?: string;
      deliveryArea?: string;
      paymentTerms?: string;
      isActive?: boolean;
    }
  ): Promise<SupplierDetailResponse> {
    return apiClient.put(`${this.baseUrl}/${id}`, data);
  }

  /**
   * 删除供应商（软删除）
   */
  async deleteSupplier(id: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete(`${this.baseUrl}/${id}`);
  }
}

export const supplierApiClient = new SupplierApiClient();
