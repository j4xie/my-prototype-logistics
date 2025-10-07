import { apiClient } from './apiClient';

export interface MaterialBatch {
  id: string;
  batchNumber: string;
  factoryId: string;
  materialTypeId: string;
  inboundQuantity: number;
  remainingQuantity: number;
  reservedQuantity: number;
  usedQuantity: number;
  unitPrice: number;
  totalCost: number;
  supplierId: string;
  inboundDate: string;
  expiryDate?: string;
  productionDate?: string;
  status: 'available' | 'reserved' | 'depleted' | 'expired';
  qualityGrade?: string;
  storageLocation?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  materialType?: {
    id: string;
    name: string;
    category?: string;
    unit: string;
  };
  supplier?: {
    id: string;
    name: string;
    code: string;
    contactPerson?: string;
    contactPhone?: string;
  };
}

export interface BatchRecommendation {
  fifo: {
    batches: {
      batchId: string;
      batchNumber: string;
      quantity: number;
      unitPrice: number;
      totalCost: number;
      supplierName: string;
      inboundDate: string;
      expiryDate?: string;
    }[];
    totalCost: number;
    description: string;
    advantage: string;
  };
  costOptimal: {
    batches: {
      batchId: string;
      batchNumber: string;
      quantity: number;
      unitPrice: number;
      totalCost: number;
      supplierName: string;
      inboundDate: string;
      expiryDate?: string;
    }[];
    totalCost: number;
    description: string;
    advantage: string;
    warning?: string;
  };
}

class MaterialBatchApiClient {
  private baseUrl = '/api/mobile/material-batches';

  /**
   * 创建原材料批次（入库）
   */
  async createBatch(data: {
    materialTypeId: string;
    supplierId: string;
    quantity: number;
    unitPrice: number;
    inboundDate?: string;
    expiryDate?: string;
    expiryDays?: number;
    productionDate?: string;
    qualityGrade?: string;
    storageLocation?: string;
    notes?: string;
  }): Promise<{ success: boolean; data: MaterialBatch; message: string }> {
    return apiClient.post(this.baseUrl, data);
  }

  /**
   * 获取批次列表
   */
  async getBatches(params?: {
    page?: number;
    limit?: number;
    materialTypeId?: string;
    supplierId?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    success: boolean;
    data: {
      batches: MaterialBatch[];
      pagination: {
        current: number;
        total: number;
        count: number;
        limit: number;
      };
    };
    message: string;
  }> {
    return apiClient.get(this.baseUrl, { params });
  }

  /**
   * 获取可用批次（供选择器使用）
   */
  async getAvailableBatches(params: {
    materialTypeId: string;
    requiredQuantity?: number;
  }): Promise<{
    success: boolean;
    data: {
      batches: MaterialBatch[];
      recommendations: BatchRecommendation;
      summary: {
        totalBatches: number;
        totalAvailable: number;
        requiredQuantity: number;
      };
    };
    message: string;
  }> {
    return apiClient.get(`${this.baseUrl}/available`, { params });
  }

  /**
   * 预留批次
   */
  async reserveBatches(batchUsages: {
    batchId: string;
    quantity: number;
  }[]): Promise<{ success: boolean; data: any; message: string }> {
    return apiClient.post(`${this.baseUrl}/reserve`, { batchUsages });
  }

  /**
   * 释放批次
   */
  async releaseBatches(batchUsages: {
    batchId: string;
    quantity: number;
  }[]): Promise<{ success: boolean; data: any; message: string }> {
    return apiClient.post(`${this.baseUrl}/release`, { batchUsages });
  }

  /**
   * 消耗批次
   */
  async consumeBatches(batchUsages: {
    batchId: string;
    quantity: number;
  }[]): Promise<{ success: boolean; data: any; message: string }> {
    return apiClient.post(`${this.baseUrl}/consume`, { batchUsages });
  }

  /**
   * 获取批次详情
   */
  async getBatchById(id: string): Promise<{
    success: boolean;
    data: MaterialBatch;
    message: string;
  }> {
    return apiClient.get(`${this.baseUrl}/${id}`);
  }

  /**
   * 获取即将过期的批次
   */
  async getExpiringBatches(days: number = 3): Promise<{
    success: boolean;
    data: {
      batches: MaterialBatch[];
      count: number;
      days: number;
    };
    message: string;
  }> {
    return apiClient.get(`${this.baseUrl}/expiring`, { params: { days } });
  }

  /**
   * 获取库存汇总
   */
  async getBatchesSummary(): Promise<{
    success: boolean;
    data: {
      summary: any[];
      count: number;
    };
    message: string;
  }> {
    return apiClient.get(`${this.baseUrl}/summary`);
  }
}

export const materialBatchApiClient = new MaterialBatchApiClient();
