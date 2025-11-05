import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

/**
 * 工作类型管理API客户端
 * 总计10个API - 路径：/api/mobile/{factoryId}/work-types/*
 */

class WorkTypeApiClient {
  private getPath(factoryId?: string) {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}/work-types`;
  }

  // 1. 获取工作类型列表
  async getWorkTypes(params?: { factoryId?: string; isActive?: boolean }) {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(this.getPath(factoryId), { params: query });
  }

  // 2. 创建工作类型
  async createWorkType(data: any, factoryId?: string) {
    return await apiClient.post(this.getPath(factoryId), data);
  }

  // 3. 获取工作类型详情
  async getWorkTypeById(id: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/${id}`);
  }

  // 4. 更新工作类型
  async updateWorkType(id: string, data: any, factoryId?: string) {
    return await apiClient.put(`${this.getPath(factoryId)}/${id}`, data);
  }

  // 5. 删除工作类型
  async deleteWorkType(id: string, factoryId?: string) {
    return await apiClient.delete(`${this.getPath(factoryId)}/${id}`);
  }

  // 6. 获取活跃工作类型
  async getActiveWorkTypes(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/active`);
  }

  // 7. 按部门获取工作类型
  async getWorkTypesByDepartment(department: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/department/${department}`);
  }

  // 8. 搜索工作类型
  async searchWorkTypes(keyword: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/search`, { params: { keyword } });
  }

  // 9. 获取工作类型统计
  async getWorkTypeStatistics(factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/statistics`);
  }

  // 10. 批量更新状态
  async batchUpdateStatus(ids: string[], isActive: boolean, factoryId?: string) {
    return await apiClient.put(`${this.getPath(factoryId)}/batch/status`, { ids, isActive });
  }
}

export const workTypeApiClient = new WorkTypeApiClient();
export default workTypeApiClient;
