import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

/**
 * 工作类型管理API客户端
 * 总计10个API - 路径：/api/mobile/{factoryId}/work-types/*
 */

/**
 * 工作类型实体
 */
export interface WorkType {
  id: string;
  factoryId: string;
  code: string;
  name: string;
  description?: string;
  hourlyRate?: number;
  overtimeMultiplier?: number;
  department?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

/**
 * 创建工作类型请求参数
 */
export interface CreateWorkTypeRequest {
  code?: string;  // 可选，由后端自动生成或用户提供
  name: string;
  description?: string;
  hourlyRate?: number;
  overtimeMultiplier?: number;
  department?: string;
}

/**
 * 更新工作类型请求参数（所有字段可选）
 */
export interface UpdateWorkTypeRequest extends Partial<CreateWorkTypeRequest> {
  isActive?: boolean;
}

class WorkTypeApiClient {
  private getPath(factoryId?: string) {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}/work-types`;
  }

  // 1. 获取工作类型列表
  async getWorkTypes(params?: { factoryId?: string; isActive?: boolean }): Promise<{ data: WorkType[] }> {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(this.getPath(factoryId), { params: query });
  }

  // 2. 创建工作类型
  async createWorkType(data: CreateWorkTypeRequest, factoryId?: string): Promise<WorkType> {
    return await apiClient.post(this.getPath(factoryId), data);
  }

  // 3. 获取工作类型详情
  async getWorkTypeById(id: string, factoryId?: string): Promise<WorkType> {
    return await apiClient.get(`${this.getPath(factoryId)}/${id}`);
  }

  // 4. 更新工作类型
  async updateWorkType(id: string, data: UpdateWorkTypeRequest, factoryId?: string): Promise<WorkType> {
    return await apiClient.put(`${this.getPath(factoryId)}/${id}`, data);
  }

  // 5. 删除工作类型
  async deleteWorkType(id: string, factoryId?: string): Promise<void> {
    return await apiClient.delete(`${this.getPath(factoryId)}/${id}`);
  }

  // 6. 获取活跃工作类型
  async getActiveWorkTypes(factoryId?: string): Promise<WorkType[]> {
    return await apiClient.get(`${this.getPath(factoryId)}/active`);
  }

  // 7. 按部门获取工作类型
  async getWorkTypesByDepartment(department: string, factoryId?: string): Promise<WorkType[]> {
    return await apiClient.get(`${this.getPath(factoryId)}/department/${department}`);
  }

  // 8. 搜索工作类型
  async searchWorkTypes(keyword: string, factoryId?: string): Promise<WorkType[]> {
    return await apiClient.get(`${this.getPath(factoryId)}/search`, { params: { keyword } });
  }

  // 9. 获取工作类型统计
  async getWorkTypeStatistics(factoryId?: string): Promise<any> {
    return await apiClient.get(`${this.getPath(factoryId)}/statistics`);
  }

  // 10. 批量更新状态
  async batchUpdateStatus(ids: string[], isActive: boolean, factoryId?: string): Promise<void> {
    return await apiClient.put(`${this.getPath(factoryId)}/batch/status`, { ids, isActive });
  }
}

export const workTypeApiClient = new WorkTypeApiClient();
export default workTypeApiClient;
