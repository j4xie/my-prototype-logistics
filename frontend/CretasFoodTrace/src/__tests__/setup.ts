/**
 * Jest 全局测试配置
 * 在所有测试运行前执行
 */

import '@testing-library/react-native/extend-expect';

// Mock console方法以减少测试输出噪音
global.console = {
  ...console,
  // 保留error和warn以便调试
  error: jest.fn(),
  warn: jest.fn(),
  // 静默log和debug
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};

// Mock Logger 以避免 Platform.OS 问题
jest.mock('../utils/logger', () => {
  const mockContextLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  return {
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn(() => mockContextLogger),
      createContextLogger: jest.fn(() => mockContextLogger),
    },
    Logger: jest.fn().mockImplementation(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn(() => mockContextLogger),
      createContextLogger: jest.fn(() => mockContextLogger),
    })),
    ContextLogger: jest.fn().mockImplementation(() => mockContextLogger),
    LogLevel: {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
    },
  };
});

// Mock StorageService
jest.mock('../services/storage/storageService', () => ({
  StorageService: {
    getSecureItem: jest.fn(() => Promise.resolve(null)),
    setSecureItem: jest.fn(() => Promise.resolve()),
    removeSecureItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
  },
}));

// Mock apiClient with a real axios instance for MockAdapter compatibility
const axios = require('axios');
const mockAxiosInstance = axios.create({
  baseURL: 'http://localhost:10010',
  timeout: 30000,
});

// Add response interceptor to unwrap data (like the real apiClient does)
mockAxiosInstance.interceptors.response.use(
  (response: any) => response.data,
  (error: any) => Promise.reject(error)
);

jest.mock('../services/api/apiClient', () => ({
  apiClient: mockAxiosInstance,
}));

// Mock factoryIdHelper to return a default factory ID for tests
jest.mock('../utils/factoryIdHelper', () => {
  const DEFAULT_FACTORY = 'CRETAS_2024_001';
  return {
    getCurrentFactoryId: jest.fn((provided?: string) => provided || DEFAULT_FACTORY),
    getFactoryId: jest.fn((provided?: string) => provided || DEFAULT_FACTORY),
    requireFactoryId: jest.fn((provided?: string) => provided || DEFAULT_FACTORY),
    getFactoryIdWithFallback: jest.fn((provided?: string) => provided || DEFAULT_FACTORY),
    isValidFactoryId: jest.fn((id: string | null | undefined) => !!(id && id.trim() !== '')),
    isFactoryUser: jest.fn(() => true),
    isPlatformAdmin: jest.fn(() => false),
    FactoryIdStrategy: {
      REQUIRED: 'required',
      FROM_USER: 'from_user',
      OPTIONAL: 'optional',
      PLATFORM_ADMIN: 'platform_admin',
    },
  };
});

// Mock React Native模块
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Mock Expo模块
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({
    coords: {
      latitude: 31.2304,
      longitude: 121.4737,
      altitude: 0,
      accuracy: 10,
      altitudeAccuracy: 0,
      heading: 0,
      speed: 0,
    },
    timestamp: Date.now(),
  })),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({
    canceled: false,
    assets: [{ uri: 'file://mock-image.jpg', width: 100, height: 100 }],
  })),
  MediaTypeOptions: {
    Images: 'Images',
  },
}));

jest.mock('expo-local-authentication', () => ({
  authenticateAsync: jest.fn(() => Promise.resolve({ success: true })),
  hasHardwareAsync: jest.fn(() => Promise.resolve(true)),
  isEnrolledAsync: jest.fn(() => Promise.resolve(true)),
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: jest.fn(),
}));

// Mock React Native Paper
jest.mock('react-native-paper', () => {
  const RealModule = jest.requireActual('react-native-paper');
  return {
    ...RealModule,
    // Portal需要特殊处理
    Portal: ({ children }: any) => children,
  };
});

// Mock Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// 设置测试超时时间
jest.setTimeout(10000);
