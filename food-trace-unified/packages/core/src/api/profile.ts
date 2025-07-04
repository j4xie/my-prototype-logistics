// 个人资料管理API - 重点模块
import { api } from './client';
import type { ApiResponse } from '../types/api';
import type { User, UserPreferences, OrganizationProfile } from '../types/state';

// 用户资料相关类型
export interface ProfileUpdateRequest {
  name?: string;
  phone?: string;
  email?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  timezone?: string;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  lastPasswordChange: string;
  loginHistory: Array<{
    timestamp: string;
    ip: string;
    device: string;
    location: string;
    success: boolean;
  }>;
  activeSessions: Array<{
    id: string;
    device: string;
    ip: string;
    lastActivity: string;
    current: boolean;
  }>;
}

export interface NotificationSettings {
  email: {
    productUpdates: boolean;
    qualityAlerts: boolean;
    batchNotifications: boolean;
    systemMaintenance: boolean;
    newsletter: boolean;
  };
  push: {
    qualityAlerts: boolean;
    batchNotifications: boolean;
    reminders: boolean;
    emergencyAlerts: boolean;
  };
  sms: {
    emergencyAlerts: boolean;
    criticalUpdates: boolean;
  };
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'organization' | 'private';
  shareAnalytics: boolean;
  dataRetention: 'standard' | 'extended' | 'minimal';
  thirdPartyIntegrations: boolean;
}

// 个人资料管理API
export const profileApi = {
  // 获取用户资料
  getProfile: async (): Promise<User> => {
    const response = await api.get<User>('/api/profile');
    return response.data;
  },

  // 更新用户资料
  updateProfile: async (data: ProfileUpdateRequest): Promise<User> => {
    const response = await api.put<User>('/api/profile', data);
    return response.data;
  },

  // 上传头像
  uploadAvatar: async (file: File, onProgress?: (progress: number) => void): Promise<{ avatarUrl: string }> => {
    const response = await api.upload<{ avatarUrl: string }>('/api/profile/avatar', file, onProgress);
    return response.data;
  },

  // 删除头像
  deleteAvatar: async (): Promise<void> => {
    await api.delete('/api/profile/avatar');
  },

  // 修改密码
  changePassword: async (data: PasswordChangeRequest): Promise<void> => {
    await api.post('/api/profile/password', data);
  },

  // 获取用户偏好设置
  getPreferences: async (): Promise<UserPreferences> => {
    const response = await api.get<UserPreferences>('/api/profile/preferences');
    return response.data;
  },

  // 更新用户偏好设置
  updatePreferences: async (preferences: Partial<UserPreferences>): Promise<UserPreferences> => {
    const response = await api.put<UserPreferences>('/api/profile/preferences', preferences);
    return response.data;
  },

  // 获取通知设置
  getNotificationSettings: async (): Promise<NotificationSettings> => {
    const response = await api.get<NotificationSettings>('/api/profile/notifications');
    return response.data;
  },

  // 更新通知设置
  updateNotificationSettings: async (settings: Partial<NotificationSettings>): Promise<NotificationSettings> => {
    const response = await api.put<NotificationSettings>('/api/profile/notifications', settings);
    return response.data;
  },

  // 获取隐私设置
  getPrivacySettings: async (): Promise<PrivacySettings> => {
    const response = await api.get<PrivacySettings>('/api/profile/privacy');
    return response.data;
  },

  // 更新隐私设置
  updatePrivacySettings: async (settings: Partial<PrivacySettings>): Promise<PrivacySettings> => {
    const response = await api.put<PrivacySettings>('/api/profile/privacy', settings);
    return response.data;
  },

  // 获取安全设置
  getSecuritySettings: async (): Promise<SecuritySettings> => {
    const response = await api.get<SecuritySettings>('/api/profile/security');
    return response.data;
  },

  // 启用/禁用双因素认证
  toggleTwoFactor: async (enabled: boolean, code?: string): Promise<{ secret?: string; qrCode?: string }> => {
    const response = await api.post('/api/profile/security/2fa', { enabled, code });
    return response.data;
  },

  // 验证双因素认证代码
  verifyTwoFactor: async (code: string): Promise<{ verified: boolean }> => {
    const response = await api.post('/api/profile/security/2fa/verify', { code });
    return response.data;
  },

  // 终止其他会话
  terminateSession: async (sessionId: string): Promise<void> => {
    await api.delete(`/api/profile/security/sessions/${sessionId}`);
  },

  // 终止所有其他会话
  terminateAllSessions: async (): Promise<void> => {
    await api.delete('/api/profile/security/sessions');
  },

  // 获取登录历史
  getLoginHistory: async (params?: {
    limit?: number;
    offset?: number;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const response = await api.get('/api/profile/security/login-history', { params });
    return response.data;
  },

  // 获取组织资料
  getOrganizationProfile: async (): Promise<OrganizationProfile> => {
    const response = await api.get<OrganizationProfile>('/api/profile/organization');
    return response.data;
  },

  // 更新组织资料
  updateOrganizationProfile: async (data: Partial<OrganizationProfile>): Promise<OrganizationProfile> => {
    const response = await api.put<OrganizationProfile>('/api/profile/organization', data);
    return response.data;
  },

  // 上传组织徽标
  uploadOrganizationLogo: async (file: File, onProgress?: (progress: number) => void): Promise<{ logoUrl: string }> => {
    const response = await api.upload<{ logoUrl: string }>('/api/profile/organization/logo', file, onProgress);
    return response.data;
  },

  // 获取用户统计信息
  getUserStats: async (): Promise<{
    totalBatches: number;
    totalProducts: number;
    qualityScore: number;
    memberSince: string;
    lastActivity: string;
    achievements: Array<{
      id: string;
      name: string;
      description: string;
      earnedAt: string;
      icon: string;
    }>;
    activity: Array<{
      date: string;
      batchesCreated: number;
      qualityChecks: number;
      shipmentsProcessed: number;
    }>;
  }> => {
    const response = await api.get('/api/profile/stats');
    return response.data;
  },

  // 获取用户认证信息
  getVerificationStatus: async (): Promise<{
    emailVerified: boolean;
    phoneVerified: boolean;
    identityVerified: boolean;
    organizationVerified: boolean;
    verificationDocuments: Array<{
      type: 'identity' | 'organization' | 'certification';
      status: 'pending' | 'approved' | 'rejected';
      uploadedAt: string;
      reviewedAt?: string;
      notes?: string;
    }>;
  }> => {
    const response = await api.get('/api/profile/verification');
    return response.data;
  },

  // 上传验证文档
  uploadVerificationDocument: async (
    type: 'identity' | 'organization' | 'certification',
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<void> => {
    await api.upload(`/api/profile/verification/${type}`, file, onProgress);
  },

  // 请求邮箱验证
  requestEmailVerification: async (): Promise<void> => {
    await api.post('/api/profile/verification/email');
  },

  // 验证邮箱
  verifyEmail: async (token: string): Promise<void> => {
    await api.post('/api/profile/verification/email/verify', { token });
  },

  // 请求手机号验证
  requestPhoneVerification: async (): Promise<void> => {
    await api.post('/api/profile/verification/phone');
  },

  // 验证手机号
  verifyPhone: async (code: string): Promise<void> => {
    await api.post('/api/profile/verification/phone/verify', { code });
  },

  // 下载个人数据
  downloadPersonalData: async (): Promise<void> => {
    await api.download('/api/profile/data/export', 'personal-data.zip');
  },

  // 请求删除账户
  requestAccountDeletion: async (reason?: string): Promise<void> => {
    await api.post('/api/profile/deletion/request', { reason });
  },

  // 取消删除账户请求
  cancelAccountDeletion: async (): Promise<void> => {
    await api.delete('/api/profile/deletion/request');
  },

  // 获取API密钥列表
  getApiKeys: async (): Promise<Array<{
    id: string;
    name: string;
    keyPrefix: string;
    permissions: string[];
    createdAt: string;
    lastUsed?: string;
    expiresAt?: string;
  }>> => {
    const response = await api.get('/api/profile/api-keys');
    return response.data;
  },

  // 创建API密钥
  createApiKey: async (data: {
    name: string;
    permissions: string[];
    expiresAt?: string;
  }): Promise<{
    id: string;
    name: string;
    key: string;
    permissions: string[];
    expiresAt?: string;
  }> => {
    const response = await api.post('/api/profile/api-keys', data);
    return response.data;
  },

  // 删除API密钥
  deleteApiKey: async (keyId: string): Promise<void> => {
    await api.delete(`/api/profile/api-keys/${keyId}`);
  },

  // 获取集成设置
  getIntegrations: async (): Promise<Array<{
    id: string;
    name: string;
    type: 'webhook' | 'api' | 'sso';
    status: 'active' | 'inactive' | 'error';
    config: Record<string, any>;
    lastSync?: string;
  }>> => {
    const response = await api.get('/api/profile/integrations');
    return response.data;
  },

  // 更新集成设置
  updateIntegration: async (
    integrationId: string,
    config: Record<string, any>
  ): Promise<void> => {
    await api.put(`/api/profile/integrations/${integrationId}`, config);
  },

  // 测试集成连接
  testIntegration: async (integrationId: string): Promise<{
    success: boolean;
    message?: string;
    latency?: number;
  }> => {
    const response = await api.post(`/api/profile/integrations/${integrationId}/test`);
    return response.data;
  }
};