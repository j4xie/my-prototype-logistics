/**
 * TASK-P3-018C Day 1: Mock状态检查Hook
 *
 * @description 检查Mock服务状态，支持开发时API模式可视化
 * @dependency TASK-P3-018B 中央Mock服务 (100%完成)
 * @created 2025-02-02
 */

import { useState, useEffect, useCallback } from 'react';
import { getApiConfig, checkMockHealth, type ApiConfig, type MockHealthStatus } from '../lib/api-config';

/**
 * Mock状态Hook返回类型
 */
export interface MockStatusResult {
  mockEnabled: boolean;
  mockHealthy: boolean;
  mockHandlers: number;
  apiMode: 'mock' | 'real' | 'fallback';
  lastCheck: number;
  config: ApiConfig;
  checkHealth: () => Promise<void>;
}

/**
 * Mock状态检查Hook
 *
 * @description 监控Mock服务健康状态，支持实时API模式切换
 * @returns Mock状态信息和健康检查方法
 */
export function useMockStatus(): MockStatusResult {
  const [status, setStatus] = useState<{
    mockEnabled: boolean;
    mockHealthy: boolean;
    mockHandlers: number;
    apiMode: 'mock' | 'real' | 'fallback';
    lastCheck: number;
  }>({
    mockEnabled: false,
    mockHealthy: false,
    mockHandlers: 0,
    apiMode: 'real',
    lastCheck: 0
  });

  const [config] = useState<ApiConfig>(() => getApiConfig());

  const checkHealth = useCallback(async () => {
    setStatus(prev => ({ ...prev, lastCheck: Date.now() }));

    if (!config.mockEnabled) {
      setStatus(prev => ({
        ...prev,
        mockEnabled: false,
        apiMode: 'real',
        mockHealthy: false,
        mockHandlers: 0
      }));
      return;
    }

    try {
      const healthStatus: MockHealthStatus = await checkMockHealth();

      setStatus(prev => ({
        ...prev,
        mockEnabled: config.mockEnabled,
        mockHealthy: healthStatus.available,
        mockHandlers: healthStatus.handlers,
        apiMode: healthStatus.available ? 'mock' : 'fallback',
        lastCheck: healthStatus.lastCheck
      }));

      // 开发环境日志
      if (process.env.NODE_ENV === 'development') {
        console.info(`[useMockStatus] API Mode: ${healthStatus.available ? 'Mock 🟢' : 'Fallback 🔴'} (${healthStatus.handlers} handlers)`);
      }
    } catch (error) {
      console.warn('[useMockStatus] Health check failed:', error);
      setStatus(prev => ({
        ...prev,
        mockHealthy: false,
        apiMode: 'fallback',
        mockHandlers: 0
      }));
    }
  }, [config.mockEnabled]);

  // 初始化检查
  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // 开发环境定期检查
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && config.mockEnabled) {
      const interval = setInterval(checkHealth, 30000); // 30秒检查一次
      return () => clearInterval(interval);
    }
  }, [checkHealth, config.mockEnabled]);

  return {
    ...status,
    config,
    checkHealth
  };
}

/**
 * Mock切换辅助函数
 */
export const toggleMockAPI = (enabled: boolean): void => {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('Mock toggle only available in development');
    return;
  }

  const url = new URL(window.location.href);
  if (enabled) {
    url.searchParams.set('mock', 'true');
  } else {
    url.searchParams.set('mock', 'false');
  }

  window.location.href = url.toString();
};

/**
 * 获取API模式显示文本
 */
export const getApiModeDisplay = (mode: 'mock' | 'real' | 'fallback'): string => {
  switch (mode) {
    case 'mock':
      return 'Mock API 🟢';
    case 'real':
      return 'Real API 🔵';
    case 'fallback':
      return 'Fallback 🔴';
    default:
      return 'Unknown ⚪';
  }
};
