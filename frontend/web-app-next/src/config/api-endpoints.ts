/**
 * API端点配置
 * 管理Mock API和真实API的端点切换
 * 生产环境默认使用真实API进行认证，其他功能使用Mock
 */

// 真实API配置
export const REAL_API_CONFIG = {
  // 强制使用本地后端，忽略所有环境变量
  baseURL: (() => {
    const forceLocalBackend = 'http://localhost:3001';
    console.log('[API Config] 🔧 强制使用本地后端:', forceLocalBackend);
    console.log('[API Config] 忽略环境变量:', {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NEXT_PUBLIC_REAL_API_BASE: process.env.NEXT_PUBLIC_REAL_API_BASE,
      NODE_ENV: process.env.NODE_ENV
    });
    return forceLocalBackend;
  })(),
  timeout: 15000,
  retryAttempts: 3,
} as const;

// Mock API配置
export const MOCK_API_CONFIG = {
  baseURL: '', // 使用相对路径，指向当前域名的API路由
  timeout: 10000,
  retryAttempts: 2,
} as const;

// API端点定义
export const API_ENDPOINTS = {
  // 认证相关 - 统一使用新后端API路径
  AUTH: {
    VERIFY_PHONE: '/api/auth/verify-phone',
    REGISTER: '/api/auth/register',
    LOGIN: '/api/auth/login',
    PLATFORM_LOGIN: '/api/auth/platform-login',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
    STATUS: '/api/auth/status',
    PROFILE: '/api/auth/me',
    CHANGE_PASSWORD: '/api/auth/password',
  },

  // 白名单管理 - 新后端API
  WHITELIST: {
    LIST: '/api/whitelist',
    ADD: '/api/whitelist',
    UPDATE: '/api/whitelist',
    DELETE: '/api/whitelist',
    BATCH_DELETE: '/api/whitelist/batch',
    STATS: '/api/whitelist/stats',
    UPDATE_EXPIRED: '/api/whitelist/expired',
  },

  // 用户管理 - 新后端API
  USERS: {
    LIST: '/api/users',
    PENDING: '/api/users/pending',
    STATS: '/api/users/stats',
    ACTIVATE: '/api/users',
    UPDATE: '/api/users',
    STATUS: '/api/users',
    RESET_PASSWORD: '/api/users',
  },

  // 平台管理 - 新后端API
  PLATFORM: {
    FACTORIES: '/api/platform/factories',
    FACTORY_STATS: '/api/platform/factories/stats',
    CREATE_SUPER_ADMIN: '/api/platform/factories',
  },

  // 其他功能 - 继续使用Mock API
  FARMING: {
    CROPS: '/api/farming/crops',
    FIELDS: '/api/farming/fields',
    ACTIVITIES: '/api/farming/farm-activities',
    HARVEST: '/api/farming/harvest-records',
    PLANNING: '/api/farming/planting-plans',
  },

  PROCESSING: {
    PRODUCTION: '/api/processing/production-batches',
    QUALITY: '/api/processing/quality-tests',
    MATERIALS: '/api/processing/raw-materials',
    PRODUCTS: '/api/processing/finished-products',
  },

  LOGISTICS: {
    ORDERS: '/api/logistics/transport-orders',
    VEHICLES: '/api/logistics/vehicles',
    DRIVERS: '/api/logistics/drivers',
    WAREHOUSES: '/api/logistics/warehouses',
    INVENTORY: '/api/logistics/inventory',
  },

  ADMIN: {
    USERS: '/api/admin/users',
    ROLES: '/api/admin/roles',
    AUDIT: '/api/admin/audit-logs',
    NOTIFICATIONS: '/api/admin/notifications',
  },
} as const;

/**
 * 判断是否为新后端Real API的端点
 */
export const isRealAPI = (endpoint: string): boolean => {
  const realApiEndpoints = [
    ...Object.values(API_ENDPOINTS.AUTH),
    ...Object.values(API_ENDPOINTS.WHITELIST),
    ...Object.values(API_ENDPOINTS.USERS),
    ...Object.values(API_ENDPOINTS.PLATFORM),
  ];
  return realApiEndpoints.some(realEndpoint => endpoint.includes(realEndpoint));
};

/**
 * 判断是否为认证相关的API (兼容性保持)
 */
export const isAuthAPI = (endpoint: string): boolean => {
  const authEndpoints = Object.values(API_ENDPOINTS.AUTH);
  return authEndpoints.some(authEndpoint => endpoint.includes(authEndpoint));
};

/**
 * 获取API环境类型
 * 新后端API使用Real API，其他继续使用Mock API
 */
export const getApiEnvironment = (endpoint?: string): 'real' | 'mock' => {
  // 如果是新后端API（认证、白名单、用户管理、平台管理）
  if (endpoint && isRealAPI(endpoint)) {
    // 检查环境变量强制设置为Mock
    const forceMock = process.env.NEXT_PUBLIC_USE_MOCK_API;
    if (forceMock === 'true') {
      return 'mock';
    }

    // 检查URL参数强制设置
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('api') === 'mock') {
        return 'mock';
      }
    }

    // 默认使用Real API
    return 'real';
  }

  // 非新后端API默认使用Mock
  return 'mock';
};

/**
 * 获取API基础URL
 */
export const getApiBaseURL = (endpoint?: string): string => {
  const environment = getApiEnvironment(endpoint);

  if (endpoint && isRealAPI(endpoint)) {
    // 新后端API根据环境返回对应URL
    return environment === 'real' ? REAL_API_CONFIG.baseURL : MOCK_API_CONFIG.baseURL;
  }

  // 其他API使用Mock
  return MOCK_API_CONFIG.baseURL;
};

/**
 * 获取完整的API URL
 */
export const getFullApiUrl = (endpoint: string): string => {
  const baseURL = getApiBaseURL(endpoint);
  return `${baseURL}${endpoint}`;
};

/**
 * API配置获取
 */
export const getApiConfig = (endpoint?: string) => {
  const environment = getApiEnvironment(endpoint);

  if (endpoint && isRealAPI(endpoint)) {
    return environment === 'real' ? REAL_API_CONFIG : MOCK_API_CONFIG;
  }

  return MOCK_API_CONFIG;
};
