/**
 * 平台相关类型定义
 * 支持Web、React Native等不同平台的类型抽象
 */

/**
 * 平台类型
 */
export type Platform = 'web' | 'ios' | 'android' | 'windows' | 'macos' | 'linux';

/**
 * 平台信息
 */
export interface PlatformInfo {
  platform: Platform;
  version: string;
  isWeb: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  isNative: boolean;
  userAgent?: string;
  deviceType?: 'phone' | 'tablet' | 'desktop';
  screenSize?: {
    width: number;
    height: number;
    scale: number;
  };
}

/**
 * 网络信息
 */
export interface NetworkInfo {
  isConnected: boolean;
  type?: 'wifi' | 'cellular' | 'ethernet' | 'bluetooth' | 'unknown';
  isInternetReachable?: boolean;
  connectionQuality?: 'poor' | 'moderate' | 'good' | 'excellent';
  effectiveType?: '2g' | '3g' | '4g' | '5g';
  downlink?: number;
  rtt?: number;
}

/**
 * 设备信息
 */
export interface DeviceInfo {
  deviceId: string;
  deviceName?: string;
  model?: string;
  brand?: string;
  manufacturer?: string;
  osVersion?: string;
  appVersion?: string;
  buildNumber?: string;
  isEmulator?: boolean;
  hasNotch?: boolean;
  hasDynamicIsland?: boolean;
  batteryLevel?: number;
  isCharging?: boolean;
  storageTotal?: number;
  storageAvailable?: number;
  memoryTotal?: number;
  memoryAvailable?: number;
}

/**
 * 位置信息
 */
export interface LocationInfo {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

/**
 * 位置权限状态
 */
export type LocationPermission = 'granted' | 'denied' | 'restricted' | 'undetermined';

/**
 * 推送通知权限状态
 */
export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

/**
 * 相机权限状态
 */
export type CameraPermission = 'granted' | 'denied' | 'restricted' | 'undetermined';

/**
 * 存储权限状态
 */
export type StoragePermission = 'granted' | 'denied' | 'restricted' | 'undetermined';

/**
 * 权限状态集合
 */
export interface PermissionStatus {
  location: LocationPermission;
  notification: NotificationPermission;
  camera: CameraPermission;
  storage: StoragePermission;
  microphone?: CameraPermission;
  photos?: StoragePermission;
}

/**
 * 文件选择器选项
 */
export interface FilePickerOptions {
  multiple?: boolean;
  mediaType?: 'photo' | 'video' | 'mixed' | 'document';
  quality?: number; // 0-1
  maxWidth?: number;
  maxHeight?: number;
  allowsEditing?: boolean;
  includeBase64?: boolean;
  includeExtra?: boolean;
}

/**
 * 文件选择器结果
 */
export interface FilePickerResult {
  canceled: boolean;
  assets?: FileAsset[];
}

/**
 * 文件资源
 */
export interface FileAsset {
  uri: string;
  name?: string;
  type?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
  base64?: string;
  exif?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * 相机选项
 */
export interface CameraOptions {
  mediaType?: 'photo' | 'video';
  quality?: number; // 0-1
  maxWidth?: number;
  maxHeight?: number;
  allowsEditing?: boolean;
  cameraType?: 'front' | 'back';
  flashMode?: 'off' | 'on' | 'auto';
  videoQuality?: 'low' | 'medium' | 'high';
  videoDuration?: number;
}

/**
 * 分享选项
 */
export interface ShareOptions {
  title?: string;
  message?: string;
  url?: string;
  urls?: string[];
  type?: string;
  filename?: string;
  excludedActivityTypes?: string[];
  failOnCancel?: boolean;
}

/**
 * 分享结果
 */
export interface ShareResult {
  success: boolean;
  activityType?: string;
  error?: string;
}

/**
 * 本地通知选项
 */
export interface LocalNotificationOptions {
  title: string;
  body: string;
  sound?: boolean | string;
  badge?: number;
  data?: any;
  channelId?: string;
  priority?: 'min' | 'low' | 'default' | 'high' | 'max';
  color?: string;
  largeIcon?: string;
  smallIcon?: string;
  actions?: NotificationAction[];
  category?: string;
  trigger?: NotificationTrigger;
}

/**
 * 通知操作
 */
export interface NotificationAction {
  id: string;
  title: string;
  destructive?: boolean;
  authenticationRequired?: boolean;
  foreground?: boolean;
  icon?: string;
}

/**
 * 通知触发器
 */
export interface NotificationTrigger {
  type: 'timeInterval' | 'calendar' | 'location';
  seconds?: number;
  repeats?: boolean;
  dateComponents?: {
    year?: number;
    month?: number;
    day?: number;
    hour?: number;
    minute?: number;
    second?: number;
    weekday?: number;
  };
  region?: {
    latitude: number;
    longitude: number;
    radius: number;
    identifier: string;
    notifyOnEntry?: boolean;
    notifyOnExit?: boolean;
  };
}

/**
 * 生物识别类型
 */
export type BiometricType = 'fingerprint' | 'face' | 'iris' | 'voice';

/**
 * 生物识别选项
 */
export interface BiometricOptions {
  title?: string;
  subtitle?: string;
  description?: string;
  fallbackLabel?: string;
  negativeLabel?: string;
  disableDeviceFallback?: boolean;
}

/**
 * 生物识别结果
 */
export interface BiometricResult {
  success: boolean;
  error?: string;
  biometryType?: BiometricType;
}

/**
 * 应用状态
 */
export type AppState = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';

/**
 * 应用状态变化事件
 */
export interface AppStateChangeEvent {
  appState: AppState;
  previousState?: AppState;
  timestamp: number;
}

/**
 * 键盘信息
 */
export interface KeyboardInfo {
  height: number;
  duration?: number;
  easing?: string;
}

/**
 * 方向信息
 */
export type Orientation = 'portrait' | 'landscape' | 'portraitUpsideDown' | 'landscapeLeft' | 'landscapeRight';

/**
 * 方向变化事件
 */
export interface OrientationChangeEvent {
  orientation: Orientation;
  previousOrientation?: Orientation;
  timestamp: number;
}

/**
 * 深度链接信息
 */
export interface DeepLinkInfo {
  url: string;
  scheme?: string;
  host?: string;
  path?: string;
  queryParams?: Record<string, string>;
  fragment?: string;
}

/**
 * 剪贴板选项
 */
export interface ClipboardOptions {
  type?: 'plain' | 'html' | 'image';
}

/**
 * 振动模式
 */
export type VibrationPattern = number | number[];

/**
 * 触觉反馈类型
 */
export type HapticFeedbackType = 
  | 'impactLight' 
  | 'impactMedium' 
  | 'impactHeavy' 
  | 'notificationSuccess' 
  | 'notificationWarning' 
  | 'notificationError'
  | 'selection';

/**
 * 存储选项
 */
export interface StorageOptions {
  encrypt?: boolean;
  group?: string;
  synchronize?: boolean;
  accessible?: 'AccessibleWhenUnlocked' | 'AccessibleAfterFirstUnlock' | 'AccessibleAlways';
}

/**
 * 网络请求类型
 */
export interface NetworkRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

/**
 * 网络响应类型
 */
export interface NetworkResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  url: string;
}

/**
 * 平台API接口
 */
export interface IPlatformApi {
  // 设备信息
  getDeviceInfo(): Promise<DeviceInfo>;
  getPlatformInfo(): PlatformInfo;
  
  // 网络状态
  getNetworkInfo(): Promise<NetworkInfo>;
  onNetworkStateChange(callback: (info: NetworkInfo) => void): () => void;
  
  // 位置服务
  getCurrentLocation(options?: LocationOptions): Promise<LocationInfo>;
  watchLocation(callback: (location: LocationInfo) => void, options?: LocationOptions): () => void;
  requestLocationPermission(): Promise<LocationPermission>;
  
  // 权限管理
  checkPermission(permission: keyof PermissionStatus): Promise<string>;
  requestPermission(permission: keyof PermissionStatus): Promise<string>;
  openSettings(): Promise<void>;
  
  // 文件操作
  pickFile(options?: FilePickerOptions): Promise<FilePickerResult>;
  takePhoto(options?: CameraOptions): Promise<FilePickerResult>;
  takeVideo(options?: CameraOptions): Promise<FilePickerResult>;
  
  // 分享功能
  share(options: ShareOptions): Promise<ShareResult>;
  
  // 通知
  scheduleNotification(options: LocalNotificationOptions): Promise<string>;
  cancelNotification(id: string): Promise<void>;
  cancelAllNotifications(): Promise<void>;
  requestNotificationPermission(): Promise<NotificationPermission>;
  
  // 生物识别
  isBiometricAvailable(): Promise<boolean>;
  getSupportedBiometrics(): Promise<BiometricType[]>;
  authenticate(options?: BiometricOptions): Promise<BiometricResult>;
  
  // 应用状态
  getAppState(): AppState;
  onAppStateChange(callback: (event: AppStateChangeEvent) => void): () => void;
  
  // 键盘
  onKeyboardShow(callback: (info: KeyboardInfo) => void): () => void;
  onKeyboardHide(callback: () => void): () => void;
  dismissKeyboard(): void;
  
  // 方向
  getOrientation(): Orientation;
  onOrientationChange(callback: (event: OrientationChangeEvent) => void): () => void;
  lockOrientation(orientation: Orientation): Promise<void>;
  unlockOrientation(): Promise<void>;
  
  // 深度链接
  getInitialDeepLink(): Promise<DeepLinkInfo | null>;
  onDeepLink(callback: (info: DeepLinkInfo) => void): () => void;
  
  // 剪贴板
  setClipboard(text: string, options?: ClipboardOptions): Promise<void>;
  getClipboard(options?: ClipboardOptions): Promise<string>;
  hasClipboard(): Promise<boolean>;
  
  // 振动和触觉反馈
  vibrate(pattern?: VibrationPattern): void;
  hapticFeedback(type: HapticFeedbackType): void;
  
  // 存储
  secureStore: {
    setItem(key: string, value: string, options?: StorageOptions): Promise<void>;
    getItem(key: string, options?: StorageOptions): Promise<string | null>;
    removeItem(key: string, options?: StorageOptions): Promise<void>;
    getAllKeys(options?: StorageOptions): Promise<string[]>;
  };
  
  // 网络请求
  fetch(request: NetworkRequest): Promise<NetworkResponse>;
  
  // 其他
  openURL(url: string): Promise<boolean>;
  canOpenURL(url: string): Promise<boolean>;
  exitApp(): void;
  restartApp(): void;
}

/**
 * 位置选项
 */
export interface LocationOptions {
  accuracy?: 'lowest' | 'low' | 'balanced' | 'high' | 'highest';
  timeout?: number;
  maximumAge?: number;
  distanceFilter?: number;
  enableHighAccuracy?: boolean;
}

/**
 * 平台特定配置
 */
export interface PlatformConfig {
  web?: {
    serviceWorker?: boolean;
    pwa?: boolean;
    offline?: boolean;
  };
  ios?: {
    bundleId?: string;
    teamId?: string;
    urlSchemes?: string[];
    backgroundModes?: string[];
  };
  android?: {
    package?: string;
    permissions?: string[];
    intentFilters?: any[];
    minSdkVersion?: number;
    targetSdkVersion?: number;
  };
}

/**
 * 平台能力检测
 */
export interface PlatformCapabilities {
  hasCamera: boolean;
  hasGPS: boolean;
  hasBiometric: boolean;
  hasNFC: boolean;
  hasBluetooth: boolean;
  hasAccelerometer: boolean;
  hasGyroscope: boolean;
  hasMagnetometer: boolean;
  hasBarometer: boolean;
  hasProximitySensor: boolean;
  hasLightSensor: boolean;
  hasVibration: boolean;
  hasNotifications: boolean;
  hasBackgroundExecution: boolean;
  hasFileSystem: boolean;
  hasNetwork: boolean;
  hasClipboard: boolean;
  hasShare: boolean;
  hasDeepLinking: boolean;
}