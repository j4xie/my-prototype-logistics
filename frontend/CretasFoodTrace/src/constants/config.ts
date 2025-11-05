import { Platform } from 'react-native';

// API配置 - 使用本地Java Spring Boot后端
// 注意：
// - iOS模拟器: 'http://localhost:10010'
// - Android模拟器: 'http://10.0.2.2:10010' (10.0.2.2是Android模拟器访问主机的特殊IP)
// - 真机设备: 'http://[你的电脑IP]:10010' (如: http://100.110.227.100:10010)
// - JAR位置: ~/Downloads/cretas-backend-system-main/target/cretas-backend-system-1.0.0.jar
// - 远程服务器: 'http://139.196.165.140:10010' (备用)
//
// 旧Node.js后端已停用（已备份至 backend-nodejs-backup-20251030）

// 根据平台自动选择API地址
const getApiBaseUrl = () => {
  if (__DEV__) {
    // 开发环境：根据平台选择
    if (Platform.OS === 'android') {
      // Android模拟器使用10.0.2.2访问主机
      return 'http://10.0.2.2:10010';
    } else {
      // iOS模拟器可以使用localhost
      return 'http://localhost:10010';
    }
  } else {
    // 生产环境：使用远程服务器
    return 'http://139.196.165.140:10010';
  }
};

export const API_BASE_URL = getApiBaseUrl();

// 默认工厂ID（用于API调用）
// 测试工厂: F001 (测试工厂 - 匹配后端数据库)
// 注意: 后端数据库中使用 F001 作为测试工厂ID
export const DEFAULT_FACTORY_ID = 'F001';

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