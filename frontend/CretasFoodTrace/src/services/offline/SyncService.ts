/**
 * 同步服务
 *
 * 负责将离线队列中的数据同步到服务器
 * 包含重试机制、冲突处理、批量同步等功能
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */

import { apiClient } from '../api/apiClient';
import { offlineQueueService } from './OfflineQueueService';
import { networkMonitor } from './NetworkMonitor';
import type {
  OfflineQueueItem,
  SyncResult,
  ItemSyncResult,
  SyncEvent,
  SyncEventListener,
  SyncEventType,
} from './types';
import { isAxiosError } from 'axios';

// ==================== 同步配置 ====================

interface SyncConfig {
  /** 同步批量大小 */
  batchSize: number;

  /** 重试延迟 (毫秒) */
  retryDelay: number;

  /** 仅在WiFi下同步 */
  wifiOnly: boolean;

  /** 并发请求数 */
  concurrency: number;
}

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  batchSize: 10,
  retryDelay: 2000,
  wifiOnly: false,
  concurrency: 3,
};

// ==================== SyncService 类 ====================

class SyncService {
  private config: SyncConfig;
  private isSyncing = false;
  private listeners: Set<SyncEventListener> = new Set();

  constructor(config?: Partial<SyncConfig>) {
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
  }

  // ==================== 同步操作 ====================

  /**
   * 同步所有待同步项目
   *
   * @returns 同步结果
   */
  async syncAll(): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error('同步正在进行中，请勿重复操作');
    }

    // 检查网络连接
    const isOnline = await networkMonitor.isOnline();
    if (!isOnline) {
      throw new Error('网络未连接，无法同步');
    }

    // 如果配置了仅WiFi同步，检查网络类型
    if (this.config.wifiOnly) {
      const isWiFi = await networkMonitor.isWiFi();
      if (!isWiFi) {
        throw new Error('当前设置仅允许WiFi下同步');
      }
    }

    this.isSyncing = true;
    const startTime = new Date().toISOString();

    try {
      // 获取所有待同步项目
      const pendingItems = await offlineQueueService.getAll('pending');

      if (pendingItems.length === 0) {
        console.log('[SyncService] No items to sync');
        this.emitEvent('sync_complete', { total: 0, completed: 0, failed: 0 });
        return {
          total: 0,
          succeeded: 0,
          failed: 0,
          results: [],
          startTime,
          endTime: new Date().toISOString(),
          duration: 0,
        };
      }

      console.log(`[SyncService] Starting sync of ${pendingItems.length} items`);
      this.emitEvent('sync_start', { total: pendingItems.length });

      // 批量同步
      const results = await this.syncBatch(pendingItems);

      const endTime = new Date().toISOString();
      const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      const syncResult: SyncResult = {
        total: pendingItems.length,
        succeeded,
        failed,
        results,
        startTime,
        endTime,
        duration,
      };

      console.log(
        `[SyncService] Sync completed: ${succeeded} succeeded, ${failed} failed`
      );

      this.emitEvent('sync_complete', {
        total: pendingItems.length,
        completed: succeeded,
        failed,
      });

      return syncResult;
    } catch (error) {
      console.error('[SyncService] Sync failed:', error);
      this.emitEvent('sync_error', {
        error: error instanceof Error ? error.message : '同步失败',
      });
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 重试失败的项目
   *
   * @returns 同步结果
   */
  async retryFailed(): Promise<SyncResult> {
    // 重置失败项目状态
    await offlineQueueService.resetFailed();

    // 执行同步
    return this.syncAll();
  }

  /**
   * 检查是否正在同步
   *
   * @returns 是否正在同步
   */
  isCurrentlySyncing(): boolean {
    return this.isSyncing;
  }

  // ==================== 批量同步 ====================

  /**
   * 批量同步项目
   *
   * @param items 待同步项目列表
   * @returns 同步结果列表
   */
  private async syncBatch(items: OfflineQueueItem[]): Promise<ItemSyncResult[]> {
    const results: ItemSyncResult[] = [];

    // 按批次处理
    for (let i = 0; i < items.length; i += this.config.batchSize) {
      const batch = items.slice(i, i + this.config.batchSize);

      console.log(
        `[SyncService] Processing batch ${Math.floor(i / this.config.batchSize) + 1}`
      );

      // 并发同步批次中的项目
      const batchResults = await Promise.all(
        batch.map((item) => this.syncItem(item))
      );

      results.push(...batchResults);

      // 发送进度事件
      this.emitEvent('sync_progress', {
        total: items.length,
        completed: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      });
    }

    return results;
  }

  /**
   * 同步单个项目
   *
   * @param item 队列项
   * @returns 同步结果
   */
  private async syncItem(item: OfflineQueueItem): Promise<ItemSyncResult> {
    try {
      console.log(
        `[SyncService] Syncing ${item.entityType} ${item.operation} (id: ${item.id})`
      );

      // 更新状态为同步中
      await offlineQueueService.updateStatus(item.id, 'syncing');

      // 发送API请求
      const response = await this.sendRequest(item);

      // 同步成功
      await offlineQueueService.updateStatus(item.id, 'synced');

      this.emitEvent('item_synced', { current: item });

      return {
        id: item.id,
        success: true,
        responseData: response,
      };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);

      console.error(
        `[SyncService] Failed to sync item ${item.id}:`,
        errorMessage
      );

      // 检查是否应该重试
      if (item.retryCount < item.maxRetries) {
        // 标记为失败，等待重试
        await offlineQueueService.updateStatus(item.id, 'failed', errorMessage);
      } else {
        // 超过最大重试次数，标记为永久失败
        await offlineQueueService.updateStatus(
          item.id,
          'failed',
          `超过最大重试次数: ${errorMessage}`
        );
      }

      this.emitEvent('item_failed', { current: item, error: errorMessage });

      return {
        id: item.id,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 发送API请求
   *
   * @param item 队列项
   * @returns API响应数据
   */
  private async sendRequest(item: OfflineQueueItem): Promise<unknown> {
    const { method, endpoint, payload } = item;

    try {
      // 定义响应类型
      interface ApiResponse {
        success?: boolean;
        message?: string;
        data?: unknown;
      }

      let response: ApiResponse;

      switch (method) {
        case 'GET':
          response = await apiClient.get<ApiResponse>(endpoint, { params: payload });
          break;
        case 'POST':
          response = await apiClient.post<ApiResponse>(endpoint, payload);
          break;
        case 'PUT':
          response = await apiClient.put<ApiResponse>(endpoint, payload);
          break;
        case 'PATCH':
          response = await apiClient.patch<ApiResponse>(endpoint, payload);
          break;
        case 'DELETE':
          response = await apiClient.delete<ApiResponse>(endpoint, { data: payload });
          break;
        default:
          throw new Error(`不支持的HTTP方法: ${method}`);
      }

      // 检查响应
      if (response.success === false) {
        throw new Error(response.message || 'API请求失败');
      }

      return response.data || response;
    } catch (error) {
      // 重新抛出错误，让 syncItem 处理
      throw error;
    }
  }

  // ==================== 错误处理 ====================

  /**
   * 提取错误信息
   *
   * @param error 错误对象
   * @returns 错误信息字符串
   */
  private extractErrorMessage(error: unknown): string {
    if (isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;

      if (status === 401) {
        return '认证失败，请重新登录';
      } else if (status === 403) {
        return '权限不足';
      } else if (status === 404) {
        return '资源不存在';
      } else if (status === 409) {
        return '数据冲突';
      } else if (status === 422) {
        return '数据验证失败';
      } else if (status && status >= 500) {
        return '服务器错误';
      }

      return message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return '未知错误';
  }

  // ==================== 事件监听 ====================

  /**
   * 订阅同步事件
   *
   * @param listener 事件监听器
   * @returns 取消订阅函数
   */
  subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 取消订阅
   *
   * @param listener 事件监听器
   */
  unsubscribe(listener: SyncEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * 清除所有监听器
   */
  clearListeners(): void {
    this.listeners.clear();
  }

  /**
   * 发送事件
   *
   * @param type 事件类型
   * @param data 事件数据
   */
  private emitEvent(type: SyncEventType, data?: SyncEvent['data']): void {
    const event: SyncEvent = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[SyncService] Listener error:', error);
      }
    }
  }

  // ==================== 配置管理 ====================

  /**
   * 更新配置
   *
   * @param config 配置项
   */
  updateConfig(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   *
   * @returns 配置对象
   */
  getConfig(): SyncConfig {
    return { ...this.config };
  }
}

// ==================== 导出单例 ====================

export const syncService = new SyncService();
export default syncService;
