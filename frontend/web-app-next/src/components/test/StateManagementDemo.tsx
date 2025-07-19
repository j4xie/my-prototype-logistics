/**
 * 状态管理集成扩展演示组件
 * TASK-P3-017: 展示AI状态管理和离线状态管理功能
 */

'use client';

import React from 'react';
import {
  useAiCache,
  useAiBatch,
  useAiPerformance,
  useAiErrors,
  useOfflineState
} from '@/hooks/useAiState';
import { useAppAiOperations } from '@/store/appStore';
import { QueueStatus, SyncStatus } from '@/types/state';

export default function StateManagementDemo() {
  const aiCache = useAiCache();
  const aiBatch = useAiBatch();
  const aiPerformance = useAiPerformance();
  const aiErrors = useAiErrors();
  const offlineState = useOfflineState();
  const aiOperations = useAppAiOperations();

  // 测试AI缓存功能
  const testAiCache = () => {
    aiCache.updateCacheStats({
      l1Size: Math.floor(Math.random() * 100),
      l2Size: Math.floor(Math.random() * 500),
      cacheStrategy: 'lru'
    });
    aiCache.updateHitRate(Math.random() > 0.3); // 70%命中率
  };

  // 测试AI批量处理
  const testAiBatch = () => {
    if (!aiBatch.batch.processing) {
      aiBatch.startProcessing();
      aiBatch.updateQueueSize(Math.floor(Math.random() * 20) + 5);

      setTimeout(() => {
        aiBatch.incrementCompleted();
        aiBatch.updateProcessingTime(Math.floor(Math.random() * 1000) + 200);
        aiBatch.stopProcessing();
      }, 2000);
    }
  };

  // 测试AI性能监控
  const testAiPerformance = () => {
    aiPerformance.recordResponseTime(Math.floor(Math.random() * 500) + 100);
    aiPerformance.calculateThroughput(Math.floor(Math.random() * 100) + 50);
    aiPerformance.updateMetrics({
      errorRate: Math.random() * 5, // 0-5%错误率
    });
  };

  // 测试AI错误处理
  const testAiErrors = () => {
    if (Math.random() > 0.7) {
      aiErrors.recordError('模拟AI处理错误');
      if (aiErrors.errors.errorCount > 5) {
        aiErrors.openCircuitBreaker();
      }
    } else {
      aiErrors.clearErrors();
      aiErrors.closeCircuitBreaker();
    }
  };

  // 测试离线状态管理
  const testOfflineState = () => {
    offlineState.setOfflineMode(!offlineState.offline.isOfflineMode);
    offlineState.updateQueueStatus(
      offlineState.offline.isOfflineMode ? QueueStatus.PROCESSING : QueueStatus.IDLE
    );
  };

  // 测试同步功能
  const testSync = async () => {
    await offlineState.startSync();
  };

  // 测试AI操作队列
  const testAiOperations = () => {
    aiOperations.addAiOperation({
      type: 'data-analysis',
      payload: { data: 'test-data-' + Date.now() },
      priority: 'normal',
      maxRetries: 3
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          状态管理集成扩展演示 (TASK-P3-017)
        </h1>

        {/* AI缓存状态演示 */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">AI缓存状态管理</h2>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">L1缓存:</span> {aiCache.cache.l1Size}
              </div>
              <div>
                <span className="font-medium">L2缓存:</span> {aiCache.cache.l2Size}
              </div>
              <div>
                <span className="font-medium">命中率:</span> {aiCache.cache.hitRate.toFixed(1)}%
              </div>
              <div>
                <span className="font-medium">总请求:</span> {aiCache.cache.totalRequests}
              </div>
            </div>
          </div>
          <button
            onClick={testAiCache}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            测试AI缓存
          </button>
        </div>

        {/* AI批量处理演示 */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">AI批量处理</h2>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">队列大小:</span> {aiBatch.batch.queueSize}
              </div>
              <div>
                <span className="font-medium">处理状态:</span>
                <span className={`ml-1 ${aiBatch.batch.processing ? 'text-green-600' : 'text-gray-600'}`}>
                  {aiBatch.batch.processing ? '处理中' : '空闲'}
                </span>
              </div>
              <div>
                <span className="font-medium">已完成:</span> {aiBatch.batch.completedJobs}
              </div>
              <div>
                <span className="font-medium">平均时间:</span> {aiBatch.batch.averageProcessingTime}ms
              </div>
            </div>
          </div>
          <button
            onClick={testAiBatch}
            disabled={aiBatch.batch.processing}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400 transition-colors"
          >
            {aiBatch.batch.processing ? '处理中...' : '测试批量处理'}
          </button>
        </div>

        {/* AI性能监控演示 */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">AI性能监控</h2>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">响应时间:</span> {aiPerformance.performance.responseTime}ms
              </div>
              <div>
                <span className="font-medium">吞吐量:</span> {aiPerformance.performance.throughput}/s
              </div>
              <div>
                <span className="font-medium">错误率:</span> {aiPerformance.performance.errorRate.toFixed(2)}%
              </div>
              <div>
                <span className="font-medium">系统健康:</span>
                <span className={`ml-1 ${
                  aiPerformance.performance.systemHealth > 80 ? 'text-green-600' :
                  aiPerformance.performance.systemHealth > 60 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {aiPerformance.performance.systemHealth}%
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={testAiPerformance}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 transition-colors"
          >
            测试性能监控
          </button>
        </div>

        {/* AI错误处理演示 */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">AI错误处理</h2>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">错误计数:</span> {aiErrors.errors.errorCount}
              </div>
              <div>
                <span className="font-medium">熔断器:</span>
                <span className={`ml-1 ${aiErrors.errors.circuitBreakerOpen ? 'text-red-600' : 'text-green-600'}`}>
                  {aiErrors.errors.circuitBreakerOpen ? '开启' : '关闭'}
                </span>
              </div>
              <div>
                <span className="font-medium">降级模式:</span>
                <span className={`ml-1 ${aiErrors.errors.degradedMode ? 'text-yellow-600' : 'text-green-600'}`}>
                  {aiErrors.errors.degradedMode ? '启用' : '正常'}
                </span>
              </div>
              <div>
                <span className="font-medium">最后错误:</span>
                <span className="ml-1 text-xs">
                  {aiErrors.errors.lastError ? aiErrors.errors.lastError.substring(0, 20) + '...' : '无'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={testAiErrors}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
          >
            测试错误处理
          </button>
        </div>

        {/* 离线状态管理演示 */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">离线状态管理</h2>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">离线模式:</span>
                <span className={`ml-1 ${offlineState.offline.isOfflineMode ? 'text-red-600' : 'text-green-600'}`}>
                  {offlineState.offline.isOfflineMode ? '离线' : '在线'}
                </span>
              </div>
              <div>
                <span className="font-medium">队列状态:</span> {offlineState.offline.queueInfo.status}
              </div>
              <div>
                <span className="font-medium">同步状态:</span>
                <span className={`ml-1 ${
                  offlineState.offline.sync.status === SyncStatus.SYNCING ? 'text-blue-600' :
                  offlineState.offline.sync.status === SyncStatus.SUCCESS ? 'text-green-600' :
                  offlineState.offline.sync.status === SyncStatus.ERROR ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {offlineState.offline.sync.status}
                </span>
              </div>
              <div>
                <span className="font-medium">同步进度:</span> {offlineState.offline.sync.progress}%
              </div>
            </div>
          </div>
          <div className="space-x-2">
            <button
              onClick={testOfflineState}
              className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 transition-colors"
            >
              切换离线模式
            </button>
            <button
              onClick={testSync}
              disabled={offlineState.offline.sync.status === SyncStatus.SYNCING}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
            >
              {offlineState.offline.sync.status === SyncStatus.SYNCING ? '同步中...' : '触发同步'}
            </button>
          </div>
        </div>

        {/* AI操作队列演示 */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">AI操作队列</h2>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="text-sm mb-2">
              <span className="font-medium">队列中操作数:</span> {aiOperations.aiOperations.length}
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {aiOperations.aiOperations.slice(-5).map((operation) => (
                <div key={operation.id} className="text-xs bg-white p-2 rounded border">
                  <span className="font-medium">{operation.type}</span> -
                  <span className={`ml-1 ${
                    operation.status === 'completed' ? 'text-green-600' :
                    operation.status === 'processing' ? 'text-blue-600' :
                    operation.status === 'failed' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {operation.status}
                  </span>
                  <span className="ml-2 text-gray-500">
                    优先级: {operation.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={testAiOperations}
            className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 transition-colors"
          >
            添加AI操作
          </button>
        </div>

        {/* 综合状态展示 */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="text-md font-semibold text-blue-800 mb-2">系统综合状态</h3>
          <div className="text-sm text-blue-700">
            <p>AI系统健康度: <span className="font-medium">{aiPerformance.performance.systemHealth}%</span></p>
            <p>缓存效率: <span className="font-medium">{aiCache.cache.hitRate.toFixed(1)}%</span></p>
            <p>网络状态: <span className="font-medium">{offlineState.offline.network.online ? '在线' : '离线'}</span></p>
            <p>活跃操作: <span className="font-medium">{aiOperations.aiOperations.filter(op => op.status === 'processing').length}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
