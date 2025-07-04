// 平台能力适配器
import type { PlatformCapabilities, DeviceInfo, NetworkInfo, LocationInfo } from '../types/platform';
import { detectPlatform, getPlatformInfo } from './platform';
import { logger } from './logger';

class WebCapabilities implements Partial<PlatformCapabilities> {
  async getDeviceInfo(): Promise<DeviceInfo> {
    const platformInfo = getPlatformInfo();
    
    return {
      deviceId: this.generateDeviceId(),
      deviceName: navigator.userAgent || 'Web Browser',
      brand: 'Web',
      model: navigator.platform || 'Browser',
      systemVersion: platformInfo.version,
      appVersion: process.env.REACT_APP_VERSION || '1.0.0',
      buildNumber: process.env.REACT_APP_BUILD_NUMBER || '1'
    };
  }

  async getNetworkInfo(): Promise<NetworkInfo> {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    return {
      type: connection?.effectiveType === '4g' ? 'wifi' : 'ethernet',
      isConnected: navigator.onLine,
      isInternetReachable: navigator.onLine,
      details: {
        strength: connection?.downlink || 0,
      }
    };
  }

  async getCurrentLocation(): Promise<LocationInfo> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude || undefined,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
            speed: position.coords.speed || undefined,
            heading: position.coords.heading || undefined
          });
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  async openUrl(url: string): Promise<void> {
    window.open(url, '_blank');
  }

  async share(content: { title?: string; message?: string; url?: string }): Promise<void> {
    if (navigator.share) {
      await navigator.share({
        title: content.title,
        text: content.message,
        url: content.url
      });
    } else {
      // 回退到复制到剪贴板
      const text = `${content.title || ''}\n${content.message || ''}\n${content.url || ''}`.trim();
      await navigator.clipboard.writeText(text);
      logger.info('Content copied to clipboard');
    }
  }

  private generateDeviceId(): string {
    // 在Web环境中生成一个稳定的设备ID
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = 'web_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }
}

class MobileCapabilities implements Partial<PlatformCapabilities> {
  async getDeviceInfo(): Promise<DeviceInfo> {
    try {
      const DeviceInfo = await import('react-native-device-info');
      
      return {
        deviceId: await DeviceInfo.default.getUniqueId(),
        deviceName: await DeviceInfo.default.getDeviceName(),
        brand: DeviceInfo.default.getBrand(),
        model: DeviceInfo.default.getModel(),
        systemVersion: DeviceInfo.default.getSystemVersion(),
        appVersion: DeviceInfo.default.getVersion(),
        buildNumber: DeviceInfo.default.getBuildNumber()
      };
    } catch (error) {
      logger.warn('Failed to get device info:', error);
      return {
        deviceId: 'mobile_unknown',
        deviceName: 'Mobile Device',
        brand: 'Unknown',
        model: 'Unknown',
        systemVersion: '1.0.0',
        appVersion: '1.0.0',
        buildNumber: '1'
      };
    }
  }

  async getNetworkInfo(): Promise<NetworkInfo> {
    try {
      const NetInfo = await import('@react-native-netinfo/netinfo');
      const state = await NetInfo.default.fetch();
      
      return {
        type: state.type as any,
        isConnected: state.isConnected || false,
        isInternetReachable: state.isInternetReachable || false,
        details: {
          strength: state.details?.strength,
          ipAddress: state.details?.ipAddress,
          subnet: state.details?.subnet,
          carrier: (state.details as any)?.carrier
        }
      };
    } catch (error) {
      logger.warn('Failed to get network info:', error);
      return {
        type: 'unknown',
        isConnected: true,
        isInternetReachable: true
      };
    }
  }

  async getCurrentLocation(): Promise<LocationInfo> {
    try {
      const Geolocation = await import('react-native-geolocation-service');
      
      return new Promise((resolve, reject) => {
        Geolocation.default.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              altitude: position.coords.altitude || undefined,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp,
              speed: position.coords.speed || undefined,
              heading: position.coords.heading || undefined
            });
          },
          (error) => reject(error),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      });
    } catch (error) {
      logger.warn('Failed to get location:', error);
      throw error;
    }
  }

  async openCamera(options: any): Promise<string> {
    try {
      const ImagePicker = await import('react-native-image-picker');
      
      return new Promise((resolve, reject) => {
        const pickerOptions = {
          mediaType: options.mediaType || 'photo',
          quality: options.quality === 'high' ? 1 : options.quality === 'medium' ? 0.7 : 0.5,
          maxWidth: options.maxWidth,
          maxHeight: options.maxHeight
        };

        ImagePicker.default.launchCamera(pickerOptions, (response) => {
          if (response.didCancel || response.errorMessage) {
            reject(new Error(response.errorMessage || 'User cancelled'));
          } else if (response.assets && response.assets[0]) {
            resolve(response.assets[0].uri!);
          } else {
            reject(new Error('No image selected'));
          }
        });
      });
    } catch (error) {
      logger.warn('Failed to open camera:', error);
      throw error;
    }
  }

  async requestPushPermissions(): Promise<boolean> {
    try {
      const messaging = await import('@react-native-firebase/messaging');
      const authStatus = await messaging.default().requestPermission();
      
      return authStatus === messaging.default.AuthorizationStatus.AUTHORIZED ||
             authStatus === messaging.default.AuthorizationStatus.PROVISIONAL;
    } catch (error) {
      logger.warn('Failed to request push permissions:', error);
      return false;
    }
  }

  async openUrl(url: string): Promise<void> {
    try {
      const { Linking } = await import('react-native');
      await Linking.openURL(url);
    } catch (error) {
      logger.warn('Failed to open URL:', error);
      throw error;
    }
  }

  async share(content: { title?: string; message?: string; url?: string }): Promise<void> {
    try {
      const { Share } = await import('react-native');
      await Share.share({
        title: content.title,
        message: content.message || content.url || '',
        url: content.url
      });
    } catch (error) {
      logger.warn('Failed to share content:', error);
      throw error;
    }
  }

  async isBiometricAvailable(): Promise<boolean> {
    try {
      const TouchID = await import('react-native-touch-id');
      const biometryType = await TouchID.default.isSupported();
      return biometryType !== false;
    } catch (error) {
      logger.warn('Biometric not available:', error);
      return false;
    }
  }

  async authenticateWithBiometric(options: any): Promise<boolean> {
    try {
      const TouchID = await import('react-native-touch-id');
      await TouchID.default.authenticate(options.reason, {
        fallbackLabel: options.fallbackLabel,
        cancelLabel: options.cancelLabel,
        disableDeviceFallback: options.disableDeviceFallback
      });
      return true;
    } catch (error) {
      logger.warn('Biometric authentication failed:', error);
      return false;
    }
  }
}

export function createPlatformCapabilities(platform: 'web' | 'mobile' | 'auto' = 'auto'): Partial<PlatformCapabilities> {
  const detectedPlatform = platform === 'auto' ? detectPlatform() : platform;
  
  if (detectedPlatform === 'mobile') {
    return new MobileCapabilities();
  }
  
  return new WebCapabilities();
}

// 默认平台能力实例
export const platformCapabilities = createPlatformCapabilities('auto');