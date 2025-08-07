import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { StorageService } from './storage/storageService';
import { BiometricAuthOptions } from '../types/auth';

export interface BiometricCapabilities {
  isAvailable: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
  isEnrolled: boolean;
  hasHardware: boolean;
  supportsFaceId: boolean;
  supportsFingerprint: boolean;
}

export interface BiometricSettings {
  enabled: boolean;
  lastUsed: string | null;
  failureCount: number;
  lockoutUntil: number | null;
}

export class BiometricManager {
  private static readonly BIOMETRIC_SETTINGS_KEY = 'biometric_settings';
  private static readonly BIOMETRIC_CREDENTIALS_KEY = 'biometric_credentials';
  private static readonly MAX_FAILURES = 3;
  private static readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15分钟

  /**
   * 检查设备生物识别可用性
   */
  static async getCapabilities(): Promise<BiometricCapabilities> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      const supportsFaceId = supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
      const supportsFingerprint = supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

      const isAvailable = hasHardware && isEnrolled && supportedTypes.length > 0;

      return {
        isAvailable,
        supportedTypes,
        isEnrolled,
        hasHardware,
        supportsFaceId,
        supportsFingerprint,
      };
    } catch (error) {
      console.error('Error getting biometric capabilities:', error);
      return {
        isAvailable: false,
        supportedTypes: [],
        isEnrolled: false,
        hasHardware: false,
        supportsFaceId: false,
        supportsFingerprint: false,
      };
    }
  }

  /**
   * 检查生物识别是否可用
   */
  static async isAvailable(): Promise<boolean> {
    const capabilities = await this.getCapabilities();
    return capabilities.isAvailable;
  }

  /**
   * 获取支持的认证类型
   */
  static async getSupportedTypes(): Promise<string[]> {
    try {
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      return supportedTypes.map(type => {
        switch (type) {
          case LocalAuthentication.AuthenticationType.FINGERPRINT:
            return 'fingerprint';
          case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
            return 'face_id';
          case LocalAuthentication.AuthenticationType.IRIS:
            return 'iris';
          default:
            return 'unknown';
        }
      });
    } catch (error) {
      console.error('Error getting supported types:', error);
      return [];
    }
  }

  /**
   * 获取生物识别类型的显示名称
   */
  static async getBiometricTypeDisplayName(): Promise<string> {
    const capabilities = await this.getCapabilities();
    
    if (capabilities.supportsFaceId) {
      return Platform.OS === 'ios' ? 'Face ID' : '面部识别';
    } else if (capabilities.supportsFingerprint) {
      return '指纹识别';
    } else if (capabilities.supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return '虹膜识别';
    } else {
      return '生物识别';
    }
  }

  /**
   * 执行生物识别认证
   */
  static async authenticate(options: BiometricAuthOptions = {}): Promise<boolean> {
    try {
      // 检查是否可用
      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        throw new Error('生物识别不可用');
      }

      // 检查是否被锁定
      const isLocked = await this.isLockedOut();
      if (isLocked) {
        const lockoutInfo = await this.getLockoutInfo();
        throw new Error(`生物识别已锁定，请在 ${lockoutInfo.remainingMinutes} 分钟后重试`);
      }

      // 获取默认提示信息
      const biometricType = await this.getBiometricTypeDisplayName();
      const defaultPrompt = `使用${biometricType}验证身份`;

      // 执行认证
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: options.promptMessage || defaultPrompt,
        cancelLabel: options.cancelButtonText || '取消',
        fallbackLabel: '使用密码',
        disableDeviceFallback: options.disableDeviceFallback || false,
      });

      if (result.success) {
        // 认证成功，重置失败计数
        await this.resetFailureCount();
        await this.updateLastUsed();
        console.log('✅ Biometric authentication successful');
        return true;
      } else if (result.error === 'user_cancel') {
        console.log('👤 Biometric authentication cancelled by user');
        return false;
      } else if (result.error === 'not_available') {
        throw new Error('生物识别功能不可用');
      } else if (result.error === 'not_enrolled') {
        throw new Error('请先在设备设置中启用生物识别');
      } else {
        // 认证失败，增加失败计数
        await this.incrementFailureCount();
        console.log('❌ Biometric authentication failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Biometric authentication error:', error);
      throw error;
    }
  }

  /**
   * 启用生物识别登录
   */
  static async enableBiometricLogin(): Promise<void> {
    try {
      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        throw new Error('设备不支持生物识别或未设置');
      }

      // 执行一次认证确认用户授权
      const authenticated = await this.authenticate({
        promptMessage: '验证生物识别以启用快速登录',
        disableDeviceFallback: false,
      });

      if (!authenticated) {
        throw new Error('生物识别验证失败');
      }

      // 启用生物识别设置
      const settings: BiometricSettings = {
        enabled: true,
        lastUsed: new Date().toISOString(),
        failureCount: 0,
        lockoutUntil: null,
      };

      await this.saveBiometricSettings(settings);
      console.log('✅ Biometric login enabled');
    } catch (error) {
      console.error('❌ Failed to enable biometric login:', error);
      throw error;
    }
  }

  /**
   * 禁用生物识别登录
   */
  static async disableBiometricLogin(): Promise<void> {
    try {
      const settings: BiometricSettings = {
        enabled: false,
        lastUsed: null,
        failureCount: 0,
        lockoutUntil: null,
      };

      await this.saveBiometricSettings(settings);
      await this.clearBiometricCredentials();
      console.log('✅ Biometric login disabled');
    } catch (error) {
      console.error('❌ Failed to disable biometric login:', error);
      throw error;
    }
  }

  /**
   * 检查生物识别登录是否启用
   */
  static async isBiometricLoginEnabled(): Promise<boolean> {
    try {
      const settings = await this.getBiometricSettings();
      return settings.enabled && await this.isAvailable();
    } catch (error) {
      console.error('Error checking biometric login status:', error);
      return false;
    }
  }

  /**
   * 保存生物识别凭据（用于快速登录）
   */
  static async saveBiometricCredentials(credentials: {
    username: string;
    encryptedToken: string;
    deviceInfo?: any;
  }): Promise<void> {
    try {
      const credentialsData = {
        ...credentials,
        savedAt: new Date().toISOString(),
        platform: Platform.OS,
      };

      await StorageService.setSecureItem(
        this.BIOMETRIC_CREDENTIALS_KEY, 
        JSON.stringify(credentialsData)
      );

      console.log('✅ Biometric credentials saved');
    } catch (error) {
      console.error('❌ Failed to save biometric credentials:', error);
      throw error;
    }
  }

  /**
   * 获取生物识别凭据
   */
  static async getBiometricCredentials(): Promise<{
    username: string;
    encryptedToken: string;
    deviceInfo?: any;
    savedAt: string;
    platform: string;
  } | null> {
    try {
      const credentialsData = await StorageService.getSecureItem(this.BIOMETRIC_CREDENTIALS_KEY);
      return credentialsData ? JSON.parse(credentialsData) : null;
    } catch (error) {
      console.error('Error getting biometric credentials:', error);
      return null;
    }
  }

  /**
   * 清除生物识别凭据
   */
  static async clearBiometricCredentials(): Promise<void> {
    try {
      await StorageService.removeSecureItem(this.BIOMETRIC_CREDENTIALS_KEY);
      console.log('✅ Biometric credentials cleared');
    } catch (error) {
      console.error('❌ Failed to clear biometric credentials:', error);
    }
  }

  /**
   * 获取生物识别设置
   */
  private static async getBiometricSettings(): Promise<BiometricSettings> {
    try {
      const settingsData = await StorageService.getItem(this.BIOMETRIC_SETTINGS_KEY);
      if (settingsData) {
        return JSON.parse(settingsData);
      }
      
      // 默认设置
      return {
        enabled: false,
        lastUsed: null,
        failureCount: 0,
        lockoutUntil: null,
      };
    } catch (error) {
      console.error('Error getting biometric settings:', error);
      return {
        enabled: false,
        lastUsed: null,
        failureCount: 0,
        lockoutUntil: null,
      };
    }
  }

  /**
   * 保存生物识别设置
   */
  private static async saveBiometricSettings(settings: BiometricSettings): Promise<void> {
    try {
      await StorageService.setItem(this.BIOMETRIC_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving biometric settings:', error);
      throw error;
    }
  }

  /**
   * 增加失败计数
   */
  private static async incrementFailureCount(): Promise<void> {
    try {
      const settings = await this.getBiometricSettings();
      settings.failureCount += 1;

      // 如果达到最大失败次数，设置锁定时间
      if (settings.failureCount >= this.MAX_FAILURES) {
        settings.lockoutUntil = Date.now() + this.LOCKOUT_DURATION;
        console.log(`⚠️ Biometric locked out for ${this.LOCKOUT_DURATION / 60000} minutes`);
      }

      await this.saveBiometricSettings(settings);
    } catch (error) {
      console.error('Error incrementing failure count:', error);
    }
  }

  /**
   * 重置失败计数
   */
  private static async resetFailureCount(): Promise<void> {
    try {
      const settings = await this.getBiometricSettings();
      settings.failureCount = 0;
      settings.lockoutUntil = null;
      await this.saveBiometricSettings(settings);
    } catch (error) {
      console.error('Error resetting failure count:', error);
    }
  }

  /**
   * 更新最后使用时间
   */
  private static async updateLastUsed(): Promise<void> {
    try {
      const settings = await this.getBiometricSettings();
      settings.lastUsed = new Date().toISOString();
      await this.saveBiometricSettings(settings);
    } catch (error) {
      console.error('Error updating last used:', error);
    }
  }

  /**
   * 检查是否被锁定
   */
  private static async isLockedOut(): Promise<boolean> {
    try {
      const settings = await this.getBiometricSettings();
      if (!settings.lockoutUntil) return false;
      
      const now = Date.now();
      if (now >= settings.lockoutUntil) {
        // 锁定时间已过，清除锁定状态
        await this.resetFailureCount();
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking lockout status:', error);
      return false;
    }
  }

  /**
   * 获取锁定信息
   */
  private static async getLockoutInfo(): Promise<{
    isLocked: boolean;
    lockoutUntil: number | null;
    remainingMinutes: number;
  }> {
    try {
      const settings = await this.getBiometricSettings();
      const isLocked = await this.isLockedOut();
      
      if (!isLocked || !settings.lockoutUntil) {
        return {
          isLocked: false,
          lockoutUntil: null,
          remainingMinutes: 0,
        };
      }
      
      const remainingMs = settings.lockoutUntil - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      
      return {
        isLocked: true,
        lockoutUntil: settings.lockoutUntil,
        remainingMinutes,
      };
    } catch (error) {
      console.error('Error getting lockout info:', error);
      return {
        isLocked: false,
        lockoutUntil: null,
        remainingMinutes: 0,
      };
    }
  }

  /**
   * 获取生物识别状态信息（用于调试和UI显示）
   */
  static async getStatusInfo(): Promise<{
    capabilities: BiometricCapabilities;
    settings: BiometricSettings;
    lockoutInfo: {
      isLocked: boolean;
      lockoutUntil: number | null;
      remainingMinutes: number;
    };
  }> {
    const [capabilities, settings, lockoutInfo] = await Promise.all([
      this.getCapabilities(),
      this.getBiometricSettings(),
      this.getLockoutInfo(),
    ]);

    return {
      capabilities,
      settings,
      lockoutInfo,
    };
  }
}