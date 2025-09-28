import * as Location from 'expo-location';
import { StorageService } from '../storage/storageService';
import { processingApiClient } from '../api/processingApiClient';

// 位置数据接口
export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  timestamp: Date;
}

// 位置记录接口
export interface LocationRecord {
  id: string;
  locationData: LocationData;
  recordId: string;
  recordType: 'processing' | 'work_record';
  uploadStatus: 'pending' | 'uploaded' | 'failed';
  createdAt: Date;
}

// 位置配置
const LOCATION_CONFIG = {
  accuracy: Location.Accuracy.High,
  timeout: 15000, // 15秒超时
  maximumAge: 60000, // 1分钟内的缓存位置可用
  distanceInterval: 10, // 移动10米后更新位置
  timeInterval: 30000, // 30秒时间间隔
};

/**
 * GPS位置服务
 * 提供位置获取、记录、上传功能
 */
export class LocationService {
  private static instance: LocationService;
  private watchSubscription: Location.LocationSubscription | null = null;
  private currentLocation: LocationData | null = null;
  private locationCache: Map<string, LocationData> = new Map();
  private pendingRecords: LocationRecord[] = [];

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  /**
   * 检查和请求位置权限
   */
  async requestPermissions(): Promise<boolean> {
    try {
      // 请求前台位置权限
      const foregroundStatus = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus.status !== 'granted') {
        console.warn('前台位置权限被拒绝');
        return false;
      }

      console.log('位置权限已获取');
      return true;
    } catch (error) {
      console.error('请求位置权限失败:', error);
      return false;
    }
  }

  /**
   * 获取当前位置
   */
  async getCurrentLocation(): Promise<LocationData | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('位置权限不足');
      }

      // 检查位置服务是否启用
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        throw new Error('位置服务未启用');
      }

      console.log('正在获取当前位置...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: LOCATION_CONFIG.accuracy,
      });

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        altitude: location.coords.altitude || undefined,
        speed: location.coords.speed || undefined,
        heading: location.coords.heading || undefined,
        timestamp: new Date(location.timestamp),
      };

      this.currentLocation = locationData;
      
      // 缓存位置数据
      const cacheKey = `${Date.now()}`;
      this.locationCache.set(cacheKey, locationData);

      console.log('位置获取成功:', locationData);
      return locationData;
    } catch (error) {
      console.error('获取位置失败:', error);
      throw error;
    }
  }

  /**
   * 开始监听位置变化
   */
  async startLocationTracking(callback: (location: LocationData) => void): Promise<boolean> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return false;
      }

      if (this.watchSubscription) {
        await this.stopLocationTracking();
      }

      console.log('开始位置监听...');
      this.watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: LOCATION_CONFIG.accuracy,
          timeInterval: LOCATION_CONFIG.timeInterval,
          distanceInterval: LOCATION_CONFIG.distanceInterval,
        },
        (location) => {
          const locationData: LocationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || 0,
            altitude: location.coords.altitude || undefined,
            speed: location.coords.speed || undefined,
            heading: location.coords.heading || undefined,
            timestamp: new Date(location.timestamp),
          };

          this.currentLocation = locationData;
          callback(locationData);
        }
      );

      return true;
    } catch (error) {
      console.error('开始位置监听失败:', error);
      return false;
    }
  }

  /**
   * 停止位置监听
   */
  async stopLocationTracking(): Promise<void> {
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
      console.log('位置监听已停止');
    }
  }

  /**
   * 记录位置到本地存储
   */
  async recordLocation(
    recordId: string,
    recordType: LocationRecord['recordType'],
    location?: LocationData
  ): Promise<LocationRecord | null> {
    try {
      const locationData = location || this.currentLocation;
      
      if (!locationData) {
        // 尝试获取当前位置
        const currentLocation = await this.getCurrentLocation();
        if (!currentLocation) {
          throw new Error('无法获取位置数据');
        }
      }

      const locationRecord: LocationRecord = {
        id: `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        locationData: locationData!,
        recordId,
        recordType,
        uploadStatus: 'pending',
        createdAt: new Date(),
      };

      // 保存到本地存储
      this.pendingRecords.push(locationRecord);
      await this.savePendingRecords();

      console.log('位置记录已保存:', locationRecord);
      return locationRecord;
    } catch (error) {
      console.error('记录位置失败:', error);
      return null;
    }
  }

  /**
   * 上传待上传的位置记录
   */
  async uploadPendingRecords(): Promise<void> {
    try {
      if (this.pendingRecords.length === 0) {
        return;
      }

      const pendingUploads = this.pendingRecords.filter(
        record => record.uploadStatus === 'pending'
      );

      for (const record of pendingUploads) {
        try {
          const response = await processingApiClient.recordLocation({
            recordId: record.recordId,
            recordType: record.recordType,
            latitude: record.locationData.latitude,
            longitude: record.locationData.longitude,
            accuracy: record.locationData.accuracy,
            timestamp: record.locationData.timestamp,
          });

          if (response.success) {
            record.uploadStatus = 'uploaded';
            console.log('位置记录上传成功:', record.id);
          } else {
            record.uploadStatus = 'failed';
            console.warn('位置记录上传失败:', record.id);
          }
        } catch (error) {
          console.error('上传位置记录失败:', record.id, error);
          record.uploadStatus = 'failed';
        }
      }

      // 清理已上传的记录（保留最近100条）
      this.pendingRecords = this.pendingRecords
        .filter(record => record.uploadStatus !== 'uploaded')
        .slice(-100);

      await this.savePendingRecords();
    } catch (error) {
      console.error('上传位置记录失败:', error);
    }
  }

  /**
   * 获取位置距离（米）
   */
  static calculateDistance(
    location1: LocationData,
    location2: { latitude: number; longitude: number }
  ): number {
    const R = 6371000; // 地球半径（米）
    const lat1Rad = (location1.latitude * Math.PI) / 180;
    const lat2Rad = (location2.latitude * Math.PI) / 180;
    const deltaLatRad = ((location2.latitude - location1.latitude) * Math.PI) / 180;
    const deltaLngRad = ((location2.longitude - location1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
      Math.cos(lat1Rad) *
        Math.cos(lat2Rad) *
        Math.sin(deltaLngRad / 2) *
        Math.sin(deltaLngRad / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * 格式化位置显示
   */
  static formatLocation(location: LocationData): string {
    return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  }

  /**
   * 获取位置精度描述
   */
  static getAccuracyDescription(accuracy: number): string {
    if (accuracy <= 5) return '很高';
    if (accuracy <= 10) return '高';
    if (accuracy <= 50) return '中等';
    if (accuracy <= 100) return '低';
    return '很低';
  }

  /**
   * 检查位置是否在工厂范围内（可扩展功能）
   */
  static isLocationInFactory(
    location: LocationData,
    factoryBounds: {
      center: { latitude: number; longitude: number };
      radius: number; // 半径（米）
    }
  ): boolean {
    const distance = LocationService.calculateDistance(
      location,
      factoryBounds.center
    );
    return distance <= factoryBounds.radius;
  }

  /**
   * 获取当前位置缓存
   */
  getCurrentLocationCache(): LocationData | null {
    return this.currentLocation;
  }

  /**
   * 获取待上传记录数量
   */
  getPendingRecordsCount(): number {
    return this.pendingRecords.filter(r => r.uploadStatus === 'pending').length;
  }

  /**
   * 清理位置缓存
   */
  clearLocationCache(): void {
    this.locationCache.clear();
    this.currentLocation = null;
  }

  /**
   * 保存待上传记录到本地存储
   */
  private async savePendingRecords(): Promise<void> {
    try {
      await StorageService.setItem(
        'pending_location_records',
        JSON.stringify(this.pendingRecords)
      );
    } catch (error) {
      console.error('保存待上传位置记录失败:', error);
    }
  }

  /**
   * 从本地存储加载待上传记录
   */
  private async loadPendingRecords(): Promise<void> {
    try {
      const data = await StorageService.getItem('pending_location_records');
      if (data) {
        this.pendingRecords = JSON.parse(data);
      }
    } catch (error) {
      console.error('加载待上传位置记录失败:', error);
      this.pendingRecords = [];
    }
  }
}

export default LocationService.getInstance();