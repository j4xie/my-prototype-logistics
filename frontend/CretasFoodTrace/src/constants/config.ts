import { Platform } from 'react-native';

// API配置
export const API_BASE_URL = __DEV__
  ? Platform.OS === 'ios'
    ? 'http://100.110.227.85:3001'    // iOS模拟器使用本地IP
    : 'http://10.0.2.2:3001'          // Android模拟器使用10.0.2.2
  : 'https://your-production-api.com';

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