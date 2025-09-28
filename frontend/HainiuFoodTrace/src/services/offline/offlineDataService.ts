import { StorageService } from '../storage/storageService';
import { processingApiClient, WorkRecord, ProcessingRecord } from '../api/processingApiClient';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { LocationRecord } from '../location/locationService';
import { ScanRecord } from '../scanner/qrScannerService';

// 离线数据接口
export interface OfflineRecord {
  id: string;
  type: 'work_record' | 'processing_record' | 'location' | 'scan' | 'upload';
  data: any;
  metadata: {
    userId: number;
    factoryId: string;
    timestamp: Date;
    retryCount: number;
    lastRetryAt?: Date;
    error?: string;
  };
  syncStatus: 'pending' | 'syncing' | 'completed' | 'failed';
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
}

// 同步统计接口
export interface SyncStats {
  total: number;
  pending: number;
  syncing: number;
  completed: number;
  failed: number;
  lastSyncAt?: Date;
  nextSyncAt?: Date;
}

// 网络状态接口
export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
  isExpensive: boolean | null;
}

/**
 * 离线数据服务
 * 管理离线数据存储、同步、冲突解决
 */
export class OfflineDataService {
  private static instance: OfflineDataService;
  private offlineQueue: OfflineRecord[] = [];
  private syncInProgress = false;
  private networkStatus: NetworkStatus = {
    isConnected: false,
    isInternetReachable: null,
    type: 'unknown',
    isExpensive: null,
  };
  private syncInterval: NodeJS.Timeout | null = null;
  private maxRetries = 3;
  private retryDelays = [1000, 5000, 15000]; // 1s, 5s, 15s

  static getInstance(): OfflineDataService {
    if (!OfflineDataService.instance) {
      OfflineDataService.instance = new OfflineDataService();
    }
    return OfflineDataService.instance;
  }

  constructor() {
    this.initializeNetworkMonitoring();
    this.loadOfflineQueue();
    this.startPeriodicSync();
  }

  /**
   * 初始化网络监控
   */
  private initializeNetworkMonitoring(): void {
    NetInfo.addEventListener((state: NetInfoState) => {
      const wasConnected = this.networkStatus.isConnected;
      
      this.networkStatus = {
        isConnected: state.isConnected || false,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        isExpensive: (state.details as any)?.isConnectionExpensive || null,
      };

      console.log('网络状态变化:', this.networkStatus);

      // 网络恢复时自动同步
      if (!wasConnected && this.networkStatus.isConnected) {
        console.log('网络恢复，开始自动同步...');
        this.syncOfflineData();
      }
    });
  }

  /**
   * 添加离线记录
   */
  async addOfflineRecord(
    type: OfflineRecord['type'],
    data: any,
    metadata: Partial<OfflineRecord['metadata']>,
    priority: OfflineRecord['priority'] = 'medium'
  ): Promise<string> {
    const record: OfflineRecord = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      metadata: {
        userId: metadata.userId || 0,
        factoryId: metadata.factoryId || '',
        timestamp: metadata.timestamp || new Date(),
        retryCount: 0,
        ...metadata,
      },
      syncStatus: 'pending',
      priority,
      createdAt: new Date(),
    };

    this.offlineQueue.push(record);
    await this.saveOfflineQueue();

    console.log('添加离线记录:', record.id);

    // 如果网络可用，立即尝试同步
    if (this.networkStatus.isConnected) {
      this.syncOfflineData();
    }

    return record.id;
  }

  /**
   * 保存工作记录到离线队列
   */
  async saveWorkRecordOffline(
    workRecord: Omit<WorkRecord, 'id' | 'timestamp'>,
    userId: number,
    factoryId: string
  ): Promise<string> {
    return await this.addOfflineRecord(
      'work_record',
      workRecord,
      { userId, factoryId },
      'high'
    );
  }

  /**
   * 保存加工记录到离线队列
   */
  async saveProcessingRecordOffline(
    processingRecord: Omit<ProcessingRecord, 'id' | 'createdAt'>,
    userId: number,
    factoryId: string
  ): Promise<string> {
    return await this.addOfflineRecord(
      'processing_record',
      processingRecord,
      { userId, factoryId },
      'high'
    );
  }

  /**
   * 同步离线数据
   */
  async syncOfflineData(force: boolean = false): Promise<SyncStats> {
    if (this.syncInProgress && !force) {
      console.log('同步正在进行中，跳过');
      return this.getSyncStats();
    }

    if (!this.networkStatus.isConnected) {
      console.log('网络不可用，跳过同步');
      return this.getSyncStats();
    }

    this.syncInProgress = true;
    console.log('开始同步离线数据...');

    try {
      // 按优先级排序待同步记录
      const pendingRecords = this.offlineQueue
        .filter(record => record.syncStatus === 'pending' || record.syncStatus === 'failed')
        .sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

      let successCount = 0;
      let failCount = 0;

      for (const record of pendingRecords) {
        try {
          record.syncStatus = 'syncing';
          
          const success = await this.syncSingleRecord(record);
          
          if (success) {
            record.syncStatus = 'completed';
            successCount++;
            console.log('同步成功:', record.id);
          } else {
            await this.handleSyncFailure(record);
            failCount++;
          }
        } catch (error) {
          console.error('同步记录失败:', record.id, error);
          await this.handleSyncFailure(record, error);
          failCount++;
        }
      }

      // 清理已完成的记录（保留最近50条用于统计）
      const completedRecords = this.offlineQueue.filter(r => r.syncStatus === 'completed');
      if (completedRecords.length > 50) {
        this.offlineQueue = this.offlineQueue.filter(
          r => r.syncStatus !== 'completed' || 
          completedRecords.slice(-50).includes(r)
        );
      }

      await this.saveOfflineQueue();
      
      console.log(`同步完成: 成功 ${successCount}, 失败 ${failCount}`);
      return this.getSyncStats();
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 同步单条记录
   */
  private async syncSingleRecord(record: OfflineRecord): Promise<boolean> {
    try {
      switch (record.type) {
        case 'work_record':
          const workResponse = await processingApiClient.submitWorkRecord(record.data);
          return workResponse.success;

        case 'processing_record':
          const processResponse = await processingApiClient.createProcessingRecord(record.data);
          return processResponse.success;

        case 'location':
          const locationResponse = await processingApiClient.recordLocation(record.data);
          return locationResponse.success;

        // 其他类型的同步逻辑...
        default:
          console.warn('未知的记录类型:', record.type);
          return false;
      }
    } catch (error) {
      console.error('同步单条记录失败:', error);
      return false;
    }
  }

  /**
   * 处理同步失败
   */
  private async handleSyncFailure(record: OfflineRecord, error?: any): Promise<void> {
    record.metadata.retryCount++;
    record.metadata.lastRetryAt = new Date();
    record.metadata.error = error instanceof Error ? error.message : '同步失败';

    if (record.metadata.retryCount >= this.maxRetries) {
      record.syncStatus = 'failed';
      console.error('记录同步失败超过最大重试次数:', record.id);
    } else {
      record.syncStatus = 'pending';
      
      // 设置延时重试
      const delay = this.retryDelays[record.metadata.retryCount - 1] || 15000;
      setTimeout(() => {
        if (this.networkStatus.isConnected) {
          this.syncOfflineData();
        }
      }, delay);
    }
  }

  /**
   * 获取同步统计
   */
  getSyncStats(): SyncStats {
    const statusCounts = this.offlineQueue.reduce((acc, record) => {
      acc[record.syncStatus] = (acc[record.syncStatus] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const completedRecords = this.offlineQueue.filter(r => r.syncStatus === 'completed');
    const lastSyncAt = completedRecords.length > 0 
      ? new Date(Math.max(...completedRecords.map(r => r.metadata.timestamp.getTime())))
      : undefined;

    return {
      total: this.offlineQueue.length,
      pending: statusCounts.pending || 0,
      syncing: statusCounts.syncing || 0,
      completed: statusCounts.completed || 0,
      failed: statusCounts.failed || 0,
      lastSyncAt,
      nextSyncAt: this.getNextSyncTime(),
    };
  }

  /**
   * 获取下次同步时间
   */
  private getNextSyncTime(): Date | undefined {
    const failedRecords = this.offlineQueue.filter(r => r.syncStatus === 'failed');
    if (failedRecords.length === 0) return undefined;

    const nextRetryTimes = failedRecords
      .filter(r => r.metadata.retryCount < this.maxRetries)
      .map(r => {
        const lastRetry = r.metadata.lastRetryAt?.getTime() || r.createdAt.getTime();
        const delay = this.retryDelays[r.metadata.retryCount] || 15000;
        return lastRetry + delay;
      });

    return nextRetryTimes.length > 0 ? new Date(Math.min(...nextRetryTimes)) : undefined;
  }

  /**
   * 获取网络状态
   */
  getNetworkStatus(): NetworkStatus {
    return this.networkStatus;
  }

  /**
   * 强制同步指定记录
   */
  async forceSyncRecord(recordId: string): Promise<boolean> {
    const record = this.offlineQueue.find(r => r.id === recordId);
    if (!record) {
      console.error('找不到指定记录:', recordId);
      return false;
    }

    if (!this.networkStatus.isConnected) {
      console.error('网络不可用，无法强制同步');
      return false;
    }

    try {
      record.syncStatus = 'syncing';
      const success = await this.syncSingleRecord(record);
      
      if (success) {
        record.syncStatus = 'completed';
        await this.saveOfflineQueue();
        return true;
      } else {
        await this.handleSyncFailure(record);
        return false;
      }
    } catch (error) {
      console.error('强制同步记录失败:', error);
      await this.handleSyncFailure(record, error);
      return false;
    }
  }

  /**
   * 删除指定记录
   */
  async deleteRecord(recordId: string): Promise<boolean> {
    const index = this.offlineQueue.findIndex(r => r.id === recordId);
    if (index === -1) return false;

    this.offlineQueue.splice(index, 1);
    await this.saveOfflineQueue();
    return true;
  }

  /**
   * 清理所有失败记录
   */
  async clearFailedRecords(): Promise<number> {
    const failedCount = this.offlineQueue.filter(r => r.syncStatus === 'failed').length;
    this.offlineQueue = this.offlineQueue.filter(r => r.syncStatus !== 'failed');
    await this.saveOfflineQueue();
    return failedCount;
  }

  /**
   * 获取离线记录列表
   */
  getOfflineRecords(status?: OfflineRecord['syncStatus']): OfflineRecord[] {
    if (status) {
      return this.offlineQueue.filter(record => record.syncStatus === status);
    }
    return [...this.offlineQueue];
  }

  /**
   * 开始周期性同步
   */
  private startPeriodicSync(): void {
    // 每5分钟尝试同步一次
    this.syncInterval = setInterval(() => {
      if (this.networkStatus.isConnected && this.offlineQueue.length > 0) {
        this.syncOfflineData();
      }
    }, 5 * 60 * 1000); // 5分钟
  }

  /**
   * 停止周期性同步
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * 保存离线队列到本地存储
   */
  private async saveOfflineQueue(): Promise<void> {
    try {
      await StorageService.setItem('offline_queue', JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.error('保存离线队列失败:', error);
    }
  }

  /**
   * 从本地存储加载离线队列
   */
  private async loadOfflineQueue(): Promise<void> {
    try {
      const data = await StorageService.getItem('offline_queue');
      if (data) {
        this.offlineQueue = JSON.parse(data);
        console.log(`加载离线队列: ${this.offlineQueue.length} 条记录`);
      }
    } catch (error) {
      console.error('加载离线队列失败:', error);
      this.offlineQueue = [];
    }
  }

  /**
   * 检查是否处于离线模式
   */
  isOfflineMode(): boolean {
    return !this.networkStatus.isConnected;
  }

  /**
   * 获取数据使用情况
   */
  getDataUsageInfo(): {
    isExpensive: boolean | null;
    shouldSyncOnExpensive: boolean;
  } {
    return {
      isExpensive: this.networkStatus.isExpensive,
      shouldSyncOnExpensive: true, // 可根据设置调整
    };
  }
}

export default OfflineDataService.getInstance();