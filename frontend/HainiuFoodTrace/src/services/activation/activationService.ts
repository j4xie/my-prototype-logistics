import { StorageService } from '../storage/storageService';
import { apiClient } from '../api/apiClient';

export interface ActivationStatus {
  isActivated: boolean;
  activationCode?: string;
  activatedAt?: string;
  deviceId: string;
  appVersion: string;
}

export interface ActivationRequest {
  activationCode: string;
  deviceInfo: {
    deviceId: string;
    deviceModel: string;
    osVersion: string;
    appVersion: string;
    platform: 'ios' | 'android';
  };
}

export class ActivationService {
  private static readonly ACTIVATION_KEY = 'app_activation_status';
  private static readonly DEVICE_ID_KEY = 'device_id';

  /**
   * 检查应用激活状态
   */
  static async checkActivationStatus(): Promise<ActivationStatus> {
    try {
      const storedStatus = await StorageService.getSecureItem(this.ACTIVATION_KEY);
      const deviceId = await this.getOrCreateDeviceId();

      if (storedStatus) {
        const status: ActivationStatus = JSON.parse(storedStatus);
        return {
          ...status,
          deviceId,
        };
      }

      return {
        isActivated: false,
        deviceId,
        appVersion: '1.0.0',
      };
    } catch (error) {
      console.error('检查激活状态失败:', error);
      return {
        isActivated: false,
        deviceId: await this.getOrCreateDeviceId(),
        appVersion: '1.0.0',
      };
    }
  }

  /**
   * 激活应用
   */
  static async activateApp(activationCode: string): Promise<{
    success: boolean;
    message: string;
    data?: ActivationStatus;
  }> {
    try {
      const deviceId = await this.getOrCreateDeviceId();
      const deviceInfo = await this.getDeviceInfo();

      const activationRequest: ActivationRequest = {
        activationCode,
        deviceInfo: {
          ...deviceInfo,
          deviceId,
        },
      };

      // 调用后端激活API
      const response = await apiClient.post<{
        success: boolean;
        message: string;
        data?: any;
      }>('/mobile/activation/activate', activationRequest);

      if (response.success) {
        const activationStatus: ActivationStatus = {
          isActivated: true,
          activationCode,
          activatedAt: new Date().toISOString(),
          deviceId,
          appVersion: deviceInfo.appVersion,
        };

        // 保存激活状态到安全存储
        await StorageService.setSecureItem(
          this.ACTIVATION_KEY,
          JSON.stringify(activationStatus)
        );

        return {
          success: true,
          message: '应用激活成功',
          data: activationStatus,
        };
      }

      return {
        success: false,
        message: response.message || '激活失败',
      };
    } catch (error) {
      console.error('应用激活失败:', error);
      return {
        success: false,
        message: '网络错误，请稍后重试',
      };
    }
  }

  /**
   * 验证激活状态（与服务器同步）
   */
  static async validateActivation(): Promise<boolean> {
    try {
      const status = await this.checkActivationStatus();
      
      if (!status.isActivated || !status.activationCode) {
        return false;
      }

      // 与服务器验证激活状态
      const response = await apiClient.post<{
        success: boolean;
        isValid: boolean;
      }>('/mobile/activation/validate', {
        activationCode: status.activationCode,
        deviceId: status.deviceId,
      });

      return response.success && response.isValid;
    } catch (error) {
      console.error('验证激活状态失败:', error);
      return false;
    }
  }

  /**
   * 重置激活状态
   */
  static async resetActivation(): Promise<void> {
    try {
      await StorageService.removeSecureItem(this.ACTIVATION_KEY);
    } catch (error) {
      console.error('重置激活状态失败:', error);
    }
  }

  /**
   * 获取或创建设备ID
   */
  private static async getOrCreateDeviceId(): Promise<string> {
    try {
      let deviceId = await StorageService.getSecureItem(this.DEVICE_ID_KEY);
      
      if (!deviceId) {
        // 生成新的设备ID
        deviceId = this.generateDeviceId();
        await StorageService.setSecureItem(this.DEVICE_ID_KEY, deviceId);
      }

      return deviceId;
    } catch (error) {
      console.error('获取设备ID失败:', error);
      return this.generateDeviceId();
    }
  }

  /**
   * 生成设备ID
   */
  private static generateDeviceId(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    return `mobile_${timestamp}_${random}`;
  }

  /**
   * 获取设备信息
   */
  private static async getDeviceInfo() {
    // 在实际项目中，这里会使用expo-device等库获取真实设备信息
    return {
      deviceModel: 'Unknown Device',
      osVersion: 'Unknown OS',
      appVersion: '1.0.0',
      platform: 'android' as const,
    };
  }
}