import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 移动端专用API客户端
 * 总计14个API（去除7个重复的认证API）
 *
 * 注意：认证相关API（7个）已在authService.ts中实现，不在此重复
 */

// ========== 设备激活与管理（3个）==========

export const deviceActivationAPI = {
  /**
   * 设备激活
   * POST /api/mobile/activation/activate
   */
  activateDevice: async (data: {
    activationCode: string;
    deviceInfo: any;
  }) => {
    return await apiClient.post('/api/mobile/activation/activate', data);
  },

  /**
   * 获取用户设备列表
   * GET /api/mobile/devices
   */
  getDevices: async () => {
    return await apiClient.get('/api/mobile/devices');
  },

  /**
   * 移除设备
   * DELETE /api/mobile/devices/{deviceId}
   */
  removeDevice: async (deviceId: string) => {
    return await apiClient.delete(`/api/mobile/devices/${deviceId}`);
  },
};

// ========== 文件上传（1个）==========

export const mobileUploadAPI = {
  /**
   * 移动端文件上传
   * POST /api/mobile/upload
   */
  uploadFile: async (file: any, metadata?: { category?: string; metadata?: string }) => {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata?.category) formData.append('category', metadata.category);
    if (metadata?.metadata) formData.append('metadata', metadata.metadata);

    return await apiClient.post('/api/mobile/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
};

// ========== 离线数据同步（2个）==========

export const offlineSyncAPI = {
  /**
   * 获取离线数据包
   * GET /api/mobile/offline/{factoryId}
   */
  getOfflineDataPackage: async (factoryId?: string) => {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return await apiClient.get(`/api/mobile/offline/${currentFactoryId}`);
  },

  /**
   * 数据同步
   * POST /api/mobile/sync/{factoryId}
   */
  syncData: async (syncRequest: any, factoryId?: string) => {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return await apiClient.post(`/api/mobile/sync/${currentFactoryId}`, syncRequest);
  },
};

// ========== 推送通知（2个）==========

export const pushNotificationAPI = {
  /**
   * 注册推送通知
   * POST /api/mobile/push/register
   */
  registerPush: async (registration: {
    deviceToken: string;
    platform: 'ios' | 'android';
    deviceId: string;
  }) => {
    return await apiClient.post('/api/mobile/push/register', registration);
  },

  /**
   * 取消推送通知注册
   * DELETE /api/mobile/push/unregister
   */
  unregisterPush: async (deviceToken: string) => {
    return await apiClient.delete('/api/mobile/push/unregister', {
      params: { deviceToken }
    });
  },
};

// ========== 系统监控（4个）==========

export const mobileMonitoringAPI = {
  /**
   * 健康检查
   * GET /api/mobile/health
   */
  healthCheck: async () => {
    return await apiClient.get('/api/mobile/health');
  },

  /**
   * 上报崩溃日志
   * POST /api/mobile/report/crash
   */
  reportCrash: async (crashData: any) => {
    return await apiClient.post('/api/mobile/report/crash', crashData);
  },

  /**
   * 上报性能数据
   * POST /api/mobile/report/performance
   */
  reportPerformance: async (performanceData: any) => {
    return await apiClient.post('/api/mobile/report/performance', performanceData);
  },

  /**
   * 检查应用版本
   * GET /api/mobile/version/check
   */
  checkVersion: async (currentVersion: string, platform: string) => {
    return await apiClient.get('/api/mobile/version/check', {
      params: { currentVersion, platform }
    });
  },
};

// ========== 移动端配置（2个）==========

export const mobileConfigAPI = {
  /**
   * 获取移动端配置
   * GET /api/mobile/config/{factoryId}
   */
  getConfig: async (platform?: string, factoryId?: string) => {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return await apiClient.get(`/api/mobile/config/${currentFactoryId}`, {
      params: { platform }
    });
  },

  /**
   * 获取仪表盘数据
   * GET /api/mobile/dashboard/{factoryId}
   */
  getDashboard: async (factoryId?: string) => {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return await apiClient.get(`/api/mobile/dashboard/${currentFactoryId}`);
  },
};

// ========== 统一导出 ==========

export const mobileApiClient = {
  ...deviceActivationAPI,
  ...mobileUploadAPI,
  ...offlineSyncAPI,
  ...pushNotificationAPI,
  ...mobileMonitoringAPI,
  ...mobileConfigAPI,
};

export default mobileApiClient;
