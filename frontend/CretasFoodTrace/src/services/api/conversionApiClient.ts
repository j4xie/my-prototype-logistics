import { apiClient } from './apiClient';

// ==================== 类型定义 ====================

export interface ConversionRate {
  id: string;
  factoryId: string;
  materialTypeId: string;
  productTypeId: string;
  conversionRate: number;
  wastageRate?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  materialType: {
    id: string;
    name: string;
    category?: string;
    unit: string;
  };
  productType: {
    id: string;
    name: string;
    code: string;
  };
}

export interface EstimateUsageRequest {
  productTypeId: string;
  plannedQuantity: number;
  materialTypeId?: string;
}

export interface EstimateUsageResponse {
  success: boolean;
  message?: string;
  data: {
    productType: {
      id: string;
      name: string;
    };
    materialType: {
      id: string;
      name: string;
      unit: string;
    };
    plannedQuantity: number;
    conversionRate: number;
    wastageRate: number;
    baseRequirement: number;
    estimatedUsage: number;
  };
}

// ==================== API Client ====================

class ConversionApiClient {
  private baseUrl = '/api/mobile/conversions';

  /**
   * 获取转换率列表
   */
  async getConversionRates(params?: {
    materialTypeId?: string;
    productTypeId?: string;
  }): Promise<{
    success: boolean;
    data: ConversionRate[];
  }> {
    return apiClient.get(this.baseUrl, { params });
  }

  /**
   * 获取转换率矩阵
   */
  async getConversionMatrix(): Promise<{
    success: boolean;
    data: {
      materials: any[];
      products: any[];
      matrix: any[];
    };
  }> {
    return apiClient.get(`${this.baseUrl}/matrix`);
  }

  /**
   * 创建或更新转换率
   */
  async upsertConversionRate(data: {
    materialTypeId: string;
    productTypeId: string;
    conversionRate: number;
    wastageRate?: number;
    notes?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: ConversionRate;
  }> {
    return apiClient.post(this.baseUrl, data);
  }

  /**
   * 删除转换率
   */
  async deleteConversionRate(id: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return apiClient.delete(`${this.baseUrl}/${id}`);
  }

  /**
   * 预估原料用量
   * 根据产品类型和计划产量，计算需要的原料数量
   */
  async estimateMaterialUsage(data: EstimateUsageRequest): Promise<EstimateUsageResponse> {
    return apiClient.post(`${this.baseUrl}/estimate`, data);
  }
}

export const conversionApiClient = new ConversionApiClient();
