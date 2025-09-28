import { BarCodeScanner, BarCodeScannerResult } from 'expo-barcode-scanner';
import { Alert } from 'react-native';
import { StorageService } from '../storage/storageService';

// 扫码结果接口
export interface QRScanResult {
  data: string;
  type: string;
  timestamp: Date;
  bounds?: {
    origin: { x: number; y: number };
    size: { width: number; height: number };
  };
}

// 扫码记录接口
export interface ScanRecord {
  id: string;
  scanResult: QRScanResult;
  context: 'batch_id' | 'product_id' | 'equipment_id' | 'general';
  processedData?: any;
  createdAt: Date;
}

// 批次ID解析结果
export interface BatchIdData {
  factoryId: string;
  productType: string;
  batchNumber: string;
  date: string;
  isValid: boolean;
}

/**
 * QR码扫描服务
 * 提供二维码扫描、批量扫描、数据解析功能
 */
export class QRScannerService {
  private static instance: QRScannerService;
  private scanHistory: ScanRecord[] = [];
  private isScanning = false;

  static getInstance(): QRScannerService {
    if (!QRScannerService.instance) {
      QRScannerService.instance = new QRScannerService();
    }
    return QRScannerService.instance;
  }

  constructor() {
    this.loadScanHistory();
  }

  /**
   * 请求相机权限
   */
  async requestCameraPermission(): Promise<boolean> {
    try {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          '权限不足',
          '需要相机权限才能扫描二维码',
          [
            { text: '取消', style: 'cancel' },
            {
              text: '设置',
              onPress: () => {
                // 引导用户到设置页面
                console.log('引导用户到设置页面');
              }
            }
          ]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('请求相机权限失败:', error);
      return false;
    }
  }

  /**
   * 单次扫描
   */
  async scanQRCode(
    onScan: (result: QRScanResult) => void,
    context: ScanRecord['context'] = 'general'
  ): Promise<void> {
    try {
      const hasPermission = await this.requestCameraPermission();
      if (!hasPermission) {
        throw new Error('相机权限不足');
      }

      this.isScanning = true;

      // 注意：实际的扫描UI需要在组件中实现
      // 这里只是处理扫描结果的逻辑
      console.log('开始扫描二维码...');
    } catch (error) {
      console.error('扫描二维码失败:', error);
      throw error;
    }
  }

  /**
   * 处理扫描结果
   */
  async handleScanResult(
    scannerResult: BarCodeScannerResult,
    context: ScanRecord['context'] = 'general'
  ): Promise<ScanRecord> {
    const scanResult: QRScanResult = {
      data: scannerResult.data,
      type: scannerResult.type,
      timestamp: new Date(),
      bounds: scannerResult.bounds,
    };

    const scanRecord: ScanRecord = {
      id: `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      scanResult,
      context,
      processedData: this.parseQRData(scannerResult.data, context),
      createdAt: new Date(),
    };

    // 保存到历史记录
    this.addToHistory(scanRecord);

    console.log('扫描结果处理完成:', scanRecord);
    return scanRecord;
  }

  /**
   * 批量连续扫描
   */
  async batchScan(
    maxCount: number = 10,
    onScanProgress: (scannedCount: number, result: QRScanResult) => void,
    context: ScanRecord['context'] = 'batch_id'
  ): Promise<ScanRecord[]> {
    const results: ScanRecord[] = [];
    const scannedData = new Set<string>(); // 避免重复扫描

    try {
      const hasPermission = await this.requestCameraPermission();
      if (!hasPermission) {
        throw new Error('相机权限不足');
      }

      console.log(`开始批量扫描，目标数量：${maxCount}`);
      
      // 批量扫描逻辑需要在UI组件中配合实现
      // 这里提供批量处理的框架

      return results;
    } catch (error) {
      console.error('批量扫描失败:', error);
      throw error;
    }
  }

  /**
   * 解析QR码数据
   */
  parseQRData(data: string, context: ScanRecord['context']): any {
    try {
      switch (context) {
        case 'batch_id':
          return this.parseBatchId(data);
        case 'product_id':
          return this.parseProductId(data);
        case 'equipment_id':
          return this.parseEquipmentId(data);
        default:
          return this.parseGeneralData(data);
      }
    } catch (error) {
      console.error('解析QR码数据失败:', error);
      return { raw: data, error: error instanceof Error ? error.message : '解析失败' };
    }
  }

  /**
   * 解析批次ID
   * 格式：FAC001-PROD-20240807-001
   */
  private parseBatchId(data: string): BatchIdData {
    const batchPattern = /^([A-Z0-9]+)-([A-Z0-9]+)-(\d{8})-(\d{3,})$/;
    const match = data.match(batchPattern);

    if (match) {
      return {
        factoryId: match[1],
        productType: match[2],
        date: match[3],
        batchNumber: match[4],
        isValid: true,
      };
    }

    return {
      factoryId: '',
      productType: '',
      date: '',
      batchNumber: '',
      isValid: false,
    };
  }

  /**
   * 解析产品ID
   */
  private parseProductId(data: string): any {
    try {
      // 尝试解析JSON格式
      if (data.startsWith('{') && data.endsWith('}')) {
        return JSON.parse(data);
      }

      // 解析简单格式：PROD-001-20240807
      const productPattern = /^([A-Z0-9]+)-(\d+)-(\d{8})$/;
      const match = data.match(productPattern);

      if (match) {
        return {
          productCode: match[1],
          serialNumber: match[2],
          productionDate: match[3],
          isValid: true,
        };
      }

      return { raw: data, isValid: false };
    } catch (error) {
      return { raw: data, error: error instanceof Error ? error.message : '解析失败' };
    }
  }

  /**
   * 解析设备ID
   */
  private parseEquipmentId(data: string): any {
    // 设备ID格式：EQ-001-MIXER-A
    const equipmentPattern = /^EQ-(\d+)-([A-Z]+)-([A-Z])$/;
    const match = data.match(equipmentPattern);

    if (match) {
      return {
        equipmentId: match[1],
        equipmentType: match[2],
        zone: match[3],
        isValid: true,
      };
    }

    return { raw: data, isValid: false };
  }

  /**
   * 解析通用数据
   */
  private parseGeneralData(data: string): any {
    try {
      // 尝试解析JSON
      if ((data.startsWith('{') && data.endsWith('}')) || 
          (data.startsWith('[') && data.endsWith(']'))) {
        return JSON.parse(data);
      }

      // 尝试解析URL
      if (data.startsWith('http://') || data.startsWith('https://')) {
        try {
          const url = new URL(data);
          return {
            type: 'url',
            domain: url.hostname,
            path: url.pathname,
            params: Object.fromEntries(url.searchParams),
            isValid: true,
          };
        } catch {
          return { type: 'url', raw: data, isValid: false };
        }
      }

      // 纯文本
      return {
        type: 'text',
        content: data,
        length: data.length,
        isValid: true,
      };
    } catch (error) {
      return {
        type: 'unknown',
        raw: data,
        error: error instanceof Error ? error.message : '解析失败',
        isValid: false,
      };
    }
  }

  /**
   * 验证批次ID格式
   */
  static validateBatchId(batchId: string): boolean {
    const batchPattern = /^[A-Z0-9]+-[A-Z0-9]+-\d{8}-\d{3,}$/;
    return batchPattern.test(batchId);
  }

  /**
   * 生成批次ID
   */
  static generateBatchId(
    factoryId: string,
    productType: string,
    date: Date,
    sequence: number
  ): string {
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const sequenceStr = sequence.toString().padStart(3, '0');
    return `${factoryId}-${productType}-${dateStr}-${sequenceStr}`;
  }

  /**
   * 添加到扫描历史
   */
  private addToHistory(record: ScanRecord): void {
    this.scanHistory.unshift(record);
    
    // 保留最近100条记录
    this.scanHistory = this.scanHistory.slice(0, 100);
    
    this.saveScanHistory();
  }

  /**
   * 获取扫描历史
   */
  getScanHistory(limit?: number): ScanRecord[] {
    return limit ? this.scanHistory.slice(0, limit) : this.scanHistory;
  }

  /**
   * 清理扫描历史
   */
  clearScanHistory(): void {
    this.scanHistory = [];
    this.saveScanHistory();
  }

  /**
   * 根据上下文过滤历史记录
   */
  getHistoryByContext(context: ScanRecord['context']): ScanRecord[] {
    return this.scanHistory.filter(record => record.context === context);
  }

  /**
   * 获取今日扫描统计
   */
  getTodayStats(): {
    total: number;
    byContext: Record<ScanRecord['context'], number>;
  } {
    const today = new Date().toDateString();
    const todayRecords = this.scanHistory.filter(
      record => record.createdAt.toDateString() === today
    );

    const byContext = todayRecords.reduce((acc, record) => {
      acc[record.context] = (acc[record.context] || 0) + 1;
      return acc;
    }, {} as Record<ScanRecord['context'], number>);

    return {
      total: todayRecords.length,
      byContext,
    };
  }

  /**
   * 搜索扫描历史
   */
  searchHistory(keyword: string): ScanRecord[] {
    const lowerKeyword = keyword.toLowerCase();
    return this.scanHistory.filter(record =>
      record.scanResult.data.toLowerCase().includes(lowerKeyword) ||
      record.context.includes(lowerKeyword)
    );
  }

  /**
   * 保存扫描历史到本地存储
   */
  private async saveScanHistory(): Promise<void> {
    try {
      await StorageService.setItem('scan_history', JSON.stringify(this.scanHistory));
    } catch (error) {
      console.error('保存扫描历史失败:', error);
    }
  }

  /**
   * 从本地存储加载扫描历史
   */
  private async loadScanHistory(): Promise<void> {
    try {
      const data = await StorageService.getItem('scan_history');
      if (data) {
        this.scanHistory = JSON.parse(data);
      }
    } catch (error) {
      console.error('加载扫描历史失败:', error);
      this.scanHistory = [];
    }
  }

  /**
   * 获取扫描状态
   */
  isCurrentlyScanning(): boolean {
    return this.isScanning;
  }

  /**
   * 停止扫描
   */
  stopScanning(): void {
    this.isScanning = false;
  }
}

export default QRScannerService.getInstance();