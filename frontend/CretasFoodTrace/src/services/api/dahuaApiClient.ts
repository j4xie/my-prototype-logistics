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
 * Dahua 大华摄像头/NVR 设备管理 API 客户端
 *
 * 后端实现：
 * - DahuaDeviceController: /api/mobile/{factoryId}/dahua/devices/*
 *
 * 功能：
 * - 设备发现 (DH-SD 协议)
 * - 设备 CRUD (IPC/NVR/DVR/XVR)
 * - 设备激活与配置
 * - 连接测试与同步
 * - 流媒体地址获取
 * - 图片抓拍
 */

// ========== 类型定义 ==========

/**
 * 设备类型
 */
export type DahuaDeviceType = 'IPC' | 'NVR' | 'DVR' | 'XVR';

/**
 * 协议类型
 */
export type DahuaProtocol = 'HTTP' | 'HTTPS';

/**
 * 设备状态
 */
export type DahuaDeviceStatus = 'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'ERROR' | 'UNKNOWN' | 'UNACTIVATED';

/**
 * 通道状态
 */
export type DahuaChannelStatus = 'ONLINE' | 'OFFLINE' | 'NO_VIDEO';

/**
 * Dahua 设备
 */
export interface DahuaDevice {
  id: string;
  factoryId: string;
  deviceName: string;
  deviceType: DahuaDeviceType;
  deviceModel?: string;
  serialNumber?: string;
  macAddress?: string;
  firmwareVersion?: string;

  // 网络配置
  ipAddress: string;
  port: number;          // HTTP port (default 80)
  rtspPort: number;      // RTSP port (default 554)
  tcpPort: number;       // Dahua TCP port (default 37777)
  httpsPort: number;     // HTTPS port (default 443)
  protocol: DahuaProtocol;

  // 认证 (仅用于创建/更新，不返回密码)
  username: string;

  // 设备能力
  channelCount: number;
  supportsPtz: boolean;
  supportsAudio: boolean;
  supportsSmart: boolean;

  // 状态
  status: DahuaDeviceStatus;
  lastError?: string;
  lastHeartbeatAt?: string;

  // 位置
  locationDescription?: string;
  latitude?: number;
  longitude?: number;

  // 时间戳
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 发现的大华设备
 */
export interface DiscoveredDahuaDevice {
  mac: string;
  ipAddress: string;
  subnetMask?: string;
  gateway?: string;
  port: number;         // TCP port (37777)
  httpPort: number;     // HTTP port (80)
  deviceType?: string;
  serialNumber?: string;
  model?: string;
  vendor?: string;
  firmwareVersion?: string;
  activated: boolean;
  discoveredAt: number;
}

/**
 * 创建设备请求
 */
export interface DahuaDeviceCreateDTO {
  deviceName: string;
  deviceType: DahuaDeviceType;
  deviceModel?: string;
  serialNumber?: string;
  macAddress?: string;
  firmwareVersion?: string;
  ipAddress: string;
  port?: number;
  rtspPort?: number;
  tcpPort?: number;
  httpsPort?: number;
  protocol?: DahuaProtocol;
  username: string;
  password: string;
  channelCount?: number;
  supportsPtz?: boolean;
  supportsAudio?: boolean;
  supportsSmart?: boolean;
  locationDescription?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * 流媒体地址
 */
export interface DahuaStreamUrls {
  mainStream: string;
  subStream: string;
  thirdStream?: string;
}

/**
 * 设备配置请求
 */
export interface DahuaProvisioningConfig {
  mac: string;
  ipAddress?: string;
  subnetMask?: string;
  gateway?: string;
  password?: string;
  deviceName?: string;
}

/**
 * 设备配置结果
 */
export interface DahuaProvisioningResult {
  success: boolean;
  mac: string;
  message?: string;
  error?: string;
  ipAddress?: string;
  activated?: boolean;
}

/**
 * 设备统计
 */
export interface DeviceStats {
  total: number;
  online: number;
  offline: number;
  error: number;
  unactivated: number;
  byType: Record<DahuaDeviceType, number>;
}

/**
 * 分页响应类型 (用于导出)
 */
export type PaginatedResponse<T> = PageResponse<T>;

// ========== 设备发现 API ==========

/**
 * 发现网络中的大华设备 (使用 DH-SD 协议)
 *
 * @param factoryId 工厂ID
 * @param timeout 超时时间（毫秒）
 */
export async function discoverDahuaDevices(
  factoryId: string,
  timeout?: number
): Promise<DiscoveredDahuaDevice[]> {
  const effectiveFactoryId = getCurrentFactoryId(factoryId);
  const params = timeout ? { timeout } : {};
  const response = await apiClient.get<ApiResponse<DiscoveredDahuaDevice[]>>(
    `/api/mobile/${effectiveFactoryId}/dahua/devices/discover`,
    { params }
  );
  return response.data;
}

/**
 * 在所有网络接口上发现大华设备
 *
 * @param factoryId 工厂ID
 * @param timeout 超时时间（毫秒）
 */
export async function discoverDahuaOnAllInterfaces(
  factoryId: string,
  timeout?: number
): Promise<DiscoveredDahuaDevice[]> {
  const effectiveFactoryId = getCurrentFactoryId(factoryId);
  const params = timeout ? { timeout } : {};
  const response = await apiClient.get<ApiResponse<DiscoveredDahuaDevice[]>>(
    `/api/mobile/${effectiveFactoryId}/dahua/devices/discover/all-interfaces`,
    { params }
  );
  return response.data;
}

/**
 * 探测单个 IP 地址上的大华设备
 *
 * @param factoryId 工厂ID
 * @param ipAddress IP地址
 * @param port 端口号 (默认 37777)
 */
export async function probeDahuaDevice(
  factoryId: string,
  ipAddress: string,
  port?: number
): Promise<DiscoveredDahuaDevice> {
  const effectiveFactoryId = getCurrentFactoryId(factoryId);
  const params = port ? { port } : {};
  const response = await apiClient.get<ApiResponse<DiscoveredDahuaDevice>>(
    `/api/mobile/${effectiveFactoryId}/dahua/devices/probe/${ipAddress}`,
    { params }
  );
  return response.data;
}

// ========== 设备 CRUD API ==========

/**
 * 获取设备列表
 *
 * @param factoryId 工厂ID
 * @param page 页码 (从0开始)
 * @param size 每页数量
 * @param keyword 搜索关键词
 */
export async function getDahuaDevices(
  factoryId: string,
  page?: number,
  size?: number,
  keyword?: string
): Promise<PaginatedResponse<DahuaDevice>> {
  const effectiveFactoryId = getCurrentFactoryId(factoryId);
  const params: Record<string, unknown> = {};
  if (page !== undefined) params.page = page;
  if (size !== undefined) params.size = size;
  if (keyword) params.keyword = keyword;

  const response = await apiClient.get<ApiResponse<PageResponse<DahuaDevice>>>(
    `/api/mobile/${effectiveFactoryId}/dahua/devices`,
    { params }
  );
  return response.data;
}

/**
 * 获取设备详情
 *
 * @param factoryId 工厂ID
 * @param deviceId 设备ID
 */
export async function getDahuaDevice(
  factoryId: string,
  deviceId: string
): Promise<DahuaDevice> {
  const effectiveFactoryId = getCurrentFactoryId(factoryId);
  const response = await apiClient.get<ApiResponse<DahuaDevice>>(
    `/api/mobile/${effectiveFactoryId}/dahua/devices/${deviceId}`
  );
  return response.data;
}

/**
 * 创建设备
 *
 * @param factoryId 工厂ID
 * @param device 设备信息
 */
export async function createDahuaDevice(
  factoryId: string,
  device: DahuaDeviceCreateDTO
): Promise<DahuaDevice> {
  const effectiveFactoryId = getCurrentFactoryId(factoryId);
  const response = await apiClient.post<ApiResponse<DahuaDevice>>(
    `/api/mobile/${effectiveFactoryId}/dahua/devices`,
    device
  );
  return response.data;
}

/**
 * 更新设备
 *
 * @param factoryId 工厂ID
 * @param deviceId 设备ID
 * @param device 设备信息
 */
export async function updateDahuaDevice(
  factoryId: string,
  deviceId: string,
  device: Partial<DahuaDeviceCreateDTO>
): Promise<DahuaDevice> {
  const effectiveFactoryId = getCurrentFactoryId(factoryId);
  const response = await apiClient.put<ApiResponse<DahuaDevice>>(
    `/api/mobile/${effectiveFactoryId}/dahua/devices/${deviceId}`,
    device
  );
  return response.data;
}

/**
 * 删除设备
 *
 * @param factoryId 工厂ID
 * @param deviceId 设备ID
 */
export async function deleteDahuaDevice(
  factoryId: string,
  deviceId: string
): Promise<void> {
  const effectiveFactoryId = getCurrentFactoryId(factoryId);
  await apiClient.delete(
    `/api/mobile/${effectiveFactoryId}/dahua/devices/${deviceId}`
  );
}

// ========== 从发现导入设备 ==========

/**
 * 从发现的设备导入
 *
 * @param factoryId 工厂ID
 * @param discoveredDevice 发现的设备
 * @param username 用户名
 * @param password 密码
 * @param deviceName 设备名称 (可选)
 */
export async function importDahuaDevice(
  factoryId: string,
  discoveredDevice: DiscoveredDahuaDevice,
  username: string,
  password: string,
  deviceName?: string
): Promise<DahuaDevice> {
  const effectiveFactoryId = getCurrentFactoryId(factoryId);
  const response = await apiClient.post<ApiResponse<DahuaDevice>>(
    `/api/mobile/${effectiveFactoryId}/dahua/devices/import`,
    {
      ...discoveredDevice,
      username,
      password,
      deviceName: deviceName || `Dahua_${discoveredDevice.mac.slice(-8)}`,
    }
  );
  return response.data;
}

// ========== 连接管理 API ==========

/**
 * 测试设备连接
 *
 * @param factoryId 工厂ID
 * @param deviceId 设备ID
 */
export async function testDahuaConnection(
  factoryId: string,
  deviceId: string
): Promise<boolean> {
  const effectiveFactoryId = getCurrentFactoryId(factoryId);
  const response = await apiClient.post<ApiResponse<{ connected: boolean }>>(
    `/api/mobile/${effectiveFactoryId}/dahua/devices/${deviceId}/test-connection`
  );
  return response.data.connected;
}

/**
 * 同步设备信息
 *
 * @param factoryId 工厂ID
 * @param deviceId 设备ID
 */
export async function syncDahuaDevice(
  factoryId: string,
  deviceId: string
): Promise<void> {
  const effectiveFactoryId = getCurrentFactoryId(factoryId);
  await apiClient.post(
    `/api/mobile/${effectiveFactoryId}/dahua/devices/${deviceId}/sync`
  );
}

// ========== 流媒体 API ==========

/**
 * 获取流媒体地址
 *
 * @param factoryId 工厂ID
 * @param deviceId 设备ID
 * @param channelId 通道ID (默认 1)
 */
export async function getDahuaStreamUrls(
  factoryId: string,
  deviceId: string,
  channelId?: number
): Promise<DahuaStreamUrls> {
  const effectiveFactoryId = getCurrentFactoryId(factoryId);
  const params = channelId ? { channelId } : {};
  const response = await apiClient.get<ApiResponse<DahuaStreamUrls>>(
    `/api/mobile/${effectiveFactoryId}/dahua/devices/${deviceId}/streams`,
    { params }
  );
  return response.data;
}

/**
 * 抓拍图片
 *
 * @param factoryId 工厂ID
 * @param deviceId 设备ID
 * @param channelId 通道ID (默认 1)
 * @returns Base64 编码的图片数据
 */
export async function captureDahuaPicture(
  factoryId: string,
  deviceId: string,
  channelId?: number
): Promise<string> {
  const effectiveFactoryId = getCurrentFactoryId(factoryId);
  const params = channelId ? { channelId } : {};
  const response = await apiClient.post<ApiResponse<{ pictureBase64: string }>>(
    `/api/mobile/${effectiveFactoryId}/dahua/devices/${deviceId}/capture`,
    null,
    { params }
  );
  return response.data.pictureBase64;
}

// ========== 设备统计 API ==========

/**
 * 获取设备统计
 *
 * @param factoryId 工厂ID
 */
export async function getDahuaDeviceStats(
  factoryId: string
): Promise<DeviceStats> {
  const effectiveFactoryId = getCurrentFactoryId(factoryId);
  const response = await apiClient.get<ApiResponse<DeviceStats>>(
    `/api/mobile/${effectiveFactoryId}/dahua/devices/stats`
  );
  return response.data;
}

// ========== 设备配置 API ==========

/**
 * 配置大华设备 (设置 IP、密码等)
 *
 * @param factoryId 工厂ID
 * @param config 配置信息
 */
export async function provisionDahuaDevice(
  factoryId: string,
  config: DahuaProvisioningConfig
): Promise<DahuaProvisioningResult> {
  const effectiveFactoryId = getCurrentFactoryId(factoryId);
  const response = await apiClient.post<ApiResponse<DahuaProvisioningResult>>(
    `/api/mobile/${effectiveFactoryId}/dahua/devices/provision`,
    config
  );
  return response.data;
}

/**
 * 激活未激活的大华设备
 *
 * @param factoryId 工厂ID
 * @param deviceMac 设备 MAC 地址
 * @param password 设置的密码
 */
export async function activateDahuaDevice(
  factoryId: string,
  deviceMac: string,
  password: string
): Promise<DahuaProvisioningResult> {
  const effectiveFactoryId = getCurrentFactoryId(factoryId);
  const response = await apiClient.post<ApiResponse<DahuaProvisioningResult>>(
    `/api/mobile/${effectiveFactoryId}/dahua/devices/activate`,
    { mac: deviceMac, password }
  );
  return response.data;
}

// ========== 辅助方法 ==========

/**
 * 获取设备类型显示名称
 */
export function getDeviceTypeName(type: DahuaDeviceType): string {
  const names: Record<DahuaDeviceType, string> = {
    IPC: '网络摄像机',
    NVR: '网络硬盘录像机',
    DVR: '硬盘录像机',
    XVR: '混合型录像机',
  };
  return names[type] || type;
}

/**
 * 获取设备状态显示名称
 */
export function getDeviceStatusName(status: DahuaDeviceStatus): string {
  const names: Record<DahuaDeviceStatus, string> = {
    ONLINE: '在线',
    OFFLINE: '离线',
    CONNECTING: '连接中',
    ERROR: '错误',
    UNKNOWN: '未知',
    UNACTIVATED: '未激活',
  };
  return names[status] || status;
}

/**
 * 获取设备状态颜色
 */
export function getDeviceStatusColor(status: DahuaDeviceStatus): string {
  const colors: Record<DahuaDeviceStatus, string> = {
    ONLINE: '#48bb78',
    OFFLINE: '#a0aec0',
    CONNECTING: '#ed8936',
    ERROR: '#e53e3e',
    UNKNOWN: '#718096',
    UNACTIVATED: '#805ad5',
  };
  return colors[status] || '#718096';
}

/**
 * 获取设备类型图标名称 (MaterialCommunityIcons)
 */
export function getDeviceTypeIcon(type: DahuaDeviceType): string {
  const icons: Record<DahuaDeviceType, string> = {
    IPC: 'camera',
    NVR: 'server',
    DVR: 'harddisk',
    XVR: 'video-switch',
  };
  return icons[type] || 'help-circle';
}

/**
 * 格式化 MAC 地址
 */
export function formatMacAddress(mac: string): string {
  // Remove any existing separators and convert to uppercase
  const cleaned = mac.replace(/[:-]/g, '').toUpperCase();
  // Insert colons every 2 characters
  return cleaned.match(/.{1,2}/g)?.join(':') || mac;
}

/**
 * 生成默认 RTSP URL
 *
 * @param device 设备信息
 * @param channel 通道号
 * @param subtype 码流类型 (0=主码流, 1=辅码流)
 */
export function generateRtspUrl(
  device: DahuaDevice,
  channel: number = 1,
  subtype: number = 0
): string {
  const port = device.rtspPort || 554;
  return `rtsp://${device.username}@${device.ipAddress}:${port}/cam/realmonitor?channel=${channel}&subtype=${subtype}`;
}

/**
 * 判断设备是否需要激活
 */
export function needsActivation(device: DahuaDevice | DiscoveredDahuaDevice): boolean {
  if ('status' in device) {
    return device.status === 'UNACTIVATED';
  }
  return !device.activated;
}

// ========== 导出默认对象 ==========

export default {
  // 设备发现
  discoverDahuaDevices,
  discoverDahuaOnAllInterfaces,
  probeDahuaDevice,

  // 设备 CRUD
  getDahuaDevices,
  getDahuaDevice,
  createDahuaDevice,
  updateDahuaDevice,
  deleteDahuaDevice,

  // 导入
  importDahuaDevice,

  // 连接管理
  testDahuaConnection,
  syncDahuaDevice,

  // 流媒体
  getDahuaStreamUrls,
  captureDahuaPicture,

  // 统计
  getDahuaDeviceStats,

  // 设备配置
  provisionDahuaDevice,
  activateDahuaDevice,

  // 辅助方法
  getDeviceTypeName,
  getDeviceStatusName,
  getDeviceStatusColor,
  getDeviceTypeIcon,
  formatMacAddress,
  generateRtspUrl,
  needsActivation,
};
