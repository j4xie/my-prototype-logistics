import { reportApiClient, ReportTemplate, ReportGenerateRequest, ReportFile } from '../api/reportApiClient';
import { StorageService } from '../storage/storageService';
import { NetworkManager } from '../networkManager';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

/**
 * 报表服务
 * 提供报表管理的业务逻辑封装
 */
export class ReportService {
  private static readonly CACHE_KEY_PREFIX = 'report_cache_';
  private static readonly CACHE_DURATION = 10 * 60 * 1000; // 10分钟缓存
  private static readonly DOWNLOAD_DIR = FileSystem.documentDirectory + 'reports/';

  /**
   * 确保下载目录存在
   */
  private static async ensureDownloadDirectory(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.DOWNLOAD_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.DOWNLOAD_DIR, { intermediates: true });
        console.log('报表下载目录已创建:', this.DOWNLOAD_DIR);
      }
    } catch (error) {
      console.error('创建下载目录失败:', error);
    }
  }

  /**
   * 获取报表模板列表
   */
  static async getReportTemplates(params?: {
    category?: ReportTemplate['category'];
    type?: ReportTemplate['type'];
    useCache?: boolean;
  }): Promise<{
    success: boolean;
    data?: {
      templates: ReportTemplate[];
      total: number;
    };
    message?: string;
  }> {
    try {
      // 生成缓存key
      const cacheKey = `${this.CACHE_KEY_PREFIX}templates_${JSON.stringify(params || {})}`;
      
      // 尝试从缓存获取（如果允许）
      if (params?.useCache !== false) {
        const cachedData = await this.getCachedData(cacheKey);
        if (cachedData) {
          console.log('使用缓存的报表模板数据');
          return { success: true, data: cachedData };
        }
      }

      // 检查网络连接
      const isConnected = await NetworkManager.isConnected();
      if (!isConnected) {
        // 尝试获取缓存数据作为离线回退
        const offlineData = await this.getCachedData(cacheKey);
        if (offlineData) {
          return { success: true, data: offlineData, message: '网络不可用，显示缓存数据' };
        }
        throw new Error('网络连接不可用，请检查网络设置');
      }

      // 调用API
      const response = await NetworkManager.executeWithRetry(
        () => reportApiClient.getReportTemplates({
          category: params?.category,
          type: params?.type,
          isActive: true
        }),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        // 缓存数据
        await this.setCachedData(cacheKey, response.data);
        
        console.log('报表模板列表获取成功:', {
          count: response.data.templates.length,
          total: response.data.total
        });

        return {
          success: true,
          data: response.data
        };
      }

      return { success: false, message: response.message || '获取报表模板失败' };
    } catch (error) {
      console.error('获取报表模板失败:', error);
      return { success: false, message: error.message || '获取报表模板失败' };
    }
  }

  /**
   * 生成报表
   */
  static async generateReport(reportData: ReportGenerateRequest): Promise<{
    success: boolean;
    reportFile?: ReportFile;
    message?: string;
  }> {
    try {
      const response = await NetworkManager.executeWithRetry(
        () => reportData.type === 'excel' 
          ? reportApiClient.generateExcelReport(reportData)
          : reportApiClient.generatePDFReport(reportData),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        console.log('报表生成成功:', response.data);
        
        // 清除模板缓存，因为可能有新的报表历史
        await this.clearRelatedCache();
        
        return {
          success: true,
          reportFile: response.data,
          message: '报表生成成功'
        };
      }

      return { success: false, message: response.message || '报表生成失败' };
    } catch (error) {
      console.error('报表生成失败:', error);
      return { success: false, message: error.message || '报表生成失败' };
    }
  }

  /**
   * 下载并保存报表文件
   */
  static async downloadReport(reportFile: ReportFile, showProgress?: boolean): Promise<{
    success: boolean;
    localPath?: string;
    message?: string;
  }> {
    try {
      // 确保下载目录存在
      await this.ensureDownloadDirectory();

      // 获取下载链接
      const downloadResponse = await reportApiClient.downloadReport(reportFile.filename);
      
      if (!downloadResponse.success || !downloadResponse.data) {
        throw new Error(downloadResponse.message || '获取下载链接失败');
      }

      const { url, filename, contentType } = downloadResponse.data;
      const localPath = this.DOWNLOAD_DIR + filename;

      console.log('开始下载报表:', { url, filename, localPath });

      // 下载文件
      const downloadResult = await FileSystem.downloadAsync(
        url,
        localPath,
        {
          headers: {
            'Content-Type': contentType
          }
        }
      );

      if (downloadResult.status !== 200) {
        throw new Error(`下载失败，状态码: ${downloadResult.status}`);
      }

      console.log('报表下载成功:', downloadResult);

      return {
        success: true,
        localPath: downloadResult.uri,
        message: '报表下载成功'
      };
    } catch (error) {
      console.error('下载报表失败:', error);
      return {
        success: false,
        message: error.message || '下载报表失败'
      };
    }
  }

  /**
   * 分享报表文件
   */
  static async shareReport(localPath: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('分享功能不可用');
      }

      await Sharing.shareAsync(localPath, {
        mimeType: localPath.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: '分享报表文件'
      });

      console.log('报表分享成功:', localPath);
      return {
        success: true,
        message: '报表分享成功'
      };
    } catch (error) {
      console.error('分享报表失败:', error);
      return {
        success: false,
        message: error.message || '分享报表失败'
      };
    }
  }

  /**
   * 获取报表生成历史
   */
  static async getReportHistory(params?: {
    page?: number;
    limit?: number;
    type?: ReportFile['type'];
    status?: ReportFile['status'];
    useCache?: boolean;
  }): Promise<{
    success: boolean;
    data?: {
      reports: ReportFile[];
      total: number;
      page: number;
      limit: number;
    };
    message?: string;
  }> {
    try {
      // 生成缓存key
      const cacheKey = `${this.CACHE_KEY_PREFIX}history_${JSON.stringify(params || {})}`;
      
      // 尝试从缓存获取（如果允许）
      if (params?.useCache !== false) {
        const cachedData = await this.getCachedData(cacheKey);
        if (cachedData) {
          console.log('使用缓存的报表历史数据');
          return { success: true, data: cachedData };
        }
      }

      // 检查网络连接
      const isConnected = await NetworkManager.isConnected();
      if (!isConnected) {
        // 尝试获取缓存数据作为离线回退
        const offlineData = await this.getCachedData(cacheKey);
        if (offlineData) {
          return { success: true, data: offlineData, message: '网络不可用，显示缓存数据' };
        }
        throw new Error('网络连接不可用，请检查网络设置');
      }

      // 调用API
      const response = await NetworkManager.executeWithRetry(
        () => reportApiClient.getReportHistory({
          page: params?.page || 1,
          limit: params?.limit || 20,
          type: params?.type,
          status: params?.status
        }),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        // 缓存数据（较短的缓存时间）
        await this.setCachedData(cacheKey, response.data, 5 * 60 * 1000); // 5分钟
        
        console.log('报表历史获取成功:', {
          count: response.data.reports.length,
          total: response.data.total,
          page: response.data.page
        });

        return {
          success: true,
          data: response.data
        };
      }

      return { success: false, message: response.message || '获取报表历史失败' };
    } catch (error) {
      console.error('获取报表历史失败:', error);
      return { success: false, message: error.message || '获取报表历史失败' };
    }
  }

  /**
   * 预览报表数据
   */
  static async previewReportData(reportData: Partial<ReportGenerateRequest>): Promise<{
    success: boolean;
    data?: {
      headers: string[];
      rows: any[][];
      total: number;
    };
    message?: string;
  }> {
    try {
      const response = await NetworkManager.executeWithRetry(
        () => reportApiClient.previewReportData(reportData),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        console.log('报表数据预览成功:', {
          headers: response.data.headers.length,
          rows: response.data.rows.length,
          total: response.data.total
        });

        return {
          success: true,
          data: response.data
        };
      }

      return { success: false, message: response.message || '预览报表数据失败' };
    } catch (error) {
      console.error('预览报表数据失败:', error);
      return { success: false, message: error.message || '预览报表数据失败' };
    }
  }

  /**
   * 获取数据源字段配置
   */
  static async getDataSourceFields(dataSource: ReportGenerateRequest['dataSource']): Promise<{
    success: boolean;
    data?: {
      fields: Array<{
        key: string;
        label: string;
        type: 'string' | 'number' | 'date' | 'boolean';
        filterable: boolean;
        sortable: boolean;
      }>;
      filters: Array<{
        key: string;
        label: string;
        type: 'select' | 'date' | 'text' | 'number';
        options?: Array<{ value: string; label: string }>;
      }>;
    };
    message?: string;
  }> {
    try {
      const cacheKey = `${this.CACHE_KEY_PREFIX}fields_${dataSource}`;
      
      // 尝试从缓存获取
      const cachedData = await this.getCachedData(cacheKey);
      if (cachedData) {
        console.log('使用缓存的数据源字段');
        return { success: true, data: cachedData };
      }

      const response = await NetworkManager.executeWithRetry(
        () => reportApiClient.getDataSourceFields(dataSource),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        // 缓存字段配置（较长的缓存时间）
        await this.setCachedData(cacheKey, response.data, 30 * 60 * 1000); // 30分钟
        
        console.log('数据源字段获取成功:', {
          dataSource,
          fields: response.data.fields.length,
          filters: response.data.filters.length
        });

        return {
          success: true,
          data: response.data
        };
      }

      return { success: false, message: response.message || '获取数据源字段失败' };
    } catch (error) {
      console.error('获取数据源字段失败:', error);
      return { success: false, message: error.message || '获取数据源字段失败' };
    }
  }

  /**
   * 删除本地报表文件
   */
  static async deleteLocalReport(localPath: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(localPath);
        console.log('本地报表文件删除成功:', localPath);
      }

      return {
        success: true,
        message: '报表文件删除成功'
      };
    } catch (error) {
      console.error('删除本地报表文件失败:', error);
      return {
        success: false,
        message: error.message || '删除报表文件失败'
      };
    }
  }

  /**
   * 获取本地报表文件列表
   */
  static async getLocalReports(): Promise<{
    success: boolean;
    files?: Array<{
      name: string;
      path: string;
      size: number;
      modifiedTime: number;
      type: 'excel' | 'pdf';
    }>;
    message?: string;
  }> {
    try {
      await this.ensureDownloadDirectory();
      
      const dirInfo = await FileSystem.readDirectoryAsync(this.DOWNLOAD_DIR);
      const files = [];

      for (const filename of dirInfo) {
        const filePath = this.DOWNLOAD_DIR + filename;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        
        if (fileInfo.exists && !fileInfo.isDirectory) {
          files.push({
            name: filename,
            path: filePath,
            size: fileInfo.size || 0,
            modifiedTime: fileInfo.modificationTime || 0,
            type: filename.endsWith('.pdf') ? 'pdf' : 'excel'
          });
        }
      }

      console.log('本地报表文件列表:', files.length);
      return {
        success: true,
        files: files.sort((a, b) => b.modifiedTime - a.modifiedTime)
      };
    } catch (error) {
      console.error('获取本地报表文件列表失败:', error);
      return {
        success: false,
        message: error.message || '获取本地文件列表失败'
      };
    }
  }

  /**
   * 获取报表类型显示信息
   */
  static getTypeDisplayInfo(type: ReportFile['type']): {
    label: string;
    icon: string;
    color: string;
    extension: string;
  } {
    const typeMap = {
      excel: { 
        label: 'Excel', 
        icon: 'document-text', 
        color: '#00AA66', 
        extension: '.xlsx' 
      },
      pdf: { 
        label: 'PDF', 
        icon: 'document', 
        color: '#FF4444', 
        extension: '.pdf' 
      }
    };
    return typeMap[type] || typeMap.excel;
  }

  /**
   * 获取报表状态显示信息
   */
  static getStatusDisplayInfo(status: ReportFile['status']): {
    label: string;
    icon: string;
    color: string;
  } {
    const statusMap = {
      generating: { label: '生成中', icon: 'hourglass', color: '#FFBB33' },
      completed: { label: '已完成', icon: 'checkmark-circle', color: '#00AA88' },
      failed: { label: '失败', icon: 'close-circle', color: '#FF4444' }
    };
    return statusMap[status] || statusMap.generating;
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 格式化时间显示
   */
  static formatTime(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  }

  /**
   * 缓存数据
   */
  private static async setCachedData(key: string, data: any, customDuration?: number): Promise<void> {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        duration: customDuration || this.CACHE_DURATION
      };
      await StorageService.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('缓存数据失败:', error);
    }
  }

  /**
   * 获取缓存数据
   */
  private static async getCachedData(key: string): Promise<any | null> {
    try {
      const cachedItem = await StorageService.getItem(key);
      if (!cachedItem) return null;

      const cacheData = JSON.parse(cachedItem);
      const isExpired = Date.now() - cacheData.timestamp > cacheData.duration;
      
      if (isExpired) {
        await StorageService.removeItem(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.warn('获取缓存数据失败:', error);
      return null;
    }
  }

  /**
   * 清除相关缓存
   */
  private static async clearRelatedCache(): Promise<void> {
    try {
      // 获取所有缓存键
      const keys = await StorageService.getAllKeys();
      const reportCacheKeys = keys.filter(key => key.startsWith(this.CACHE_KEY_PREFIX));
      
      // 删除所有报表相关缓存
      await Promise.all(
        reportCacheKeys.map(key => StorageService.removeItem(key))
      );
      
      console.log('清除报表缓存完成:', reportCacheKeys.length);
    } catch (error) {
      console.warn('清除缓存失败:', error);
    }
  }
}