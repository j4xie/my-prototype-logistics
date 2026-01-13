import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 标签自动识别 API 客户端
 *
 * 后端实现：
 * - LabelRecognitionController: /api/mobile/{factoryId}/label-recognition/*
 *
 * 功能：
 * - 识别配置管理（CRUD）
 * - 手动触发识别
 * - 识别历史记录查询
 * - 统计数据
 */

// ========== API 响应类型 ==========

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

// ========== 识别配置 ==========

export interface LabelRecognitionConfig {
  id: number;
  factoryId: string;
  deviceId: string;
  deviceName?: string;
  channelId: number;
  configName: string;
  triggerOnVmd: boolean;
  triggerOnFieldDetection: boolean;
  cooldownSeconds: number;
  minConfidence: number;
  defaultBatchId?: string;
  enabled: boolean;
  lastTriggerTime?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ========== 识别记录 ==========

export type TriggerType = 'VMD' | 'FIELD_DETECTION' | 'MANUAL';
export type RecognitionStatus = 'SUCCESS' | 'FAILED' | 'NO_LABEL' | 'LOW_CONFIDENCE';
export type PrintQuality = 'GOOD' | 'ACCEPTABLE' | 'POOR' | 'UNREADABLE';

export interface LabelRecognitionRecord {
  id: number;
  factoryId: string;
  configId?: number;
  configName?: string;
  deviceId?: string;
  deviceName?: string;
  triggerType: TriggerType;
  status: RecognitionStatus;
  recognizedBatchNumber?: string;
  expectedBatchNumber?: string;
  batchMatch?: boolean;
  printQuality?: PrintQuality;
  confidence?: number;
  qualityScore?: number;
  qualityIssues?: string[];
  capturedImageUrl?: string;
  recognitionTime: string;
  processingDurationMs?: number;
  errorMessage?: string;
}

// ========== 统计数据 ==========

export interface LabelRecognitionStatistics {
  todayTotal: number;
  todaySuccess: number;
  todayFailed: number;
  successRate: number;
  avgConfidence: number;
  avgProcessingTime: number;
  hourlyStats?: Array<{
    hour: number;
    total: number;
    success: number;
  }>;
}

// ========== 创建/更新配置请求 ==========

export interface CreateConfigRequest {
  deviceId: string;
  channelId?: number;
  configName: string;
  triggerOnVmd?: boolean;
  triggerOnFieldDetection?: boolean;
  cooldownSeconds?: number;
  minConfidence?: number;
  defaultBatchId?: string;
  enabled?: boolean;
}

export interface UpdateConfigRequest {
  configName?: string;
  triggerOnVmd?: boolean;
  triggerOnFieldDetection?: boolean;
  cooldownSeconds?: number;
  minConfidence?: number;
  defaultBatchId?: string;
  enabled?: boolean;
}

// ========== API 函数 ==========

/**
 * 获取识别配置列表
 */
export async function getConfigs(): Promise<LabelRecognitionConfig[]> {
  const factoryId = await getCurrentFactoryId();
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/label-recognition/configs`
  ) as ApiResponse<LabelRecognitionConfig[]>;
  return response.data;
}

/**
 * 获取单个识别配置
 * @param configId 配置ID
 */
export async function getConfig(configId: number): Promise<LabelRecognitionConfig> {
  const factoryId = await getCurrentFactoryId();
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/label-recognition/configs/${configId}`
  ) as ApiResponse<LabelRecognitionConfig>;
  return response.data;
}

/**
 * 创建识别配置
 * @param config 配置数据
 */
export async function createConfig(config: CreateConfigRequest): Promise<LabelRecognitionConfig> {
  const factoryId = await getCurrentFactoryId();
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/label-recognition/configs`,
    config
  ) as ApiResponse<LabelRecognitionConfig>;
  return response.data;
}

/**
 * 更新识别配置
 * @param configId 配置ID
 * @param config 更新数据
 */
export async function updateConfig(
  configId: number,
  config: UpdateConfigRequest
): Promise<LabelRecognitionConfig> {
  const factoryId = await getCurrentFactoryId();
  const response = await apiClient.put(
    `/api/mobile/${factoryId}/label-recognition/configs/${configId}`,
    config
  ) as ApiResponse<LabelRecognitionConfig>;
  return response.data;
}

/**
 * 删除识别配置
 * @param configId 配置ID
 */
export async function deleteConfig(configId: number): Promise<void> {
  const factoryId = await getCurrentFactoryId();
  await apiClient.delete(
    `/api/mobile/${factoryId}/label-recognition/configs/${configId}`
  );
}

/**
 * 切换配置启用状态
 * @param configId 配置ID
 */
export async function toggleConfig(configId: number): Promise<LabelRecognitionConfig> {
  const factoryId = await getCurrentFactoryId();
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/label-recognition/configs/${configId}/toggle`
  ) as ApiResponse<LabelRecognitionConfig>;
  return response.data;
}

/**
 * 手动触发识别
 * @param configId 配置ID
 */
export async function triggerRecognition(configId: number): Promise<LabelRecognitionRecord> {
  const factoryId = await getCurrentFactoryId();
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/label-recognition/configs/${configId}/trigger`
  ) as ApiResponse<LabelRecognitionRecord>;
  return response.data;
}

/**
 * 获取识别记录列表
 * @param page 页码（从0开始）
 * @param size 每页数量
 * @param configId 可选，按配置ID筛选
 */
export async function getRecords(
  page: number = 0,
  size: number = 20,
  configId?: number
): Promise<PageResponse<LabelRecognitionRecord>> {
  const factoryId = await getCurrentFactoryId();
  const params: Record<string, string | number> = { page, size };
  if (configId !== undefined) {
    params.configId = configId;
  }
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/label-recognition/records`,
    { params }
  ) as ApiResponse<PageResponse<LabelRecognitionRecord>>;
  return response.data;
}

/**
 * 获取单条识别记录详情
 * @param recordId 记录ID
 */
export async function getRecord(recordId: number): Promise<LabelRecognitionRecord> {
  const factoryId = await getCurrentFactoryId();
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/label-recognition/records/${recordId}`
  ) as ApiResponse<LabelRecognitionRecord>;
  return response.data;
}

/**
 * 获取统计数据
 */
export async function getStatistics(): Promise<LabelRecognitionStatistics> {
  const factoryId = await getCurrentFactoryId();
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/label-recognition/statistics`
  ) as ApiResponse<LabelRecognitionStatistics>;
  return response.data;
}

// ========== 辅助函数 ==========

/**
 * 获取识别状态显示名称
 */
export function getStatusName(status: RecognitionStatus): string {
  const names: Record<RecognitionStatus, string> = {
    SUCCESS: '识别成功',
    FAILED: '识别失败',
    NO_LABEL: '未检测到标签',
    LOW_CONFIDENCE: '置信度不足',
  };
  return names[status] || status;
}

/**
 * 获取识别状态颜色
 */
export function getStatusColor(status: RecognitionStatus): string {
  const colors: Record<RecognitionStatus, string> = {
    SUCCESS: '#52c41a',
    FAILED: '#ff4d4f',
    NO_LABEL: '#fa8c16',
    LOW_CONFIDENCE: '#faad14',
  };
  return colors[status] || '#9CA3AF';
}

/**
 * 获取触发类型显示名称
 */
export function getTriggerTypeName(type: TriggerType): string {
  const names: Record<TriggerType, string> = {
    VMD: '移动侦测',
    FIELD_DETECTION: '区域检测',
    MANUAL: '手动触发',
  };
  return names[type] || type;
}

/**
 * 获取打印质量显示名称
 */
export function getPrintQualityName(quality: PrintQuality | undefined): string {
  if (!quality) return '未知';
  const names: Record<PrintQuality, string> = {
    GOOD: '良好',
    ACCEPTABLE: '可接受',
    POOR: '较差',
    UNREADABLE: '无法读取',
  };
  return names[quality] || quality;
}

/**
 * 获取打印质量颜色
 */
export function getPrintQualityColor(quality: PrintQuality | undefined): string {
  if (!quality) return '#9CA3AF';
  const colors: Record<PrintQuality, string> = {
    GOOD: '#52c41a',
    ACCEPTABLE: '#ed8936',
    POOR: '#ff4d4f',
    UNREADABLE: '#a0aec0',
  };
  return colors[quality] || '#9CA3AF';
}

/**
 * 格式化置信度为百分比
 */
export function formatConfidence(confidence: number | undefined): string {
  if (confidence === undefined) return '--';
  return `${Math.round(confidence * 100)}%`;
}

/**
 * 格式化处理时间
 */
export function formatProcessingTime(ms: number | undefined): string {
  if (ms === undefined) return '--';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ========== 导出默认对象 ==========

export default {
  getConfigs,
  getConfig,
  createConfig,
  updateConfig,
  deleteConfig,
  toggleConfig,
  triggerRecognition,
  getRecords,
  getRecord,
  getStatistics,
  getStatusName,
  getStatusColor,
  getTriggerTypeName,
  getPrintQualityName,
  getPrintQualityColor,
  formatConfidence,
  formatProcessingTime,
};
