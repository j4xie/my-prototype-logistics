import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';
import { getErrorMsg } from '../../utils/errorHandler';
import { AxiosResponse } from 'axios';

// API 响应包装类型
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * 电子秤设备管理 API 客户端
 *
 * 后端实现：
 * - ScaleDeviceController: /api/mobile/{factoryId}/scale-devices/*
 * - ScaleProtocolController: /api/mobile/scale-protocols/*
 *
 * 功能：
 * - IoT 电子秤设备 CRUD
 * - 协议配置管理
 * - 品牌型号管理
 * - 数据解析测试
 */

// ========== 类型定义 ==========

/**
 * 协议连接类型
 */
export type ConnectionType =
  | 'RS232'
  | 'RS485'
  | 'HTTP_API'
  | 'MQTT'
  | 'MODBUS_RTU'
  | 'MODBUS_TCP'
  | 'TCP_SOCKET';

/**
 * 校验和类型
 */
export type ChecksumType =
  | 'NONE'
  | 'XOR'
  | 'CRC16'
  | 'CRC32'
  | 'SUM'
  | 'MODBUS_CRC';

/**
 * 读取模式
 */
export type ReadMode =
  | 'CONTINUOUS'  // 连续输出
  | 'POLL'        // 轮询
  | 'ON_CHANGE';  // 变化时上报

/**
 * 秤类型
 */
export type ScaleType =
  | 'DESKTOP'   // 桌面秤
  | 'PLATFORM'  // 台秤
  | 'FLOOR';    // 地磅

/**
 * 秤协议配置
 */
export interface ScaleProtocol {
  id: string;
  factoryId?: string;
  protocolCode: string;
  protocolName: string;
  connectionType: ConnectionType;
  serialConfig?: string;
  apiConfig?: string;
  frameFormat: string;
  parsingRuleGroup?: string;
  checksumType?: ChecksumType;
  readMode?: ReadMode;
  stableThresholdMs?: number;
  modbusConfig?: string;
  documentationUrl?: string;
  sampleDataHex?: string;
  isActive?: boolean;
  isVerified?: boolean;
  isBuiltin?: boolean;
  description?: string;
}

/**
 * 秤品牌型号
 */
export interface ScaleBrandModel {
  id: string;
  brandCode: string;
  brandName: string;
  brandNameEn?: string;
  modelCode: string;
  modelName?: string;
  supportedProtocolIds?: string;
  defaultProtocolId?: string;
  hasSerialPort?: boolean;
  hasWifi?: boolean;
  hasEthernet?: boolean;
  hasBluetooth?: boolean;
  hasUsb?: boolean;
  weightRange?: string;
  accuracy?: string;
  scaleType?: ScaleType;
  ipRating?: string;
  material?: string;
  manufacturer?: string;
  manufacturerWebsite?: string;
  priceRange?: string;
  recommendationScore?: number;
  recommendationReason?: string;
  documentationUrl?: string;
  imageUrl?: string;
  isRecommended?: boolean;
  isVerified?: boolean;
  description?: string;
  sortOrder?: number;
}

/**
 * IoT 秤设备
 */
export interface ScaleDevice {
  id: number;
  factoryId: string;
  equipmentCode: string;
  equipmentName: string;
  type?: string;
  model?: string;
  manufacturer?: string;
  status: string;
  location?: string;
  serialNumber?: string;

  // IoT 相关
  iotDeviceCode?: string;
  deviceCategory?: string;
  scaleProtocolId?: string;
  scaleBrandModelId?: string;
  mqttTopic?: string;
  scaleConnectionParams?: string;

  // 实时数据
  lastWeightReading?: number;
  lastWeightTime?: string;
  lastDataReceived?: string;

  // 关联信息
  protocol?: ScaleProtocol;
  brandModel?: ScaleBrandModel;
}

/**
 * 创建秤设备请求
 */
export interface CreateScaleDeviceRequest {
  equipmentName: string;
  equipmentCode: string;
  location?: string;
  serialNumber?: string;
  scaleBrandModelId?: string;
  scaleProtocolId?: string;
  iotDeviceCode?: string;
  mqttTopic?: string;
  scaleConnectionParams?: string;
  notes?: string;
}

/**
 * 更新秤设备请求
 */
export interface UpdateScaleDeviceRequest {
  equipmentName?: string;
  location?: string;
  serialNumber?: string;
  status?: string;
  scaleBrandModelId?: string;
  scaleProtocolId?: string;
  iotDeviceCode?: string;
  mqttTopic?: string;
  scaleConnectionParams?: string;
  notes?: string;
}

/**
 * 数据解析结果
 */
export interface ScaleDataParseResult {
  success: boolean;
  weight?: number;
  unit?: string;
  isStable?: boolean;
  isZero?: boolean;
  isOverload?: boolean;
  rawValue?: string;
  errorMessage?: string;
}

/**
 * 品牌信息
 */
export interface BrandInfo {
  brandCode: string;
  brandName: string;
  brandNameEn?: string;
}

// ========== 秤设备 API ==========

/**
 * 获取秤设备列表
 */
export async function getScaleDevices(params?: {
  page?: number;
  size?: number;
  keyword?: string;
  status?: string;
}): Promise<{
  content: ScaleDevice[];
  totalElements: number;
  totalPages: number;
}> {
  const factoryId = await getCurrentFactoryId();
  type ResponseType = AxiosResponse<ApiResponse<{ content: ScaleDevice[]; totalElements: number; totalPages: number }>>;
  const response = await apiClient.get(`/api/mobile/${factoryId}/scale-devices`, { params }) as ResponseType;
  return response.data;
}

/**
 * 获取秤设备详情
 */
export async function getScaleDevice(equipmentId: number): Promise<ScaleDevice> {
  const factoryId = await getCurrentFactoryId();
  const response = await apiClient.get(`/api/mobile/${factoryId}/scale-devices/${equipmentId}`) as AxiosResponse<ApiResponse<ScaleDevice>>;
  return response.data;
}

/**
 * 创建秤设备
 */
export async function createScaleDevice(request: CreateScaleDeviceRequest): Promise<ScaleDevice> {
  const factoryId = await getCurrentFactoryId();
  const response = await apiClient.post(`/api/mobile/${factoryId}/scale-devices`, request) as AxiosResponse<ApiResponse<ScaleDevice>>;
  return response.data;
}

/**
 * 更新秤设备
 */
export async function updateScaleDevice(
  equipmentId: number,
  request: UpdateScaleDeviceRequest
): Promise<ScaleDevice> {
  const factoryId = await getCurrentFactoryId();
  const response = await apiClient.put(`/api/mobile/${factoryId}/scale-devices/${equipmentId}`, request) as AxiosResponse<ApiResponse<ScaleDevice>>;
  return response.data;
}

/**
 * 删除秤设备
 */
export async function deleteScaleDevice(equipmentId: number): Promise<void> {
  const factoryId = await getCurrentFactoryId();
  await apiClient.delete(`/api/mobile/${factoryId}/scale-devices/${equipmentId}`);
}

/**
 * 绑定协议
 */
export async function bindProtocol(
  equipmentId: number,
  protocolId: string,
  connectionParams?: string
): Promise<ScaleDevice> {
  const factoryId = await getCurrentFactoryId();
  const response = await apiClient.post(`/api/mobile/${factoryId}/scale-devices/${equipmentId}/bind-protocol`, {
    protocolId,
    connectionParams,
  }) as AxiosResponse<ApiResponse<ScaleDevice>>;
  return response.data;
}

/**
 * 测试数据解析
 */
export async function testParse(
  protocolId: string,
  rawDataHex: string
): Promise<{
  success: boolean;
  parseResult?: ScaleDataParseResult;
  errorMessage?: string;
}> {
  const factoryId = await getCurrentFactoryId();
  type ParseResultType = { success: boolean; parseResult?: ScaleDataParseResult; errorMessage?: string };
  const response = await apiClient.post(`/api/mobile/${factoryId}/scale-devices/test-parse`, {
    protocolId,
    rawDataHex,
  }) as AxiosResponse<ApiResponse<ParseResultType>>;
  return response.data;
}

// ========== 协议管理 API ==========

/**
 * 获取协议列表
 */
export async function getProtocols(params?: {
  factoryId?: string;
  connectionType?: ConnectionType;
  verifiedOnly?: boolean;
  activeOnly?: boolean;
}): Promise<ScaleProtocol[]> {
  const response = await apiClient.get('/api/mobile/scale-protocols', { params }) as AxiosResponse<ApiResponse<ScaleProtocol[]>>;
  return response.data;
}

/**
 * 获取协议详情
 */
export async function getProtocol(protocolId: string): Promise<ScaleProtocol> {
  const response = await apiClient.get(`/api/mobile/scale-protocols/${protocolId}`) as AxiosResponse<ApiResponse<ScaleProtocol>>;
  return response.data;
}

/**
 * 创建协议
 */
export async function createProtocol(request: Partial<ScaleProtocol>): Promise<ScaleProtocol> {
  const response = await apiClient.post('/api/mobile/scale-protocols', request) as AxiosResponse<ApiResponse<ScaleProtocol>>;
  return response.data;
}

/**
 * 更新协议
 */
export async function updateProtocol(
  protocolId: string,
  request: Partial<ScaleProtocol>
): Promise<ScaleProtocol> {
  const response = await apiClient.put(`/api/mobile/scale-protocols/${protocolId}`, request) as AxiosResponse<ApiResponse<ScaleProtocol>>;
  return response.data;
}

/**
 * 删除协议
 */
export async function deleteProtocol(protocolId: string): Promise<void> {
  await apiClient.delete(`/api/mobile/scale-protocols/${protocolId}`);
}

// ========== 品牌型号 API ==========

/**
 * 获取品牌型号列表
 */
export async function getBrandModels(params?: {
  brandCode?: string;
  scaleType?: ScaleType;
  keyword?: string;
  recommendedOnly?: boolean;
}): Promise<ScaleBrandModel[]> {
  const response = await apiClient.get('/api/mobile/scale-protocols/brand-models', { params }) as AxiosResponse<ApiResponse<ScaleBrandModel[]>>;
  return response.data;
}

/**
 * 获取品牌型号详情
 */
export async function getBrandModel(modelId: string): Promise<ScaleBrandModel> {
  const response = await apiClient.get(`/api/mobile/scale-protocols/brand-models/${modelId}`) as AxiosResponse<ApiResponse<ScaleBrandModel>>;
  return response.data;
}

/**
 * 创建品牌型号
 */
export async function createBrandModel(request: Partial<ScaleBrandModel>): Promise<ScaleBrandModel> {
  const response = await apiClient.post('/api/mobile/scale-protocols/brand-models', request) as AxiosResponse<ApiResponse<ScaleBrandModel>>;
  return response.data;
}

/**
 * 更新品牌型号
 */
export async function updateBrandModel(
  modelId: string,
  request: Partial<ScaleBrandModel>
): Promise<ScaleBrandModel> {
  const response = await apiClient.put(`/api/mobile/scale-protocols/brand-models/${modelId}`, request) as AxiosResponse<ApiResponse<ScaleBrandModel>>;
  return response.data;
}

/**
 * 获取品牌列表
 */
export async function getBrands(): Promise<BrandInfo[]> {
  const response = await apiClient.get('/api/mobile/scale-protocols/brands') as AxiosResponse<ApiResponse<BrandInfo[]>>;
  return response.data;
}

// ========== 便捷方法 ==========

/**
 * 获取可用协议列表（带工厂过滤）
 */
export async function getAvailableProtocols(): Promise<ScaleProtocol[]> {
  const factoryId = await getCurrentFactoryId();
  return getProtocols({ factoryId, activeOnly: true });
}

/**
 * 获取推荐的品牌型号
 */
export async function getRecommendedBrandModels(): Promise<ScaleBrandModel[]> {
  return getBrandModels({ recommendedOnly: true });
}

/**
 * 根据品牌获取型号
 */
export async function getModelsByBrand(brandCode: string): Promise<ScaleBrandModel[]> {
  return getBrandModels({ brandCode });
}

// ========== 导出默认对象 ==========

export default {
  // 设备
  getScaleDevices,
  getScaleDevice,
  createScaleDevice,
  updateScaleDevice,
  deleteScaleDevice,
  bindProtocol,
  testParse,

  // 协议
  getProtocols,
  getProtocol,
  createProtocol,
  updateProtocol,
  deleteProtocol,
  getAvailableProtocols,

  // 品牌型号
  getBrandModels,
  getBrandModel,
  createBrandModel,
  updateBrandModel,
  getBrands,
  getRecommendedBrandModels,
  getModelsByBrand,
};
