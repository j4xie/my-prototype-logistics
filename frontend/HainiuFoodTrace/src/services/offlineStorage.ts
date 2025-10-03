/**
 * 离线存储服务
 * 用于缓存成本核算数据，支持离线操作
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProcessingBatch, WorkSession, EquipmentUsage, CostAnalysis } from '../types/costAccounting';

// 存储键常量
const STORAGE_KEYS = {
  BATCHES: '@cost_accounting:batches',
  WORK_SESSIONS: '@cost_accounting:work_sessions',
  EQUIPMENT_USAGE: '@cost_accounting:equipment_usage',
  COST_ANALYSIS: '@cost_accounting:cost_analysis',
  PENDING_OPERATIONS: '@cost_accounting:pending_operations',
  LAST_SYNC: '@cost_accounting:last_sync',
};

// 待同步操作类型
export interface PendingOperation {
  id: string;
  type: 'material_receipt' | 'clock_in' | 'clock_out' | 'equipment_start' | 'equipment_end';
  data: any;
  timestamp: string;
  retryCount: number;
}

/**
 * 离线存储管理器
 */
export class OfflineStorageManager {

  // ==================== 批次数据缓存 ====================

  /**
   * 保存批次数据到本地
   */
  static async saveBatches(batches: ProcessingBatch[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.BATCHES, JSON.stringify(batches));
    } catch (error) {
      console.error('保存批次数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取本地缓存的批次数据
   */
  static async getBatches(): Promise<ProcessingBatch[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.BATCHES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('获取批次数据失败:', error);
      return [];
    }
  }

  /**
   * 添加单个批次到缓存
   */
  static async addBatch(batch: ProcessingBatch): Promise<void> {
    try {
      const batches = await this.getBatches();
      const index = batches.findIndex(b => b.id === batch.id);

      if (index >= 0) {
        batches[index] = batch; // 更新
      } else {
        batches.unshift(batch); // 添加到开头
      }

      await this.saveBatches(batches);
    } catch (error) {
      console.error('添加批次失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取批次
   */
  static async getBatchById(batchId: string): Promise<ProcessingBatch | null> {
    try {
      const batches = await this.getBatches();
      return batches.find(b => b.id === batchId) || null;
    } catch (error) {
      console.error('获取批次失败:', error);
      return null;
    }
  }

  // ==================== 工作会话缓存 ====================

  /**
   * 保存工作会话数据
   */
  static async saveWorkSessions(sessions: WorkSession[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.WORK_SESSIONS, JSON.stringify(sessions));
    } catch (error) {
      console.error('保存工作会话失败:', error);
      throw error;
    }
  }

  /**
   * 获取工作会话数据
   */
  static async getWorkSessions(): Promise<WorkSession[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.WORK_SESSIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('获取工作会话失败:', error);
      return [];
    }
  }

  /**
   * 保存进行中的工作会话
   */
  static async saveActiveSession(session: WorkSession | null): Promise<void> {
    try {
      const sessions = await this.getWorkSessions();
      const filtered = sessions.filter(s => s.id !== session?.id && !s.endTime);

      if (session) {
        filtered.push(session);
      }

      await this.saveWorkSessions(filtered);
    } catch (error) {
      console.error('保存活动会话失败:', error);
      throw error;
    }
  }

  /**
   * 获取进行中的工作会话
   */
  static async getActiveSession(): Promise<WorkSession | null> {
    try {
      const sessions = await this.getWorkSessions();
      return sessions.find(s => !s.endTime) || null;
    } catch (error) {
      console.error('获取活动会话失败:', error);
      return null;
    }
  }

  // ==================== 设备使用缓存 ====================

  /**
   * 保存设备使用记录
   */
  static async saveEquipmentUsage(usages: EquipmentUsage[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.EQUIPMENT_USAGE, JSON.stringify(usages));
    } catch (error) {
      console.error('保存设备使用记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取设备使用记录
   */
  static async getEquipmentUsage(): Promise<EquipmentUsage[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.EQUIPMENT_USAGE);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('获取设备使用记录失败:', error);
      return [];
    }
  }

  /**
   * 保存进行中的设备使用
   */
  static async saveActiveEquipmentUsage(equipmentId: string, usage: EquipmentUsage | null): Promise<void> {
    try {
      const usages = await this.getEquipmentUsage();
      const filtered = usages.filter(u => u.equipmentId !== equipmentId || u.endTime);

      if (usage) {
        filtered.push(usage);
      }

      await this.saveEquipmentUsage(filtered);
    } catch (error) {
      console.error('保存活动设备使用失败:', error);
      throw error;
    }
  }

  /**
   * 获取设备的进行中使用记录
   */
  static async getActiveEquipmentUsage(equipmentId: string): Promise<EquipmentUsage | null> {
    try {
      const usages = await this.getEquipmentUsage();
      return usages.find(u => u.equipmentId === equipmentId && !u.endTime) || null;
    } catch (error) {
      console.error('获取活动设备使用失败:', error);
      return null;
    }
  }

  // ==================== 成本分析缓存 ====================

  /**
   * 保存成本分析数据
   */
  static async saveCostAnalysis(batchId: string, analysis: CostAnalysis): Promise<void> {
    try {
      const key = `${STORAGE_KEYS.COST_ANALYSIS}:${batchId}`;
      await AsyncStorage.setItem(key, JSON.stringify(analysis));
    } catch (error) {
      console.error('保存成本分析失败:', error);
      throw error;
    }
  }

  /**
   * 获取成本分析数据
   */
  static async getCostAnalysis(batchId: string): Promise<CostAnalysis | null> {
    try {
      const key = `${STORAGE_KEYS.COST_ANALYSIS}:${batchId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('获取成本分析失败:', error);
      return null;
    }
  }

  // ==================== 待同步操作管理 ====================

  /**
   * 添加待同步操作
   */
  static async addPendingOperation(operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    try {
      const operations = await this.getPendingOperations();

      const newOperation: PendingOperation = {
        ...operation,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      operations.push(newOperation);
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_OPERATIONS, JSON.stringify(operations));
    } catch (error) {
      console.error('添加待同步操作失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有待同步操作
   */
  static async getPendingOperations(): Promise<PendingOperation[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_OPERATIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('获取待同步操作失败:', error);
      return [];
    }
  }

  /**
   * 移除已同步的操作
   */
  static async removePendingOperation(operationId: string): Promise<void> {
    try {
      const operations = await this.getPendingOperations();
      const filtered = operations.filter(op => op.id !== operationId);
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_OPERATIONS, JSON.stringify(filtered));
    } catch (error) {
      console.error('移除待同步操作失败:', error);
      throw error;
    }
  }

  /**
   * 增加操作重试次数
   */
  static async incrementRetryCount(operationId: string): Promise<void> {
    try {
      const operations = await this.getPendingOperations();
      const operation = operations.find(op => op.id === operationId);

      if (operation) {
        operation.retryCount += 1;
        await AsyncStorage.setItem(STORAGE_KEYS.PENDING_OPERATIONS, JSON.stringify(operations));
      }
    } catch (error) {
      console.error('增加重试次数失败:', error);
      throw error;
    }
  }

  // ==================== 同步管理 ====================

  /**
   * 保存最后同步时间
   */
  static async saveLastSyncTime(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    } catch (error) {
      console.error('保存同步时间失败:', error);
      throw error;
    }
  }

  /**
   * 获取最后同步时间
   */
  static async getLastSyncTime(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    } catch (error) {
      console.error('获取同步时间失败:', error);
      return null;
    }
  }

  /**
   * 检查是否需要同步（超过5分钟）
   */
  static async shouldSync(): Promise<boolean> {
    try {
      const lastSync = await this.getLastSyncTime();
      if (!lastSync) return true;

      const lastSyncTime = new Date(lastSync).getTime();
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      return (now - lastSyncTime) > fiveMinutes;
    } catch (error) {
      console.error('检查同步状态失败:', error);
      return true;
    }
  }

  // ==================== 清理和维护 ====================

  /**
   * 清理过期的缓存数据（超过7天）
   */
  static async cleanupOldData(): Promise<void> {
    try {
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

      // 清理批次
      const batches = await this.getBatches();
      const validBatches = batches.filter(b => {
        const batchTime = new Date(b.createdAt).getTime();
        return batchTime > sevenDaysAgo;
      });
      await this.saveBatches(validBatches);

      // 清理工作会话
      const sessions = await this.getWorkSessions();
      const validSessions = sessions.filter(s => {
        const sessionTime = new Date(s.startTime).getTime();
        return sessionTime > sevenDaysAgo;
      });
      await this.saveWorkSessions(validSessions);

      // 清理设备使用
      const usages = await this.getEquipmentUsage();
      const validUsages = usages.filter(u => {
        const usageTime = new Date(u.startTime).getTime();
        return usageTime > sevenDaysAgo;
      });
      await this.saveEquipmentUsage(validUsages);

      console.log('离线数据清理完成');
    } catch (error) {
      console.error('清理数据失败:', error);
    }
  }

  /**
   * 清除所有缓存数据
   */
  static async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.BATCHES,
        STORAGE_KEYS.WORK_SESSIONS,
        STORAGE_KEYS.EQUIPMENT_USAGE,
        STORAGE_KEYS.PENDING_OPERATIONS,
        STORAGE_KEYS.LAST_SYNC,
      ]);

      // 清除所有成本分析缓存
      const allKeys = await AsyncStorage.getAllKeys();
      const analysisKeys = allKeys.filter(key => key.startsWith(STORAGE_KEYS.COST_ANALYSIS));
      await AsyncStorage.multiRemove(analysisKeys);

      console.log('所有缓存数据已清除');
    } catch (error) {
      console.error('清除缓存失败:', error);
      throw error;
    }
  }

  /**
   * 获取缓存数据统计
   */
  static async getCacheStats(): Promise<{
    batches: number;
    sessions: number;
    equipmentUsage: number;
    pendingOperations: number;
    lastSync: string | null;
  }> {
    try {
      const [batches, sessions, usages, pending, lastSync] = await Promise.all([
        this.getBatches(),
        this.getWorkSessions(),
        this.getEquipmentUsage(),
        this.getPendingOperations(),
        this.getLastSyncTime(),
      ]);

      return {
        batches: batches.length,
        sessions: sessions.length,
        equipmentUsage: usages.length,
        pendingOperations: pending.length,
        lastSync,
      };
    } catch (error) {
      console.error('获取缓存统计失败:', error);
      throw error;
    }
  }
}

/**
 * 离线同步服务
 * 负责在网络恢复时同步待处理操作
 */
export class OfflineSyncService {

  private static isRunning = false;

  /**
   * 同步所有待处理操作
   */
  static async syncPendingOperations(
    onProgress?: (current: number, total: number) => void
  ): Promise<{ success: number; failed: number }> {

    if (this.isRunning) {
      console.log('同步正在进行中...');
      return { success: 0, failed: 0 };
    }

    try {
      this.isRunning = true;
      const operations = await OfflineStorageManager.getPendingOperations();

      if (operations.length === 0) {
        console.log('没有待同步操作');
        return { success: 0, failed: 0 };
      }

      let success = 0;
      let failed = 0;

      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];

        try {
          // TODO: 根据operation.type调用相应的API
          // 这里需要导入processingApiClient
          // const result = await processingApiClient.xxx(operation.data);

          // 模拟同步成功
          await OfflineStorageManager.removePendingOperation(operation.id);
          success++;

        } catch (error) {
          console.error(`同步操作失败 [${operation.type}]:`, error);

          // 如果重试次数超过3次，则标记为失败
          if (operation.retryCount >= 3) {
            await OfflineStorageManager.removePendingOperation(operation.id);
            failed++;
          } else {
            await OfflineStorageManager.incrementRetryCount(operation.id);
            failed++;
          }
        }

        onProgress?.(i + 1, operations.length);
      }

      await OfflineStorageManager.saveLastSyncTime();

      console.log(`同步完成: 成功 ${success}, 失败 ${failed}`);
      return { success, failed };

    } catch (error) {
      console.error('同步过程失败:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 自动同步（仅在网络可用时）
   */
  static async autoSync(isOnline: boolean): Promise<void> {
    if (!isOnline) {
      console.log('离线模式，跳过同步');
      return;
    }

    const shouldSync = await OfflineStorageManager.shouldSync();
    if (!shouldSync) {
      console.log('距离上次同步不到5分钟，跳过');
      return;
    }

    await this.syncPendingOperations();
  }
}
