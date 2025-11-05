import { apiClient } from './apiClient';

/**
 * 系统管理API客户端
 * 总计9个API - 路径：/api/system/*
 */

class SystemApiClient {
  private basePath = '/api/system';

  async getSystemHealth() {
    return await apiClient.get(`${this.basePath}/health`);
  }

  async getSystemConfiguration() {
    return await apiClient.get(`${this.basePath}/configuration`);
  }

  async updateSystemConfiguration(config: any) {
    return await apiClient.put(`${this.basePath}/configuration`, config);
  }

  async getSystemLogs(params?: any) {
    return await apiClient.get(`${this.basePath}/logs`, { params });
  }

  async getSystemStatistics() {
    return await apiClient.get(`${this.basePath}/statistics`);
  }

  async getSystemPerformance() {
    return await apiClient.get(`${this.basePath}/performance`);
  }

  async getDatabaseStatus() {
    return await apiClient.get(`${this.basePath}/database/status`);
  }

  async getAPILogs(params?: any) {
    return await apiClient.get(`${this.basePath}/api-logs`, { params });
  }

  async cleanupLogs(olderThanDays?: number) {
    return await apiClient.post(`${this.basePath}/cleanup-logs`, { olderThanDays });
  }
}

export const systemApiClient = new SystemApiClient();
export default systemApiClient;
