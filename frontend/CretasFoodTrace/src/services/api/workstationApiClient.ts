import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 工位计数 API 客户端
 *
 * 后端实现：
 * - WorkstationCountingController: /api/mobile/{factoryId}/workstation-counting/*
 *
 * 功能：
 * - 工位初始化（绑定摄像头、电子秤、工人、批次）
 * - 图像帧处理（AI识别完成手势，2秒防抖）
 * - 手动计数
 * - 标签验证（OCR识别）
 * - 工位状态查询
 */

// ========== API 响应类型 ==========

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// ========== 工位配置 ==========

export interface WorkstationConfig {
  factoryId?: string;
  workstationId?: string;
  workstationName: string;
  cameraId?: string;
  cameraChannelId?: number;
  scaleDeviceId?: string;
  workerId?: number;
  workerName?: string;
  productionBatchId?: string;
  stageType?: string;
}

// ========== 初始化结果 ==========

export interface WorkstationInitResult {
  success: boolean;
  workstationId: string;
  message: string;
  config: WorkstationConfig;
  initialState: {
    count: number;
    totalWeight: number;
  };
}

// ========== 计数结果 ==========

export interface CountingResult {
  success: boolean;
  counted: boolean;
  message: string;
  currentCount?: number;
  currentWeight?: number;
  totalWeight?: number;
  confidence?: number;
  gestureType?: string;
  workerDetected?: boolean;
  productDetected?: boolean;
}

// ========== 标签验证结果 ==========

export interface LabelVerifyResult {
  success: boolean;
  verified: boolean;
  message: string;
  readable?: boolean;
  printQuality?: 'GOOD' | 'ACCEPTABLE' | 'POOR' | 'UNREADABLE';
  recognizedBatchNumber?: string;
  batchMatch?: boolean;
  confidence?: number;
  qualityScore?: number;
  qualityIssues?: string[];
}

// ========== 工位状态 ==========

export interface WorkstationStatusInfo {
  workstationId: string;
  active: boolean;
  message: string;
  config?: WorkstationConfig;
  count: number;
  totalWeight: number;
  itemWeights: number[];
  averageWeight?: number;
  lastCountTime?: string;
  startTime?: string;
  cameraConnected?: boolean;
  scaleConnected?: boolean;
}

// ========== 停止结果 ==========

export interface WorkstationStopResult {
  success: boolean;
  message: string;
  finalCount: number;
  finalWeight: number;
  duration?: string;
  savedRecordId?: string;
}

// ========== API 函数 ==========

/**
 * 初始化工位计数会话
 */
export async function initWorkstation(config: WorkstationConfig): Promise<WorkstationInitResult> {
  const factoryId = await getCurrentFactoryId();
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/workstation-counting/init`,
    config
  ) as ApiResponse<WorkstationInitResult>;
  return response.data;
}

/**
 * 处理图像帧（AI识别完成手势）
 * @param workstationId 工位ID
 * @param imageBase64 Base64编码的图像数据
 */
export async function processFrame(
  workstationId: string,
  imageBase64: string
): Promise<CountingResult> {
  const factoryId = await getCurrentFactoryId();
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/workstation-counting/${workstationId}/frame`,
    { imageBase64 }
  ) as ApiResponse<CountingResult>;
  return response.data;
}

/**
 * 手动计数
 * @param workstationId 工位ID
 * @param weight 可选的重量数据
 */
export async function manualCount(
  workstationId: string,
  weight?: number
): Promise<CountingResult> {
  const factoryId = await getCurrentFactoryId();
  const body = weight !== undefined ? { weight } : {};
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/workstation-counting/${workstationId}/manual-count`,
    body
  ) as ApiResponse<CountingResult>;
  return response.data;
}

/**
 * 验证标签（OCR识别）
 * @param workstationId 工位ID
 * @param labelImageBase64 Base64编码的标签图像
 */
export async function verifyLabel(
  workstationId: string,
  labelImageBase64: string
): Promise<LabelVerifyResult> {
  const factoryId = await getCurrentFactoryId();
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/workstation-counting/${workstationId}/verify-label`,
    { labelImageBase64 }
  ) as ApiResponse<LabelVerifyResult>;
  return response.data;
}

/**
 * 获取工位状态
 * @param workstationId 工位ID
 */
export async function getWorkstationStatus(workstationId: string): Promise<WorkstationStatusInfo> {
  const factoryId = await getCurrentFactoryId();
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/workstation-counting/${workstationId}/status`
  ) as ApiResponse<WorkstationStatusInfo>;
  return response.data;
}

/**
 * 停止工位计数会话
 * @param workstationId 工位ID
 */
export async function stopWorkstation(workstationId: string): Promise<WorkstationStopResult> {
  const factoryId = await getCurrentFactoryId();
  const response = await apiClient.post(
    `/api/mobile/${factoryId}/workstation-counting/${workstationId}/stop`
  ) as ApiResponse<WorkstationStopResult>;
  return response.data;
}

// ========== 辅助函数 ==========

/**
 * 获取打印质量显示名称
 */
export function getPrintQualityName(quality: LabelVerifyResult['printQuality']): string {
  const names: Record<string, string> = {
    GOOD: '良好',
    ACCEPTABLE: '可接受',
    POOR: '较差',
    UNREADABLE: '无法读取',
  };
  return quality ? names[quality] || quality : '未知';
}

/**
 * 获取打印质量颜色
 */
export function getPrintQualityColor(quality: LabelVerifyResult['printQuality']): string {
  const colors: Record<string, string> = {
    GOOD: '#48bb78',
    ACCEPTABLE: '#ed8936',
    POOR: '#e53e3e',
    UNREADABLE: '#a0aec0',
  };
  return quality ? colors[quality] || '#718096' : '#718096';
}

// ========== 导出默认对象 ==========

export default {
  initWorkstation,
  processFrame,
  manualCount,
  verifyLabel,
  getWorkstationStatus,
  stopWorkstation,
  getPrintQualityName,
  getPrintQualityColor,
};
