// 状态管理相关类型定义
import type { User, AuthToken, Permission } from './auth';
import type { Product, Batch, DashboardStats } from './business';

// 认证状态
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: AuthToken | null;
  permissions: Permission[];
  loading: boolean;
  error: string | null;
}

// 认证操作
export interface AuthActions {
  login: (credentials: { username: string; password: string }) => Promise<void>;
  logout: () => void;
  register: (data: any) => Promise<void>;
  refreshToken: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  clearError: () => void;
}

// 仪表板状态
export interface DashboardState {
  stats: DashboardStats | null;
  overview: OverviewData | null;
  currentView: 'overview' | 'analytics' | 'reports';
  filters: DashboardFilters;
  autoRefresh: boolean;
  refreshInterval: number;
  loading: boolean;
  error: string | null;
}

export interface OverviewData {
  totalProducts: number;
  activeBatches: number;
  monthlyGrowth: number;
  qualityScore: number;
  recentActivities: ActivityItem[];
  alerts: AlertItem[];
}

export interface ActivityItem {
  id: string;
  type: 'batch_created' | 'quality_check' | 'shipment' | 'harvest';
  title: string;
  description: string;
  timestamp: Date;
  user: User;
}

export interface AlertItem {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface DashboardFilters {
  dateRange: DateRange;
  category: string[];
  status: string[];
  location: string[];
}

export interface DateRange {
  from: Date;
  to: Date;
}

// 溯源状态
export interface TraceState {
  currentBatch: Batch | null;
  searchQuery: string;
  searchResults: Batch[];
  searchHistory: SearchHistory[];
  viewMode: 'timeline' | 'detailed' | 'summary';
  showQualityMetrics: boolean;
  loading: boolean;
  error: string | null;
}

export interface SearchHistory {
  id: string;
  query: string;
  timestamp: Date;
  resultCount: number;
}

// 用户状态
export interface UserState {
  currentUser: User | null;
  preferences: UserPreferences;
  notifications: Notification[];
  activities: ActivityItem[];
  loading: boolean;
  error: string | null;
}

export interface UserPreferences {
  language: 'zh' | 'en';
  theme: 'light' | 'dark' | 'auto';
  notifications: NotificationSettings;
  dashboard: DashboardPreferences;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  alerts: boolean;
  reports: boolean;
}

export interface DashboardPreferences {
  layout: 'grid' | 'list';
  defaultView: 'overview' | 'analytics' | 'reports';
  refreshInterval: number;
  showStats: boolean;
}

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: string;
  data?: any;
}

// 应用全局状态
export interface AppState {
  initialized: boolean;
  platform: 'web' | 'mobile';
  network: NetworkState;
  ui: UIState;
  loading: boolean;
  error: string | null;
}

export interface NetworkState {
  isConnected: boolean;
  type: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  isInternetReachable: boolean;
  syncPending: boolean;
}

export interface UIState {
  sidebarOpen: boolean;
  modalStack: string[];
  toasts: ToastMessage[];
  theme: 'light' | 'dark';
  locale: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  actions?: ToastAction[];
}

export interface ToastAction {
  label: string;
  action: () => void;
}