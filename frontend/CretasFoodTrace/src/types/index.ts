// Re-export all types from their canonical sources
// This file provides a centralized import point

// Auth types - canonical source
export {
  User,
  PlatformUser,
  FactoryUser,
  UserDTO,
  UserRole,
  UserPermissions,
  AuthTokens,
  LoginRequest,
  LoginResponse,
  PLATFORM_ROLES,
  FACTORY_ROLES,
  USER_ROLES,
  DEPARTMENTS,
  isPlatformUser,
  isFactoryUser,
  getUserRole,
  getFactoryId,
  getDepartment,
  getUserPermissions,
  hasPermission,
} from './auth';

// API Response types
export {
  BaseApiResponse,
  UnifiedLoginResponseData,
  UnifiedLoginApiResponse,
  ApiErrorResponse,
} from './apiResponses';

// Navigation types
export type {
  RootStackParamList,
  MainTabParamList,
  ProcessingStackParamList,
} from './navigation';

// Basic API response wrapper (for backward compatibility)
export interface ApiResponse<T = unknown> {
  success: boolean;
  code?: number;
  data?: T;
  message?: string;
  error?: string;
}

// Device info type
export interface DeviceInfo {
  deviceId: string;
  model: string;
  brand: string;
  osVersion: string;
  appVersion: string;
}

// Storage keys - use specific constants from individual modules instead
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_INFO: 'user_info',
  APP_SETTINGS: 'app_settings',
} as const;

// Decoration types - 首页装饰系统
export type {
  HomeModuleType,
  HomeModule,
  ModuleConfig,
  StatCardConfig,
  QuickActionConfig,
  ThemeConfig,
  TimeSlot,
  LayoutStatus,
  FactoryHomeLayout,
  AILayoutGenerateRequest,
  AILayoutGenerateResponse,
  SaveLayoutRequest,
  SaveLayoutResponse,
  PublishLayoutRequest,
  PublishLayoutResponse,
  GetLayoutResponse,
  ModuleMoveOperation,
  ModuleResizeOperation,
  LayoutHistoryItem,
  LayoutValidationResult,
} from './decoration';

export {
  UI_GRAMMAR,
  DEFAULT_THEME_CONFIG,
  DEFAULT_HOME_LAYOUT,
  createDefaultFactoryLayout,
  validateLayout,
  getCurrentTimeSlot,
  cloneModules,
} from './decoration';
