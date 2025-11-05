import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

/**
 * 考勤打卡管理API客户端
 * 对接后端路径：/api/mobile/{factoryId}/timeclock/*
 * 
 * 后端API文档参考：
 * - TimeClockController.java
 * - 路径：/api/mobile/{factoryId}/timeclock
 */

export interface ClockInRequest {
  userId: number;
  location?: string;
  device?: string;
}

export interface ClockOutRequest {
  userId: number;
}

export interface ClockRecord {
  id?: number;
  userId: number;
  type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  clockTime: string;
  location?: string;
  device?: string;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClockStatus {
  canClockIn: boolean;
  canClockOut: boolean;
  lastClockIn?: string;
  lastClockOut?: string;
  todayRecord?: ClockRecord;
}

class TimeClockApiClient {
  private getPath(factoryId?: string) {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}/timeclock`;
  }

  /**
   * 1. 上班打卡
   * POST /api/mobile/{factoryId}/timeclock/clock-in
   */
  async clockIn(params: ClockInRequest, factoryId?: string) {
    const { userId, location, device } = params;
    return await apiClient.post(`${this.getPath(factoryId)}/clock-in`, null, {
      params: {
        userId,
        ...(location && { location }),
        ...(device && { device }),
      },
    });
  }

  /**
   * 2. 下班打卡
   * POST /api/mobile/{factoryId}/timeclock/clock-out
   */
  async clockOut(params: ClockOutRequest, factoryId?: string) {
    const { userId } = params;
    return await apiClient.post(`${this.getPath(factoryId)}/clock-out`, null, {
      params: { userId },
    });
  }

  /**
   * 3. 开始休息
   * POST /api/mobile/{factoryId}/timeclock/break-start
   */
  async breakStart(userId: number, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/break-start`, null, {
      params: { userId },
    });
  }

  /**
   * 4. 结束休息
   * POST /api/mobile/{factoryId}/timeclock/break-end
   */
  async breakEnd(userId: number, factoryId?: string) {
    return await apiClient.post(`${this.getPath(factoryId)}/break-end`, null, {
      params: { userId },
    });
  }

  /**
   * 5. 获取打卡状态
   * GET /api/mobile/{factoryId}/timeclock/status
   */
  async getClockStatus(userId: number, factoryId?: string): Promise<{ data: ClockStatus }> {
    return await apiClient.get(`${this.getPath(factoryId)}/status`, {
      params: { userId },
    });
  }

  /**
   * 6. 获取今日打卡记录
   * GET /api/mobile/{factoryId}/timeclock/today
   */
  async getTodayRecord(userId: number, factoryId?: string): Promise<{ data: ClockRecord }> {
    return await apiClient.get(`${this.getPath(factoryId)}/today`, {
      params: { userId },
    });
  }

  /**
   * 7. 获取打卡历史
   * GET /api/mobile/{factoryId}/timeclock/history
   */
  async getClockHistory(
    userId: number,
    params: {
      startDate: string; // ISO date string: YYYY-MM-DD
      endDate: string; // ISO date string: YYYY-MM-DD
      page?: number;
      size?: number;
    },
    factoryId?: string
  ) {
    return await apiClient.get(`${this.getPath(factoryId)}/history`, {
      params: {
        userId,
        startDate: params.startDate,
        endDate: params.endDate,
        page: params.page || 1,
        size: params.size || 20,
      },
    });
  }

  /**
   * 8. 获取考勤统计
   * GET /api/mobile/{factoryId}/timeclock/statistics
   */
  async getAttendanceStatistics(
    userId: number,
    params: {
      startDate: string; // ISO date string: YYYY-MM-DD
      endDate: string; // ISO date string: YYYY-MM-DD
    },
    factoryId?: string
  ) {
    return await apiClient.get(`${this.getPath(factoryId)}/statistics`, {
      params: {
        userId,
        startDate: params.startDate,
        endDate: params.endDate,
      },
    });
  }

  /**
   * 9. 获取部门考勤
   * GET /api/mobile/{factoryId}/timeclock/department/{department}
   */
  async getDepartmentAttendance(
    department: string,
    date: string, // ISO date string: YYYY-MM-DD
    factoryId?: string
  ) {
    return await apiClient.get(`${this.getPath(factoryId)}/department/${department}`, {
      params: { date },
    });
  }

  /**
   * 10. 修改打卡记录
   * PUT /api/mobile/{factoryId}/timeclock/records/{recordId}
   */
  async editClockRecord(
    recordId: number,
    record: Partial<ClockRecord>,
    params: {
      editedBy: number;
      reason: string;
    },
    factoryId?: string
  ) {
    return await apiClient.put(
      `${this.getPath(factoryId)}/records/${recordId}`,
      record,
      {
        params: {
          editedBy: params.editedBy,
          reason: params.reason,
        },
      }
    );
  }

  /**
   * 11. 导出考勤记录
   * GET /api/mobile/{factoryId}/timeclock/export
   */
  async exportAttendanceRecords(
    params: {
      startDate: string; // ISO date string: YYYY-MM-DD
      endDate: string; // ISO date string: YYYY-MM-DD
    },
    factoryId?: string
  ) {
    return await apiClient.get(`${this.getPath(factoryId)}/export`, {
      params: {
        startDate: params.startDate,
        endDate: params.endDate,
      },
      responseType: 'blob',
    });
  }
}

export const timeclockApiClient = new TimeClockApiClient();
export default timeclockApiClient;

