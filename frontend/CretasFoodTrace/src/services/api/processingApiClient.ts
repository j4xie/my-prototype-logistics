import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

/**
 * 生产加工管理API客户端
 * 核心API：20个（批次管理7个 + 原材料2个 + 质检9个 + AI分析2个）
 * 路径：/api/mobile/{factoryId}/processing/*
 *
 * 注意：Dashboard相关API（4个）已移至 dashboardApiClient.ts
 * Phase 3 P1-002: 新增质检完整流程API（9个）
 */

// ========== 类型定义 ==========

/**
 * 后端统一响应格式
 */
export interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T;
}

/**
 * 分页响应格式
 */
export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

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

export interface BatchCostData {
  batchId: string;
  batchNumber: string;
  productType: string;
  totalCost: number;
  laborCost: number;
  materialCost: number;
  equipmentCost: number;
  otherCost: number;
  quantity: number;
  unitCost: number;
  date: string;
}

export interface MaterialType {
  id: string;
  name: string;
  unit?: string;
  category?: string;
}

export interface TimeRangeCostAnalysis {
  period: {
    startDate: string;
    endDate: string;
  };
  totalCost: number;
  laborCost: number;
  materialCost: number;
  equipmentCost: number;
  batches: BatchCostData[];
  summary: {
    averageCostPerBatch: number;
    totalBatches: number;
    totalQuantity: number;
  };
}

// ========== API客户端类 ==========

class ProcessingApiClient {
  private getPath(factoryId?: string) {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}/processing`;
  }

  // ===== 批次管理 (8个API) =====

  // 1. 获取批次列表
  async getBatches(params?: { factoryId?: string; status?: string; page?: number; size?: number }): Promise<ApiResponse<PagedResponse<ProcessingBatch>>> {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(`${this.getPath(factoryId)}/batches`, { params: query });
  }

  // 2. 创建批次
  async createBatch(data: Partial<ProcessingBatch>, factoryId?: string): Promise<ApiResponse<ProcessingBatch>> {
    return await apiClient.post(`${this.getPath(factoryId)}/batches`, data);
  }

  // 3. 获取批次详情
  async getBatchById(batchId: string, factoryId?: string): Promise<ApiResponse<ProcessingBatch>> {
    return await apiClient.get(`${this.getPath(factoryId)}/batches/${batchId}`);
  }

  // 3.5. 更新批次信息
  async updateBatch(batchId: string, data: Partial<ProcessingBatch>, factoryId?: string): Promise<ApiResponse<ProcessingBatch>> {
    return await apiClient.put(`${this.getPath(factoryId)}/batches/${batchId}`, data);
  }

  // 4. 开始生产
  async startProduction(batchId: string, factoryId?: string): Promise<ApiResponse<ProcessingBatch>> {
    return await apiClient.post(`${this.getPath(factoryId)}/batches/${batchId}/start`);
  }

  // 5. 完成生产
  async completeProduction(batchId: string, actualQuantity: number, factoryId?: string): Promise<ApiResponse<ProcessingBatch>> {
    return await apiClient.post(`${this.getPath(factoryId)}/batches/${batchId}/complete`, {
      actualQuantity
    });
  }

  // 6. 取消生产
  async cancelProduction(batchId: string, reason?: string, factoryId?: string): Promise<ApiResponse<ProcessingBatch>> {
    return await apiClient.post(`${this.getPath(factoryId)}/batches/${batchId}/cancel`, {
      reason
    });
  }

  // 7. 记录材料消耗
  async recordMaterialConsumption(batchId: string, consumption: MaterialConsumptionRecord, factoryId?: string): Promise<ApiResponse<{ recorded: boolean }>> {
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
  async getMaterials(factoryId?: string): Promise<ApiResponse<MaterialType[]>> {
    return await apiClient.get(`${this.getPath(factoryId)}/materials`);
  }

  // 9. 记录原料接收
  async recordMaterialReceipt(data: { materialTypeId: string; quantity: number; unit?: string; supplierId?: string; receivedDate?: string }, factoryId?: string): Promise<ApiResponse<{ recorded: boolean }>> {
    return await apiClient.post(`${this.getPath(factoryId)}/material-receipt`, data);
  }

  // ===== 质检 (Phase 3 P1-002: 完整质检流程) =====

  // 10. 获取质检记录列表
  async getQualityInspections(params?: {
    batchId?: string;
    status?: 'draft' | 'submitted' | 'reviewed' | 'all';
    factoryId?: string;
    page?: number;
    size?: number;
  }): Promise<ApiResponse<PagedResponse<QualityInspection>>> {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(`${this.getPath(factoryId)}/quality/inspections`, {
      params: query
    });
  }

  // 11. 创建质检记录
  async createQualityInspection(data: {
    batchId: string;
    inspectionType: 'raw_material' | 'process' | 'final_product';
    inspector: string;
    inspectionDate: string;
    inspectionTime: string;
    scores: {
      freshness: number;
      appearance: number;
      smell: number;
      other: number;
    };
    conclusion: 'pass' | 'conditional_pass' | 'fail';
    notes?: string;
    photos?: string[]; // Photo URIs or IDs
    status?: 'draft' | 'submitted';
  }, factoryId?: string): Promise<ApiResponse<QualityInspection>> {
    return await apiClient.post(`${this.getPath(factoryId)}/quality/inspections`, data);
  }

  // 12. 获取质检记录详情
  async getQualityInspectionById(inspectionId: string, factoryId?: string): Promise<ApiResponse<QualityInspection>> {
    return await apiClient.get(`${this.getPath(factoryId)}/quality/inspections/${inspectionId}`);
  }

  // 13. 更新质检记录（仅草稿状态）
  async updateQualityInspection(
    inspectionId: string,
    data: Partial<{
      inspector: string;
      inspectionDate: string;
      inspectionTime: string;
      scores: {
        freshness: number;
        appearance: number;
        smell: number;
        other: number;
      };
      conclusion: 'pass' | 'conditional_pass' | 'fail';
      notes?: string;
      photos?: string[];
      status?: 'draft' | 'submitted';
    }>,
    factoryId?: string
  ): Promise<ApiResponse<QualityInspection>> {
    return await apiClient.put(`${this.getPath(factoryId)}/quality/inspections/${inspectionId}`, data);
  }

  // 14. 删除质检记录（仅草稿状态）
  async deleteQualityInspection(inspectionId: string, factoryId?: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return await apiClient.delete(`${this.getPath(factoryId)}/quality/inspections/${inspectionId}`);
  }

  // 15. 审核质检记录
  async reviewQualityInspection(
    inspectionId: string,
    data: {
      approved: boolean;
      reviewNotes?: string;
    },
    factoryId?: string
  ): Promise<ApiResponse<QualityInspection>> {
    return await apiClient.post(
      `${this.getPath(factoryId)}/quality/inspections/${inspectionId}/review`,
      data
    );
  }

  // 16. 上传质检照片
  async uploadQualityInspectionPhoto(
    inspectionId: string,
    photoData: FormData,
    factoryId?: string
  ): Promise<ApiResponse<{ photoUrl: string }>> {
    return await apiClient.post(
      `${this.getPath(factoryId)}/quality/inspections/${inspectionId}/photos`,
      photoData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
  }

  // ===== AI成本分析 (2个API) =====

  // 17. 获取批次成本分析数据
  async getBatchCostAnalysis(batchId: number | string, factoryId?: string): Promise<ApiResponse<BatchCostData>> {
    return await apiClient.get(`${this.getPath(factoryId)}/batches/${batchId}/cost-analysis`);
  }

  // 18. AI成本分析 - 已移除，请使用 aiApiClient.analyzeBatchCost()
  // 迁移指南: frontend/CretasFoodTrace/AI_API_MIGRATION_GUIDE.md

  // ===== 时间范围成本分析 (Phase 3新增) =====

  // 19. 获取时间范围内的成本汇总分析
  async getTimeRangeCostAnalysis(params: {
    startDate: string;  // ISO format date string
    endDate: string;    // ISO format date string
    factoryId?: string;
  }): Promise<ApiResponse<TimeRangeCostAnalysis>> {
    const { factoryId, startDate, endDate } = params;
    // 后端实际API路径: /api/mobile/{factoryId}/reports/cost-analysis
    // 转换ISO日期字符串为LocalDate格式 (YYYY-MM-DD)
    const startLocalDate = startDate.split('T')[0];
    const endLocalDate = endDate.split('T')[0];

    return await apiClient.get(`/api/mobile/${factoryId || DEFAULT_FACTORY_ID}/reports/cost-analysis`, {
      params: {
        startDate: startLocalDate,
        endDate: endLocalDate
      }
    });
  }

  // 20. AI时间范围成本分析（生成周报/月报等）
  async aiTimeRangeCostAnalysis(params: {
    startDate: string;
    endDate: string;
    question?: string;
    session_id?: string;
    factoryId?: string;
  }): Promise<ApiResponse<{ analysis: string; session_id: string }>> {
    const { factoryId, ...data } = params;
    return await apiClient.post(`${this.getPath(factoryId)}/ai-cost-analysis/time-range`, data);
  }

  // ===== MVP暂不使用的功能 =====
  // ===== 成本对比 (1个API) =====

  /**
   * 获取批次成本对比数据
   * @param batchIds 批次ID数组
   * @param factoryId 工厂ID（可选）
   * @returns 批次成本数据列表
   */
  async getBatchCostComparison(batchIds: string[], factoryId?: string): Promise<{ success: boolean; data: BatchCostData[] }> {
    const batchIdsParam = batchIds.join(',');
    const response = await apiClient.get<{ success: boolean; data: BatchCostData[] }>(`${this.getPath(factoryId)}/cost-comparison`, {
      params: { batchIds: batchIdsParam }
    });
    return response;
  }

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
