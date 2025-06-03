/**
 * 全局状态类型定义
 * 用于Zustand状态管理的TypeScript类型系统
 */

// 基础用户类型
export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatar?: string;
  role: UserRole;
  permissions: Permission[];
  createdAt: string;
  lastLoginAt?: string;
}

export interface UserRole {
  id: string;
  name: string;
  description: string;
  level: number; // 权限级别: 1-管理员, 2-操作员, 3-查看者
}

export interface Permission {
  id: string;
  name: string;
  resource: string; // 资源类型: 'farming', 'processing', 'logistics', 'admin'
  action: string;   // 操作类型: 'read', 'write', 'delete', 'manage'
}

// 登录凭据
export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

// 认证响应
export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

// 全局应用状态
export interface AppState {
  // 主题设置
  theme: 'light' | 'dark';
  
  // 语言设置
  language: 'zh-CN' | 'en-US';
  
  // 网络状态
  online: boolean;
  
  // 全局加载状态
  loading: boolean;
  
  // 侧边栏状态
  sidebarCollapsed: boolean;
  
  // 移动端导航状态
  mobileNavOpen: boolean;
  
  // 全局错误状态
  error: string | null;
  
  // 通知消息
  notifications: Notification[];
  
  // 方法
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (language: 'zh-CN' | 'en-US') => void;
  setOnline: (online: boolean) => void;
  setLoading: (loading: boolean) => void;
  toggleSidebar: () => void;
  toggleMobileNav: () => void;
  setError: (error: string | null) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

// 认证状态
export interface AuthState {
  // 认证状态
  isAuthenticated: boolean;
  
  // 当前用户
  user: User | null;
  
  // 访问令牌
  token: string | null;
  
  // 刷新令牌
  refreshToken: string | null;
  
  // 令牌过期时间
  tokenExpiresAt: number | null;
  
  // 用户权限
  permissions: Permission[];
  
  // 认证加载状态
  loading: boolean;
  
  // 认证错误
  error: string | null;
  
  // 方法
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
  updateProfile: (profile: Partial<User>) => Promise<void>;
  checkPermission: (resource: string, action: string) => boolean;
  clearError: () => void;
}

// 溯源查询状态
export interface TraceState {
  // 当前查询的批次
  currentBatch: Batch | null;
  
  // 搜索历史
  searchHistory: string[];
  
  // 最近搜索
  recentSearches: string[];
  
  // 收藏的批次
  favoritesBatches: string[];
  
  // 查询加载状态
  loading: boolean;
  
  // 查询错误
  error: string | null;
  
  // 方法
  setCurrentBatch: (batch: Batch | null) => void;
  addSearch: (batchId: string) => void;
  removeFromHistory: (batchId: string) => void;
  clearHistory: () => void;
  addToFavorites: (batchId: string) => void;
  removeFromFavorites: (batchId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// 用户偏好状态
export interface UserPreferencesState {
  // 主题设置
  theme: 'light' | 'dark';
  fontSize: 'small' | 'medium' | 'large';
  colorScheme: 'blue' | 'green' | 'purple' | 'red' | 'orange';
  
  // 语言设置
  language: 'zh-CN' | 'en-US';
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  
  // 界面设置
  sidebarCollapsed: boolean;
  sidebarPosition: 'left' | 'right';
  showNotifications: boolean;
  soundEnabled: boolean;
  animationsEnabled: boolean;
  
  // 数据设置
  itemsPerPage: number;
  autoRefresh: boolean;
  autoRefreshInterval: number;
  
  // 农业管理偏好
  defaultCropView: 'grid' | 'list' | 'map';
  showWeatherWidget: boolean;
  temperatureUnit: 'celsius' | 'fahrenheit';
  
  // 溯源查询偏好
  maxSearchHistory: number;
  autoSaveSearch: boolean;
  showSearchSuggestions: boolean;
  
  // 仪表板偏好
  dashboardLayout: 'standard' | 'compact' | 'wide';
  favoriteCharts: string[];
  widgetOrder: string[];
  
  // 数据导出偏好
  exportFormat: 'excel' | 'csv' | 'json' | 'pdf';
  includeImages: boolean;
  compressFiles: boolean;
  
  // 其他设置
  showTooltips: boolean;
  keyboardShortcuts: boolean;
  betaFeatures: boolean;
  
  // 主题管理方法
  setTheme: (theme: 'light' | 'dark') => void;
  setFontSize: (fontSize: 'small' | 'medium' | 'large') => void;
  setColorScheme: (colorScheme: 'blue' | 'green' | 'purple' | 'red' | 'orange') => void;
  
  // 语言管理方法
  setLanguage: (language: 'zh-CN' | 'en-US') => void;
  setTimezone: (timezone: string) => void;
  setDateFormat: (dateFormat: string) => void;
  setTimeFormat: (timeFormat: '12h' | '24h') => void;
  
  // 界面设置方法
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setSidebarPosition: (position: 'left' | 'right') => void;
  setShowNotifications: (show: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  
  // 数据设置方法
  setItemsPerPage: (count: number) => void;
  setAutoRefresh: (enabled: boolean) => void;
  setAutoRefreshInterval: (interval: number) => void;
  
  // 农业管理偏好方法
  setDefaultCropView: (view: 'grid' | 'list' | 'map') => void;
  setShowWeatherWidget: (show: boolean) => void;
  setTemperatureUnit: (unit: 'celsius' | 'fahrenheit') => void;
  
  // 溯源查询偏好方法
  setMaxSearchHistory: (max: number) => void;
  setAutoSaveSearch: (enabled: boolean) => void;
  setShowSearchSuggestions: (show: boolean) => void;
  
  // 仪表板偏好方法
  setDashboardLayout: (layout: 'standard' | 'compact' | 'wide') => void;
  setFavoriteCharts: (charts: string[]) => void;
  addFavoriteChart: (chartId: string) => void;
  removeFavoriteChart: (chartId: string) => void;
  setWidgetOrder: (order: string[]) => void;
  
  // 数据导出偏好方法
  setExportFormat: (format: 'excel' | 'csv' | 'json' | 'pdf') => void;
  setIncludeImages: (include: boolean) => void;
  setCompressFiles: (compress: boolean) => void;
  
  // 其他设置方法
  setShowTooltips: (show: boolean) => void;
  setKeyboardShortcuts: (enabled: boolean) => void;
  setBetaFeatures: (enabled: boolean) => void;
  
  // 批量操作方法
  updatePreferences: (preferences: Partial<UserPreferencesState>) => void;
  resetToDefaults: () => void;
  importPreferences: (preferences: any) => boolean;
  exportPreferences: () => any;
}

// 业务数据类型
export interface Batch {
  id: string;
  batchNumber: string;
  productName: string;
  productType: ProductType;
  currentStage: ProductionStage;
  stages: ProductionStageDetail[];
  qrCode: string;
  createdAt: string;
  updatedAt: string;
  location?: Location;
  certifications: Certification[];
  metadata: Record<string, any>;
}

export interface ProductionStageDetail {
  stage: ProductionStage;
  startTime: string;
  endTime?: string;
  location: Location;
  operator: User;
  data: Record<string, any>;
  images?: string[];
  certifications?: Certification[];
}

export interface Location {
  id: string;
  name: string;
  address: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  type: 'farm' | 'processing' | 'warehouse' | 'retail';
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  issuedAt: string;
  expiresAt?: string;
  certificateUrl?: string;
  verified: boolean;
}

// 枚举类型
export type ProductType = 'vegetable' | 'fruit' | 'grain' | 'meat' | 'dairy' | 'seafood';

export type ProductionStage = 
  | 'farming'     // 种植/养殖
  | 'harvesting'  // 收获
  | 'processing'  // 加工
  | 'packaging'   // 包装
  | 'storage'     // 存储
  | 'logistics'   // 物流
  | 'retail';     // 零售

// UI相关类型
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  duration?: number; // 显示时长(毫秒)，0表示不自动消失
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface DashboardLayout {
  widgets: DashboardWidget[];
  columns: number;
  compactMode: boolean;
}

export interface DashboardWidget {
  id: string;
  type: 'stats' | 'chart' | 'recent' | 'alerts';
  position: { x: number; y: number; w: number; h: number };
  visible: boolean;
  config: Record<string, any>;
}

export interface TableSettings {
  pageSize: number;
  columnsVisible: Record<string, boolean>;
  sortPreferences: Record<string, { column: string; direction: 'asc' | 'desc' }>;
  filterPreferences: Record<string, any>;
}

export interface NotificationSettings {
  enableDesktop: boolean;
  enableEmail: boolean;
  enableSMS: boolean;
  categories: {
    system: boolean;
    alerts: boolean;
    updates: boolean;
    marketing: boolean;
  };
}

export interface DisplaySettings {
  compactMode: boolean;
  showAnimations: boolean;
  fontSize: 'small' | 'medium' | 'large';
  highContrast: boolean;
  reducedMotion: boolean;
}

// 离线队列类型
export interface OfflineAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface OfflineState {
  queue: OfflineAction[];
  isSync: boolean;
  lastSyncAt: number | null;
  addAction: (action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>) => void;
  removeAction: (id: string) => void;
  retryAction: (id: string) => void;
  clearQueue: () => void;
  setSync: (isSync: boolean) => void;
}

// Store组合类型
export type RootState = {
  app: AppState;
  auth: AuthState;
  trace: TraceState;
  preferences: UserPreferencesState;
  offline: OfflineState;
}; 