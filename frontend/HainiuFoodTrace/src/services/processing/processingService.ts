import { processingApiClient, ProcessingBatch, QualityInspection, AlertNotification } from '../api/processingApiClient';
import { StorageService } from '../storage/storageService';
import { NetworkManager } from '../networkManager';
import { LocationService } from '../location/locationService';

/**
 * 加工处理服务
 * 提供加工模块的业务逻辑封装
 */
export class ProcessingService {
  /**
   * 创建新的生产批次
   */
  static async createProductionBatch(batchData: {
    productType: string;
    rawMaterials?: any;
    startDate?: string;
    productionLine?: string;
    targetQuantity?: number;
    notes?: string;
  }): Promise<{
    success: boolean;
    batch?: ProcessingBatch;
    message?: string;
  }> {
    try {
      // 检查网络连接
      const isConnected = await NetworkManager.isConnected();
      if (!isConnected) {
        return { success: false, message: '网络连接不可用' };
      }

      // 生成批次号（时间戳 + 随机数）
      const batchNumber = `BATCH_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const response = await NetworkManager.executeWithRetry(
        () => processingApiClient.createBatch({
          batchNumber,
          productType: batchData.productType,
          rawMaterials: batchData.rawMaterials,
          startDate: batchData.startDate || new Date().toISOString(),
          productionLine: batchData.productionLine,
          targetQuantity: batchData.targetQuantity,
          notes: batchData.notes
        }),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success) {
        console.log('生产批次创建成功:', response.data);
        return {
          success: true,
          batch: response.data,
          message: '生产批次创建成功'
        };
      }

      return { success: false, message: response.message || '创建失败' };
    } catch (error) {
      console.error('创建生产批次失败:', error);
      return { success: false, message: '创建服务暂时不可用' };
    }
  }

  /**
   * 获取生产批次列表
   */
  static async getProductionBatches(params?: {
    page?: number;
    limit?: number;
    status?: ProcessingBatch['status'];
    productType?: string;
  }): Promise<{
    success: boolean;
    data?: {
      batches: ProcessingBatch[];
      total: number;
      page: number;
      limit: number;
    };
    message?: string;
  }> {
    try {
      const response = await NetworkManager.executeWithRetry(
        () => processingApiClient.getBatches({
          page: params?.page || 1,
          limit: params?.limit || 20,
          status: params?.status,
          productType: params?.productType
        }),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success) {
        console.log('批次列表获取成功:', response.data);
        return {
          success: true,
          data: response.data
        };
      }

      return { success: false, message: response.message || '获取失败' };
    } catch (error) {
      console.error('获取生产批次列表失败:', error);
      return { success: false, message: '获取服务暂时不可用' };
    }
  }

  /**
   * 开始生产批次
   */
  static async startProductionBatch(batchId: string, startData?: {
    notes?: string;
    location?: { latitude: number; longitude: number };
  }): Promise<{
    success: boolean;
    batch?: ProcessingBatch;
    message?: string;
  }> {
    try {
      // 获取当前位置（如果需要）
      let locationData;
      if (startData?.location || !startData?.location) {
        try {
          const location = await LocationService.getCurrentLocation();
          locationData = location;
        } catch (locationError) {
          console.warn('获取位置信息失败:', locationError);
          // 继续执行，不阻断生产开始
        }
      }

      const response = await NetworkManager.executeWithRetry(
        () => processingApiClient.startProduction(batchId, {
          actualStartDate: new Date().toISOString(),
          initialParameters: {
            startLocation: locationData,
            operator: 'current_user' // 这里应该从用户状态获取
          },
          notes: startData?.notes
        }),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success) {
        console.log('生产批次启动成功:', response.data);
        return {
          success: true,
          batch: response.data,
          message: '生产批次已启动'
        };
      }

      return { success: false, message: response.message || '启动失败' };
    } catch (error) {
      console.error('启动生产批次失败:', error);
      return { success: false, message: '启动服务暂时不可用' };
    }
  }

  /**
   * 完成生产批次
   */
  static async completeProductionBatch(batchId: string, completionData: {
    actualQuantity?: number;
    qualityGrade?: ProcessingBatch['qualityGrade'];
    finalNotes?: string;
  }): Promise<{
    success: boolean;
    batch?: ProcessingBatch;
    message?: string;
  }> {
    try {
      const response = await NetworkManager.executeWithRetry(
        () => processingApiClient.completeProduction(batchId, {
          endDate: new Date().toISOString(),
          actualQuantity: completionData.actualQuantity,
          qualityGrade: completionData.qualityGrade,
          finalNotes: completionData.finalNotes
        }),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success) {
        console.log('生产批次完成成功:', response.data);
        return {
          success: true,
          batch: response.data,
          message: '生产批次已完成'
        };
      }

      return { success: false, message: response.message || '完成失败' };
    } catch (error) {
      console.error('完成生产批次失败:', error);
      return { success: false, message: '完成服务暂时不可用' };
    }
  }

  /**
   * 提交质检记录
   */
  static async submitQualityInspection(inspectionData: {
    batchId: string;
    inspectionType: QualityInspection['inspectionType'];
    testItems?: any;
    overallResult: QualityInspection['overallResult'];
    qualityScore?: number;
    defectDetails?: any;
    correctiveActions?: string;
    photos?: any[];
  }): Promise<{
    success: boolean;
    inspection?: QualityInspection;
    message?: string;
  }> {
    try {
      const response = await NetworkManager.executeWithRetry(
        () => processingApiClient.submitInspection({
          batchId: inspectionData.batchId,
          inspectionType: inspectionData.inspectionType,
          inspectionDate: new Date().toISOString(),
          testItems: inspectionData.testItems,
          overallResult: inspectionData.overallResult,
          qualityScore: inspectionData.qualityScore,
          defectDetails: inspectionData.defectDetails,
          correctiveActions: inspectionData.correctiveActions,
          photos: inspectionData.photos
        }),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success) {
        console.log('质检记录提交成功:', response.data);
        return {
          success: true,
          inspection: response.data,
          message: '质检记录已提交'
        };
      }

      return { success: false, message: response.message || '提交失败' };
    } catch (error) {
      console.error('提交质检记录失败:', error);
      return { success: false, message: '提交服务暂时不可用' };
    }
  }

  /**
   * 获取仪表板概览
   */
  static async getDashboardOverview(): Promise<{
    success: boolean;
    data?: {
      production: {
        activeBatches: number;
        completedToday: number;
        totalOutput: number;
        efficiency: number;
      };
      quality: {
        passRate: number;
        avgScore: number;
        inspectionsToday: number;
      };
      equipment: {
        totalEquipment: number;
        activeEquipment: number;
        alertsCount: number;
      };
      alerts: {
        total: number;
        critical: number;
        unresolved: number;
      };
    };
    message?: string;
  }> {
    try {
      const response = await NetworkManager.executeWithRetry(
        () => processingApiClient.getDashboardOverview(),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success) {
        console.log('仪表板概览获取成功:', response.data);
        return {
          success: true,
          data: response.data
        };
      }

      return { success: false, message: response.message || '获取失败' };
    } catch (error) {
      console.error('获取仪表板概览失败:', error);
      return { success: false, message: '获取服务暂时不可用' };
    }
  }

  /**
   * 获取设备监控状态
   */
  static async getEquipmentMonitoring(params?: {
    department?: string;
    status?: string;
  }): Promise<{
    success: boolean;
    data?: {
      equipment: any[];
      summary: {
        total: number;
        active: number;
        warning: number;
        error: number;
        maintenance: number;
      };
    };
    message?: string;
  }> {
    try {
      const response = await NetworkManager.executeWithRetry(
        () => processingApiClient.getEquipmentMonitoring(params),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success) {
        console.log('设备监控状态获取成功:', response.data);
        return {
          success: true,
          data: response.data
        };
      }

      return { success: false, message: response.message || '获取失败' };
    } catch (error) {
      console.error('获取设备监控状态失败:', error);
      return { success: false, message: '获取服务暂时不可用' };
    }
  }

  /**
   * 获取告警列表
   */
  static async getAlerts(params?: {
    page?: number;
    limit?: number;
    severity?: AlertNotification['severity'];
    status?: AlertNotification['status'];
  }): Promise<{
    success: boolean;
    data?: {
      alerts: AlertNotification[];
      total: number;
      page: number;
      limit: number;
    };
    message?: string;
  }> {
    try {
      const response = await NetworkManager.executeWithRetry(
        () => processingApiClient.getAlerts({
          page: params?.page || 1,
          limit: params?.limit || 20,
          severity: params?.severity,
          status: params?.status
        }),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success) {
        console.log('告警列表获取成功:', response.data);
        return {
          success: true,
          data: response.data
        };
      }

      return { success: false, message: response.message || '获取失败' };
    } catch (error) {
      console.error('获取告警列表失败:', error);
      return { success: false, message: '获取服务暂时不可用' };
    }
  }

  /**
   * 确认告警
   */
  static async acknowledgeAlert(alertId: string, notes?: string): Promise<{
    success: boolean;
    alert?: AlertNotification;
    message?: string;
  }> {
    try {
      const response = await NetworkManager.executeWithRetry(
        () => processingApiClient.acknowledgeAlert(alertId, notes),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success) {
        console.log('告警确认成功:', response.data);
        return {
          success: true,
          alert: response.data,
          message: '告警已确认'
        };
      }

      return { success: false, message: response.message || '确认失败' };
    } catch (error) {
      console.error('确认告警失败:', error);
      return { success: false, message: '确认服务暂时不可用' };
    }
  }

  /**
   * 解决告警
   */
  static async resolveAlert(alertId: string, resolutionData: {
    resolutionNotes: string;
    correctiveActions?: string;
  }): Promise<{
    success: boolean;
    alert?: AlertNotification;
    message?: string;
  }> {
    try {
      const response = await NetworkManager.executeWithRetry(
        () => processingApiClient.resolveAlert(alertId, resolutionData),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success) {
        console.log('告警解决成功:', response.data);
        return {
          success: true,
          alert: response.data,
          message: '告警已解决'
        };
      }

      return { success: false, message: response.message || '解决失败' };
    } catch (error) {
      console.error('解决告警失败:', error);
      return { success: false, message: '解决服务暂时不可用' };
    }
  }

  /**
   * 上传加工相关照片
   */
  static async uploadProcessingPhotos(files: any[], metadata: {
    recordId: string;
    recordType: 'processing' | 'work_record' | 'quality_check' | 'production';
    description?: string;
  }): Promise<{
    success: boolean;
    data?: { urls: string[]; fileIds: string[] };
    message?: string;
  }> {
    try {
      const response = await NetworkManager.executeWithRetry(
        () => processingApiClient.uploadProcessingPhotos(files, metadata),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success) {
        console.log('照片上传成功:', response.data);
        return {
          success: true,
          data: response.data,
          message: '照片上传成功'
        };
      }

      return { success: false, message: response.message || '上传失败' };
    } catch (error) {
      console.error('上传照片失败:', error);
      return { success: false, message: '上传服务暂时不可用' };
    }
  }

  /**
   * 缓存批次数据到本地（离线支持）
   */
  static async cacheBatchData(batches: ProcessingBatch[]): Promise<void> {
    try {
      await StorageService.setItem('cached_batches', JSON.stringify(batches));
      await StorageService.setItem('cache_timestamp', new Date().toISOString());
      console.log('批次数据缓存成功');
    } catch (error) {
      console.error('缓存批次数据失败:', error);
    }
  }

  /**
   * 获取缓存的批次数据（离线支持）
   */
  static async getCachedBatchData(): Promise<{
    batches: ProcessingBatch[];
    cacheTime?: string;
  }> {
    try {
      const cachedData = await StorageService.getItem('cached_batches');
      const cacheTime = await StorageService.getItem('cache_timestamp');
      
      if (cachedData) {
        return {
          batches: JSON.parse(cachedData),
          cacheTime
        };
      }
    } catch (error) {
      console.error('获取缓存数据失败:', error);
    }
    
    return { batches: [] };
  }

  /**
   * 同步离线数据
   */
  static async syncOfflineData(): Promise<{
    success: boolean;
    syncedItems: number;
    message?: string;
  }> {
    try {
      const offlineActions = await StorageService.getItem('offline_actions');
      if (!offlineActions) {
        return { success: true, syncedItems: 0, message: '无待同步数据' };
      }

      const actions = JSON.parse(offlineActions);
      let syncedCount = 0;

      for (const action of actions) {
        try {
          // 根据action类型执行相应的同步操作
          switch (action.type) {
            case 'create_batch':
              await this.createProductionBatch(action.data);
              syncedCount++;
              break;
            case 'start_batch':
              await this.startProductionBatch(action.batchId, action.data);
              syncedCount++;
              break;
            case 'complete_batch':
              await this.completeProductionBatch(action.batchId, action.data);
              syncedCount++;
              break;
            case 'submit_inspection':
              await this.submitQualityInspection(action.data);
              syncedCount++;
              break;
          }
        } catch (actionError) {
          console.error('同步单个操作失败:', actionError);
        }
      }

      // 清除已同步的离线操作
      await StorageService.removeItem('offline_actions');

      return {
        success: true,
        syncedItems: syncedCount,
        message: `成功同步 ${syncedCount} 个操作`
      };
    } catch (error) {
      console.error('同步离线数据失败:', error);
      return {
        success: false,
        syncedItems: 0,
        message: '同步服务暂时不可用'
      };
    }
  }
}