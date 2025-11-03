import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

/**
 * 原材料批次管理API客户端
 * 总计22个API - 路径：/api/mobile/{factoryId}/material-batches/*
 */

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
  updatedAt?: string;
}

class MaterialBatchApiClient {
  private getPath(factoryId?: string) {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}/material-batches`;
  }

  // 1. 获取原材料批次列表（分页）
  async getMaterialBatches(params?: { factoryId?: string; [key: string]: any }) {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(this.getPath(factoryId), { params: query });
  }

  // 2. 创建原材料批次
  async createBatch(data: any, factoryId?: string) {
    return await apiClient.post(this.getPath(factoryId), data);
  }

  // 3. 批量创建材料批次
  async batchCreate(batches: any[], factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/batch`, { batches });
  }

  // 4. 获取原材料批次详情
  async getBatchById(batchId: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/${batchId}`);
  }

  // 5. 更新原材料批次
  async updateBatch(batchId: string, data: any, factoryId?: string) {
    return await apiClient.put(`${this.getPath(factoryId)}/${batchId}`, data);
  }

  // 6. 删除原材料批次
  async deleteBatch(batchId: string, factoryId?: string) {
    return await apiClient.delete(`${this.getPath(factoryId)}/${batchId}`);
  }

  // 7. 预留批次材料（创建生产计划时）
  async reserveBatch(batchId: string, quantity: number, productionPlanId: number, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/${batchId}/reserve`, null, {
      params: { quantity, productionPlanId }
    });
  }

  // 8. 释放预留材料（取消生产计划时）
  async releaseBatch(batchId: string, quantity: number, productionPlanId: number, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/${batchId}/release`, null, {
      params: { quantity, productionPlanId }
    });
  }

  // 9. 消耗批次材料（生产完成时）- 新增
  async consumeBatch(batchId: string, quantity: number, productionPlanId: number, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/${batchId}/consume`, null, {
      params: { quantity, productionPlanId }
    });
  }

  // 10. 使用批次材料（旧接口，保留兼容）
  async useBatch(batchId: string, quantity: number, productionPlanId?: number, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/${batchId}/use`, null, {
      params: { quantity, productionPlanId }
    });
  }

  // 10. 调整批次数量
  async adjustBatch(batchId: string, adjustment: any, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/${batchId}/adjust`, adjustment);
  }

  // 11. 更新批次状态
  async updateBatchStatus(batchId: string, status: string, factoryId?: string) {
    return await apiClient.put(`${this.getPath(factoryId)}/${batchId}/status`, { status });
  }

  // 12. 按材料类型获取批次
  async getBatchesByMaterialType(materialTypeId: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/material-type/${materialTypeId}`);
  }

  // 13. 按状态获取批次
  async getBatchesByStatus(status: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/status/${status}`);
  }

  // 14. 获取FIFO批次（先进先出）
  async getFifoBatches(materialTypeId: string, quantity: number, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/fifo/${materialTypeId}`, {
      params: { quantity }
    });
  }

  // 15. 获取即将过期的批次
  async getExpiringBatches(days?: number, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/expiring`, { params: { days } });
  }

  // 16. 获取已过期的批次
  async getExpiredBatches(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/expired`);
  }

  // 17. 处理过期批次
  async handleExpiredBatches(factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/handle-expired`);
  }

  // 18. 获取批次使用历史
  async getBatchUsageHistory(batchId: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/${batchId}/usage-history`);
  }

  // 19. 获取低库存警告
  async getLowStockBatches(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/low-stock`);
  }

  // 20. 获取库存统计
  async getInventoryStatistics(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/inventory/statistics`);
  }

  // 21. 获取库存价值
  async getInventoryValuation(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/inventory/valuation`);
  }

  // 22. 导出库存报表
  async exportInventory(params?: { factoryId?: string; [key: string]: any }) {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(`${this.getPath(factoryId)}/export`, {
      params: query,
      responseType: 'blob'
    });
  }
}

export const materialBatchApiClient = new MaterialBatchApiClient();
