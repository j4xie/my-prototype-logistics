/**
 * @food-trace/core 基础使用示例
 */

import {
  initializeCore,
  useAuth,
  useUser,
  usePermission,
  formatDate,
  logger,
  Platform,
  validateObject,
  ValidationRules,
  StorageAdapterFactory,
  apiClient,
  type User,
  type Batch,
  type Product
} from '../src/index';

// ========================= 1. 初始化配置 =========================

// 初始化核心包
const initResult = initializeCore({
  debug: true,
  logLevel: 'debug',
  platform: Platform.isWeb ? 'web' : 'react-native',
  apiBaseUrl: 'https://api.foodtrace.com',
  config: {
    appName: 'Food Trace Demo',
    version: '1.0.0',
  },
});

logger.info('Core initialized', 'Example', initResult);

// ========================= 2. 认证使用示例 =========================

// React 组件中使用认证
function AuthExample() {
  const { 
    isAuthenticated, 
    user, 
    login, 
    logout, 
    loading, 
    error 
  } = useAuth();

  const currentUser = useUser();
  const canEditProducts = usePermission('products', 'write');
  const isAdmin = usePermission('admin', 'manage');

  const handleLogin = async () => {
    try {
      await login({
        username: 'admin@example.com',
        password: 'password123',
        rememberMe: true,
      });
      logger.info('Login successful', 'AuthExample');
    } catch (error) {
      logger.error('Login failed', 'AuthExample', error);
    }
  };

  const handleLogout = async () => {
    await logout();
    logger.info('Logout successful', 'AuthExample');
  };

  return {
    isAuthenticated,
    user: currentUser,
    canEditProducts,
    isAdmin,
    loading,
    error,
    login: handleLogin,
    logout: handleLogout,
  };
}

// ========================= 3. 数据验证示例 =========================

// 用户注册数据验证
function validateUserRegistration(data: any) {
  const schema = {
    username: [
      ValidationRules.required('用户名不能为空'),
      ValidationRules.length(3, 20, '用户名长度必须在3-20个字符之间'),
    ],
    email: [
      ValidationRules.required('邮箱不能为空'),
      ValidationRules.email('邮箱格式不正确'),
    ],
    password: [
      ValidationRules.required('密码不能为空'),
      ValidationRules.length(8, 50, '密码长度必须在8-50个字符之间'),
      ValidationRules.pattern(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        '密码必须包含大小写字母和数字'
      ),
    ],
    phone: ValidationRules.phone('手机号格式不正确'),
  };

  const result = validateObject(data, schema);
  
  if (!result.isValid) {
    logger.warn('Validation failed', 'UserRegistration', result.errors);
  }
  
  return result;
}

// 批次数据验证
function validateBatch(batchData: any) {
  const schema = {
    batchNumber: [
      ValidationRules.required('批次号不能为空'),
      ValidationRules.pattern(/^[A-Z0-9]{8,16}$/, '批次号格式不正确'),
    ],
    productName: [
      ValidationRules.required('产品名称不能为空'),
      ValidationRules.length(2, 100, '产品名称长度在2-100个字符之间'),
    ],
    quantity: [
      ValidationRules.required('数量不能为空'),
      ValidationRules.range(1, 999999, '数量必须大于0'),
    ],
    productionDate: ValidationRules.required('生产日期不能为空'),
    expiryDate: ValidationRules.required('过期日期不能为空'),
  };

  return validateObject(batchData, schema);
}

// ========================= 4. 日期工具示例 =========================

function dateUtilsExample() {
  const now = new Date();
  
  // 格式化日期
  const formatted = {
    standard: formatDate(now, 'YYYY-MM-DD HH:mm:ss'),
    chinese: formatDate(now, 'YYYY年MM月DD日 HH:mm'),
    iso: formatDate(now, 'YYYY-MM-DDTHH:mm:ss.sssZ'),
  };

  // 相对时间
  const relative = {
    yesterday: formatRelativeTime(new Date(Date.now() - 24 * 60 * 60 * 1000)),
    oneHourAgo: formatRelativeTime(new Date(Date.now() - 60 * 60 * 1000)),
    justNow: formatRelativeTime(new Date(Date.now() - 30 * 1000)),
  };

  logger.info('Date formatting examples', 'DateUtils', {
    formatted,
    relative,
  });

  return { formatted, relative };
}

// ========================= 5. 存储示例 =========================

async function storageExample() {
  // 创建存储适配器
  const storage = StorageAdapterFactory.createAutoDetect();

  // 存储用户偏好
  const userPreferences = {
    theme: 'dark',
    language: 'zh-CN',
    notifications: true,
    autoSync: true,
  };

  await storage.setData('userPreferences', userPreferences);
  
  // 读取用户偏好
  const savedPreferences = await storage.getData('userPreferences');
  
  logger.info('Storage example', 'Storage', {
    saved: userPreferences,
    loaded: savedPreferences,
  });

  // 存储批次数据
  const batchData: Partial<Batch> = {
    id: 'batch-001',
    batchNumber: 'B202412001',
    productId: 'product-001',
    quantity: 1000,
    unit: 'kg',
    productionDate: '2024-12-01T08:00:00Z',
    expiryDate: '2024-12-31T23:59:59Z',
  };

  await storage.setData(`batch:${batchData.id}`, batchData);
  
  return {
    preferences: savedPreferences,
    batch: batchData,
  };
}

// ========================= 6. API 客户端示例 =========================

async function apiClientExample() {
  try {
    // 设置认证头
    apiClient.setAuthToken('your-jwt-token');

    // 获取产品列表
    const products = await apiClient.get<Product[]>('/products');
    logger.info('Products fetched', 'ApiClient', { count: products.length });

    // 创建新批次
    const newBatch = await apiClient.post<Batch>('/batches', {
      batchNumber: 'B202412002',
      productId: 'product-001',
      quantity: 500,
      unit: 'kg',
      productionDate: new Date().toISOString(),
    });
    logger.info('Batch created', 'ApiClient', newBatch);

    // 更新批次
    const updatedBatch = await apiClient.put<Batch>(`/batches/${newBatch.id}`, {
      quantity: 600,
    });
    logger.info('Batch updated', 'ApiClient', updatedBatch);

    return {
      products,
      newBatch,
      updatedBatch,
    };
  } catch (error) {
    logger.error('API client error', 'ApiClient', error);
    throw error;
  }
}

// ========================= 7. 平台检测示例 =========================

function platformExample() {
  const platformInfo = {
    type: Platform.type,
    isWeb: Platform.isWeb,
    isMobile: Platform.isMobile,
    isReactNative: Platform.isReactNative,
  };

  logger.info('Platform detection', 'Platform', platformInfo);

  // 根据平台执行不同逻辑
  if (Platform.isWeb) {
    console.log('Running on web browser');
    // Web特定逻辑
  } else if (Platform.isReactNative) {
    console.log('Running on React Native');
    // React Native特定逻辑
  }

  return platformInfo;
}

// ========================= 8. 错误处理示例 =========================

async function errorHandlingExample() {
  try {
    // 模拟可能失败的操作
    const riskyOperation = async () => {
      if (Math.random() > 0.5) {
        throw new Error('Random failure');
      }
      return 'Success!';
    };

    const result = await riskyOperation();
    logger.info('Operation succeeded', 'ErrorHandling', result);
    return result;
  } catch (error) {
    logger.error('Operation failed', 'ErrorHandling', error);
    
    // 可以根据错误类型进行不同处理
    if (error instanceof Error) {
      return `Error: ${error.message}`;
    }
    
    return 'Unknown error occurred';
  }
}

// ========================= 9. 完整示例函数 =========================

export async function runExamples() {
  logger.info('Starting examples', 'Examples');

  try {
    // 1. 平台检测
    const platformInfo = platformExample();

    // 2. 日期工具
    const dateResults = dateUtilsExample();

    // 3. 存储示例
    const storageResults = await storageExample();

    // 4. 数据验证
    const validationResults = {
      user: validateUserRegistration({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        phone: '13800138000',
      }),
      batch: validateBatch({
        batchNumber: 'B202412001',
        productName: '有机苹果',
        quantity: 1000,
        productionDate: '2024-12-01',
        expiryDate: '2024-12-31',
      }),
    };

    // 5. 错误处理
    const errorResult = await errorHandlingExample();

    // 汇总结果
    const results = {
      platform: platformInfo,
      dates: dateResults,
      storage: storageResults,
      validation: validationResults,
      error: errorResult,
    };

    logger.info('All examples completed', 'Examples', results);
    return results;
  } catch (error) {
    logger.error('Examples failed', 'Examples', error);
    throw error;
  }
}

// ========================= 10. 类型使用示例 =========================

// 定义用户数据
const exampleUser: User = {
  id: '1',
  username: 'admin',
  email: 'admin@example.com',
  displayName: '系统管理员',
  firstName: '管理',
  lastName: '员',
  role: {
    id: 'admin',
    name: '系统管理员',
    description: '具有所有权限的管理员角色',
    level: 1,
    permissions: [],
    isSystem: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1,
  },
  permissions: [
    {
      id: 'perm-1',
      name: '产品管理',
      displayName: '产品管理权限',
      resource: 'products',
      action: 'manage',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      version: 1,
    },
  ],
  isActive: true,
  isVerified: true,
  lastLoginAt: '2024-12-01T08:00:00Z',
  loginCount: 10,
  preferences: {
    theme: 'light',
    language: 'zh-CN',
    timezone: 'Asia/Shanghai',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '24h',
    notifications: {
      email: true,
      push: true,
      sms: false,
      desktop: true,
      categories: {
        system: true,
        security: true,
        updates: false,
      },
    },
    layout: {
      sidebarCollapsed: false,
      compactMode: false,
      showTooltips: true,
      animationsEnabled: true,
    },
    itemsPerPage: 20,
    autoRefresh: true,
    autoRefreshInterval: 30000,
    defaultViews: {},
    favorites: [],
    recentItems: [],
  },
  security: {
    passwordChangeRequired: false,
    mfaEnabled: false,
    mfaMethods: [],
    maxSessions: 5,
    sessionTimeout: 30,
    failedLoginAttempts: 0,
    trustedDevices: [],
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-12-01T08:00:00Z',
  version: 1,
};

// 导出示例
export {
  AuthExample,
  validateUserRegistration,
  validateBatch,
  dateUtilsExample,
  storageExample,
  apiClientExample,
  platformExample,
  errorHandlingExample,
  exampleUser,
};

// 默认导出
export default runExamples;