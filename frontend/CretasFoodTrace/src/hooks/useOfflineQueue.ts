/**
 * 离线队列 Hook
 *
 * 封装离线队列操作，自动处理在线/离线状态
 * 在线时直接调用API，离线时入队等待同步
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */

import { useState, useEffect, useCallback } from 'react';
import { offlineQueueService } from '../services/offline/OfflineQueueService';
import { networkMonitor } from '../services/offline/NetworkMonitor';
import { syncService } from '../services/offline/SyncService';
import type {
  UseOfflineQueueReturn,
  OfflineQueueItem,
  QueueStats,
  SyncResult,
  NetworkState,
} from '../services/offline/types';

// ==================== useOfflineQueue Hook ====================

/**
 * 离线队列 Hook
 *
 * 提供离线模式支持，自动管理队列和同步
 *
 * @example
 * ```tsx
 * const { isOnline, queueStats, enqueue, sync } = useOfflineQueue();
 *
 * // 离线时入队，在线时直接发送
 * const handleSubmit = async (data) => {
 *   if (isOnline) {
 *     await apiClient.post('/api/materials', data);
 *   } else {
 *     await enqueue({
 *       entityType: 'material_batch',
 *       operation: 'CREATE',
 *       endpoint: '/api/materials',
 *       method: 'POST',
 *       payload: data,
 *     });
 *   }
 * };
 * ```
 */
export function useOfflineQueue(): UseOfflineQueueReturn {
  const [isOnline, setIsOnline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueStats, setQueueStats] = useState<QueueStats>({
    total: 0,
    pending: 0,
    syncing: 0,
    synced: 0,
    failed: 0,
    byEntityType: {} as never,
  });

  // ==================== 初始化 ====================

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        // 初始化队列服务
        await offlineQueueService.initialize();

        // 初始化网络监控
        await networkMonitor.initialize();

        // 获取初始状态
        const online = await networkMonitor.isOnline();
        const stats = await offlineQueueService.getStats();

        if (isMounted) {
          setIsOnline(online);
          setQueueStats(stats);
        }
      } catch (error) {
        console.error('[useOfflineQueue] Initialization failed:', error);
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  // ==================== 网络状态监听 ====================

  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe(async (state: NetworkState) => {
      setIsOnline(state.isConnected);

      // 网络恢复时自动同步
      if (state.isConnected && !syncService.isCurrentlySyncing()) {
        console.log('[useOfflineQueue] Network restored, triggering auto-sync');
        try {
          await syncService.syncAll();
          // 同步完成后更新统计
          const stats = await offlineQueueService.getStats();
          setQueueStats(stats);
        } catch (error) {
          console.error('[useOfflineQueue] Auto-sync failed:', error);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // ==================== 同步状态监听 ====================

  useEffect(() => {
    const unsubscribe = syncService.subscribe((event) => {
      if (event.type === 'sync_start') {
        setIsSyncing(true);
      } else if (event.type === 'sync_complete' || event.type === 'sync_error') {
        setIsSyncing(false);
        // 更新统计
        offlineQueueService.getStats().then(setQueueStats).catch(console.error);
      } else if (event.type === 'sync_progress') {
        // 可以在这里更新进度信息
        console.log('[useOfflineQueue] Sync progress:', event.data);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // ==================== 队列操作 ====================

  /**
   * 添加项目到队列
   */
  const enqueue = useCallback(
    async (
      item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'status' | 'retryCount'>
    ): Promise<string> => {
      try {
        const id = await offlineQueueService.enqueue(item);

        // 更新统计
        const stats = await offlineQueueService.getStats();
        setQueueStats(stats);

        return id;
      } catch (error) {
        console.error('[useOfflineQueue] Enqueue failed:', error);
        throw error;
      }
    },
    []
  );

  /**
   * 手动同步
   */
  const sync = useCallback(async (): Promise<SyncResult> => {
    try {
      setIsSyncing(true);
      const result = await syncService.syncAll();

      // 同步完成后更新统计
      const stats = await offlineQueueService.getStats();
      setQueueStats(stats);

      return result;
    } catch (error) {
      console.error('[useOfflineQueue] Sync failed:', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  /**
   * 清空队列
   */
  const clearQueue = useCallback(async (): Promise<void> => {
    try {
      await offlineQueueService.clear();

      // 更新统计
      const stats = await offlineQueueService.getStats();
      setQueueStats(stats);
    } catch (error) {
      console.error('[useOfflineQueue] Clear queue failed:', error);
      throw error;
    }
  }, []);

  /**
   * 获取所有队列项
   */
  const getQueueItems = useCallback(async (): Promise<OfflineQueueItem[]> => {
    try {
      return await offlineQueueService.getAll();
    } catch (error) {
      console.error('[useOfflineQueue] Get queue items failed:', error);
      throw error;
    }
  }, []);

  /**
   * 删除队列项
   */
  const removeQueueItem = useCallback(async (id: string): Promise<void> => {
    try {
      await offlineQueueService.remove(id);

      // 更新统计
      const stats = await offlineQueueService.getStats();
      setQueueStats(stats);
    } catch (error) {
      console.error('[useOfflineQueue] Remove queue item failed:', error);
      throw error;
    }
  }, []);

  /**
   * 重试失败的项目
   */
  const retryFailed = useCallback(async (): Promise<SyncResult> => {
    try {
      setIsSyncing(true);
      const result = await syncService.retryFailed();

      // 同步完成后更新统计
      const stats = await offlineQueueService.getStats();
      setQueueStats(stats);

      return result;
    } catch (error) {
      console.error('[useOfflineQueue] Retry failed items failed:', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // ==================== 返回值 ====================

  return {
    isOnline,
    queueStats,
    isSyncing,
    enqueue,
    sync,
    clearQueue,
    getQueueItems,
    removeQueueItem,
    retryFailed,
  };
}

// ==================== 便捷 Hook ====================

/**
 * 简化版离线队列 Hook
 * 只返回在线状态和入队函数
 *
 * @example
 * ```tsx
 * const { isOnline, enqueue } = useOfflineMode();
 * ```
 */
export function useOfflineMode() {
  const { isOnline, enqueue } = useOfflineQueue();
  return { isOnline, enqueue };
}

/**
 * 网络状态 Hook
 * 只返回网络状态信息
 *
 * @example
 * ```tsx
 * const { isOnline, isWiFi } = useNetworkState();
 * ```
 */
export function useNetworkState() {
  const [isOnline, setIsOnline] = useState(false);
  const [isWiFi, setIsWiFi] = useState(false);
  const [networkType, setNetworkType] = useState<string | undefined>();

  useEffect(() => {
    const initialize = async () => {
      await networkMonitor.initialize();
      const state = await networkMonitor.getState();
      setIsOnline(state.isConnected);
      setIsWiFi(state.type === 'wifi');
      setNetworkType(state.type);
    };

    initialize();

    const unsubscribe = networkMonitor.subscribe((state) => {
      setIsOnline(state.isConnected);
      setIsWiFi(state.type === 'wifi');
      setNetworkType(state.type);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    isOnline,
    isWiFi,
    networkType,
  };
}

export default useOfflineQueue;
