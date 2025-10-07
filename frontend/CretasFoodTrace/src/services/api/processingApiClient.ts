/**
 * Processing API Client
 * 生产模块API调用
 */

import { apiClient } from './apiClient';

export interface CreateBatchRequest {
  productType: string;
  targetQuantity: number;
  rawMaterials: Array<{
    materialType: string;
    quantity: number;
    unit?: string;
    cost?: number;
  }>;
  supervisorId?: number;
  supervisorName?: string;
  productionLineId?: string;
  notes?: string;
}

export interface BatchResponse {
  id: number;
  batchNumber: string;
  productType: string;
  status: string;
  targetQuantity: number;
  actualQuantity?: number;
  rawMaterials: any[];
  supervisor?: string;
  supervisorId?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface BatchListResponse {
  success: boolean;
  data: BatchResponse[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Processing API Client
 */
export const processingAPI = {
  /**
   * 获取批次列表
   */
  getBatches: async (params?: {
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<BatchListResponse> => {
    const response = await apiClient.get('/api/mobile/processing/batches', { params });
    return response.data;
  },

  /**
   * 获取批次详情
   */
  getBatchDetail: async (batchId: string | number): Promise<BatchResponse> => {
    const response = await apiClient.get(`/api/mobile/processing/batches/${batchId}`);
    return response.data;
  },

  /**
   * 创建批次
   */
  createBatch: async (data: CreateBatchRequest): Promise<BatchResponse> => {
    const response = await apiClient.post('/api/mobile/processing/batches', data);
    return response.data;
  },

  /**
   * 更新批次
   */
  updateBatch: async (batchId: string | number, data: Partial<CreateBatchRequest>): Promise<BatchResponse> => {
    const response = await apiClient.put(`/api/mobile/processing/batches/${batchId}`, data);
    return response.data;
  },

  /**
   * 删除批次
   */
  deleteBatch: async (batchId: string | number): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete(`/api/mobile/processing/batches/${batchId}`);
    return response.data;
  },

  /**
   * 更新批次状态
   */
  updateBatchStatus: async (batchId: string | number, status: string): Promise<BatchResponse> => {
    const response = await apiClient.patch(`/api/mobile/processing/batches/${batchId}/status`, { status });
    return response.data;
  },

  /**
   * 获取批次成本分析
   */
  getBatchCostAnalysis: async (batchId: string | number): Promise<{
    success: boolean;
    data: any;  // BatchCostAnalysis类型
    message?: string;
  }> => {
    const response = await apiClient.get(`/api/mobile/processing/batches/${batchId}/cost-analysis`);
    return response.data;
  },

  /**
   * AI成本分析（按需调用）
   */
  aiCostAnalysis: async (params: {
    batchId: string;
    question?: string;
    session_id?: string;
  }): Promise<{
    success: boolean;
    data: {
      analysis: string;
      session_id: string;
      message_count: number;
      quota?: {
        used: number;
        limit: number;
        remaining: number;
        period: string;
        resetDate: string;
      };
    };
    message?: string;
  }> => {
    const response = await apiClient.post('/api/mobile/processing/ai-cost-analysis', params);
    return response.data;
  },
};

// 别名导出，兼容旧代码
export const processingApiClient = processingAPI;

export default processingAPI;
