/**
 * 离线模式服务导出
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */

// ==================== 类型导出 ====================

export type {
  OperationType,
  EntityType,
  SyncStatus,
  NetworkStatus,
  OfflineQueueItem,
  SyncEvent,
  SyncEventType,
  SyncEventListener,
  ItemSyncResult,
  SyncResult,
  NetworkState,
  NetworkStateListener,
  ConflictResolutionStrategy,
  DataConflict,
  OfflineQueueConfig,
  QueueStats,
  UseOfflineQueueReturn,
} from './types';

// ==================== 服务导出 ====================

export { offlineQueueService } from './OfflineQueueService';
export { networkMonitor } from './NetworkMonitor';
export { syncService } from './SyncService';

// ==================== 默认导出 ====================

export { offlineQueueService as default } from './OfflineQueueService';
