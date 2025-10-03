import { apiClient } from './apiClient';
import { User, UserRole } from '../../types/auth';

// 用户列表项接口
export interface UserListItem {
  id: string;
  username: string;
  fullName: string;
  phone: string;
  email: string;
  role: UserRole;
  department: string;
  isActive: boolean;
  userType: 'platform' | 'factory';
  createdAt: string;
  lastLoginAt?: string;
  updatedAt: string;
}

// 用户查询参数接口
export interface UserQueryParams {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
  roleCode?: string;
  department?: string;
  search?: string;
  userType?: 'platform' | 'factory';
}

// 用户列表响应接口
export interface UserListResponse {
  success: boolean;
  data: {
    users: UserListItem[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
  message?: string;
}

// 用户详情响应接口
export interface UserDetailResponse {
  success: boolean;
  data: {
    user: User;
  };
  message?: string;
}

// 用户更新请求接口
export interface UserUpdateRequest {
  username?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  department?: string;
  isActive?: boolean;
  permissions?: string[];
}

/**
 * 用户管理API客户端
 */
export class UserApiClient {
  /**
   * 获取用户列表
   */
  static async getUserList(params: UserQueryParams = {}): Promise<UserListResponse> {
    try {
      console.log('获取用户列表:', params);
      
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.set('page', params.page.toString());
      if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString());
      if (params.isActive !== undefined) queryParams.set('isActive', params.isActive.toString());
      if (params.roleCode) queryParams.set('roleCode', params.roleCode);
      if (params.department) queryParams.set('department', params.department);
      if (params.search) queryParams.set('search', params.search);
      if (params.userType) queryParams.set('userType', params.userType);

      const url = queryParams.toString() ? `/api/users?${queryParams.toString()}` : '/api/users';
      const response = await apiClient.get<UserListResponse>(url);
      
      console.log('用户列表获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取用户列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户详情
   */
  static async getUserDetail(userId: string): Promise<UserDetailResponse> {
    try {
      console.log('获取用户详情:', userId);
      
      const response = await apiClient.get<UserDetailResponse>(`/api/users/${userId}`);
      
      console.log('用户详情获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取用户详情失败:', error);
      throw error;
    }
  }

  /**
   * 更新用户信息
   */
  static async updateUser(userId: string, updateData: UserUpdateRequest): Promise<UserDetailResponse> {
    try {
      console.log('更新用户信息:', { userId, updateData });
      
      const response = await apiClient.put<UserDetailResponse>(`/api/users/${userId}`, updateData);
      
      console.log('用户信息更新成功:', response);
      return response;
    } catch (error) {
      console.error('更新用户信息失败:', error);
      throw error;
    }
  }

  /**
   * 激活/停用用户
   */
  static async toggleUserStatus(userId: string, isActive: boolean): Promise<{ success: boolean; message: string }> {
    try {
      console.log('切换用户状态:', { userId, isActive });
      
      const response = await apiClient.put<{ success: boolean; message: string }>(
        `/api/users/${userId}/status`, 
        { isActive }
      );
      
      console.log('用户状态切换成功:', response);
      return response;
    } catch (error) {
      console.error('切换用户状态失败:', error);
      throw error;
    }
  }

  /**
   * 更新用户权限
   */
  static async updateUserPermissions(userId: string, permissions: string[]): Promise<{ success: boolean; message: string }> {
    try {
      console.log('更新用户权限:', { userId, permissions });
      
      const response = await apiClient.put<{ success: boolean; message: string }>(
        `/api/users/${userId}/permissions`, 
        { permissions }
      );
      
      console.log('用户权限更新成功:', response);
      return response;
    } catch (error) {
      console.error('更新用户权限失败:', error);
      throw error;
    }
  }

  /**
   * 重置用户密码
   */
  static async resetUserPassword(userId: string, newPassword?: string): Promise<{ success: boolean; message: string; tempPassword?: string }> {
    try {
      console.log('重置用户密码:', userId);
      
      const response = await apiClient.post<{ success: boolean; message: string; tempPassword?: string }>(
        `/api/users/${userId}/reset-password`, 
        { newPassword }
      );
      
      console.log('用户密码重置成功:', response);
      return response;
    } catch (error) {
      console.error('重置用户密码失败:', error);
      throw error;
    }
  }

  /**
   * 获取待审核用户列表
   */
  static async getPendingUsers(params: UserQueryParams = {}): Promise<UserListResponse> {
    try {
      console.log('获取待审核用户列表:', params);
      
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.set('page', params.page.toString());
      if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString());
      if (params.search) queryParams.set('search', params.search);

      const url = queryParams.toString() ? `/api/users/pending?${queryParams.toString()}` : '/api/users/pending';
      const response = await apiClient.get<UserListResponse>(url);
      
      console.log('待审核用户列表获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取待审核用户列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户设备列表
   */
  static async getUserDevices(): Promise<{ success: boolean; data: { devices: any[]; total: number } }> {
    try {
      console.log('获取用户设备列表');
      
      const response = await apiClient.get<{ success: boolean; data: { devices: any[]; total: number } }>(
        '/api/mobile/auth/devices'
      );
      
      console.log('用户设备列表获取成功:', response);
      return response;
    } catch (error) {
      console.error('获取用户设备列表失败:', error);
      throw error;
    }
  }

  /**
   * 绑定用户设备
   */
  static async bindDevice(deviceId: string, deviceInfo: any): Promise<{ success: boolean; message: string }> {
    try {
      console.log('绑定用户设备:', { deviceId, deviceInfo });
      
      const response = await apiClient.post<{ success: boolean; message: string }>(
        '/api/mobile/auth/bind-device',
        { deviceId, deviceInfo }
      );
      
      console.log('用户设备绑定成功:', response);
      return response;
    } catch (error) {
      console.error('绑定用户设备失败:', error);
      throw error;
    }
  }

  /**
   * 批量权限检查
   */
  static async batchCheckPermissions(permissionChecks: any[]): Promise<{
    success: boolean;
    data: {
      userId: string;
      userType: string;
      userRole: string;
      hasAccess: boolean;
      results: any[];
      userPermissions: string[];
      timestamp: string;
    };
  }> {
    try {
      console.log('批量权限检查:', permissionChecks);
      
      const response = await apiClient.post<{
        success: boolean;
        data: {
          userId: string;
          userType: string;
          userRole: string;
          hasAccess: boolean;
          results: any[];
          userPermissions: string[];
          timestamp: string;
        };
      }>('/api/mobile/permissions/batch-check', { permissionChecks });
      
      console.log('批量权限检查成功:', response);
      return response;
    } catch (error) {
      console.error('批量权限检查失败:', error);
      throw error;
    }
  }

  /**
   * 检查白名单状态
   */
  static async checkWhitelistStatus(phoneNumber: string): Promise<{ success: boolean; isWhitelisted: boolean; message?: string }> {
    try {
      console.log('检查白名单状态:', phoneNumber);
      
      const response = await apiClient.post<{ success: boolean; isWhitelisted: boolean; message?: string }>(
        '/api/mobile/auth/check-whitelist',
        { phoneNumber }
      );
      
      console.log('白名单状态检查成功:', response);
      return response;
    } catch (error) {
      console.error('检查白名单状态失败:', error);
      throw error;
    }
  }
}