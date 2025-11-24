import { Platform } from 'react-native';
import Constants from 'expo-constants';

// API配置 - 使用远程服务器的不同环境
// 环境说明：
// - 测试环境 (TEST): 'http://139.196.165.140:10010' - 用于开发测试
// - 生产环境 (PROD): 'http://139.196.165.140:3001' - 用于正式部署
//
// 切换环境方法：
// - 测试环境: npm run android:test 或 EXPO_PUBLIC_ENV=test npm run android
// - 生产环境: npm run android:prod 或 EXPO_PUBLIC_ENV=prod npm run android

// 环境类型
type Environment = 'test' | 'prod';

// 环境配置
const ENV_CONFIG = {
  test: {
    API_URL: 'http://139.196.165.140:10010',
    NAME: '测试环境',
  },
  prod: {
    API_URL: 'http://139.196.165.140:3001',
    NAME: '生产环境',
  },
} as const;

// 获取当前环境（从环境变量读取，默认为test）
const getCurrentEnvironment = (): Environment => {
  const env = Constants.expoConfig?.extra?.env || process.env.EXPO_PUBLIC_ENV || 'test';
  return (env === 'prod' ? 'prod' : 'test') as Environment;
};

// 当前环境
export const CURRENT_ENV = getCurrentEnvironment();

// 根据环境选择API地址
const getApiBaseUrl = (): string => {
  const config = ENV_CONFIG[CURRENT_ENV];
  console.log(`[Config] 当前环境: ${config.NAME} (${CURRENT_ENV})`);
  console.log(`[Config] API地址: ${config.API_URL}`);
  return config.API_URL;
};

export const API_BASE_URL = getApiBaseUrl();

// 默认工厂ID（用于API调用）
// 测试工厂: CRETAS_2024_001 (白垩纪水产加工厂 - 匹配后端数据库)
// 注意: 后端数据库中使用 CRETAS_2024_001 作为测试工厂ID
export const DEFAULT_FACTORY_ID = 'CRETAS_2024_001';

// DeepSeek配置
export const DEEPSEEK_CONFIG = {
  API_URL: 'https://api.deepseek.com/v1/chat/completions',
  MODEL: 'deepseek-chat',
  MAX_TOKENS: 4000,
  TEMPERATURE: 0.3,
};

// 应用配置
export const APP_CONFIG = {
  NAME: '白垩纪食品溯源',
  VERSION: '1.0.0',
  COMPANY_CODE: 'CRETAS',
  SUPPORTED_LANGUAGES: ['zh-CN'],
};

// 权限配置
export const PERMISSIONS = {
  CAMERA: 'camera',
  LOCATION: 'location',
  STORAGE: 'storage',
  BIOMETRIC: 'biometric',
};

// API请求配置
export const API_REQUEST_CONFIG = {
  // 超时设置（毫秒）
  TIMEOUT: {
    DEFAULT: 30000,        // 30秒 - 普通请求
    LONG: 60000,           // 60秒 - 文件上传等长时间操作
    SHORT: 10000,          // 10秒 - 快速查询
  },
  // 重试配置
  RETRY: {
    MAX_RETRIES: 3,        // 最大重试次数
    RETRY_DELAY: 1000,     // 重试延迟（毫秒）
    BACKOFF_MULTIPLIER: 2, // 指数退避倍数
  },
  // 请求头配置
  HEADERS: {
    CONTENT_TYPE: 'application/json',
    ACCEPT: 'application/json',
  },
};