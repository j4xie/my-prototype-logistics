import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 原材料消耗记录API客户端
 * 路径：/api/mobile/{factoryId}/processing/material-consumptions/*
 *
 * 后端控制器：MaterialConsumptionController.java
 *
 * 已实现端点（7个）：
 * 1. GET  /processing/material-consumptions         - 列表（分页）
 * 2. GET  /processing/material-consumptions/{id}    - 详情
 * 3. GET  /processing/material-consumptions/batch/{productionBatchId} - 按生产批次查询
 * 4. GET  /processing/material-consumptions/material-batch/{batchId}  - 按原材料批次查询
 * 5. GET  /processing/material-consumptions/time-range - 按时间范围查询
 * 6. GET  /processing/material-consumptions/stats   - 消耗统计
 * 7. GET  /processing/material-consumptions/batch/{productionBatchId}/cost - 批次成本汇总
 *
 * 创建消耗记录请使用：processingApiClient.recordMaterialConsumption()
 */

export interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T;
}

export interface MaterialConsumption {
  id: number;
  factoryId: string;
  productionPlanId?: string;
  productionBatchId?: string;
  batchId: string;
  batchNumber?: string;
  materialTypeName?: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  consumptionTime: string;
  consumedAt?: string;
  recordedBy: number;
  recorderName?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ConsumptionQueryParams {
  factoryId?: string;
  productionBatchId?: string;
  batchId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
}

export interface ConsumptionStats {
  totalQuantity: number;
  totalCost: number;
  consumptionCount: number;
  byMaterialType?: Array<{
    materialTypeName: string;
    quantity: number;
    cost: number;
  }>;
}

class MaterialConsumptionApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/processing/material-consumptions`;
  }

  // 1. 获取消耗记录列表（分页）
  async getConsumptions(params?: ConsumptionQueryParams): Promise<ApiResponse<MaterialConsumption[]>> {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(this.getPath(factoryId), { params: query });
  }

  // 2. 获取单条消耗记录详情
  async getConsumptionById(id: number, factoryId?: string): Promise<ApiResponse<MaterialConsumption>> {
    return await apiClient.get(`${this.getPath(factoryId)}/${id}`);
  }

  // 3. 获取生产批次的消耗记录
  async getConsumptionsByBatch(productionBatchId: string, factoryId?: string): Promise<ApiResponse<MaterialConsumption[]>> {
    return await apiClient.get(`${this.getPath(factoryId)}/batch/${productionBatchId}`);
  }

  // 4. 获取原材料批次的消耗记录
  async getConsumptionsByMaterialBatch(batchId: string, factoryId?: string): Promise<ApiResponse<MaterialConsumption[]>> {
    return await apiClient.get(`${this.getPath(factoryId)}/material-batch/${batchId}`);
  }

  // 5. 获取时间范围内的消耗记录
  async getConsumptionsByTimeRange(startDate: string, endDate: string, factoryId?: string): Promise<ApiResponse<MaterialConsumption[]>> {
    return await apiClient.get(`${this.getPath(factoryId)}/time-range`, {
      params: { startDate, endDate }
    });
  }

  // 6. 获取消耗统计
  async getConsumptionStats(params?: { productionBatchId?: string; startDate?: string; endDate?: string; factoryId?: string }): Promise<ApiResponse<ConsumptionStats>> {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(`${this.getPath(factoryId)}/stats`, { params: query });
  }

  // 7. 获取生产批次的消耗成本汇总
  async getBatchConsumptionCost(productionBatchId: string, factoryId?: string): Promise<ApiResponse<{ totalCost: number; totalQuantity: number }>> {
    return await apiClient.get(`${this.getPath(factoryId)}/batch/${productionBatchId}/cost`);
  }
}

export const materialConsumptionApiClient = new MaterialConsumptionApiClient();
