import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

/**
 * 时间统计管理API客户端
 * 总计17个API - 路径：/api/mobile/{factoryId}/time-stats/*
 */

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
 * 时间记录
 */
export interface TimeRecord {
  id: number;
  employeeId: number;
  employeeName?: string;
  workTypeId: string;
  workTypeName?: string;
  department?: string;
  startTime: string;
  endTime: string;
  duration: number; // 分钟
  date: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 员工时间统计
 */
export interface EmployeeTimeStats {
  employeeId: number;
  employeeName: string;
  totalHours: number;
  workDays: number;
  overtimeHours: number;
  efficiency: number;
  period: {
    startDate: string;
    endDate: string;
  };
}

/**
 * 部门时间统计
 */
export interface DepartmentTimeStats {
  department: string;
  totalEmployees: number;
  totalHours: number;
  averageHours: number;
  topPerformers: Array<{
    employeeId: number;
    employeeName: string;
    hours: number;
  }>;
}

/**
 * 工作类型时间统计
 */
export interface WorkTypeTimeStats {
  workTypeId: string;
  workTypeName: string;
  totalHours: number;
  recordCount: number;
  averageDuration: number;
}

/**
 * 每日统计
 */
export interface DailyStats {
  date: string;
  totalHours: number;
  employeeCount: number;
  records: TimeRecord[];
}

/**
 * 每周统计
 */
export interface WeeklyStats {
  weekStart: string;
  weekEnd: string;
  totalHours: number;
  dailyBreakdown: Array<{
    date: string;
    hours: number;
  }>;
}

/**
 * 每月统计
 */
export interface MonthlyStats {
  year: number;
  month: number;
  totalHours: number;
  workDays: number;
  averageDailyHours: number;
  weeklyBreakdown: WeeklyStats[];
}

/**
 * 加班时长
 */
export interface OvertimeHours {
  employeeId: number;
  employeeName: string;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  period: {
    startDate: string;
    endDate: string;
  };
}

/**
 * 效率报告
 */
export interface EfficiencyReport {
  period: {
    startDate: string;
    endDate: string;
  };
  averageEfficiency: number;
  topPerformers: Array<{
    employeeId: number;
    employeeName: string;
    efficiency: number;
    totalHours: number;
  }>;
  lowPerformers: Array<{
    employeeId: number;
    employeeName: string;
    efficiency: number;
    totalHours: number;
  }>;
}

/**
 * 成本分析（已废弃，使用 processingApiClient）
 */
export interface CostAnalysis {
  totalCost: number;
  laborCost: number;
  averageCostPerHour: number;
  period: {
    startDate: string;
    endDate: string;
  };
}

/**
 * 查询参数
 */
export interface TimeStatsQueryParams {
  startDate?: string;
  endDate?: string;
  department?: string;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
}

class TimeStatsApiClient {
  private getPath(factoryId?: string) {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}/time-stats`;
  }

  async getTimeStats(params?: TimeStatsQueryParams & { factoryId?: string }): Promise<ApiResponse<TimeRecord[]>> {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(this.getPath(factoryId), { params: query });
  }

  async createTimeRecord(data: Partial<TimeRecord>, factoryId?: string): Promise<ApiResponse<TimeRecord>> {
    return await apiClient.post(this.getPath(factoryId), data);
  }

  async getTimeRecordById(id: string, factoryId?: string): Promise<ApiResponse<TimeRecord>> {
    return await apiClient.get(`${this.getPath(factoryId)}/${id}`);
  }

  async updateTimeRecord(id: string, data: Partial<TimeRecord>, factoryId?: string): Promise<ApiResponse<TimeRecord>> {
    return await apiClient.put(`${this.getPath(factoryId)}/${id}`, data);
  }

  async deleteTimeRecord(id: string, factoryId?: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return await apiClient.delete(`${this.getPath(factoryId)}/${id}`);
  }

  /**
   * 获取员工个人时间统计
   * 后端路径: GET /api/mobile/{factoryId}/time-stats/workers/{workerId}
   * 必需参数: startDate, endDate
   */
  async getEmployeeTimeStats(employeeId: number, params?: TimeStatsQueryParams, factoryId?: string): Promise<ApiResponse<EmployeeTimeStats>> {
    return await apiClient.get(`${this.getPath(factoryId)}/workers/${employeeId}`, { params });
  }

  /**
   * 按部门统计
   * 后端路径: GET /api/mobile/{factoryId}/time-stats/by-department
   * 必需参数: startDate, endDate
   * 注意: department 参数需要在 params 中传递，不在URL路径中
   */
  async getDepartmentTimeStats(department: string, params?: TimeStatsQueryParams, factoryId?: string): Promise<ApiResponse<DepartmentTimeStats>> {
    // 将 department 添加到查询参数中，而不是作为路径参数
    const queryParams = { ...params, department };
    return await apiClient.get(`${this.getPath(factoryId)}/by-department`, { params: queryParams });
  }

  async getWorkTypeTimeStats(workTypeId: string, params?: TimeStatsQueryParams, factoryId?: string): Promise<ApiResponse<WorkTypeTimeStats>> {
    return await apiClient.get(`${this.getPath(factoryId)}/work-type/${workTypeId}`, { params });
  }

  async getDailyStats(date: string, factoryId?: string): Promise<ApiResponse<DailyStats>> {
    return await apiClient.get(`${this.getPath(factoryId)}/daily`, { params: { date } });
  }

  async getWeeklyStats(weekStart: string, factoryId?: string): Promise<ApiResponse<WeeklyStats>> {
    return await apiClient.get(`${this.getPath(factoryId)}/weekly`, { params: { weekStart } });
  }

  async getMonthlyStats(year: number, month: number, factoryId?: string): Promise<ApiResponse<MonthlyStats>> {
    return await apiClient.get(`${this.getPath(factoryId)}/monthly`, { params: { year, month } });
  }

  async calculateOvertimeHours(params: TimeStatsQueryParams & { employeeId: number }, factoryId?: string): Promise<ApiResponse<OvertimeHours>> {
    return await apiClient.post(`${this.getPath(factoryId)}/calculate-overtime`, params);
  }

  async getEfficiencyReport(params?: TimeStatsQueryParams, factoryId?: string): Promise<ApiResponse<EfficiencyReport>> {
    return await apiClient.get(`${this.getPath(factoryId)}/efficiency-report`, { params });
  }

  /**
   * @deprecated 此方法已废弃 (废弃日期: 2025-11-19)
   *
   * ⚠️ 请使用 processingApiClient 的成本分析方法替代
   *
   * 替代方案:
   * ```typescript
   * import { processingApiClient } from './processingApiClient';
   *
   * // 单批次成本分析:
   * await processingApiClient.getBatchCostAnalysis(batchId, factoryId);
   *
   * // 时间范围成本分析:
   * await processingApiClient.getTimeRangeCostAnalysis({
   *   startDate: '2025-01-01',
   *   endDate: '2025-11-19',
   *   factoryId
   * });
   * ```
   *
   * 废弃原因:
   * - 成本分析属于生产加工模块，不属于时间统计模块
   * - processingApiClient 提供了更完整的成本分析功能
   * - 避免职责混淆和API重复
   */
  async getCostAnalysis(params?: TimeStatsQueryParams, factoryId?: string): Promise<ApiResponse<CostAnalysis>> {
    console.warn('[timeStatsApiClient.getCostAnalysis] 此方法已废弃，请使用 processingApiClient.getTimeRangeCostAnalysis()');
    return await apiClient.get(`${this.getPath(factoryId)}/cost-analysis`, { params });
  }

  async getTopPerformers(limit?: number, factoryId?: string): Promise<ApiResponse<Array<{
    employeeId: number;
    employeeName: string;
    totalHours: number;
    efficiency: number;
  }>>> {
    return await apiClient.get(`${this.getPath(factoryId)}/top-performers`, { params: { limit } });
  }

  async exportTimeStats(params?: TimeStatsQueryParams & { factoryId?: string }): Promise<Blob> {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(`${this.getPath(factoryId)}/export`, {
      params: query,
      responseType: 'blob'
    });
  }

  async importTimeRecords(file: File, factoryId?: string): Promise<ApiResponse<{
    imported: number;
    failed: number;
    errors?: string[];
  }>> {
    const formData = new FormData();
    formData.append('file', file);
    return await apiClient.post(`${this.getPath(factoryId)}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
}

export const timeStatsApiClient = new TimeStatsApiClient();
export default timeStatsApiClient;
