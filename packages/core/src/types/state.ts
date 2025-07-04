/**
 * 状态管理相关类型定义
 */

import { User, UserPreferences, Permission, AuthState } from './auth';
import { Batch, Product, Location } from './business';
import { BaseEntity, Notification, Statistics } from './common';

/**
 * 应用状态接口
 */
export interface AppState {
  // 基础设置
  theme: 'light' | 'dark' | 'auto';
  language: string;
  locale: string;
  
  // 网络状态
  online: boolean;
  lastOnlineAt?: string;
  
  // 加载状态
  loading: boolean;
  loadingMessage?: string;
  
  // 全局错误
  error: string | null;
  errorCode?: string;
  
  // 侧边栏状态
  sidebarCollapsed: boolean;
  sidebarVisible: boolean;
  
  // 移动端状态
  isMobile: boolean;
  mobileNavOpen: boolean;
  
  // 通知
  notifications: Notification[];
  unreadNotificationCount: number;
  
  // 应用配置
  config: AppConfig;
  
  // 功能开关
  features: Record<string, boolean>;
  
  // 调试模式
  debugMode: boolean;
  
  // Actions
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  setLanguage: (language: string) => void;
  setOnline: (online: boolean) => void;
  setLoading: (loading: boolean, message?: string) => void;
  setError: (error: string | null, code?: string) => void;
  clearError: () => void;
  toggleSidebar: () => void;
  setSidebarVisible: (visible: boolean) => void;
  toggleMobileNav: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>) => void;
  removeNotification: (id: string) => void;
  markNotificationAsRead: (id: string) => void;
  clearNotifications: () => void;
  updateConfig: (config: Partial<AppConfig>) => void;
  setFeature: (feature: string, enabled: boolean) => void;
  setDebugMode: (enabled: boolean) => void;
}

/**
 * 应用配置
 */
export interface AppConfig {
  // API配置
  apiBaseUrl: string;
  apiTimeout: number;
  apiRetries: number;
  
  // 缓存配置
  cacheEnabled: boolean;
  cacheTTL: number;
  maxCacheSize: number;
  
  // 分页配置
  defaultPageSize: number;
  maxPageSize: number;
  
  // 文件上传配置
  maxFileSize: number;
  allowedFileTypes: string[];
  
  // 地图配置
  mapProvider: 'google' | 'baidu' | 'amap';
  mapApiKey?: string;
  defaultMapCenter: [number, number];
  defaultMapZoom: number;
  
  // 通知配置
  notificationDuration: number;
  maxNotifications: number;
  
  // 安全配置
  sessionTimeout: number;
  maxLoginAttempts: number;
  
  // 其他配置
  enableAnalytics: boolean;
  enableCrashReporting: boolean;
  enablePerformanceMonitoring: boolean;
}

/**
 * 溯源状态接口
 */
export interface TraceState {
  // 当前查询的批次
  currentBatch: Batch | null;
  
  // 搜索状态
  searchQuery: string;
  searchResults: Batch[];
  isSearching: boolean;
  searchError: string | null;
  
  // 搜索历史
  searchHistory: SearchHistoryItem[];
  recentSearches: string[];
  
  // 收藏
  favorites: FavoriteItem[];
  
  // 视图设置
  viewMode: 'timeline' | 'detailed' | 'summary' | 'map';
  selectedStage: string | null;
  showQualityMetrics: boolean;
  showCertifications: boolean;
  showEnvironmentData: boolean;
  
  // 筛选器
  filters: TraceFilters;
  
  // 排序
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  
  // 分页
  currentPage: number;
  pageSize: number;
  totalCount: number;
  
  // 数据加载状态
  loading: boolean;
  error: string | null;
  
  // 缓存控制
  cacheEnabled: boolean;
  lastRefresh: string | null;
  
  // Actions
  setBatch: (batch: Batch | null) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: Batch[]) => void;
  setSearching: (searching: boolean) => void;
  setSearchError: (error: string | null) => void;
  addToHistory: (item: SearchHistoryItem) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
  addToFavorites: (item: FavoriteItem) => void;
  removeFromFavorites: (id: string) => void;
  setViewMode: (mode: 'timeline' | 'detailed' | 'summary' | 'map') => void;
  setSelectedStage: (stageId: string | null) => void;
  toggleQualityMetrics: () => void;
  toggleCertifications: () => void;
  toggleEnvironmentData: () => void;
  setFilters: (filters: Partial<TraceFilters>) => void;
  resetFilters: () => void;
  setSorting: (sortBy: string, order: 'asc' | 'desc') => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  refreshData: () => Promise<void>;
}

/**
 * 搜索历史项
 */
export interface SearchHistoryItem extends BaseEntity {
  query: string;
  type: 'batch' | 'product' | 'location';
  resultCount: number;
  searchedAt: string;
  userId?: string;
}

/**
 * 收藏项
 */
export interface FavoriteItem extends BaseEntity {
  type: 'batch' | 'product' | 'location' | 'supplier';
  itemId: string;
  title: string;
  description?: string;
  tags?: string[];
  addedAt: string;
  userId?: string;
}

/**
 * 溯源筛选器
 */
export interface TraceFilters {
  productType?: string[];
  productionDateRange?: {
    start: string;
    end: string;
  };
  expiryDateRange?: {
    start: string;
    end: string;
  };
  stages?: string[];
  locations?: string[];
  suppliers?: string[];
  qualityGrades?: string[];
  certifications?: string[];
  status?: string[];
  hasIssues?: boolean;
}

/**
 * 仪表板状态接口
 */
export interface DashboardState {
  // 统计数据
  statistics: DashboardStatistics | null;
  
  // 图表数据
  charts: DashboardCharts;
  
  // 警报数据
  alerts: DashboardAlert[];
  
  // 最近活动
  recentActivities: RecentActivity[];
  
  // 布局配置
  layout: DashboardLayout;
  
  // 筛选器
  filters: DashboardFilters;
  
  // 时间范围
  timeRange: TimeRangeOption;
  customTimeRange?: {
    start: string;
    end: string;
  };
  
  // 刷新设置
  autoRefresh: boolean;
  refreshInterval: number; // 秒
  lastRefresh: string | null;
  
  // 数据状态
  loading: boolean;
  error: string | null;
  
  // Actions
  setStatistics: (stats: DashboardStatistics | null) => void;
  setCharts: (charts: Partial<DashboardCharts>) => void;
  setAlerts: (alerts: DashboardAlert[]) => void;
  setRecentActivities: (activities: RecentActivity[]) => void;
  updateLayout: (layout: DashboardLayout) => void;
  setFilters: (filters: Partial<DashboardFilters>) => void;
  setTimeRange: (range: TimeRangeOption) => void;
  setCustomTimeRange: (start: string, end: string) => void;
  setAutoRefresh: (enabled: boolean) => void;
  setRefreshInterval: (interval: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  refreshDashboard: () => Promise<void>;
}

/**
 * 仪表板统计数据
 */
export interface DashboardStatistics {
  production: Statistics & {
    dailyOutput: number;
    weeklyOutput: number;
    monthlyOutput: number;
    efficiency: number;
  };
  quality: Statistics & {
    passRate: number;
    averageScore: number;
    issueCount: number;
    improvementRate: number;
  };
  inventory: Statistics & {
    totalValue: number;
    lowStockCount: number;
    expiringCount: number;
    turnoverRate: number;
  };
  orders: Statistics & {
    revenue: number;
    averageOrderValue: number;
    fulfillmentRate: number;
    returnRate: number;
  };
}

/**
 * 仪表板图表数据
 */
export interface DashboardCharts {
  productionTrend: ChartData;
  qualityTrend: ChartData;
  inventoryStatus: ChartData;
  orderDistribution: ChartData;
  supplierPerformance: ChartData;
  geographicDistribution: ChartData;
}

/**
 * 图表数据
 */
export interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'area' | 'scatter' | 'heatmap';
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      borderWidth?: number;
      fill?: boolean;
    }[];
  };
  options?: Record<string, any>;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

/**
 * 仪表板警报
 */
export interface DashboardAlert extends BaseEntity {
  type: 'quality' | 'inventory' | 'production' | 'system' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  source: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  actions?: AlertAction[];
  metadata?: Record<string, any>;
}

/**
 * 警报操作
 */
export interface AlertAction {
  id: string;
  label: string;
  type: 'link' | 'button' | 'modal';
  url?: string;
  action?: string;
  confirm?: boolean;
  style?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
}

/**
 * 最近活动
 */
export interface RecentActivity extends BaseEntity {
  type: 'batch_created' | 'quality_check' | 'shipment' | 'alert' | 'user_action';
  title: string;
  description: string;
  actor?: string;
  target?: string;
  location?: string;
  icon?: string;
  color?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

/**
 * 仪表板布局
 */
export interface DashboardLayout {
  widgets: DashboardWidget[];
  columns: number;
  rowHeight: number;
  margin: [number, number];
  containerPadding: [number, number];
  compactType: 'vertical' | 'horizontal' | null;
  preventCollision: boolean;
}

/**
 * 仪表板组件
 */
export interface DashboardWidget {
  id: string;
  type: 'statistics' | 'chart' | 'alerts' | 'activities' | 'map' | 'table' | 'custom';
  title: string;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  config: Record<string, any>;
  visible: boolean;
  resizable: boolean;
  draggable: boolean;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
}

/**
 * 仪表板筛选器
 */
export interface DashboardFilters {
  facilities?: string[];
  productTypes?: string[];
  suppliers?: string[];
  regions?: string[];
  includeInactive?: boolean;
}

/**
 * 时间范围选项
 */
export type TimeRangeOption = 
  | 'today'
  | 'yesterday' 
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisQuarter'
  | 'lastQuarter'
  | 'thisYear'
  | 'lastYear'
  | 'custom';

/**
 * 用户偏好状态接口
 */
export interface UserPreferencesState extends UserPreferences {
  // 偏好设置Actions
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  resetToDefaults: () => void;
  importPreferences: (data: any) => Promise<boolean>;
  exportPreferences: () => any;
  
  // 主题相关Actions
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  setLanguage: (language: string) => void;
  setTimezone: (timezone: string) => void;
  
  // 界面相关Actions
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setNotificationSettings: (settings: Partial<UserPreferences['notifications']>) => void;
  
  // 数据相关Actions
  setItemsPerPage: (count: number) => void;
  setAutoRefresh: (enabled: boolean) => void;
  setAutoRefreshInterval: (interval: number) => void;
  
  // 收藏和最近项Actions
  addFavorite: (type: string, id: string, title: string) => void;
  removeFavorite: (type: string, id: string) => void;
  addRecentItem: (type: string, id: string, title: string) => void;
  clearRecentItems: (type?: string) => void;
}

/**
 * 离线状态接口
 */
export interface OfflineState {
  // 离线状态
  isOffline: boolean;
  
  // 队列状态
  queue: OfflineAction[];
  isProcessing: boolean;
  processingCount: number;
  
  // 同步状态
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  syncInProgress: boolean;
  syncError: string | null;
  
  // 冲突处理
  conflicts: SyncConflict[];
  
  // 存储状态
  storageUsed: number;
  storageLimit: number;
  
  // Actions
  addAction: (action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>) => void;
  removeAction: (id: string) => void;
  retryAction: (id: string) => void;
  clearQueue: () => void;
  processQueue: () => Promise<void>;
  resolveConflict: (conflictId: string, resolution: 'local' | 'remote' | 'merge') => void;
  sync: () => Promise<void>;
  setOfflineMode: (offline: boolean) => void;
}

/**
 * 离线操作
 */
export interface OfflineAction extends BaseEntity {
  type: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  data?: any;
  headers?: Record<string, string>;
  priority: 'low' | 'normal' | 'high';
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  dependsOn?: string[];
}

/**
 * 同步冲突
 */
export interface SyncConflict extends BaseEntity {
  type: 'data' | 'deletion';
  entityType: string;
  entityId: string;
  localData: any;
  remoteData: any;
  conflictFields: string[];
  resolved: boolean;
  resolution?: 'local' | 'remote' | 'merge';
  resolvedData?: any;
}

/**
 * 根状态类型
 */
export interface RootState {
  app: AppState;
  auth: AuthState;
  trace: TraceState;
  dashboard: DashboardState;
  preferences: UserPreferencesState;
  offline: OfflineState;
}

/**
 * 状态选择器类型
 */
export type StateSelector<T> = (state: RootState) => T;

/**
 * 状态订阅器类型
 */
export type StateSubscriber<T> = (state: T, previousState: T) => void;

/**
 * 状态中间件类型
 */
export type StateMiddleware = (
  config: any
) => (set: any, get: any, api: any) => any;