import { Platform } from 'react-native';
import { REACT_APP_API_URL } from '@env';

// API配置 - 使用本地Java Spring Boot后端
// 注意：
// - iOS模拟器: 'http://localhost:10010'
// - Android模拟器: 'http://10.0.2.2:10010' (10.0.2.2是Android模拟器访问主机的特殊IP)
// - 真机设备: 'http://[你的电脑IP]:10010' (如: http://100.110.227.100:10010)
// - JAR位置: ~/Downloads/cretas-backend-system-main/target/cretas-backend-system-1.0.0.jar
// - 远程服务器: 'http://139.196.165.140:10010' (备用)
//
// 旧Node.js后端已停用（已备份至 backend-nodejs-backup-20251030）

// 从环境变量读取API地址，支持多环境配置
const getApiBaseUrl = () => {
  // 优先读取环境变量，支持通过 .env 文件配置不同环境
  // 注意：必须使用 import from '@env'，不能用 process.env
  const envUrl = REACT_APP_API_URL;

  if (envUrl && envUrl.trim() !== '') {
    // P4 Fix: Wrap console.log with __DEV__ to avoid production logging
    if (__DEV__) {
      console.log(`[API Config] Using API URL from environment: ${envUrl}`);
    }
    return envUrl;
  }

  // 默认值：本地测试 (10.0.2.2 = Android emulator host)
  const defaultUrl = 'http://10.0.2.2:10010';
  // P4 Fix: Wrap console.log with __DEV__ to avoid production logging
  if (__DEV__) {
    console.log(`[API Config] Using default API URL: ${defaultUrl}`);
  }
  return defaultUrl;
};

export const API_BASE_URL = getApiBaseUrl();

// 默认工厂ID（用于API调用）
// 测试工厂: CRETAS_2024_001 (白垩纪水产加工厂 - 匹配后端数据库)
// 注意: 后端数据库中使用 CRETAS_2024_001 作为测试工厂ID
export const DEFAULT_FACTORY_ID = 'F001';

// LLM配置
export const LLM_CONFIG = {
  API_URL: '', // 由后端统一配置
  MODEL: '', // 由后端统一配置
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