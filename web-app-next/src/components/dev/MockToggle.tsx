/**
 * TASK-P3-018C Day 1: Mock切换控制台
 *
 * @description 开发环境Mock/Real API切换工具
 * @dependency TASK-P3-018B中央Mock服务 + useMockStatus Hook
 * @created 2025-02-02
 */

'use client';

import React from 'react';
import { useMockStatus, toggleMockAPI, getApiModeDisplay } from '../../hooks/useMockStatus';

/**
 * Mock切换控制台组件
 */
export function MockToggle() {
  const {
    mockEnabled,
    mockHealthy,
    mockHandlers,
    apiMode,
    lastCheck,
    checkHealth
  } = useMockStatus();

  // 只在开发环境显示
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const handleToggle = () => {
    toggleMockAPI(!mockEnabled);
  };

  const handleRefresh = () => {
    checkHealth();
  };

  const formatLastCheck = (timestamp: number): string => {
    if (timestamp === 0) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-xs">
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-800">API Mode</h3>
          <button
            onClick={handleRefresh}
            className="text-xs text-blue-600 hover:text-blue-800"
            title="Refresh status"
          >
            ↻
          </button>
        </div>

        {/* 状态显示 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Current:</span>
            <span className="text-sm font-medium">
              {getApiModeDisplay(apiMode)}
            </span>
          </div>

          {mockEnabled && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Handlers:</span>
              <span className="text-sm font-medium">
                {mockHandlers}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Last Check:</span>
            <span className="text-xs text-gray-500">
              {formatLastCheck(lastCheck)}
            </span>
          </div>
        </div>

        {/* 切换按钮 */}
        <div className="mt-3 flex space-x-2">
          <button
            onClick={handleToggle}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
              mockEnabled
                ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            Switch to {mockEnabled ? 'Real' : 'Mock'} API
          </button>
        </div>

        {/* 健康状态指示器 */}
        <div className="mt-2 flex items-center justify-center">
          <div className={`w-2 h-2 rounded-full mr-2 ${
            apiMode === 'mock' && mockHealthy
              ? 'bg-green-500'
              : apiMode === 'real'
                ? 'bg-blue-500'
                : 'bg-red-500'
          }`} />
          <span className="text-xs text-gray-500">
            {apiMode === 'mock' && mockHealthy
              ? 'Mock service healthy'
              : apiMode === 'real'
                ? 'Using real API'
                : 'Service unavailable'
            }
          </span>
        </div>

        {/* 开发信息 */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer hover:text-gray-700">
                Debug Info
              </summary>
              <div className="mt-1 space-y-1">
                <div>Enabled: {mockEnabled ? 'Yes' : 'No'}</div>
                <div>Healthy: {mockHealthy ? 'Yes' : 'No'}</div>
                <div>Mode: {apiMode}</div>
                <div>Check: {new Date(lastCheck).toLocaleTimeString()}</div>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Mock状态栏组件 (紧凑版)
 */
export function MockStatusBar() {
  const { apiMode, mockHealthy, mockHandlers } = useMockStatus();

  // 只在开发环境显示
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-40">
      <div className="bg-gray-800 text-white px-3 py-1 rounded-full text-xs flex items-center">
        <div className={`w-2 h-2 rounded-full mr-2 ${
          apiMode === 'mock' && mockHealthy
            ? 'bg-green-400'
            : apiMode === 'real'
              ? 'bg-blue-400'
              : 'bg-red-400'
        }`} />
        {getApiModeDisplay(apiMode)}
        {apiMode === 'mock' && (
          <span className="ml-1 text-gray-300">
            ({mockHandlers}h)
          </span>
        )}
      </div>
    </div>
  );
}

export default MockToggle;
