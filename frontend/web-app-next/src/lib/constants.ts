// Application Constants

// App Configuration
export const APP_CONFIG = {
  name: process.env.NEXT_PUBLIC_APP_NAME || '食品溯源系统',
  version: process.env.NEXT_PUBLIC_APP_VERSION || '3.0.0',
  env: process.env.NEXT_PUBLIC_APP_ENV || 'development',
} as const;

// API Configuration
export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_REAL_API_BASE || 'https://backend-theta-taupe-21.vercel.app',
  timeout: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '10000'),
} as const;

// Route Constants
export const ROUTES = {
  HOME: '/',
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  TRACE: '/trace',
  FARMING: '/farming',
  PROCESSING: '/processing',
  LOGISTICS: '/logistics',
  ADMIN: '/admin',
  COMPONENTS: '/components',
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data',
  THEME: 'theme',
  LANGUAGE: 'language',
  SEARCH_HISTORY: 'search_history',
  OFFLINE_DATA: 'offline_data',
} as const;

// Theme Constants
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as const;

// Language Constants
export const LANGUAGES = {
  ZH_CN: 'zh-CN',
  EN_US: 'en-US',
} as const;

// Validation Constants
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 20,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^1[3-9]\d{9}$/,
  BATCH_ID_REGEX: /^[A-Z0-9]{8,16}$/,
} as const;

// UI Constants
export const UI_CONFIG = {
  MOBILE_BREAKPOINT: 768,
  TABLET_BREAKPOINT: 1024,
  DESKTOP_BREAKPOINT: 1280,
  MAX_MOBILE_WIDTH: 390,
  HEADER_HEIGHT: 64,
  FOOTER_HEIGHT: 80,
  SIDEBAR_WIDTH: 280,
} as const;

// Animation Constants
export const ANIMATIONS = {
  DURATION_FAST: 150,
  DURATION_NORMAL: 250,
  DURATION_SLOW: 350,
  EASING_DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
  EASING_IN: 'cubic-bezier(0.4, 0, 1, 1)',
  EASING_OUT: 'cubic-bezier(0, 0, 0.2, 1)',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接失败，请检查网络设置',
  UNAUTHORIZED: '登录已过期，请重新登录',
  FORBIDDEN: '权限不足，无法访问该资源',
  NOT_FOUND: '请求的资源不存在',
  SERVER_ERROR: '服务器内部错误，请稍后重试',
  VALIDATION_ERROR: '输入数据格式不正确',
  UNKNOWN_ERROR: '未知错误，请联系技术支持',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: '登录成功',
  LOGOUT_SUCCESS: '退出成功',
  SAVE_SUCCESS: '保存成功',
  DELETE_SUCCESS: '删除成功',
  UPDATE_SUCCESS: '更新成功',
  UPLOAD_SUCCESS: '上传成功',
} as const;

// Feature Flags
export const FEATURE_FLAGS = {
  DARK_MODE: process.env.NEXT_PUBLIC_ENABLE_DARK_MODE === 'true',
  OFFLINE_MODE: process.env.NEXT_PUBLIC_ENABLE_OFFLINE_MODE === 'true',
  PWA: process.env.NEXT_PUBLIC_ENABLE_PWA === 'true',
  ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  ERROR_REPORTING: process.env.NEXT_PUBLIC_ENABLE_ERROR_REPORTING === 'true',
  DEBUG: process.env.NEXT_PUBLIC_DEBUG === 'true',
  MOCK_API: process.env.NEXT_PUBLIC_MOCK_ENABLED === 'true',
} as const;

// Business Constants
export const BUSINESS_CONFIG = {
  TRACE_STAGES: ['farming', 'processing', 'logistics', 'retail'] as const,
  USER_ROLES: [
    'admin',
    'farmer',
    'processor',
    'logistics',
    'consumer',
  ] as const,
  PRODUCT_CATEGORIES: [
    'vegetables',
    'fruits',
    'grains',
    'meat',
    'dairy',
  ] as const,
  QUALITY_LEVELS: ['A', 'B', 'C'] as const,
} as const;

// Export all constants as a single object for convenience
export const CONSTANTS = {
  APP_CONFIG,
  API_CONFIG,
  ROUTES,
  STORAGE_KEYS,
  THEMES,
  LANGUAGES,
  VALIDATION,
  UI_CONFIG,
  ANIMATIONS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  FEATURE_FLAGS,
  BUSINESS_CONFIG,
} as const;
