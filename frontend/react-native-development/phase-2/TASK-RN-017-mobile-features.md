# TASK-RN-017: 移动端特色功能

> React Native Android开发 - Phase 2 Week 3
>
> 任务编号: TASK-RN-017
> 工期: 2.5天 (20小时)
> 优先级: 高
> 状态: 待开始
> 依赖: TASK-RN-016

## 🎯 任务目标

实现移动端独有的特色功能，包括二维码扫描、拍照记录、GPS定位、推送通知和文件上传等，充分发挥移动设备的优势，提升用户体验和工作效率。

## 📋 具体工作内容

### 1. 二维码扫描功能 (5小时)

#### 扫码组件实现
```typescript
// src/components/QRScanner/QRCodeScanner.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import { useScanBarcodes, BarcodeFormat } from 'vision-camera-code-scanner';

interface QRCodeScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  title?: string;
  description?: string;
  formats?: BarcodeFormat[];
}

export function QRCodeScanner({ 
  onScan, 
  onClose, 
  title = "扫描二维码",
  description = "将二维码置于框内进行扫描",
  formats = [BarcodeFormat.QR_CODE, BarcodeFormat.EAN_13]
}: QRCodeScannerProps) {
  const [hasPermission, setHasPermission] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const devices = useCameraDevices();
  const device = devices.back;

  const [frameProcessor, barcodes] = useScanBarcodes(formats, {
    checkInverted: true,
  });

  useEffect(() => {
    checkCameraPermission();
  }, []);

  useEffect(() => {
    if (barcodes.length > 0 && isActive) {
      const scannedData = barcodes[0].displayValue;
      setIsActive(false);
      onScan(scannedData);
    }
  }, [barcodes, isActive]);

  const checkCameraPermission = async () => {
    const status = await Camera.getCameraPermissionStatus();
    if (status === 'not-determined') {
      const newStatus = await Camera.requestCameraPermission();
      setHasPermission(newStatus === 'authorized');
    } else {
      setHasPermission(status === 'authorized');
    }
  };

  if (!hasPermission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>需要相机权限才能扫描二维码</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={checkCameraPermission}>
          <Text style={styles.permissionButtonText}>授权相机</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>无法访问相机</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={styles.camera}
        device={device}
        isActive={isActive}
        frameProcessor={frameProcessor}
        frameProcessorFps={5}
      />
      
      <View style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.scanArea}>
          <View style={styles.scanFrame} />
          <Text style={styles.description}>{description}</Text>
        </View>
        
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.manualButton}
            onPress={() => {
              Alert.prompt(
                '手动输入',
                '请输入编码',
                (text) => {
                  if (text) onScan(text);
                }
              );
            }}
          >
            <Text style={styles.manualButtonText}>手动输入</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
```

#### 批次信息解析器
```typescript
// src/modules/processing/utils/batchCodeParser.ts
interface BatchInfo {
  batchCode: string;
  productType: string;
  productionDate: Date;
  supplierCode: string;
  qualityGrade: string;
  expiryDate: Date;
}

export class BatchCodeParser {
  // 解析标准批次二维码
  static parseStandardBatch(qrData: string): BatchInfo | null {
    try {
      // 标准格式: BATCH|P001|20250105|SUP001|A|20250205
      const parts = qrData.split('|');
      
      if (parts.length !== 6 || parts[0] !== 'BATCH') {
        return null;
      }

      return {
        batchCode: parts[1],
        productType: parts[1].substring(0, 4),
        productionDate: this.parseDate(parts[2]),
        supplierCode: parts[3],
        qualityGrade: parts[4],
        expiryDate: this.parseDate(parts[5])
      };
    } catch (error) {
      console.error('批次码解析失败:', error);
      return null;
    }
  }

  // 解析设备二维码
  static parseEquipmentCode(qrData: string): EquipmentInfo | null {
    try {
      // 设备格式: DEVICE|LINE01|MIXER001|STATUS_OK
      const parts = qrData.split('|');
      
      if (parts.length !== 4 || parts[0] !== 'DEVICE') {
        return null;
      }

      return {
        deviceType: 'equipment',
        lineCode: parts[1],
        equipmentId: parts[2],
        status: parts[3]
      };
    } catch (error) {
      return null;
    }
  }

  private static parseDate(dateStr: string): Date {
    // YYYYMMDD 格式
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day);
  }
}
```

### 2. 拍照功能 (4小时)

#### 智能拍照组件
```typescript
// src/components/Camera/SmartCamera.tsx
import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, Text, Image, StyleSheet } from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';

interface SmartCameraProps {
  onPhotoTaken: (photoUri: string, metadata: PhotoMetadata) => void;
  maxPhotos?: number;
  photoType: 'material' | 'process' | 'quality' | 'equipment';
  autoEnhance?: boolean;
}

export function SmartCamera({ 
  onPhotoTaken, 
  maxPhotos = 5, 
  photoType,
  autoEnhance = true 
}: SmartCameraProps) {
  const camera = useRef<Camera>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const devices = useCameraDevices();
  const device = devices.back;

  const takePhoto = async () => {
    if (!camera.current || isCapturing) return;

    setIsCapturing(true);
    
    try {
      const photo = await camera.current.takePhoto({
        quality: 90,
        enableAutoRedEyeReduction: true,
        enableAutoStabilization: true,
        enableShutterSound: true
      });

      const photoUri = `file://${photo.path}`;
      
      // 生成照片元数据
      const metadata: PhotoMetadata = {
        timestamp: Date.now(),
        location: await getCurrentLocation(),
        type: photoType,
        quality: 'high',
        size: photo.width * photo.height,
        originalPath: photo.path
      };

      // 自动增强处理
      const processedUri = autoEnhance 
        ? await enhancePhoto(photoUri, photoType)
        : photoUri;

      setPhotos(prev => [...prev, processedUri]);
      onPhotoTaken(processedUri, metadata);
      
    } catch (error) {
      console.error('拍照失败:', error);
      Alert.alert('错误', '拍照失败，请重试');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Camera
        ref={camera}
        style={styles.camera}
        device={device}
        isActive={true}
        photo={true}
      />
      
      <View style={styles.controls}>
        <View style={styles.photoPreview}>
          {photos.slice(-3).map((uri, index) => (
            <Image key={index} source={{ uri }} style={styles.thumbnail} />
          ))}
        </View>
        
        <TouchableOpacity 
          style={[styles.captureButton, isCapturing && styles.capturing]}
          onPress={takePhoto}
          disabled={isCapturing || photos.length >= maxPhotos}
        >
          <View style={styles.captureButtonInner} />
        </TouchableOpacity>
        
        <Text style={styles.counter}>
          {photos.length} / {maxPhotos}
        </Text>
      </View>
    </View>
  );
}

// 照片增强处理
async function enhancePhoto(photoUri: string, type: string): Promise<string> {
  // 根据照片类型应用不同的增强算法
  const enhanceConfig = {
    material: { brightness: 1.1, contrast: 1.2, saturation: 1.1 },
    process: { brightness: 1.0, contrast: 1.3, sharpness: 1.2 },
    quality: { brightness: 1.2, contrast: 1.4, clarity: 1.3 },
    equipment: { brightness: 1.0, contrast: 1.1, detail: 1.2 }
  };

  // 这里可以集成图像处理库进行增强
  // 暂时返回原图片URI
  return photoUri;
}
```

### 3. GPS定位功能 (3小时)

#### 位置服务管理器
```typescript
// src/services/locationService.ts
import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  address?: string;
  workArea?: string;
}

class LocationService {
  private watchId: number | null = null;
  private currentLocation: LocationData | null = null;

  async initialize(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: '位置权限',
          message: '应用需要访问您的位置信息来记录操作地点',
          buttonNeutral: '稍后询问',
          buttonNegative: '拒绝',
          buttonPositive: '允许',
        }
      );
      
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    
    return true;
  }

  async getCurrentLocation(): Promise<LocationData> {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        async (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
            address: await this.reverseGeocode(
              position.coords.latitude,
              position.coords.longitude
            ),
            workArea: this.identifyWorkArea(
              position.coords.latitude,
              position.coords.longitude
            )
          };
          
          this.currentLocation = locationData;
          resolve(locationData);
        },
        (error) => {
          console.error('获取位置失败:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000
        }
      );
    });
  }

  // 识别工作区域
  private identifyWorkArea(lat: number, lng: number): string {
    // 预定义的工作区域边界
    const workAreas = [
      { name: '原料接收区', bounds: { /* 边界坐标 */ } },
      { name: '生产车间A', bounds: { /* 边界坐标 */ } },
      { name: '质检实验室', bounds: { /* 边界坐标 */ } },
      { name: '包装车间', bounds: { /* 边界坐标 */ } },
      { name: '成品仓库', bounds: { /* 边界坐标 */ } }
    ];

    for (const area of workAreas) {
      if (this.isPointInBounds(lat, lng, area.bounds)) {
        return area.name;
      }
    }

    return '未知区域';
  }

  // 反向地理编码
  private async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      // 这里可以集成地图服务API
      // 暂时返回坐标字符串
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }

  startLocationTracking(callback: (location: LocationData) => void): void {
    this.watchId = Geolocation.watchPosition(
      async (position) => {
        const locationData: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          workArea: this.identifyWorkArea(
            position.coords.latitude,
            position.coords.longitude
          )
        };
        
        callback(locationData);
      },
      (error) => console.error('位置跟踪错误:', error),
      {
        enableHighAccuracy: true,
        distanceFilter: 10, // 10米变化才更新
        interval: 30000 // 30秒更新一次
      }
    );
  }

  stopLocationTracking(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}

export const locationService = new LocationService();
```

### 4. 推送通知 (4小时)

#### 通知管理器
```typescript
// src/services/notificationService.ts
import PushNotification from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { Platform } from 'react-native';

interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: 'alert' | 'warning' | 'info' | 'success';
  priority: 'low' | 'normal' | 'high' | 'critical';
  data?: any;
  scheduledTime?: Date;
  recurring?: boolean;
}

class NotificationService {
  constructor() {
    this.configure();
  }

  private configure(): void {
    PushNotification.configure({
      onRegister: (token) => {
        console.log('推送Token:', token);
        this.registerTokenWithServer(token.token);
      },

      onNotification: (notification) => {
        console.log('收到通知:', notification);
        
        if (notification.userInteraction) {
          // 用户点击了通知
          this.handleNotificationTap(notification);
        }

        // iOS需要调用完成回调
        if (Platform.OS === 'ios') {
          notification.finish(PushNotificationIOS.FetchResult.NoData);
        }
      },

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });

    // 创建通知渠道 (Android)
    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: 'processing-alerts',
          channelName: '生产告警',
          channelDescription: '生产过程中的重要告警通知',
          importance: 4,
          vibrate: true,
        },
        (created) => console.log(`通知渠道创建: ${created}`)
      );
    }
  }

  // 发送本地通知
  sendLocalNotification(data: NotificationData): void {
    PushNotification.localNotification({
      id: data.id,
      title: data.title,
      message: data.message,
      channelId: 'processing-alerts',
      priority: this.getPriorityValue(data.priority),
      vibrate: data.priority === 'critical',
      playSound: true,
      soundName: data.priority === 'critical' ? 'alert.mp3' : 'default',
      userInfo: data.data,
      actions: this.getNotificationActions(data.type),
    });
  }

  // 调度通知
  scheduleNotification(data: NotificationData): void {
    PushNotification.localNotificationSchedule({
      id: data.id,
      title: data.title,
      message: data.message,
      date: data.scheduledTime || new Date(Date.now() + 60 * 1000),
      channelId: 'processing-alerts',
      repeatType: data.recurring ? 'day' : undefined,
      userInfo: data.data,
    });
  }

  // 发送生产告警
  sendProductionAlert(alertData: ProductionAlertData): void {
    const notification: NotificationData = {
      id: `alert_${alertData.id}`,
      title: `生产告警 - ${alertData.severity.toUpperCase()}`,
      message: `${alertData.location}: ${alertData.problem}`,
      type: 'alert',
      priority: alertData.severity === 'critical' ? 'critical' : 'high',
      data: {
        type: 'production_alert',
        alertId: alertData.id,
        location: alertData.location,
        action: 'view_details'
      }
    };

    this.sendLocalNotification(notification);
  }

  // 发送质检提醒
  sendQualityReminder(batchCode: string, stage: string): void {
    const notification: NotificationData = {
      id: `quality_${batchCode}`,
      title: '质检提醒',
      message: `批次 ${batchCode} 需要进行${stage}质检`,
      type: 'info',
      priority: 'normal',
      data: {
        type: 'quality_reminder',
        batchCode,
        stage,
        action: 'start_quality_check'
      }
    };

    this.sendLocalNotification(notification);
  }

  private handleNotificationTap(notification: any): void {
    const { data } = notification;
    
    switch (data?.type) {
      case 'production_alert':
        // 导航到告警详情页面
        break;
      case 'quality_reminder':
        // 导航到质检页面
        break;
      default:
        // 默认行为
        break;
    }
  }

  private getPriorityValue(priority: string): number {
    const priorityMap = {
      low: 0,
      normal: 1,
      high: 2,
      critical: 3
    };
    return priorityMap[priority] || 1;
  }

  private getNotificationActions(type: string): string[] {
    switch (type) {
      case 'alert':
        return ['查看详情', '忽略'];
      case 'warning':
        return ['立即处理', '稍后提醒'];
      default:
        return ['查看'];
    }
  }

  private async registerTokenWithServer(token: string): Promise<void> {
    try {
      await apiClient.post('/api/notifications/register', {
        token,
        platform: Platform.OS,
        userId: await AsyncStorage.getItem('userId')
      });
    } catch (error) {
      console.error('推送Token注册失败:', error);
    }
  }
}

export const notificationService = new NotificationService();
```

### 5. 文件上传管理 (4小时)

#### 批量上传管理器
```typescript
// src/services/uploadService.ts
import { DocumentPicker } from 'react-native-document-picker';
import RNFS from 'react-native-fs';

interface UploadTask {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'paused';
  retryCount: number;
  uploadUrl?: string;
}

class UploadService {
  private uploadQueue: UploadTask[] = [];
  private activeUploads = new Map<string, XMLHttpRequest>();
  private maxConcurrentUploads = 3;

  // 批量选择文件
  async selectFiles(type: 'image' | 'document' | 'any' = 'any'): Promise<UploadTask[]> {
    try {
      const results = await DocumentPicker.pick({
        type: this.getDocumentType(type),
        allowMultiSelection: true,
        copyTo: 'cachesDirectory'
      });

      const tasks: UploadTask[] = results.map(result => ({
        id: `upload_${Date.now()}_${Math.random()}`,
        filePath: result.fileCopyUri || result.uri,
        fileName: result.name || 'unknown',
        fileSize: result.size || 0,
        mimeType: result.type || 'application/octet-stream',
        progress: 0,
        status: 'pending',
        retryCount: 0
      }));

      this.uploadQueue.push(...tasks);
      this.processUploadQueue();

      return tasks;
    } catch (error) {
      console.error('文件选择失败:', error);
      return [];
    }
  }

  // 上传单个文件
  async uploadFile(
    filePath: string, 
    fileName: string, 
    category: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const taskId = `upload_${Date.now()}`;
      
      this.activeUploads.set(taskId, xhr);

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          onProgress?.(progress);
        }
      });

      xhr.addEventListener('load', () => {
        this.activeUploads.delete(taskId);
        
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          resolve(response.fileUrl);
        } else {
          reject(new Error(`上传失败: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        this.activeUploads.delete(taskId);
        reject(new Error('上传失败'));
      });

      const formData = new FormData();
      formData.append('file', {
        uri: filePath,
        type: 'image/jpeg',
        name: fileName
      } as any);
      formData.append('category', category);
      formData.append('timestamp', Date.now().toString());

      xhr.open('POST', '/api/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${getAuthToken()}`);
      xhr.send(formData);
    });
  }

  // 批量上传照片
  async uploadPhotos(
    photos: string[], 
    category: string,
    metadata: PhotoMetadata[]
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    for (let i = 0; i < photos.length; i++) {
      try {
        const compressedPhoto = await this.compressImage(photos[i]);
        const fileUrl = await this.uploadFile(
          compressedPhoto,
          `photo_${Date.now()}_${i}.jpg`,
          category,
          (progress) => {
            // 更新上传进度
            this.updateUploadProgress(`photo_${i}`, progress);
          }
        );

        results.push({
          originalPath: photos[i],
          uploadUrl: fileUrl,
          metadata: metadata[i],
          status: 'success'
        });
      } catch (error) {
        results.push({
          originalPath: photos[i],
          uploadUrl: '',
          metadata: metadata[i],
          status: 'failed',
          error: error.message
        });
      }
    }

    return results;
  }

  // 图片压缩
  private async compressImage(imagePath: string, quality: number = 0.8): Promise<string> {
    // 可以集成图片压缩库
    // 这里简化处理，直接返回原路径
    return imagePath;
  }

  // 处理上传队列
  private processUploadQueue(): void {
    const pendingTasks = this.uploadQueue.filter(task => task.status === 'pending');
    const currentActiveCount = this.activeUploads.size;
    const availableSlots = this.maxConcurrentUploads - currentActiveCount;

    const tasksToProcess = pendingTasks.slice(0, availableSlots);

    tasksToProcess.forEach(task => {
      this.processUploadTask(task);
    });
  }

  private async processUploadTask(task: UploadTask): Promise<void> {
    task.status = 'uploading';

    try {
      const uploadUrl = await this.uploadFile(
        task.filePath,
        task.fileName,
        'processing',
        (progress) => {
          task.progress = progress;
          this.notifyProgressUpdate(task);
        }
      );

      task.uploadUrl = uploadUrl;
      task.status = 'completed';
      task.progress = 100;
    } catch (error) {
      task.status = 'failed';
      task.retryCount++;
      
      // 自动重试
      if (task.retryCount < 3) {
        setTimeout(() => {
          task.status = 'pending';
          this.processUploadQueue();
        }, 2000 * task.retryCount);
      }
    }

    this.notifyProgressUpdate(task);
    this.processUploadQueue(); // 继续处理队列
  }

  private notifyProgressUpdate(task: UploadTask): void {
    // 发送上传进度事件
    // 可以使用EventEmitter或者状态管理
  }

  private getDocumentType(type: string): string[] {
    switch (type) {
      case 'image':
        return ['image/*'];
      case 'document':
        return ['application/pdf', 'application/msword', 'text/*'];
      default:
        return ['*/*'];
    }
  }
}

export const uploadService = new UploadService();
```

## ✅ 验收标准

### 功能验收
- [ ] **二维码扫描**: 准确识别各种二维码格式，支持手动输入
- [ ] **拍照功能**: 高质量照片拍摄，支持自动增强和分类管理
- [ ] **GPS定位**: 准确获取位置信息和工作区域识别
- [ ] **推送通知**: 及时推送生产告警和任务提醒
- [ ] **文件上传**: 稳定的批量上传和进度管理

### 性能验收
- [ ] **扫码速度**: 二维码识别响应时间 < 2秒
- [ ] **拍照质量**: 照片清晰度和色彩还原良好
- [ ] **定位精度**: GPS定位精度 < 10米
- [ ] **上传效率**: 文件上传成功率 > 95%
- [ ] **通知及时性**: 推送通知延迟 < 5秒

### 用户体验
- [ ] **操作流畅**: 所有功能操作响应快速
- [ ] **权限友好**: 权限请求有清晰说明
- [ ] **错误处理**: 各种异常情况有友好提示
- [ ] **离线支持**: 网络异常时功能降级处理

## 🔗 依赖关系

### 输入依赖
- TASK-RN-016 三大模块框架完成
- 相机和位置权限配置
- 推送服务配置
- 文件上传API就绪

### 输出交付
- 完整的移动端特色功能集
- 与加工模块深度集成
- 优秀的用户体验
- 稳定的服务质量

---

**任务负责人**: [待分配]
**预估开始时间**: TASK-RN-016完成后
**预估完成时间**: 2.5个工作日后

*本任务完成后，应用将具备强大的移动端特色功能，充分发挥移动设备优势。*