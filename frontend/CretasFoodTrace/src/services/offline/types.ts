/**
 * 离线模式类型定义
 *
 * 支持在弱网/离线环境下的数据本地化存储和延迟同步
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */

// ==================== 基础类型 ====================

/**
 * 操作类型
 */
export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * 实体类型
 * 定义可以离线操作的实体
 */
export type EntityType =
  | 'material_batch'
  | 'processing_batch'
  | 'quality_inspection'
  | 'production_plan'
  | 'worker_assignment'
  | 'timeclock_record';

/**
 * 同步状态
 */
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

/**
 * 网络状态
 */
export type NetworkStatus = 'online' | 'offline' | 'unknown';

// ==================== 队列项 ====================

/**
 * 离线队列项
 * 表示一个待同步的操作
 */
export interface OfflineQueueItem {
  /** 唯一标识符 */
  id: string;

  /** 实体类型 */
  entityType: EntityType;

  /** 操作类型 */
  operation: OperationType;

  /** API 端点路径 */
  endpoint: string;

  /** HTTP 方法 */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  /** 请求负载数据 */
  payload: Record<string, unknown>;

  /** 同步状态 */
  status: SyncStatus;

  /** 重试次数 */
  retryCount: number;

  /** 最大重试次数 */
  maxRetries: number;

  /** 创建时间 (ISO string) */
  createdAt: string;

  /** 最后同步尝试时间 (ISO string) */
  lastSyncAttempt?: string;

  /** 错误信息 (如果失败) */
  error?: string;

  /** 工厂ID (用于构建API路径) */
  factoryId?: string;

  /** 优先级 (1-10, 10最高) */
  priority?: number;

  /** 元数据 (额外信息) */
  metadata?: Record<string, unknown>;
}

// ==================== 同步事件 ====================

/**
 * 同步事件类型
 */
export type SyncEventType =
  | 'sync_start'
  | 'sync_progress'
  | 'sync_complete'
  | 'sync_error'
  | 'item_synced'
  | 'item_failed';

/**
 * 同步事件
 */
export interface SyncEvent {
  type: SyncEventType;
  timestamp: string;
  data?: {
    total?: number;
    completed?: number;
    failed?: number;
    current?: OfflineQueueItem;
    error?: string;
  };
}

/**
 * 同步监听器
 */
export type SyncEventListener = (event: SyncEvent) => void;

// ==================== 同步结果 ====================

/**
 * 单个项目同步结果
 */
export interface ItemSyncResult {
  id: string;
  success: boolean;
  error?: string;
  responseData?: unknown;
}

/**
 * 批量同步结果
 */
export interface SyncResult {
  total: number;
  succeeded: number;
  failed: number;
  results: ItemSyncResult[];
  startTime: string;
  endTime: string;
  duration: number;
}

// ==================== 网络监控 ====================

/**
 * 网络状态信息
 */
export interface NetworkState {
  /** 网络状态 */
  status: NetworkStatus;

  /** 网络类型 */
  type?: 'wifi' | 'cellular' | 'bluetooth' | 'ethernet' | 'wimax' | 'vpn' | 'other' | 'unknown' | 'none';

  /** 是否在线 */
  isConnected: boolean;

  /** 是否可以访问互联网 */
  isInternetReachable?: boolean;

  /** 蜂窝数据代价高昂 (漫游等) */
  isExpensive?: boolean;

  /** 最后检测时间 */
  lastChecked: string;
}

/**
 * 网络状态监听器
 */
export type NetworkStateListener = (state: NetworkState) => void;

// ==================== 冲突处理 ====================

/**
 * 冲突解决策略
 */
export type ConflictResolutionStrategy =
  | 'server_wins' // 服务器优先 (Last Write Wins - LWW)
  | 'client_wins' // 客户端优先
  | 'manual' // 手动解决
  | 'merge'; // 尝试合并

/**
 * 数据冲突信息
 */
export interface DataConflict {
  id: string;
  entityType: EntityType;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  conflictedFields: string[];
  detectedAt: string;
}

// ==================== 配置选项 ====================

/**
 * 离线队列配置
 */
export interface OfflineQueueConfig {
  /** 最大队列大小 */
  maxQueueSize?: number;

  /** 默认最大重试次数 */
  defaultMaxRetries?: number;

  /** 重试延迟 (毫秒) */
  retryDelay?: number;

  /** 冲突解决策略 */
  conflictResolution?: ConflictResolutionStrategy;

  /** 自动同步开关 */
  autoSync?: boolean;

  /** 仅在WiFi下自动同步 */
  syncOnWifiOnly?: boolean;

  /** 同步批量大小 */
  syncBatchSize?: number;

  /** 存储键前缀 */
  storageKeyPrefix?: string;
}

// ==================== 统计信息 ====================

/**
 * 队列统计信息
 */
export interface QueueStats {
  total: number;
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  byEntityType: Record<EntityType, number>;
  oldestItem?: string; // ISO timestamp
  newestItem?: string; // ISO timestamp
}

// ==================== Hook 返回类型 ====================

/**
 * useOfflineQueue Hook 返回类型
 */
export interface UseOfflineQueueReturn {
  /** 是否在线 */
  isOnline: boolean;

  /** 队列统计 */
  queueStats: QueueStats;

  /** 是否正在同步 */
  isSyncing: boolean;

  /** 添加到队列 */
  enqueue: (item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'status' | 'retryCount'>) => Promise<string>;

  /** 手动同步 */
  sync: () => Promise<SyncResult>;

  /** 清除队列 */
  clearQueue: () => Promise<void>;

  /** 获取队列项 */
  getQueueItems: () => Promise<OfflineQueueItem[]>;

  /** 删除队列项 */
  removeQueueItem: (id: string) => Promise<void>;

  /** 重试失败的项目 */
  retryFailed: () => Promise<SyncResult>;
}
