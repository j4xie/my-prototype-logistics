import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';
import { User } from '../../types/auth';

/**
 * 用户管理API客户端
 * 总计14个API - 路径：/api/mobile/{factoryId}/users/*
 */

// ========== 类型定义 ==========

// 导出User类型供其他组件使用
export type { User };

export interface UserDTO {
  id: number;
  username: string;
  email?: string;
  realName: string;
  fullName?: string;  // 后端可能返回 fullName 替代 realName
  phone?: string;
  role?: string;       // 保留兼容
  roleCode: string;    // 后端实际返回的角色枚举值 (OPERATOR, DEPARTMENT_ADMIN, FACTORY_SUPER_ADMIN)
  roleDisplayName?: string;  // 角色显示名称
  department?: string;
  departmentDisplayName?: string;  // 部门显示名称
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

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
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
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}`;
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
    // apiClient返回包装格式: {code, data, message, success}
    const response = await apiClient.get<{
      code: number;
      data: PageResponse<UserDTO>;
      message: string;
      success: boolean;
    }>(
      `${this.getFactoryPath(factoryId)}/users`,
      { params: queryParams }
    );
    // 提取实际数据
    return response.data || { content: [], totalElements: 0, totalPages: 0, size: 20, number: 0 };
  }

  /**
   * 2. 创建用户
   * POST /api/{factoryId}/users
   */
  async createUser(request: CreateUserRequest, factoryId?: string): Promise<UserDTO> {
    const response = await apiClient.post<{ code: number; data: UserDTO; message: string; success: boolean; }>(
      `${this.getFactoryPath(factoryId)}/users`,
      request
    );
    return response.data;
  }

  /**
   * 3. 获取用户详情
   * GET /api/{factoryId}/users/{userId}
   */
  async getUserById(userId: number, factoryId?: string): Promise<UserDTO> {
    const response = await apiClient.get<{ code: number; data: UserDTO; message: string; success: boolean; }>(
      `${this.getFactoryPath(factoryId)}/users/${userId}`
    );
    return response.data;
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
    const response = await apiClient.put<{ code: number; data: UserDTO; message: string; success: boolean; }>(
      `${this.getFactoryPath(factoryId)}/users/${userId}`,
      request
    );
    return response.data;
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
    const response = await apiClient.post<{ code: number; data: UserDTO; message: string; success: boolean; }>(
      `${this.getFactoryPath(factoryId)}/users/${userId}/activate`
    );
    return response.data;
  }

  /**
   * 7. 停用用户
   * POST /api/{factoryId}/users/{userId}/deactivate
   */
  async deactivateUser(userId: number, factoryId?: string): Promise<UserDTO> {
    const response = await apiClient.post<{ code: number; data: UserDTO; message: string; success: boolean; }>(
      `${this.getFactoryPath(factoryId)}/users/${userId}/deactivate`
    );
    return response.data;
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
    const response = await apiClient.put<{ code: number; data: UserDTO; message: string; success: boolean; }>(
      `${this.getFactoryPath(factoryId)}/users/${userId}/role`,
      request
    );
    return response.data;
  }

  /**
   * 9. 按角色获取用户列表
   * GET /api/{factoryId}/users/role/{roleCode}
   */
  async getUsersByRole(roleCode: string, factoryId?: string): Promise<UserDTO[]> {
    const response = await apiClient.get<{ code: number; data: UserDTO[]; message: string; success: boolean; }>(
      `${this.getFactoryPath(factoryId)}/users/role/${roleCode}`
    );
    return response.data || [];
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
    const response = await apiClient.get<{ code: number; data: UserDTO[]; message: string; success: boolean; }>(
      `${this.getFactoryPath(factoryId)}/users/search`,
      { params: queryParams }
    );
    return response.data || [];
  }

  /**
   * 11. 检查用户名是否存在
   * GET /api/{factoryId}/users/check/username
   */
  async checkUsernameExists(username: string, factoryId?: string): Promise<boolean> {
    const response = await apiClient.get<{ code: number; data: boolean; message: string; success: boolean; }>(
      `${this.getFactoryPath(factoryId)}/users/check/username`,
      { params: { username } }
    );
    return response.data;
  }

  /**
   * 12. 检查邮箱是否存在
   * GET /api/{factoryId}/users/check/email
   */
  async checkEmailExists(email: string, factoryId?: string): Promise<boolean> {
    const response = await apiClient.get<{ code: number; data: boolean; message: string; success: boolean; }>(
      `${this.getFactoryPath(factoryId)}/users/check/email`,
      { params: { email } }
    );
    return response.data;
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
    // apiClient拦截器已统一返回data
    return await apiClient.get<Blob>(
      `${this.getFactoryPath(factoryId)}/users/export`,
      { params: queryParams, responseType: 'blob' }
    );
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

    const response = await apiClient.post<{
      code: number;
      data: { success: number; failed: number; errors?: string[] };
      message: string;
      success: boolean;
    }>(
      `${this.getFactoryPath(factoryId)}/users/import`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  /**
   * 15. 修改密码
   * PUT /api/{factoryId}/users/{userId}/password
   *
   * 注意：
   * - 需要提供旧密码验证
   * - 新密码需要满足安全强度要求（后端验证）
   */
  async changePassword(
    userId: number,
    request: ChangePasswordRequest,
    factoryId?: string
  ): Promise<{ message: string }> {
    console.log('Changing password for user:', userId);

    const response = await apiClient.put<{ code: number; data: { message: string }; message: string; success: boolean; }>(
      `${this.getFactoryPath(factoryId)}/users/${userId}/password`,
      request
    );
    return response.data;
  }
}

export const userApiClient = new UserApiClient();
