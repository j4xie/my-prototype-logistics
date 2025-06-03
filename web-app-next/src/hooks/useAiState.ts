/**
 * AI状态管理Hook
 * TASK-P3-017: 状态管理集成扩展
 * 提供AI缓存、批量处理、性能监控和错误处理的状态管理
 */

import { useCallback, useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { type AiState, SyncStatus } from '@/types/state';

/**
 * AI缓存状态管理Hook
 */
export const useAiCache = () => {
  const { ai, updateAiCache } = useAppStore((state) => ({
    ai: state.ai,
    updateAiCache: state.updateAiCache,
  }));

  const updateCacheStats = useCallback((stats: Partial<AiState['cache']>) => {
    updateAiCache(stats);
  }, [updateAiCache]);

  const incrementRequests = useCallback(() => {
    updateAiCache({
      totalRequests: ai.cache.totalRequests + 1,
    });
  }, [ai.cache.totalRequests, updateAiCache]);

  const updateHitRate = useCallback((hit: boolean) => {
    const newTotal = ai.cache.totalRequests + 1;
    const currentHits = Math.round(ai.cache.hitRate * ai.cache.totalRequests / 100);
    const newHits = hit ? currentHits + 1 : currentHits;
    const newHitRate = newTotal > 0 ? (newHits / newTotal) * 100 : 0;

    updateAiCache({
      totalRequests: newTotal,
      hitRate: Math.round(newHitRate * 100) / 100, // 保留2位小数
    });
  }, [ai.cache.totalRequests, ai.cache.hitRate, updateAiCache]);

  return {
    cache: ai.cache,
    updateCacheStats,
    incrementRequests,
    updateHitRate,
  };
};

/**
 * AI批量处理状态管理Hook
 */
export const useAiBatch = () => {
  const { ai, updateAiBatch } = useAppStore((state) => ({
    ai: state.ai,
    updateAiBatch: state.updateAiBatch,
  }));

  const startProcessing = useCallback(() => {
    updateAiBatch({ processing: true });
  }, [updateAiBatch]);

  const stopProcessing = useCallback(() => {
    updateAiBatch({ processing: false });
  }, [updateAiBatch]);

  const updateQueueSize = useCallback((size: number) => {
    updateAiBatch({ queueSize: size });
  }, [updateAiBatch]);

  const incrementCompleted = useCallback(() => {
    updateAiBatch({ completedJobs: ai.batch.completedJobs + 1 });
  }, [ai.batch.completedJobs, updateAiBatch]);

  const incrementFailed = useCallback(() => {
    updateAiBatch({ failedJobs: ai.batch.failedJobs + 1 });
  }, [ai.batch.failedJobs, updateAiBatch]);

  const updateProcessingTime = useCallback((time: number) => {
    const currentAvg = ai.batch.averageProcessingTime;
    const totalJobs = ai.batch.completedJobs;
    const newAvg = totalJobs > 0 ? (currentAvg * totalJobs + time) / (totalJobs + 1) : time;

    updateAiBatch({ averageProcessingTime: Math.round(newAvg) });
  }, [ai.batch.averageProcessingTime, ai.batch.completedJobs, updateAiBatch]);

  return {
    batch: ai.batch,
    startProcessing,
    stopProcessing,
    updateQueueSize,
    incrementCompleted,
    incrementFailed,
    updateProcessingTime,
  };
};

/**
 * AI性能监控状态管理Hook
 */
export const useAiPerformance = () => {
  const { ai, updateAiPerformance } = useAppStore((state) => ({
    ai: state.ai,
    updateAiPerformance: state.updateAiPerformance,
  }));

  const updateMetrics = useCallback((metrics: Partial<AiState['performance']>) => {
    updateAiPerformance({
      ...metrics,
      lastUpdated: Date.now(),
    });
  }, [updateAiPerformance]);

  const recordResponseTime = useCallback((time: number) => {
    updateAiPerformance({
      responseTime: time,
      lastUpdated: Date.now(),
    });
  }, [updateAiPerformance]);

  const updateSystemHealth = useCallback((health: number) => {
    // 确保健康度在0-100范围内
    const clampedHealth = Math.max(0, Math.min(100, health));
    updateAiPerformance({
      systemHealth: clampedHealth,
      lastUpdated: Date.now(),
    });
  }, [updateAiPerformance]);

  const calculateThroughput = useCallback((requestsPerSecond: number) => {
    updateAiPerformance({
      throughput: requestsPerSecond,
      lastUpdated: Date.now(),
    });
  }, [updateAiPerformance]);

  return {
    performance: ai.performance,
    updateMetrics,
    recordResponseTime,
    updateSystemHealth,
    calculateThroughput,
  };
};

/**
 * AI错误处理状态管理Hook
 */
export const useAiErrors = () => {
  const { ai, updateAiErrors } = useAppStore((state) => ({
    ai: state.ai,
    updateAiErrors: state.updateAiErrors,
  }));

  const recordError = useCallback((error: string) => {
    updateAiErrors({
      lastError: error,
      errorCount: ai.errors.errorCount + 1,
    });
  }, [ai.errors.errorCount, updateAiErrors]);

  const openCircuitBreaker = useCallback(() => {
    updateAiErrors({
      circuitBreakerOpen: true,
      degradedMode: true,
    });
  }, [updateAiErrors]);

  const closeCircuitBreaker = useCallback(() => {
    updateAiErrors({
      circuitBreakerOpen: false,
      degradedMode: false,
      recoveryTime: Date.now(),
    });
  }, [updateAiErrors]);

  const enableDegradedMode = useCallback(() => {
    updateAiErrors({ degradedMode: true });
  }, [updateAiErrors]);

  const disableDegradedMode = useCallback(() => {
    updateAiErrors({ degradedMode: false });
  }, [updateAiErrors]);

  const clearErrors = useCallback(() => {
    updateAiErrors({
      lastError: null,
      errorCount: 0,
    });
  }, [updateAiErrors]);

  return {
    errors: ai.errors,
    recordError,
    openCircuitBreaker,
    closeCircuitBreaker,
    enableDegradedMode,
    disableDegradedMode,
    clearErrors,
  };
};

/**
 * 综合AI状态管理Hook
 */
export const useAiState = () => {
  const cache = useAiCache();
  const batch = useAiBatch();
  const performance = useAiPerformance();
  const errors = useAiErrors();

  // 自动健康度计算
  useEffect(() => {
    const calculateHealth = () => {
      let health = 100;

      // 基于错误率降低健康度
      if (errors.errors.errorCount > 0) {
        health -= Math.min(50, errors.errors.errorCount * 5);
      }

      // 基于熔断器状态
      if (errors.errors.circuitBreakerOpen) {
        health -= 30;
      }

      // 基于降级模式
      if (errors.errors.degradedMode) {
        health -= 20;
      }

      // 基于缓存命中率
      if (cache.cache.hitRate < 50) {
        health -= 10;
      }

      performance.updateSystemHealth(health);
    };

    calculateHealth();
  }, [
    errors.errors.errorCount,
    errors.errors.circuitBreakerOpen,
    errors.errors.degradedMode,
    cache.cache.hitRate,
    performance,
  ]);

  return {
    cache,
    batch,
    performance,
    errors,
  };
};

/**
 * 离线状态管理Hook
 */
export const useOfflineState = () => {
  const { offlineExtended, setOfflineMode, updateQueueStatus, updateSyncProgress, triggerSync, pauseSync, resumeSync, clearSyncError } = useAppStore((state) => ({
    offlineExtended: state.offlineExtended,
    setOfflineMode: state.setOfflineMode,
    updateQueueStatus: state.updateQueueStatus,
    updateSyncProgress: state.updateSyncProgress,
    triggerSync: state.triggerSync,
    pauseSync: state.pauseSync,
    resumeSync: state.resumeSync,
    clearSyncError: state.clearSyncError,
  }));

  // 网络状态监听
  useEffect(() => {
    const handleOnline = () => {
      setOfflineMode(false);
    };

    const handleOffline = () => {
      setOfflineMode(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [setOfflineMode]);

  const startSync = useCallback(async () => {
    if (offlineExtended.sync.status === SyncStatus.SYNCING) return;

    try {
      await triggerSync();
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }, [offlineExtended.sync.status, triggerSync]);

  return {
    offline: offlineExtended,
    setOfflineMode,
    updateQueueStatus,
    updateSyncProgress,
    startSync,
    pauseSync,
    resumeSync,
    clearSyncError,
  };
};

export default useAiState;
