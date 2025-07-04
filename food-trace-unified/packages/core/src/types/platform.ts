// 平台相关类型定义
export type Platform = 'web' | 'mobile' | 'desktop';

export interface PlatformInfo {
  platform: Platform;
  os: 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'web';
  version: string;
  isDebug: boolean;
}

export interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  clear: () => Promise<void>;
  getAllKeys: () => Promise<string[]>;
}

export interface LoggerAdapter {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

export interface NavigationAdapter {
  navigate: (route: string, params?: any) => void;
  goBack: () => void;
  canGoBack: () => boolean;
  reset: (routes: any[]) => void;
}

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  brand: string;
  model: string;
  systemVersion: string;
  appVersion: string;
  buildNumber: string;
}

export interface NetworkInfo {
  type: 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';
  isConnected: boolean;
  isInternetReachable: boolean;
  details?: {
    strength?: number;
    ipAddress?: string;
    subnet?: string;
    carrier?: string;
  };
}

export interface LocationInfo {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  heading?: number;
}

export interface CameraOptions {
  mediaType: 'photo' | 'video';
  quality: 'low' | 'medium' | 'high';
  allowsEditing?: boolean;
  aspectRatio?: [number, number];
  maxWidth?: number;
  maxHeight?: number;
}

export interface FilePickerOptions {
  mediaTypes: 'images' | 'videos' | 'all';
  allowsMultipleSelection?: boolean;
  quality?: number;
  maxFileSize?: number;
}

export interface PushNotificationData {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  badge?: number;
  category?: string;
}

export interface BiometricOptions {
  reason: string;
  fallbackLabel?: string;
  disableDeviceFallback?: boolean;
  cancelLabel?: string;
}

// 平台能力接口
export interface PlatformCapabilities {
  storage: StorageAdapter;
  logger: LoggerAdapter;
  navigation?: NavigationAdapter;
  
  // 设备信息
  getDeviceInfo: () => Promise<DeviceInfo>;
  getNetworkInfo: () => Promise<NetworkInfo>;
  
  // 定位服务
  getCurrentLocation?: () => Promise<LocationInfo>;
  watchLocation?: (callback: (location: LocationInfo) => void) => () => void;
  
  // 相机和文件
  openCamera?: (options: CameraOptions) => Promise<string>;
  openFilePicker?: (options: FilePickerOptions) => Promise<string[]>;
  
  // 推送通知
  requestPushPermissions?: () => Promise<boolean>;
  sendLocalNotification?: (data: PushNotificationData) => Promise<void>;
  
  // 生物识别
  isBiometricAvailable?: () => Promise<boolean>;
  authenticateWithBiometric?: (options: BiometricOptions) => Promise<boolean>;
  
  // 应用状态
  openUrl?: (url: string) => Promise<void>;
  share?: (content: { title?: string; message?: string; url?: string }) => Promise<void>;
  
  // 键盘和输入
  hideKeyboard?: () => void;
  showKeyboard?: () => void;
}

// 环境变量
export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  API_BASE_URL: string;
  API_TIMEOUT: number;
  ENABLE_MOCKS: boolean;
  ENABLE_DEVTOOLS: boolean;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
}