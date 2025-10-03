import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { processingApiClient } from '../api/processingApiClient';

// 文件上传配置
const UPLOAD_CONFIG = {
  maxFiles: 10,           // 最大文件数量
  maxFileSize: 10 * 1024 * 1024, // 10MB
  imageQuality: 0.8,      // 图片质量
  imageMaxWidth: 1920,    // 最大宽度
  imageMaxHeight: 1080,   // 最大高度
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'] as const
};

// 图片处理结果接口
interface ProcessedImage {
  uri: string;
  name: string;
  type: string;
  size: number;
  width: number;
  height: number;
}

// 上传进度回调接口
interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// 上传结果接口
interface UploadResult {
  success: boolean;
  urls: string[];
  fileIds: string[];
  errors?: string[];
}

/**
 * 加工模块专用文件上传服务
 * 集成质检照片和生产记录的上传功能
 */
export class ProcessingUploadService {
  /**
   * 选择并处理图片
   */
  static async selectAndProcessImages(maxCount: number = UPLOAD_CONFIG.maxFiles): Promise<ProcessedImage[]> {
    try {
      // 检查相机权限
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (cameraPermission.status !== 'granted' || libraryPermission.status !== 'granted') {
        throw new Error('需要相机和相册权限才能上传图片');
      }

      // 显示选择选项
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: maxCount,
        quality: UPLOAD_CONFIG.imageQuality,
        exif: false, // 移除EXIF数据保护隐私
      });

      if (result.canceled) {
        return [];
      }

      // 处理选中的图片
      const processedImages: ProcessedImage[] = [];
      
      for (const asset of result.assets) {
        try {
          const processedImage = await this.processImage(asset);
          processedImages.push(processedImage);
        } catch (error) {
          console.warn('处理图片失败:', error);
        }
      }

      return processedImages;
    } catch (error) {
      console.error('选择图片失败:', error);
      throw error;
    }
  }

  /**
   * 拍照并处理
   */
  static async captureAndProcessImage(): Promise<ProcessedImage | null> {
    try {
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      
      if (cameraPermission.status !== 'granted') {
        throw new Error('需要相机权限才能拍照');
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: UPLOAD_CONFIG.imageQuality,
        exif: false,
      });

      if (result.canceled) {
        return null;
      }

      return await this.processImage(result.assets[0]);
    } catch (error) {
      console.error('拍照失败:', error);
      throw error;
    }
  }

  /**
   * 批量拍照 (连续拍摄)
   */
  static async captureMultipleImages(count: number = 5): Promise<ProcessedImage[]> {
    const images: ProcessedImage[] = [];
    
    try {
      for (let i = 0; i < count; i++) {
        const image = await this.captureAndProcessImage();
        if (image) {
          images.push(image);
        } else {
          break; // 用户取消拍照，退出循环
        }
      }
      
      return images;
    } catch (error) {
      console.error('批量拍照失败:', error);
      throw error;
    }
  }

  /**
   * 处理单张图片 (压缩、调整尺寸)
   */
  private static async processImage(asset: ImagePicker.ImagePickerAsset): Promise<ProcessedImage> {
    try {
      // 检查文件大小
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);
      if (!fileInfo.exists) {
        throw new Error('文件不存在');
      }

      if (fileInfo.size && fileInfo.size > UPLOAD_CONFIG.maxFileSize) {
        throw new Error(`文件大小超过限制 (${UPLOAD_CONFIG.maxFileSize / 1024 / 1024}MB)`);
      }

      // 图片处理 - 压缩和调整尺寸
      const manipulatorResult = await ImageManipulator.manipulateAsync(
        asset.uri,
        [
          {
            resize: {
              width: Math.min(asset.width || UPLOAD_CONFIG.imageMaxWidth, UPLOAD_CONFIG.imageMaxWidth),
              height: Math.min(asset.height || UPLOAD_CONFIG.imageMaxHeight, UPLOAD_CONFIG.imageMaxHeight),
            }
          }
        ],
        {
          compress: UPLOAD_CONFIG.imageQuality,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      // 获取处理后的文件信息
      const processedFileInfo = await FileSystem.getInfoAsync(manipulatorResult.uri);
      const fileSize = processedFileInfo.exists ? processedFileInfo.size || 0 : 0;
      
      return {
        uri: manipulatorResult.uri,
        name: `processed_${Date.now()}.jpg`,
        type: 'image/jpeg',
        size: fileSize,
        width: manipulatorResult.width,
        height: manipulatorResult.height,
      };
    } catch (error) {
      console.error('处理图片失败:', error);
      throw error;
    }
  }

  /**
   * 上传质检照片
   */
  static async uploadQualityCheckPhotos(
    images: ProcessedImage[],
    metadata: {
      recordId: string;
      checkType: 'raw_material' | 'process' | 'final_product';
      inspector: string;
      location?: { latitude: number; longitude: number };
      description?: string;
    },
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      if (images.length === 0) {
        return { success: true, urls: [], fileIds: [] };
      }

      if (images.length > UPLOAD_CONFIG.maxFiles) {
        throw new Error(`最多只能上传 ${UPLOAD_CONFIG.maxFiles} 个文件`);
      }

      // 创建文件对象
      const files = await Promise.all(
        images.map(async (image) => {
          const fileInfo = await FileSystem.getInfoAsync(image.uri);
          const fileSize = fileInfo.exists ? fileInfo.size || 0 : 0;
          return {
            uri: image.uri,
            name: image.name,
            type: image.type,
            size: fileSize,
          };
        })
      );

      // 上传文件
      const uploadMetadata = {
        recordId: metadata.recordId,
        recordType: 'quality_check' as const,
        description: `质检照片 - ${metadata.checkType} - ${metadata.inspector}`,
        checkType: metadata.checkType,
        inspector: metadata.inspector,
        location: metadata.location,
        additionalInfo: metadata.description,
      };

      const result = await processingApiClient.uploadProcessingPhotos(files, uploadMetadata);

      if (result.success) {
        return {
          success: true,
          urls: result.data.urls,
          fileIds: result.data.fileIds,
        };
      } else {
        throw new Error(result.message || '上传失败');
      }
    } catch (error) {
      console.error('上传质检照片失败:', error);
      return {
        success: false,
        urls: [],
        fileIds: [],
        errors: [error instanceof Error ? error.message : '未知错误'],
      };
    }
  }

  /**
   * 上传生产记录照片
   */
  static async uploadProductionPhotos(
    images: ProcessedImage[],
    metadata: {
      recordId: string;
      workstation: string;
      process: string;
      employee: string;
      location?: { latitude: number; longitude: number };
      description?: string;
    },
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      if (images.length === 0) {
        return { success: true, urls: [], fileIds: [] };
      }

      if (images.length > UPLOAD_CONFIG.maxFiles) {
        throw new Error(`最多只能上传 ${UPLOAD_CONFIG.maxFiles} 个文件`);
      }

      // 创建文件对象
      const files = await Promise.all(
        images.map(async (image) => {
          const fileInfo = await FileSystem.getInfoAsync(image.uri);
          const fileSize = fileInfo.exists ? fileInfo.size || 0 : 0;
          return {
            uri: image.uri,
            name: image.name,
            type: image.type,
            size: fileSize,
          };
        })
      );

      // 上传文件
      const uploadMetadata = {
        recordId: metadata.recordId,
        recordType: 'production' as const,
        description: `生产记录照片 - ${metadata.workstation} - ${metadata.process} - ${metadata.employee}`,
        workstation: metadata.workstation,
        process: metadata.process,
        employee: metadata.employee,
        location: metadata.location,
        additionalInfo: metadata.description,
      };

      const result = await processingApiClient.uploadProcessingPhotos(files, uploadMetadata);

      if (result.success) {
        return {
          success: true,
          urls: result.data.urls,
          fileIds: result.data.fileIds,
        };
      } else {
        throw new Error(result.message || '上传失败');
      }
    } catch (error) {
      console.error('上传生产记录照片失败:', error);
      return {
        success: false,
        urls: [],
        fileIds: [],
        errors: [error instanceof Error ? error.message : '未知错误'],
      };
    }
  }

  /**
   * 清理临时文件
   */
  static async cleanupTempFiles(images: ProcessedImage[]): Promise<void> {
    try {
      await Promise.all(
        images.map(async (image) => {
          try {
            const fileInfo = await FileSystem.getInfoAsync(image.uri);
            if (fileInfo.exists) {
              await FileSystem.deleteAsync(image.uri);
            }
          } catch (error) {
            console.warn('清理临时文件失败:', error);
          }
        })
      );
    } catch (error) {
      console.error('清理临时文件失败:', error);
    }
  }

  /**
   * 验证文件类型
   */
  static isValidImageType(type: string): boolean {
    return UPLOAD_CONFIG.allowedTypes.includes(type as any);
  }

  /**
   * 格式化文件大小显示
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export { UPLOAD_CONFIG, ProcessedImage, UploadResult, UploadProgress };