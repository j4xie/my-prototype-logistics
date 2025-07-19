/**
 * 用户管理服务
 * 对接新后端API的用户管理功能
 */

import { apiClient } from '@/lib/api';
import { API_ENDPOINTS } from '@/config/api-endpoints';

/**
 * 用户角色枚举
 */
export type UserRole = 'super_admin' | 'permission_admin' | 'department_admin' | 'user' | 'unactivated';

/**
 * 部门枚举
 */
export type Department = 'farming' | 'processing' | 'logistics' | 'quality' | 'management' | 'admin';

/**
 * 用户信息接口
 */
export interface User {
  id: number;
  username: string;
  email?: string;
  fullName: string;
  phone?: string;
  isActive: boolean;
  roleCode: UserRole;
  roleLevel: number;
  department?: Department;
  position?: string;
  permissions: string[];
  lastLogin?: string;
  createdAt: string;
}

/**
 * 用户列表响应接口
 */
export interface UserListResponse {
  items: User[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * 用户统计接口
 */
export interface UserStats {
  activeUsers: number;
  pendingUsers: number;
  totalUsers: number;
  roleStats: Record<string, number>;
  departmentStats: Record<string, number>;
  recentLoginUsers: number;
}

/**
 * 用户查询参数
 */
export interface UserListParams {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
  roleCode?: UserRole;
  department?: Department;
  search?: string;
}

/**
 * 用户激活参数
 */
export interface ActivateUserParams {
  roleCode: UserRole;
  roleLevel: number;
  department?: Department;
  position?: string;
  permissions?: string[];
}

/**
 * 更新用户参数
 */
export interface UpdateUserParams {
  fullName?: string;
  email?: string;
  phone?: string;
  department?: Department;
  position?: string;
  permissions?: string[];
  roleCode?: UserRole;
  roleLevel?: number;
}

/**
 * 用户API错误类
 */
export class UserApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'UserApiError';
  }
}

/**
 * 用户管理服务类
 */
export class UserService {
  /**
   * 获取用户列表
   */
  async getUserList(params: UserListParams = {}): Promise<UserListResponse> {
    try {
      const {
        page = 1,
        pageSize = 10,
        isActive,
        roleCode,
        department,
        search
      } = params;

      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (isActive !== undefined) {
        queryParams.append('isActive', isActive.toString());
      }

      if (roleCode) {
        queryParams.append('roleCode', roleCode);
      }

      if (department) {
        queryParams.append('department', department);
      }

      if (search) {
        queryParams.append('search', search);
      }

      const endpoint = `${API_ENDPOINTS.USERS.LIST}?${queryParams.toString()}`;
      const response = await apiClient.get(endpoint);

      console.log('[UserService] 获取用户列表响应:', response);

      if (response && response.success) {
        return response.data;
      }

      throw new UserApiError(
        response?.message || '获取用户列表失败',
        400,
        'GET_USERS_FAILED'
      );

    } catch (error) {
      console.error('[UserService] 获取用户列表失败:', error);

      if (error instanceof UserApiError) {
        throw error;
      }

      throw new UserApiError(
        error instanceof Error ? error.message : '获取用户列表请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 获取待激活用户列表
   */
  async getPendingUsers(): Promise<{ items: User[]; count: number }> {
    try {
      const response = await apiClient.get(API_ENDPOINTS.USERS.PENDING);

      console.log('[UserService] 获取待激活用户响应:', response);

      if (response && response.success) {
        return response.data;
      }

      throw new UserApiError(
        response?.message || '获取待激活用户失败',
        400,
        'GET_PENDING_USERS_FAILED'
      );

    } catch (error) {
      console.error('[UserService] 获取待激活用户失败:', error);

      if (error instanceof UserApiError) {
        throw error;
      }

      throw new UserApiError(
        error instanceof Error ? error.message : '获取待激活用户请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 获取用户统计信息
   */
  async getUserStats(): Promise<UserStats> {
    try {
      const response = await apiClient.get(API_ENDPOINTS.USERS.STATS);

      console.log('[UserService] 获取用户统计响应:', response);

      if (response && response.success) {
        return response.data;
      }

      throw new UserApiError(
        response?.message || '获取用户统计失败',
        400,
        'GET_STATS_FAILED'
      );

    } catch (error) {
      console.error('[UserService] 获取用户统计失败:', error);

      if (error instanceof UserApiError) {
        throw error;
      }

      throw new UserApiError(
        error instanceof Error ? error.message : '获取用户统计请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 激活用户
   */
  async activateUser(userId: number, params: ActivateUserParams): Promise<User> {
    try {
      console.log('[UserService] 激活用户:', { userId, ...params });

      const endpoint = `${API_ENDPOINTS.USERS.ACTIVATE}/${userId}/activate`;
      const response = await apiClient.post(endpoint, params);

      console.log('[UserService] 激活用户响应:', response);

      if (response && response.success) {
        return response.data.user;
      }

      throw new UserApiError(
        response?.message || '用户激活失败',
        400,
        'ACTIVATE_USER_FAILED'
      );

    } catch (error) {
      console.error('[UserService] 用户激活失败:', error);

      if (error instanceof UserApiError) {
        throw error;
      }

      throw new UserApiError(
        error instanceof Error ? error.message : '用户激活请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 更新用户信息
   */
  async updateUser(userId: number, params: UpdateUserParams): Promise<User> {
    try {
      console.log('[UserService] 更新用户信息:', { userId, ...params });

      const endpoint = `${API_ENDPOINTS.USERS.UPDATE}/${userId}`;
      const response = await apiClient.put(endpoint, params);

      console.log('[UserService] 更新用户响应:', response);

      if (response && response.success) {
        return response.data.user;
      }

      throw new UserApiError(
        response?.message || '更新用户信息失败',
        400,
        'UPDATE_USER_FAILED'
      );

    } catch (error) {
      console.error('[UserService] 更新用户信息失败:', error);

      if (error instanceof UserApiError) {
        throw error;
      }

      throw new UserApiError(
        error instanceof Error ? error.message : '更新用户信息请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 切换用户状态（启用/停用）
   */
  async toggleUserStatus(userId: number, isActive: boolean): Promise<User> {
    try {
      console.log('[UserService] 切换用户状态:', { userId, isActive });

      const endpoint = `${API_ENDPOINTS.USERS.STATUS}/${userId}/status`;
      const response = await apiClient.put(endpoint, { isActive });

      console.log('[UserService] 切换用户状态响应:', response);

      if (response && response.success) {
        return response.data.user;
      }

      throw new UserApiError(
        response?.message || '切换用户状态失败',
        400,
        'TOGGLE_USER_STATUS_FAILED'
      );

    } catch (error) {
      console.error('[UserService] 切换用户状态失败:', error);

      if (error instanceof UserApiError) {
        throw error;
      }

      throw new UserApiError(
        error instanceof Error ? error.message : '切换用户状态请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 重置用户密码
   */
  async resetUserPassword(userId: number): Promise<{ tempPassword: string }> {
    try {
      console.log('[UserService] 重置用户密码:', userId);

      const endpoint = `${API_ENDPOINTS.USERS.RESET_PASSWORD}/${userId}/reset-password`;
      const response = await apiClient.post(endpoint);

      console.log('[UserService] 重置用户密码响应:', response);

      if (response && response.success) {
        return response.data;
      }

      throw new UserApiError(
        response?.message || '重置用户密码失败',
        400,
        'RESET_PASSWORD_FAILED'
      );

    } catch (error) {
      console.error('[UserService] 重置用户密码失败:', error);

      if (error instanceof UserApiError) {
        throw error;
      }

      throw new UserApiError(
        error instanceof Error ? error.message : '重置用户密码请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 删除用户
   */
  async deleteUser(userId: number): Promise<void> {
    try {
      console.log('[UserService] 删除用户:', userId);

      const endpoint = `${API_ENDPOINTS.USERS.UPDATE}/${userId}`;
      const response = await apiClient.delete(endpoint);

      console.log('[UserService] 删除用户响应:', response);

      if (response && response.success) {
        return;
      }

      throw new UserApiError(
        response?.message || '删除用户失败',
        400,
        'DELETE_USER_FAILED'
      );

    } catch (error) {
      console.error('[UserService] 删除用户失败:', error);

      if (error instanceof UserApiError) {
        throw error;
      }

      throw new UserApiError(
        error instanceof Error ? error.message : '删除用户请求失败',
        500,
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * 获取部门权限映射
   */
  getDepartmentPermissions(department: Department): string[] {
    const departmentPermissions: Record<Department, string[]> = {
      farming: ['farming:read', 'farming:write', 'farming:delete', 'common:read'],
      processing: ['processing:read', 'processing:write', 'processing:delete', 'common:read'],
      logistics: ['logistics:read', 'logistics:write', 'logistics:delete', 'common:read'],
      quality: ['quality:read', 'quality:write', 'quality:delete', 'common:read'],
      management: ['admin:read', 'admin:write', 'user:read', 'user:write', 'common:read'],
      admin: [
        'admin:read', 'admin:write', 'admin:delete',
        'user:read', 'user:write', 'user:delete',
        'whitelist:read', 'whitelist:write', 'whitelist:delete',
        'common:read'
      ],
    };

    return departmentPermissions[department] || ['common:read'];
  }

  /**
   * 获取角色级别映射
   */
  getRoleLevel(roleCode: UserRole): number {
    const roleLevels: Record<UserRole, number> = {
      super_admin: 0,
      permission_admin: 5,
      department_admin: 10,
      user: 50,
      unactivated: 99,
    };

    return roleLevels[roleCode] || 99;
  }

  /**
   * 获取角色显示名称
   */
  getRoleDisplayName(roleCode: UserRole): string {
    const roleNames: Record<UserRole, string> = {
      super_admin: '超级管理员',
      permission_admin: '权限管理员',
      department_admin: '部门管理员',
      user: '普通用户',
      unactivated: '待激活用户',
    };

    return roleNames[roleCode] || '未知角色';
  }

  /**
   * 获取部门显示名称
   */
  getDepartmentDisplayName(department: Department): string {
    const departmentNames: Record<Department, string> = {
      farming: '养殖部门',
      processing: '生产部门',
      logistics: '物流部门',
      quality: '质检部门',
      management: '管理部门',
      admin: '系统管理',
    };

    return departmentNames[department] || '未知部门';
  }
}

// 创建用户服务实例
export const userService = new UserService();

// 导出服务实例
export default userService;