import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 部门管理API客户端
 * 总计11个API - 路径：/api/mobile/{factoryId}/departments/*
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

export interface DepartmentDTO {
  id?: number;
  factoryId?: string;
  name: string;
  code?: string;
  description?: string;
  managerUserId?: number;
  parentDepartmentId?: number;
  isActive?: boolean;
  displayOrder?: number;
  color?: string;
  icon?: string;
  // Extended fields from joins
  managerName?: string;
  parentDepartmentName?: string;
  employeeCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DepartmentPageParams {
  factoryId?: string;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
}

export interface DepartmentSearchParams {
  factoryId?: string;
  keyword: string;
  page?: number;
  size?: number;
}

class DepartmentApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/departments`;
  }

  // 1. 获取部门列表（分页）
  async getDepartments(params?: DepartmentPageParams): Promise<ApiResponse<PagedResponse<DepartmentDTO>>> {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(this.getPath(factoryId), { params: query });
  }

  // 2. 获取所有活跃部门
  async getActiveDepartments(factoryId?: string): Promise<ApiResponse<DepartmentDTO[]>> {
    return await apiClient.get(`${this.getPath(factoryId)}/active`);
  }

  // 3. 获取部门详情
  async getDepartmentById(id: number, factoryId?: string): Promise<ApiResponse<DepartmentDTO>> {
    return await apiClient.get(`${this.getPath(factoryId)}/${id}`);
  }

  // 4. 创建部门
  async createDepartment(data: DepartmentDTO, factoryId?: string): Promise<ApiResponse<DepartmentDTO>> {
    return await apiClient.post(this.getPath(factoryId), data);
  }

  // 5. 更新部门
  async updateDepartment(id: number, data: DepartmentDTO, factoryId?: string): Promise<ApiResponse<DepartmentDTO>> {
    return await apiClient.put(`${this.getPath(factoryId)}/${id}`, data);
  }

  // 6. 删除部门
  async deleteDepartment(id: number, factoryId?: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return await apiClient.delete(`${this.getPath(factoryId)}/${id}`);
  }

  // 7. 搜索部门
  async searchDepartments(params: DepartmentSearchParams): Promise<ApiResponse<PagedResponse<DepartmentDTO>>> {
    const { factoryId, ...query } = params;
    return await apiClient.get(`${this.getPath(factoryId)}/search`, { params: query });
  }

  // 8. 获取部门树形结构
  async getDepartmentTree(factoryId?: string): Promise<ApiResponse<DepartmentDTO[]>> {
    return await apiClient.get(`${this.getPath(factoryId)}/tree`);
  }

  // 9. 检查部门编码是否存在
  async checkCodeExists(code: string, excludeId?: number, factoryId?: string): Promise<ApiResponse<{ exists: boolean }>> {
    return await apiClient.get(`${this.getPath(factoryId)}/check-code`, {
      params: { code, excludeId }
    });
  }

  // 10. 初始化默认部门
  async initializeDefaultDepartments(factoryId?: string): Promise<ApiResponse<{ initialized: boolean; departments: DepartmentDTO[] }>> {
    return await apiClient.post(`${this.getPath(factoryId)}/initialize`);
  }

  // 11. 批量更新部门状态
  async updateDepartmentsStatus(ids: number[], isActive: boolean, factoryId?: string): Promise<ApiResponse<{ updated: number }>> {
    return await apiClient.put(`${this.getPath(factoryId)}/batch-status`, { ids, isActive });
  }
}

export const departmentApiClient = new DepartmentApiClient();
export default departmentApiClient;
