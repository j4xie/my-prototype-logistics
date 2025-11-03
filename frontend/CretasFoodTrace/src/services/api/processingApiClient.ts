import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

/**
 * 生产加工管理API客户端 - MVP精简版
 * MVP保留：12个核心API
 * 已移除：5个高级API（暂停生产、成本分析、时间线、质检统计）
 * 路径：/api/mobile/{factoryId}/processing/*
 *
 * 注意：Dashboard相关API（4个）已移至 dashboardApiClient.ts
 */

// ========== 类型定义 ==========

export interface ProcessingBatch {
  id: number;
  batchNumber: string;
  productType: string;
  status: string;
  targetQuantity: number;
  actualQuantity?: number;
  startTime?: string;
  endTime?: string;
  supervisor?: string;
  supervisorId?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface MaterialConsumptionRecord {
  materialId: string;
  quantity: number;
  batchNumbers?: string[];
  timestamp: string;
}

export interface QualityInspection {
  id: string;
  batchId: string;
  inspectorId: number;
  inspectorName: string;
  qualityGrade: string;
  passRate: number;
  defectRate: number;
  notes?: string;
  inspectionTime: string;
}

// ========== API客户端类 ==========

class ProcessingApiClient {
  private getPath(factoryId?: string) {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}/processing`;
  }

  // ===== 批次管理 (8个API) =====

  // 1. 获取批次列表
  async getBatches(params?: { factoryId?: string; status?: string; page?: number; size?: number }) {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(`${this.getPath(factoryId)}/batches`, { params: query });
  }

  // 2. 创建批次
  async createBatch(data: any, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/batches`, data);
  }

  // 3. 获取批次详情
  async getBatchById(batchId: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/batches/${batchId}`);
  }

  // 4. 开始生产
  async startProduction(batchId: string, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/batches/${batchId}/start`);
  }

  // 5. 完成生产
  async completeProduction(batchId: string, actualQuantity: number, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/batches/${batchId}/complete`, {
      actualQuantity
    });
  }

  // 6. 取消生产
  async cancelProduction(batchId: string, reason?: string, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/batches/${batchId}/cancel`, {
      reason
    });
  }

  // 7. 记录材料消耗
  async recordMaterialConsumption(batchId: string, consumption: any, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/batches/${batchId}/material-consumption`, consumption);
  }

  // ===== 仪表盘API已移除 =====
  // 注意：Dashboard相关API（4个）已在 dashboardApiClient.ts 中实现
  // 请使用：import { dashboardApiClient } from './dashboardApiClient'
  // - dashboardApiClient.getDashboardOverview()
  // - dashboardApiClient.getProductionStatistics()
  // - dashboardApiClient.getQualityDashboard()
  // - dashboardApiClient.getEquipmentDashboard()

  // ===== 原材料 (2个API) =====

  // 8. 获取原材料列表
  async getMaterials(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/materials`);
  }

  // 9. 记录原料接收
  async recordMaterialReceipt(data: any, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/material-receipt`, data);
  }

  // ===== 质检 (2个API) =====

  // 10. 获取质检记录
  async getQualityInspections(params?: { batchId?: string; factoryId?: string }) {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(`${this.getPath(factoryId)}/quality/inspections`, {
      params: query
    });
  }

  // 11. 创建质检记录
  async createQualityInspection(data: any, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/quality/inspections`, data);
  }

  // ===== MVP暂不使用的功能 =====
  /*
   * 以下功能在MVP阶段暂不实现，后续根据需要逐步添加：
   *
   * 1. pauseProduction - 暂停生产
   *    原因：MVP仅支持开始→完成/取消的简单流程，不支持暂停
   *    POST /api/mobile/{factoryId}/processing/batches/{batchId}/pause
   *
   * 2. getBatchCostAnalysis - 获取批次成本分析
   *    原因：成本分析功能属于后期优化，MVP阶段暂不需要
   *    GET /api/mobile/{factoryId}/processing/batches/{batchId}/cost-analysis
   *
   * 3. recalculateCost - 重新计算成本
   *    原因：成本优化功能属于后期需求，MVP阶段暂不需要
   *    POST /api/mobile/{factoryId}/processing/batches/{batchId}/recalculate-cost
   *
   * 4. getBatchTimeline - 获取批次时间线
   *    原因：展示优化功能，MVP阶段采用简单列表展示
   *    GET /api/mobile/{factoryId}/processing/batches/{batchId}/timeline
   *
   * 5. getQualityStatistics - 获取质检统计
   *    原因：统计分析功能，MVP阶段暂不需要
   *    GET /api/mobile/{factoryId}/processing/quality/statistics
   *
   * 6. getQualityTrends - 获取质检趋势
   *    原因：统计分析功能，MVP阶段暂不需要
   *    GET /api/mobile/{factoryId}/processing/quality/trends
   */
}

export const processingApiClient = new ProcessingApiClient();
export default processingApiClient;
