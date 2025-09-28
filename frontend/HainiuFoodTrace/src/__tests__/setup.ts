/**
 * 海牛食品溯源系统 - 测试环境设置
 * 配置全局测试环境和Mock
 */

import 'react-native-gesture-handler/jestSetup';

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
    setParams: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
    name: 'TestScreen',
  }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));

// Mock React Navigation Stack
jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => ({
    Navigator: 'Navigator',
    Screen: 'Screen',
  }),
}));

// Mock React Navigation Bottom Tabs
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: 'Navigator',
    Screen: 'Screen',
  }),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => 
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Expo SecureStore
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock Expo Location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({
    coords: {
      latitude: 37.7749,
      longitude: -122.4194,
      altitude: 0,
      accuracy: 5,
      heading: 0,
      speed: 0,
    },
    timestamp: Date.now(),
  })),
  watchPositionAsync: jest.fn(() => Promise.resolve({
    remove: jest.fn(),
  })),
}));

// Mock Expo Local Authentication
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(() => Promise.resolve(true)),
  isEnrolledAsync: jest.fn(() => Promise.resolve(true)),
  authenticateAsync: jest.fn(() => Promise.resolve({
    success: true,
    error: null,
  })),
  supportedAuthenticationTypesAsync: jest.fn(() => Promise.resolve([1, 2])), // FINGERPRINT, FACIAL_RECOGNITION
}));

// Mock Expo Notifications
jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ 
    status: 'granted',
    granted: true,
    canAskAgain: true,
    expires: 'never'
  })),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ 
    status: 'granted',
    granted: true 
  })),
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('notification-id')),
  cancelNotificationAsync: jest.fn(() => Promise.resolve()),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
}));

// Mock Expo ImagePicker
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({
    cancelled: false,
    assets: [{
      uri: 'file://test-image.jpg',
      width: 1024,
      height: 768,
      type: 'image',
      fileName: 'test-image.jpg',
    }]
  })),
  launchCameraAsync: jest.fn(() => Promise.resolve({
    cancelled: false,
    assets: [{
      uri: 'file://test-camera.jpg',
      width: 1024,
      height: 768,
      type: 'image',
      fileName: 'test-camera.jpg',
    }]
  })),
}));

// Mock Expo BarCodeScanner
jest.mock('expo-barcode-scanner', () => ({
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  BarCodeScanner: {
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    Constants: {
      BarCodeType: {
        qr: 'qr',
      },
    },
  },
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
    details: {
      isConnectionExpensive: false,
    },
  })),
  addEventListener: jest.fn(() => jest.fn()), // 返回取消监听的函数
}));

// Mock Axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
    interceptors: {
      request: {
        use: jest.fn(),
      },
      response: {
        use: jest.fn(),
      },
    },
  })),
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  put: jest.fn(() => Promise.resolve({ data: {} })),
  delete: jest.fn(() => Promise.resolve({ data: {} })),
}));

// 全局测试配置
global.console = {
  ...console,
  warn: jest.fn(), // 抑制警告信息
  error: jest.fn(), // 抑制错误信息（测试中的预期错误）
};

// 设置测试超时
jest.setTimeout(10000);

// Mock timers for animations
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});