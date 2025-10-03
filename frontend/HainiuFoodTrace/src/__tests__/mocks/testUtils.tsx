/**
 * 测试工具函数
 * 提供通用的测试辅助功能
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 创建测试用的QueryClient
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// 全局测试包装组件
interface AllTheProvidersProps {
  children: React.ReactNode;
}

const AllTheProviders: React.FC<AllTheProvidersProps> = ({ children }) => {
  const queryClient = createTestQueryClient();
  
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        {children}
      </NavigationContainer>
    </QueryClientProvider>
  );
};

// 自定义渲染函数
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// 重新导出所有testing-library函数
export * from '@testing-library/react-native';

// 覆盖render函数
export { customRender as render };

/**
 * 创建Mock用户对象
 */
export const createMockUser = (userType: 'platform' | 'factory' = 'factory', role?: string) => {
  if (userType === 'platform') {
    return {
      id: 'platform-test-001',
      username: 'test_platform_user',
      email: 'test@platform.com',
      phone: '+86138000000001',
      fullName: '测试平台用户',
      lastLoginAt: '2025-01-14T08:00:00.000Z',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2025-01-14T08:00:00.000Z',
      isActive: true,
      userType: 'platform' as const,
      platformUser: {
        role: role || 'platform_super_admin',
        permissions: ['platform_management', 'user_management']
      }
    };
  } else {
    return {
      id: 'factory-test-001',
      username: 'test_factory_user',
      email: 'test@factory.com',
      phone: '+86138000000002',
      fullName: '测试工厂用户',
      lastLoginAt: '2025-01-14T08:00:00.000Z',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2025-01-14T08:00:00.000Z',
      isActive: true,
      userType: 'factory' as const,
      factoryUser: {
        role: role || 'operator',
        factoryId: 'FAC001',
        department: 'processing',
        position: '测试职位',
        permissions: ['production_operation']
      }
    };
  }
};

/**
 * 创建Mock Token对象
 */
export const createMockTokens = () => ({
  accessToken: 'mock_access_token_12345',
  refreshToken: 'mock_refresh_token_67890',
  tokenType: 'Bearer',
  expiresIn: 3600
});

/**
 * 创建Mock设备信息
 */
export const createMockDeviceInfo = () => ({
  deviceId: 'test-device-123',
  deviceModel: 'Test Device Model',
  osVersion: '14.0',
  appVersion: '1.0.0',
  platform: 'ios' as const
});

/**
 * 等待异步操作完成
 */
export const waitForAsync = async (ms: number = 0) => {
  await new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Mock导航对象
 */
export const createMockNavigation = () => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
  setParams: jest.fn(),
  isFocused: jest.fn(() => true),
  canGoBack: jest.fn(() => false),
  getId: jest.fn(() => 'test-screen-id'),
  getParent: jest.fn(),
  getState: jest.fn(() => ({ routes: [], index: 0 })),
  push: jest.fn(),
  pop: jest.fn(),
  popToTop: jest.fn(),
  replace: jest.fn(),
  reset: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  removeListener: jest.fn()
});

/**
 * Mock路由对象
 */
export const createMockRoute = (params: any = {}) => ({
  key: 'test-route-key',
  name: 'TestScreen',
  params
});

/**
 * 测试断言辅助函数
 */
export const expectElementToBeVisible = (element: any) => {
  expect(element).toBeTruthy();
  expect(element).toBeOnTheScreen();
};

export const expectElementToHaveText = (element: any, text: string) => {
  expect(element).toBeTruthy();
  expect(element).toHaveDisplayValue(text);
};

/**
 * 模拟网络状态
 */
export const mockNetworkState = (isConnected: boolean = true) => {
  const mockNetInfo = require('@react-native-community/netinfo');
  mockNetInfo.fetch.mockResolvedValue({
    isConnected,
    isInternetReachable: isConnected,
    type: isConnected ? 'wifi' : 'none',
    details: {
      isConnectionExpensive: false,
    },
  });
};

/**
 * 清理测试环境
 */
export const cleanupTest = () => {
  jest.clearAllMocks();
  jest.resetAllMocks();
};