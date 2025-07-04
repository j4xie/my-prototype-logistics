// 平台检测和信息获取
import type { Platform, PlatformInfo } from '../types/platform';

export function detectPlatform(): Platform {
  // React Native 环境检测
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    return 'mobile';
  }
  
  // Web 环境检测
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return 'web';
  }
  
  // Node.js 或其他环境
  return 'web'; // 默认返回 web
}

export function getPlatformInfo(): PlatformInfo {
  const platform = detectPlatform();
  
  if (platform === 'web') {
    return {
      platform: 'web',
      os: getWebOS(),
      version: getBrowserVersion(),
      isDebug: process.env.NODE_ENV === 'development'
    };
  }
  
  if (platform === 'mobile') {
    return {
      platform: 'mobile',
      os: getMobileOS(),
      version: getMobileVersion(),
      isDebug: __DEV__ || process.env.NODE_ENV === 'development'
    };
  }
  
  return {
    platform: 'web',
    os: 'web',
    version: '1.0.0',
    isDebug: false
  };
}

function getWebOS(): 'windows' | 'macos' | 'linux' | 'web' {
  if (typeof navigator === 'undefined') return 'web';
  
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (userAgent.includes('win')) return 'windows';
  if (userAgent.includes('mac')) return 'macos';
  if (userAgent.includes('linux')) return 'linux';
  
  return 'web';
}

function getBrowserVersion(): string {
  if (typeof navigator === 'undefined') return '1.0.0';
  
  const userAgent = navigator.userAgent;
  
  // Chrome
  let match = userAgent.match(/Chrome\/(\d+\.\d+)/);
  if (match) return `Chrome ${match[1]}`;
  
  // Firefox
  match = userAgent.match(/Firefox\/(\d+\.\d+)/);
  if (match) return `Firefox ${match[1]}`;
  
  // Safari
  match = userAgent.match(/Safari\/(\d+\.\d+)/);
  if (match) return `Safari ${match[1]}`;
  
  return 'Unknown';
}

function getMobileOS(): 'ios' | 'android' {
  if (typeof navigator === 'undefined') return 'ios';
  
  const userAgent = navigator.userAgent || navigator.platform;
  
  if (/android/i.test(userAgent)) return 'android';
  if (/iPad|iPhone|iPod/.test(userAgent)) return 'ios';
  
  return 'ios'; // 默认
}

function getMobileVersion(): string {
  // 在实际的React Native环境中，可以使用react-native-device-info获取版本信息
  try {
    // 动态导入，避免在Web环境中出错
    if (typeof require !== 'undefined') {
      const DeviceInfo = require('react-native-device-info');
      return DeviceInfo.getSystemVersion();
    }
  } catch {
    // 如果获取失败，返回默认值
  }
  
  return '1.0.0';
}

export function isMobile(): boolean {
  return detectPlatform() === 'mobile';
}

export function isWeb(): boolean {
  return detectPlatform() === 'web';
}

export function isIOS(): boolean {
  const info = getPlatformInfo();
  return info.os === 'ios';
}

export function isAndroid(): boolean {
  const info = getPlatformInfo();
  return info.os === 'android';
}

export function isDebug(): boolean {
  return getPlatformInfo().isDebug;
}

// 华为设备检测
export function isHuaweiDevice(): boolean {
  if (!isMobile()) return false;
  
  try {
    // 在React Native环境中检测华为设备
    if (typeof navigator !== 'undefined') {
      const userAgent = navigator.userAgent.toLowerCase();
      return userAgent.includes('huawei') || userAgent.includes('honor');
    }
    
    // 可以通过react-native-device-info进一步检测
    if (typeof require !== 'undefined') {
      const DeviceInfo = require('react-native-device-info');
      const brand = DeviceInfo.getBrand().toLowerCase();
      return brand === 'huawei' || brand === 'honor';
    }
  } catch {
    // 检测失败时返回false
  }
  
  return false;
}

// 获取应用版本信息
export async function getAppVersion(): Promise<string> {
  try {
    if (isMobile() && typeof require !== 'undefined') {
      const DeviceInfo = require('react-native-device-info');
      return DeviceInfo.getVersion();
    }
  } catch {
    // 获取失败时使用默认值
  }
  
  // Web环境或获取失败时的默认版本
  return process.env.REACT_APP_VERSION || '1.0.0';
}

// 获取构建号
export async function getBuildNumber(): Promise<string> {
  try {
    if (isMobile() && typeof require !== 'undefined') {
      const DeviceInfo = require('react-native-device-info');
      return DeviceInfo.getBuildNumber();
    }
  } catch {
    // 获取失败时使用默认值
  }
  
  return process.env.REACT_APP_BUILD_NUMBER || '1';
}