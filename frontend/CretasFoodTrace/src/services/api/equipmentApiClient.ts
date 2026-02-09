import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';
import { getErrorMsg } from '../../utils/errorHandler';

// API 响应包装类型 (后端返回的标准格式)
interface ApiResponse<T> {
  code: number;
  success: boolean;
  data: T;
  message: string;
}

/**
 * 设备管理API客户端
 * 总计30+个API - 路径：/api/mobile/{factoryId}/equipment/*
 *
 * 后端实现：EquipmentController
 * 功能：设备CRUD、状态管理、维护记录、统计分析、导入导出
 */

// ========== 类型定义 ==========

export type EquipmentStatus = 'active' | 'inactive' | 'maintenance' | 'fault' | 'scrapped';
export type EquipmentType = 'processing' | 'refrigeration' | 'packaging' | 'transport' | 'other';

/**
 * 设备信息
 */
export interface Equipment {
  id: number;
  factoryId: string;
  name: string;
  code: string;
  equipmentCode?: string; // 后端额外字段
  equipmentName?: string; // 后端使用 equipmentName 而非 name
  type: EquipmentType;
  model?: string;
  manufacturer?: string;
  purchaseDate?: string;
  warrantyExpiryDate?: string;
  status: EquipmentStatus;
  location?: string;
  specifications?: string;
  purchasePrice?: number;
  depreciationYears?: number;
  // 成本与能耗 (Phase 4 data integrity)
  hourlyCost?: number; // 设备每小时成本
  powerConsumptionKw?: number; // 功耗 (千瓦)
  totalRunningHours?: number; // 累计运行时长
  // 维护相关
  maintenanceInterval?: number; // 前端：天 | 后端 maintenanceIntervalHours: 小时
  maintenanceIntervalHours?: number; // 后端实际字段 (小时)
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  serialNumber?: string; // 设备序列号
  operatorId?: number;
  operatorName?: string;
  createdBy?: number; // 创建人ID
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 创建设备请求
 */
export interface CreateEquipmentRequest {
  name: string;
  code: string;
  type: EquipmentType;
  model?: string;
  manufacturer?: string;
  purchaseDate?: string;
  warrantyExpiryDate?: string;
  location?: string;
  specifications?: string;
  purchasePrice?: number;
  depreciationYears?: number;
  maintenanceInterval?: number;
  operatorId?: number;
  notes?: string;
}

/**
 * 设备列表查询参数
 */
export interface EquipmentListParams {
  factoryId?: string;
  status?: EquipmentStatus;
  type?: EquipmentType;
  keyword?: string;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
}

/**
 * 设备统计信息
 */
export interface EquipmentStatistics {
  totalCount: number;
  activeCount: number;
  maintenanceCount: number;
  inactiveCount: number;
  scrappedCount: number;
  totalValue: number;
  depreciatedValue: number;
  maintenanceDueCount: number;
  warrantyExpiringCount: number;
}

/**
 * 设备使用历史
 */
export interface EquipmentUsageHistory {
  id: number;
  equipmentId: number;
  operatorId: number;
  operatorName: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  batchId?: string;
  notes?: string;
}

/**
 * 设备维护记录
 */
export interface MaintenanceRecord {
  id: number;
  equipmentId: number;
  maintenanceDate: string;
  cost?: number;
  description?: string;
  performedBy?: string;
  nextMaintenanceDate?: string;
}

/**
 * 设备效率报告
 */
export interface EquipmentEfficiencyReport {
  equipmentId: number;
  equipmentName: string;
  period: string;
  totalRuntime: number;
  downtime: number;
  utilizationRate: number;
  oee?: number; // Overall Equipment Effectiveness
  mtbf?: number; // Mean Time Between Failures
  mttr?: number; // Mean Time To Repair
}

/**
 * 设备告警级别
 */
export type AlertLevel = 'CRITICAL' | 'WARNING' | 'INFO';

/**
 * 设备告警状态
 */
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

/**
 * 设备告警响应
 */
export interface AlertResponse {
  id: number;
  factoryId: string;
  equipmentId: number;
  equipmentName: string;
  alertType: string;
  level: AlertLevel;
  status: AlertStatus;
  message: string;
  details?: string;
  triggeredAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
}

/**
 * 确认告警请求
 */
export interface AcknowledgeAlertRequest {
  notes?: string;
}

/**
 * 解决告警请求
 */
export interface ResolveAlertRequest {
  resolutionNotes?: string;
}

// ========== API客户端类 ==========

class EquipmentApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/equipment`;
  }

  // ===== 设备CRUD操作 =====

  /**
   * 1. 创建设备
   * POST /equipment
   */
  async createEquipment(data: CreateEquipmentRequest, factoryId?: string): Promise<Equipment> {
    const response = await apiClient.post<ApiResponse<Equipment>>(this.getPath(factoryId), data);
    return response.data;
  }

  /**
   * 2. 获取设备列表（分页）
   * GET /equipment
   */
  async getEquipments(params?: EquipmentListParams): Promise<{ content: Equipment[]; totalElements: number; totalPages: number }> {
    const { factoryId, ...query } = params || {};
    const response = await apiClient.get<ApiResponse<{ content: Equipment[]; totalElements: number; totalPages: number }>>(this.getPath(factoryId), { params: query });
    return response.data;
  }

  /**
   * 3. 获取设备详情
   * GET /equipment/{equipmentId}
   */
  async getEquipmentById(equipmentId: number, factoryId?: string): Promise<Equipment> {
    const response = await apiClient.get<ApiResponse<Equipment>>(`${this.getPath(factoryId)}/${equipmentId}`);
    return response.data;
  }

  /**
   * 4. 更新设备
   * PUT /equipment/{equipmentId}
   */
  async updateEquipment(equipmentId: number, data: Partial<CreateEquipmentRequest>, factoryId?: string): Promise<Equipment> {
    const response = await apiClient.put<ApiResponse<Equipment>>(`${this.getPath(factoryId)}/${equipmentId}`, data);
    return response.data;
  }

  /**
   * 5. 删除设备
   * DELETE /equipment/{equipmentId}
   */
  async deleteEquipment(equipmentId: number, factoryId?: string) {
    return await apiClient.delete(`${this.getPath(factoryId)}/${equipmentId}`);
  }

  // ===== 设备状态管理 =====

  /**
   * 6. 更新设备状态
   * PUT /equipment/{equipmentId}/status
   */
  async updateEquipmentStatus(equipmentId: number, status: EquipmentStatus, factoryId?: string): Promise<Equipment> {
    const response = await apiClient.put<ApiResponse<Equipment>>(`${this.getPath(factoryId)}/${equipmentId}/status`, { status });
    return response.data;
  }

  /**
   * 7. 启动设备
   * POST /equipment/{equipmentId}/start
   */
  async startEquipment(equipmentId: number, operatorId?: number, factoryId?: string): Promise<Equipment> {
    const response = await apiClient.post<ApiResponse<Equipment>>(`${this.getPath(factoryId)}/${equipmentId}/start`, { operatorId });
    return response.data;
  }

  /**
   * 8. 停止设备
   * POST /equipment/{equipmentId}/stop
   */
  async stopEquipment(equipmentId: number, factoryId?: string): Promise<Equipment> {
    const response = await apiClient.post<ApiResponse<Equipment>>(`${this.getPath(factoryId)}/${equipmentId}/stop`);
    return response.data;
  }

  /**
   * 9. 报废设备
   * POST /equipment/{equipmentId}/scrap
   */
  async scrapEquipment(equipmentId: number, reason?: string, factoryId?: string): Promise<Equipment> {
    const response = await apiClient.post<ApiResponse<Equipment>>(`${this.getPath(factoryId)}/${equipmentId}/scrap`, { reason });
    return response.data;
  }

  // ===== 维护管理 =====

  /**
   * 10. 记录设备维护
   * POST /equipment/{equipmentId}/maintenance
   */
  async recordMaintenance(
    equipmentId: number,
    data: {
      maintenanceDate: string;
      cost?: number;
      description?: string;
    },
    factoryId?: string
  ): Promise<MaintenanceRecord> {
    const response = await apiClient.post<ApiResponse<MaintenanceRecord>>(`${this.getPath(factoryId)}/${equipmentId}/maintenance`, data);
    return response.data;
  }

  /**
   * 11. 获取需要维护的设备
   * GET /equipment/needing-maintenance
   */
  async getEquipmentNeedingMaintenance(factoryId?: string): Promise<Equipment[]> {
    const response = await apiClient.get<ApiResponse<Equipment[]>>(`${this.getPath(factoryId)}/needing-maintenance`);
    return response.data || [];
  }

  /**
   * 12. 获取保修即将到期的设备
   * GET /equipment/expiring-warranty
   */
  async getEquipmentWithExpiringWarranty(daysAhead: number = 30, factoryId?: string): Promise<Equipment[]> {
    const response = await apiClient.get<ApiResponse<Equipment[]>>(`${this.getPath(factoryId)}/expiring-warranty`, {
      params: { daysAhead }
    });
    return response.data || [];
  }

  // ===== 查询与筛选 =====

  /**
   * 13. 按状态查询设备
   * GET /equipment/status/{status}
   */
  async getEquipmentsByStatus(status: EquipmentStatus, factoryId?: string): Promise<Equipment[]> {
    const response = await apiClient.get<ApiResponse<Equipment[]>>(`${this.getPath(factoryId)}/status/${status}`);
    return response.data || [];
  }

  /**
   * 14. 按类型查询设备
   * GET /equipment/type/{type}
   */
  async getEquipmentsByType(type: EquipmentType, factoryId?: string): Promise<Equipment[]> {
    const response = await apiClient.get<ApiResponse<Equipment[]>>(`${this.getPath(factoryId)}/type/${type}`);
    return response.data || [];
  }

  /**
   * 15. 搜索设备
   * GET /equipment/search
   */
  async searchEquipments(keyword: string, factoryId?: string): Promise<Equipment[]> {
    const response = await apiClient.get<ApiResponse<Equipment[]>>(`${this.getPath(factoryId)}/search`, {
      params: { keyword }
    });
    return response.data || [];
  }

  // ===== 统计与分析 =====

  /**
   * 16. 获取设备统计信息
   * GET /equipment/{equipmentId}/statistics
   */
  async getEquipmentStatistics(equipmentId: number, factoryId?: string): Promise<EquipmentStatistics> {
    const response = await apiClient.get<ApiResponse<EquipmentStatistics>>(`${this.getPath(factoryId)}/${equipmentId}/statistics`);
    return response.data;
  }

  /**
   * 17. 获取设备使用历史
   * GET /equipment/{equipmentId}/usage-history
   */
  async getEquipmentUsageHistory(
    equipmentId: number,
    params?: { startDate?: string; endDate?: string },
    factoryId?: string
  ): Promise<EquipmentUsageHistory[]> {
    const response = await apiClient.get<ApiResponse<EquipmentUsageHistory[]>>(`${this.getPath(factoryId)}/${equipmentId}/usage-history`, {
      params
    });
    return response.data || [];
  }

  /**
   * 18. 获取设备维护历史
   * GET /equipment/{equipmentId}/maintenance-history
   */
  async getEquipmentMaintenanceHistory(equipmentId: number, factoryId?: string): Promise<MaintenanceRecord[]> {
    const response = await apiClient.get<ApiResponse<MaintenanceRecord[]>>(`${this.getPath(factoryId)}/${equipmentId}/maintenance-history`);
    return response.data || [];
  }

  /**
   * 19. 获取设备效率报告
   * GET /equipment/{equipmentId}/efficiency-report
   */
  async getEquipmentEfficiencyReport(
    equipmentId: number,
    params?: { startDate?: string; endDate?: string },
    factoryId?: string
  ): Promise<EquipmentEfficiencyReport> {
    const response = await apiClient.get<ApiResponse<EquipmentEfficiencyReport>>(`${this.getPath(factoryId)}/${equipmentId}/efficiency-report`, {
      params
    });
    return response.data;
  }

  /**
   * 20. 计算设备折旧后价值
   * GET /equipment/{equipmentId}/depreciated-value
   */
  async calculateDepreciatedValue(equipmentId: number, factoryId?: string): Promise<number> {
    const response = await apiClient.get<ApiResponse<number>>(`${this.getPath(factoryId)}/${equipmentId}/depreciated-value`);
    return response.data;
  }

  /**
   * 21. 计算设备OEE
   * GET /equipment/{equipmentId}/oee
   */
  async calculateOEE(
    equipmentId: number,
    params?: { startDate?: string; endDate?: string },
    factoryId?: string
  ): Promise<number> {
    const response = await apiClient.get<ApiResponse<number>>(`${this.getPath(factoryId)}/${equipmentId}/oee`, {
      params
    });
    return response.data;
  }

  /**
   * 22. 获取整体设备统计
   * GET /equipment/overall-statistics
   */
  async getOverallStatistics(factoryId?: string): Promise<EquipmentStatistics> {
    const response = await apiClient.get<ApiResponse<EquipmentStatistics>>(`${this.getPath(factoryId)}/overall-statistics`);
    return response.data;
  }

  // ===== 批量操作 =====

  /**
   * 23. 批量导入设备
   * POST /equipment/import
   */
  async importEquipments(file: FormData, factoryId?: string): Promise<{ imported: number; failed: number }> {
    const response = await apiClient.post<ApiResponse<{ imported: number; failed: number }>>(`${this.getPath(factoryId)}/import`, file, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }

  /**
   * 24. 导出设备列表
   * GET /equipment/export
   */
  async exportEquipments(params?: EquipmentListParams) {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(`${this.getPath(factoryId)}/export`, {
      params: query,
      responseType: 'blob'
    });
  }

  // ===== 设备告警管理 =====

  /**
   * 25. 确认设备告警
   * POST /equipment/alerts/{alertId}/acknowledge
   * @param alertId 告警ID（支持数字ID或动态ID如MAINT_1）
   * @param request 确认请求（可选）
   * @param factoryId 工厂ID
   * @returns 告警响应
   */
  async acknowledgeAlert(
    alertId: string,
    request?: AcknowledgeAlertRequest,
    factoryId?: string
  ): Promise<{ success: boolean; data: AlertResponse; message: string }> {
    return await apiClient.post(
      `${this.getPath(factoryId)}/alerts/${alertId}/acknowledge`,
      request || {}
    );
  }

  /**
   * 26. 解决设备告警
   * POST /equipment/alerts/{alertId}/resolve
   * @param alertId 告警ID（支持数字ID或动态ID如MAINT_1）
   * @param request 解决请求（可选）
   * @param factoryId 工厂ID
   * @returns 告警响应
   */
  async resolveAlert(
    alertId: string,
    request?: ResolveAlertRequest,
    factoryId?: string
  ): Promise<{ success: boolean; data: AlertResponse; message: string }> {
    return await apiClient.post(
      `${this.getPath(factoryId)}/alerts/${alertId}/resolve`,
      request || {}
    );
  }

  /**
   * 27. 获取设备告警列表（分页）
   * GET /equipment/alerts
   * @param status 告警状态筛选（可选）
   * @param page 页码
   * @param size 每页数量
   * @param factoryId 工厂ID
   * @returns 分页告警列表
   */
  async getEquipmentAlerts(
    params?: {
      status?: string;
      page?: number;
      size?: number;
    },
    factoryId?: string
  ): Promise<{
    success: boolean;
    data: {
      content: AlertResponse[];
      page: number;
      size: number;
      totalElements: number;
      totalPages: number;
      first: boolean;
      last: boolean;
    };
  }> {
    return await apiClient.get(`${this.getPath(factoryId)}/alerts`, {
      params: params || {}
    });
  }

  /**
   * 获取全局设备统计信息
   * GET /equipment/statistics
   */
  async getStatistics(factoryId?: string): Promise<{ success: boolean; data: EquipmentStatistics }> {
    return await apiClient.get(`${this.getPath(factoryId)}/statistics`);
  }
}

// ========== 单例导出 ==========

export const equipmentApiClient = new EquipmentApiClient();
export default equipmentApiClient;
