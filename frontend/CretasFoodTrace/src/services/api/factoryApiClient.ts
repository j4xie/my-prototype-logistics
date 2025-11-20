import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

/**
 * 工厂设置API客户端
 * 路径：/api/mobile/{factoryId}/settings
 *
 * 后端实现：MobileController
 * 功能：获取/更新工厂设置（基本信息、工作时间、考勤配置）
 */

// ========== 类型定义 ==========

/**
 * 工作时间配置
 */
export interface WorkingHours {
  startTime: string; // "08:00"
  endTime: string;   // "17:00"
}

/**
 * 工厂设置响应
 */
export interface FactorySettingsResponse {
  // 基本信息
  factoryName: string;
  factoryAddress: string;
  contactPhone: string;
  contactEmail: string;

  // 工作时间配置
  workingHours: WorkingHours;
  lunchBreakStart: string;
  lunchBreakEnd: string;
  workingDays: boolean[]; // [周一, 周二, ...周日] - 7个布尔值

  // 考勤配置
  lateThresholdMinutes: number;
  earlyLeaveThresholdMinutes: number;

  // 功能开关
  enableOvertimeTracking: boolean;
  enableGPSChecking: boolean;
}

/**
 * 更新工厂设置请求
 */
export interface UpdateFactorySettingsRequest {
  // 基本信息
  factoryName?: string;
  factoryAddress?: string;
  contactPhone?: string;
  contactEmail?: string;

  // 工作时间配置
  workingHours?: WorkingHours;
  lunchBreakStart?: string;
  lunchBreakEnd?: string;
  workingDays?: boolean[];

  // 考勤配置
  lateThresholdMinutes?: number;
  earlyLeaveThresholdMinutes?: number;

  // 功能开关
  enableOvertimeTracking?: boolean;
  enableGPSChecking?: boolean;
}

// ========== API客户端类 ==========

class FactoryApiClient {
  private getPath(factoryId?: string) {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}/settings`;
  }

  /**
   * 获取工厂设置
   * GET /settings
   */
  async getFactorySettings(
    factoryId?: string
  ): Promise<{ success: boolean; data: FactorySettingsResponse; message: string }> {
    const response = await apiClient.get(this.getPath(factoryId));
    return response.data;
  }

  /**
   * 更新工厂设置
   * PUT /settings
   */
  async updateFactorySettings(
    request: UpdateFactorySettingsRequest,
    factoryId?: string
  ): Promise<{ success: boolean; data: FactorySettingsResponse; message: string }> {
    const response = await apiClient.put(this.getPath(factoryId), request);
    return response.data;
  }
}

// ========== 单例导出 ==========

export const factoryApiClient = new FactoryApiClient();
export default factoryApiClient;
