import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

/**
 * 时间统计管理API客户端
 * 总计17个API - 路径：/api/mobile/{factoryId}/time-stats/*
 */

class TimeStatsApiClient {
  private getPath(factoryId?: string) {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}/time-stats`;
  }

  async getTimeStats(params?: { factoryId?: string; [key: string]: any }) {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(this.getPath(factoryId), { params: query });
  }

  async createTimeRecord(data: any, factoryId?: string) {
    return await apiClient.post(this.getPath(factoryId), data);
  }

  async getTimeRecordById(id: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/${id}`);
  }

  async updateTimeRecord(id: string, data: any, factoryId?: string) {
    return await apiClient.put(`${this.getPath(factoryId)}/${id}`, data);
  }

  async deleteTimeRecord(id: string, factoryId?: string) {
    return await apiClient.delete(`${this.getPath(factoryId)}/${id}`);
  }

  async getEmployeeTimeStats(employeeId: number, params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/employee/${employeeId}`, { params });
  }

  async getDepartmentTimeStats(department: string, params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/department/${department}`, { params });
  }

  async getWorkTypeTimeStats(workTypeId: string, params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/work-type/${workTypeId}`, { params });
  }

  async getDailyStats(date: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/daily`, { params: { date } });
  }

  async getWeeklyStats(weekStart: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/weekly`, { params: { weekStart } });
  }

  async getMonthlyStats(year: number, month: number, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/monthly`, { params: { year, month } });
  }

  async calculateOvertimeHours(params: any, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/calculate-overtime`, params);
  }

  async getEfficiencyReport(params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/efficiency-report`, { params });
  }

  async getCostAnalysis(params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/cost-analysis`, { params });
  }

  async getTopPerformers(limit?: number, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/top-performers`, { params: { limit } });
  }

  async exportTimeStats(params?: { factoryId?: string; [key: string]: any }) {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(`${this.getPath(factoryId)}/export`, {
      params: query,
      responseType: 'blob'
    });
  }

  async importTimeRecords(file: File, factoryId?: string) {
    const formData = new FormData();
    formData.append('file', file);
    return await apiClient.post(`${this.getPath(factoryId)}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
}

export const timeStatsApiClient = new TimeStatsApiClient();
export default timeStatsApiClient;
