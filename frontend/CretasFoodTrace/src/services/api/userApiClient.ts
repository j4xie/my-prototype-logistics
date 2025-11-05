import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

/**
 * 用户管理API客户端
 * 总计14个API - 路径：/api/{factoryId}/users/*
 */

// ========== 类型定义 ==========

export interface UserDTO {
  id: number;
  username: string;
  email?: string;
  realName: string;
  phone?: string;
  role: string;
  department?: string;
  position?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  realName: string;
  email?: string;
  phone?: string;
  role: string;
  department?: string;
  position?: string;
}

export interface UpdateUserRequest {
  realName?: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
}

export interface UpdateUserRoleRequest {
  roleCode: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

// ========== API客户端类 ==========

class UserApiClient {
  private getFactoryPath(factoryId?: string) {
    return `/api/${factoryId || DEFAULT_FACTORY_ID}`;
  }

  /**
   * 1. 获取用户列表（分页）
   * GET /api/{factoryId}/users
   */
  async getUsers(params?: {
    factoryId?: string;
    page?: number;
    size?: number;
    sortBy?: string;
    sortDirection?: 'ASC' | 'DESC';
    keyword?: string;
  }): Promise<PageResponse<UserDTO>> {
    const { factoryId, ...queryParams } = params || {};
    const response: any = await apiClient.get(
      `${this.getFactoryPath(factoryId)}/users`,
      { params: queryParams }
    );
    return response.data || response;
  }

  /**
   * 2. 创建用户
   * POST /api/{factoryId}/users
   */
  async createUser(request: CreateUserRequest, factoryId?: string): Promise<UserDTO> {
    const response: any = await apiClient.post(
      `${this.getFactoryPath(factoryId)}/users`,
      request
    );
    return response.data || response;
  }

  /**
   * 3. 获取用户详情
   * GET /api/{factoryId}/users/{userId}
   */
  async getUserById(userId: number, factoryId?: string): Promise<UserDTO> {
    const response: any = await apiClient.get(
      `${this.getFactoryPath(factoryId)}/users/${userId}`
    );
    return response.data || response;
  }

  /**
   * 4. 更新用户信息
   * PUT /api/{factoryId}/users/{userId}
   */
  async updateUser(
    userId: number,
    request: UpdateUserRequest,
    factoryId?: string
  ): Promise<UserDTO> {
    const response: any = await apiClient.put(
      `${this.getFactoryPath(factoryId)}/users/${userId}`,
      request
    );
    return response.data || response;
  }

  /**
   * 5. 删除用户
   * DELETE /api/{factoryId}/users/{userId}
   */
  async deleteUser(userId: number, factoryId?: string): Promise<void> {
    await apiClient.delete(`${this.getFactoryPath(factoryId)}/users/${userId}`);
  }

  /**
   * 6. 激活用户
   * POST /api/{factoryId}/users/{userId}/activate
   */
  async activateUser(userId: number, factoryId?: string): Promise<UserDTO> {
    const response: any = await apiClient.post(
      `${this.getFactoryPath(factoryId)}/users/${userId}/activate`
    );
    return response.data || response;
  }

  /**
   * 7. 停用用户
   * POST /api/{factoryId}/users/{userId}/deactivate
   */
  async deactivateUser(userId: number, factoryId?: string): Promise<UserDTO> {
    const response: any = await apiClient.post(
      `${this.getFactoryPath(factoryId)}/users/${userId}/deactivate`
    );
    return response.data || response;
  }

  /**
   * 8. 更新用户角色
   * PUT /api/{factoryId}/users/{userId}/role
   */
  async updateUserRole(
    userId: number,
    request: UpdateUserRoleRequest,
    factoryId?: string
  ): Promise<UserDTO> {
    const response: any = await apiClient.put(
      `${this.getFactoryPath(factoryId)}/users/${userId}/role`,
      request
    );
    return response.data || response;
  }

  /**
   * 9. 按角色获取用户列表
   * GET /api/{factoryId}/users/role/{roleCode}
   */
  async getUsersByRole(roleCode: string, factoryId?: string): Promise<UserDTO[]> {
    const response: any = await apiClient.get(
      `${this.getFactoryPath(factoryId)}/users/role/${roleCode}`
    );
    return response.data || response;
  }

  /**
   * 10. 搜索用户
   * GET /api/{factoryId}/users/search
   */
  async searchUsers(params: {
    keyword: string;
    factoryId?: string;
    role?: string;
    department?: string;
    isActive?: boolean;
  }): Promise<UserDTO[]> {
    const { factoryId, ...queryParams } = params;
    const response: any = await apiClient.get(
      `${this.getFactoryPath(factoryId)}/users/search`,
      { params: queryParams }
    );
    return response.data || response;
  }

  /**
   * 11. 检查用户名是否存在
   * GET /api/{factoryId}/users/check/username
   */
  async checkUsernameExists(username: string, factoryId?: string): Promise<boolean> {
    const response: any = await apiClient.get(
      `${this.getFactoryPath(factoryId)}/users/check/username`,
      { params: { username } }
    );
    return response.data !== undefined ? response.data : response;
  }

  /**
   * 12. 检查邮箱是否存在
   * GET /api/{factoryId}/users/check/email
   */
  async checkEmailExists(email: string, factoryId?: string): Promise<boolean> {
    const response: any = await apiClient.get(
      `${this.getFactoryPath(factoryId)}/users/check/email`,
      { params: { email } }
    );
    return response.data !== undefined ? response.data : response;
  }

  /**
   * 13. 导出用户列表
   * GET /api/{factoryId}/users/export
   */
  async exportUsers(params?: {
    factoryId?: string;
    role?: string;
    department?: string;
    isActive?: boolean;
  }): Promise<Blob> {
    const { factoryId, ...queryParams } = params || {};
    const response: any = await apiClient.get(
      `${this.getFactoryPath(factoryId)}/users/export`,
      { params: queryParams, responseType: 'blob' }
    );
    return response.data || response;
  }

  /**
   * 14. 批量导入用户
   * POST /api/{factoryId}/users/import
   */
  async importUsers(file: File, factoryId?: string): Promise<{
    success: number;
    failed: number;
    errors?: string[];
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const response: any = await apiClient.post(
      `${this.getFactoryPath(factoryId)}/users/import`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data || response;
  }
}

export const userApiClient = new UserApiClient();
