import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

// API 响应包装类型 (后端返回的标准格式)
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/**
 * ISAPI 海康威视摄像头/NVR 设备管理 API 客户端
 *
 * 后端实现：
 * - IsapiDeviceController: /api/mobile/{factoryId}/isapi/devices/*
 *
 * 功能：
 * - 设备 CRUD (IPC/NVR/DVR)
 * - 连接测试与同步
 * - 流媒体地址获取
 * - 图片抓拍
 * - 告警事件订阅
 * - 事件日志查询
 */

// ========== 类型定义 ==========

/**
 * 设备类型
 */
export type IsapiDeviceType = 'IPC' | 'NVR' | 'DVR' | 'ENCODER';

/**
 * 协议类型
 */
export type IsapiProtocol = 'HTTP' | 'HTTPS';

/**
 * 设备状态
 */
export type IsapiDeviceStatus = 'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'ERROR' | 'UNKNOWN';

/**
 * 通道状态
 */
export type IsapiChannelStatus = 'ONLINE' | 'OFFLINE' | 'NO_VIDEO';

/**
 * 通道类型
 */
export type IsapiChannelType = 'ANALOG' | 'IP' | 'VIRTUAL';

/**
 * 事件状态
 */
export type IsapiEventState = 'ACTIVE' | 'INACTIVE';

/**
 * 告警严重程度
 */
export type IsapiEventSeverity = 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

/**
 * ISAPI 设备
 */
export interface IsapiDevice {
  id: string;
  factoryId: string;
  deviceName: string;
  deviceType: IsapiDeviceType;
  deviceModel?: string;
  serialNumber?: string;
  firmwareVersion?: string;

  // 网络配置
  ipAddress: string;
  port: number;
  rtspPort?: number;
  httpsPort?: number;
  protocol: IsapiProtocol;

  // 认证 (仅用于创建/更新，不返回密码)
  username: string;

  // 设备能力
  channelCount: number;
  supportsPtz?: boolean;
  supportsAudio?: boolean;
  supportsSmart?: boolean;
  deviceCapabilities?: Record<string, unknown>;

  // 状态
  status: IsapiDeviceStatus;
  lastError?: string;
  lastHeartbeatAt?: string;
  lastEventAt?: string;

  // 订阅状态
  alertSubscribed?: boolean;
  subscribedEvents?: string[];

  // 位置
  locationDescription?: string;
  latitude?: number;
  longitude?: number;

  // 关联
  departmentId?: string;
  equipmentId?: string;

  // 通道
  channels?: IsapiDeviceChannel[];

  // 时间戳
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 设备通道
 */
export interface IsapiDeviceChannel {
  id: string;
  channelId: number;
  channelName?: string;
  channelType: IsapiChannelType;
  sourceIp?: string;
  sourcePort?: number;
  mainStreamUrl?: string;
  subStreamUrl?: string;
  status: IsapiChannelStatus;
  recordingEnabled?: boolean;
  smartEnabled?: boolean;
  enabledEvents?: string[];
}

/**
 * 流媒体地址
 */
export interface IsapiStream {
  channelId: number;
  channelName: string;
  mainStreamUrl: string;
  subStreamUrl: string;
  status: IsapiChannelStatus;
}

/**
 * 抓拍结果
 */
export interface IsapiCapture {
  success: boolean;
  deviceId: string;
  channelId: number;
  captureTime: string;
  pictureBase64?: string;
  pictureUrl?: string;
  error?: string;
}

/**
 * 事件日志
 */
export interface IsapiEvent {
  id: number;
  factoryId: string;
  deviceId: string;
  eventType: string;
  eventTypeName: string;
  eventState: IsapiEventState;
  eventDescription?: string;
  channelId?: number;
  eventData?: Record<string, unknown>;
  detectionRegion?: Record<string, unknown>;
  pictureUrl?: string;
  hasPicture?: boolean;
  eventTime: string;
  receivedTime: string;
  processed: boolean;
  processedAt?: string;
  processedBy?: string;
  processResult?: string;
  alertId?: string;
  isHeartbeat?: boolean;
  severity: IsapiEventSeverity;
}

/**
 * 创建设备请求
 */
export interface CreateIsapiDeviceRequest {
  deviceName: string;
  deviceType: IsapiDeviceType;
  deviceModel?: string;
  serialNumber?: string;
  macAddress?: string;
  firmwareVersion?: string;
  ipAddress: string;
  port?: number;
  rtspPort?: number;
  httpsPort?: number;
  protocol?: IsapiProtocol;
  username: string;
  password: string;
  locationDescription?: string;
  departmentId?: string;
  equipmentId?: string;
}

/**
 * 更新设备请求
 */
export interface UpdateIsapiDeviceRequest {
  deviceName?: string;
  deviceModel?: string;
  serialNumber?: string;
  port?: number;
  rtspPort?: number;
  httpsPort?: number;
  protocol?: IsapiProtocol;
  username?: string;
  password?: string;
  locationDescription?: string;
  departmentId?: string;
  equipmentId?: string;
}

/**
 * 事件统计
 */
export interface IsapiEventStatistics {
  byType: Record<string, number>;
  byDevice: Record<string, number>;
  unprocessedCount: number;
  todayAlerts: number;
}

// ========== 设备 CRUD API ==========

/**
 * 获取设备列表
 */
export async function getIsapiDevices(params?: {
  page?: number;
  size?: number;
  keyword?: string;
}): Promise<PageResponse<IsapiDevice>> {
  const factoryId = getCurrentFactoryId();
  const response = await apiClient.get<ApiResponse<PageResponse<IsapiDevice>>>(
    `/api/mobile/${factoryId}/isapi/devices`,
    { params }
  );
  return response.data;
}

/**
 * 获取设备详情
 */
export async function getIsapiDevice(deviceId: string): Promise<IsapiDevice> {
  const factoryId = getCurrentFactoryId();
  const response = await apiClient.get<ApiResponse<IsapiDevice>>(
    `/api/mobile/${factoryId}/isapi/devices/${deviceId}`
  );
  return response.data;
}

/**
 * 添加设备
 */
export async function createIsapiDevice(request: CreateIsapiDeviceRequest): Promise<IsapiDevice> {
  const factoryId = getCurrentFactoryId();
  const response = await apiClient.post<ApiResponse<IsapiDevice>>(
    `/api/mobile/${factoryId}/isapi/devices`,
    request
  );
  return response.data;
}

/**
 * 更新设备
 */
export async function updateIsapiDevice(
  deviceId: string,
  request: UpdateIsapiDeviceRequest
): Promise<IsapiDevice> {
  const factoryId = getCurrentFactoryId();
  const response = await apiClient.put<ApiResponse<IsapiDevice>>(
    `/api/mobile/${factoryId}/isapi/devices/${deviceId}`,
    request
  );
  return response.data;
}

/**
 * 删除设备
 */
export async function deleteIsapiDevice(deviceId: string): Promise<void> {
  const factoryId = getCurrentFactoryId();
  await apiClient.delete(`/api/mobile/${factoryId}/isapi/devices/${deviceId}`);
}

// ========== 连接管理 API ==========

/**
 * 测试设备连接
 */
export async function testConnection(deviceId: string): Promise<{
  connected: boolean;
  deviceId: string;
  testedAt: string;
}> {
  const factoryId = getCurrentFactoryId();
  type ResultType = { connected: boolean; deviceId: string; testedAt: string };
  const response = await apiClient.post<ApiResponse<ResultType>>(
    `/api/mobile/${factoryId}/isapi/devices/${deviceId}/test-connection`
  );
  return response.data;
}

/**
 * 同步设备信息
 */
export async function syncDevice(deviceId: string): Promise<IsapiDevice> {
  const factoryId = getCurrentFactoryId();
  const response = await apiClient.post<ApiResponse<IsapiDevice>>(
    `/api/mobile/${factoryId}/isapi/devices/${deviceId}/sync`
  );
  return response.data;
}

// ========== 流媒体 API ==========

/**
 * 获取流媒体地址
 */
export async function getStreamUrls(deviceId: string): Promise<IsapiStream[]> {
  const factoryId = getCurrentFactoryId();
  const response = await apiClient.get<ApiResponse<IsapiStream[]>>(
    `/api/mobile/${factoryId}/isapi/devices/${deviceId}/streams`
  );
  return response.data;
}

/**
 * 抓拍图片
 */
export async function capturePicture(deviceId: string, channelId?: number): Promise<IsapiCapture> {
  const factoryId = getCurrentFactoryId();
  const params = channelId ? { channelId } : {};
  const response = await apiClient.post<ApiResponse<IsapiCapture>>(
    `/api/mobile/${factoryId}/isapi/devices/${deviceId}/capture`,
    null,
    { params }
  );
  return response.data;
}

/**
 * 获取抓拍图片 URL
 */
export function getCaptureImageUrl(deviceId: string, channelId: number = 1): string {
  // 这个 URL 需要在组件中使用时添加 factoryId
  return `/api/mobile/{factoryId}/isapi/devices/${deviceId}/capture/image?channelId=${channelId}`;
}

// ========== 告警订阅 API ==========

/**
 * 订阅设备告警
 */
export async function subscribeDevice(deviceId: string): Promise<void> {
  const factoryId = getCurrentFactoryId();
  await apiClient.post(`/api/mobile/${factoryId}/isapi/devices/${deviceId}/subscribe`);
}

/**
 * 取消订阅设备告警
 */
export async function unsubscribeDevice(deviceId: string): Promise<void> {
  const factoryId = getCurrentFactoryId();
  await apiClient.post(`/api/mobile/${factoryId}/isapi/devices/${deviceId}/unsubscribe`);
}

/**
 * 订阅所有在线设备
 */
export async function subscribeAllDevices(): Promise<void> {
  const factoryId = getCurrentFactoryId();
  await apiClient.post(`/api/mobile/${factoryId}/isapi/devices/subscribe-all`);
}

/**
 * 获取订阅状态
 */
export async function getSubscriptionStatus(): Promise<{
  activeCount: number;
  activeDevices: string[];
}> {
  const factoryId = getCurrentFactoryId();
  type ResultType = { activeCount: number; activeDevices: string[] };
  const response = await apiClient.get<ApiResponse<ResultType>>(
    `/api/mobile/${factoryId}/isapi/devices/subscription-status`
  );
  return response.data;
}

// ========== 事件日志 API ==========

/**
 * 获取事件日志列表
 */
export async function getEvents(params?: {
  deviceId?: string;
  eventType?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<IsapiEvent>> {
  const factoryId = getCurrentFactoryId();
  const response = await apiClient.get<ApiResponse<PageResponse<IsapiEvent>>>(
    `/api/mobile/${factoryId}/isapi/devices/events`,
    { params }
  );
  return response.data;
}

/**
 * 获取最近告警
 */
export async function getRecentAlerts(limit?: number): Promise<IsapiEvent[]> {
  const factoryId = getCurrentFactoryId();
  const params = limit ? { limit } : {};
  const response = await apiClient.get<ApiResponse<IsapiEvent[]>>(
    `/api/mobile/${factoryId}/isapi/devices/events/recent`,
    { params }
  );
  return response.data;
}

/**
 * 获取事件统计
 */
export async function getEventStatistics(hours?: number): Promise<IsapiEventStatistics> {
  const factoryId = getCurrentFactoryId();
  const params = hours ? { hours } : {};
  const response = await apiClient.get<ApiResponse<IsapiEventStatistics>>(
    `/api/mobile/${factoryId}/isapi/devices/events/statistics`,
    { params }
  );
  return response.data;
}

/**
 * 处理事件
 */
export async function processEvent(
  eventId: number,
  processedBy: string,
  result?: string
): Promise<void> {
  const factoryId = getCurrentFactoryId();
  const params = { processedBy, result };
  await apiClient.post(`/api/mobile/${factoryId}/isapi/devices/events/${eventId}/process`, null, { params });
}

// ========== 状态统计 API ==========

/**
 * 获取设备状态汇总
 */
export async function getStatusSummary(): Promise<{
  deviceStatus: Record<string, number>;
  subscriptionCount: number;
}> {
  const factoryId = getCurrentFactoryId();
  type ResultType = { deviceStatus: Record<string, number>; subscriptionCount: number };
  const response = await apiClient.get<ApiResponse<ResultType>>(
    `/api/mobile/${factoryId}/isapi/devices/status-summary`
  );
  return response.data;
}

// ========== 辅助方法 ==========

/**
 * 获取设备类型显示名称
 */
export function getDeviceTypeName(type: IsapiDeviceType): string {
  const names: Record<IsapiDeviceType, string> = {
    IPC: '网络摄像机',
    NVR: '网络硬盘录像机',
    DVR: '硬盘录像机',
    ENCODER: '编码器',
  };
  return names[type] || type;
}

/**
 * 获取设备状态显示名称
 */
export function getDeviceStatusName(status: IsapiDeviceStatus): string {
  const names: Record<IsapiDeviceStatus, string> = {
    ONLINE: '在线',
    OFFLINE: '离线',
    CONNECTING: '连接中',
    ERROR: '错误',
    UNKNOWN: '未知',
  };
  return names[status] || status;
}

/**
 * 获取设备状态颜色
 */
export function getDeviceStatusColor(status: IsapiDeviceStatus): string {
  const colors: Record<IsapiDeviceStatus, string> = {
    ONLINE: '#48bb78',
    OFFLINE: '#a0aec0',
    CONNECTING: '#ed8936',
    ERROR: '#e53e3e',
    UNKNOWN: '#718096',
  };
  return colors[status] || '#718096';
}

/**
 * 获取事件严重程度颜色
 */
export function getEventSeverityColor(severity: IsapiEventSeverity): string {
  const colors: Record<IsapiEventSeverity, string> = {
    HIGH: '#e53e3e',
    MEDIUM: '#ed8936',
    LOW: '#ecc94b',
    INFO: '#3182ce',
  };
  return colors[severity] || '#718096';
}

// ========== 智能分析类型定义 ==========

/**
 * 检测类型
 */
export type SmartDetectionType = 'LINE_DETECTION' | 'FIELD_DETECTION' | 'FACE_DETECTION';

/**
 * 坐标点 (归一化坐标 0-10000)
 */
export interface SmartCoordinate {
  x: number;
  y: number;
}

/**
 * 时间段配置
 */
export interface SmartTimeSchedule {
  beginTime: string;  // HH:mm:ss
  endTime: string;    // HH:mm:ss
  daysOfWeek?: number[];  // 1-7
}

/**
 * 检测规则
 */
export interface SmartDetectionRule {
  id: string;
  enabled: boolean;
  ruleName: string;
  sensitivity: number;         // 1-100
  coordinates: SmartCoordinate[];
  direction?: 'LEFT_TO_RIGHT' | 'RIGHT_TO_LEFT' | 'BOTH';
  eventThreshold?: number;
  timeThresholdSeconds?: number;
  alarmOutput?: boolean;
  timeSchedule?: SmartTimeSchedule;
}

/**
 * 智能分析配置
 */
export interface SmartAnalysisConfig {
  deviceId?: string;
  channelId: number;
  detectionType: SmartDetectionType;
  enabled: boolean;
  rules?: SmartDetectionRule[];
  sensitivity?: number;
  normalizeWidth?: number;   // 归一化宽度，默认 10000
  normalizeHeight?: number;  // 归一化高度，默认 10000
}

/**
 * 智能分析能力
 */
export interface SmartCapabilities {
  smartSupported: boolean;
  lineDetectionSupported: boolean;
  fieldDetectionSupported: boolean;
  faceDetectionSupported: boolean;
  maxLineDetectionRules?: number;
  maxFieldDetectionRules?: number;
  supportedTargetTypes?: string[];
}

/**
 * 智能分析状态
 */
export interface SmartStatus {
  smartSupported: boolean;
  lineDetection?: {
    supported: boolean;
    enabled?: boolean;
    ruleCount?: number;
    error?: string;
  };
  fieldDetection?: {
    supported: boolean;
    enabled?: boolean;
    ruleCount?: number;
    error?: string;
  };
  faceDetection?: {
    supported: boolean;
    enabled?: boolean;
    error?: string;
  };
}

// ========== 智能分析 API ==========

/**
 * 获取设备智能分析能力
 */
export async function getSmartCapabilities(deviceId: string): Promise<SmartCapabilities> {
  const factoryId = getCurrentFactoryId();
  const response = await apiClient.get<ApiResponse<SmartCapabilities>>(
    `/api/mobile/${factoryId}/isapi/devices/${deviceId}/smart/capabilities`
  );
  return response.data;
}

/**
 * 获取智能分析状态摘要
 */
export async function getSmartStatus(deviceId: string, channelId: number = 1): Promise<SmartStatus> {
  const factoryId = getCurrentFactoryId();
  const response = await apiClient.get<ApiResponse<SmartStatus>>(
    `/api/mobile/${factoryId}/isapi/devices/${deviceId}/smart/channels/${channelId}/status`
  );
  return response.data;
}

/**
 * 获取所有智能分析配置
 */
export async function getAllSmartConfig(deviceId: string, channelId: number = 1): Promise<{
  capabilities: SmartCapabilities;
  lineDetection?: SmartAnalysisConfig;
  fieldDetection?: SmartAnalysisConfig;
  faceDetection?: SmartAnalysisConfig;
  lineDetectionError?: string;
  fieldDetectionError?: string;
  faceDetectionError?: string;
}> {
  const factoryId = getCurrentFactoryId();
  type ResultType = {
    capabilities: SmartCapabilities;
    lineDetection?: SmartAnalysisConfig;
    fieldDetection?: SmartAnalysisConfig;
    faceDetection?: SmartAnalysisConfig;
    lineDetectionError?: string;
    fieldDetectionError?: string;
    faceDetectionError?: string;
  };
  const response = await apiClient.get<ApiResponse<ResultType>>(
    `/api/mobile/${factoryId}/isapi/devices/${deviceId}/smart/all/${channelId}`
  );
  return response.data;
}

// ========== 越界检测 API ==========

/**
 * 获取越界检测配置
 */
export async function getLineDetectionConfig(deviceId: string, channelId: number = 1): Promise<SmartAnalysisConfig> {
  const factoryId = getCurrentFactoryId();
  const response = await apiClient.get<ApiResponse<SmartAnalysisConfig>>(
    `/api/mobile/${factoryId}/isapi/devices/${deviceId}/smart/channels/${channelId}/line-detection`
  );
  return response.data;
}

/**
 * 保存越界检测配置
 */
export async function saveLineDetectionConfig(
  deviceId: string,
  channelId: number,
  config: SmartAnalysisConfig
): Promise<void> {
  const factoryId = getCurrentFactoryId();
  await apiClient.put(
    `/api/mobile/${factoryId}/isapi/devices/${deviceId}/smart/channels/${channelId}/line-detection`,
    config
  );
}

// ========== 区域入侵检测 API ==========

/**
 * 获取区域入侵检测配置
 */
export async function getFieldDetectionConfig(deviceId: string, channelId: number = 1): Promise<SmartAnalysisConfig> {
  const factoryId = getCurrentFactoryId();
  const response = await apiClient.get<ApiResponse<SmartAnalysisConfig>>(
    `/api/mobile/${factoryId}/isapi/devices/${deviceId}/smart/channels/${channelId}/field-detection`
  );
  return response.data;
}

/**
 * 保存区域入侵检测配置
 */
export async function saveFieldDetectionConfig(
  deviceId: string,
  channelId: number,
  config: SmartAnalysisConfig
): Promise<void> {
  const factoryId = getCurrentFactoryId();
  await apiClient.put(
    `/api/mobile/${factoryId}/isapi/devices/${deviceId}/smart/channels/${channelId}/field-detection`,
    config
  );
}

// ========== 人脸检测 API ==========

/**
 * 获取人脸检测配置
 */
export async function getFaceDetectionConfig(deviceId: string, channelId: number = 1): Promise<SmartAnalysisConfig> {
  const factoryId = getCurrentFactoryId();
  const response = await apiClient.get<ApiResponse<SmartAnalysisConfig>>(
    `/api/mobile/${factoryId}/isapi/devices/${deviceId}/smart/channels/${channelId}/face-detection`
  );
  return response.data;
}

/**
 * 保存人脸检测配置
 */
export async function saveFaceDetectionConfig(
  deviceId: string,
  channelId: number,
  config: SmartAnalysisConfig
): Promise<void> {
  const factoryId = getCurrentFactoryId();
  await apiClient.put(
    `/api/mobile/${factoryId}/isapi/devices/${deviceId}/smart/channels/${channelId}/face-detection`,
    config
  );
}

// ========== 智能分析辅助方法 ==========

/**
 * 获取检测类型显示名称
 */
export function getDetectionTypeName(type: SmartDetectionType): string {
  const names: Record<SmartDetectionType, string> = {
    LINE_DETECTION: '越界检测',
    FIELD_DETECTION: '区域入侵',
    FACE_DETECTION: '人脸检测',
  };
  return names[type] || type;
}

/**
 * 获取检测类型图标
 */
export function getDetectionTypeIcon(type: SmartDetectionType): string {
  const icons: Record<SmartDetectionType, string> = {
    LINE_DETECTION: 'border-horizontal',
    FIELD_DETECTION: 'shape-polygon-plus',
    FACE_DETECTION: 'face-recognition',
  };
  return icons[type] || 'cog';
}

/**
 * 获取检测类型颜色
 */
export function getDetectionTypeColor(type: SmartDetectionType): string {
  const colors: Record<SmartDetectionType, string> = {
    LINE_DETECTION: '#3182ce',  // 蓝色
    FIELD_DETECTION: '#38a169', // 绿色
    FACE_DETECTION: '#805ad5',  // 紫色
  };
  return colors[type] || '#718096';
}

/**
 * 将归一化坐标转换为实际像素坐标
 * @param normalized 归一化坐标 (0-10000)
 * @param actualWidth 实际宽度
 * @param actualHeight 实际高度
 */
export function normalizedToPixel(
  normalized: SmartCoordinate,
  actualWidth: number,
  actualHeight: number
): { x: number; y: number } {
  return {
    x: (normalized.x / 10000) * actualWidth,
    y: (normalized.y / 10000) * actualHeight,
  };
}

/**
 * 将实际像素坐标转换为归一化坐标
 * @param pixel 像素坐标
 * @param actualWidth 实际宽度
 * @param actualHeight 实际高度
 */
export function pixelToNormalized(
  pixel: { x: number; y: number },
  actualWidth: number,
  actualHeight: number
): SmartCoordinate {
  return {
    x: Math.round((pixel.x / actualWidth) * 10000),
    y: Math.round((pixel.y / actualHeight) * 10000),
  };
}

/**
 * 创建默认检测规则
 */
export function createDefaultRule(type: SmartDetectionType): SmartDetectionRule {
  const baseRule: SmartDetectionRule = {
    id: `rule_${Date.now()}`,
    enabled: true,
    ruleName: '新规则',
    sensitivity: 50,
    coordinates: [],
    alarmOutput: true,
  };

  if (type === 'LINE_DETECTION') {
    // 默认水平线
    baseRule.coordinates = [
      { x: 2000, y: 5000 },
      { x: 8000, y: 5000 },
    ];
    baseRule.direction = 'BOTH';
  } else if (type === 'FIELD_DETECTION') {
    // 默认矩形区域
    baseRule.coordinates = [
      { x: 2000, y: 2000 },
      { x: 8000, y: 2000 },
      { x: 8000, y: 8000 },
      { x: 2000, y: 8000 },
    ];
    baseRule.timeThresholdSeconds = 5;
  }

  return baseRule;
}

// ========== 设备发现类型定义 ==========

/**
 * 设备发现请求
 */
export interface DeviceDiscoveryRequest {
  networkCIDR: string;
  timeout?: number;
  ports?: number[];
  maxConcurrent?: number;
}

/**
 * 发现的设备
 */
export interface DiscoveredDevice {
  ipAddress: string;
  port: number;
  deviceType: string;
  deviceModel?: string;
  serialNumber?: string;
  deviceName?: string;
  manufacturer: string;
  isapiSupported: boolean;
  authRequired: boolean;
}

/**
 * 批量导入请求
 */
export interface BatchImportRequest {
  devices: Array<{
    ipAddress: string;
    port: number;
    username: string;
    password: string;
    deviceName?: string;
    deviceType?: string;
  }>;
}

/**
 * 批量导入结果
 */
export interface BatchImportResult {
  imported: number;
  failed: number;
  failedDevices?: Array<{
    ipAddress: string;
    error: string;
  }>;
}

// ========== 设备发现 API ==========

/**
 * 发现网络中的 ISAPI 设备
 */
export async function discoverDevices(request: DeviceDiscoveryRequest): Promise<DiscoveredDevice[]> {
  const factoryId = getCurrentFactoryId();
  const response = await apiClient.post<ApiResponse<DiscoveredDevice[]>>(
    `/api/mobile/${factoryId}/isapi/devices/discover`,
    request
  );
  return response.data;
}

/**
 * 批量导入设备
 */
export async function batchImportDevices(request: BatchImportRequest): Promise<BatchImportResult> {
  const factoryId = getCurrentFactoryId();
  const response = await apiClient.post<ApiResponse<BatchImportResult>>(
    `/api/mobile/${factoryId}/isapi/devices/batch-import`,
    request
  );
  return response.data;
}

/**
 * 扫描单个主机
 */
export async function scanSingleHost(ip: string): Promise<DiscoveredDevice[]> {
  const factoryId = getCurrentFactoryId();
  const response = await apiClient.get<ApiResponse<DiscoveredDevice[]>>(
    `/api/mobile/${factoryId}/isapi/devices/scan/${ip}`
  );
  return response.data;
}

// ========== 高级设备管理 API ==========

/**
 * 获取设备密码
 */
export async function getDevicePassword(deviceId: string): Promise<{ password: string; deviceId: string }> {
  const factoryId = getCurrentFactoryId();
  const response = await apiClient.get<ApiResponse<{ password: string; deviceId: string }>>(
    `/api/mobile/${factoryId}/isapi/devices/${deviceId}/password`
  );
  if (!response.success) {
    throw new Error(response.message || '获取密码失败');
  }
  return response.data;
}

/**
 * 修改设备密码
 */
export async function changeDevicePassword(deviceId: string, newPassword: string): Promise<void> {
  const factoryId = getCurrentFactoryId();
  const response = await apiClient.put<ApiResponse<void>>(
    `/api/mobile/${factoryId}/isapi/devices/${deviceId}/password`,
    { newPassword }
  );
  if (!response.success) {
    throw new Error(response.message || '修改密码失败');
  }
}

/**
 * 重启设备
 */
export async function rebootDevice(deviceId: string): Promise<void> {
  const factoryId = getCurrentFactoryId();
  const response = await apiClient.post<ApiResponse<void>>(
    `/api/mobile/${factoryId}/isapi/devices/${deviceId}/reboot`
  );
  if (!response.success) {
    throw new Error(response.message || '重启失败');
  }
}

/**
 * 恢复出厂设置
 */
export async function factoryResetDevice(deviceId: string): Promise<void> {
  const factoryId = getCurrentFactoryId();
  const response = await apiClient.post<ApiResponse<void>>(
    `/api/mobile/${factoryId}/isapi/devices/${deviceId}/factory-reset`
  );
  if (!response.success) {
    throw new Error(response.message || '恢复出厂设置失败');
  }
}

// ========== 导出默认对象 ==========

export default {
  // 设备 CRUD
  getIsapiDevices,
  getIsapiDevice,
  createIsapiDevice,
  updateIsapiDevice,
  deleteIsapiDevice,

  // 连接管理
  testConnection,
  syncDevice,

  // 流媒体
  getStreamUrls,
  capturePicture,
  getCaptureImageUrl,

  // 告警订阅
  subscribeDevice,
  unsubscribeDevice,
  subscribeAllDevices,
  getSubscriptionStatus,

  // 事件日志
  getEvents,
  getRecentAlerts,
  getEventStatistics,
  processEvent,

  // 状态统计
  getStatusSummary,

  // 智能分析
  getSmartCapabilities,
  getSmartStatus,
  getAllSmartConfig,
  getLineDetectionConfig,
  saveLineDetectionConfig,
  getFieldDetectionConfig,
  saveFieldDetectionConfig,
  getFaceDetectionConfig,
  saveFaceDetectionConfig,

  // 设备发现
  discoverDevices,
  batchImportDevices,
  scanSingleHost,

  // 高级设备管理
  getDevicePassword,
  changeDevicePassword,
  rebootDevice,
  factoryResetDevice,

  // 辅助方法
  getDeviceTypeName,
  getDeviceStatusName,
  getDeviceStatusColor,
  getEventSeverityColor,
  getDetectionTypeName,
  getDetectionTypeIcon,
  getDetectionTypeColor,
  normalizedToPixel,
  pixelToNormalized,
  createDefaultRule,
};
