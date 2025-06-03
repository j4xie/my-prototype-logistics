/**
 * AI性能监控面板
 * 
 * 实时展示AI数据分析相关的性能指标和统计信息
 */

'use client';

import React, { useState, useEffect } from 'react';
import { getGlobalCacheManager } from '@/lib/ai-cache-manager';
import { getGlobalBatchController } from '@/lib/ai-batch-controller';

interface PerformanceMetrics {
  cache: {
    hitRate: number;
    l1Hits: number;
    l2Hits: number;
    misses: number;
    l1Size: number;
    totalRequests: number;
  };
  batch: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    cacheHits: number;
    averageResponseTime: number;
    peakConcurrency: number;
    queueSize: number;
    activeRequests: number;
  };
}

export const AiPerformanceMonitor: React.FC<{
  className?: string;
  refreshInterval?: number;
}> = ({ className = '', refreshInterval = 5000 }) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateMetrics = () => {
      try {
        const cacheManager = getGlobalCacheManager();
        const batchController = getGlobalBatchController();
        
        const cacheStats = cacheManager.getStatistics();
        const batchStats = batchController.getStats();
        const queueStatus = batchController.getQueueStatus();

        setMetrics({
          cache: {
            hitRate: cacheStats.totalHitRate,
            l1Hits: cacheStats.l1Hits,
            l2Hits: cacheStats.l2Hits,
            misses: cacheStats.misses,
            l1Size: cacheStats.l1Size,
            totalRequests: cacheStats.totalRequests
          },
          batch: {
            totalRequests: batchStats.totalRequests,
            successfulRequests: batchStats.successfulRequests,
            failedRequests: batchStats.failedRequests,
            cacheHits: batchStats.cacheHits,
            averageResponseTime: batchStats.averageResponseTime,
            peakConcurrency: batchStats.peakConcurrency,
            queueSize: queueStatus.queueSize,
            activeRequests: queueStatus.activeRequests
          }
        });
      } catch (error) {
        console.warn('[AiPerformanceMonitor] 更新性能指标失败:', error);
      }
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  // 开发环境才显示
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className={`fixed bottom-4 right-4 z-50 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 ${className}`}
      >
        性能监控
      </button>
    );
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-xl border max-w-md ${className}`}>
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium text-gray-900">AI性能监控</h3>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {metrics && (
          <div className="space-y-4">
            {/* 缓存性能 */}
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">缓存性能</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">命中率:</span>
                  <span className={`font-medium ${
                    metrics.cache.hitRate > 0.7 ? 'text-green-600' : 
                    metrics.cache.hitRate > 0.4 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {(metrics.cache.hitRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">L1缓存:</span>
                  <span className="font-medium text-blue-600">{metrics.cache.l1Size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">L1命中:</span>
                  <span className="font-medium text-green-600">{metrics.cache.l1Hits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">L2命中:</span>
                  <span className="font-medium text-blue-600">{metrics.cache.l2Hits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">未命中:</span>
                  <span className="font-medium text-red-600">{metrics.cache.misses}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">总请求:</span>
                  <span className="font-medium text-gray-900">{metrics.cache.totalRequests}</span>
                </div>
              </div>
            </div>

            {/* 批量处理性能 */}
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">批量处理</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">成功率:</span>
                  <span className={`font-medium ${
                    metrics.batch.totalRequests > 0 && 
                    (metrics.batch.successfulRequests / metrics.batch.totalRequests) > 0.9 
                      ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {metrics.batch.totalRequests > 0 
                      ? ((metrics.batch.successfulRequests / metrics.batch.totalRequests) * 100).toFixed(1) + '%'
                      : '0%'
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">平均耗时:</span>
                  <span className="font-medium text-blue-600">
                    {metrics.batch.averageResponseTime.toFixed(0)}ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">并发峰值:</span>
                  <span className="font-medium text-purple-600">{metrics.batch.peakConcurrency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">队列大小:</span>
                  <span className={`font-medium ${
                    metrics.batch.queueSize > 10 ? 'text-red-600' : 
                    metrics.batch.queueSize > 5 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {metrics.batch.queueSize}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">活跃请求:</span>
                  <span className="font-medium text-blue-600">{metrics.batch.activeRequests}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">批量缓存:</span>
                  <span className="font-medium text-green-600">{metrics.batch.cacheHits}</span>
                </div>
              </div>
            </div>

            {/* 状态指示器 */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  metrics.cache.hitRate > 0.7 ? 'bg-green-500' : 
                  metrics.cache.hitRate > 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
                <span className="text-gray-600">缓存健康度</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  metrics.batch.activeRequests < 6 ? 'bg-green-500' : 
                  metrics.batch.activeRequests < 10 ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
                <span className="text-gray-600">负载状态</span>
              </div>
            </div>
          </div>
        )}

        {!metrics && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-600 mt-2">加载性能数据...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiPerformanceMonitor; 