import { apiClient } from '../apiClient';
import { DEFAULT_FACTORY_ID } from '../../../constants/config';

/**
 * 报表统计管理API客户端
 * 总计19个API - 路径：/api/mobile/{factoryId}/reports/*
 */

class ReportApiClient {
  private getPath(factoryId?: string) {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}/reports`;
  }

  async getDailyProductionReport(date: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/daily-production`, { params: { date } });
  }

  async getWeeklyProductionReport(weekStart: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/weekly-production`, { params: { weekStart } });
  }

  async getMonthlyProductionReport(year: number, month: number, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/monthly-production`, { params: { year, month } });
  }

  async getInventoryReport(params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/inventory`, { params });
  }

  async getCostAnalysisReport(params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/cost-analysis`, { params });
  }

  async getQualityReport(params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/quality`, { params });
  }

  async getMaterialUsageReport(params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/material-usage`, { params });
  }

  async getProductOutputReport(params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/product-output`, { params });
  }

  async getSupplierPerformanceReport(params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/supplier-performance`, { params });
  }

  async getCustomerSalesReport(params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/customer-sales`, { params });
  }

  async getEmployeePerformanceReport(params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/employee-performance`, { params });
  }

  async getEquipmentUtilizationReport(params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/equipment-utilization`, { params });
  }

  async getWastageReport(params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/wastage`, { params });
  }

  async getProfitAnalysisReport(params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/profit-analysis`, { params });
  }

  async getTrendAnalysisReport(params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/trend-analysis`, { params });
  }

  async getComparisonReport(params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/comparison`, { params });
  }

  async getCustomReport(params: any, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/custom`, params);
  }

  async exportReport(reportType: string, params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/export/${reportType}`, {
      params,
      responseType: 'blob'
    });
  }

  async scheduleReport(schedule: any, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/schedule`, schedule);
  }
}

export const reportApiClient = new ReportApiClient();
export default reportApiClient;
