import { apiClient } from './apiClient';

/**
 * 设备激活管理API客户端 - Phase 1必需
 * 总计3个API - 路径：/api/mobile/activation/* 和 /api/mobile/devices/*
 *
 * 业务场景：
 * 1. 首次使用时通过激活码激活设备
 * 2. 管理用户已绑定的设备列表
 * 3. 解绑不再使用的设备
 */

// ========== 类型定义 ==========

export interface DeviceInfo {
  deviceId: string;
  deviceModel?: string;
  deviceType?: string;
  platform?: string;
  osVersion?: string;
  appVersion?: string;
  manufacturer?: string;
  carrier?: string;
  networkType?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
}

export interface ActivationRequest {
  activationCode: string;
  deviceInfo: DeviceInfo;
}

export interface ActivationResponse {
  success: boolean;
  activatedAt: string;
  configuration?: any;
  factoryId?: string;
  factoryName?: string;
  features?: string[];
  validUntil?: string;
}

export interface UserDevice {
  id: string;
  deviceId: string;
  deviceModel?: string;
  platform?: string;
  osVersion?: string;
  appVersion?: string;
  lastActiveAt: string;
  isActive: boolean;
  createdAt: string;
}

// ========== API客户端类 ==========

class ActivationApiClient {
  /**
   * 1. 设备激活
   * POST /api/mobile/activation/activate
   *
   * 使用激活码激活移动设备，首次使用时必需
   */
  async activateDevice(request: ActivationRequest): Promise<ActivationResponse> {
    // apiClient拦截器已统一返回data
    return await apiClient.post<ActivationResponse>('/api/mobile/activation/activate', request);
  }

  /**
   * 2. 获取用户设备列表
   * GET /api/mobile/devices
   *
   * 获取当前用户已绑定的所有设备
   */
  async getUserDevices(): Promise<UserDevice[]> {
    // apiClient拦截器已统一返回data
    return await apiClient.get<UserDevice[]>('/api/mobile/devices');
  }

  /**
   * 3. 移除设备
   * DELETE /api/mobile/devices/{deviceId}
   *
   * 解绑指定的设备
   */
  async removeDevice(deviceId: string): Promise<void> {
    await apiClient.delete(`/api/mobile/devices/${deviceId}`);
  }
}

export const activationApiClient = new ActivationApiClient();
export default activationApiClient;
