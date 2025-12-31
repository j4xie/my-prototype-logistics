import { apiClient } from './apiClient';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { logger } from '../../utils/logger';
import { useAuthStore } from '../../store/authStore';

const deviceLogger = logger.createContextLogger('DeviceAPI');

/**
 * 设备注册信息
 */
export interface DeviceRegistration {
  pushToken: string;
  platform: 'ios' | 'android';
  deviceId: string;
  deviceName?: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
}

/**
 * 设备注册响应
 */
export interface DeviceRegistrationResponse {
  success: boolean;
  message?: string;
  data?: {
    deviceId: string;
    registeredAt: string;
  };
}

/**
 * 设备 API 客户端
 */
class DeviceApiClient {
  /**
   * 注册设备到后端
   * @param pushToken - Expo Push Token
   * @returns 注册结果
   */
  async registerDevice(pushToken: string): Promise<DeviceRegistrationResponse> {
    try {
      const factoryId = this.getFactoryId();
      if (!factoryId) {
        throw new Error('未找到工厂 ID，无法注册设备');
      }

      const registration: DeviceRegistration = {
        pushToken,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        deviceId: await this.getDeviceId(),
        deviceName: Device.deviceName || undefined,
        deviceModel: Device.modelName || undefined,
        osVersion: Device.osVersion || undefined,
        appVersion: Device.osVersion || undefined,
      };

      deviceLogger.info('注册设备到后端', {
        factoryId,
        platform: registration.platform,
        deviceId: registration.deviceId,
      });

      const response = await apiClient.post<DeviceRegistrationResponse>(
        `/api/mobile/${factoryId}/devices/register`,
        registration
      );

      if (response.success) {
        deviceLogger.info('设备注册成功');
      } else {
        deviceLogger.error('设备注册失败', { message: response.message });
      }

      return response;
    } catch (error) {
      deviceLogger.error('设备注册请求失败', error);
      throw error;
    }
  }

  /**
   * 注销设备（登出时）
   */
  async unregisterDevice(): Promise<void> {
    try {
      const factoryId = this.getFactoryId();
      if (!factoryId) {
        deviceLogger.warn('未找到工厂 ID，跳过设备注销');
        return;
      }

      const deviceId = await this.getDeviceId();

      deviceLogger.info('注销设备', { factoryId, deviceId });

      await apiClient.delete(`/api/mobile/${factoryId}/devices/unregister`, {
        params: { deviceId },
      });

      deviceLogger.info('设备注销成功');
    } catch (error) {
      deviceLogger.error('设备注销失败', error);
      // 注销失败不抛出错误，避免阻塞登出流程
    }
  }

  /**
   * 更新设备 Token（Token 刷新时）
   * @param newToken - 新的 Push Token
   */
  async updateDeviceToken(newToken: string): Promise<void> {
    try {
      const factoryId = this.getFactoryId();
      if (!factoryId) {
        throw new Error('未找到工厂 ID，无法更新 Token');
      }

      const deviceId = await this.getDeviceId();

      deviceLogger.info('更新设备 Token', { factoryId, deviceId });

      await apiClient.put(`/api/mobile/${factoryId}/devices/token`, {
        deviceId,
        pushToken: newToken,
      });

      deviceLogger.info('设备 Token 更新成功');
    } catch (error) {
      deviceLogger.error('设备 Token 更新失败', error);
      throw error;
    }
  }

  /**
   * 获取设备的通知历史
   * @param limit - 返回数量限制
   */
  async getNotificationHistory(limit: number = 20): Promise<any[]> {
    try {
      const factoryId = this.getFactoryId();
      if (!factoryId) {
        throw new Error('未找到工厂 ID');
      }

      const deviceId = await this.getDeviceId();

      const response = await apiClient.get<{ success: boolean; data: any[] }>(
        `/api/mobile/${factoryId}/devices/${deviceId}/notifications`,
        { params: { limit } }
      );

      return response.data || [];
    } catch (error) {
      deviceLogger.error('获取通知历史失败', error);
      return [];
    }
  }

  /**
   * 标记通知为已读
   * @param notificationId - 通知 ID
   */
  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      const factoryId = this.getFactoryId();
      if (!factoryId) return;

      await apiClient.put(
        `/api/mobile/${factoryId}/devices/notifications/${notificationId}/read`
      );

      deviceLogger.debug('通知已标记为已读', { notificationId });
    } catch (error) {
      deviceLogger.error('标记通知失败', error);
    }
  }

  /**
   * 获取工厂 ID（从 AuthStore）
   */
  private getFactoryId(): string | null {
    const user = useAuthStore.getState().user;
    if (!user) return null;

    if (user.userType === 'factory' && 'factoryUser' in user) {
      return user.factoryUser.factoryId;
    }

    // 平台用户可能需要其他逻辑
    return null;
  }

  /**
   * 获取设备唯一 ID
   */
  private async getDeviceId(): Promise<string> {
    // 使用 expo-device 获取设备 ID
    // 注意：在不同平台上，设备 ID 的获取方式不同
    const deviceId = Device.osBuildId || Device.osInternalBuildId || 'unknown';
    return deviceId;
  }
}

export const deviceAPI = new DeviceApiClient();
