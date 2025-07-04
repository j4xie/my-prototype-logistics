// 平台检测工具
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

export interface PlatformInfo {
  isHuawei: boolean;
  isGoogle: boolean;
  isIOS: boolean;
  brand: string;
  model: string;
  systemVersion: string;
  capabilities: PlatformCapabilities;
}

export interface PlatformCapabilities {
  hasGoogleServices: boolean;
  hasHuaweiServices: boolean;
  hasNotifications: boolean;
  hasLocation: boolean;
  hasCamera: boolean;
  hasNFC: boolean;
}

class PlatformDetector {
  private static instance: PlatformDetector;
  private platformInfo: PlatformInfo | null = null;

  public static getInstance(): PlatformDetector {
    if (!PlatformDetector.instance) {
      PlatformDetector.instance = new PlatformDetector();
    }
    return PlatformDetector.instance;
  }

  public async getPlatformInfo(): Promise<PlatformInfo> {
    if (this.platformInfo) {
      return this.platformInfo;
    }

    try {
      const brand = await DeviceInfo.getBrand();
      const model = await DeviceInfo.getModel();
      const systemVersion = await DeviceInfo.getSystemVersion();
      
      const isHuawei = this.isHuaweiDevice(brand);
      const isGoogle = !isHuawei && Platform.OS === 'android';
      const isIOS = Platform.OS === 'ios';

      const capabilities = await this.detectCapabilities(isHuawei, isGoogle, isIOS);

      this.platformInfo = {
        isHuawei,
        isGoogle,
        isIOS,
        brand,
        model,
        systemVersion,
        capabilities
      };

      return this.platformInfo;
    } catch (error) {
      console.error('Failed to detect platform info:', error);
      
      // 返回默认值
      return {
        isHuawei: false,
        isGoogle: Platform.OS === 'android',
        isIOS: Platform.OS === 'ios',
        brand: 'Unknown',
        model: 'Unknown',
        systemVersion: 'Unknown',
        capabilities: {
          hasGoogleServices: Platform.OS === 'android',
          hasHuaweiServices: false,
          hasNotifications: true,
          hasLocation: true,
          hasCamera: true,
          hasNFC: false
        }
      };
    }
  }

  private isHuaweiDevice(brand: string): boolean {
    const huaweiBrands = [
      'HUAWEI',
      'HONOR',
      '华为',
      '荣耀'
    ];
    
    return huaweiBrands.some(huaweiBrand => 
      brand.toUpperCase().includes(huaweiBrand.toUpperCase())
    );
  }

  private async detectCapabilities(
    isHuawei: boolean, 
    isGoogle: boolean, 
    isIOS: boolean
  ): Promise<PlatformCapabilities> {
    const capabilities: PlatformCapabilities = {
      hasGoogleServices: false,
      hasHuaweiServices: false,
      hasNotifications: true,
      hasLocation: true,
      hasCamera: true,
      hasNFC: false
    };

    try {
      if (isIOS) {
        capabilities.hasGoogleServices = false;
        capabilities.hasHuaweiServices = false;
        capabilities.hasNFC = await this.checkNFCSupport();
      } else if (isHuawei) {
        capabilities.hasHuaweiServices = await this.checkHuaweiServices();
        capabilities.hasGoogleServices = false; // 华为设备通常没有Google服务
        capabilities.hasNFC = await this.checkNFCSupport();
      } else if (isGoogle) {
        capabilities.hasGoogleServices = await this.checkGoogleServices();
        capabilities.hasHuaweiServices = false;
        capabilities.hasNFC = await this.checkNFCSupport();
      }

      return capabilities;
    } catch (error) {
      console.error('Failed to detect capabilities:', error);
      return capabilities;
    }
  }

  private async checkGoogleServices(): Promise<boolean> {
    try {
      // 在真实环境中检测Google Play Services
      // const isAvailable = await GoogleSignin.hasPlayServices();
      // return isAvailable;
      return Platform.OS === 'android'; // 模拟检测
    } catch (error) {
      return false;
    }
  }

  private async checkHuaweiServices(): Promise<boolean> {
    try {
      // 在真实环境中检测HMS Core
      // const isAvailable = await HmsInstanceId.getHmsInstanceId().isHmsAvailable();
      // return isAvailable;
      return false; // 模拟检测
    } catch (error) {
      return false;
    }
  }

  private async checkNFCSupport(): Promise<boolean> {
    try {
      const hasNFC = await DeviceInfo.hasNfc();
      return hasNFC;
    } catch (error) {
      return false;
    }
  }

  public async getOptimalPushService(): Promise<'fcm' | 'hms' | 'apns' | 'none'> {
    const platformInfo = await this.getPlatformInfo();
    
    if (platformInfo.isIOS) {
      return 'apns';
    } else if (platformInfo.isHuawei && platformInfo.capabilities.hasHuaweiServices) {
      return 'hms';
    } else if (platformInfo.isGoogle && platformInfo.capabilities.hasGoogleServices) {
      return 'fcm';
    } else {
      return 'none';
    }
  }

  public async getOptimalMapService(): Promise<'google' | 'huawei' | 'apple' | 'none'> {
    const platformInfo = await this.getPlatformInfo();
    
    if (platformInfo.isIOS) {
      return 'apple';
    } else if (platformInfo.isHuawei && platformInfo.capabilities.hasHuaweiServices) {
      return 'huawei';
    } else if (platformInfo.isGoogle && platformInfo.capabilities.hasGoogleServices) {
      return 'google';
    } else {
      return 'none';
    }
  }

  public async getOptimalAnalyticsService(): Promise<'firebase' | 'hms' | 'none'> {
    const platformInfo = await this.getPlatformInfo();
    
    if (platformInfo.isHuawei && platformInfo.capabilities.hasHuaweiServices) {
      return 'hms';
    } else if (platformInfo.capabilities.hasGoogleServices) {
      return 'firebase';
    } else {
      return 'none';
    }
  }

  public async shouldUseHMSServices(): Promise<boolean> {
    const platformInfo = await this.getPlatformInfo();
    return platformInfo.isHuawei && platformInfo.capabilities.hasHuaweiServices;
  }

  public async shouldUseGoogleServices(): Promise<boolean> {
    const platformInfo = await this.getPlatformInfo();
    return !platformInfo.isHuawei && platformInfo.capabilities.hasGoogleServices;
  }
}

// 导出单例实例
export const platformDetector = PlatformDetector.getInstance();

// 便捷函数
export const getPlatformInfo = () => platformDetector.getPlatformInfo();
export const getOptimalPushService = () => platformDetector.getOptimalPushService();
export const getOptimalMapService = () => platformDetector.getOptimalMapService();
export const getOptimalAnalyticsService = () => platformDetector.getOptimalAnalyticsService();
export const shouldUseHMSServices = () => platformDetector.shouldUseHMSServices();
export const shouldUseGoogleServices = () => platformDetector.shouldUseGoogleServices();