/**
 * 离线队列服务
 *
 * 管理离线操作的本地存储队列
 * 使用 AsyncStorage 持久化存储待同步数据
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import type {
  OfflineQueueItem,
  OfflineQueueConfig,
  QueueStats,
  SyncStatus,
  EntityType,
} from './types';

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: Required<OfflineQueueConfig> = {
  maxQueueSize: 500,
  defaultMaxRetries: 3,
  retryDelay: 2000,
  conflictResolution: 'server_wins',
  autoSync: true,
  syncOnWifiOnly: false,
  syncBatchSize: 10,
  storageKeyPrefix: '@cretas_offline_queue',
};

// ==================== 存储键 ====================

const STORAGE_KEYS = {
  QUEUE: '@cretas_offline_queue:items',
  CONFIG: '@cretas_offline_queue:config',
  STATS: '@cretas_offline_queue:stats',
} as const;

// ==================== OfflineQueueService 类 ====================

class OfflineQueueService {
  private config: Required<OfflineQueueConfig>;
  private queue: OfflineQueueItem[] = [];
  private isInitialized = false;

  constructor(config?: Partial<OfflineQueueConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==================== 初始化 ====================

  /**
   * 初始化队列服务
   * 从 AsyncStorage 加载已存储的队列数据
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const storedQueue = await AsyncStorage.getItem(STORAGE_KEYS.QUEUE);
      if (storedQueue) {
        this.queue = JSON.parse(storedQueue);
        console.log(`[OfflineQueue] Loaded ${this.queue.length} items from storage`);
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('[OfflineQueue] Failed to initialize:', error);
      this.queue = [];
      this.isInitialized = true;
    }
  }

  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  // ==================== 队列操作 ====================

  /**
   * 添加项目到队列
   *
   * @param item 队列项 (不含id, createdAt等自动生成字段)
   * @returns 队列项ID
   */
  async enqueue(
    item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'status' | 'retryCount'>
  ): Promise<string> {
    await this.ensureInitialized();

    // 检查队列大小限制
    if (this.queue.length >= this.config.maxQueueSize) {
      throw new Error(
        `队列已满 (最大 ${this.config.maxQueueSize} 项)，请先同步或清理队列`
      );
    }

    const queueItem: OfflineQueueItem = {
      ...item,
      id: uuidv4(),
      status: 'pending',
      retryCount: 0,
      maxRetries: item.maxRetries ?? this.config.defaultMaxRetries,
      createdAt: new Date().toISOString(),
    };

    // 插入队列 (优先级高的在前)
    const priority = queueItem.priority ?? 5;
    const insertIndex = this.queue.findIndex((q) => (q.priority ?? 5) < priority);

    if (insertIndex === -1) {
      this.queue.push(queueItem);
    } else {
      this.queue.splice(insertIndex, 0, queueItem);
    }

    await this.saveQueue();

    console.log(
      `[OfflineQueue] Enqueued ${item.entityType} ${item.operation} (id: ${queueItem.id})`
    );

    return queueItem.id;
  }

  /**
   * 取出下一个待同步的项目
   * 不会从队列中删除，需要手动调用 remove() 或 updateStatus()
   *
   * @returns 下一个待同步的项目，如果队列为空则返回 null
   */
  async dequeue(): Promise<OfflineQueueItem | null> {
    await this.ensureInitialized();

    const pendingItem = this.queue.find((item) => item.status === 'pending');

    if (!pendingItem) {
      return null;
    }

    return pendingItem;
  }

  /**
   * 查看队列中的下一个项目 (不移除)
   *
   * @returns 下一个待同步的项目，如果队列为空则返回 null
   */
  async peek(): Promise<OfflineQueueItem | null> {
    await this.ensureInitialized();

    const pendingItem = this.queue.find((item) => item.status === 'pending');
    return pendingItem || null;
  }

  /**
   * 获取所有队列项
   *
   * @param status 可选，按状态筛选
   * @returns 队列项列表
   */
  async getAll(status?: SyncStatus): Promise<OfflineQueueItem[]> {
    await this.ensureInitialized();

    if (status) {
      return this.queue.filter((item) => item.status === status);
    }

    return [...this.queue];
  }

  /**
   * 根据ID获取队列项
   *
   * @param id 队列项ID
   * @returns 队列项，如果不存在则返回 null
   */
  async getById(id: string): Promise<OfflineQueueItem | null> {
    await this.ensureInitialized();

    const item = this.queue.find((q) => q.id === id);
    return item || null;
  }

  /**
   * 删除队列项
   *
   * @param id 队列项ID
   * @returns 是否删除成功
   */
  async remove(id: string): Promise<boolean> {
    await this.ensureInitialized();

    const index = this.queue.findIndex((item) => item.id === id);

    if (index === -1) {
      return false;
    }

    this.queue.splice(index, 1);
    await this.saveQueue();

    console.log(`[OfflineQueue] Removed item ${id}`);

    return true;
  }

  /**
   * 更新队列项状态
   *
   * @param id 队列项ID
   * @param status 新状态
   * @param error 可选的错误信息
   */
  async updateStatus(
    id: string,
    status: SyncStatus,
    error?: string
  ): Promise<void> {
    await this.ensureInitialized();

    const item = this.queue.find((q) => q.id === id);

    if (!item) {
      console.warn(`[OfflineQueue] Item ${id} not found for status update`);
      return;
    }

    item.status = status;
    item.lastSyncAttempt = new Date().toISOString();

    if (error) {
      item.error = error;
    }

    if (status === 'failed') {
      item.retryCount += 1;
    }

    await this.saveQueue();
  }

  /**
   * 清空队列
   */
  async clear(): Promise<void> {
    await this.ensureInitialized();

    this.queue = [];
    await this.saveQueue();

    console.log('[OfflineQueue] Queue cleared');
  }

  /**
   * 清除已同步的项目
   */
  async clearSynced(): Promise<void> {
    await this.ensureInitialized();

    const beforeCount = this.queue.length;
    this.queue = this.queue.filter((item) => item.status !== 'synced');

    await this.saveQueue();

    console.log(
      `[OfflineQueue] Cleared ${beforeCount - this.queue.length} synced items`
    );
  }

  /**
   * 清除失败的项目
   */
  async clearFailed(): Promise<void> {
    await this.ensureInitialized();

    const beforeCount = this.queue.length;
    this.queue = this.queue.filter((item) => item.status !== 'failed');

    await this.saveQueue();

    console.log(
      `[OfflineQueue] Cleared ${beforeCount - this.queue.length} failed items`
    );
  }

  /**
   * 重置失败项目的状态，以便重试
   */
  async resetFailed(): Promise<void> {
    await this.ensureInitialized();

    let resetCount = 0;

    for (const item of this.queue) {
      if (item.status === 'failed' && item.retryCount < item.maxRetries) {
        item.status = 'pending';
        item.error = undefined;
        resetCount++;
      }
    }

    await this.saveQueue();

    console.log(`[OfflineQueue] Reset ${resetCount} failed items`);
  }

  // ==================== 统计信息 ====================

  /**
   * 获取队列统计信息
   *
   * @returns 统计数据
   */
  async getStats(): Promise<QueueStats> {
    await this.ensureInitialized();

    const stats: QueueStats = {
      total: this.queue.length,
      pending: 0,
      syncing: 0,
      synced: 0,
      failed: 0,
      byEntityType: {} as Record<EntityType, number>,
    };

    for (const item of this.queue) {
      // 统计状态
      switch (item.status) {
        case 'pending':
          stats.pending++;
          break;
        case 'syncing':
          stats.syncing++;
          break;
        case 'synced':
          stats.synced++;
          break;
        case 'failed':
          stats.failed++;
          break;
      }

      // 统计实体类型
      stats.byEntityType[item.entityType] =
        (stats.byEntityType[item.entityType] || 0) + 1;
    }

    // 最早和最晚项目
    if (this.queue.length > 0) {
      const sorted = [...this.queue].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      stats.oldestItem = sorted[0]?.createdAt;
      stats.newestItem = sorted[sorted.length - 1]?.createdAt;
    }

    return stats;
  }

  // ==================== 持久化 ====================

  /**
   * 保存队列到 AsyncStorage
   */
  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(this.queue));
    } catch (error) {
      console.error('[OfflineQueue] Failed to save queue:', error);
      throw new Error('保存离线队列失败');
    }
  }

  // ==================== 配置管理 ====================

  /**
   * 获取当前配置
   */
  getConfig(): Required<OfflineQueueConfig> {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<OfflineQueueConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ==================== 导出单例 ====================

export const offlineQueueService = new OfflineQueueService();
export default offlineQueueService;
